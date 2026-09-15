export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export const API = {
  _refreshPromise: null, // Dedupes concurrent refresh calls

  getAccess: () => localStorage.getItem('mx_access'),
  getRefresh: () => localStorage.getItem('mx_refresh'),

  setTokens(access, refresh) {
    if (access) localStorage.setItem('mx_access', access);
    if (refresh) localStorage.setItem('mx_refresh', refresh);
  },

  clearTokens() {
    localStorage.removeItem('mx_access');
    localStorage.removeItem('mx_refresh');
    localStorage.removeItem('mx_user');
  },

  getCurrentUserId() {
    const token = this.getAccess();
    if (!token) return null;
    try {
      const base64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
      if (!base64) return null;
      const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (char) => char.charCodeAt(0));
      const payload = JSON.parse(new TextDecoder().decode(bytes));
      return payload.user_id;
    } catch {
      return null;
    }
  },

  async refresh() {
    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    this._refreshPromise = (async () => {
      const refresh = this.getRefresh();
      if (!refresh) return false;
      try {
        const res = await fetch(`${API_BASE}/api/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        });
        if (res.ok) {
          const data = await res.json();
          this.setTokens(data.access, data.refresh);
          return true;
        }
      } catch {
        // network failure
      }
      return false;
    })();

    try {
      return await this._refreshPromise;
    } finally {
      this._refreshPromise = null;
    }
  },

  async req(endpoint, opts = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const headers = { ...(opts.headers || {}) };

    const token = this.getAccess();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const hasContentType = Object.keys(headers).some(
      (h) => h.toLowerCase() === 'content-type'
    );
    if (!(opts.body instanceof FormData) && !hasContentType) {
      headers['Content-Type'] = 'application/json';
    }

    const isPrivateRequest = Boolean(token || headers.Authorization || opts.method && opts.method !== 'GET');
    if (isPrivateRequest) {
      headers['Cache-Control'] = 'no-store';
    }

    try {
      let res = await fetch(url, {
        ...opts,
        cache: isPrivateRequest ? 'no-store' : opts.cache,
        headers,
      });

      if (res.status === 401 && this.getRefresh()) {
        const ok = await this.refresh();
        if (ok) {
          headers['Authorization'] = `Bearer ${this.getAccess()}`;
          res = await fetch(url, { ...opts, cache: 'no-store', headers });

          if (res.status === 401) {
            this.clearTokens();
            window.dispatchEvent(new Event('auth:unauthorized'));
          }
        } else {
          this.clearTokens();
          window.dispatchEvent(new Event('auth:unauthorized'));
        }
      }

      if (res.status === 429) {
        const retryAfterHeader = res.headers.get('Retry-After');
        window.dispatchEvent(new CustomEvent('api:rate-limited', {
          detail: {
            endpoint,
            retryAfter: retryAfterHeader ? parseInt(retryAfterHeader, 10) : null,
          },
        }));
      }

      return res;
    } catch (err) {
      console.error('API request error:', err);
      throw err;
    }
  },

  async get(endpoint, opts = {}) {
    return this.req(endpoint, { ...opts, method: 'GET' });
  },

  async post(endpoint, body, opts = {}) {
    const isForm = body instanceof FormData;
    return this.req(endpoint, {
      ...opts,
      method: 'POST',
      body: isForm ? body : JSON.stringify(body),
    });
  },

  async put(endpoint, body, opts = {}) {
    const isForm = body instanceof FormData;
    return this.req(endpoint, {
      ...opts,
      method: 'PUT',
      body: isForm ? body : JSON.stringify(body),
    });
  },

  async patch(endpoint, body, opts = {}) {
    const isForm = body instanceof FormData;
    return this.req(endpoint, {
      ...opts,
      method: 'PATCH',
      body: isForm ? body : JSON.stringify(body),
    });
  },

  async delete(endpoint, opts = {}) {
    return this.req(endpoint, { ...opts, method: 'DELETE' });
  },
};

export function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      if (trimmed.includes('127.0.0.1:8000') || trimmed.includes('localhost:8000')) {
        const path = trimmed.replace(/^https?:\/\/(127\.0\.0\.1|localhost):8000/, '');
        return API_BASE ? `${API_BASE.replace(/\/+$/, '')}${path}` : `http://${window.location.hostname}:8000${path}`;
      }
    }
    return trimmed;
  }

  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (API_BASE) {
    return `${API_BASE.replace(/\/+$/, '')}${cleanPath}`;
  }

  return cleanPath;
}
