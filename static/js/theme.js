(function() {
  let theme = 'dark';
  try {
    theme = localStorage.getItem('theme') || 'dark';
  } catch (e) {
    // Fallback if localStorage is sandboxed/disabled
  }
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  // Load dynamic header profile avatar if logged in
  if (window.API && typeof API.getAccess === 'function' && API.getAccess()) {
    API.req('/api/accounts/me/profile/')
      .then(res => {
        if (res && res.ok) return res.json();
      })
      .then(profile => {
        if (profile && profile.avatar) {
          document.querySelectorAll('[data-profile-avatar]').forEach(img => {
            img.src = profile.avatar;
          });
        }
      })
      .catch(err => console.error('Error loading header avatar:', err));
  }

  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) {
    const updateIcon = (isDark) => {
      toggleBtn.textContent = isDark ? 'light_mode' : 'dark_mode';
    };
    
    const isDark = document.documentElement.classList.contains('dark');
    updateIcon(isDark);
    
    toggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      try {
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
      } catch (e) {
        // Ignore security errors in sandboxed environments
      }
      updateIcon(isDark);
    });
  }
});
