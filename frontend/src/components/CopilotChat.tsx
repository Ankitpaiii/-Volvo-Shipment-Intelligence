import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  timestamp: Date;
}

const SUGGESTED_QUERIES = [
  "Which shipments to Gothenburg are at risk this week?",
  "Which shipments are at risk today?",
  "Show me open exceptions ranked by impact",
  "Which JIT/JIS critical shipments need attention?",
  "How is DHL Freight performing?",
  "What are the top risk factors right now?",
];

function MarkdownText({ text }: { text: string }) {
  // Simple markdown: **bold**, bullet lists
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("• ") || line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-sky-400 shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: line.replace(/^[•\-] /, "").replace(/\*\*(.*?)\*\*/g, "<strong class='text-white'>$1</strong>") }} />
            </div>
          );
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-bold text-white" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, "$1") }} />;
        }
        return (
          <p key={i} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, "<strong class='text-white'>$1</strong>") }} />
        );
      })}
    </div>
  );
}

export function CopilotChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const ask = async (question: string) => {
    if (!question.trim() || loading) return;
    setInput("");

    const userMsg: Message = {
      id: `u${Date.now()}`,
      role: "user",
      content: question.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await api.copilotChat(question.trim(), sessionId);
      const assistantMsg: Message = {
        id: `a${Date.now()}`,
        role: "assistant",
        content: res.answer,
        sources: res.sources,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const errorMsg: Message = {
        id: `e${Date.now()}`,
        role: "assistant",
        content: e instanceof Error ? e.message : "Failed to get response. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const clearHistory = () => setMessages([]);

  return (
    <div className="glass rounded-xl border border-slate-700/60 flex flex-col" style={{ height: 520 }}>
      {/* Header */}
      <div className="border-b border-slate-700/60 px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">🤖</span>
            <h2 className="font-semibold text-slate-100">AI Copilot</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 font-medium">
              Claude
            </span>
          </div>
          <p className="text-xs text-slate-500">Natural-language shipment intelligence</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-xs text-slate-600 hover:text-slate-400 transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* Suggested queries (only when no messages) */}
      {messages.length === 0 && (
        <div className="px-4 py-3 shrink-0">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Try asking</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUERIES.slice(0, 4).map((q) => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400 hover:border-sky-500/60 hover:text-sky-300 transition"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 animate-fade-slide ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
              msg.role === "user" ? "bg-sky-600/30 text-sky-300" : "bg-slate-700 text-slate-300"
            }`}>
              {msg.role === "user" ? "U" : "🤖"}
            </div>
            <div className={`max-w-[85%] space-y-1 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
              <div
                className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-sky-600/25 border border-sky-500/30 text-sky-100"
                    : "glass border border-slate-700/60 text-slate-300"
                }`}
              >
                {msg.role === "assistant" ? (
                  <MarkdownText text={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-700">
                  {msg.timestamp.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
                {msg.sources && msg.sources.length > 0 && (
                  <span className="text-[9px] text-slate-700">· {msg.sources.join(", ")}</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-2.5 animate-fade-slide">
            <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center text-xs shrink-0">🤖</div>
            <div className="glass border border-slate-700/60 rounded-xl px-4 py-3 flex items-center gap-1">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
      </div>

      {/* Rotating suggestions when in chat */}
      {messages.length > 0 && !loading && (
        <div className="px-4 pb-2 shrink-0">
          <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
            {SUGGESTED_QUERIES.slice(0, 3).map((q) => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="shrink-0 rounded-full border border-slate-700 px-2.5 py-1 text-[10px] text-slate-500 hover:border-sky-500/60 hover:text-sky-400 transition whitespace-nowrap"
              >
                {q.length > 40 ? q.slice(0, 38) + "…" : q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-slate-700/60 px-4 py-3 shrink-0">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Ask about shipments, lanes, exceptions…"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-sky-500/60 transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-sky-600/80 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500/80 disabled:opacity-40 transition min-w-[52px]"
          >
            {loading ? (
              <span className="flex gap-0.5 items-center justify-center">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
            ) : "Ask"}
          </button>
        </form>
      </div>
    </div>
  );
}
