import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What shipments are at risk today?",
  "Which carrier has the worst OTIF?",
  "Show JIT parts delayed over 2 hours",
  "What is the average dwell time this week?",
];

export function CopilotChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const query = (text ?? input).trim();
    if (!query || loading) return;
    const userMsg: Message = { role: "user", content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.copilotChat(query);
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Unable to connect to the Bandhu AI engine. Please verify the backend is running.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="v-card" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Chat window */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {isEmpty ? (
          <>
            <div className="v-empty-state" style={{ paddingTop: 60 }}>
              <svg className="v-empty-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <p className="v-empty-title">Ask Bandhu AI</p>
              <p className="v-empty-sub">Ask anything about your supply chain — shipments, exceptions, carriers.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--graphite-line)",
                    backgroundColor: "var(--bg-panel)",
                    cursor: "pointer",
                    transition: "border-color 0.15s ease, background-color 0.15s ease",
                    color: "var(--silver-700)",
                    fontSize: "0.75rem",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--silver-500)";
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-panel-raised)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--graphite-line)";
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-panel)";
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        ) : messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", gap: 8 }} className="v-animate">
              {!isUser && (
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(145deg, #4A4C52, #0F1012)",
                  border: "1px solid var(--graphite-line)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--silver-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
              )}
              <div style={{
                maxWidth: "78%",
                padding: "10px 14px",
                borderRadius: isUser ? "12px 12px 2px 12px" : "2px 12px 12px 12px",
                fontSize: "0.78rem",
                lineHeight: 1.55,
                backgroundColor: isUser ? "var(--chrome-highlight)" : "var(--bg-panel)",
                color: isUser ? "var(--bg-void)" : "var(--platinum-100)",
                border: isUser ? "none" : "1px solid var(--graphite-line)",
                fontWeight: isUser ? 600 : 400,
              }}>
                {m.content}
              </div>
              {isUser && (
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  backgroundColor: "var(--bg-panel-raised)",
                  border: "1px solid var(--graphite-line)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--silver-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div style={{ display: "flex", gap: 8 }} className="v-animate">
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "linear-gradient(145deg, #4A4C52, #0F1012)",
              border: "1px solid var(--graphite-line)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--silver-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div style={{
              padding: "12px 16px",
              borderRadius: "2px 12px 12px 12px",
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--graphite-line)",
              display: "flex", gap: 5, alignItems: "center",
            }}>
              <span className="v-dot" /><span className="v-dot" /><span className="v-dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{
        padding: "12px 16px",
        borderTop: "1px solid var(--graphite-line)",
        display: "flex",
        gap: 8,
        backgroundColor: "var(--bg-panel-raised)",
        flexShrink: 0,
      }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            className="v-input"
            style={{ paddingLeft: 14, paddingRight: 14 }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }}}
            placeholder="Ask about shipments, exceptions, carriers…"
            disabled={loading}
          />
        </div>
        <button
          className="v-btn-primary"
          onClick={() => send()}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
