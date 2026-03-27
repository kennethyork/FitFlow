import { useState } from 'react';
import * as db from './db.js';

export default function AccountScreen({ user, onUpdate, onLogout }) {
  const [name, setName] = useState(user?.name || '');
  const [goalType, setGoalType] = useState(user?.goalType || 'lose');
  const [activityLevel, setActivityLevel] = useState(user?.activityLevel || 'moderate');
  const [calorieGoal, setCalorieGoal] = useState(user?.calorieGoal || 1800);

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const showMsg = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3000); };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const profile = await db.saveProfile({ name: name.trim(), goalType, activityLevel, calorieGoal: Number(calorieGoal), onboarded: true });
      onUpdate(profile);
      showMsg('Profile saved!');
    } catch { showMsg('Save failed', false); }
    finally { setSaving(false); }
  };

  const exportData = async () => {
    try {
      const [profile, logs, habits, weights, favorites, chats] = await Promise.all([
        db.getProfile(),
        db.getFoodLogs(),
        db.getHabits(),
        db.getWeightLogs(),
        db.getFavoriteMeals(),
        db.getChatMessages(),
      ]);
      const data = { profile, logs, habits, weights, favorites, chats, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fitflow-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showMsg('Data exported!');
    } catch { showMsg('Export failed', false); }
  };

  const resetAllData = async () => {
    setSaving(true);
    try {
      await db.clearAllData();
      showMsg('All data cleared!');
      onLogout();
    } catch { showMsg('Reset failed', false); }
    finally { setSaving(false); }
  };

  return (
    <div className="account-screen">
      {msg && <div className={`account-toast ${msg.ok ? 'success' : 'error'}`}>{msg.text}</div>}

      {/* Profile Info */}
      <div className="card">
        <div className="card-title">Profile</div>
        <div className="account-field">
          <label>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <button className="btn btn-primary btn-full" onClick={saveProfile} disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {/* Goals */}
      <div className="card">
        <div className="card-title">Goals & Activity</div>
        <div className="account-field">
          <label>Goal</label>
          <div className="account-pills">
            {['lose', 'maintain', 'gain'].map((g) => (
              <button key={g} className={`pill${goalType === g ? ' active' : ''}`} onClick={() => setGoalType(g)}>
                {g === 'lose' ? '🔥 Lose Weight' : g === 'maintain' ? '⚖️ Maintain' : '💪 Gain Muscle'}
              </button>
            ))}
          </div>
        </div>
        <div className="account-field">
          <label>Activity Level</label>
          <div className="account-pills">
            {['sedentary', 'light', 'moderate', 'active'].map((a) => (
              <button key={a} className={`pill${activityLevel === a ? ' active' : ''}`} onClick={() => setActivityLevel(a)}>
                {a === 'sedentary' ? '🪑 Sedentary' : a === 'light' ? '🚶 Light' : a === 'moderate' ? '🏃 Moderate' : '⚡ Active'}
              </button>
            ))}
          </div>
        </div>
        <div className="account-field">
          <label>Daily Calorie Goal</label>
          <input className="input" type="number" value={calorieGoal} onChange={(e) => setCalorieGoal(e.target.value)} min="800" max="10000" />
        </div>
        <button className="btn btn-primary btn-full" onClick={saveProfile} disabled={saving}>
          {saving ? 'Saving...' : 'Save Goals'}
        </button>
      </div>

      {/* Data Management */}
      <div className="card">
        <div className="card-title">Your Data</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 12px' }}>
          All data is stored locally on this device using IndexedDB. Nothing is sent to any server.
        </p>
        <button className="btn btn-secondary btn-full" onClick={exportData} style={{ marginBottom: 8 }}>
          📦 Export All Data (JSON)
        </button>
        <button className="btn btn-full" onClick={onLogout} style={{ background: 'var(--border-light)', color: 'var(--text-primary)' }}>
          🚪 Log Out
        </button>
      </div>

      {/* Danger Zone */}
      <div className="card account-danger">
        <div className="card-title">Danger Zone</div>
        <p className="account-danger-text">Permanently delete all local data. This cannot be undone.</p>
        {!showResetConfirm ? (
          <button className="btn btn-full account-delete-btn" onClick={() => setShowResetConfirm(true)}>
            Reset All Data
          </button>
        ) : (
          <div className="account-delete-confirm">
            <p style={{ color: '#e74c3c', fontSize: 13, margin: '0 0 8px' }}>Are you sure? This will delete all your food logs, habits, weight history, and chat messages.</p>
            <div className="account-delete-actions">
              <button className="btn btn-full account-delete-btn" onClick={resetAllData} disabled={saving}>
                {saving ? 'Deleting...' : 'Yes, Reset Everything'}
              </button>
              <button className="btn btn-full" onClick={() => setShowResetConfirm(false)} style={{ background: 'var(--border-light)', color: 'var(--text-primary)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
