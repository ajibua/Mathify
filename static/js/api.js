// ── Mathify API ────────────────────────────────────────────────────────────────
// Shared authentication, token management, and authenticated fetch utility.
// Import this file in every template via: <script src="{% static 'js/api.js' %}"></script>

const API = {
  getAccess:  () => localStorage.getItem('mx_access'),
  getRefresh: () => localStorage.getItem('mx_refresh'),

  getCurrentUserId() {
    const token = this.getAccess();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.user_id;
    } catch (e) {
      return null;
    }
  },

  setTokens(a, r) {
    localStorage.setItem('mx_access', a);
    if (r) localStorage.setItem('mx_refresh', r);
  },

  clearTokens() {
    localStorage.removeItem('mx_access');
    localStorage.removeItem('mx_refresh');
  },

  async refresh() {
    const r = this.getRefresh();
    if (!r) return false;
    const res = await fetch('/api/auth/token/refresh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: r })
    });
    if (res.ok) { const d = await res.json(); this.setTokens(d.access); return true; }
    return false;
  },

  async req(url, opts = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.getAccess() ? { 'Authorization': `Bearer ${this.getAccess()}` } : {}),
      ...(opts.headers || {})
    };
    let res = await fetch(url, { ...opts, headers });
    if (res.status === 401) {
      const ok = await this.refresh();
      if (ok) {
        headers['Authorization'] = `Bearer ${this.getAccess()}`;
        res = await fetch(url, { ...opts, headers });
      } else { this.clearTokens(); window.location.href = '/login/'; return null; }
    }
    return res;
  },

  requireAuth() { if (!this.getAccess()) window.location.href = '/login/'; },

  logout() {
    this.clearTokens();
    localStorage.removeItem('mx_username');
    window.location.href = '/login/';
  }
};
