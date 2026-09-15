import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API, resolveMediaUrl } from '../api/client';
import MathRenderer from '../components/common/MathRenderer';
import ConfirmModal from '../components/common/ConfirmModal';

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** unitIndex)).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function FeedPage() {
  const { user, isAuthenticated } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Composer state
  const [content, setContent] = useState('');
  const [latex, setLatex] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [previewTab, setPreviewTab] = useState('write');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [postToDelete, setPostToDelete] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  // Active comments drawer
  const [activeCommentsPostId, setActiveCommentsPostId] = useState(null);
  const [commentsMap, setCommentsMap] = useState({});
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [newPostsAvailable, setNewPostsAvailable] = useState(0);

  const clearSelectedFile = () => {
    if (selectedFilePreview) URL.revokeObjectURL(selectedFilePreview);
    setSelectedFile(null);
    setSelectedFilePreview('');
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (selectedFilePreview) URL.revokeObjectURL(selectedFilePreview);
    setSelectedFile(file);
    setSelectedFilePreview(URL.createObjectURL(file));
    event.target.value = '';
  };

  const categories = [
    { id: 'all', label: 'All Fields' },
    { id: 'pure', label: 'Pure Math' },
    { id: 'applied', label: 'Applied' },
    { id: 'physics', label: 'Theoretical Physics' },
    { id: 'cs', label: 'Computer Science' },
  ];

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await API.get('/api/feed/posts/');
      if (res.ok) {
        const data = await res.json();
        setPosts(data.results || data);
        setNewPostsAvailable(0);
      } else {
        setError('Unable to load feed. Please try again.');
      }
    } catch {
      setError('Network error loading posts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // Real-time check for new preprints / publications
  useEffect(() => {
    let isMounted = true;
    const checkNewPosts = async () => {
      if (posts.length === 0) return;
      try {
        const res = await API.get('/api/feed/posts/');
        if (res.ok) {
          const data = await res.json();
          const items = data.results || data;
          if (Array.isArray(items) && items.length > 0) {
            const currentLatestId = posts[0]?.id;
            const newItems = items.filter((p) => p.id > currentLatestId);
            if (isMounted && newItems.length > 0) {
              setNewPostsAvailable(newItems.length);
            }
          }
        }
      } catch {}
    };

    const interval = setInterval(checkNewPosts, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [posts]);

  const handleFileSelect = (file) => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    if (file) {
      const isVideo = file.type?.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp|mkv|avi|ogv)$/i.test(file.name);
      if (file.size > 50 * 1024 * 1024) {
        showToast('Media file is too large (max 50 MB).', 'error');
        setSelectedFile(null);
        setFilePreview(null);
        return;
      }
      if (isVideo && file.size > 4.5 * 1024 * 1024) {
        showToast(`Video selected (${(file.size / (1024 * 1024)).toFixed(1)} MB). Note: Serverless limit is 4.5 MB; compressed or short clips upload most reliably.`);
      }
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    } else {
      setSelectedFile(null);
      setFilePreview(null);
    }
  };

  const handleClearFile = () => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setSelectedFile(null);
    setFilePreview(null);
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!content.trim() && !latex.trim() && !selectedFile) return;

    try {
      setSubmitting(true);
      const formData = new FormData();
      if (content.trim()) formData.append('content', content.trim());
      if (latex.trim()) formData.append('latex_content', latex.trim());
      if (selectedFile) {
        formData.append('media', selectedFile);
        const isVideo = selectedFile.type?.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp|mkv|avi|ogv)$/i.test(selectedFile.name);
        formData.append('post_type', isVideo ? 'video' : 'image');
      }

      const res = await API.post('/api/feed/posts/', formData);
      if (res.ok) {
        const newPost = await res.json();
        const hydratedPost = {
          ...newPost,
          author: newPost.author || user?.username,
          author_username: newPost.author_username || (typeof newPost.author === 'string' ? newPost.author : newPost.author?.username) || user?.username,
          author_id: newPost.author_id || user?.id,
          author_avatar: newPost.author_avatar || user?.avatar || null,
        };
        setPosts((prev) => [hydratedPost, ...prev]);
        setContent('');
        setLatex('');
        handleClearFile();
        setPreviewTab('write');
        showToast('✓ Post published successfully!');
      } else if (res.status === 413) {
        showToast('This video exceeds the server upload limit (max 4.5 MB on cloud serverless). Please upload a smaller or compressed clip.', 'error');
      } else {
        const err = await res.json().catch(() => ({}));
        const errMsg = err.media
          ? (Array.isArray(err.media) ? err.media.join(' ') : String(err.media))
          : (err.detail || err.content || (typeof err === 'object' && Object.values(err)[0]) || 'Unable to publish post.');
        showToast(String(errMsg), 'error');
      }
    } catch (err) {
      console.error('Failed to create post:', err);
      showToast('Network error or file upload timeout. If this is a video, ensure it is under 4.5 MB.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      // Optimistic UI update
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            const isLiked = !p.is_liked;
            return {
              ...p,
              is_liked: isLiked,
              likes_count: isLiked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1),
            };
          }
          return p;
        })
      );

      const res = await API.post(`/api/feed/posts/${postId}/like/`, {});
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, is_liked: data.liked ?? data.is_liked, likes_count: data.likes_count ?? p.likes_count }
              : p
          )
        );
      }
    } catch (err) {
      console.error('Like failed:', err);
      fetchPosts(); // Rollback on error
    }
  };

  const toggleComments = async (postId) => {
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
      return;
    }
    setActiveCommentsPostId(postId);

    if (!commentsMap[postId]) {
      try {
        const res = await API.get(`/api/feed/posts/${postId}/comments/`);
        if (res.ok) {
          const data = await res.json();
          setCommentsMap((prev) => ({
            ...prev,
            [postId]: data.results || data,
          }));
        }
      } catch (err) {
        console.error('Failed to load comments:', err);
      }
    }
  };

  const handleAddComment = async (postId) => {
    if (!commentText.trim()) return;
    try {
      setCommentSubmitting(true);
      const res = await API.post(`/api/feed/posts/${postId}/comments/`, {
        content: commentText.trim(),
      });
      if (res.ok) {
        const newComment = await res.json();
        setCommentsMap((prev) => ({
          ...prev,
          [postId]: [...(prev[postId] || []), newComment],
        }));
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p))
        );
        setCommentText('');
      }
    } catch (err) {
      console.error('Comment failed:', err);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const requestDeletePost = (post) => {
    setPostToDelete(post);
  };

  const handleConfirmDelete = async () => {
    if (!postToDelete?.id) return;
    const postId = postToDelete.id;
    setDeletingId(postId);
    try {
      const res = await API.delete(`/api/feed/posts/${postId}/`);
      if (res.ok || res.status === 204) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setPostToDelete(null);
        showToast('Post deleted successfully.', 'success');
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(`Unable to delete post: ${errData.detail || 'Permission denied'}`, 'error');
      }
    } catch (err) {
      console.error('Failed to delete post:', err);
      showToast('Network error attempting to delete post.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredPosts = posts.filter((p) => {
    const categoryValue = String(p.category?.slug || p.category || p.topic || '').toLowerCase();
    const categoryMatches = activeCategory === 'all' || !categoryValue || categoryValue.includes(activeCategory);
    if (searchTerm) {
      const authorName = p.author_username || (typeof p.author === 'string' ? p.author : p.author?.username) || '';
      const matchContent = p.content?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchLatex = p.latex_content?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchAuthor = authorName.toLowerCase().includes(searchTerm.toLowerCase());
      return categoryMatches && (matchContent || matchLatex || matchAuthor);
    }
    return categoryMatches;
  });

  return (
    <div className="feed-shell">
      <section className="feed-hero">
        <div>
          <div className="feed-kicker"><span className="material-symbols-outlined">auto_awesome</span> Math Community</div>
          <h1>Explore, share, and solve math together.</h1>
          <p>Ask questions, share homework solutions, and learn with students and friends.</p>
        </div>
        <div className="feed-hero-mark" aria-hidden="true">∫</div>
      </section>

      <div className="feed-toolbar">
        <div className="feed-search-wrap">
          <span className="material-symbols-outlined">search</span>
          <input
            className="feed-search"
            type="search"
            placeholder="Search posts, topics, or equations"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && <button className="feed-clear-search" type="button" onClick={() => setSearchTerm('')} aria-label="Clear search">close</button>}
        </div>
        <div className="feed-count"><strong>{filteredPosts.length}</strong> {filteredPosts.length === 1 ? 'post' : 'posts'}</div>
      </div>

      <div className="feed-categories" role="tablist" aria-label="Feed categories">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`feed-category ${activeCategory === cat.id ? 'is-active' : ''}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Post Composer */}
      {isAuthenticated && (
        <div
          className="card feed-composer"
          style={{
            padding: '20px',
            marginBottom: '24px',
            backgroundColor: '#18181D',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#22222A',
                border: '1px solid var(--border)',
                color: 'var(--primary)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {user?.username?.[0]?.toUpperCase() || 'M'}
            </div>
            <div className="feed-composer-body" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPreviewTab('write')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: previewTab === 'write' ? '2px solid var(--primary)' : '2px solid transparent',
                    color: previewTab === 'write' ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '13px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                  }}
                >
                  Write Post
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('preview')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: previewTab === 'preview' ? '2px solid var(--primary)' : '2px solid transparent',
                    color: previewTab === 'preview' ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '13px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                  }}
                >
                  LaTeX Preview
                </button>
              </div>

              {previewTab === 'write' ? (
                <form onSubmit={handleCreatePost} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <textarea
                    className="glass-input"
                    rows={3}
                    placeholder="Share a proof, theorem, or mathematical puzzle..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />

                  <input
                    type="text"
                    className="glass-input"
                    placeholder="LaTeX equation (e.g. \sum_{n=1}^\infty \frac{1}{n^2} = \frac{\pi^2}{6})"
                    value={latex}
                    onChange={(e) => setLatex(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: '13px' }}
                  />

                  {/* Rich Interactive Attachment Preview (Supports both Image & Video per user feedback) */}
                  {selectedFile && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '12px',
                        background: '#121216',
                        borderRadius: '10px',
                        border: '1px solid var(--primary-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)', flexShrink: 0 }}>
                            {selectedFile.type?.startsWith('video/') ? 'movie' : 'image'}
                          </span>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedFile.name}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-subtle)', flexShrink: 0 }}>
                            ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearFile}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#F87171',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11.5px',
                            flexShrink: 0,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
                          Remove
                        </button>
                      </div>

                      {/* Interactive Visual Preview */}
                      {filePreview && (
                        <div style={{ borderRadius: '8px', overflow: 'hidden', maxHeight: '240px', backgroundColor: '#0A0A0D', border: '1px solid var(--border)' }}>
                          {selectedFile.type?.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(selectedFile.name) ? (
                            <video
                              src={filePreview}
                              controls
                              playsInline
                              preload="metadata"
                              style={{ width: '100%', maxHeight: '240px', display: 'block', backgroundColor: '#000' }}
                            />
                          ) : (
                            <img
                              src={filePreview}
                              alt="Attachment preview"
                              style={{ width: '100%', maxHeight: '240px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          fontSize: '12.5px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>image</span>
                        <span>Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>

                      <label
                        title="Upload short video clip (MP4, MOV, WebM - max 4.5 MB)"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          fontSize: '12.5px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>videocam</span>
                        <span>Video</span>
                        <input
                          type="file"
                          accept="video/*,video/mp4,video/quicktime,video/webm,video/3gpp,video/x-m4v"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || (!content.trim() && !latex.trim() && !selectedFile)}
                      className="btn-primary"
                      style={{ padding: '8px 18px', fontSize: '13px' }}
                    >
                      {submitting ? 'Publishing...' : 'Publish'}
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', minHeight: '80px' }}>
                  {latex ? (
                    <MathRenderer content={latex} displayMode={true} />
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Type a formula in the LaTeX input to preview.</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feed Stream */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '36px', animation: 'spin 1s linear infinite' }}>
            progress_activity
          </span>
          <p style={{ marginTop: '12px', fontSize: '14px' }}>Loading math feed...</p>
        </div>
      ) : error ? (
        <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: '#F87171' }}>
          {error}
          <div style={{ marginTop: '12px' }}>
            <button onClick={fetchPosts} className="btn-secondary" style={{ fontSize: '13px' }}>
              Retry
            </button>
          </div>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--primary)' }}>
            post_add
          </span>
          <h3 style={{ marginTop: '12px', fontSize: '16px' }}>No posts yet</h3>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>Be the first to share a theorem or mathematical thought!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {newPostsAvailable > 0 && (
            <button
              onClick={() => {
                fetchPosts();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{
                width: '100%',
                padding: '10px 16px',
                backgroundColor: 'var(--primary-subtle)',
                border: '1px solid var(--primary-border)',
                borderRadius: '10px',
                color: 'var(--primary)',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(229, 169, 60, 0.2)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>bolt</span>
              <span>{newPostsAvailable} new post{newPostsAvailable > 1 ? 's' : ''} &bull; Click to update feed</span>
            </button>
          )}
          {filteredPosts.map((post) => {
            const authorDisplay = post.author_username || (typeof post.author === 'string' ? post.author : post.author?.username) || 'Scholar';
            const currentUserId = API.getCurrentUserId() || user?.id;
            const isAuthor = Boolean(
              currentUserId && (
                Number(post.author_id) === Number(currentUserId) ||
                (user?.username && (post.author === user.username || post.author_username === user.username))
              )
            );

            return (
              <article key={post.id} className="glass-card feed-post" style={{ padding: '20px' }}>
                {/* Post Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--surface-input)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                        fontWeight: 600,
                        fontSize: '13px',
                        overflow: 'hidden',
                      }}
                    >
                      {post.author_avatar ? (
                        <img src={resolveMediaUrl(post.author_avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        authorDisplay?.[0]?.toUpperCase() || 'M'
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
                        {authorDisplay}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                        {post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Just now'}
                      </div>
                    </div>
                  </div>

                  {/* Delete Button for Post Author */}
                  {isAuthor && (
                    <button
                      onClick={() => requestDeletePost(post)}
                      disabled={deletingId === post.id}
                      title="Delete post"
                      style={{
                        background: 'transparent',
                        border: '1px solid transparent',
                        color: 'var(--text-subtle)',
                        cursor: deletingId === post.id ? 'not-allowed' : 'pointer',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (deletingId !== post.id) {
                          e.currentTarget.style.color = '#EF4444';
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                          e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-subtle)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                        {deletingId === post.id ? 'hourglass_empty' : 'delete'}
                      </span>
                      <span>{deletingId === post.id ? 'Deleting...' : 'Delete'}</span>
                    </button>
                  )}
                </div>

                {/* Post Body with Inline LaTeX Rendering */}
                {post.content && (
                  <div style={{ fontSize: '15px', color: 'var(--text)', lineHeight: 1.6, marginBottom: '12px' }}>
                    <MathRenderer content={post.content} />
                  </div>
                )}

              {/* LaTeX Formula */}
              {post.latex_content && (
                <div style={{ margin: '14px 0' }}>
                  <div className="math-blackboard">
                    <MathRenderer content={post.latex_content} displayMode={true} />
                  </div>
                </div>
              )}

              {/* Media Attachment */}
              {post.media && (
                <div style={{ margin: '14px 0', borderRadius: '12px', overflow: 'hidden', maxHeight: '480px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}>
                  {post.post_type === 'video' || /\.(mp4|webm|ogg|mov|m4v|3gp)$/i.test(post.media) ? (
                    <video
                      src={resolveMediaUrl(post.media)}
                      controls
                      playsInline
                      preload="metadata"
                      style={{ width: '100%', maxHeight: '480px', display: 'block', backgroundColor: '#000' }}
                    />
                  ) : (
                    <img
                      src={resolveMediaUrl(post.media)}
                      alt="Post attachment"
                      style={{ width: '100%', maxHeight: '480px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                      loading="lazy"
                    />
                  )}
                </div>
              )}

              {/* Post Actions: Like & Comment */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  marginTop: '12px',
                }}
              >
                <button
                  onClick={() => handleLike(post.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: post.is_liked ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: '18px',
                      fontVariationSettings: post.is_liked ? "'FILL' 1" : "'FILL' 0",
                    }}
                  >
                    favorite
                  </span>
                  {post.likes_count || 0}
                </button>

                <button
                  onClick={() => toggleComments(post.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: activeCommentsPostId === post.id ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    mode_comment
                  </span>
                  {post.comments_count || 0}
                </button>
              </div>

              {/* Expandable Comments Drawer */}
              {activeCommentsPostId === post.id && (
                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {/* Add Comment Input */}
                  {isAuthenticated ? (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                      <input
                        type="text"
                        className="glass-input"
                        placeholder="Write a comment..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment(post.id);
                        }}
                        style={{ fontSize: '13px' }}
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        disabled={commentSubmitting || !commentText.trim()}
                        className="btn-primary"
                        style={{ padding: '6px 14px', fontSize: '13px' }}
                      >
                        {commentSubmitting ? '...' : 'Reply'}
                      </button>
                    </div>
                  ) : (
                    <p style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '12px' }}>
                      Sign in to participate in the discussion.
                    </p>
                  )}

                  {/* Comment List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(commentsMap[post.id] || []).length === 0 ? (
                      <span style={{ fontSize: '13px', color: 'var(--text-subtle)' }}>No comments yet.</span>
                    ) : (
                      commentsMap[post.id].map((c) => (
                        <div
                          key={c.id}
                          style={{
                            padding: '10px 14px',
                            background: 'rgba(0, 0, 0, 0.25)',
                            borderRadius: '10px',
                            fontSize: '13px',
                          }}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '2px', fontSize: '12px' }}>
                            {c.author_username || 'Peer'}
                          </div>
                          <div style={{ color: 'var(--text)' }}>{c.content}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </article>
            );
          })}
        </div>
      )}

      {/* Toast Notification Banner */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 99999,
            backgroundColor: '#1E1E26',
            color: toast.type === 'error' ? '#F87171' : 'var(--primary, #E5A93C)',
            border: `1px solid ${toast.type === 'error' ? 'rgba(239, 68, 68, 0.35)' : 'var(--primary-border, rgba(229, 169, 60, 0.35))'}`,
            padding: '12px 18px',
            borderRadius: '12px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65), 0 0 20px rgba(0, 0, 0, 0.4)',
            fontSize: '13.5px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'fadeInScale 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            maxWidth: '90vw',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
            {toast.type === 'error' ? 'error' : 'check_circle'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(postToDelete)}
        onClose={() => {
          if (!deletingId) setPostToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        confirmText="Delete Post"
        cancelText="Keep Post"
        variant="danger"
        isLoading={Boolean(deletingId)}
      />
    </div>
  );
}

export default FeedPage;
