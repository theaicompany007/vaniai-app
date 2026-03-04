'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Trash2,
  Copy,
  Check,
  ChevronRight,
  Home,
  Zap,
  Building2,
  Users,
  TrendingUp,
  MessageSquare,
  Mic,
  MicOff,
  ChevronDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSpeechInput } from '@/hooks/useSpeechInput';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ─── Markdown Renderer ───────────────────────────────────────────────────────
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  function parseLine(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let k = 0;
    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
      const codeMatch = remaining.match(/`(.+?)`/);
      const matches = [
        boldMatch   ? { idx: remaining.indexOf(boldMatch[0]),   match: boldMatch,   type: 'bold'   } : null,
        italicMatch ? { idx: remaining.indexOf(italicMatch[0]), match: italicMatch, type: 'italic' } : null,
        codeMatch   ? { idx: remaining.indexOf(codeMatch[0]),   match: codeMatch,   type: 'code'   } : null,
      ].filter(Boolean).sort((a, b) => a!.idx - b!.idx);
      if (matches.length === 0) { parts.push(remaining); break; }
      const first = matches[0]!;
      if (first.idx > 0) parts.push(remaining.slice(0, first.idx));
      if (first.type === 'bold')   parts.push(<strong key={k++} style={{ color: 'var(--wo-text)', fontWeight: 600 }}>{first.match[1]}</strong>);
      if (first.type === 'italic') parts.push(<em key={k++} style={{ fontStyle: 'italic' }}>{first.match[1]}</em>);
      if (first.type === 'code')   parts.push(<code key={k++} style={{ background: 'rgba(0,217,255,0.08)', color: 'var(--wo-primary)', padding: '1px 5px', borderRadius: 4, fontSize: '0.85em', fontFamily: 'monospace' }}>{first.match[1]}</code>);
      remaining = remaining.slice(first.idx + first.match[0].length);
    }
    return <>{parts}</>;
  }

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} className="text-lg font-bold mt-4 mb-2" style={{ color: 'var(--wo-text)' }}>{parseLine(line.slice(2))}</h1>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-base font-bold mt-3 mb-1.5" style={{ color: 'var(--wo-text)' }}>{parseLine(line.slice(3))}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} className="text-sm font-semibold mt-2 mb-1" style={{ color: 'var(--wo-primary)' }}>{parseLine(line.slice(4))}</h3>);
    } else if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={key++} className="rounded-lg p-3 my-2 overflow-x-auto text-xs"
          style={{ background: 'rgba(0,217,255,0.05)', border: '1px solid rgba(0,217,255,0.15)', color: '#e2e8f0', fontFamily: 'monospace' }}>
          {codeLines.join('\n')}
        </pre>
      );
    } else if (line.match(/^[-*] /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        items.push(<li key={i}>{parseLine(lines[i].slice(2))}</li>);
        i++;
      }
      elements.push(
        <ul key={key++} className="list-disc list-inside space-y-1 my-2 text-sm" style={{ color: 'var(--wo-text)', paddingLeft: '0.5rem' }}>
          {items}
        </ul>
      );
      continue;
    } else if (line.match(/^\d+\. /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(<li key={i}>{parseLine(lines[i].replace(/^\d+\. /, ''))}</li>);
        i++;
      }
      elements.push(
        <ol key={key++} className="list-decimal list-inside space-y-1 my-2 text-sm" style={{ color: 'var(--wo-text)', paddingLeft: '0.5rem' }}>
          {items}
        </ol>
      );
      continue;
    } else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={key++} className="my-2 pl-3 text-sm italic"
          style={{ borderLeft: '3px solid var(--wo-primary)', color: 'var(--wo-text-muted)' }}>
          {parseLine(line.slice(2))}
        </blockquote>
      );
    } else if (line.trim() === '' || line.trim() === '---') {
      elements.push(<div key={key++} className="my-1" />);
    } else {
      elements.push(
        <p key={key++} className="text-sm leading-relaxed my-0.5" style={{ color: 'var(--wo-text)' }}>
          {parseLine(line)}
        </p>
      );
    }
    i++;
  }
  return <div className="space-y-0.5">{elements}</div>;
}

