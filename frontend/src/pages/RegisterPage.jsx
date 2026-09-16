import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../api/client';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const frontendOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const googleOAuthUrl = `${API_BASE}/api/accounts/oauth/google/login/?frontend_redirect=${encodeURIComponent(frontendOrigin)}`;
  const microsoftOAuthUrl = `${API_BASE}/api/accounts/oauth/microsoft/login/?frontend_redirect=${encodeURIComponent(frontendOrigin)}`;

  // Step state: 1 = Account Credentials, 2 = Role-Specific Profile
  const [step, setStep] = useState(1);

  // Step 1: Account essentials & role
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('student'); // 'student' | 'host'

  // Show/hide password toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2: Student fields
  const [department, setDepartment] = useState('Mathematics');
  const [yearOfStudy, setYearOfStudy] = useState('1');
  const [studentSchool, setStudentSchool] = useState('');

  // Step 2: Host / Organizer / Lecturer fields
  const [hostInstitution, setHostInstitution] = useState('');
  const [hostDesignation, setHostDesignation] = useState('');
  const [hostDepartment, setHostDepartment] = useState('Mathematics');
  const [hostBio, setHostBio] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Clears any stale error whenever moving between steps
  const goToStep = (targetStep) => {
    setError('');
    setStep(targetStep);
  };

  const handleRoleSelect = (nextRole) => {
    if (loading) return;
    setRole(nextRole);
  };

  const handleRoleKeyDown = (e, nextRole) => {
    if (loading) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setRole(nextRole);
    }
  };

  // Handle Step 1 validation
  const handleProceedToProfile = (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please choose a username.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    goToStep(2);
  };

  // Handle Step 2 Final Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    try {
      setLoading(true);

      const payload = {
        username: username.trim(),
        email: email.trim(),
        password,
        password2: confirmPassword,
        role,
      };

      if (role === 'student') {
        payload.department = department;
        payload.year_of_study = parseInt(yearOfStudy, 10) || 1;
        if (studentSchool.trim()) {
          payload.institution = studentSchool.trim();
        }
      } else {
        payload.department = hostDepartment;
        payload.institution = hostInstitution.trim();
        payload.designation = hostDesignation.trim();
        payload.bio = hostBio.trim();
      }

      await register(payload);
      navigate('/feed', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-shell"
      style={{
        minHeight: 'calc(100vh - 120px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '36px',
          backgroundColor: '#18181D',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(229, 169, 60, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-subtle)',
            fontSize: '13px',
            textDecoration: 'none',
            marginBottom: '16px',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
          Back to Math'd
        </Link>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 className="font-display" style={{ fontSize: '28px', color: 'var(--text)', marginBottom: '6px' }}>
            Join Math'd
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {step === 1
              ? 'Create your account & choose your role.'
              : role === 'student'
                ? 'Tell us a bit about yourself.'
                : 'Set up your host profile.'}
          </p>
        </div>

        {/* Multi-step Progress Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '26px', position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '20%',
              right: '20%',
              height: '2px',
              backgroundColor: step === 2 ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)',
              zIndex: 1,
              transform: 'translateY(-50%)',
              transition: 'background-color 0.3s ease',
            }}
          />

          <div
            onClick={() => goToStep(1)}
            style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '6px' }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: step >= 1 ? 'var(--primary)' : '#27272A',
                color: step >= 1 ? '#000' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 700,
                boxShadow: step === 1 ? '0 0 12px rgba(229, 169, 60, 0.4)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {step > 1 ? '✓' : '1'}
            </div>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: step === 1 ? 'var(--primary)' : 'var(--text-subtle)' }}>
              Account
            </span>
          </div>

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: step === 2 ? 'var(--primary)' : '#27272A',
                color: step === 2 ? '#000' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 700,
                boxShadow: step === 2 ? '0 0 12px rgba(229, 169, 60, 0.4)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              2
            </div>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: step === 2 ? 'var(--primary)' : 'var(--text-subtle)' }}>
              Profile Setup
            </span>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#FCA5A5',
              fontSize: '13px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
            <span>{error}</span>
          </div>
        )}

        {/* ===================== STEP 1: ACCOUNT DETAILS & ROLE ===================== */}
        {step === 1 && (
          <form onSubmit={handleProceedToProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Academic Role Picker */}
            <div>
              <label id="role-picker-label" style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                Select Your Role
              </label>
              <div className="mobile-form-grid" role="radiogroup" aria-labelledby="role-picker-label" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {/* Student Option */}
                <div
                  role="radio"
                  aria-checked={role === 'student'}
                  tabIndex={0}
                  onClick={() => handleRoleSelect('student')}
                  onKeyDown={(e) => handleRoleKeyDown(e, 'student')}
                  style={{
                    padding: '14px 12px',
                    borderRadius: '10px',
                    border: role === 'student' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    backgroundColor: role === 'student' ? 'rgba(229, 169, 60, 0.08)' : 'var(--surface-input)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: role === 'student' ? 'var(--primary)' : 'var(--text)' }}>
                      Student.
                    </span>
                    {role === 'student' ? (
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>check_circle</span>
                    ) : (
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-subtle)' }}>school</span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-subtle)', lineHeight: 1.3 }}>
                    Solve problems, participate in challenges.
                  </p>
                </div>

                {/* Host / Organizer Option */}
                <div
                  role="radio"
                  aria-checked={role === 'host'}
                  tabIndex={0}
                  onClick={() => handleRoleSelect('host')}
                  onKeyDown={(e) => handleRoleKeyDown(e, 'host')}
                  style={{
                    padding: '14px 12px',
                    borderRadius: '10px',
                    border: role === 'host' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    backgroundColor: role === 'host' ? 'rgba(229, 169, 60, 0.08)' : 'var(--surface-input)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: role === 'host' ? 'var(--primary)' : 'var(--text)' }}>
                      Organiser.
                    </span>
                    {role === 'host' ? (
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>check_circle</span>
                    ) : (
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-subtle)' }}>workspace_premium</span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-subtle)', lineHeight: 1.3 }}>
                    Organize competitions, mastermind challenges.
                  </p>
                </div>
              </div>
            </div>

            {/* Username */}
            <div>
              <label htmlFor="reg-username" style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Username
              </label>
              <input
                id="reg-username"
                type="text"
                className="glass-input"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. euler_31"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="reg-email" style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                className="glass-input"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. scholar@university.edu"
              />
            </div>

            {/* Password & Confirm Password */}
            <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label htmlFor="reg-password" style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    className="glass-input"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', paddingRight: '38px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-subtle)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="reg-confirm-password" style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="reg-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="glass-input"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', paddingRight: '38px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showConfirmPassword}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-subtle)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      {showConfirmPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '10px',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span>Continue to Profile Setup</span>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
            </button>
          </form>
        )}

        {/*STEP 2: ROLE-SPECIFIC PROFILE SETUP */}
        {step === 2 && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Context Badge */}
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(229, 169, 60, 0.08)',
                border: '1px solid rgba(229, 169, 60, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>
                  {role === 'student' ? 'school' : 'domain'}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                  {role === 'student' ? 'Student & Scholar Details' : 'Host & Organizer Details'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => !loading && goToStep(1)}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  padding: 0,
                }}
              >
                Change Role
              </button>
            </div>

            {/* --- Student Specific Fields --- */}
            {role === 'student' && (
              <>
                <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Department / Major
                    </label>
                    <select
                      className="glass-input"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      disabled={loading}
                      style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                    >
                      <option value="Mathematics" style={{ background: '#030712' }}>Mathematics</option>
                      <option value="Physics" style={{ background: '#030712' }}>Physics</option>
                      <option value="Computer Science" style={{ background: '#030712' }}>Computer Science</option>
                      <option value="Engineering" style={{ background: '#030712' }}>Engineering</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Year of Study
                    </label>
                    <select
                      className="glass-input"
                      value={yearOfStudy}
                      onChange={(e) => setYearOfStudy(e.target.value)}
                      disabled={loading}
                      style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                    >
                      <option value="1" style={{ background: '#030712' }}>Year 1</option>
                      <option value="2" style={{ background: '#030712' }}>Year 2</option>
                      <option value="3" style={{ background: '#030712' }}>Year 3</option>
                      <option value="4" style={{ background: '#030712' }}>Year 4 / Postgrad</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    School / University <span style={{ color: 'var(--text-subtle)', fontSize: '11px' }}>(Optional)</span>
                  </label>
                  <input
                    type="text"
                    className="glass-input"
                    value={studentSchool}
                    onChange={(e) => setStudentSchool(e.target.value)}
                    disabled={loading}
                    placeholder="e.g. University of Lagos, MIT, Oxford"
                  />
                </div>
              </>
            )}

            {/* --- Host / Organizer / Lecturer Specific Fields --- */}
            {role === 'host' && (
              <>
                <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Organization / Institution
                    </label>
                    <input
                      type="text"
                      className="glass-input"
                      value={hostInstitution}
                      onChange={(e) => setHostInstitution(e.target.value)}
                      disabled={loading}
                      placeholder="e.g. Math Club, MIT, Independent"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Designation / Role <span style={{ color: 'var(--text-subtle)', fontSize: '11px' }}>(Optional)</span>
                    </label>
                    <input
                      type="text"
                      className="glass-input"
                      value={hostDesignation}
                      onChange={(e) => setHostDesignation(e.target.value)}
                      disabled={loading}
                      placeholder="e.g. Lecturer, Club Lead, Organizer"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Department / Focus Field
                  </label>
                  <select
                    className="glass-input"
                    value={hostDepartment}
                    onChange={(e) => setHostDepartment(e.target.value)}
                    disabled={loading}
                    style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                  >
                    <option value="Mathematics" style={{ background: '#030712' }}>Mathematics</option>
                    <option value="Physics" style={{ background: '#030712' }}>Physics</option>
                    <option value="Computer Science" style={{ background: '#030712' }}>Computer Science</option>
                    <option value="Engineering" style={{ background: '#030712' }}>Engineering</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    About / Bio <span style={{ color: 'var(--text-subtle)', fontSize: '11px' }}>(Optional)</span>
                  </label>
                  <textarea
                    className="glass-input"
                    rows="3"
                    value={hostBio}
                    onChange={(e) => setHostBio(e.target.value)}
                    disabled={loading}
                    placeholder="Describe your competitions, seminars, or academic topics..."
                    style={{ resize: 'vertical', minHeight: '68px' }}
                  />
                </div>
              </>
            )}

            {/* Actions: Back and Submit */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => !loading && goToStep(1)}
                disabled={loading}
                className="btn-secondary"
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '14px',
                  backgroundColor: '#27272A',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{
                  flex: 2,
                  padding: '12px',
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {loading ? 'Creating Account...' : 'Complete Registration'}
              </button>
            </div>
          </form>
        )}

        {/* Step 1 Social Logins and Sign In link */}
        {step === 1 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '12px' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
              <span style={{ fontSize: '11.5px', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                or register with
              </span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href={googleOAuthUrl}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  backgroundColor: '#141418',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </a>

              <a
                href={microsoftOAuthUrl}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  backgroundColor: '#141418',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M1 1h10v10H1z" />
                  <path fill="#81bc06" d="M12 1h10v10H12z" />
                  <path fill="#05a6f0" d="M1 12h10v10H1z" />
                  <path fill="#ffba08" d="M12 12h10v10H12z" />
                </svg>
                <span>Continue with Microsoft</span>
              </a>
            </div>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
