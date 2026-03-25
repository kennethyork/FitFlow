import { useEffect, useState } from 'react';
import './App.css';
import useCoachAI from './useCoachAI';

const TABS = [
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'food', icon: '🍽️', label: 'Food' },
  { id: 'habits', icon: '✅', label: 'Habits' },
  { id: 'learn', icon: '📖', label: 'Learn' },
  { id: 'coach', icon: '💬', label: 'Coach' },
];

function colorTag(calories) {
  if (calories <= 200) return 'green';
  if (calories <= 400) return 'yellow';
  return 'red';
}

function mealEmoji(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('salad') || n.includes('vegetable')) return '🥗';
  if (n.includes('chicken') || n.includes('meat') || n.includes('steak')) return '🍗';
  if (n.includes('rice') || n.includes('pasta') || n.includes('bread')) return '🍚';
  if (n.includes('fruit') || n.includes('apple') || n.includes('banana')) return '🍎';
  if (n.includes('egg')) return '🥚';
  if (n.includes('fish') || n.includes('salmon')) return '🐟';
  if (n.includes('pizza')) return '🍕';
  return '🍽️';
}

function difficultyClass(d) {
  if (d === 'low') return '';
  if (d === 'medium') return 'medium';
  return 'hard';
}

function App() {
  const [tab, setTab] = useState('home');
  const [logs, setLogs] = useState([]);
  const [meal, setMeal] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [file, setFile] = useState(null);

  const [coachQuery, setCoachQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [coachTyping, setCoachTyping] = useState(false);
  const { coachName, status: aiStatus, progress: aiProgress, chat: aiChat } = useCoachAI();

  const [habits, setHabits] = useState([]);
  const [newHabit, setNewHabit] = useState('');
  const [lessons, setLessons] = useState([]);

  const [playlist, setPlaylist] = useState([]);
  const [workoutSearchTerm, setWorkoutSearchTerm] = useState('');
  const [workoutResults, setWorkoutResults] = useState([]);

  const [photoPredictions, setPhotoPredictions] = useState([]);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceResult, setVoiceResult] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [logsRes, habitsRes, lessonsRes, playlistRes] = await Promise.all([
          fetch('/api/food/logs?userId=1'),
          fetch('/api/habits'),
          fetch('/api/lessons'),
          fetch('/api/workouts/playlist'),
        ]);

        const logsJson = await logsRes.json();
        setLogs(Array.isArray(logsJson) ? logsJson : []);

        if (habitsRes.ok) setHabits(await habitsRes.json());
        if (lessonsRes.ok) setLessons(await lessonsRes.json());
        if (playlistRes.ok) setPlaylist(await playlistRes.json());
      } catch (err) {
        console.error(err);
        setLoadError('Unable to connect to server.');
        setLogs([]);
        setHabits([]);
        setLessons([]);
        setPlaylist([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalCals = logs.reduce((s, l) => s + (l.calories || 0), 0);
  const totalProtein = logs.reduce((s, l) => s + (l.protein || 0), 0);
  const totalCarbs = logs.reduce((s, l) => s + (l.carbs || 0), 0);
  const totalFat = logs.reduce((s, l) => s + (l.fat || 0), 0);
  const habitsCompleted = habits.filter((h) => h.completed).length;
  const calGoal = 1800;

  const addLog = async (e) => {
    e.preventDefault();
    if (!meal.trim()) return;
    await fetch('/api/food/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 1,
        meal,
        calories: 250,
        protein: 18,
        carbs: 30,
        fat: 10,
        imageUrl,
      }),
    });
    const data = await fetch('/api/food/logs?userId=1').then((r) => r.json());
    setLogs(Array.isArray(data) ? data : []);
    setMeal('');
    setImageUrl('');
    setFile(null);
  };

  const uploadImage = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch('/api/food/upload', { method: 'POST', body: fd });
    const json = await res.json();
    setImageUrl(json.imageUrl);
  };

  const runPhotoAI = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch('/api/food/photo', { method: 'POST', body: fd });
    const data = await res.json();
    setPhotoPredictions(data.predictions || []);
  };

  const runVoiceAI = async () => {
    if (!voiceTranscript.trim()) return;
    const res = await fetch('/api/food/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: voiceTranscript }),
    });
    const data = await res.json();
    setVoiceResult(data.parsed);
  };

  const sendCoachQuery = async () => {
    if (!coachQuery.trim()) return;
    const q = coachQuery;
    setChatHistory((prev) => [...prev, { role: 'user', text: q }]);
    setCoachQuery('');
    setCoachTyping(true);
    try {
      const history = [...chatHistory, { role: 'user', text: q }];
      const answer = await aiChat(history);
      setChatHistory((prev) => [...prev, { role: 'coach', text: answer }]);
    } catch {
      setChatHistory((prev) => [...prev, { role: 'coach', text: "Sorry, I couldn't process that. Try again!" }]);
    } finally {
      setCoachTyping(false);
    }
  };

  const addHabit = async () => {
    if (!newHabit.trim()) return;
    const res = await fetch('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newHabit }),
    });
    const habit = await res.json();
    setHabits((prev) => [...prev, habit]);
    setNewHabit('');
  };

  const toggleHabit = async (id) => {
    const res = await fetch(`/api/habits/${id}/toggle`, { method: 'PUT' });
    const updated = await res.json();
    setHabits((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
  };

  const searchWorkouts = async () => {
    const res = await fetch(
      `/api/workouts/search?q=${encodeURIComponent(workoutSearchTerm)}`
    );
    const data = await res.json();
    setWorkoutResults(data.results || []);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p style={{ color: 'var(--text-muted)' }}>Loading FitFlow...</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Sidebar — desktop only */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">🌿</span>
          <span>FitFlow</span>
        </div>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`sidebar-item ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="sidebar-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </aside>

      <div className="main-area">
        {/* Header */}
        <div className="app-header">
          <h1>FitFlow</h1>
          <div className="greeting">Your personal health journey</div>
        </div>

        {/* Content */}
        <div className="tab-content">
        {loadError && <div className="error-banner">{loadError}</div>}

        {/* ═══════ HOME TAB ═══════ */}
        {tab === 'home' && (
          <>
            {/* Streak */}
            <div className="streak-banner">
              <div className="flame">🔥</div>
              <div>
                <div className="text">3 Day Streak!</div>
                <div className="subtext">Keep it up — consistency is key</div>
              </div>
            </div>

            {/* Calorie Ring */}
            <div className="home-grid">
            <div className="card">
              <div className="card-title">Today&apos;s Progress</div>
              <div className="calorie-ring">
                <div className="ring">
                  <div className="number">{calGoal - totalCals}</div>
                  <div className="label">cal remaining</div>
                </div>
                <div className="macro-row">
                  <div className="macro-item green">
                    <div className="value">{totalProtein}g</div>
                    <div className="mlabel">Protein</div>
                  </div>
                  <div className="macro-item yellow">
                    <div className="value">{totalCarbs}g</div>
                    <div className="mlabel">Carbs</div>
                  </div>
                  <div className="macro-item red">
                    <div className="value">{totalFat}g</div>
                    <div className="mlabel">Fat</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Today's Habits */}
            <div className="card">
              <div className="card-title">
                Today&apos;s Tasks ({habitsCompleted}/{habits.length})
              </div>
              {habits.slice(0, 3).map((habit) => (
                <div className="habit-item" key={habit.id}>
                  <div
                    className={`habit-check ${habit.completed ? 'done' : ''}`}
                    onClick={() => toggleHabit(habit.id)}
                  >
                    {habit.completed ? '✓' : ''}
                  </div>
                  <span
                    className={`habit-text ${habit.completed ? 'done' : ''}`}
                  >
                    {habit.title}
                  </span>
                </div>
              ))}
              {habits.length > 3 && (
                <button
                  className="btn btn-secondary btn-full"
                  style={{ marginTop: 8 }}
                  onClick={() => setTab('habits')}
                >
                  View all habits →
                </button>
              )}
            </div>
            </div>

            {/* Next Lesson */}
            {lessons.length > 0 && (
              <div
                className="card"
                onClick={() => setTab('learn')}
                style={{ cursor: 'pointer' }}
              >
                <div className="card-title">Continue Learning</div>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <div className="lesson-thumb">📖</div>
                  <div className="lesson-body">
                    <div className="title">{lessons[0].title}</div>
                    <div className="progress-bar">
                      <div
                        className="fill"
                        style={{ width: `${lessons[0].progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="quick-add">
              <button onClick={() => setTab('food')}>🍽️ Log Meal</button>
              <button onClick={() => setTab('coach')}>💬 Ask Coach</button>
              <button onClick={() => setTab('learn')}>📖 Lessons</button>
            </div>
          </>
        )}

        {/* ═══════ FOOD TAB ═══════ */}
        {tab === 'food' && (
          <>
            <div className="section-title">Log a Meal</div>

            <div className="card">
              <form onSubmit={addLog}>
                <div className="input-row">
                  <input
                    className="input"
                    value={meal}
                    onChange={(e) => setMeal(e.target.value)}
                    placeholder="What did you eat?"
                  />
                </div>
                <div className="input-row">
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files[0])}
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={uploadImage}
                  >
                    📷 Upload
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={runPhotoAI}
                  >
                    🤖 Analyze
                  </button>
                  <button type="submit" className="btn btn-primary">
                    + Log Meal
                  </button>
                </div>
              </form>
            </div>

            {photoPredictions.length > 0 && (
              <div className="ai-panel">
                <h4>🤖 AI Food Predictions</h4>
                {photoPredictions.map((p, idx) => (
                  <div className="prediction-item" key={idx}>
                    <span>
                      {p.name}{' '}
                      <span className={`food-tag ${colorTag(p.calories)}`}>
                        {colorTag(p.calories)}
                      </span>
                    </span>
                    <span>
                      {p.calories} kcal ({Math.round(p.confidence * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            )}

            {imageUrl && (
              <img
                src={imageUrl}
                style={{
                  maxWidth: '100%',
                  borderRadius: 12,
                  marginBottom: 12,
                }}
                alt="meal"
              />
            )}

            {/* Voice Input */}
            <div className="ai-panel">
              <h4>🎙️ Voice Input</h4>
              <textarea
                className="input"
                value={voiceTranscript}
                rows={2}
                onChange={(e) => setVoiceTranscript(e.target.value)}
                placeholder="Describe your meal: 'turkey sandwich and spinach salad'"
              />
              <button
                className="btn btn-secondary"
                style={{ marginTop: 8 }}
                onClick={runVoiceAI}
              >
                Parse voice input
              </button>
              {voiceResult && (
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <strong>{voiceResult.meal}</strong> — {voiceResult.calories}{' '}
                  kcal
                  <span
                    className={`food-tag ${colorTag(voiceResult.calories)}`}
                  >
                    {colorTag(voiceResult.calories)}
                  </span>
                  <div
                    style={{
                      color: 'var(--text-muted)',
                      marginTop: 4,
                      fontSize: 12,
                    }}
                  >
                    {voiceResult.suggestions}
                  </div>
                </div>
              )}
            </div>

            {/* Recent Meals */}
            <div className="section-title">Recent Meals</div>
            <div className="card">
              {logs.length === 0 && (
                <p
                  style={{ color: 'var(--text-muted)', fontSize: 14 }}
                >
                  No meals logged yet today.
                </p>
              )}
              {logs.map((log) => (
                <div className="meal-item" key={log.id}>
                  <div className="meal-icon">{mealEmoji(log.meal)}</div>
                  <div className="meal-info">
                    <div className="name">
                      {log.meal}{' '}
                      <span
                        className={`food-tag ${colorTag(log.calories)}`}
                      >
                        {colorTag(log.calories)}
                      </span>
                    </div>
                    <div className="meta">
                      {new Date(log.loggedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div className="meal-cals">{log.calories}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ═══════ HABITS TAB ═══════ */}
        {tab === 'habits' && (
          <>
            <div className="section-title">Daily Habits</div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div
                style={{
                  textAlign: 'center',
                  padding: '8px 0',
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                }}
              >
                {habitsCompleted} of {habits.length} completed
              </div>
              <div
                className="progress-bar"
                style={{ height: 8, marginBottom: 12 }}
              >
                <div
                  className="fill"
                  style={{
                    width: `${
                      habits.length > 0
                        ? (habitsCompleted / habits.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              {habits.map((habit) => (
                <div className="habit-item" key={habit.id}>
                  <div
                    className={`habit-check ${
                      habit.completed ? 'done' : ''
                    }`}
                    onClick={() => toggleHabit(habit.id)}
                  >
                    {habit.completed ? '✓' : ''}
                  </div>
                  <span
                    className={`habit-text ${
                      habit.completed ? 'done' : ''
                    }`}
                  >
                    {habit.title}
                  </span>
                </div>
              ))}
            </div>
            <div className="input-row">
              <input
                className="input"
                value={newHabit}
                onChange={(e) => setNewHabit(e.target.value)}
                placeholder="Add a new habit..."
              />
              <button className="btn btn-primary" onClick={addHabit}>
                +
              </button>
            </div>
          </>
        )}

        {/* ═══════ LEARN TAB ═══════ */}
        {tab === 'learn' && (
          <>
            <div className="section-title">Your Lessons</div>
            <div className="lesson-grid">
            {lessons.map((lesson) => (
              <div className="lesson-card" key={lesson.id}>
                <div className="lesson-thumb">📖</div>
                <div className="lesson-body">
                  <div className="title">{lesson.title}</div>
                  <div className="subtitle">{lesson.progress}% complete</div>
                  <div className="progress-bar">
                    <div
                      className="fill"
                      style={{ width: `${lesson.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            </div>

            <div className="section-title" style={{ marginTop: 20 }}>
              Workouts
            </div>
            <div className="input-row">
              <input
                className="input"
                value={workoutSearchTerm}
                onChange={(e) => setWorkoutSearchTerm(e.target.value)}
                placeholder="Search workouts..."
              />
              <button className="btn btn-primary" onClick={searchWorkouts}>
                🔍
              </button>
            </div>
            <div className="workout-grid">
            {(workoutResults.length > 0 ? workoutResults : playlist).map(
              (item) => (
                <div className="workout-card" key={item.id}>
                  <div className="workout-thumb">▶</div>
                  <div className="workout-body">
                    <div className="title">{item.title}</div>
                    <div className="meta">
                      {item.duration} ·{' '}
                      <span
                        className={`badge ${difficultyClass(
                          item.difficulty
                        )}`}
                      >
                        {item.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
              )
            )}
            </div>
          </>
        )}

        {/* ═══════ COACH TAB ═══════ */}
        {tab === 'coach' && (
          <>
            <div className="section-title">Coach {coachName}</div>

            {aiStatus === 'loading' && (
              <div className="ai-status-bar">
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                <span>{aiProgress || 'Loading AI model...'}</span>
              </div>
            )}
            {aiStatus === 'error' && (
              <div className="ai-status-bar warn">
                ⚠️ Browser AI unavailable — using server fallback
              </div>
            )}

            <div className="coach-chat-area">
              {chatHistory.length === 0 && (
                <div className="coach-row">
                  <div className="coach-avatar">{coachName[0]}</div>
                  <div className="coach-bubble">
                    Hi! I&apos;m Coach {coachName}. Ask me anything about fitness, nutrition, or your goals!
                  </div>
                </div>
              )}
              {chatHistory.map((msg, idx) =>
                msg.role === 'coach' ? (
                  <div className="coach-row" key={idx}>
                    <div className="coach-avatar">{coachName[0]}</div>
                    <div className="coach-bubble">{msg.text}</div>
                  </div>
                ) : (
                  <div className="user-bubble" key={idx}>
                    {msg.text}
                  </div>
                )
              )}
              {coachTyping && (
                <div className="coach-row">
                  <div className="coach-avatar">{coachName[0]}</div>
                  <div className="coach-bubble typing">Coach {coachName} is thinking…</div>
                </div>
              )}
            </div>
            <div className="coach-input-row">
              <input
                className="input"
                value={coachQuery}
                onChange={(e) => setCoachQuery(e.target.value)}
                placeholder={`Ask Coach ${coachName} anything...`}
                onKeyDown={(e) => e.key === 'Enter' && sendCoachQuery()}
                disabled={coachTyping}
              />
              <button className="btn btn-primary" onClick={sendCoachQuery} disabled={coachTyping}>
                →
              </button>
            </div>
          </>
        )}
      </div>

      {/* Bottom Tab Bar — mobile only */}
      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
      </div>
    </div>
  );
}

export default App;
