import { useState } from 'react';
import { apiUrl } from './api';

export default function AccountScreen({ user, token, onUpdate, onLogout, onShowPricing }) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [goalType, setGoalType] = useState(user?.goalType || 'lose');
  const [activityLevel, setActivityLevel] = useState(user?.activityLevel || 'moderate');
  const [calorieGoal, setCalorieGoal] = useState(user?.calorieGoal || 1800);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const hdrs = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const showMsg = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3000); };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/auth/profile'), {
        method: 'PUT', headers: hdrs,
        body: JSON.stringify({ name: name.trim(), email: email.trim(), goalType, activityLevel, calorieGoal: Number(calorieGoal) }),
      });
      const data = await res.json();
      if (res.ok) { onUpdate(data.token, data.user); showMsg('Profile saved!'); }
      else showMsg(data.error || 'Save failed', false);
    } catch { showMsg('Network error', false); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) return showMsg('Fill in both password fields', false);
    if (newPassword.length < 6) return showMsg('New password must be 6+ characters', false);
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/auth/password'), {
        method: 'PUT', headers: hdrs,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) { showMsg('Password changed!'); setCurrentPassword(''); setNewPassword(''); }
      else showMsg(data.error || 'Change failed', false);
    } catch { showMsg('Network error', false); }
    finally { setSaving(false); }
  };

  const deleteAccount = async () => {
    if (!deletePassword) return showMsg('Enter your password to confirm', false);
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/auth/account'), {
        method: 'DELETE', headers: hdrs,
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (res.ok) onLogout();
      else showMsg(data.error || 'Delete failed', false);
    } catch { showMsg('Network error', false); }
    finally { setSaving(false); }
  };

  const tierLabel = { free: 'Free', pro: 'Pro', premium: 'Premium', unlimited: 'Unlimited' };

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
        <div className="account-field">
          <label>Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" />
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

      {/* Plan */}
      <div className="card">
        <div className="card-title">Subscription</div>
        <div className="account-plan-row">
          <div>
            <div className="account-plan-name">{tierLabel[user?.tier] || 'Free'}</div>
            <div className="account-plan-sub">Current plan</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={onShowPricing}>
            {user?.tier === 'free' ? 'Upgrade' : 'Change Plan'}
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="card">
        <div className="card-title">Change Password</div>
        <div className="account-field">
          <label>Current Password</label>
          <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••" />
        </div>
        <div className="account-field">
          <label>New Password</label>
          <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
        </div>
        <button className="btn btn-primary btn-full" onClick={changePassword} disabled={saving}>
          {saving ? 'Updating...' : 'Update Password'}
        </button>
      </div>

      {/* Account Info */}
      <div className="card">
        <div className="card-title">Account</div>
        <div className="account-info-row">
          <span className="account-info-label">Member since</span>
          <span>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</span>
        </div>
        <div className="account-info-row">
          <span className="account-info-label">User ID</span>
          <span>#{user?.id}</span>
        </div>
        <button className="btn btn-full" onClick={onLogout} style={{ marginTop: 12, background: 'var(--border-light)', color: 'var(--text-primary)' }}>
          Log Out
        </button>
      </div>

      {/* Danger Zone */}
      <div className="card account-danger">
        <div className="card-title">Danger Zone</div>
        <p className="account-danger-text">Permanently delete your account and all data. This cannot be undone.</p>
        {!showDeleteConfirm ? (
          <button className="btn btn-full account-delete-btn" onClick={() => setShowDeleteConfirm(true)}>
            Delete Account
          </button>
        ) : (
          <div className="account-delete-confirm">
            <input className="input" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Enter password to confirm" />
            <div className="account-delete-actions">
              <button className="btn btn-full account-delete-btn" onClick={deleteAccount} disabled={saving}>
                {saving ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button className="btn btn-full" onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }} style={{ background: 'var(--border-light)', color: 'var(--text-primary)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
