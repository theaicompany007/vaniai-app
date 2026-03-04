'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { AgentBadge } from './AgentBadge';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentChatPanelProps {
  agent: 'Vigil' | 'Vivek' | 'Varta' | 'Vidya' | 'Vaahan';
  endpoint: string;
  placeholder?: string;
  onClose: () => void;
  initialMessage?: string;
  extraPayload?: Record<string, unknown>;
}

export function AgentChatPanel({
  agent,
  endpoint,
  placeholder = 'Ask a question...',
  onClose,
  initialMessage,
  extraPayload = {},
}: AgentChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialMessage) {
      sendMessage(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, ...extraPayload }),
      });

      const data = await res.json();
      const reply = data.reply ?? data.analysis ?? data.result ?? JSON.stringify(data);

      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg)] border-l border-[var(--border)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2">
          <AgentBadge agent={agent} size="sm" />
          <span className="text-sm text-[var(--text-muted)]">AI Assistant</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--border)] text-[var(--text-muted)] transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-[var(--text-muted)] text-sm mt-8">
            <p className="text-2xl mb-2">
              {agent === 'Vigil' ? '🔭' : agent === 'Vivek' ? '🔬' : agent === 'Varta' ? '📝' : agent === 'Vidya' ? '🧠' : '🚀'}
            </p>
            <p className="font-medium text-[var(--text)]">{agent} is ready</p>
            <p className="mt-1">Ask me anything to get started.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[var(--accent)] text-black'
                  : 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs">{agent} is thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none rounded-lg bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="p-2 rounded-lg bg-[var(--accent)] text-black disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1.5">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
