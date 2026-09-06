"""AI copilot chat endpoint."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas import CopilotRequest, CopilotResponse
from app.services.copilot import answer_question

router = APIRouter()


@router.post("/copilot/chat", response_model=CopilotResponse)
async def copilot_chat(payload: CopilotRequest, db: Session = Depends(get_db)):
    answer, sources = await answer_question(
        db, payload.question, settings.anthropic_api_key, payload.session_id
    )
    return CopilotResponse(answer=answer, sources_used=sources, session_id=payload.session_id or "default")
