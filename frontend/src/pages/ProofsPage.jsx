import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API, resolveMediaUrl } from '../api/client';
import MathRenderer from '../components/common/MathRenderer';
import Modal from '../components/common/Modal';
import ConfirmModal from '../components/common/ConfirmModal';
import MathGraphStudio from '../components/studio/MathGraphStudio';
import ProofWalkthroughRecorder from '../components/studio/ProofWalkthroughRecorder';



export function ProofsPage() {
  const { user, isAuthenticated } = useAuth();
  const [proofs, setProofs] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileTab, setMobileTab] = useState('preprints'); // 'preprints' | 'axioms' | 'graphs'
  const [activeTab, setActiveTab] = useState('preprints'); // 'preprints' | 'axioms' | 'graphs'
  const [walkthroughMedia, setWalkthroughMedia] = useState(null);
  const [attachedGraphSnapshot, setAttachedGraphSnapshot] = useState(null);
  const [showGraphStudioModal, setShowGraphStudioModal] = useState(false);

  // Interactive endorsements state
  const [endorsedMap, setEndorsedMap] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [proofToDelete, setProofToDelete] = useState(null);
  const [deletingProof, setDeletingProof] = useState(false);

  // Composer modal state
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [latexProof, setLatexProof] = useState('');
  const [steps, setSteps] = useState([
    { id: 1, statement: 'Initial assumption / given premises', latex: '', rule: 'Hypothesis' },
  ]);
  const [selectedFormulaIds, setSelectedFormulaIds] = useState([]);
  const [visibility, setVisibility] = useState('public');
  const [saving, setSaving] = useState(false);
  const [expandedProofId, setExpandedProofId] = useState(null);

  // Active input focus target for inserting math symbols
  const [activeSymbolTarget, setActiveSymbolTarget] = useState('latexProof');

  const mathSymbols = [
    { sym: '∀', code: '\\forall ' },
    { sym: '∃', code: '\\exists ' },
    { sym: '∈', code: '\\in ' },
    { sym: '∉', code: '\\notin ' },
    { sym: '⊂', code: '\\subset ' },
    { sym: '⊆', code: '\\subseteq ' },
    { sym: '⟹', code: '\\implies ' },
    { sym: '⟺', code: '\\iff ' },
    { sym: '∑', code: '\\sum_{i=1}^n ' },
    { sym: '∏', code: '\\prod_{i=1}^n ' },
    { sym: '∫', code: '\\int_a^b ' },
    { sym: '∂', code: '\\partial ' },
    { sym: '∇', code: '\\nabla ' },
    { sym: '∞', code: '\\infty ' },
    { sym: 'ℝ', code: '\\mathbb{R}' },
    { sym: 'ℂ', code: '\\mathbb{C}' },
    { sym: 'ℤ', code: '\\mathbb{Z}' },
    { sym: 'ℕ', code: '\\mathbb{N}' },
    { sym: 'ε', code: '\\varepsilon ' },
    { sym: 'δ', code: '\\delta ' },
    { sym: 'θ', code: '\\theta ' },
    { sym: 'π', code: '\\pi ' },
    { sym: 'λ', code: '\\lambda ' },
    { sym: 'Q.E.D.', code: '\\quad \\blacksquare' },
  ];

  // Foundational axioms for quick sidebar reference
  const axiomReference = [
    {
      name: 'Completeness of ℝ',
      latex: '\\forall S \\subset \\mathbb{R}, \\ S \\neq \\emptyset \\text{ bdd above} \\implies \\exists \\sup S',
      desc: 'Every non-empty subset of real numbers bounded above has a least upper bound (supremum).',
    },
    {
      name: "Euler's Identity",
      latex: 'e^{i\\pi} + 1 = 0',
      desc: 'Connects analysis, algebra, geometry, and arithmetic into a single equation.',
    },
    {
      name: "Stokes' Generalized Theorem",
      latex: '\\int_{\\partial \\Omega} \\omega = \\int_{\\Omega} d\\omega',
      desc: 'Fundamental theorem of multivariable calculus relating differential forms over manifolds.',
    },
    {
      name: 'Cauchy-Schwarz Inequality',
      latex: '|\\langle u, v \\rangle|^2 \\leq \\langle u, u \\rangle \\cdot \\langle v, v \\rangle',
      desc: 'Foundational inequality for inner product spaces and functional analysis.',
    },
    {
      name: 'Archimedean Property',
      latex: '\\forall x \\in \\mathbb{R}, \\ \\exists n \\in \\mathbb{N} : n > x',
      desc: 'For every real number, there exists a natural number greater than it.',
    },
    {
      name: 'Bolzano-Weierstrass Theorem',
      latex: '(x_n) \\text{ bounded in } \\mathbb{R}^k \\implies \\exists (x_{n_k}) \\to L',
      desc: 'Every bounded sequence in Euclidean space possesses a convergent subsequence.',
    },
  ];

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchProofsAndFormulas = async () => {
    try {
      setLoading(true);
      const [creationsRes, formulasRes] = await Promise.all([
        API.get('/api/studio/creations/').catch(() => ({ ok: false })),
        API.get('/api/studio/formulas/').catch(() => ({ ok: false })),
      ]);

      if (creationsRes && creationsRes.ok) {
        const data = await creationsRes.json();
        setProofs(data.results || data || []);
      }

      if (formulasRes && formulasRes.ok) {
        const data = await formulasRes.json();
        setFormulas(data.results || data || []);
      }
    } catch (err) {
      console.error('Failed to load proofs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProofsAndFormulas();
  }, []);

  const handleAddStep = () => {
    const newId = Date.now();
    setSteps((prev) => [
      ...prev,
      { id: newId, statement: '', latex: '', rule: 'Deduction' },
    ]);
    setActiveSymbolTarget(`step_${newId}`);
  };

  const handleRemoveStep = (id) => {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateStep = (id, field, value) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const insertSymbol = (code) => {
    if (activeSymbolTarget === 'latexProof') {
      setLatexProof((prev) => prev + code);
    } else if (activeSymbolTarget.startsWith('step_')) {
      const stepId = Number(activeSymbolTarget.replace('step_', ''));
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, latex: s.latex + code } : s))
      );
    } else {
      setLatexProof((prev) => prev + code);
    }
  };

  const handleInsertAxiom = (axiomLatex) => {
    if (isComposerOpen) {
      insertSymbol(axiomLatex);
      showToast(`Inserted axiom into derivation!`);
    } else {
      setSearchTerm(axiomLatex);
      showToast(`Filtering preprints by axiom...`);
    }
  };

  const handleToggleEndorse = (proofId) => {
    setEndorsedMap((prev) => {
      const wasEndorsed = !!prev[proofId];
      const next = { ...prev, [proofId]: !wasEndorsed };
      if (!wasEndorsed) {
        showToast('✓ Endorsed mathematical rigor (Q.E.D. consensus registered)!');
      }
      return next;
    });
  };

  const handleCopyLatex = (id, code) => {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopiedId(id);
    showToast('LaTeX equation copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleConfirmDeleteProof = async () => {
    if (!proofToDelete) return;
    setDeletingProof(true);
    try {
      const res = await API.delete(`/api/studio/creations/${proofToDelete.id}/`);
      if (res.ok) {
        setProofs((prev) => prev.filter((p) => p.id !== proofToDelete.id));
        setProofToDelete(null);
        showToast('Proof preprint deleted successfully.');
      } else {
        showToast('Failed to delete preprint.');
      }
    } catch {
      showToast('Error deleting preprint.');
    } finally {
      setDeletingProof(false);
    }
  };

  const handlePublishProof = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please provide a theorem title.');
      return;
    }

    setSaving(true);

    const formattedStepsText = steps
      .map((s, idx) => `Step ${idx + 1} [${s.rule}]: ${s.statement} ${s.latex ? `$$${s.latex}$$` : ''}`)
      .join('\n\n');

    let fullContent = [
      hypothesis ? `**Hypothesis:**\n${hypothesis}` : '',
      conclusion ? `**Theorem Statement:**\n${conclusion}` : '',
      formattedStepsText ? `**Derivation Steps:**\n${formattedStepsText}` : '',
    ]
      .filter(Boolean)
      .join('\n\n---\n\n');

    if (attachedGraphSnapshot) {
      fullContent += `\n\n---\n\n**Geometric & Coordinate Visualization:**\n\n![Coordinate Plot](${attachedGraphSnapshot})`;
    }

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('content', fullContent);
      if (latexProof.trim()) formData.append('latex_content', latexProof.trim());
      formData.append('visibility', visibility);
      selectedFormulaIds.forEach((id) => formData.append('formula_ids', id));
      if (walkthroughMedia) {
        formData.append('media', walkthroughMedia);
      }

      const res = await API.post('/api/studio/creations/', formData);

      if (res.ok) {
        const created = await res.json();
        setIsComposerOpen(false);
        setTitle('');
        setHypothesis('');
        setConclusion('');
        setLatexProof('');
        setSteps([{ id: 1, statement: 'Initial assumption / given premises', latex: '', rule: 'Hypothesis' }]);
        setSelectedFormulaIds([]);
        setWalkthroughMedia(null);
        setAttachedGraphSnapshot(null);
        setProofs((prev) => [created, ...prev]);
        showToast('🎉 Theorem preprint published live for peer review consensus!');
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(`Failed to publish: ${errorData.detail || JSON.stringify(errorData)}`);
      }
    } catch (err) {
      console.error('Error creating proof:', err);
      showToast('Network error publishing proof. Please check your connection.');
    } finally {
      setSaving(false);
    }
  };

  // Combine live database proofs with authentic seed proofs
  const allProofs = [...proofs, ...SEED_PROOFS];

  const currentUserId = API.getCurrentUserId();

  const filteredProofs = allProofs.filter((p) => {
    if (activeFilter === 'my') {
      return currentUserId && Number(p.author_id || p.author?.id) === Number(currentUserId);
    }

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      p.title?.toLowerCase().includes(q) ||
      p.content?.toLowerCase().includes(q) ||
      p.author_username?.toLowerCase?.().includes(q) ||
      p.latex_content?.toLowerCase().includes(q) ||
      p.axiom_cited?.toLowerCase().includes(q)
    );
  });

  const getProofPreview = (content) => {
    if (!content) return '';
    // If structured with dividers (---), show first section (hypothesis) as concise preview
    const sections = content.split(/\n\s*---\s*\n/);
    if (sections.length > 1 && sections[0].trim()) {
      return sections[0].trim();
    }
    // Otherwise clean cut off at 260 characters
    if (content.length <= 260) return content;
    const cut = content.slice(0, 260);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 180 ? cut.slice(0, lastSpace) : cut) + '...';
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            zIndex: 99999,
            backgroundColor: '#1E1E24',
            color: 'var(--primary)',
            border: '1px solid var(--primary-border)',
            padding: '12px 18px',
            borderRadius: '10px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
            fontSize: '13.5px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeInScale 0.2s ease',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
          {toastMessage}
        </div>
      )}

      {/* Studio Header Card */}
      <div
        className="card"
        style={{
          padding: '24px 28px',
          marginBottom: '20px',
          backgroundColor: '#16161B',
        }}
      >
        <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: '1 1 300px' }}>
            <div className="badge-academic" style={{ marginBottom: '8px' }}>
              Math Proofs & Solutions
            </div>
            <h1 style={{ fontSize: '24px', margin: '0 0 6px', fontWeight: 700 }}>
              Step-by-Step Proofs & Formulas
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '640px', margin: 0, lineHeight: 1.55 }}>
              Write step-by-step math proofs, link formulas, and share your solutions with fellow students.
            </p>
          </div>

          <button
            onClick={() => {
              if (!isAuthenticated) {
                showToast('Please sign in to write and share math proofs.');
                return;
              }
              setIsComposerOpen(true);
            }}
            className="btn-primary"
            style={{ padding: '10px 18px', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>draw</span>
            <span>Write Solution or Proof</span>
          </button>
        </div>

        {/* Academic Stats Summary (Optimized for Mobile & Desktop) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
            gap: '12px',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>
              {allProofs.length}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>Shared Solutions</div>
          </div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>
              {formulas.length > 0 ? formulas.length : 12}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>Rules & Formulas</div>
          </div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary)' }}>
              Q.E.D.
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>Step-by-Step Solutions</div>
          </div>
        </div>
      </div>

      {/* Studio View Navigation Switcher */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', gap: '8px', padding: '4px', backgroundColor: '#141418', borderRadius: '10px', border: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <button
            type="button"
            onClick={() => setMobileTab('preprints')}
            style={{
              padding: '8px 16px',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: mobileTab === 'preprints' ? 'var(--primary)' : 'transparent',
              color: mobileTab === 'preprints' ? '#121215' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>history_edu</span>
            Solutions ({filteredProofs.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('axioms')}
            style={{
              padding: '8px 16px',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: mobileTab === 'axioms' ? 'var(--primary)' : 'transparent',
              color: mobileTab === 'axioms' ? '#121215' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>menu_book</span>
            Rules & Formulas ({axiomReference.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('graphs')}
            style={{
              padding: '8px 16px',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: mobileTab === 'graphs' ? 'var(--primary)' : 'transparent',
              color: mobileTab === 'graphs' ? '#121215' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>show_chart</span>
            2D & 3D Graph Plotter
          </button>
        </div>
      </div>

      {mobileTab === 'graphs' ? (
        <div style={{ width: '100%', marginBottom: '24px' }}>
          <MathGraphStudio
            onSnapshot={(snap) => {
              setAttachedGraphSnapshot(snap.dataUrl);
              showToast('✓ Graph snapshot captured! Opening composer...');
              setIsComposerOpen(true);
            }}
          />
        </div>
      ) : (
      <div className="studio-grid">
        {/* Left Column: Proofs List & Filter (Hidden on mobile if Axiom tab is active) */}
        <div className={`proofs-col-stream ${mobileTab === 'axioms' ? 'proofs-mobile-hidden' : ''}`}>
          {/* Filter & Search Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setActiveFilter('all')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: activeFilter === 'all' ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                  backgroundColor: activeFilter === 'all' ? 'var(--primary-subtle)' : 'transparent',
                  color: activeFilter === 'all' ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                All Solutions ({allProofs.length})
              </button>
              {isAuthenticated && (
                <button
                  onClick={() => setActiveFilter('my')}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    border: activeFilter === 'my' ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                    backgroundColor: activeFilter === 'my' ? 'var(--primary-subtle)' : 'transparent',
                    color: activeFilter === 'my' ? 'var(--primary)' : 'var(--text-muted)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  My Solutions
                </button>
              )}
            </div>

            <div style={{ flex: '1 1 200px', maxWidth: '340px' }}>
              <input
                type="text"
                className="glass-input"
                placeholder="Search solutions, formulas, or topics..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '7px 12px', fontSize: '13px', width: '100%' }}
              />
            </div>
          </div>

          {/* Proofs Cards Stream */}
          {loading ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <span className="material-symbols-outlined spin" style={{ fontSize: '32px', color: 'var(--primary)', marginBottom: '8px' }}>
                progress_activity
              </span>
              <p style={{ fontSize: '14px' }}>Loading mathematical proofs...</p>
            </div>
          ) : filteredProofs.length === 0 ? (
            <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: '#18181D' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--primary)', marginBottom: '8px' }}>
                history_edu
              </span>
              <h3 style={{ fontSize: '16px', color: 'var(--text)', margin: '4px 0' }}>No matching proofs found</h3>
              <p style={{ fontSize: '13px', margin: '4px 0 16px' }}>
                Try adjusting your search query or author a new theorem preprint.
              </p>
              <button onClick={() => setSearchTerm('')} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '12px' }}>
                Reset Filter
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredProofs.map((p) => {
                const isExpanded = expandedProofId === p.id;
                const authorDisplay = p.author_username || p.author_email || (typeof p.author === 'string' ? p.author : p.author?.username) || 'Mathematician';
                const isAuthor = currentUserId && (
                  Number(p.author_id) === Number(currentUserId) ||
                  Number(p.author?.id) === Number(currentUserId)
                );
                const isEndorsed = !!endorsedMap[p.id];
                const baseEndorsements = p.endorsements_count || 0;
                const currentEndorsements = baseEndorsements + (isEndorsed ? 1 : 0);

                return (
                  <article
                    key={p.id}
                    className="card"
                    style={{
                      padding: '22px 24px',
                      backgroundColor: '#18181D',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    {/* Proof Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className="badge-academic" style={{ fontSize: '11px', padding: '2px 7px' }}>
                            Formal Theorem
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                            {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Preprint'}
                          </span>
                          {p.axiom_cited && (
                            <span style={{ fontSize: '11px', color: 'var(--primary)', backgroundColor: 'var(--primary-subtle)', padding: '1px 6px', borderRadius: '4px' }}>
                              {p.axiom_cited}
                            </span>
                          )}
                        </div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '6px 0 2px', color: 'var(--text)', lineHeight: 1.35 }}>
                          {p.title}
                        </h2>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                          Author: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{authorDisplay}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isAuthor && typeof p.id === 'number' && (
                          <button
                            onClick={() => setProofToDelete(p)}
                            title="Delete proof"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-subtle)',
                              cursor: 'pointer',
                              padding: '4px',
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#EF4444' }}>delete</span>
                          </button>
                        )}
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {p.visibility ? p.visibility.toUpperCase() : 'PUBLIC'}
                        </span>
                      </div>
                    </div>

                    {/* Main LaTeX Equation Display */}
                    {p.latex_content && (
                      <div className="math-paper" style={{ margin: '14px 0', padding: '14px 18px', borderRadius: '10px' }}>
                        <div className="katex-display-container">
                          <MathRenderer content={`$$${p.latex_content}$$`} />
                        </div>
                      </div>
                    )}

                    {/* Author Walkthrough / Plot Media */}
                    {p.media && (
                      <div style={{ margin: '14px 0', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', backgroundColor: '#121216' }}>
                        {/\.(mp4|webm|mov|m4v|weba)$/i.test(p.media) || (typeof p.media === 'string' && p.media.startsWith('data:video')) ? (
                          <div>
                            <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--primary)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>video_camera_front</span>
                              Theorem Walkthrough Explanation
                            </div>
                            <video src={resolveMediaUrl(p.media)} controls playsInline style={{ width: '100%', maxHeight: '340px', display: 'block', backgroundColor: '#000' }} />
                          </div>
                        ) : /\.(mp3|wav|m4a|ogg)$/i.test(p.media) || (typeof p.media === 'string' && p.media.startsWith('data:audio')) ? (
                          <div style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--primary)', fontWeight: 600, marginBottom: '8px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>mic</span>
                              Audio Walkthrough & Derivation Notes
                            </div>
                            <audio src={resolveMediaUrl(p.media)} controls style={{ width: '100%' }} />
                          </div>
                        ) : (
                          <div>
                            <img
                              src={resolveMediaUrl(p.media)}
                              alt="Mathematical Plot"
                              style={{ width: '100%', maxHeight: '380px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text Statement or Abstract with KaTeX & Markdown Rendering */}
                    {p.content && (
                      <div style={{ fontSize: '13.5px', color: 'var(--text)', lineHeight: 1.6, margin: '12px 0' }}>
                        <MathRenderer
                          content={isExpanded ? p.content : getProofPreview(p.content)}
                        />
                      </div>
                    )}

                    {/* Interactive Proof Footer: Endorsements, LaTeX Copy, and Read Derivation */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '14px',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--border)',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {/* Interactive Endorse (Q.E.D.) Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleEndorse(p.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 12px',
                            borderRadius: '6px',
                            border: isEndorsed ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                            backgroundColor: isEndorsed ? 'var(--primary-subtle)' : 'rgba(255, 255, 255, 0.03)',
                            color: isEndorsed ? 'var(--primary)' : 'var(--text-muted)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{
                              fontSize: '16px',
                              fontVariationSettings: isEndorsed ? "'FILL' 1" : "'FILL' 0",
                              color: isEndorsed ? 'var(--primary)' : 'var(--text-subtle)',
                            }}
                          >
                            verified
                          </span>
                          <span>{isEndorsed ? 'Endorsed ✓' : 'Endorse (Q.E.D.)'}</span>
                          <span style={{ fontSize: '11px', opacity: 0.8, marginLeft: '2px' }}>({currentEndorsements})</span>
                        </button>

                        {/* Copy LaTeX Button */}
                        {p.latex_content && (
                          <button
                            type="button"
                            onClick={() => handleCopyLatex(p.id, p.latex_content)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              backgroundColor: 'transparent',
                              color: 'var(--text-muted)',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>content_copy</span>
                            <span>{copiedId === p.id ? 'Copied! ✓' : 'Copy LaTeX'}</span>
                          </button>
                        )}
                      </div>

                      {/* Read / Collapse Derivation Toggle */}
                      {p.content && p.content.length > 240 && (
                        <button
                          type="button"
                          onClick={() => setExpandedProofId(isExpanded ? null : p.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--primary)',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px',
                          }}
                        >
                          <span>{isExpanded ? 'Collapse Derivation' : 'Read Full Derivation'}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Axiom Reference Library (Hidden on mobile if Preprints tab is active) */}
        <div className={`proofs-col-axioms ${mobileTab === 'preprints' ? 'proofs-mobile-hidden' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Axiom Reference Notebook */}
          <div className="card" style={{ padding: '20px', backgroundColor: '#18181D' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>
                menu_book
              </span>
              Axiom Reference Index
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '14px' }}>
              Foundational principles to cite in your mathematical deductions. Click to inspect or cite:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {axiomReference.map((ax) => (
                <div
                  key={ax.name}
                  style={{
                    padding: '12px 14px',
                    backgroundColor: '#141418',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                      {ax.name}
                    </div>
                    <button
                      onClick={() => handleInsertAxiom(ax.latex)}
                      className="btn-secondary"
                      title="Insert axiom formula into derivation"
                      style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px' }}
                    >
                      Cite Axiom
                    </button>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', marginBottom: '6px', lineHeight: 1.35 }}>
                    {ax.desc}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--primary)', overflowX: 'auto' }}>
                    <MathRenderer content={`$${ax.latex}$`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Formal Rigor Protocol */}
          <div className="card" style={{ padding: '20px', backgroundColor: '#16161B', border: '1px solid var(--primary-border)' }}>
            <div className="badge-academic" style={{ marginBottom: '8px' }}>
              AMS Standards
            </div>
            <h3 style={{ fontSize: '14.5px', fontWeight: 600, marginBottom: '6px' }}>
              Proof Rigor Protocol
            </h3>
            <ul style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: '16px', margin: '6px 0 0' }}>
              <li>State explicit domain and hypothesis premises.</li>
              <li>Every deduction step should reference an established lemma or axiom.</li>
              <li>Ensure all quantifiers (∀, ∃) are well-ordered.</li>
              <li>Sign off verified theorems with Q.E.D. (∎).</li>
            </ul>
          </div>
        </div>
      </div>
      )}

      {/* Proof Composer Modal (Scrollable, Responsive on Mobile & Desktop) */}
      <Modal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        title="Author Formal Mathematical Proof"
        maxWidth="680px"
      >
        <form onSubmit={handlePublishProof} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
              Theorem Title *
            </label>
            <input
              type="text"
              className="glass-input"
              placeholder="e.g. Infinitude of Primes (Euclid's Theorem)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
              Hypothesis / Given Conditions
            </label>
            <textarea
              className="glass-input"
              rows={2}
              placeholder="State premises (e.g. Let n be a natural number...)"
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
            />
          </div>

          {/* Quick LaTeX Symbols Palette */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>
                LaTeX Symbol Inserter:
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                Target: {activeSymbolTarget}
              </span>
            </div>
            <div className="symbol-palette">
              {mathSymbols.map((s) => (
                <button
                  key={s.sym}
                  type="button"
                  onClick={() => insertSymbol(s.code)}
                  className="symbol-chip"
                >
                  {s.sym}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Theorem Equation with LIVE PREVIEW */}
          <div>
            <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
              Primary Theorem Equation (LaTeX)
            </label>
            <input
              type="text"
              className="glass-input"
              placeholder="e.g. e^{i\pi} + 1 = 0"
              value={latexProof}
              onChange={(e) => setLatexProof(e.target.value)}
              onFocus={() => setActiveSymbolTarget('latexProof')}
            />
            {/* Live KaTeX Rendering Box */}
            {latexProof && (
              <div style={{ marginTop: '8px', padding: '12px', backgroundColor: '#141418', border: '1px solid var(--primary-border)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600, marginBottom: '4px' }}>
                  Live LaTeX Preview:
                </div>
                <div className="katex-display-container">
                  <MathRenderer content={`$$${latexProof}$$`} />
                </div>
              </div>
            )}
          </div>

          {/* Step-by-Step Derivations */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 500 }}>
                Step-by-Step Inference Chain
              </label>
              <button
                type="button"
                onClick={handleAddStep}
                style={{
                  fontSize: '12px',
                  color: 'var(--primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add_circle</span>
                Add Inference Step
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#141418',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>
                      Step {idx + 1}
                    </span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <select
                        value={step.rule}
                        onChange={(e) => handleUpdateStep(step.id, 'rule', e.target.value)}
                        className="glass-input"
                        style={{ padding: '2px 6px', fontSize: '11px', width: 'auto' }}
                      >
                        <option value="Hypothesis">Hypothesis</option>
                        <option value="Deduction">Deduction</option>
                        <option value="Substitution">Substitution</option>
                        <option value="Induction">Induction</option>
                        <option value="Contradiction">Contradiction</option>
                        <option value="Q.E.D.">Q.E.D.</option>
                      </select>
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(step.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-subtle)',
                            cursor: 'pointer',
                            fontSize: '16px',
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    type="text"
                    className="glass-input"
                    placeholder="Statement description (e.g. By substitution of x...)"
                    value={step.statement}
                    onChange={(e) => handleUpdateStep(step.id, 'statement', e.target.value)}
                    style={{ fontSize: '12.5px', marginBottom: '6px' }}
                  />

                  <input
                    type="text"
                    className="glass-input"
                    placeholder="LaTeX equation for this step..."
                    value={step.latex}
                    onChange={(e) => handleUpdateStep(step.id, 'latex', e.target.value)}
                    onFocus={() => setActiveSymbolTarget(`step_${step.id}`)}
                    style={{ fontSize: '12px' }}
                  />

                  {/* Step Live Preview */}
                  {step.latex && (
                    <div style={{ marginTop: '6px', padding: '6px 8px', backgroundColor: '#101014', borderRadius: '6px' }}>
                      <MathRenderer content={`$${step.latex}$`} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
              Conclusion Statement
            </label>
            <textarea
              className="glass-input"
              rows={2}
              placeholder="Final verified result / Q.E.D. summary..."
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
            />
          </div>

          {/* Graph Plot & Proof Walkthrough Attachments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', backgroundColor: '#141418', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)' }}>
                Visual & Audio Proof Walkthroughs
              </span>
              <button
                type="button"
                onClick={() => setShowGraphStudioModal(true)}
                className="btn-secondary"
                style={{ fontSize: '11.5px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>show_chart</span>
                {attachedGraphSnapshot ? 'Edit 2D/3D Graph' : 'Open 2D/3D Graph Studio'}
              </button>
            </div>

            {attachedGraphSnapshot && (
              <div style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--primary-border)' }}>
                <img src={attachedGraphSnapshot} alt="Attached Graph" style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', backgroundColor: '#0B0B0E', display: 'block' }} />
                <button
                  type="button"
                  onClick={() => setAttachedGraphSnapshot(null)}
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: '#EF4444',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                  Remove Plot
                </button>
              </div>
            )}

            <ProofWalkthroughRecorder
              onWalkthroughReady={(file) => {
                setWalkthroughMedia(file);
                if (file) {
                  showToast('✓ Proof walkthrough recorded and attached!');
                }
              }}
            />
          </div>

          {/* Modal Action Buttons (Pinned above keyboard, touch-friendly) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              onClick={() => setIsComposerOpen(false)}
              className="btn-secondary"
              style={{ minHeight: '40px', padding: '0 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{ minHeight: '40px', padding: '0 20px', fontWeight: 600 }}
            >
              {saving ? 'Publishing Theorem...' : 'Publish Proof Preprint'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modern Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(proofToDelete)}
        onClose={() => {
          if (!deletingProof) setProofToDelete(null);
        }}
        onConfirm={handleConfirmDeleteProof}
        title="Delete Theorem Preprint"
        message={`Are you sure you want to delete "${proofToDelete?.title || 'this preprint'}"? This action cannot be undone.`}
        confirmText="Delete Preprint"
        cancelText="Keep Preprint"
        variant="danger"
        isLoading={deletingProof}
      />

      {/* 2D & 3D Graph Studio Modal */}
      <Modal
        isOpen={showGraphStudioModal}
        onClose={() => setShowGraphStudioModal(false)}
        title="2D Cartesian & 3D Surface Mathematical Graph Studio"
        maxWidth="960px"
      >
        <MathGraphStudio
          onSnapshot={(snap) => {
            setAttachedGraphSnapshot(snap.dataUrl);
            setShowGraphStudioModal(false);
            showToast('✓ Graph snapshot attached to proof preprint!');
          }}
        />
      </Modal>

      <style>{`
        @media (max-width: 768px) {
          .proofs-mobile-tabs {
            display: block !important;
          }
          .proofs-mobile-hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default ProofsPage;
