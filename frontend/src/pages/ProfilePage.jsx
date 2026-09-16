import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API, resolveMediaUrl } from '../api/client';
import Modal from '../components/common/Modal';

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [badges, setBadges] = useState([]);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [bio, setBio] = useState('');
  const [dept, setDept] = useState('');
  const [year, setYear] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WEBP, GIF).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Avatar image must be smaller than 10 MB.');
      return;
    }

    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await API.patch('/api/accounts/me/profile/', formData);
      if (res.ok) {
        const updated = await res.json();
        setProfile((prev) => ({ ...prev, ...updated }));
        if (updateProfile) {
          updateProfile(updated);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.avatar ? (Array.isArray(err.avatar) ? err.avatar.join(' ') : err.avatar) : (err.detail || 'Failed to upload avatar.'));
      }
    } catch (err) {
      console.error('Error uploading avatar:', err);
      alert('Failed to upload avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setLoading(true);
        // Load detailed profile
        const profRes = await API.get('/api/accounts/me/profile/');
        if (profRes.ok) {
          const p = await profRes.json();
          setProfile(p);
          setBio(p.bio || '');
          setDept(p.department || '');
          setYear(p.year_of_study || '');
        }

        // Load User Badges
        const badgesRes = await API.get('/api/rankings/user-badges/');
        if (badgesRes.ok) {
          const b = await badgesRes.json();
          const list = b.results || b;
          setBadges(Array.isArray(list) ? list : []);
        } else {
          setBadges([]);
        }

        // Load authored posts
        const currentId = API.getCurrentUserId();
        if (currentId) {
          const postsRes = await API.get(`/api/feed/posts/?author=${currentId}`);
          if (postsRes.ok) {
            const postData = await postsRes.json();
            setUserPosts(postData.results || postData);
          }
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateProfile({ bio, department: dept, year_of_study: year });
      setProfile((prev) => ({ ...prev, bio, department: dept, year_of_study: year }));
      setIsEditOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const currentRole = profile?.role || user?.role || 'student';
  const currentUsername = profile?.user?.username || profile?.username || user?.username || 'Mathematician';
  const currentBio = profile?.bio || 'Passionate about advanced algebra, topology, and discrete mathematics.';
  const currentDept = profile?.department?.name || profile?.department || 'Department of Mathematics';

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      {/* Profile Header Card */}
      <div className="glass-card" style={{ padding: '28px', marginBottom: '24px', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', smDirection: 'row', gap: '20px', alignItems: 'center' }}>
          {/* Avatar with Upload Action */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '16px',
                backgroundColor: 'var(--surface-input)',
                border: '2px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                fontWeight: 700,
                fontSize: '32px',
                flexShrink: 0,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {profile?.avatar || user?.avatar ? (
                <img
                  src={resolveMediaUrl(profile?.avatar || user?.avatar)}
                  alt={currentUsername}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                currentUsername[0]?.toUpperCase()
              )}

              {uploadingAvatar && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span className="material-symbols-outlined spinning" style={{ color: 'var(--primary)', fontSize: '24px' }}>sync</span>
                </div>
              )}
            </div>

            <label
              htmlFor="avatar-upload-input"
              title="Upload profile photo"
              style={{
                position: 'absolute',
                bottom: '-4px',
                right: '-4px',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                border: '2px solid #1e1e24',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px', fontWeight: 700 }}>photo_camera</span>
            </label>
            <input
              id="avatar-upload-input"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
              disabled={uploadingAvatar}
            />
          </div>

          {/* User Info */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h1 style={{ fontSize: '24px', marginBottom: '6px' }}>{currentUsername}</h1>
            
            {/* Academic Role Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  backgroundColor: currentRole === 'host' ? 'rgba(229, 169, 60, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: currentRole === 'host' ? 'var(--primary)' : '#60A5FA',
                  border: `1px solid ${currentRole === 'host' ? 'rgba(229, 169, 60, 0.35)' : 'rgba(59, 130, 246, 0.35)'}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                  {currentRole === 'host' ? 'workspace_premium' : 'school'}
                </span>
                {currentRole === 'host' ? 'Host / Lecturer / Organizer' : 'Participant / Student'}
              </span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '8px' }}>
              {currentDept} {profile?.year_of_study ? `• Year ${profile.year_of_study}` : ''}
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '520px', margin: '0 auto 16px' }}>
              {currentBio}
            </p>

            <button
              onClick={() => setIsEditOpen(true)}
              className="btn-secondary"
              style={{ padding: '8px 18px', fontSize: '13px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
              Edit Profile
            </button>
          </div>
        </div>

        {/* Academic Statistics Bar */}
        <div
          className="profile-stats-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)' }}>
              {profile?.axiom_points ?? profile?.points ?? profile?.score ?? 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Axiom Points</div>
          </div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--secondary)' }}>
              {badges.length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Badges Unlocked</div>
          </div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent)' }}>
              {userPosts.length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Proofs Published</div>
          </div>
        </div>
      </div>

      {/* Badges Showcase */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--accent-gold)' }}>military_tech</span>
          Honors & Badges
        </h2>

        <div className="profile-achievements-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
          {badges.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-subtle)', textAlign: 'center', gridColumn: '1 / -1', padding: '16px 0' }}>
              No honors earned yet. Complete problem sprints or publish verified proofs to unlock badges.
            </p>
          ) : (
            badges.map((ub) => {
              const b = ub.badge || ub;
              return (
                <div
                  key={ub.id || b.name}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '14px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 184, 0, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-gold)',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                      {b.icon || 'workspace_premium'}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>{b.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-subtle)', lineHeight: 1.3 }}>
                    {b.description}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Authored Proofs & Posts */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Published Works & Notes</h2>
        {userPosts.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-subtle)', textAlign: 'center', padding: '20px 0' }}>
            No posts published yet. Share a proof from the Feed to showcase your work!
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {userPosts.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border)',
                }}
              >
                <p style={{ fontSize: '14px', marginBottom: '8px' }}>{p.content}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-subtle)' }}>
                  <span>{new Date(p.created_at).toLocaleDateString()}</span>
                  <span>{p.likes_count || 0} likes</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Academic Profile">
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Bio / Research Interests
            </label>
            <textarea
              className="glass-input"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Studying algebraic geometry and quantum algorithms."
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Department
            </label>
            <input
              type="text"
              className="glass-input"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              placeholder="e.g. Department of Mathematics"
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Year of Study
            </label>
            <input
              type="number"
              className="glass-input"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 2"
              min={1}
              max={6}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="btn-secondary"
              style={{ fontSize: '13px', padding: '8px 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{ fontSize: '13px', padding: '8px 20px' }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ProfilePage;
