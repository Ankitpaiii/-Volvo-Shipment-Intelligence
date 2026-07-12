from sqlalchemy.orm import Session

from app.models import ExceptionRecord, MilestoneEvent, Shipment
from app.services.gap_detection import compute_risk_and_health


# Conversation context stored in-memory (per server instance, stateless across restarts)
# Format: {session_id: [{"role": "user"|"assistant", "content": str}, ...]}
_conversation_history: dict[str, list[dict]] = {}


def _build_shipment_context(db: Session) -> str:
    """Build rich context string about current shipment network state."""
    shipments = db.query(Shipment).limit(60).all()
    exceptions = db.query(ExceptionRecord).filter(ExceptionRecord.status == "OPEN").limit(25).all()

    lines = []

    # Network summary
    total = len(shipments)
    at_risk = [s for s in shipments if s.delay_risk_score >= 40]
    critical = [s for s in shipments if s.part_criticality in ("JIT", "JIS")]
    lines.append(f"NETWORK SUMMARY: {total} shipments total, {len(at_risk)} at-risk, {len(critical)} JIT/JIS critical")

    lines.append("\n--- SHIPMENTS ---")
    for s in shipments:
        events = db.query(MilestoneEvent).filter(MilestoneEvent.shipment_id == s.shipment_id).all()
        risk, health, flags, predicted, confidence = compute_risk_and_health(s, events)
        completed_milestones = [e.event_type for e in events if e.event_type != "GPS_PING"]
        lines.append(
            f"PO={s.po_number} | lane={s.lane_name} | {s.origin_city}->{s.dest_city} | "
            f"status={s.status} | risk={risk}% | health={health}% | criticality={s.part_criticality} | "
            f"supplier={s.supplier_name} | carrier={s.carrier_name} | "
            f"ETA={predicted.strftime('%Y-%m-%d %H:%M') if predicted else 'unknown'} | "
            f"confidence={round(confidence*100)}% | flags={','.join(flags) if flags else 'none'} | "
            f"milestones_done={','.join(completed_milestones[-3:]) if completed_milestones else 'none'}"
        )

    if exceptions:
        lines.append("\n--- OPEN EXCEPTIONS ---")
        for e in exceptions:
            lines.append(
                f"EXCEPTION type={e.exception_type} | severity={e.severity} | impact={e.business_impact_score} | "
                f"msg={e.message} | action={e.recommended_action}"
            )

    return "\n".join(lines[:100])


