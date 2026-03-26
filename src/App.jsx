import { useEffect, useState, useCallback } from 'react';
import './App.css';
import useCoachAI from './useCoachAI';
import AuthScreen from './AuthScreen';
import OnboardingScreen from './OnboardingScreen';
import PricingScreen from './PricingScreen';
import useSpeech from './useSpeech';
import { isNative, initStatusBar, readNativeSteps, takePhoto, pickImage, hapticTap, hapticSuccess, hapticWarning, hapticHeavy, subscribePedometer, nativeShare, scheduleNotification, keepAwake } from './native';

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
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [showPricing, setShowPricing] = useState(false);

  const VALID_TABS = ['home', 'food', 'habits', 'learn', 'coach'];
  const getHashTab = () => {
    const h = window.location.hash.replace('#', '');
    return VALID_TABS.includes(h) ? h : 'home';
  };
  const [tab, setTabState] = useState(getHashTab);
  const setTab = useCallback((t) => {
    hapticTap();
    setTabState(t);
    window.location.hash = t;
  }, []);

  // Sync tab when browser back/forward changes the hash
  useEffect(() => {
    const onHash = () => setTabState(getHashTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const [logs, setLogs] = useState([]);
  const [meal, setMeal] = useState('');
  const [mealCals, setMealCals] = useState('');
  const [mealProtein, setMealProtein] = useState('');
  const [mealCarbs, setMealCarbs] = useState('');
  const [mealFat, setMealFat] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [file, setFile] = useState(null);
  const [editingLog, setEditingLog] = useState(null);
  const [editMeal, setEditMeal] = useState('');
  const [editCals, setEditCals] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editFat, setEditFat] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [coachQuery, setCoachQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [coachTyping, setCoachTyping] = useState(false);
  const { coachName, status: aiStatus, progress: aiProgress, chat: aiChat } = useCoachAI(user?.id);
  const { listening, supported: micSupported, start: startMic, stop: stopMic } = useSpeech();

  const [voiceParsing, setVoiceParsing] = useState(false);

  const [habits, setHabits] = useState([]);
  const [newHabit, setNewHabit] = useState('');
  const [lessons, setLessons] = useState([]);

  const [playlist, setPlaylist] = useState([]);
  const [workoutCategory, setWorkoutCategory] = useState('');
  const [workoutSearchTerm, setWorkoutSearchTerm] = useState('');
  const [workoutResults, setWorkoutResults] = useState([]);

  const [videoTabs, setVideoTabs] = useState([]);
  const [activeVideoTab, setActiveVideoTab] = useState('chair');
  const [browseVideos, setBrowseVideos] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [videoSearchTerm, setVideoSearchTerm] = useState('');
  const [playingVideo, setPlayingVideo] = useState(null);

  const [photoPredictions, setPhotoPredictions] = useState([]);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceResult, setVoiceResult] = useState(null);
  const [dailyMeals, setDailyMeals] = useState(null);
  const [expandedMeal, setExpandedMeal] = useState(null);

  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [foodSearchResults, setFoodSearchResults] = useState([]);
  const [showFoodSearch, setShowFoodSearch] = useState(false);

  // Weight tracking
  const [weightLogs, setWeightLogs] = useState([]);
  const [weightInput, setWeightInput] = useState('');
  const [weightUnit, setWeightUnit] = useState('lbs');

  // Water tracking
  const [waterGlasses, setWaterGlasses] = useState(0);
  const waterGoal = 8;

  // Progress photos
  const [progressPhotos, setProgressPhotos] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoNote, setPhotoNote] = useState('');

  // Step counter
  const [stepsToday, setStepsToday] = useState(0);
  const [stepInput, setStepInput] = useState('');
  const stepGoal = 10000;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);

  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    }
  };

  const authHeaders = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const handleAuth = (newToken, newUser, isSignup) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    if (isSignup) setShowOnboarding(true);
  };

  const handleOnboardComplete = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setShowOnboarding(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setLogs([]);
    setHabits([]);
    setLessons([]);
    setPlaylist([]);
    setChatHistory([]);
  };

  const handleUpgrade = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setShowPricing(false);
  };

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        setLoading(true);
        const hdrs = { Authorization: `Bearer ${token}` };

        // Refresh user profile (picks up onboarded, calorieGoal, etc.)
        const meRes = await fetch('/api/auth/me', { headers: hdrs });
        if (meRes.status === 401) { handleLogout(); return; }
        if (meRes.ok) {
          const freshUser = await meRes.json();
          localStorage.setItem('user', JSON.stringify(freshUser));
          setUser(freshUser);
          if (!freshUser.onboarded) { setLoading(false); return; }
        }

        const [logsRes, habitsRes, lessonsRes, playlistRes, mealsRes] = await Promise.all([
          fetch('/api/food/logs', { headers: hdrs }),
          fetch('/api/habits', { headers: hdrs }),
          fetch('/api/lessons', { headers: hdrs }),
          fetch('/api/workouts/playlist', { headers: hdrs }),
          fetch('/api/meals', { headers: hdrs }),
        ]);

        const logsJson = await logsRes.json();
        setLogs(Array.isArray(logsJson) ? logsJson : []);

        if (habitsRes.ok) setHabits(await habitsRes.json());
        if (lessonsRes.ok) setLessons(await lessonsRes.json());
        if (mealsRes.ok) setDailyMeals(await mealsRes.json());
        if (playlistRes.ok) {
          const pData = await playlistRes.json();
          setPlaylist(pData.workouts || pData || []);
          setWorkoutCategory(pData.category || '');
        }

        // Load weight, water, photos, steps
        const [weightRes, waterRes, photosRes, stepsRes, chatRes] = await Promise.all([
          fetch('/api/weight', { headers: hdrs }),
          fetch('/api/water/today', { headers: hdrs }),
          fetch('/api/progress-photos', { headers: hdrs }),
          fetch('/api/steps/today', { headers: hdrs }),
          fetch('/api/chat', { headers: hdrs }),
        ]);
        if (weightRes.ok) setWeightLogs(await weightRes.json());
        if (waterRes.ok) { const w = await waterRes.json(); setWaterGlasses(w.glasses || 0); }
        if (photosRes.ok) setProgressPhotos(await photosRes.json());
        if (stepsRes.ok) { const s = await stepsRes.json(); setStepsToday(s.steps || 0); }
        if (chatRes.ok) { const msgs = await chatRes.json(); setChatHistory(Array.isArray(msgs) ? msgs : []); }
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
  }, [token]);

  const totalCals = logs.reduce((s, l) => s + (l.calories || 0), 0);
  const totalProtein = logs.reduce((s, l) => s + (l.protein || 0), 0);
  const totalCarbs = logs.reduce((s, l) => s + (l.carbs || 0), 0);
  const totalFat = logs.reduce((s, l) => s + (l.fat || 0), 0);
  const habitsCompleted = habits.filter((h) => h.completed).length;
  const calGoal = user?.calorieGoal || 1800;

  const searchFoods = async (query) => {
    setFoodSearchQuery(query);
    if (query.trim().length < 2) { setFoodSearchResults([]); setShowFoodSearch(false); return; }
    try {
      const res = await fetch(`/api/food/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setFoodSearchResults(data.results || []);
      setShowFoodSearch(true);
    } catch { setFoodSearchResults([]); }
  };

  const selectFood = (food) => {
    setMeal(food.name);
    setMealCals(String(food.calories));
    setMealProtein(String(food.protein));
    setMealCarbs(String(food.carbs));
    setMealFat(String(food.fat));
    setFoodSearchQuery('');
    setFoodSearchResults([]);
    setShowFoodSearch(false);
  };

  // ── Weight handlers ──
  const logWeight = async () => {
    if (!weightInput) return;
    hapticTap();
    const res = await fetch('/api/weight', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ weight: parseFloat(weightInput), unit: weightUnit }),
    });
    if (res.ok) {
      const log = await res.json();
      setWeightLogs(prev => [log, ...prev]);
      setWeightInput('');
    }
  };

  // ── Water handlers ──
  const updateWater = async (delta) => {
    const next = Math.max(0, waterGlasses + delta);
    if (next >= waterGoal && waterGlasses < waterGoal) hapticSuccess();
    else hapticTap();
    setWaterGlasses(next);
    await fetch('/api/water', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ glasses: next }),
    });
  };

  // ── Progress photo handler ──
  const uploadProgressPhoto = async () => {
    if (!photoFile) return;
    const fd = new FormData();
    fd.append('image', photoFile);
    fd.append('note', photoNote);
    const res = await fetch('/api/progress-photos', {
      method: 'POST', headers: { ...authHeaders }, body: fd,
    });
    if (res.ok) {
      hapticSuccess();
      const photo = await res.json();
      setProgressPhotos(prev => [photo, ...prev]);
      setPhotoFile(null);
      setPhotoNote('');
    }
  };

  const deleteProgressPhoto = async (id) => {
    hapticWarning();
    await fetch(`/api/progress-photos/${id}`, { method: 'DELETE', headers: authHeaders });
    setProgressPhotos(prev => prev.filter(p => p.id !== id));
  };

  // ── Step handlers ──
  const logSteps = async () => {
    if (!stepInput) return;
    hapticTap();
    const res = await fetch('/api/steps', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ steps: parseInt(stepInput, 10) }),
    });
    if (res.ok) {
      const log = await res.json();
      setStepsToday(log.steps);
      setStepInput('');
    }
  };

  const syncNativeSteps = async () => {
    const { steps, source } = await readNativeSteps();
    if (steps > 0) {
      hapticTap();
      const res = await fetch('/api/steps', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ steps }),
      });
      if (res.ok) { const log = await res.json(); setStepsToday(log.steps); }
    }
  };

  // Init native status bar + auto-sync steps + live pedometer
  useEffect(() => {
    initStatusBar();
    // Auto sync steps from pedometer when native
    if (isNative && token) {
      readNativeSteps().then(({ steps }) => {
        if (steps > 0) {
          fetch('/api/steps', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ steps }),
          }).then(r => r.ok ? r.json() : null).then(log => {
            if (log) setStepsToday(log.steps);
          });
        }
      });
    }
  }, [token]);

  // Live pedometer — update step count in real time on native
  useEffect(() => {
    if (!isNative || !token) return;
    const unsub = subscribePedometer((steps) => {
      setStepsToday(steps);
    });
    return unsub;
  }, [token]);

  // Celebrate step goal
  useEffect(() => {
    if (stepsToday >= stepGoal && stepsToday > 0) {
      hapticSuccess();
    }
  }, [stepsToday, stepGoal]);

  // Schedule daily reminder notification on native
  useEffect(() => {
    if (isNative && token) {
      const now = new Date();
      const nineAM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
      if (now < nineAM) {
        const secs = Math.floor((nineAM - now) / 1000);
        scheduleNotification('FitFlow', '🌅 Good morning! Log your breakfast and hit your goals today!', secs);
      }
      const eightPM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
      if (now < eightPM) {
        const secs = Math.floor((eightPM - now) / 1000);
        scheduleNotification('FitFlow', '🌙 Don\'t forget to log your water and steps before bed!', secs);
      }
    }
  }, [token]);

  const addLog = async (e) => {
    e.preventDefault();
    if (!meal.trim()) return;
    hapticTap();
    const res = await fetch('/api/food/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        meal,
        calories: parseInt(mealCals, 10) || 0,
        protein: parseInt(mealProtein, 10) || 0,
        carbs: parseInt(mealCarbs, 10) || 0,
        fat: parseInt(mealFat, 10) || 0,
        imageUrl,
      }),
    });
    if (res.status === 403) { const j = await res.json(); if (j.upgrade) setShowPricing(true); return; }
    const data = await fetch('/api/food/logs', { headers: authHeaders }).then((r) => r.json());
    setLogs(Array.isArray(data) ? data : []);
    setMeal('');
    setMealCals('');
    setMealProtein('');
    setMealCarbs('');
    setMealFat('');
    setImageUrl('');
    setFile(null);
  };

  const logRecipe = async (recipe) => {
    hapticSuccess();
    const res = await fetch('/api/food/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        meal: recipe.name,
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
      }),
    });
    if (res.status === 403) { const j = await res.json(); if (j.upgrade) setShowPricing(true); return; }
    const data = await fetch('/api/food/logs', { headers: authHeaders }).then((r) => r.json());
    setLogs(Array.isArray(data) ? data : []);
  };

  const deleteLog = async (id) => {
    await fetch(`/api/food/logs/${id}`, { method: 'DELETE', headers: authHeaders });
    setLogs((prev) => prev.filter((l) => l.id !== id));
    setConfirmDelete(null);
  };

  const startEditLog = (log) => {
    setEditingLog(log.id);
    setEditMeal(log.meal);
    setEditCals(String(log.calories || ''));
    setEditProtein(String(log.protein || ''));
    setEditCarbs(String(log.carbs || ''));
    setEditFat(String(log.fat || ''));
  };

  const saveEditLog = async (id) => {
    const res = await fetch(`/api/food/logs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        meal: editMeal,
        calories: parseInt(editCals, 10) || 0,
        protein: parseInt(editProtein, 10) || 0,
        carbs: parseInt(editCarbs, 10) || 0,
        fat: parseInt(editFat, 10) || 0,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    }
    setEditingLog(null);
  };

  const uploadImage = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch('/api/food/upload', { method: 'POST', headers: authHeaders, body: fd });
    const json = await res.json();
    setImageUrl(json.imageUrl);
  };

  const runPhotoAI = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch('/api/food/photo', { method: 'POST', headers: authHeaders, body: fd });
    const data = await res.json();
    setPhotoPredictions(data.predictions || []);
  };

  const parseVoiceTranscript = async (text) => {
    if (!text.trim()) return;
    setVoiceParsing(true);
    try {
      const prompt = [
        { role: 'user', text: `Parse this meal description into JSON with keys: meal, calories, protein, carbs, fat, suggestions. Be realistic with estimates. Description: "${text}"` },
      ];
      const raw = await aiChat(prompt);
      // Try to extract JSON from the response
      const jsonMatch = raw.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setVoiceResult({
          meal: parsed.meal || text,
          calories: parsed.calories || 300,
          protein: parsed.protein || 20,
          carbs: parsed.carbs || 30,
          fat: parsed.fat || 12,
          suggestions: parsed.suggestions || '',
        });
      } else {
        // Fallback: server endpoint
        const res = await fetch('/api/food/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ transcript: text }),
        });
        const data = await res.json();
        setVoiceResult(data.parsed);
      }
    } catch {
      // Fallback: server endpoint
      const res = await fetch('/api/food/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ transcript: text }),
      });
      const data = await res.json();
      setVoiceResult(data.parsed);
    } finally {
      setVoiceParsing(false);
    }
  };

  const handleMicToggle = () => {
    if (listening) {
      stopMic();
    } else {
      startMic((text) => {
        setVoiceTranscript(text);
        parseVoiceTranscript(text);
      });
    }
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
      // Persist both messages to DB
      fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ messages: [{ role: 'user', text: q }, { role: 'coach', text: answer }] }) }).catch(() => {});

      // Detect if user asked for a task/habit and auto-assign one
      const askPatterns = /assign|give me|suggest.*task|add.*task|add.*habit|new.*task|daily.*task|challenge|set.*goal|recommend|what should i do/i;
      if (askPatterns.test(q)) {
        // Extract a reasonable task from the AI response (first sentence or line)
        const lines = answer.split(/[.!\n]/).map(l => l.trim()).filter(l => l.length > 5 && l.length < 80);
        let taskTitle = lines[0] || answer.slice(0, 60);
        // Clean up generic filler prefixes
        taskTitle = taskTitle.replace(/^(Sure!?|Here'?s?|Okay!?|I suggest|Try this:?)\s*/i, '').trim();
        if (taskTitle.length < 5) taskTitle = 'Complete a 10-minute workout';
        try {
          const res = await fetch('/api/habits/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ title: taskTitle }),
          });
          if (res.ok) {
            const newTask = await res.json();
            setHabits((prev) => [...prev, newTask]);
            const taskMsg = `✅ I've added "${taskTitle}" to your daily tasks!`;
            setChatHistory((prev) => [...prev, { role: 'coach', text: taskMsg }]);
            fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ messages: [{ role: 'coach', text: taskMsg }] }) }).catch(() => {});
          }
        } catch { /* ignore assign error */ }
      }
    } catch {
      const errMsg = "Sorry, I couldn't process that. Try again!";
      setChatHistory((prev) => [...prev, { role: 'coach', text: errMsg }]);
      fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ messages: [{ role: 'user', text: q }, { role: 'coach', text: errMsg }] }) }).catch(() => {});
    } finally {
      setCoachTyping(false);
    }
  };

  const addHabit = async () => {
    if (!newHabit.trim()) return;
    hapticTap();
    const res = await fetch('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ title: newHabit }),
    });
    if (res.status === 403) { const j = await res.json(); if (j.upgrade) setShowPricing(true); return; }
    const habit = await res.json();
    setHabits((prev) => [...prev, habit]);
    setNewHabit('');
  };

  const toggleHabit = async (id) => {
    const res = await fetch(`/api/habits/${id}/toggle`, { method: 'PUT', headers: authHeaders });
    const updated = await res.json();
    if (updated.completed) hapticSuccess(); else hapticTap();
    setHabits((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
  };

  const searchWorkouts = async () => {
    if (!workoutSearchTerm.trim()) return;
    const res = await fetch(
      `/api/workouts/search?q=${encodeURIComponent(workoutSearchTerm)}`,
      { headers: authHeaders }
    );
    const data = await res.json();
    setWorkoutResults(data.workouts || data.results || []);
  };

  // ── Video browse helpers ──
  const loadVideoTabs = async () => {
    try {
      const res = await fetch('/api/videos/tabs', { headers: authHeaders });
      if (res.ok) setVideoTabs(await res.json());
    } catch (e) { console.error('Failed to load video tabs', e); }
  };

  const loadBrowseVideos = async (tabId, query) => {
    setBrowseLoading(true);
    try {
      const url = query
        ? `/api/videos/browse?q=${encodeURIComponent(query)}`
        : `/api/videos/browse?tab=${encodeURIComponent(tabId || activeVideoTab)}`;
      const res = await fetch(url, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setBrowseVideos(data.videos || []);
      }
    } catch (e) { console.error('Failed to load videos', e); }
    setBrowseLoading(false);
  };

  useEffect(() => {
    if (tab === 'learn' && token) {
      if (videoTabs.length === 0) loadVideoTabs();
      loadBrowseVideos(activeVideoTab);
    }
  }, [tab, activeVideoTab, token]);

  if (!token) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  if (showOnboarding) {
    return <OnboardingScreen token={token} onComplete={handleOnboardComplete} />;
  }

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
      {showPricing && (
        <PricingScreen
          currentTier={user?.tier || 'free'}
          token={token}
          onUpgrade={handleUpgrade}
          onClose={() => setShowPricing(false)}
        />
      )}

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
        <div className="sidebar-spacer" />
        <button className="sidebar-item" onClick={() => setShowPricing(true)}>
          <span className="sidebar-icon">⭐</span>
          {user?.tier === 'free' ? 'Upgrade' : 'Plan'}
        </button>
        <button className="sidebar-item" onClick={handleLogout}>
          <span className="sidebar-icon">🚪</span>
          Logout
        </button>
      </aside>

      <div className="main-area">
        {/* Header */}
        <div className="app-header">
          <h1>FitFlow</h1>
          <div className="header-right">
            <span className={`tier-badge ${user?.tier || 'free'}`}>{(user?.tier || 'free').toUpperCase()}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowPricing(true)}>
              {user?.tier === 'free' ? '⭐ Upgrade' : '⭐ Plan'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Logout</button>
          </div>
        </div>

        {/* Content */}
        <div className="tab-content">
        {loadError && <div className="error-banner">{loadError}</div>}

        {/* ═══════ HOME TAB ═══════ */}
        {tab === 'home' && (
          <>
            {/* PWA Install Banner */}
            {showInstallBanner && (
              <div className="install-banner">
                <div className="install-icon">📲</div>
                <div className="install-text">
                  <strong>Install FitFlow</strong>
                  <span>Add to home screen for the full app experience</span>
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleInstall}>Install</button>
                <button className="install-dismiss" onClick={() => setShowInstallBanner(false)}>✕</button>
              </div>
            )}

            {/* Streak — only show when user has logged food */}
            {logs.length > 0 && (
            <div className="streak-banner">
              <div className="flame">🔥</div>
              <div>
                <div className="text">1 Day Streak!</div>
                <div className="subtext">Keep it up — consistency is key</div>
              </div>
            </div>
            )}

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

            {/* Daily Tasks */}
            <div className="card">
              <div className="card-title">📋 Daily Tasks</div>
              {habits.filter(h => h.source === 'daily').slice(0, 3).map((habit) => (
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
            </div>

            {/* Weekly Goals */}
            <div className="card">
              <div className="card-title">📅 Weekly Goals</div>
              {habits.filter(h => h.source === 'weekly').slice(0, 2).map((habit) => (
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
            </div>

            {/* Monthly Challenges */}
            <div className="card">
              <div className="card-title">🏆 Monthly Challenges</div>
              {habits.filter(h => h.source === 'monthly').slice(0, 2).map((habit) => (
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
              {habits.length > 5 && (
                <button
                  className="btn btn-secondary btn-full"
                  style={{ marginTop: 8 }}
                  onClick={() => setTab('habits')}
                >
                  View all tasks →
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

            {/* ── Weight Tracking ── */}
            <div className="card weight-card">
              <div className="card-title">⚖️ Weight Tracker</div>
              <div className="weight-input-row">
                <input type="number" step="0.1" placeholder="Enter weight" value={weightInput} onChange={e => setWeightInput(e.target.value)} className="weight-input" />
                <select value={weightUnit} onChange={e => setWeightUnit(e.target.value)} className="weight-unit-select">
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </select>
                <button className="btn btn-primary btn-sm" onClick={logWeight}>Log</button>
              </div>
              {weightLogs.length > 0 && (
                <>
                  <div className="weight-current">
                    Current: <strong>{weightLogs[0].weight} {weightLogs[0].unit}</strong>
                    {weightLogs.length > 1 && (() => {
                      const diff = (weightLogs[0].weight - weightLogs[1].weight).toFixed(1);
                      return <span className={`weight-delta ${diff < 0 ? 'loss' : diff > 0 ? 'gain' : ''}`}>
                        {diff > 0 ? '+' : ''}{diff} {weightLogs[0].unit}
                      </span>;
                    })()}
                  </div>
                  <div className="weight-chart">
                    <svg viewBox="0 0 300 100" className="weight-svg">
                      {(() => {
                        const pts = [...weightLogs].reverse().slice(-14);
                        if (pts.length < 2) return null;
                        const min = Math.min(...pts.map(p => p.weight)) - 1;
                        const max = Math.max(...pts.map(p => p.weight)) + 1;
                        const range = max - min || 1;
                        const points = pts.map((p, i) => {
                          const x = (i / (pts.length - 1)) * 280 + 10;
                          const y = 90 - ((p.weight - min) / range) * 80;
                          return `${x},${y}`;
                        });
                        return <>
                          <polyline points={points.join(' ')} fill="none" stroke="#4CAF50" strokeWidth="2" />
                          {pts.map((p, i) => {
                            const x = (i / (pts.length - 1)) * 280 + 10;
                            const y = 90 - ((p.weight - min) / range) * 80;
                            return <circle key={i} cx={x} cy={y} r="3" fill="#4CAF50" />;
                          })}
                        </>;
                      })()}
                    </svg>
                    <div className="weight-chart-labels">
                      {weightLogs.length > 1 && <>
                        <span>{[...weightLogs].pop()?.weight}</span>
                        <span>{weightLogs[0].weight} {weightLogs[0].unit}</span>
                      </>}
                    </div>
                  </div>
                </>
              )}
              {isNative && weightLogs.length > 0 && (
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={() => {
                  const w = weightLogs[0];
                  nativeShare('My Weight Progress', `⚖️ Current weight: ${w.weight} ${w.unit} — tracked with FitFlow!`);
                }}>📤 Share Progress</button>
              )}
            </div>
            <div className="card water-card">
              <div className="card-title">💧 Water Intake</div>
              <div className="water-tracker">
                <div className="water-glasses">
                  {Array.from({ length: waterGoal }).map((_, i) => (
                    <div key={i} className={`water-glass ${i < waterGlasses ? 'filled' : ''}`}>💧</div>
                  ))}
                </div>
                <div className="water-count">{waterGlasses} / {waterGoal} glasses</div>
                <div className="water-buttons">
                  <button className="btn btn-secondary btn-sm" onClick={() => updateWater(-1)} disabled={waterGlasses <= 0}>−</button>
                  <div className="water-progress-bar">
                    <div className="water-fill" style={{ width: `${Math.min(100, (waterGlasses / waterGoal) * 100)}%` }} />
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => updateWater(1)}>+</button>
                </div>
                {waterGlasses >= waterGoal && <div className="water-complete">🎉 Goal reached!</div>}
              </div>
            </div>

            {/* ── Step Counter ── */}
            <div className="card steps-card">
              <div className="card-title">👟 Step Counter</div>
              <div className="steps-ring">
                <svg viewBox="0 0 120 120" className="steps-svg">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#e0e0e0" strokeWidth="8" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#FF9800" strokeWidth="8"
                    strokeDasharray={`${Math.min(1, stepsToday / stepGoal) * 314} 314`}
                    strokeLinecap="round" transform="rotate(-90 60 60)" />
                </svg>
                <div className="steps-center">
                  <div className="steps-number">{stepsToday.toLocaleString()}</div>
                  <div className="steps-label">/ {stepGoal.toLocaleString()}</div>
                </div>
              </div>
              <div className="steps-input-row">
                <input type="number" placeholder="Enter steps" value={stepInput} onChange={e => setStepInput(e.target.value)} className="steps-input" />
                <button className="btn btn-primary btn-sm" onClick={logSteps}>Update</button>
              </div>
              {isNative && (
                <button className="btn btn-secondary btn-sm btn-sync" onClick={syncNativeSteps}>🔄 Sync from Health</button>
              )}
              {stepsToday >= stepGoal && (
                <div className="steps-complete">
                  🎉 Goal reached!
                  {isNative && (
                    <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={() => {
                      nativeShare('Step Goal Reached!', `🏃 I walked ${stepsToday.toLocaleString()} steps today with FitFlow! 💪`);
                    }}>📤 Share</button>
                  )}
                </div>
              )}
            </div>

            {/* ── Progress Photos ── */}
            <div className="card photos-card">
              <div className="card-title">📸 Progress Photos</div>
              <div className="photo-upload-row">
                <label className="photo-upload-btn">
                  📷 Choose Photo
                  <input type="file" accept="image/*" hidden onChange={e => setPhotoFile(e.target.files[0])} />
                </label>
                {isNative && (
                  <button className="photo-upload-btn" onClick={async () => {
                    const result = await takePhoto();
                    if (result?.uri) {
                      const resp = await fetch(result.uri);
                      const blob = await resp.blob();
                      setPhotoFile(new File([blob], `photo.${result.format || 'jpeg'}`, { type: `image/${result.format || 'jpeg'}` }));
                    }
                  }}>📸 Camera</button>
                )}
                {isNative && (
                  <button className="photo-upload-btn" onClick={async () => {
                    const result = await pickImage();
                    if (result?.uri) {
                      const resp = await fetch(result.uri);
                      const blob = await resp.blob();
                      setPhotoFile(new File([blob], `gallery.${result.format || 'jpeg'}`, { type: `image/${result.format || 'jpeg'}` }));
                    }
                  }}>🖼️ Gallery</button>
                )}
                {photoFile && <span className="photo-filename">{photoFile.name}</span>}
              </div>
              {photoFile && (
                <div className="photo-note-row">
                  <input type="text" placeholder="Add a note (optional)" value={photoNote} onChange={e => setPhotoNote(e.target.value)} className="photo-note-input" />
                  <button className="btn btn-primary btn-sm" onClick={uploadProgressPhoto}>Upload</button>
                </div>
              )}
              {progressPhotos.length > 0 && (
                <div className="photo-gallery">
                  {progressPhotos.slice(0, 6).map(photo => (
                    <div key={photo.id} className="photo-thumb">
                      <img src={photo.imageUrl} alt={photo.note || 'Progress'} />
                      <div className="photo-date">{new Date(photo.loggedAt).toLocaleDateString()}</div>
                      {photo.note && <div className="photo-note">{photo.note}</div>}
                      <button className="photo-delete" onClick={() => deleteProgressPhoto(photo.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
            {/* Daily Meal Plan */}
            {dailyMeals && (
              <>
                <div className="section-title">Today&apos;s Meal Plan</div>
                {['breakfast', 'lunch', 'dinner', 'snack'].map((mealType) => {
                  const recipe = dailyMeals[mealType];
                  if (!recipe) return null;
                  const isExpanded = expandedMeal === mealType;
                  return (
                    <div className="card recipe-card" key={mealType} style={{ marginBottom: 12 }}>
                      <div
                        className="recipe-header"
                        onClick={() => setExpandedMeal(isExpanded ? null : mealType)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="recipe-emoji">{recipe.emoji}</div>
                        <div className="recipe-info">
                          <div className="recipe-label">{mealType.charAt(0).toUpperCase() + mealType.slice(1)}</div>
                          <div className="recipe-name">{recipe.name}</div>
                          <div className="recipe-meta">
                            {recipe.calories} kcal &middot; {recipe.protein}g P &middot; {recipe.carbs}g C &middot; {recipe.fat}g F &middot; ⏱ {recipe.time}
                          </div>
                        </div>
                        <div className="recipe-chevron">{isExpanded ? '▲' : '▼'}</div>
                      </div>
                      {isExpanded && (
                        <div className="recipe-detail">
                          <div className="recipe-section-title">Ingredients</div>
                          <ul className="recipe-list">
                            {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                          </ul>
                          <div className="recipe-section-title">Steps</div>
                          <ol className="recipe-list">
                            {recipe.steps.map((step, i) => <li key={i}>{step}</li>)}
                          </ol>
                          <button
                            className="btn btn-primary btn-full"
                            style={{ marginTop: 12 }}
                            onClick={(e) => { e.stopPropagation(); logRecipe(recipe); }}
                          >
                            ✅ Log This Meal
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            <div className="section-title">Log a Meal</div>

            <div className="card">
              <form onSubmit={addLog}>
                <div className="input-row" style={{ position: 'relative' }}>
                  <input
                    className="input"
                    value={meal}
                    onChange={(e) => { setMeal(e.target.value); searchFoods(e.target.value); }}
                    onFocus={() => { if (foodSearchResults.length) setShowFoodSearch(true); }}
                    onBlur={() => setTimeout(() => setShowFoodSearch(false), 200)}
                    placeholder="Search food or type custom meal..."
                    autoComplete="off"
                  />
                  {showFoodSearch && foodSearchResults.length > 0 && (
                    <div className="food-search-dropdown">
                      {foodSearchResults.map((f, i) => (
                        <div key={i} className="food-search-item" onMouseDown={() => selectFood(f)}>
                          <div className="food-search-name">
                            <span className={`noom-dot noom-${f.color}`} />
                            <span>{f.name}</span>
                            {f.source && f.source !== 'local' && (
                              <span className={`food-source-badge source-${f.source}`}>
                                {f.source === 'usda' ? 'USDA' : 'OFF'}
                              </span>
                            )}
                          </div>
                          <div className="food-search-meta">
                            <span>{f.calories} kcal</span>
                            <span className="food-search-serving">{f.serving}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="macro-inputs">
                  <div className="macro-field">
                    <label>Calories</label>
                    <input type="number" className="input" value={mealCals} onChange={(e) => setMealCals(e.target.value)} placeholder="kcal" />
                  </div>
                  <div className="macro-field">
                    <label>Protein</label>
                    <input type="number" className="input" value={mealProtein} onChange={(e) => setMealProtein(e.target.value)} placeholder="g" />
                  </div>
                  <div className="macro-field">
                    <label>Carbs</label>
                    <input type="number" className="input" value={mealCarbs} onChange={(e) => setMealCarbs(e.target.value)} placeholder="g" />
                  </div>
                  <div className="macro-field">
                    <label>Fat</label>
                    <input type="number" className="input" value={mealFat} onChange={(e) => setMealFat(e.target.value)} placeholder="g" />
                  </div>
                </div>
                <div className="file-upload-row">
                  <label className="file-upload-label">
                    <input
                      type="file"
                      className="file-upload-hidden"
                      onChange={(e) => setFile(e.target.files[0])}
                    />
                    <span className="btn btn-secondary btn-sm">📎 Choose Photo</span>
                    <span className="file-upload-name">{file ? file.name : 'No file selected'}</span>
                  </label>
                  {isNative && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={async () => {
                      const result = await takePhoto();
                      if (result?.uri) {
                        const resp = await fetch(result.uri);
                        const blob = await resp.blob();
                        setFile(new File([blob], `food-photo.${result.format || 'jpeg'}`, { type: `image/${result.format || 'jpeg'}` }));
                      }
                    }}>📸 Camera</button>
                  )}
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

            {/* Voice Input — paid tiers only */}
            {user?.tier && user.tier !== 'free' ? (
            <div className="ai-panel">
              <h4>🎙️ Voice Food Log</h4>
              <div className="voice-input-row">
                <textarea
                  className="input"
                  value={voiceTranscript}
                  rows={2}
                  onChange={(e) => setVoiceTranscript(e.target.value)}
                  placeholder="Tap the mic or type: 'turkey sandwich and spinach salad'"
                />
                {micSupported && (
                  <button
                    className={`btn mic-btn ${listening ? 'recording' : ''}`}
                    onClick={handleMicToggle}
                    type="button"
                  >
                    {listening ? '⏹' : '🎙️'}
                  </button>
                )}
              </div>
              {listening && <div className="voice-status">🔴 Listening...</div>}
              <button
                className="btn btn-secondary"
                style={{ marginTop: 8 }}
                onClick={() => parseVoiceTranscript(voiceTranscript)}
                disabled={voiceParsing || !voiceTranscript.trim()}
              >
                {voiceParsing ? 'Analyzing...' : 'Parse meal'}
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
            ) : (
            <div className="ai-panel" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <h4>🎙️ Voice Food Log</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '8px 0 12px' }}>Upgrade to Pro or higher to log meals with your voice.</p>
              <button className="btn btn-primary" onClick={() => setShowPricing(true)}>Upgrade</button>
            </div>
            )}

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
                  {editingLog === log.id ? (
                    <div className="meal-edit-form">
                      <input className="input" value={editMeal} onChange={(e) => setEditMeal(e.target.value)} placeholder="Meal name" />
                      <div className="macro-inputs compact">
                        <div className="macro-field">
                          <label>Cal</label>
                          <input type="number" className="input" value={editCals} onChange={(e) => setEditCals(e.target.value)} />
                        </div>
                        <div className="macro-field">
                          <label>P</label>
                          <input type="number" className="input" value={editProtein} onChange={(e) => setEditProtein(e.target.value)} />
                        </div>
                        <div className="macro-field">
                          <label>C</label>
                          <input type="number" className="input" value={editCarbs} onChange={(e) => setEditCarbs(e.target.value)} />
                        </div>
                        <div className="macro-field">
                          <label>F</label>
                          <input type="number" className="input" value={editFat} onChange={(e) => setEditFat(e.target.value)} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => saveEditLog(log.id)}>Save</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingLog(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
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
                          {log.protein || 0}g P · {log.carbs || 0}g C · {log.fat || 0}g F · {new Date(log.loggedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <div className="meal-cals">{log.calories}</div>
                      <div className="meal-actions">
                        <button className="meal-action-btn" title="Edit" onClick={() => startEditLog(log)}>✏️</button>
                        {confirmDelete === log.id ? (
                          <>
                            <button className="meal-action-btn confirm-del" onClick={() => deleteLog(log.id)}>Yes</button>
                            <button className="meal-action-btn" onClick={() => setConfirmDelete(null)}>No</button>
                          </>
                        ) : (
                          <button className="meal-action-btn" title="Delete (refunds calories)" onClick={() => setConfirmDelete(log.id)}>🗑️</button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ═══════ HABITS TAB ═══════ */}
        {tab === 'habits' && (
          <>
            {/* Overall progress */}
            <div className="section-title">Your Tasks</div>
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
            </div>

            {/* Daily Tasks */}
            {habits.filter(h => h.source === 'daily').length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">📋 Daily Tasks</div>
                {habits.filter(h => h.source === 'daily').map((habit) => (
                  <div className="habit-item" key={habit.id}>
                    <div
                      className={`habit-check ${habit.completed ? 'done' : ''}`}
                      onClick={() => toggleHabit(habit.id)}
                    >
                      {habit.completed ? '✓' : ''}
                    </div>
                    <span className={`habit-text ${habit.completed ? 'done' : ''}`}>
                      {habit.title}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Weekly Goals */}
            {habits.filter(h => h.source === 'weekly').length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">📅 Weekly Goals</div>
                {habits.filter(h => h.source === 'weekly').map((habit) => (
                  <div className="habit-item" key={habit.id}>
                    <div
                      className={`habit-check ${habit.completed ? 'done' : ''}`}
                      onClick={() => toggleHabit(habit.id)}
                    >
                      {habit.completed ? '✓' : ''}
                    </div>
                    <span className={`habit-text ${habit.completed ? 'done' : ''}`}>
                      {habit.title}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Monthly Challenges */}
            {habits.filter(h => h.source === 'monthly').length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">🏆 Monthly Challenges</div>
                {habits.filter(h => h.source === 'monthly').map((habit) => (
                  <div className="habit-item" key={habit.id}>
                    <div
                      className={`habit-check ${habit.completed ? 'done' : ''}`}
                      onClick={() => toggleHabit(habit.id)}
                    >
                      {habit.completed ? '✓' : ''}
                    </div>
                    <span className={`habit-text ${habit.completed ? 'done' : ''}`}>
                      {habit.title}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Coach/Custom tasks */}
            {habits.filter(h => h.source === 'coach' || h.source === 'custom').length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">✨ Your Tasks</div>
                {habits.filter(h => h.source === 'coach' || h.source === 'custom').map((habit) => (
                  <div className="habit-item" key={habit.id}>
                    <div
                      className={`habit-check ${habit.completed ? 'done' : ''}`}
                      onClick={() => toggleHabit(habit.id)}
                    >
                      {habit.completed ? '✓' : ''}
                    </div>
                    <span className={`habit-text ${habit.completed ? 'done' : ''}`}>
                      {habit.title}
                    </span>
                    <span className={`habit-source ${habit.source}`}>
                      {habit.source === 'coach' ? '🤖 Coach' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}

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
              Browse Videos
            </div>

            {/* Video tab pills */}
            <div className="video-tab-bar">
              {videoTabs.map((vt) => (
                <button
                  key={vt.id}
                  className={`video-tab-pill${activeVideoTab === vt.id ? ' active' : ''}`}
                  onClick={() => { setActiveVideoTab(vt.id); setVideoSearchTerm(''); setPlayingVideo(null); if (isNative) hapticTap(); }}
                >
                  {vt.label}
                </button>
              ))}
            </div>

            {/* Video filter */}
            <div className="input-row">
              <input
                className="input"
                value={videoSearchTerm}
                onChange={(e) => setVideoSearchTerm(e.target.value)}
                placeholder="Filter videos..."
                onKeyDown={(e) => { if (e.key === 'Enter' && videoSearchTerm.trim()) loadBrowseVideos(null, videoSearchTerm); }}
              />
              <button className="btn btn-primary" onClick={() => videoSearchTerm.trim() && loadBrowseVideos(null, videoSearchTerm)}>
                🔍
              </button>
            </div>

            {/* Embedded video player */}
            {playingVideo && (
              <div className="video-player-container">
                <div className="video-player-header">
                  <span className="video-player-title">{playingVideo.title}</span>
                  <button className="video-player-close" onClick={() => setPlayingVideo(null)}>✕</button>
                </div>
                <div className="video-embed-wrapper">
                  <iframe
                    className="video-embed"
                    src={playingVideo.embedUrl}
                    title={playingVideo.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                {playingVideo.channel && (
                  <div className="video-player-meta">{playingVideo.channel}</div>
                )}
              </div>
            )}

            {/* Video grid */}
            {browseLoading ? (
              <div style={{ textAlign: 'center', padding: 30 }}>
                <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2, margin: '0 auto' }} />
                <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 13 }}>Loading videos...</p>
              </div>
            ) : (
              <div className="video-grid">
                {browseVideos.map((v) => (
                  <div
                    className={`video-card${playingVideo && playingVideo.id === v.id ? ' playing' : ''}`}
                    key={v.id}
                    onClick={() => { setPlayingVideo(v); if (isNative) hapticTap(); }}
                  >
                    <div className="video-card-thumb">
                      {v.thumbnail ? (
                        <img src={v.thumbnail} alt={v.title} />
                      ) : (
                        <div className="video-card-thumb-placeholder">▶</div>
                      )}
                      <div className="video-card-play-overlay">▶</div>
                      {v.lengthSeconds > 0 && (
                        <span className="video-card-duration">
                          {Math.floor(v.lengthSeconds / 60)}:{String(v.lengthSeconds % 60).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    <div className="video-card-info">
                      <div className="video-card-title">{v.title}</div>
                      {v.channel && <div className="video-card-channel">{v.channel}</div>}
                    </div>
                  </div>
                ))}
                {browseVideos.length === 0 && !browseLoading && (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20, fontSize: 13 }}>
                    No videos found. Try another search or tab.
                  </p>
                )}
              </div>
            )}
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
