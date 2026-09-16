import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MathRenderer from '../components/common/MathRenderer';

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [activeIdx, setActiveIdx] = useState(0);

  if (isAuthenticated) {
    return <Navigate to="/feed" replace />;
  }

  // Famous Math Formulas (High School & Introductory College Level)
  const theorems = [
    {
      title: "Pythagorean Theorem",
      subject: "Geometry",
      latex: "a^2 + b^2 = c^2",
      description: "For any right-angled triangle, the square of the hypotenuse equals the sum of the squares of the other two sides.",
      author: "Ancient Greece",
    },
    {
      title: "Quadratic Formula",
      subject: "Algebra",
      latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
      description: "Finds the exact roots (solutions) for any quadratic equation in the form ax² + bx + c = 0.",
      author: "Classical Algebra",
    },
    {
      title: "Euler's Formula",
      subject: "Trigonometry & Complex Numbers",
      latex: "e^{i\\pi} + 1 = 0",
      description: "Often called the most beautiful formula in mathematics, connecting e, pi, i, 1, and 0 in one simple equation.",
      author: "Leonhard Euler (1748)",
    },
    {
      title: "Power Rule of Derivatives",
      subject: "Calculus",
      latex: "\\frac{d}{dx}[x^n] = n x^{n-1}",
      description: "The fundamental rule for taking derivatives of polynomials in calculus, finding slopes and rates of change.",
      author: "Calculus Fundamentals",
    },
  ];

  const activeTheorem = theorems[activeIdx];

  const pillars = [
    {
      icon: 'groups',
      title: 'Live Study Rooms',
      desc: 'Hop on live audio/video calls with classmates, share your screen, and solve tough homework problems together.',
      link: '/groups',
      cta: 'Explore Study Rooms',
    },
    {
      icon: 'smart_toy',
      title: "Math'd AI Tutor",
      desc: 'Stuck on a tricky step? Get instant, friendly step-by-step hints and explanations without getting lost in confusing jargon.',
      link: '/tutor',
      cta: 'Chat with AI Tutor',
    },
    {
      icon: 'history_edu',
      title: 'Solution & Notes Studio',
      desc: 'Write beautiful math equations easily, plot live graphs, and share your step-by-step solutions with friends.',
      link: '/studio',
      cta: 'Open Solution Studio',
    },
    {
      icon: 'emoji_events',
      title: 'Quizzes & Challenges',
      desc: 'Test your skills in fun problem sprints, earn Math Points, unlock badges, and see where you stand on the leaderboard.',
      link: '/competitions',
      cta: 'Join a Challenge',
    },
  ];

  return (
    <div className="landing-shell" style={{ maxWidth: '980px', margin: '0 auto', width: '100%', padding: '0 20px 80px' }}>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', padding: '56px 0 44px' }}>
        <div
          className="badge-academic"
          style={{ marginBottom: '18px', padding: '4px 14px', fontSize: '12.5px' }}
        >
          <span style={{ fontFamily: 'serif', fontWeight: 700 }}>&forall;&exist;</span>
          The Social Study Hub for Math Students
        </div>

        <h1
          style={{
            fontSize: 'clamp(32px, 5vw, 54px)',
            lineHeight: 1.15,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            marginBottom: '16px',
            color: 'var(--text)',
          }}
        >
          Solve Problems.{' '}
          <span style={{ color: 'var(--primary)' }}>
            Master Math Together.
          </span>
        </h1>

        <p
          style={{
            fontSize: 'clamp(16px, 2vw, 18px)',
            color: 'var(--text-muted)',
            maxWidth: '640px',
            margin: '0 auto 32px',
            lineHeight: 1.6,
          }}
        >
          Math'd is your go-to space for math. Join live study rooms with friends,
          get step-by-step help from an AI tutor, share solutions, and ace your classes.
        </p>

        {/* Primary Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '48px' }}>
          <Link
            to="/register"
            className="btn-primary"
            style={{ padding: '11px 24px', fontSize: '14.5px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
            Get Started Free
          </Link>
          <Link
            to="/login"
            className="btn-secondary"
            style={{ padding: '11px 22px', fontSize: '14.5px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>login</span>
            Sign In
          </Link>
        </div>

        {/* Concrete Live Mathematical Formula Showcase */}
        <div
          className="card"
          style={{
            textAlign: 'left',
            padding: '24px 28px',
            maxWidth: '780px',
            margin: '0 auto',
            backgroundColor: '#16161B',
          }}
        >
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>
                functions
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Formula Showcase
              </span>
            </div>
            <span className="badge-academic" style={{ fontSize: '11px' }}>
              {activeTheorem.subject}
            </span>
          </div>

          {/* Theorem Selector Tabs */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '14px' }}>
            {theorems.map((t, idx) => (
              <button
                key={t.title}
                type="button"
                onClick={() => setActiveIdx(idx)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: idx === activeIdx ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                  backgroundColor: idx === activeIdx ? 'var(--primary-subtle)' : 'transparent',
                  color: idx === activeIdx ? 'var(--primary)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {t.title}
              </button>
            ))}
          </div>

          {/* Mathematical Statement Box */}
          <div className="math-paper" style={{ margin: '8px 0 14px', minHeight: '68px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MathRenderer content={activeTheorem.latex} displayMode={true} />
          </div>

          {/* Description & Metadata */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', fontSize: '13px' }}>
            <div style={{ maxWidth: '540px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {activeTheorem.description}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-subtle)', fontStyle: 'italic' }}>
              {activeTheorem.author}
            </div>
          </div>
        </div>
      </section>

      {/* Pillars Grid */}
      <section style={{ padding: '48px 0 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>
            Everything You Need to Ace Math
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14.5px', maxWidth: '480px', margin: '0 auto' }}>
            Tools built to make learning, collaborating, and solving problems simple and fun.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
          }}
        >
          {pillars.map((item) => (
            <div
              key={item.title}
              className="card"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--primary-subtle)',
                    border: '1px solid var(--primary-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)',
                    marginBottom: '16px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                    {item.icon}
                  </span>
                </div>

                <h3 style={{ fontSize: '17px', marginBottom: '8px', fontWeight: 600 }}>
                  {item.title}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', lineHeight: 1.6 }}>
                  {item.desc}
                </p>
              </div>

              <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                <Link
                  to={item.link}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    color: 'var(--primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {item.cta}
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Join Banner */}
      <section
        className="card"
        style={{
          marginTop: '40px',
          padding: '36px 28px',
          textAlign: 'center',
          backgroundColor: '#16161B',
        }}
      >
        <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>
          Ready to make math click?
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '500px', margin: '0 auto 20px', lineHeight: 1.6 }}>
          Join students studying smarter together, practicing challenging problems, and helping each other succeed.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/register" className="btn-primary" style={{ padding: '9px 22px', fontSize: '14px' }}>
            Join Math'd for Free
          </Link>
          <Link to="/login" className="btn-secondary" style={{ padding: '9px 18px', fontSize: '14px' }}>
            Sign In
          </Link>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