def _fallback_answer(db: Session, question: str) -> tuple[str, list[str]]:
    """Rule-based fallback when no API key is configured."""
    shipments = db.query(Shipment).all()
    at_risk = [s for s in shipments if s.delay_risk_score >= 40]
    exceptions = db.query(ExceptionRecord).filter(ExceptionRecord.status == "OPEN").count()
    q = question.lower()
    sources = ["shipments_db", "exceptions_db"]

    if any(kw in q for kw in ("at risk", "risk", "delayed", "delay")):
        lines = [
            f"• PO {s.po_number} | {s.lane_name} | Risk {s.delay_risk_score}% | {s.status} | {s.part_criticality}"
            for s in sorted(at_risk, key=lambda x: x.delay_risk_score, reverse=True)[:8]
        ]
        answer = f"**{len(at_risk)} shipments at risk:**\n" + ("\n".join(lines) if lines else "None currently at risk.")
        return answer, sources

    if "gothenburg" in q or "sweden" in q:
        matches = [s for s in shipments if "gothenburg" in (s.dest_city + s.lane_name).lower()]
        risky = sorted([s for s in matches if s.delay_risk_score >= 40], key=lambda x: x.delay_risk_score, reverse=True)
        lines = [f"• PO {s.po_number} | Risk {s.delay_risk_score}% | {s.status} | Carrier: {s.carrier_name}" for s in risky]
        answer = f"**{len(risky)} Gothenburg shipments at risk:**\n" + ("\n".join(lines) if lines else "All Gothenburg lanes clear.")
        return answer, sources

    if any(kw in q for kw in ("exception", "alert", "critical", "p1")):
        open_exc = (
            db.query(ExceptionRecord)
            .filter(ExceptionRecord.status == "OPEN")
            .order_by(ExceptionRecord.business_impact_score.desc())
            .limit(6)
            .all()
        )
        lines = [
            f"• [{e.severity}] {e.exception_type}: {e.message} (impact score: {e.business_impact_score})"
            for e in open_exc
        ]
        answer = f"**{exceptions} open exceptions. Top items:**\n" + ("\n".join(lines) if lines else "No open exceptions.")
        return answer, sources

    if any(kw in q for kw in ("jit", "jis", "critical part", "line risk")):
        jit_ships = [s for s in shipments if s.part_criticality in ("JIT", "JIS")]
        at_risk_jit = [s for s in jit_ships if s.delay_risk_score >= 40]
        lines = [f"• PO {s.po_number} | {s.part_criticality} | Risk {s.delay_risk_score}% | {s.dest_city}" for s in at_risk_jit]
        answer = f"**{len(at_risk_jit)} JIT/JIS critical shipments at risk:**\n" + ("\n".join(lines) if lines else "No critical JIT/JIS shipments at risk.")
        return answer, sources

    if any(kw in q for kw in ("carrier", "transport", "dhl", "schenker", "maersk")):
        carriers = {}
        for s in shipments:
            c = s.carrier_name
            if c not in carriers:
                carriers[c] = {"total": 0, "at_risk": 0, "avg_risk": 0}
            carriers[c]["total"] += 1
            if s.delay_risk_score >= 40:
                carriers[c]["at_risk"] += 1
            carriers[c]["avg_risk"] += s.delay_risk_score
        lines = []
        for name, data in sorted(carriers.items(), key=lambda x: x[1]["at_risk"], reverse=True)[:6]:
            avg = round(data["avg_risk"] / max(1, data["total"]), 1)
            lines.append(f"• {name}: {data['total']} shipments, {data['at_risk']} at risk, avg risk {avg}%")
        answer = "**Carrier performance overview:**\n" + "\n".join(lines)
        return answer, sources

    # Default summary
    total = len(shipments)
    in_transit = sum(1 for s in shipments if s.status in ("IN_TRANSIT", "AT_RISK", "DELAYED"))
    summary = (
        f"**Network snapshot:** {total} shipments tracked, {in_transit} in transit, "
        f"{len(at_risk)} at risk, {exceptions} open exceptions.\n\n"
        "You can ask about:\n"
        "• At-risk shipments\n• Gothenburg/specific lane status\n• Open exceptions\n"
        "• JIT/JIS critical shipments\n• Carrier performance"
    )
    return summary, sources


async def answer_question(
    db: Session,
    question: str,
    api_key: str,
    session_id: str = "default",
) -> tuple[str, list[str]]:
    if not api_key:
        return _fallback_answer(db, question)

    try:
        import anthropic

        context = _build_shipment_context(db)

        # Maintain conversation history (last 6 turns)
        if session_id not in _conversation_history:
            _conversation_history[session_id] = []
        history = _conversation_history[session_id]

        # Build messages list for Claude
        messages = []
        for turn in history[-6:]:
            messages.append({"role": turn["role"], "content": turn["content"]})
        messages.append({"role": "user", "content": f"Current shipment data:\n{context}\n\nQuestion: {question}"})

        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=1024,
            system=(
                "You are an expert Volvo Supply Chain Operations copilot. "
                "Answer questions using ONLY the provided shipment data. "
                "Be concise, actionable, and use bullet points where helpful. "
                "Use **bold** for key numbers and shipment IDs. "
                "Prioritize JIT/JIS critical shipments in your analysis. "
                "If data is insufficient to answer, say so clearly."
            ),
            messages=messages,
        )
        answer = response.content[0].text

        # Update history
        _conversation_history[session_id].append({"role": "user", "content": question})
        _conversation_history[session_id].append({"role": "assistant", "content": answer})
        # Keep history bounded
        if len(_conversation_history[session_id]) > 12:
            _conversation_history[session_id] = _conversation_history[session_id][-12:]

        return answer, ["shipments_db", "exceptions_db", "claude-haiku"]
    except Exception as exc:
        # Log the error but fall back gracefully
        import logging
        logging.getLogger(__name__).warning("Copilot API error: %s", exc)
        return _fallback_answer(db, question)
