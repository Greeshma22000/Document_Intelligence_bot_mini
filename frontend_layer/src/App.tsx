import React, { useMemo, useState } from "react";
import "./App.css";
type Role = "user" | "assistant";
type ChatMessage = {
  role: Role;
  content: string;
};
const API_BASE_URL = import.meta.env.REACT_APP_API_BASE_URL || "http://localhost:3000";
function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! Ask me anything." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);
  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setError("");
    setLoading(true);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    try {
      const resp = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const raw = await resp.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { raw };
      }
      if (!resp.ok) {
        throw new Error(data?.error || data?.details || raw || "Request failed");
      }
      const reply =
        data.reply ||
        data.response ||
        data.answer ||
        data.message ||
        data.raw ||
        "(No reply)";
      setMessages((prev) => [...prev, { role: "assistant", content: String(reply) }]);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry — I hit an error. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") sendMessage();
  }
  function clearChat() {
    setError("");
    setInput("");
    setMessages([{ role: "assistant", content: "Hi! Ask me anything." }]);
  }
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">🤖</div>
          <div>
            <div className="title">ChatBot</div>
            <div className="subtitle">Cute, fast & helpful</div>
          </div>
        </div>
        <button className="ghostBtn" onClick={clearChat} disabled={loading} title="Clear chat">
          Clear
        </button>
      </header>
      <div className="shell">
        <main className="chatArea">
          {messages.map((m, idx) => (
            <div key={idx} className={`row ${m.role}`}>
              <div className="avatar">{m.role === "user" ? "👧" : "🤖"}</div>
              <div className={`bubble ${m.role}`}>
                <div className="bubbleText">{m.content}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="row assistant">
              <div className="avatar">🤖</div>
              <div className="bubble assistant">
                <div className="typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
        </main>
        <footer className="composer">
          {error && <div className="errorBanner">{error}</div>}
          <div className="composerRow">
            <input
              className="composerInput"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type your message…"
              disabled={loading}
            />
            <button className="sendBtn" onClick={sendMessage} disabled={!canSend}>
              Send ➤
            </button>
          </div>
          <div className="hint">
            Tip: Press <b>Enter</b> to send
          </div>
        </footer>
      </div>
    </div>
  );
}
export default App;