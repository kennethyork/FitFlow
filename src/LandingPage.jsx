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
          runs in your browser, with optional public food lookups when you
          search. No accounts, no subscriptions, and your personal tracking
          data stays on your device.
        </p>
        <div className="landing-cta-row">
          <button className="landing-cta" onClick={onLaunch}>
            Launch App &rarr;
          </button>
          <a
            href="https://expo.dev/artifacts/eas/hfbzJgTBDg46wijNQHUqKQ.apk"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-cta landing-cta-android"
          >
            <svg width="20" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.523 2.226l1.392-2.415a.45.45 0 00-.784-.442L16.68 1.84A8.68 8.68 0 0012 .814c-1.67 0-3.237.38-4.68 1.026L5.87-.63a.45.45 0 00-.784.442L6.477 2.226A9.18 9.18 0 002.64 9.6h18.72a9.18 9.18 0 00-3.837-7.374zM7.2 6.72a1.08 1.08 0 110-2.16 1.08 1.08 0 010 2.16zm9.6 0a1.08 1.08 0 110-2.16 1.08 1.08 0 010 2.16zM2.64 10.56v8.88a1.44 1.44 0 001.44 1.44H5.52v3.36a1.68 1.68 0 103.36 0v-3.36h2.16v3.36a1.68 1.68 0 103.36 0v-3.36h1.44a1.44 1.44 0 001.44-1.44v-8.88H2.64zm-2.88.96a1.68 1.68 0 00-1.68 1.68v5.28a1.68 1.68 0 103.36 0v-5.28a1.68 1.68 0 00-1.68-1.68zm20.16 0a1.68 1.68 0 00-1.68 1.68v5.28a1.68 1.68 0 103.36 0v-5.28a1.68 1.68 0 00-1.68-1.68z"/></svg>
            Download for Android
          </a>
        </div>
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
