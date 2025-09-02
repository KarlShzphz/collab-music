

/**
 * Theme toggle component that switches between light and dark themes
 * @returns A button component for toggling application theme
 */
export function ThemeToggle() {
  const isDarkTheme = () => {
    return typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
  };

  const handleThemeToggle = () => {
    const nextTheme = isDarkTheme() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('theme', nextTheme);
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <button id="theme-toggle-button" className="themeToggle" aria-label="Toggle theme" onClick={handleThemeToggle}>
      <span id="theme-toggle-knob" className="themeToggle__knob" />
      <svg id="theme-toggle-sun-icon" className="themeToggle__icon themeToggle__icon--sun" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.8 1.8-1.8zM1 13h3v-2H1v2zm10 10h2v-3h-2v3zm9.83-18.16l-1.79-1.79-1.8 1.79 1.8 1.8 1.79-1.8zM17 13h3v-2h-3v2zM4.22 19.78l1.79 1.79 1.8-1.79-1.8-1.8-1.79 1.8zM11 7a4 4 0 100 8 4 4 0 000-8zm8 12.78l1.79-1.8-1.79-1.79-1.8 1.79 1.8 1.8zM11 1v3h2V1h-2z" />
      </svg>
      <svg id="theme-toggle-moon-icon" className="themeToggle__icon themeToggle__icon--moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    </button>
  );
}

export default ThemeToggle;


