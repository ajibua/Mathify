import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../api/client';
import MathRenderer from '../components/common/MathRenderer';

export function AITutorPage() {
  const { user, isAuthenticated } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const starterPrompts = [
    { title: "Quadratic Equations", prompt: "Explain how to solve ax² + bx + c = 0 using the quadratic formula with an easy step-by-step example." },
    { title: "Pythagorean Theorem", prompt: "Explain why a² + b² = c² works for right triangles with an intuitive explanation." },
    { title: "Adding Fractions", prompt: "Show me how to add 2/3 + 4/5 step-by-step with common denominators." },
    { title: "Intro to Derivatives", prompt: "Explain what a derivative is in simple terms and how to find the derivative of x²." },
    { title: "Why √2 is Irrational", prompt: "Can you explain the simple proof that the square root of 2 is irrational so anyone can understand it?" },
    { title: "Word Problems into Equations", prompt: "How do I turn an algebra word problem into an equation? Walk me through a clear example." },
  ];

  const quickSymbols = [
    { label: '∀', code: '\\forall ' },
    { label: '∃', code: '\\exists ' },
    { label: '∈', code: '\\in ' },
    { label: '∉', code: '\\notin ' },
    { label: '⟹', code: '\\implies ' },
    { label: '⟺', code: '\\iff ' },
    { label: '∑', code: '\\sum ' },
    { label: '∫', code: '\\int ' },
    { label: 'ℝ', code: '\\mathbb{R}' },
    { label: 'ℂ', code: '\\mathbb{C}' },
    { label: 'ℤ', code: '\\mathbb{Z}' },
    { label: 'ℕ', code: '\\mathbb{N}' },
    { label: 'π', code: '\\pi ' },
    { label: '∞', code: '\\infty ' },
    { label: '√', code: '\\sqrt{} ' },
  ];

  const fetchSessions = async () => {
    try {
      const res = await API.get('/api/ai-tutor/sessions/');
      if (res.ok) {
        const data = await res.json();
        const list = data.results || data;
        setSessions(Array.isArray(list) ? list : []);
        if (list.length > 0 && !activeSessionId) {
          selectSession(list[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const selectSession = async (sessionId) => {
    setActiveSessionId(sessionId);
    setSidebarOpen(false);
    try {
      const res = await API.get(`/api/ai-tutor/sessions/${sessionId}/`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to fetch session messages:', err);
    }
  };

  const createNewSession = async () => {
    try {
      const res = await API.post('/api/ai-tutor/sessions/', {
        title: `Research Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      });
      if (res.ok) {
        const newSession = await res.json();
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setMessages([]);
        setSidebarOpen(false);
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchSessions();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    // Supported Gemini inlineData types
    const validBinaryTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'
    ];
    const isTextFile = /\.(txt|csv|py|tex|json|md)$/i.test(file.name) || file.type.startsWith('text/');

    // For plain text / code files, read directly as text and append to composer
    if (isTextFile) {
      if (file.size > 1024 * 1024) {
        window.alert('Please choose a text document smaller than 1 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const fileContent = String(reader.result || '');
        setInputMessage((prev) =>
          prev
            ? `${prev}\n\n[File: ${file.name}]\n\`\`\`\n${fileContent}\n\`\`\``
            : `[File: ${file.name}]\n\`\`\`\n${fileContent}\n\`\`\`\n`
        );
      };
      reader.readAsText(file);
      return;
    }

    // Binary file: image or PDF
    const mime = file.type || '';
    const isPdf = /\.pdf$/i.test(file.name);
    const resolvedMime = isPdf ? 'application/pdf' : mime;

    if (!validBinaryTypes.includes(resolvedMime)) {
      window.alert('Supported file formats for mathematical AI analysis are PNG, JPEG, WEBP, PDF, and code/text files (.txt, .tex, .py, .csv).');
      return;
    }

    // Strictly limit binary files to 3.5 MB so Base64 payloads remain within Vercel's 4.5 MB ceiling
    if (file.size > 3.5 * 1024 * 1024) {
      window.alert('Please choose a file smaller than 3.5 MB for the AI reasoning engine.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedAttachment({
        name: file.name,
        mime: resolvedMime,
        data: String(reader.result).split(',')[1] || '',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (msgText = inputMessage) => {
    const text = typeof msgText === 'string' ? msgText.trim() : inputMessage.trim();
    if ((!text && !selectedAttachment) || sending) return;

    const attachment = selectedAttachment;
    const messageText = text || `Please analyze the attached file: ${attachment.name}`;

    setInputMessage('');
    setSelectedAttachment(null);
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: messageText,
      file_name: attachment?.name,
      file_mime: attachment?.mime,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    const assistantMsgId = Date.now() + 1;
    // Append placeholder for streaming assistant reply
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const payload = {
        content: displayText,
        ...(file ? {
          file_data: await fileToBase64(file),
          file_name: file.name,
          file_mime: file.type,
        } : {}),
      };
      const res = await API.req(`/api/ai-tutor/sessions/${sessionId}/send-stream/`, {
        method: 'POST',
        body: JSON.stringify({
          message: messageText,
          session_id: activeSessionId,
          stream: true,
          file_data: attachment?.data || '',
          file_name: attachment?.name || '',
          file_mime: attachment?.mime || '',
        }),
        headers: {
          'Accept': 'text/event-stream',
        },
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Retain unfinished chunk

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              try {
                const payload = JSON.parse(trimmed.slice(6));
                if (payload.text) {
                  accumulatedText += payload.text;
                  const currentText = accumulatedText;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, content: currentText, isStreaming: true }
                        : m
                    )
                  );
                }
              } catch {
                // Ignore parse errors on partial frames
              }
            }
          }
        }

        // Finalize streaming state
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: accumulatedText || 'Mathematical derivation completed.', isStreaming: false }
              : m
          )
        );
      } else {
        const errorData = await res.json().catch(() => ({}));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                ...m,
                content: `⚠️ Error: ${errorData.error || errorData.detail || 'Could not reach AI Tutor. Please try again.'}`,
                isStreaming: false,
              }
              : m
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
              ...m,
              content: '⚠️ Network connection failed. Please verify your connection.',
              isStreaming: false,
            }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ai-tutor-shell" style={{ width: '100%', height: 'calc(100vh - var(--nav-height) - 76px)', minHeight: '560px' }}>
      <div
        className="ai-tutor-layout card"
        style={{
          display: 'flex',
          height: '100%',
          position: 'relative',
          borderRadius: '14px',
          overflow: 'hidden',
          backgroundColor: '#16161B',
        }}
      >
        {/* Backdrop for mobile drawer */}
        {sidebarOpen && (
          <div
            className="ai-tutor-sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sessions Sidebar */}
        <aside
          className={`ai-tutor-sidebar ${sidebarOpen ? 'open' : ''}`}
          style={{
            width: '280px',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 50,
            backgroundColor: '#141418',
            transition: 'transform 0.25s ease',
            flexShrink: 0,
          }}
        >
          {/* Sidebar Top Header */}
          <div
            style={{
              padding: '16px 18px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                Research Sessions
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                {sessions.length} recorded
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={createNewSession}
                className="btn-primary"
                style={{ padding: '5px 11px', fontSize: '12px', borderRadius: '6px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                New
              </button>
              <button
                type="button"
                className="ai-tutor-sidebar-close"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close sessions"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-subtle)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'none',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>
          </div>

          {/* Sessions List or Sample Discussions */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {sessions.length === 0 ? (
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '12px', paddingLeft: '4px' }}>
                  Recommended Topics:
                </p>
                {starterPrompts.slice(0, 4).map((p) => (
                  <button
                    key={p.title}
                    onClick={() => handleSendMessage(p.prompt)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--primary)' }}>
                      school
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectSession(s.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: activeSessionId === s.id ? '1px solid var(--primary-border)' : '1px solid transparent',
                    backgroundColor: activeSessionId === s.id ? 'var(--primary-subtle)' : 'transparent',
                    color: activeSessionId === s.id ? 'var(--primary)' : 'var(--text)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: activeSessionId === s.id ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chat_bubble</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title || `Session #${s.id}`}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <section className="ai-tutor-chat" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#18181D' }}>
          {/* Chat Header */}
          <header
            className="ai-tutor-chat-header"
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#16161B',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <button
                type="button"
                className="ai-tutor-sidebar-toggle"
                onClick={() => setSidebarOpen((prev) => !prev)}
                title="Past chats"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>history</span>
                <span className="desktop-only-text">Sessions</span>
                {sessions.length > 0 && (
                  <span className="ai-tutor-session-pill">
                    {sessions.length}
                  </span>
                )}
              </button>
              <div
                className="ai-tutor-header-icon"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--primary-subtle)',
                  border: '1px solid var(--primary-border)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>smart_toy</span>
              </div>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <h2 style={{ fontSize: '14.5px', margin: 0, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  AI Math Tutor
                </h2>
                <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981', flexShrink: 0 }} />
                  <span>Ready to help</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={createNewSession}
                className="btn-secondary"
                style={{ padding: '5px 10px', fontSize: '11.5px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="New Chat Session"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>add</span>
                <span className="desktop-only-text">New</span>
              </button>
              <span className="badge-academic ai-tutor-latex-badge" style={{ fontSize: '11px', padding: '2px 8px' }}>
                LaTeX
              </span>
            </div>
          </header>

          {/* Messages Stream */}
          <div className="ai-tutor-messages" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {messages.length === 0 ? (
              <div className="ai-tutor-empty-state" style={{ margin: 'auto', maxWidth: '640px', textAlign: 'center', width: '100%', padding: '16px 8px' }}>
                <div
                  className="ai-tutor-empty-icon"
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--primary-subtle)',
                    border: '1px solid var(--primary-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    color: 'var(--primary)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>history_edu</span>
                </div>
                <h3 className="ai-tutor-empty-title" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>
                  What math problem can I help you with today?
                </h3>
                <p className="ai-tutor-empty-desc" style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
                  Ask any math question! You can paste homework problems, ask for step-by-step explanations, or pick a topic below.
                </p>

                {/* Responsive Starter Grid */}
                <div className="ai-tutor-prompts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', textAlign: 'left' }}>
                  {starterPrompts.map((p) => (
                    <button
                      key={p.title}
                      onClick={() => handleSendMessage(p.prompt)}
                      className="card ai-tutor-prompt-card"
                      style={{
                        padding: '12px 14px',
                        backgroundColor: '#141418',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '4px',
                        transition: 'border-color 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--primary)' }}>
                          {p.title}
                        </span>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-subtle)' }}>
                          arrow_forward
                        </span>
                      </div>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                        {p.prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                      width: '100%',
                    }}
                  >
                    <div
                      className="ai-tutor-message-bubble"
                      style={{
                        maxWidth: '82%',
                        padding: '14px 18px',
                        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        backgroundColor: isUser ? '#22222A' : '#141418',
                        border: isUser ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                        color: 'var(--text)',
                        lineHeight: 1.55,
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 600, color: isUser ? 'var(--primary)' : 'var(--text-subtle)', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{isUser ? (user?.username || 'You') : 'Mathify AI Tutor'}</span>
                        {m.isStreaming && (
                          <span style={{ fontSize: '10.5px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                            Thinking & solving...
                          </span>
                        )}
                      </div>
                      {m.file_name && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.06)', border: '1px solid var(--border)', marginBottom: '8px', color: 'var(--text-muted)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--primary)' }}>attach_file</span>
                          <span style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.file_name}</span>
                        </div>
                      )}
                      {m.content ? (
                        <div style={{ position: 'relative' }}>
                                  {m.file_name && (
                                    <div className="ai-tutor-file-badge">
                                      <span className="material-symbols-outlined">attach_file</span>
                                      {m.file_name}
                                    </div>
                                  )}
                          <MathRenderer content={m.content} />
                          {m.isStreaming && (
                            <span
                              style={{
                                display: 'inline-block',
                                width: '7px',
                                height: '14px',
                                backgroundColor: 'var(--primary)',
                                marginLeft: '4px',
                                verticalAlign: 'middle',
                              }}
                            />
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontSize: '13px', padding: '4px 0' }}>
                          <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite', fontSize: '16px' }}>
                            progress_activity
                          </span>
                          <span>Formulating mathematical proof...</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input & Toolbar */}
          <div className="ai-tutor-composer" style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', backgroundColor: '#16161B' }}>
            {/* Quick Math Symbols */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-subtle)', alignSelf: 'center', marginRight: '4px', whiteSpace: 'nowrap' }}>
                Insert Symbol:
              </span>
              {quickSymbols.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setInputMessage((prev) => prev ? `${prev} $${s.code}$ ` : `$${s.code}$ `)}
                  className="symbol-chip"
                  title={`Insert LaTeX: ${s.code}`}
                  style={{ fontSize: '12.5px', padding: '3px 8px', fontWeight: 600, flexShrink: 0 }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {selectedAttachment && (
              <div className="ai-tutor-attachment" role="status">
                <span className="material-symbols-outlined">attach_file</span>
                <span>{selectedAttachment.name}</span>
                <button type="button" onClick={() => setSelectedAttachment(null)} aria-label="Remove attachment">close</button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="ai-tutor-input-row"
              style={{ display: 'flex', gap: '10px' }}
            >
              <label className="ai-tutor-attach-button" title="Attach a diagram, PDF, or code">
                <span className="material-symbols-outlined">add</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf,.txt,.csv,.py,.tex"
                  onChange={handleAttachmentChange}
                  hidden
                />
              </label>
              <input
                type="text"
                className="glass-input"
                placeholder="Ask a mathematical question or enter a LaTeX equation (e.g. $e^{i\pi} + 1 = 0$)..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={sending}
                style={{ fontSize: '14px', flex: 1, padding: '10px 14px' }}
              />
              <button
                type="submit"
                disabled={sending || (!inputMessage.trim() && !selectedAttachment)}
                className="btn-primary ai-tutor-send-button"
                aria-label="Send message"
                title="Send message"
              >
                <span className="material-symbols-outlined">arrow_upward</span>
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AITutorPage;
