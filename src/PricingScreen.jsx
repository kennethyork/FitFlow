import { useState, useEffect } from 'react';
import { apiUrl } from './api';

export default function PricingScreen({ currentTier, token, onUpgrade, onClose }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/tiers')).then((r) => r.json()).then((d) => setPlans(d.plans || [])).catch(() => {});
  }, []);

  // Check for PayPal return (capture pending payment)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paypalCapture = params.get('paypal_capture');
    const paypalToken = params.get('token'); // PayPal adds this
    const tier = params.get('tier');
    if (paypalCapture === 'pending' && paypalToken && tier) {
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      // Capture the payment
      setLoading(true);
      fetch(apiUrl('/api/paypal/capture'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: paypalToken }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.token && data.user) onUpgrade(data.token, data.user);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [token, onUpgrade]);

  const upgrade = async (tier, paymentMethod = 'paypal') => {
    if (tier === currentTier) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/upgrade'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier, paymentMethod }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      if (res.ok && data.token) onUpgrade(data.token, data.user);
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
              {plan.id === currentTier ? (
                <button className="btn btn-full btn-secondary" disabled>Current Plan</button>
              ) : plan.price === 0 ? (
                <button
                  className="btn btn-full btn-primary"
                  onClick={() => upgrade(plan.id)}
                  disabled={loading}
                >
                  Downgrade
                </button>
              ) : (
                <div className="payment-buttons">
                  <button
                    className="btn btn-full btn-paypal"
                    onClick={() => upgrade(plan.id, 'paypal')}
                    disabled={loading}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{marginRight: 6, verticalAlign: 'middle'}}>
                      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.22A.641.641 0 0 1 5.577 1.7h6.845c2.283 0 3.87.741 4.562 2.145.636 1.29.524 2.926-.216 4.55-.03.065-.06.126-.092.188-.02.038-.04.074-.063.11a6.42 6.42 0 0 1-.57.81c-.86 1.02-2.077 1.646-3.593 1.87a12.2 12.2 0 0 1-1.656.1H9.1a.64.64 0 0 0-.633.52l-.89 5.634a.641.641 0 0 1-.633.52h-.003l.136-.81Z"/>
                      <path d="M18.452 7.532a5.58 5.58 0 0 1-.347.89c-1.09 2.263-3.342 3.192-6.164 3.192h-.503a.776.776 0 0 0-.768.657l-.641 4.063-.181 1.15a.411.411 0 0 0 .406.476h2.852a.564.564 0 0 0 .558-.48l.023-.118.44-2.794.029-.156a.564.564 0 0 1 .558-.48h.353c2.278 0 4.062-.926 4.583-3.604.218-1.12.105-2.053-.47-2.712a2.27 2.27 0 0 0-.728-.483Z"/>
                    </svg>
                    Pay with PayPal
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
