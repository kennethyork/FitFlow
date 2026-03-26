import { useState, useEffect } from 'react';

export default function PricingScreen({ currentTier, token, onUpgrade, onClose }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/tiers').then((r) => r.json()).then((d) => setPlans(d.plans || [])).catch(() => {});
  }, []);

  const upgrade = async (tier) => {
    if (tier === currentTier) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/upgrade', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (res.ok) onUpgrade(data.token, data.user);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pricing-overlay">
      <div className="pricing-sheet">
        <div className="pricing-header">
          <h2>Choose Your Plan</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="pricing-grid">
          {plans.map((plan) => (
            <div key={plan.id} className={`pricing-card ${plan.id === currentTier ? 'current' : ''} ${plan.id === 'pro' ? 'popular' : ''}`}>
              {plan.id === 'pro' && <div className="popular-badge">Most Popular</div>}
              <div className="plan-name">{plan.name}</div>
              <div className="plan-price">
                {plan.price === 0 ? 'Free' : (
                  <><span className="amount">${plan.price}</span><span className="period">/{plan.period}</span></>
                )}
              </div>
              <ul className="plan-features">
                {plan.features.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
              <button
                className={`btn btn-full ${plan.id === currentTier ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => upgrade(plan.id)}
                disabled={plan.id === currentTier || loading}
              >
                {plan.id === currentTier ? 'Current Plan' : plan.price === 0 ? 'Downgrade' : 'Upgrade'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