// ─── Vidya Thinking Bubble ────────────────────────────────────────────────────
function VidyaThinking() {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="vani-avatar-bot flex-shrink-0 mt-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vani-logo.png" alt="Vani" className="h-full w-full object-contain" />
      </div>
      <div className="rounded-2xl rounded-tl-sm px-4 py-3"
        style={{ background: 'var(--wo-surface)', border: '1px solid var(--wo-border)' }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold" style={{ color: 'var(--wo-primary)' }}>Vidya</span>
          <span className="text-xs" style={{ color: 'var(--wo-text-muted)' }}>is thinking…</span>
        </div>
        <div className="vani-thinking-dots">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

// ─── Message Bubbles ──────────────────────────────────────────────────────────
function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-3 mb-4 flex-row-reverse">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold mt-0.5"
        style={{ background: 'linear-gradient(135deg, #00b8d9, #0099b8)' }}>
        You
      </div>
      <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed"
        style={{ background: 'linear-gradient(135deg, rgba(0,184,217,0.18), rgba(0,153,184,0.12))', border: '1px solid rgba(0,217,255,0.2)', color: 'var(--wo-text)' }}>
        {content}
      </div>
    </div>
  );
}

function VidyaBubble({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-start gap-3 mb-4 group">
      <div className="vani-avatar-bot flex-shrink-0 mt-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vani-logo.png" alt="Vani" className="h-full w-full object-contain" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold" style={{ color: 'var(--wo-primary)' }}>Vidya</span>
        </div>
        <div className="rounded-2xl rounded-tl-sm px-4 py-3"
          style={{ background: 'var(--wo-surface)', border: '1px solid var(--wo-border)' }}>
          <MarkdownRenderer content={content} />
        </div>
        <div className="flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md transition-colors"
            style={{ color: copied ? 'var(--wo-primary)' : 'var(--wo-text-muted)' }}
            title="Copy response">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Suggestion Chips ───────────────────────────────────────────────────
const QUICK_SUGGESTIONS = [
  { icon: Zap,        label: 'Latest signals',       prompt: 'What are the latest buying signals in my pipeline?' },
  { icon: Building2,  label: 'Top accounts',         prompt: 'Which accounts have the most potential right now?' },
  { icon: TrendingUp, label: 'Pipeline summary',     prompt: 'Give me a summary of my current opportunities pipeline.' },
  { icon: Users,      label: 'Key contacts',         prompt: 'Who are my key contacts across all accounts?' },
  { icon: MessageSquare, label: 'Draft outreach',    prompt: 'Help me draft an outreach email for my top prospect.' },
];

// ─── Main Chat Page ───────────────────────────────────────────────────────────
export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Track scroll position
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  const { listening: micListening, supported: micSupported, startListening, stopListening, error: micError } = useSpeechInput({
    onResult: (transcript) => setInput(prev => (prev.trim() ? prev.trimEnd() + ' ' : '') + transcript),
    onInterim: (transcript) => setInput(transcript),
  });

  const hasMessages = messages.length > 0;

  // Load persisted chat history on mount
  useEffect(() => {
    fetch('/api/chat?agent=Vidya&limit=60')
      .then(r => r.json())
      .then((data: Array<{ id: string; role: string; content: string }>) => {
        if (Array.isArray(data) && data.length > 0) {
          setMessages(data.map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content })));
        }
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [input]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/agents/vidya', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      const reply = data.reply ?? 'Sorry, I could not process that request.';
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  async function handleClearChat() {
    await fetch('/api/chat?agent=Vidya', { method: 'DELETE' });
    setMessages([]);
    setShowClearConfirm(false);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--wo-border)' }}>
        <div className="flex items-center gap-2 text-sm">
          <Home className="w-4 h-4" style={{ color: 'var(--wo-primary)' }} />
          <span className="cursor-pointer hover:underline" style={{ color: 'var(--wo-primary)' }}
            onClick={() => router.push('/home')}>Home</span>
          <ChevronRight className="w-3 h-3" style={{ color: 'var(--wo-text-muted)' }} />
          <span style={{ color: 'var(--wo-text)' }}>Chat with Vidya</span>
        </div>
        {hasMessages && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="wo-btn wo-btn-ghost text-xs gap-1 py-1"
            title="Clear conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear chat
          </button>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto relative" ref={scrollContainerRef}>
        <div className="max-w-3xl mx-auto py-6 px-6">

          {/* Empty / Welcome State */}
          {!hasMessages && historyLoaded && (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center overflow-hidden"
                style={{ background: 'var(--wo-surface)', border: '1px solid rgba(0,217,255,0.25)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/vani-logo.png" alt="Vani" className="w-10 h-10 object-contain" />
              </div>
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--wo-text)' }}>Hi, I&apos;m Vidya</h2>
              <p className="text-sm mb-8" style={{ color: 'var(--wo-text-muted)' }}>
                Your AI sales co-pilot — ask me about signals, accounts, contacts, pipeline strategy, or draft outreach.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_SUGGESTIONS.map(s => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.label}
                      onClick={() => sendMessage(s.prompt)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all"
                      style={{ background: 'var(--wo-surface)', border: '1px solid var(--wo-border)', color: 'var(--wo-text)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--wo-primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--wo-primary)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--wo-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--wo-text)'; }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg =>
            msg.role === 'user'
              ? <UserBubble key={msg.id} content={msg.content} />
              : <VidyaBubble key={msg.id} content={msg.content} />
          )}

          {loading && <VidyaThinking />}
          <div ref={bottomRef} />
        </div>

        {/* Scroll-to-bottom button */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all"
            style={{
              background: 'var(--wo-surface)',
              border: '1px solid rgba(0,217,255,0.25)',
              color: 'var(--wo-text-muted)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--wo-primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--wo-primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--wo-text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,217,255,0.25)'; }}
          >
            <ChevronDown className="w-3.5 h-3.5" />
            Scroll to bottom
          </button>
        )}
      </div>

      {/* ── Input Bar ── */}
      <div className="flex-shrink-0 px-6 pb-5 pt-0 relative">
        {/* Gradient fade — messages blend into the input */}
        <div className="absolute top-0 left-0 right-0 h-10 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, var(--wo-bg, #0f0f1a))' }} />
        <div className="max-w-3xl mx-auto relative">
          <div className="wo-card p-3" style={{
            border: '1px solid rgba(0,217,255,0.18)',
            borderRadius: '18px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,217,255,0.06), 0 2px 16px rgba(0,217,255,0.08)',
          }}>
            <textarea
              ref={textareaRef}
              placeholder="Ask Vidya about signals, accounts, pipeline, or draft an outreach…  (Enter to send)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="w-full resize-none border-none outline-none text-sm"
              style={{ background: 'transparent', color: 'var(--wo-text)', minHeight: '44px', maxHeight: '160px', overflowY: 'auto' }}
              rows={1}
            />
            <div className="flex items-center justify-between pt-2 mt-1"
              style={{ borderTop: '1px solid var(--wo-border)' }}>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SUGGESTIONS.map(s => {
                  const Icon = s.icon;
                  return (
                    <button key={s.label} onClick={() => sendMessage(s.prompt)} disabled={loading}
                      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-colors"
                      style={{ background: 'rgba(0,217,255,0.06)', color: 'var(--wo-text-muted)', border: '1px solid rgba(0,217,255,0.1)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--wo-primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,217,255,0.3)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--wo-text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,217,255,0.1)'; }}
                    >
                      <Icon className="w-3 h-3" />
                      {s.label}
                    </button>
                  );
                })}
              </div>
              {micSupported && (
                <div className="relative">
                  {micListening && <span className="vani-mic-ring" />}
                  <button
                    onClick={micListening ? stopListening : startListening}
                    disabled={loading}
                    className={`p-2 rounded-xl transition-all disabled:opacity-40 ${micListening ? 'vani-mic-recording' : ''}`}
                    style={micListening
                      ? { background: '#ef4444', color: '#fff' }
                      : { background: 'var(--wo-surface-2)', color: 'var(--wo-text-muted)' }}
                    title={micListening ? 'Stop recording' : 'Speak your message'}
                  >
                    {micListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>
              )}
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="wo-btn wo-btn-primary p-2 rounded-xl disabled:opacity-40"
                title="Send (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          {micError && (
            <p className="text-center text-xs mt-1" style={{ color: '#ef4444' }}>{micError}</p>
          )}
          {micListening && (
            <p className="text-center text-xs mt-1" style={{ color: '#ef4444' }}>
              Listening… speak now, then click the mic to stop
            </p>
          )}
          {!micListening && !micError && (
            <p className="text-center text-xs mt-2" style={{ color: 'var(--wo-text-muted)' }}>
              Vidya can make mistakes. Verify important information.
            </p>
          )}
        </div>
      </div>

      {/* ── Clear Chat Confirmation Modal ── */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="wo-card p-6 max-w-sm w-full mx-4 text-center" style={{ border: '1px solid var(--wo-border)' }}>
            <Trash2 className="w-8 h-8 mx-auto mb-3" style={{ color: '#ef4444' }} />
            <h3 className="font-semibold mb-1" style={{ color: 'var(--wo-text)' }}>Clear conversation?</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--wo-text-muted)' }}>
              This will permanently delete all messages with Vidya.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowClearConfirm(false)}
                className="flex-1 wo-btn wo-btn-ghost">Cancel</button>
              <button onClick={handleClearChat}
                className="flex-1 wo-btn text-white text-sm py-2 rounded-xl"
                style={{ background: '#ef4444' }}>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
