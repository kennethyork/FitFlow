import { useState, useEffect } from 'react';
import { apiUrl } from './api';

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login'); // login | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('free');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState(null); // { id, question }
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  // Fetch CAPTCHA when switching to signup
  const loadCaptcha = async () => {
    try {
      const res = await fetch(apiUrl('/api/auth/captcha'));
      const data = await res.json();
      setCaptcha(data);
      setCaptchaAnswer('');
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (mode === 'signup') loadCaptcha();
  }, [mode]);

  const plans = [
    { id: 'free', name: 'Free', price: '$0', period: '', desc: '5 meals/day · 3 habits · 3 coach chats' },
    { id: 'pro', name: 'Pro', price: '$4.99', period: '/mo', desc: '50 meals/day · 20 habits · Meal Suggestions · Favorites' },
    { id: 'premium', name: 'Premium', price: '$9.99', period: '/mo', desc: '200 meals/day · 100 habits · Meal Suggestions · Custom workouts' },
    { id: 'unlimited', name: 'Unlimited', price: '$19.99', period: '/mo', desc: 'No limits · Meal Suggestions · Weekly Reports · Family sharing' },
  ];

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? apiUrl('/api/auth/login') : apiUrl('/api/auth/signup');
      const body = mode === 'login'
        ? { email, password }
        : { email, password, name, tier: selectedPlan, captchaId: captcha?.id, captchaAnswer };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        if (mode === 'signup') loadCaptcha(); // refresh CAPTCHA on error
        return;
      }
      onAuth(data.token, data.user, mode === 'signup');
    } catch {
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">🌿</div>
        <h1 className="auth-title">FitFlow</h1>
        <p className="auth-subtitle">Your personal health journey</p>

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <input
              className="input"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          {mode === 'signup' && (
            <div className="plan-picker">
              <label className="plan-picker-label">Choose your plan</label>
              <div className="plan-picker-options">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`plan-option ${selectedPlan === p.id ? 'selected' : ''}`}
                    onClick={() => setSelectedPlan(p.id)}
                  >
                    <span className="plan-option-name">{p.name}</span>
                    <span className="plan-option-price">{p.price}<span>{p.period}</span></span>
                    <span className="plan-option-desc">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <input
            className="input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {mode === 'signup' && captcha && (
            <div className="captcha-box">
              <label className="captcha-label">🤖 Prove you're human</label>
              <p className="captcha-question">{captcha.question}</p>
              <input
                className="input"
                type="number"
                placeholder="Your answer"
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                required
              />
              <button type="button" className="captcha-refresh" onClick={loadCaptcha}>↻ New question</button>
            </div>
          )}
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}
          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button className="auth-link" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
            {mode === 'login' ? 'Sign up free' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
}
