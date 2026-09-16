import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../api/client';
import MathRenderer from '../components/common/MathRenderer';
import ConfirmModal from '../components/common/ConfirmModal';

export function CompetitionsPage() {
  const { user, isAuthenticated, fetchProfile } = useAuth();
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCompetition, setActiveCompetition] = useState(null);

  const isHost = user?.role === 'host' || user?.profile?.role === 'host' || user?.is_staff || user?.is_superuser;

  // Answering state: { [questionId]: { answerText: '', submitting: false, feedback: null } }
  const [answersState, setAnswersState] = useState({});
  const [registering, setRegistering] = useState(false);
  const [registerModal, setRegisterModal] = useState(null);

  // Host Competition Modal State
  const [showHostModal, setShowHostModal] = useState(false);
  const [compName, setCompName] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [compEndDate, setCompEndDate] = useState('');
  const [questionsList, setQuestionsList] = useState([
    { prompt: '', answer: '', points: 10 },
  ]);
  const [hosting, setHosting] = useState(false);

  // Add Question Modal State (for organizers)
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [newPrompt, setNewPrompt] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newPoints, setNewPoints] = useState(10);
  const [addingQuestion, setAddingQuestion] = useState(false);

  const fetchCompetitions = async () => {
    try {
      setLoading(true);
      const res = await API.get('/api/rankings/competitions/');
      if (res.ok) {
        const data = await res.json();
        const list = data.results || data;
        const validList = Array.isArray(list) ? list : [];
        setCompetitions(validList);
        if (validList.length > 0) {
          setActiveCompetition((prev) => {
            if (prev && validList.some((c) => c.id === prev.id)) {
              return validList.find((c) => c.id === prev.id);
            }
            return validList[0];
          });
        } else {
          setActiveCompetition(null);
        }
      } else {
        setCompetitions([]);
      }
    } catch (err) {
      console.error('Failed to load competitions:', err);
      setCompetitions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const handleRegisterCompetition = async (compId) => {
    if (!isAuthenticated) {
      alert('Please sign in to register for this competition.');
      return;
    }
    try {
      setRegistering(true);
      const res = await API.post(`/api/rankings/competitions/${compId}/register/`, {});
      if (res.ok) {
        setActiveCompetition((prev) => (prev && prev.id === compId ? {
          ...prev,
          is_registered: true,
          participants_count: (prev.participants_count || 0) + 1,
        } : prev));
        setCompetitions((prev) => prev.map((c) => (c.id === compId ? {
          ...c,
          is_registered: true,
          participants_count: (c.participants_count || 0) + 1,
        } : c)));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Could not register for this competition.');
      }
    } catch {
      alert('Network error registering for competition.');
    } finally {
      setRegistering(false);
    }
  };

  const handleAnswerChange = (qId, val) => {
    setAnswersState((prev) => ({
      ...prev,
      [qId]: { ...(prev[qId] || {}), answerText: val, feedback: null },
    }));
  };

  const executeSubmitAnswer = async (compId, qId) => {
    const state = answersState[qId] || {};
    const text = (state.answerText || '').trim();
    if (!text) return;

    setAnswersState((prev) => ({
      ...prev,
      [qId]: { ...prev[qId], submitting: true, feedback: null },
    }));

    try {
      const res = await API.post(`/api/rankings/competitions/${compId}/answer/`, {
        question_id: qId,
        answer: text,
      });

      const data = await res.json();
      if (res.ok) {
        setAnswersState((prev) => ({
          ...prev,
          [qId]: {
            ...prev[qId],
            submitting: false,
            feedback: {
              correct: data.correct,
              message: data.detail || (data.correct ? `Correct! +${data.points_awarded} pts` : 'Incorrect answer.'),
            },
          },
        }));

        if (data.correct) {
          // Refresh user profile so axiom_points update in UI immediately
          fetchProfile?.();
          // Update local question state
          setCompetitions((prev) =>
            prev.map((c) => {
              if (c.id === compId && c.questions) {
                return {
                  ...c,
                  questions: c.questions.map((q) =>
                    q.id === qId ? { ...q, is_answered: true, is_correct: true } : q
                  ),
                };
              }
              return c;
            })
          );
          setActiveCompetition((prev) => {
            if (prev && prev.id === compId && prev.questions) {
              return {
                ...prev,
                questions: prev.questions.map((q) =>
                  q.id === qId ? { ...q, is_answered: true, is_correct: true } : q
                ),
              };
            }
            return prev;
          });
        }
      } else {
        setAnswersState((prev) => ({
          ...prev,
          [qId]: {
            ...prev[qId],
            submitting: false,
            feedback: {
              correct: false,
              message: data.detail || 'Error submitting answer.',
            },
          },
        }));
      }
    } catch {
      setAnswersState((prev) => ({
        ...prev,
        [qId]: {
          ...prev[qId],
          submitting: false,
          feedback: {
            correct: false,
            message: 'Network error submitting solution.',
          },
        },
      }));
    }
  };

  const handleSubmitAnswer = async (e, compId, qId) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Please sign in to submit competition solutions and earn Axiom Points.');
      return;
    }

    if (!isHost && activeCompetition && !activeCompetition.is_registered) {
      setRegisterModal({ compId, qId });
      return;
    }

    executeSubmitAnswer(compId, qId);
  };

  const handleConfirmRegisterModal = async () => {
    if (!registerModal) return;
    const { compId, qId } = registerModal;
    await handleRegisterCompetition(compId);
    setRegisterModal(null);
    if (qId) {
      executeSubmitAnswer(compId, qId);
    }
  };

  // Host modal questions helper
  const handleAddQuestionField = () => {
    setQuestionsList((prev) => [...prev, { prompt: '', answer: '', points: 10 }]);
  };

  const handleRemoveQuestionField = (idx) => {
    if (questionsList.length <= 1) return;
    setQuestionsList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleQuestionFieldChange = (idx, field, val) => {
    setQuestionsList((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, [field]: val } : q))
    );
  };

  const handleCreateCompetition = async (e) => {
    e.preventDefault();
    if (!compName.trim()) return;

    const validQuestions = questionsList.filter(
      (q) => q.prompt.trim() && q.answer.trim()
    );

    try {
      setHosting(true);
      const res = await API.post('/api/rankings/competitions/', {
        name: compName.trim(),
        description: compDesc.trim(),
        end_date: compEndDate || null,
        questions: validQuestions,
      });

      if (res.ok) {
        const newComp = await res.json();
        setCompetitions((prev) => [newComp, ...prev]);
        setActiveCompetition(newComp);
        setShowHostModal(false);
        setCompName('');
        setCompDesc('');
        setCompEndDate('');
        setQuestionsList([{ prompt: '', answer: '', points: 10 }]);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Could not host competition. Verify you have Host permissions.');
      }
    } catch {
      alert('Network error hosting competition.');
    } finally {
      setHosting(false);
    }
  };

  const handleAddQuestionToCompetition = async (e) => {
    e.preventDefault();
    if (!newPrompt.trim() || !newAnswer.trim()) return;

    try {
      setAddingQuestion(true);
      const res = await API.post(`/api/rankings/competitions/${activeCompetition.id}/add_question/`, {
        prompt: newPrompt.trim(),
        answer: newAnswer.trim(),
        points: parseInt(newPoints, 10) || 10,
      });

      if (res.ok) {
        const addedQ = await res.json();
        setActiveCompetition((prev) => ({
          ...prev,
          questions: [...(prev.questions || []), addedQ],
          questions_count: (prev.questions_count || 0) + 1,
        }));
        setCompetitions((prev) =>
          prev.map((c) =>
            c.id === activeCompetition.id
              ? {
                ...c,
                questions: [...(c.questions || []), addedQ],
                questions_count: (c.questions_count || 0) + 1,
              }
              : c
          )
        );
        setShowAddQuestionModal(false);
        setNewPrompt('');
        setNewAnswer('');
        setNewPoints(10);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Failed to add question to competition.');
      }
    } catch {
      alert('Network error adding challenge question.');
    } finally {
      setAddingQuestion(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Header Banner */}
      <div
        className="card"
        style={{
          padding: '28px 32px',
          marginBottom: '24px',
          backgroundColor: '#16161B',
        }}
      >
        <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="badge-academic" style={{ marginBottom: '10px' }}>
              Academic Mathematical Sprints
            </div>
            <h1 style={{ fontSize: '26px', margin: '0 0 8px', fontWeight: 700 }}>
              Live Mathematical Competitions
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14.5px', maxWidth: '640px', margin: 0, lineHeight: 1.55 }}>
              Solve rigorous problems in algebra, analysis, number theory, and geometry. Points are awarded exclusively for answering competition questions correctly.
            </p>
          </div>

          <div className="mobile-stack" style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            {isHost ? (
              <button
                id="host-competition-btn"
                onClick={() => setShowHostModal(true)}
                className="btn-primary"
                style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                Host Competition
              </button>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  color: '#60A5FA',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>school</span>
                Participant Mode
              </div>
            )}
            <div style={{ width: '1px', height: '32px', backgroundColor: 'var(--border)' }} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary)' }}>
                {competitions.length}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Active Sprints</div>
            </div>
          </div>
        </div>
      </div>

      {/* Rules Notice */}
      <div
        className="card"
        style={{
          padding: '14px 20px',
          marginBottom: '24px',
          backgroundColor: 'rgba(229, 169, 60, 0.06)',
          border: '1px solid var(--primary-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '22px', flexShrink: 0 }}>
          verified
        </span>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
          <strong style={{ color: 'var(--primary)' }}>Axiom Point Protocol: </strong>
          Points are awarded exclusively for solving and answering competition questions correctly (+10 pts per question). No points are awarded for any other action across the platform.
        </div>
      </div>

      {/* Main Dual-Column Arena Layout */}
      <div className="groups-layout">
        {/* Left Column: Active Competitions Directory */}
        <div
          className="card"
          style={{
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: '#18181D',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Active Sprints</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>{competitions.length} events</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loading ? (
              <div style={{ padding: '36px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined spin" style={{ fontSize: '28px', color: 'var(--primary)', marginBottom: '8px' }}>
                  progress_activity
                </span>
                <p style={{ fontSize: '13px' }}>Loading competitions...</p>
              </div>
            ) : competitions.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--primary)', opacity: 0.8, marginBottom: '10px' }}>
                  emoji_events
                </span>
                <h3 style={{ fontSize: '15px', color: 'var(--text)', margin: '0 0 6px', fontWeight: 600 }}>
                  No active competitions
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                  {isHost
                    ? 'Host the first mathematical competition sprint with problem challenges.'
                    : 'No competitions are active right now. Please check back soon!'}
                </p>
                {isHost && (
                  <button
                    onClick={() => setShowHostModal(true)}
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: '12.5px', width: '100%' }}
                  >
                    Host First Competition
                  </button>
                )}
              </div>
            ) : (
              competitions.map((c) => {
                const isSelected = activeCompetition?.id === c.id;
                const qCount = c.questions_count ?? c.questions?.length ?? 0;
                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveCompetition(c)}
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      border: isSelected ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                      backgroundColor: isSelected ? 'var(--primary-subtle)' : '#141418',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: isSelected ? 'var(--primary)' : 'var(--text)', lineHeight: 1.3 }}>
                        {c.name}
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(229, 169, 60, 0.12)',
                          border: '1px solid var(--primary-border)',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          flexShrink: 0,
                          marginLeft: '6px',
                        }}
                      >
                        ACTIVE
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.35 }}>
                      {c.description || 'Formal mathematical sprint.'}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: 'var(--text-subtle)' }}>
                      <span>Host: {(c.created_by || 'Organizer').split('@')[0]}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontWeight: 600 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>quiz</span>
                        {qCount} question{qCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Problem Set & Live Solver Arena */}
        <div
          className="card"
          style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            backgroundColor: '#18181D',
          }}
        >
          {activeCompetition ? (
            <>
              {/* Competition Header */}
              <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                        {activeCompetition.name}
                      </h2>
                      {activeCompetition.is_registered && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(34, 197, 94, 0.15)',
                            color: '#22C55E',
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                          Registered Participant
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>
                      {activeCompetition.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>Host / Organizer</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)' }}>
                        {activeCompetition.created_by || 'Scholar'}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--primary)', marginTop: '2px' }}>
                        {activeCompetition.participants_count || 0} registered
                      </div>
                    </div>

                    {/* Role-conditional actions in active competition */}
                    {!isHost && isAuthenticated && !activeCompetition.is_registered && (
                      <button
                        onClick={() => handleRegisterCompetition(activeCompetition.id)}
                        disabled={registering}
                        className="btn-primary"
                        style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>app_registration</span>
                        {registering ? 'Registering...' : 'Register for Sprint'}
                      </button>
                    )}

                    {isHost && (activeCompetition.created_by === user?.username || user?.is_staff) && (
                      <button
                        onClick={() => setShowAddQuestionModal(true)}
                        className="btn-secondary"
                        style={{ padding: '8px 14px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>add</span>
                        Add Problem
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Questions Stream */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {(!activeCompetition.questions || activeCompetition.questions.length === 0) ? (
                  <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--primary)', opacity: 0.8, marginBottom: '8px' }}>
                      pending
                    </span>
                    <h3 style={{ fontSize: '15px', color: 'var(--text)', margin: '0 0 6px' }}>
                      No problems uploaded yet
                    </h3>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-subtle)' }}>
                      The organizer has not uploaded challenge questions for this competition sprint.
                    </p>
                  </div>
                ) : (
                  activeCompetition.questions.map((q, idx) => {
                    const qState = answersState[q.id] || {};
                    const isSolved = q.is_correct || (qState.feedback && qState.feedback.correct);

                    return (
                      <div
                        key={q.id}
                        className="card"
                        style={{
                          padding: '18px 20px',
                          backgroundColor: '#141418',
                          border: isSolved ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid var(--border)',
                          borderRadius: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-muted)' }}>
                            Problem #{idx + 1}
                          </span>
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 700,
                              color: isSolved ? '#22C55E' : 'var(--primary)',
                              backgroundColor: isSolved ? 'rgba(34, 197, 94, 0.12)' : 'var(--primary-subtle)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: isSolved ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--primary-border)',
                            }}
                          >
                            {isSolved ? '✓ SOLVED (+10 pts)' : `+${q.points || 10} Math Points`}
                          </span>
                        </div>

                        {/* Problem Statement with LaTeX */}
                        <div style={{ fontSize: '14.5px', color: 'var(--text)', lineHeight: 1.6, marginBottom: '16px' }}>
                          <MathRenderer content={q.prompt} displayMode={true} />
                        </div>

                        {/* Answer Submission Form */}
                        {isSolved ? (
                          <div style={{ padding: '10px 14px', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="material-symbols-outlined" style={{ color: '#22C55E', fontSize: '18px' }}>
                              check_circle
                            </span>
                            <span style={{ fontSize: '13px', color: '#22C55E', fontWeight: 600 }}>
                              Solved correctly! Points have been added to your profile.
                            </span>
                          </div>
                        ) : (
                          <form onSubmit={(e) => handleSubmitAnswer(e, activeCompetition.id, q.id)}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <input
                                type="text"
                                className="glass-input"
                                placeholder="Enter your exact solution (e.g. 12, pi/4, 0)..."
                                value={qState.answerText || ''}
                                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                style={{ flex: 1, fontSize: '13.5px' }}
                              />
                              <button
                                type="submit"
                                disabled={qState.submitting || !(qState.answerText || '').trim()}
                                className="btn-primary"
                                style={{ padding: '8px 18px', fontSize: '13px' }}
                              >
                                {qState.submitting ? 'Checking...' : 'Submit Solution'}
                              </button>
                            </div>

                            {qState.feedback && (
                              <div
                                style={{
                                  marginTop: '10px',
                                  fontSize: '12.5px',
                                  fontWeight: 600,
                                  color: qState.feedback.correct ? '#22C55E' : '#EF4444',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                  {qState.feedback.correct ? 'check_circle' : 'error'}
                                </span>
                                <span>{qState.feedback.message}</span>
                              </div>
                            )}
                          </form>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', padding: '40px 20px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--primary)', opacity: 0.8, marginBottom: '12px' }}>
                emoji_events
              </span>
              <h3 style={{ fontSize: '16px', color: 'var(--text)', margin: '0 0 6px' }}>
                {competitions.length === 0 ? 'No competitions available' : 'No competition selected'}
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 18px', lineHeight: 1.5 }}>
                {competitions.length === 0
                  ? isHost
                    ? 'There are currently no active competition sprints. As an organizer/host, you can launch a new mathematical sprint.'
                    : 'There are currently no active competition sprints scheduled. When an organizer launches a competition, it will appear on the left for you to enter and earn Points and learn alongside.'
                  : isHost
                    ? 'Select an active competition on the left to view problems, or host a new mathematical competition sprint.'
                    : 'Select an active competition on the left to enter the arena, solve problem sets, and earn Axiom Points.'}
              </p>
              {isHost && (
                <button
                  onClick={() => setShowHostModal(true)}
                  className="btn-primary"
                  style={{ padding: '9px 20px', fontSize: '13px' }}
                >
                  Host Competition
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Host Competition Modal */}
      {isHost && showHostModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 10, 14, 0.84)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowHostModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '580px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px 30px',
              backgroundColor: '#16161B',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text)' }}>
                  Host Mathematical Competition
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Create an active sprint with problem challenges where participants earn Axiom Points.
                </p>
              </div>
              <button
                onClick={() => setShowHostModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateCompetition} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Competition Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Putnam Preparation Sprint #1"
                  className="glass-input"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '13.5px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Description / Topic Focus
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g., Solve 3 problems in abstract algebra and real analysis..."
                  className="glass-input"
                  value={compDesc}
                  onChange={(e) => setCompDesc(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '13.5px', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Competition End Date (optional)
                </label>
                <input
                  type="datetime-local"
                  className="glass-input"
                  value={compEndDate}
                  onChange={(e) => setCompEndDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '13.5px', backgroundColor: '#1A1A22' }}
                />
              </div>

              {/* Dynamic Questions Builder */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                    Challenge Questions (+10 pts each)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddQuestionField}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                    Add Question
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {questionsList.map((q, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: '#141418',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>
                          Question #{idx + 1}
                        </span>
                        {questionsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestionField(idx)}
                            style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0 }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                          </button>
                        )}
                      </div>

                      <textarea
                        rows={2}
                        placeholder="Problem statement (supports LaTeX e.g. Evaluate $\int_0^1 x^2 dx$)..."
                        className="glass-input"
                        value={q.prompt}
                        onChange={(e) => handleQuestionFieldChange(idx, 'prompt', e.target.value)}
                        style={{ width: '100%', fontSize: '13px', resize: 'vertical' }}
                      />

                      <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Correct Answer (e.g. 1/3)"
                          className="glass-input"
                          value={q.answer}
                          onChange={(e) => handleQuestionFieldChange(idx, 'answer', e.target.value)}
                          style={{ fontSize: '13px' }}
                        />
                        <input
                          type="number"
                          placeholder="Points (10)"
                          className="glass-input"
                          value={q.points}
                          onChange={(e) => handleQuestionFieldChange(idx, 'points', e.target.value)}
                          style={{ fontSize: '13px' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setShowHostModal(false)}
                  className="btn-secondary"
                  style={{ padding: '9px 18px', fontSize: '13.5px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={hosting || !compName.trim()}
                  className="btn-primary"
                  style={{ padding: '9px 20px', fontSize: '13.5px' }}
                >
                  {hosting ? 'Hosting...' : 'Host Competition Sprint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Question Modal (Organizer Only) */}
      {showAddQuestionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 10, 14, 0.84)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowAddQuestionModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '520px',
              maxHeight: 'min(90vh, 90dvh)',
              overflowY: 'auto',
              padding: '24px 20px',
              backgroundColor: '#16161B',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text)' }}>
                  Add Challenge Problem
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Author a new mathematical question for &ldquo;{activeCompetition?.name}&rdquo;
                </p>
              </div>
              <button
                onClick={() => setShowAddQuestionModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddQuestionToCompetition} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Problem Statement (supports LaTeX) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Find the value of $\int_0^{\pi} \sin(x) dx$..."
                  className="glass-input"
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: '13.5px', resize: 'vertical' }}
                />
              </div>

              <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Correct Answer *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2"
                    className="glass-input"
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', fontSize: '13.5px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Points
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="glass-input"
                    value={newPoints}
                    onChange={(e) => setNewPoints(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', fontSize: '13.5px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddQuestionModal(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingQuestion || !newPrompt.trim() || !newAnswer.trim()}
                  className="btn-primary"
                  style={{ padding: '8px 18px', fontSize: '13px' }}
                >
                  {addingQuestion ? 'Adding...' : 'Add Problem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Registration Confirmation Modal */}
      {registerModal && (
        <ConfirmModal
          isOpen={Boolean(registerModal)}
          onClose={() => setRegisterModal(null)}
          onConfirm={handleConfirmRegisterModal}
          title="Register for Competition Sprint"
          message={`You must register for "${activeCompetition?.title || 'this sprint'}" before submitting solutions and earning Axiom Points. Would you like to register now?`}
          confirmText="Register & Submit"
          cancelText="Cancel"
          variant="info"
          isLoading={registering}
        />
      )}
    </div>
  );
}

export default CompetitionsPage;
