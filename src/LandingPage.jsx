export default function LandingPage({ onLaunch, theme, setTheme }) {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-nav-brand">🌿 FitFlow</div>
        <div className="landing-nav-right">
          <div className="theme-toggle">
            <button className={`theme-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')} title="Light mode" aria-label="Switch to light mode">☀️</button>
            <button className={`theme-btn ${theme === 'auto' ? 'active' : ''}`} onClick={() => setTheme('auto')} title="Auto (system)" aria-label="Switch to auto (system) mode">🔄</button>
            <button className={`theme-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')} title="Dark mode" aria-label="Switch to dark mode">🌙</button>
          </div>
          <a
            href="https://github.com/kennethyork/FitFlow"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-nav-link"
          >
            GitHub
          </a>
        </div>
      </nav>

      <section className="landing-hero">
        <h1 className="landing-title">
          Your Health,<br />
          <span className="landing-accent">Your&nbsp;Data,</span><br />
          Your&nbsp;Device.
        </h1>
        <p className="landing-subtitle">
          FitFlow is a free, open-source fitness &amp; nutrition tracker that
          runs primarily in your browser. No accounts, no subscriptions, and
          your personal tracking data stays on your device.
        </p>
        <button className="landing-cta" onClick={onLaunch}>
          Launch App &rarr;
        </button>
        <p className="landing-note">No sign-up required. Your tracking data stays on your device.</p>
      </section>

      <section className="landing-features">
        <div className="landing-feature-card">
          <span className="landing-feature-icon">🍽️</span>
          <h3>Live Food Search</h3>
          <p>
            Search Open Food Facts directly from the app for branded and
            packaged foods without downloading a huge local database first.
          </p>
        </div>
        <div className="landing-feature-card">
          <span className="landing-feature-icon">💬</span>
          <h3>AI Coach</h3>
          <p>
            On-device coaching that adapts to your goals, habits, and progress
            — no API key needed.
          </p>
        </div>
        <div className="landing-feature-card">
          <span className="landing-feature-icon">🎬</span>
          <h3>Workout Videos</h3>
          <p>
            9 categories from chair exercises to advanced HIIT, streamed free
            from YouTube RSS feeds.
          </p>
        </div>
        <div className="landing-feature-card">
          <span className="landing-feature-icon">✅</span>
          <h3>Smart Habits</h3>
          <p>
            Auto-generated daily, weekly, and monthly tasks tailored to your
            fitness goal.
          </p>
        </div>
        <div className="landing-feature-card">
          <span className="landing-feature-icon">📊</span>
          <h3>Macro Tracking</h3>
          <p>
            Calories, protein, carbs, and fat with visual breakdowns and
            weekly trend charts.
          </p>
        </div>
        <div className="landing-feature-card">
          <span className="landing-feature-icon">🔒</span>
          <h3>100% Private</h3>
          <p>
            Your logs, profile, habits, and photos stay in your browser via
            IndexedDB. Food lookups use a public food database only when you
            search.
          </p>
        </div>
      </section>

      <section className="landing-tech">
        <h2>Built with</h2>
        <div className="landing-tech-pills">
          <span className="landing-pill">React</span>
          <span className="landing-pill">RxDB</span>
          <span className="landing-pill">Vite</span>
          <span className="landing-pill">Open Food Facts</span>
          <span className="landing-pill">IndexedDB</span>
          <span className="landing-pill">GitHub Pages</span>
        </div>
      </section>

      <footer className="landing-footer">
        <p>
          MIT License &middot;{' '}
          <a
            href="https://github.com/kennethyork/FitFlow"
            target="_blank"
            rel="noopener noreferrer"
          >
            Source on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
