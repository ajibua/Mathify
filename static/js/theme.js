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
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (!toggleBtn) return;
  
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
});
