import { useState } from 'react';

const GOALS = [
  { id: 'lose', icon: '🔥', title: 'Lose Weight', desc: 'Burn fat and get lean' },
  { id: 'maintain', icon: '⚖️', title: 'Maintain', desc: 'Stay at your current weight' },
  { id: 'gain', icon: '💪', title: 'Build Muscle', desc: 'Gain strength and mass' },
];

const ACTIVITY_LEVELS = [
  { id: 'sedentary', icon: '🪑', title: 'Sedentary', desc: 'Little to no exercise' },
  { id: 'light', icon: '🚶', title: 'Lightly Active', desc: '1-3 days/week' },
  { id: 'moderate', icon: '🏃', title: 'Moderately Active', desc: '3-5 days/week' },
  { id: 'active', icon: '🏋️', title: 'Very Active', desc: '6-7 days/week' },
];

const CALORIE_PRESETS = {
  lose:     { sedentary: 1400, light: 1500, moderate: 1600, active: 1800 },
  maintain: { sedentary: 1600, light: 1800, moderate: 2000, active: 2200 },
  gain:     { sedentary: 2000, light: 2200, moderate: 2400, active: 2800 },
};

export default function OnboardingScreen({ token, onComplete }) {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState('');
  const [activity, setActivity] = useState('');
  const [saving, setSaving] = useState(false);

  const suggestedCals = CALORIE_PRESETS[goal]?.[activity] || 1800;

  const finish = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/auth/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          goalType: goal,
          activityLevel: activity,
          calorieGoal: suggestedCals,
        }),
      });
      const data = await res.json();
      onComplete(data.token, data.user);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="onboarding-screen">
      <div className="onboarding-card">
        <div className="onboarding-logo">🌿</div>

        {/* Progress dots */}
        <div className="onboarding-dots">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
          ))}
        </div>

        {/* Step 0: Goal */}
        {step === 0 && (
          <div className="onboarding-step">
            <h2>Welcome to FitFlow</h2>
            <p className="onboarding-sub">What's your goal? We'll tailor your daily plan around this.</p>
            <div className="onboarding-options">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  className={`onboarding-option ${goal === g.id ? 'selected' : ''}`}
                  onClick={() => setGoal(g.id)}
                >
                  <span className="opt-icon">{g.icon}</span>
                  <span className="opt-title">{g.title}</span>
                  <span className="opt-desc">{g.desc}</span>
                </button>
              ))}
            </div>
            <button className="btn btn-primary btn-full" onClick={() => setStep(1)} disabled={!goal}>
              Continue
            </button>
          </div>
        )}

        {/* Step 1: Activity Level */}
        {step === 1 && (
          <div className="onboarding-step">
            <h2>How active are you?</h2>
            <p className="onboarding-sub">This helps us set the right calorie target.</p>
            <div className="onboarding-options">
              {ACTIVITY_LEVELS.map((a) => (
                <button
                  key={a.id}
                  className={`onboarding-option ${activity === a.id ? 'selected' : ''}`}
                  onClick={() => setActivity(a.id)}
                >
                  <span className="opt-icon">{a.icon}</span>
                  <span className="opt-title">{a.title}</span>
                  <span className="opt-desc">{a.desc}</span>
                </button>
              ))}
            </div>
            <div className="onboarding-nav">
              <button className="btn btn-secondary" onClick={() => setStep(0)}>Back</button>
              <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!activity}>Continue</button>
            </div>
          </div>
        )}

        {/* Step 2: Summary */}
        {step === 2 && (
          <div className="onboarding-step">
            <h2>You're all set!</h2>
            <p className="onboarding-sub">Here's your personalized plan:</p>
            <div className="onboarding-summary">
              <div className="summary-item">
                <span className="summary-label">Goal</span>
                <span className="summary-value">{GOALS.find((g) => g.id === goal)?.title}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Activity</span>
                <span className="summary-value">{ACTIVITY_LEVELS.find((a) => a.id === activity)?.title}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Daily Calories</span>
                <span className="summary-value cal-value">{suggestedCals} kcal</span>
              </div>
            </div>
            <div className="onboarding-nav">
              <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button className="btn btn-primary" onClick={finish} disabled={saving}>
                {saving ? 'Saving...' : 'Start My Journey 🚀'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
