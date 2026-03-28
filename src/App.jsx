import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import './App.css';
import useCoachAI from './useCoachAI';
import OnboardingScreen from './OnboardingScreen';
import LandingPage from './LandingPage';
import AccountScreen from './AccountScreen';
import * as db from './db.js';
import { searchFoods as searchFoodsAPI, getMealSuggestions as getSuggestionsLocal, loadFoodDatabase, isFoodDBReady, getFoodCount } from './foodSearch.js';
import { generateTasks, currentPeriodKeys, pickCoachTask } from './taskGenerator.js';

import { isNative, initStatusBar, readNativeSteps, takePhoto, pickImage, hapticTap, hapticSuccess, hapticWarning, hapticHeavy, subscribePedometer, nativeShare, scheduleNotification, keepAwake } from './native';
import { fetchCategoryVideos, searchCachedVideos, VIDEO_CATEGORIES } from './youtubeRSS.js';
import { fetchRecipeFeeds, pickDailyMeals } from './recipeRSS.js';
import { generateRecipe } from './recipeGenerator.js';

const TABS = [
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'food', icon: '🍽️', label: 'Food' },
  { id: 'habits', icon: '✅', label: 'Habits' },
  { id: 'videos', icon: '🎬', label: 'Videos' },
  { id: 'coach', icon: '💬', label: 'Coach' },
  { id: 'account', icon: '⚙️', label: 'Account' },
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
  const [user, setUser] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLanding, setShowLanding] = useState(!isNative && !window.location.hash);

  const VALID_TABS = ['home', 'food', 'habits', 'videos', 'coach'];
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
    const onHash = () => {
      if (!window.location.hash) {
        setShowLanding(true);
      } else {
        setShowLanding(false);
        setTabState(getHashTab());
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Theme: apply to document + persist + notify native
  const applyTheme = useCallback((t) => {
    if (t === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
    // Tell native app about theme for status bar
    const isDark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isNative) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'themeChange', isDark }));
    }
  }, []);

  const setTheme = useCallback(async (t) => {
    setThemeState(t);
    applyTheme(t);
    try { await db.setSetting('ff_theme', t); } catch {}
  }, [applyTheme]);

  // Load saved theme on mount
  useEffect(() => {
    db.getSetting('ff_theme').then((saved) => {
      if (saved && ['auto', 'light', 'dark'].includes(saved)) {
        setThemeState(saved);
        applyTheme(saved);
      }
    }).catch(() => {});
  }, [applyTheme]);

  const [logs, setLogs] = useState([]);
  const [meal, setMeal] = useState('');
  const [mealCals, setMealCals] = useState('');
  const [mealProtein, setMealProtein] = useState('');
  const [mealCarbs, setMealCarbs] = useState('');
  const [mealFat, setMealFat] = useState('');
  const [mealRecipeUrl, setMealRecipeUrl] = useState('');

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
  const { coachName, chat: aiChat } = useCoachAI(user?.id || 'local');
  const [mealSuggestions, setMealSuggestions] = useState(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem('ff_suggestions') || '[]');
      for (const item of cached) {
        if (!item.recipe) {
          item.recipe = generateRecipe(item.name);
        }
      }
      return cached;
    } catch { return []; }
  });
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState(null);
  const [expandedLog, setExpandedLog] = useState(null);
  const [theme, setThemeState] = useState('auto'); // 'auto' | 'light' | 'dark'

  const [habits, setHabits] = useState([]);
  const [newHabit, setNewHabit] = useState('');

  const [playlist, setPlaylist] = useState([]);
  const [workoutCategory, setWorkoutCategory] = useState('');
  const [workoutSearchTerm, setWorkoutSearchTerm] = useState('');
  const [workoutResults, setWorkoutResults] = useState([]);

  const initRef = useRef(false);
  const [videoTabs, setVideoTabs] = useState([]);
  const [activeVideoTab, setActiveVideoTab] = useState('chair');
  const [browseVideos, setBrowseVideos] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [videoSearchTerm, setVideoSearchTerm] = useState('');
  const [playingVideo, setPlayingVideo] = useState(null);

  const [favoriteMeals, setFavoriteMeals] = useState([]);

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

  // Streaks & badges
  const [streakData, setStreakData] = useState(null);
  // Weekly summary
  const [weeklySummary, setWeeklySummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [foodDbProgress, setFoodDbProgress] = useState(null); // { status, loaded, total, category }

  const handleOnboardComplete = async (profileData) => {
    const saved = await db.saveProfile({ ...profileData, onboarded: true });
    setUser(saved);
    setShowOnboarding(false);

    // Seed initial tasks since the init useEffect returned early before onboarding
    const { daily, weekly, monthly } = generateTasks(saved);
    const seeded = [];
    for (const t of daily) { try { seeded.push(await db.addHabit({ title: t, source: 'daily' })); } catch {} }
    for (const t of weekly) { try { seeded.push(await db.addHabit({ title: t, source: 'weekly' })); } catch {} }
    for (const t of monthly) { try { seeded.push(await db.addHabit({ title: t, source: 'monthly' })); } catch {} }
    setHabits(seeded.length > 0 ? seeded : [
      ...daily.map((t, i) => ({ id: `fb-d${i}`, title: t, completed: false, source: 'daily' })),
      ...weekly.map((t, i) => ({ id: `fb-w${i}`, title: t, completed: false, source: 'weekly' })),
      ...monthly.map((t, i) => ({ id: `fb-m${i}`, title: t, completed: false, source: 'monthly' })),
    ]);
    await db.setSetting('ff_taskPeriods', currentPeriodKeys());

    // Load food DB + RSS in background
    loadFoodDatabase((p) => setFoodDbProgress(p)).catch(console.error);
    fetchRecipeFeeds().then((rssRecipes) => {
      setDailyMeals(pickDailyMeals(rssRecipes));
    }).catch(console.error);
  };

  const handleLogout = async () => {
    setUser(null);
    // Return to landing page (web) or stay at onboarding (mobile)
    if (!isNative) {
      window.location.hash = '';
      setShowLanding(true);
    }
  };

  const handleProfileUpdate = async (profileData) => {
    const saved = await db.saveProfile(profileData);
    setUser(saved);
  };

  // Refresh auto-generated tasks when the period rolls over (dedup-safe)
  // Completed tasks are preserved (archived), only uncompleted ones are replaced.
  const refreshAutoTasks = async (profile, existingHabits) => {
    const periods = currentPeriodKeys();
    const stored = (await db.getSetting('ff_taskPeriods')) || {};
    const { daily, weekly, monthly } = generateTasks(profile);
    let allHabits = [...existingHabits];
    let changed = false;

    const archiveSource = (src) => `done-${src}`; // e.g. 'done-daily'

    const refreshCategory = async (source, newTitles, periodKey, storedKey) => {
      if (storedKey === periodKey) {
        // Period matches — just deduplicate any existing duplicates in DB
        const existing = allHabits.filter(h => h.source === source);
        // If period matches but no tasks exist yet (e.g. fresh DB), fall through to insert
        if (existing.length > 0) {
          const seen = new Set();
          for (const h of existing) {
            if (seen.has(h.title)) {
              await db.deleteHabit(h.id);
              allHabits = allHabits.filter(x => x.id !== h.id);
              changed = true;
            } else {
              seen.add(h.title);
            }
          }
          return;
        }
      }
      // Period rolled over — archive completed tasks, delete uncompleted
      const old = allHabits.filter(h => h.source === source);
      for (const h of old) {
        if (h.completed) {
          // Keep completed tasks under an archived source so they persist
          await db.updateHabitSource(h.id, archiveSource(source));
          const idx = allHabits.findIndex(x => x.id === h.id);
          if (idx >= 0) allHabits[idx] = { ...allHabits[idx], source: archiveSource(source) };
        } else {
          await db.deleteHabit(h.id);
          allHabits = allHabits.filter(x => x.id !== h.id);
        }
      }
      // Insert fresh tasks — skip if title already exists (dedup guard)
      const existingTitles = new Set(allHabits.map(h => h.title));
      for (const title of newTitles) {
        if (existingTitles.has(title)) continue;
        const h = await db.addHabit({ title, source });
        allHabits.push(h);
        existingTitles.add(title);
      }
      changed = true;
    };

    await refreshCategory('daily', daily, periods.daily, stored.daily);
    await refreshCategory('weekly', weekly, periods.weekly, stored.weekly);
    await refreshCategory('monthly', monthly, periods.monthly, stored.monthly);

    if (changed) {
      setHabits(allHabits);
    }
    // Always persist period keys so next load skips refresh
    await db.setSetting('ff_taskPeriods', periods);
  };

  // Load all data from local RxDB (guarded against StrictMode double-mount)
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      try {
        setLoading(true);

        // Load or create profile
        let profile = await db.getProfile();
        if (!profile) {
          setShowOnboarding(true);
          setLoading(false);
          return;
        }
        setUser(profile);
        if (!profile.onboarded) { setShowOnboarding(true); setLoading(false); return; }

        // Load all data in parallel (each wrapped so one failure doesn't block the rest)
        const safe = (fn, fallback) => fn().catch((e) => { console.warn('DB load fallback:', e); return fallback; });
        const [logsData, habitsData, weightData, waterData, stepsData, chatData, favsData, streaksData, weeklyData] = await Promise.all([
          safe(() => db.getFoodLogs(), []),
          safe(() => db.getHabits(), []),
          safe(() => db.getWeightLogs(), []),
          safe(() => db.getWaterToday(), 0),
          safe(() => db.getStepsToday(), 0),
          safe(() => db.getChatMessages(), []),
          safe(() => db.getFavoriteMeals(), []),
          safe(() => db.getStreaks(), {}),
          safe(() => db.getWeeklySummary(), null),
        ]);

        setLogs(logsData);
        setHabits(habitsData);
        setWeightLogs(weightData);
        setWaterGlasses(waterData);
        setStepsToday(stepsData);
        setChatHistory(chatData);
        setFavoriteMeals(favsData);
        setStreakData(streaksData);
        setWeeklySummary(weeklyData);

        // Generate/refresh daily, weekly, monthly tasks
        // If DB is fresh (no habits), seed immediately so UI shows tasks without waiting
        if (habitsData.length === 0) {
          const { daily, weekly, monthly } = generateTasks(profile);
          const seeded = [];
          for (const t of daily) { try { seeded.push(await db.addHabit({ title: t, source: 'daily' })); } catch {} }
          for (const t of weekly) { try { seeded.push(await db.addHabit({ title: t, source: 'weekly' })); } catch {} }
          for (const t of monthly) { try { seeded.push(await db.addHabit({ title: t, source: 'monthly' })); } catch {} }
          if (seeded.length > 0) {
            setHabits(seeded);
            await db.setSetting('ff_taskPeriods', currentPeriodKeys());
          } else {
            // DB insert failed entirely — show in-memory fallback
            const fallback = [
              ...daily.map((t, i) => ({ id: `fb-d${i}`, title: t, completed: false, source: 'daily' })),
              ...weekly.map((t, i) => ({ id: `fb-w${i}`, title: t, completed: false, source: 'weekly' })),
              ...monthly.map((t, i) => ({ id: `fb-m${i}`, title: t, completed: false, source: 'monthly' })),
            ];
            setHabits(fallback);
          }
        } else {
          refreshAutoTasks(profile, habitsData).catch(console.error);
        }

        // Load food reference database in background
        loadFoodDatabase((p) => setFoodDbProgress(p)).catch(console.error);

        // Load RSS recipe feeds for daily meal plan
        fetchRecipeFeeds().then((rssRecipes) => {
          const meals = pickDailyMeals(rssRecipes);
          setDailyMeals(meals);
        }).catch(console.error);
      } catch (err) {
        console.error(err);
        setLoadError('Unable to load local data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalCals = useMemo(() => logs.reduce((s, l) => s + (l.calories || 0), 0), [logs]);
  const totalProtein = useMemo(() => logs.reduce((s, l) => s + (l.protein || 0), 0), [logs]);
  const totalCarbs = useMemo(() => logs.reduce((s, l) => s + (l.carbs || 0), 0), [logs]);
  const totalFat = useMemo(() => logs.reduce((s, l) => s + (l.fat || 0), 0), [logs]);
  const habitsCompleted = useMemo(() => habits.filter((h) => h.completed).length, [habits]);
  const calGoal = user?.calorieGoal || 1800;

  // Debounced food search — waits 200ms after last keystroke
  const searchTimerRef = useRef(null);
  const searchFoods = useCallback((query) => {
    setFoodSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.trim().length < 2) { setFoodSearchResults([]); setShowFoodSearch(false); return; }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchFoodsAPI(query.trim());
        setFoodSearchResults(results || []);
        setShowFoodSearch(true);
      } catch { setFoodSearchResults([]); }
    }, 200);
  }, []);

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
    const log = await db.addWeightLog({ weight: parseFloat(weightInput), unit: weightUnit });
    setWeightLogs(prev => [log, ...prev]);
    setWeightInput('');
  };

  // ── Water handlers ──
  const updateWater = async (delta) => {
    const next = Math.max(0, waterGlasses + delta);
    if (next >= waterGoal && waterGlasses < waterGoal) hapticSuccess();
    else hapticTap();
    setWaterGlasses(next);
    await db.setWaterToday(next);
  };

  // ── Progress photo handler (stored as data URLs locally) ──
  const uploadProgressPhoto = async () => {
    if (!photoFile) return;
    hapticSuccess();
    const reader = new FileReader();
    reader.onload = () => {
      const photo = {
        id: Date.now().toString(36),
        imageUrl: reader.result,
        note: photoNote,
        loggedAt: new Date().toISOString(),
      };
      setProgressPhotos(prev => [photo, ...prev]);
      db.addPhoto(photo).catch(console.error);
      setPhotoFile(null);
      setPhotoNote('');
    };
    reader.readAsDataURL(photoFile);
  };

  const deleteProgressPhoto = (id) => {
    hapticWarning();
    setProgressPhotos(prev => prev.filter(p => p.id !== id));
    db.deletePhoto(id).catch(console.error);
  };

  // ── Step handlers ──
  const logSteps = async () => {
    if (!stepInput) return;
    hapticTap();
    const steps = parseInt(stepInput, 10);
    await db.setStepsToday(steps);
    setStepsToday(steps);
    setStepInput('');
  };

  const syncNativeSteps = async () => {
    const { steps } = await readNativeSteps();
    if (steps > 0) {
      hapticTap();
      await db.setStepsToday(steps);
      setStepsToday(steps);
    }
  };

  // Init native status bar + auto-sync steps + live pedometer
  useEffect(() => {
    initStatusBar();
    // Load progress photos from RxDB
    db.getPhotos().then(photos => setProgressPhotos(photos)).catch(console.error);
    // Auto sync steps from pedometer when native
    if (isNative) {
      readNativeSteps().then(({ steps }) => {
        if (steps > 0) {
          db.setStepsToday(steps).then(() => setStepsToday(steps));
        }
      });
    }
  }, []);

  // Live pedometer — update step count in real time on native
  useEffect(() => {
    if (!isNative) return;
    const unsub = subscribePedometer((steps) => {
      setStepsToday(steps);
    });
    return unsub;
  }, []);

  // Celebrate step goal
  useEffect(() => {
    if (stepsToday >= stepGoal && stepsToday > 0) {
      hapticSuccess();
    }
  }, [stepsToday, stepGoal]);

  // Schedule daily reminder notification on native
  useEffect(() => {
    if (isNative) {
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
  }, []);

  const addLog = async (e) => {
    e.preventDefault();
    if (!meal.trim()) return;
    hapticTap();
    const newLog = await db.addFoodLog({
      meal,
      calories: parseInt(mealCals, 10) || 0,
      protein: parseInt(mealProtein, 10) || 0,
      carbs: parseInt(mealCarbs, 10) || 0,
      fat: parseInt(mealFat, 10) || 0,
      recipeUrl: mealRecipeUrl || '',
    });
    setLogs(prev => [newLog, ...prev]);
    setMeal('');
    setMealCals('');
    setMealProtein('');
    setMealCarbs('');
    setMealFat('');
    setMealRecipeUrl('');
  };

  const logRecipe = async (recipe) => {
    hapticSuccess();
    const newLog = await db.addFoodLog({
      meal: recipe.name,
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      recipeUrl: recipe.recipeUrl || '',
    });
    setLogs(prev => [newLog, ...prev]);
  };

  const deleteLog = async (id) => {
    await db.deleteFoodLog(id);
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
    const updated = await db.updateFoodLog(id, {
      meal: editMeal,
      calories: parseInt(editCals, 10) || 0,
      protein: parseInt(editProtein, 10) || 0,
      carbs: parseInt(editCarbs, 10) || 0,
      fat: parseInt(editFat, 10) || 0,
    });
    if (updated) {
      setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    }
    setEditingLog(null);
  };

  const loadFavorites = async () => {
    try {
      setFavoriteMeals(await db.getFavoriteMeals());
    } catch { /* ignore */ }
  };

  const saveFavorite = async () => {
    if (!meal.trim()) return;
    try {
      const fav = await db.addFavoriteMeal({ meal, calories: +mealCals || 0, protein: +mealProtein || 0, carbs: +mealCarbs || 0, fat: +mealFat || 0 });
      setFavoriteMeals(prev => [fav, ...prev]);
    } catch { /* ignore */ }
  };

  const deleteFavorite = async (id) => {
    try {
      await db.deleteFavoriteMeal(id);
      setFavoriteMeals(prev => prev.filter(f => f.id !== id));
    } catch { /* ignore */ }
  };

  const logFavorite = (fav) => {
    setMeal(fav.meal);
    setMealCals(String(fav.calories || ''));
    setMealProtein(String(fav.protein || ''));
    setMealCarbs(String(fav.carbs || ''));
    setMealFat(String(fav.fat || ''));
  };

  const getMealSuggestions = async () => {
    setSuggestionsLoading(true);
    setMealSuggestions([]);
    const remaining = Math.max(0, calGoal - totalCals);
    try {
      // Get food suggestions from FDC database
      const foodSuggestions = getSuggestionsLocal(remaining, user?.goalType || 'lose');

      // Include user's saved recipes that fit remaining calories
      const userRecipes = await db.getRecipes();
      const maxCal = remaining > 0 ? remaining : 500;
      const savedSuggestions = userRecipes
        .filter((r) => r.calories > 0 && r.calories <= maxCal)
        .sort(() => Math.random() - 0.5)
        .slice(0, 2)
        .map((r) => ({
          name: `📖 ${r.name}`,
          calories: r.calories,
          protein: r.protein || 0,
          carbs: r.carbs || 0,
          fat: r.fat || 0,
          serving: r.servings ? `${r.servings} serving(s)` : '1 serving',
          color: r.calories <= 100 ? 'green' : r.calories <= 300 ? 'yellow' : 'red',
        }));

      // Fetch ALL RSS recipes and interleave throughout
      let rssSuggestions = [];
      try {
        const rssRecipes = await fetchRecipeFeeds();
        rssSuggestions = rssRecipes
          .sort(() => Math.random() - 0.5)
          .map((r) => {
            // Estimate macros from recipe title keywords
            const t = r.title.toLowerCase();
            let cal, p, c, f;
            if (/salad|dressing|greens|slaw/i.test(t)) {
              cal = 150 + Math.floor(Math.random() * 150); p = 5 + Math.floor(Math.random() * 10); c = 10 + Math.floor(Math.random() * 15); f = 8 + Math.floor(Math.random() * 12);
            } else if (/chicken|turkey|grilled/i.test(t)) {
              cal = 300 + Math.floor(Math.random() * 200); p = 28 + Math.floor(Math.random() * 15); c = 15 + Math.floor(Math.random() * 25); f = 8 + Math.floor(Math.random() * 12);
            } else if (/salmon|fish|shrimp|seafood|tuna/i.test(t)) {
              cal = 280 + Math.floor(Math.random() * 180); p = 25 + Math.floor(Math.random() * 15); c = 10 + Math.floor(Math.random() * 20); f = 10 + Math.floor(Math.random() * 14);
            } else if (/steak|beef|burger|meat/i.test(t)) {
              cal = 400 + Math.floor(Math.random() * 250); p = 30 + Math.floor(Math.random() * 15); c = 10 + Math.floor(Math.random() * 30); f = 18 + Math.floor(Math.random() * 16);
            } else if (/pasta|noodle|mac|spaghetti|lasagna/i.test(t)) {
              cal = 350 + Math.floor(Math.random() * 250); p = 12 + Math.floor(Math.random() * 15); c = 40 + Math.floor(Math.random() * 30); f = 10 + Math.floor(Math.random() * 15);
            } else if (/soup|stew|chili|chowder/i.test(t)) {
              cal = 200 + Math.floor(Math.random() * 200); p = 10 + Math.floor(Math.random() * 18); c = 15 + Math.floor(Math.random() * 25); f = 6 + Math.floor(Math.random() * 12);
            } else if (/cake|cookie|brownie|dessert|pie|sweet|chocolate|muffin/i.test(t)) {
              cal = 250 + Math.floor(Math.random() * 250); p = 3 + Math.floor(Math.random() * 6); c = 30 + Math.floor(Math.random() * 35); f = 10 + Math.floor(Math.random() * 18);
            } else if (/smoothie|shake|juice|drink/i.test(t)) {
              cal = 150 + Math.floor(Math.random() * 200); p = 5 + Math.floor(Math.random() * 20); c = 20 + Math.floor(Math.random() * 30); f = 2 + Math.floor(Math.random() * 10);
            } else if (/rice|bowl|burrito|wrap|taco/i.test(t)) {
              cal = 350 + Math.floor(Math.random() * 200); p = 15 + Math.floor(Math.random() * 18); c = 35 + Math.floor(Math.random() * 30); f = 10 + Math.floor(Math.random() * 14);
            } else if (/egg|omelette|frittata|breakfast/i.test(t)) {
              cal = 200 + Math.floor(Math.random() * 200); p = 14 + Math.floor(Math.random() * 14); c = 8 + Math.floor(Math.random() * 20); f = 10 + Math.floor(Math.random() * 14);
            } else if (/pizza|flatbread/i.test(t)) {
              cal = 300 + Math.floor(Math.random() * 250); p = 12 + Math.floor(Math.random() * 12); c = 30 + Math.floor(Math.random() * 25); f = 12 + Math.floor(Math.random() * 16);
            } else {
              cal = 250 + Math.floor(Math.random() * 250); p = 10 + Math.floor(Math.random() * 20); c = 20 + Math.floor(Math.random() * 30); f = 8 + Math.floor(Math.random() * 16);
            }
            return {
              name: r.title,
              calories: cal,
              protein: p,
              carbs: c,
              fat: f,
              serving: '1 serving',
              color: cal <= 200 ? 'green' : cal <= 400 ? 'yellow' : 'red',
              recipeUrl: r.link,
              recipeSource: r.source,
              recipeDescription: r.description,
              recipeImage: r.image,
            };
          });
      } catch { /* ignore */ }

      // Interleave: alternate RSS recipes with FDC foods, saved recipes up front
      const interleaved = [...savedSuggestions];
      const rssPool = [...rssSuggestions];
      const fdcPool = [...foodSuggestions];
      while (interleaved.length < 8 && (rssPool.length || fdcPool.length)) {
        if (rssPool.length) interleaved.push(rssPool.shift());
        if (interleaved.length < 8 && fdcPool.length) interleaved.push(fdcPool.shift());
      }

      // Ensure every suggestion has a generated recipe
      for (const item of interleaved) {
        if (!item.recipe) {
          item.recipe = generateRecipe(item.name);
        }
      }

      setMealSuggestions(interleaved);
      try { sessionStorage.setItem('ff_suggestions', JSON.stringify(interleaved)); } catch { /* ignore */ }
    } catch { /* ignore */ }
    setSuggestionsLoading(false);
  };

  const logSuggestion = async (meal) => {
    hapticSuccess();
    const cleanName = meal.name.replace(/^[📖🔗]\s*/, '');
    const newLog = await db.addFoodLog({
      meal: cleanName,
      calories: parseInt(meal.calories, 10) || 0,
      protein: parseInt(meal.protein, 10) || 0,
      carbs: parseInt(meal.carbs, 10) || 0,
      fat: parseInt(meal.fat, 10) || 0,
      recipeUrl: meal.recipeUrl || '',
      recipeIngredients: meal.recipe?.ingredients ? JSON.stringify(meal.recipe.ingredients) : '',
      recipeSteps: meal.recipe?.steps ? JSON.stringify(meal.recipe.steps) : '',
      recipeSource: meal.recipeSource || '',
    });
    setLogs(prev => [newLog, ...prev]);

    // Save RSS recipes to user's recipe collection for future reference
    if (meal.recipeUrl) {
      try {
        await db.addRecipe({
          name: cleanName,
          calories: meal.calories || 0,
          protein: meal.protein || 0,
          carbs: meal.carbs || 0,
          fat: meal.fat || 0,
          ingredients: '',
          instructions: `View full recipe: ${meal.recipeUrl}\n\nSource: ${meal.recipeSource || ''}\n${meal.recipeDescription || ''}`,
        });
      } catch { /* ignore dupes */ }
    }
  };

  const saveSuggestion = async (meal) => {
    const cleanName = meal.name.replace(/^[📖🔗]\s*/, '');
    try {
      await db.addRecipe({
        name: cleanName,
        calories: meal.calories || 0,
        protein: meal.protein || 0,
        carbs: meal.carbs || 0,
        fat: meal.fat || 0,
        ingredients: '',
        instructions: meal.recipeUrl
          ? `View full recipe: ${meal.recipeUrl}\n\nSource: ${meal.recipeSource || ''}\n${meal.recipeDescription || ''}`
          : '',
      });
      setMealSuggestions(prev => prev.map(m =>
        m === meal ? { ...m, _saved: true } : m
      ));
    } catch {
      setMealSuggestions(prev => prev.map(m =>
        m === meal ? { ...m, _saved: true } : m
      ));
    }
  };

  // ── Streaks & Badges ──
  const fetchStreaks = async () => {
    try {
      setStreakData(await db.getStreaks());
    } catch { /* ignore */ }
  };

  // ── Weekly Summary ──
  const fetchWeeklySummary = async () => {
    try {
      setWeeklySummary(await db.getWeeklySummary());
    } catch { /* ignore */ }
  };

  const sendCoachQuery = async () => {
    if (!coachQuery.trim()) return;
    const q = coachQuery;
    setChatHistory((prev) => [...prev, { role: 'user', text: q }]);
    setCoachQuery('');
    setCoachTyping(true);
    try {
      const history = [...chatHistory, { role: 'user', text: q }];
      let streamed = '';
      const answer = await aiChat(history, {
        userData: {
          totalCals,
          calGoal,
          totalProtein,
          habitsCompleted,
          habitsTotal: habits.length,
          goalType: user?.goalType,
          name: user?.name,
        },
        onToken: (token) => {
          streamed += token;
          // Update last coach message in-place for live streaming
          setChatHistory((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'coach' && last._streaming) {
              return [...prev.slice(0, -1), { role: 'coach', text: streamed, _streaming: true }];
            }
            return [...prev, { role: 'coach', text: streamed, _streaming: true }];
          });
          setCoachTyping(false); // hide "thinking" once first token arrives
        },
      });
      // Finalize the streamed message (remove _streaming flag)
      setChatHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last && last._streaming) {
          return [...prev.slice(0, -1), { role: 'coach', text: answer }];
        }
        return [...prev, { role: 'coach', text: answer }];
      });
      // Persist both messages to local DB
      db.addChatMessages([{ role: 'user', text: q }, { role: 'coach', text: answer }]).catch(() => {});

      // Detect if user asked for a task/habit and auto-assign one
      const askPatterns = /assign|give me|suggest.*task|add.*task|add.*habit|new.*task|daily.*task|challenge|set.*goal|recommend|what should i do/i;
      if (askPatterns.test(q)) {
        // Pick a relevant, actionable task based on what the user asked about
        const existingTitles = habits.map(h => h.title || '');
        const taskTitle = pickCoachTask(q, user?.goalType || 'maintain', existingTitles);
        try {
          const newTask = await db.addHabit({ title: taskTitle, source: 'coach' });
          setHabits((prev) => [...prev, newTask]);
          const taskMsg = `✅ I've added "${taskTitle}" to your tasks!`;
          setChatHistory((prev) => [...prev, { role: 'coach', text: taskMsg }]);
          db.addChatMessages([{ role: 'coach', text: taskMsg }]).catch(() => {});
        } catch { /* ignore assign error */ }
      }
    } catch {
      const errMsg = "Sorry, I couldn't process that. Try again!";
      setChatHistory((prev) => [...prev, { role: 'coach', text: errMsg }]);
      db.addChatMessages([{ role: 'user', text: q }, { role: 'coach', text: errMsg }]).catch(() => {});
    } finally {
      setCoachTyping(false);
    }
  };

  const addHabit = async () => {
    if (!newHabit.trim()) return;
    hapticTap();
    const habit = await db.addHabit(newHabit);
    setHabits((prev) => [...prev, habit]);
    setNewHabit('');
  };

  const toggleHabit = async (id) => {
    const updated = await db.toggleHabit(id);
    if (updated.completed) hapticSuccess(); else hapticTap();
    setHabits((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
  };

  const deleteHabit = async (id) => {
    await db.deleteHabit(id);
    setHabits((prev) => prev.filter((h) => h.id !== id));
  };

  // ── Workouts search (uses RSS videos) ──
  const searchWorkouts = async () => {
    if (!workoutSearchTerm.trim()) return;
    const results = searchCachedVideos(workoutSearchTerm);
    setWorkoutResults(results);
  };

  // ── Video browse helpers (YouTube RSS) ──
  const loadVideoTabs = () => {
    setVideoTabs(VIDEO_CATEGORIES);
  };

  const loadBrowseVideos = async (tabId, query) => {
    setBrowseLoading(true);
    try {
      if (query) {
        // First ensure at least one category is fetched so cache has data
        await fetchCategoryVideos(activeVideoTab);
        setBrowseVideos(searchCachedVideos(query));
      } else {
        const videos = await fetchCategoryVideos(tabId || activeVideoTab);
        setBrowseVideos(videos);
      }
    } catch (err) {
      console.warn('Failed to load videos:', err);
      setBrowseVideos([]);
    }
    setBrowseLoading(false);
  };

  useEffect(() => {
    if (tab === 'videos') {
      if (videoTabs.length === 0) loadVideoTabs();
      loadBrowseVideos(activeVideoTab);
    }
  }, [tab, activeVideoTab]);

  if (showLanding) {
    return <LandingPage onLaunch={() => { setShowLanding(false); window.location.hash = 'home'; }} />;
  }

  if (!user) {
    return <OnboardingScreen onComplete={handleOnboardComplete} />;
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardComplete} />;
  }

  if (loading) {
    return (
      <div className="app-shell">
        <div className="main-area">
          <div className="app-header">
            <h1>FitFlow</h1>
            <div className="header-right">
              <div className="skeleton skeleton-badge" />
              <div className="skeleton skeleton-btn" />
            </div>
          </div>
          <div className="tab-content">
            <div className="skeleton skeleton-title" />
            <div className="card">
              <div className="skeleton skeleton-ring" />
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
                <div className="skeleton skeleton-macro" />
                <div className="skeleton skeleton-macro" />
                <div className="skeleton skeleton-macro" />
              </div>
            </div>
            <div className="skeleton skeleton-title" style={{ marginTop: 16 }} />
            <div className="card">
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line short" />
              <div className="skeleton skeleton-line" />
            </div>
            <div className="skeleton skeleton-title" style={{ marginTop: 16 }} />
            <div className="card">
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line short" />
            </div>
          </div>
        </div>
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
        {TABS.filter((t) => t.id !== 'account').map((t) => (
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
        <button className={`sidebar-item ${tab === 'account' ? 'active' : ''}`} onClick={() => setTab('account')}>
          <span className="sidebar-icon">⚙️</span>
          Account
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
            <div className="theme-toggle">
              <button className={`theme-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')} title="Light mode">☀️</button>
              <button className={`theme-btn ${theme === 'auto' ? 'active' : ''}`} onClick={() => setTheme('auto')} title="Auto (system)">🔄</button>
              <button className={`theme-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')} title="Dark mode">🌙</button>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setTab('account')}>⚙️</button>
          </div>
        </div>

        {/* Content */}
        <div className="tab-content">
        {loadError && <div className="error-banner">{loadError}</div>}

        {/* ═══════ HOME TAB ═══════ */}
        {tab === 'home' && (
          <>
            {/* Streak Banner */}
            {(streakData?.currentStreak > 0 || logs.length > 0) && (
            <div className="streak-banner">
              <div className="flame">🔥</div>
              <div>
                <div className="text">{streakData?.currentStreak || 1} Day Streak!</div>
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
              {habits.filter(h => h.source === 'daily').map((habit) => (
                <div className="habit-item" key={habit.id}>
                  <div className={`habit-check ${habit.completed ? 'done' : ''}`} onClick={() => toggleHabit(habit.id)}>
                    {habit.completed ? '✓' : ''}
                  </div>
                  <span className={`habit-text ${habit.completed ? 'done' : ''}`}>{habit.title}</span>
                </div>
              ))}
              {habits.filter(h => h.source === 'daily').length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '4px 0' }}>Loading tasks...</div>
              )}
            </div>

            {/* Weekly Goals */}
            <div className="card">
              <div className="card-title">📅 Weekly Goals</div>
              {habits.filter(h => h.source === 'weekly').map((habit) => (
                <div className="habit-item" key={habit.id}>
                  <div className={`habit-check ${habit.completed ? 'done' : ''}`} onClick={() => toggleHabit(habit.id)}>
                    {habit.completed ? '✓' : ''}
                  </div>
                  <span className={`habit-text ${habit.completed ? 'done' : ''}`}>{habit.title}</span>
                </div>
              ))}
            </div>

            {/* Monthly Challenges */}
            <div className="card">
              <div className="card-title">🏆 Monthly Challenges</div>
              {habits.filter(h => h.source === 'monthly').map((habit) => (
                <div className="habit-item" key={habit.id}>
                  <div className={`habit-check ${habit.completed ? 'done' : ''}`} onClick={() => toggleHabit(habit.id)}>
                    {habit.completed ? '✓' : ''}
                  </div>
                  <span className={`habit-text ${habit.completed ? 'done' : ''}`}>{habit.title}</span>
                </div>
              ))}
              {habits.length > 7 && (
                <button className="btn btn-secondary btn-full" style={{ marginTop: 8 }} onClick={() => setTab('habits')}>
                  View all tasks →
                </button>
              )}
            </div>
            </div>

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

            {/* ── Calorie History Chart ── */}
            {weeklySummary?.calorieByDay?.length > 1 && (
              <div className="card chart-card">
                <div className="card-title">📊 Calorie History (7 Days)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weeklySummary.calorieByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="day" stroke="#aaa" fontSize={12} />
                    <YAxis stroke="#aaa" fontSize={12} />
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                    <Bar dataKey="calories" fill="#4CAF50" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Weight Trend Chart ── */}
            {weightLogs.length > 2 && (
              <div className="card chart-card">
                <div className="card-title">📈 Weight Trend</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={[...weightLogs].reverse().slice(-14).map(w => ({ date: new Date(w.loggedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }), weight: w.weight }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" stroke="#aaa" fontSize={11} />
                    <YAxis stroke="#aaa" fontSize={12} domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="weight" stroke="#FF9800" strokeWidth={2} dot={{ fill: '#FF9800', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Weekly Summary ── */}
            {weeklySummary && (
              <div className="card weekly-summary-card">
                <div className="card-title">📋 Weekly Summary</div>
                <div className="weekly-grid">
                  <div className="weekly-stat">
                    <div className="weekly-stat-value">{weeklySummary.avgCals || 0}</div>
                    <div className="weekly-stat-label">Avg Calories</div>
                  </div>
                  <div className="weekly-stat">
                    <div className="weekly-stat-value">{weeklySummary.totalProtein || 0}g</div>
                    <div className="weekly-stat-label">Total Protein</div>
                  </div>
                  <div className="weekly-stat">
                    <div className="weekly-stat-value">{weeklySummary.daysLogged || 0}/7</div>
                    <div className="weekly-stat-label">Days Logged</div>
                  </div>
                  <div className="weekly-stat">
                    <div className="weekly-stat-value">{weeklySummary.habitsCompleted || 0}</div>
                    <div className="weekly-stat-label">Habits Done</div>
                  </div>
                  <div className="weekly-stat">
                    <div className="weekly-stat-value">{weeklySummary.avgSteps || 0}</div>
                    <div className="weekly-stat-label">Avg Steps</div>
                  </div>
                  <div className="weekly-stat">
                    <div className="weekly-stat-value">{weeklySummary.waterGoalDays || 0}</div>
                    <div className="weekly-stat-label">Water Goals</div>
                  </div>
                </div>
                {weeklySummary.weightChange !== undefined && weeklySummary.weightChange !== null && (
                  <div className={`weekly-weight-change ${weeklySummary.weightChange < 0 ? 'loss' : weeklySummary.weightChange > 0 ? 'gain' : ''}`}>
                    Weight this week: {weeklySummary.weightChange > 0 ? '+' : ''}{weeklySummary.weightChange} lbs
                  </div>
                )}
              </div>
            )}

            {/* ── Badges ── */}
            {streakData?.badges && streakData.badges.length > 0 && (
              <div className="card badges-card">
                <div className="card-title">🏅 Badges</div>
                <div className="badges-grid">
                  {streakData.badges.map((badge, i) => (
                    <div key={i} className={`badge-item ${badge.earned ? 'earned' : 'locked'}`}>
                      <div className="badge-icon">{badge.earned ? badge.icon : '🔒'}</div>
                      <div className="badge-name">{badge.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="quick-add">
              <button onClick={() => setTab('food')}>🍽️ Log Meal</button>
              <button onClick={() => setTab('coach')}>💬 Ask Coach</button>
              <button onClick={() => setTab('videos')}>🎬 Videos</button>
            </div>
          </>
        )}

        {/* ═══════ FOOD TAB ═══════ */}
        {tab === 'food' && (
          <>
            {/* Food database loading banner */}
            {foodDbProgress && foodDbProgress.status !== 'done' && (
              <div className="card" style={{ padding: '12px 16px', marginBottom: 12, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                {foodDbProgress.status === 'cache' ? '⏳ Loading food database...' : (
                  <>⏳ Downloading food database... {foodDbProgress.loaded?.toLocaleString()} / {foodDbProgress.total?.toLocaleString()} foods</>
                )}
                {foodDbProgress.total > 0 && (
                  <div style={{ marginTop: 6, height: 4, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round((foodDbProgress.loaded / foodDbProgress.total) * 100)}%`, background: 'var(--primary)', borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                )}
              </div>
            )}

            {/* Daily Meal Plan (RSS recipes) */}
            {dailyMeals && (
              <>
                <div className="section-title">Today&apos;s Meal Ideas</div>
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
                          <div className="recipe-meta" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                            via {recipe.source}
                          </div>
                        </div>
                        <div className="recipe-chevron">{isExpanded ? '▲' : '▼'}</div>
                      </div>
                      {isExpanded && (
                        <div className="recipe-detail">
                          {recipe.image && (
                            <img src={recipe.image} alt={recipe.name} className="recipe-image" />
                          )}
                          {recipe.description && (
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0' }}>{recipe.description}</p>
                          )}
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <a
                              className="btn btn-primary"
                              href={recipe.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}
                            >
                              📖 View Recipe
                            </a>
                            <button
                              className="btn btn-secondary"
                              style={{ flex: 1 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                logSuggestion({
                                  name: recipe.name,
                                  calories: 0, protein: 0, carbs: 0, fat: 0,
                                  recipeUrl: recipe.link,
                                  recipeSource: recipe.source,
                                  recipeDescription: recipe.description,
                                });
                              }}
                            >
                              + Log &amp; Save
                            </button>
                          </div>
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
                            {f.brand && (
                              <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 4 }}>{f.brand}</span>
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
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary" onClick={saveFavorite} disabled={!meal.trim()}>
                      ⭐ Save Favorite
                    </button>
                  <button type="submit" className="btn btn-primary">
                    + Log Meal
                  </button>
                </div>
              </form>
            </div>

            {/* Quick Favorites */}
            {favoriteMeals.length > 0 && (
                <div className="card">
                  <div className="card-title">⭐ Favorites</div>
                  <div className="favorites-list">
                    {favoriteMeals.map(fav => (
                      <div className="favorite-item" key={fav.id}>
                        <div className="favorite-info" onClick={() => logFavorite(fav)}>
                          <span className="favorite-name">{fav.meal}</span>
                          <span className="favorite-macros">{fav.calories} kcal · {fav.protein}g P · {fav.carbs}g C · {fav.fat}g F</span>
                        </div>
                        <button className="favorite-del" onClick={() => deleteFavorite(fav.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Meal Suggestions */}
            <div className="ai-panel">
              <h4>Meal Suggestions</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 10px' }}>
                Get personalized meals based on your remaining {Math.max(0, calGoal - totalCals)} kcal
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  onClick={getMealSuggestions}
                  disabled={suggestionsLoading}
                >
                  {suggestionsLoading ? '⏳ Generating...' : mealSuggestions.length > 0 ? '🔄 Next Suggestions' : '🍽️ Suggest Meals'}
                </button>
                {mealSuggestions.length > 0 && (
                  <button className="btn btn-secondary" onClick={() => { setMealSuggestions([]); try { sessionStorage.removeItem('ff_suggestions'); } catch {} }}>
                    ✕ Clear
                  </button>
                )}
              </div>
              {mealSuggestions.length > 0 && (
                <div className="suggestion-list">
                  {mealSuggestions.map((meal, i) => (
                    <div key={i} className={`suggestion-item ${expandedSuggestion === i ? 'expanded' : ''}`}>
                      <div className="suggestion-header" onClick={() => setExpandedSuggestion(expandedSuggestion === i ? null : i)} style={{ cursor: 'pointer' }}>
                        <span>{meal.name}</span>
                        <span className="suggestion-expand-icon">{expandedSuggestion === i ? '▲' : '▼'}</span>
                      </div>
                      <div className="suggestion-macros">
                        {meal.calories} kcal · {meal.protein}g P · {meal.carbs}g C · {meal.fat}g F
                        {meal.recipeSource ? ` · ${meal.recipeSource}` : ''}
                      </div>
                      {expandedSuggestion === i && meal.recipe && (
                        <div className="suggestion-recipe">
                          <div className="recipe-section">
                            <strong>Ingredients</strong>
                            <ul>
                              {meal.recipe.ingredients.map((ing, j) => (
                                <li key={j}>{ing}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="recipe-section">
                            <strong>Directions</strong>
                            <ol>
                              {meal.recipe.steps.map((step, j) => (
                                <li key={j}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      )}
                      <div className="suggestion-actions">
                        <button className="btn btn-small" onClick={() => logSuggestion(meal)}>+ Log</button>
                      </div>
                    </div>
                  ))}
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
                <div className="meal-item" key={log.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: log.recipeIngredients ? 'pointer' : 'default' }}
                        onClick={() => log.recipeIngredients && setExpandedLog(expandedLog === log.id ? null : log.id)}>
                        <div className="meal-icon">{mealEmoji(log.meal)}</div>
                        <div className="meal-info" style={{ flex: 1 }}>
                          <div className="name">
                            {log.meal}{' '}
                            <span
                              className={`food-tag ${colorTag(log.calories)}`}
                            >
                              {colorTag(log.calories)}
                            </span>
                            {log.recipeIngredients && <span style={{ fontSize: 11, marginLeft: 4 }}>{expandedLog === log.id ? '▲' : '▼'}</span>}
                          </div>
                          <div className="meta">
                            {log.protein || 0}g P · {log.carbs || 0}g C · {log.fat || 0}g F · {new Date(log.loggedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {log.recipeSource ? ` · ${log.recipeSource}` : ''}
                          </div>
                        </div>
                        <div className="meal-cals">{log.calories}</div>
                        <div className="meal-actions" onClick={(e) => e.stopPropagation()}>
                          {log.recipeUrl && <a className="meal-action-btn" title="View Recipe" href={log.recipeUrl} target="_blank" rel="noopener noreferrer">📖</a>}
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
                      </div>
                      {expandedLog === log.id && log.recipeIngredients && (() => {
                        try {
                          const ingredients = JSON.parse(log.recipeIngredients);
                          const steps = log.recipeSteps ? JSON.parse(log.recipeSteps) : [];
                          return (
                            <div className="suggestion-recipe" style={{ marginTop: 8 }}>
                              <div className="recipe-section">
                                <strong>Ingredients</strong>
                                <ul>{ingredients.map((ing, j) => <li key={j}>{ing}</li>)}</ul>
                              </div>
                              {steps.length > 0 && (
                                <div className="recipe-section">
                                  <strong>Directions</strong>
                                  <ol>{steps.map((s, j) => <li key={j}>{s}</li>)}</ol>
                                </div>
                              )}
                            </div>
                          );
                        } catch { return null; }
                      })()}
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

            {habits.length === 0 && (
              <div className="card empty-state">
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-title">No habits yet</div>
                <div className="empty-state-text">Tasks will generate automatically based on your goals!</div>
              </div>
            )}

            {/* Daily Tasks */}
            {habits.filter(h => h.source === 'daily').length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">📋 Daily Tasks</div>
                {habits.filter(h => h.source === 'daily').map((habit) => (
                  <div className="habit-item" key={habit.id}>
                    <div className={`habit-check ${habit.completed ? 'done' : ''}`} onClick={() => toggleHabit(habit.id)}>
                      {habit.completed ? '✓' : ''}
                    </div>
                    <span className={`habit-text ${habit.completed ? 'done' : ''}`}>{habit.title}</span>
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
                    <div className={`habit-check ${habit.completed ? 'done' : ''}`} onClick={() => toggleHabit(habit.id)}>
                      {habit.completed ? '✓' : ''}
                    </div>
                    <span className={`habit-text ${habit.completed ? 'done' : ''}`}>{habit.title}</span>
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
                    <div className={`habit-check ${habit.completed ? 'done' : ''}`} onClick={() => toggleHabit(habit.id)}>
                      {habit.completed ? '✓' : ''}
                    </div>
                    <span className={`habit-text ${habit.completed ? 'done' : ''}`}>{habit.title}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Coach & Custom tasks */}
            {habits.filter(h => h.source === 'coach' || h.source === 'custom').length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">✨ Your Tasks</div>
                {habits.filter(h => h.source === 'coach' || h.source === 'custom').map((habit) => (
                  <div className="habit-item" key={habit.id}>
                    <div className={`habit-check ${habit.completed ? 'done' : ''}`} onClick={() => toggleHabit(habit.id)}>
                      {habit.completed ? '✓' : ''}
                    </div>
                    <span className={`habit-text ${habit.completed ? 'done' : ''}`}>{habit.title}</span>
                    {habit.source === 'coach' && <span className="habit-source coach">🤖 Coach</span>}
                    <button className="habit-del" onClick={() => deleteHabit(habit.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="input-row">
              <input
                className="input"
                value={newHabit}
                onChange={(e) => setNewHabit(e.target.value)}
                placeholder="Add a custom task..."
              />
              <button className="btn btn-primary" onClick={addHabit}>
                +
              </button>
            </div>
          </>
        )}

        {/* ═══════ VIDEOS TAB ═══════ */}
        {tab === 'videos' && (
          <>
            <div className="section-title">Browse Videos</div>

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
                    onClick={() => {
                      if (isNative && v.videoId) {
                        // On mobile, play natively via react-native-youtube-iframe
                        window.ReactNativeWebView?.postMessage(JSON.stringify({
                          type: 'playVideo',
                          videoId: v.videoId,
                          title: v.title,
                        }));
                      } else {
                        setPlayingVideo(v);
                      }
                      if (isNative) hapticTap();
                    }}
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

        {/* ═══════ ACCOUNT TAB ═══════ */}
        {tab === 'account' && (
          <AccountScreen
            user={user}
            onUpdate={handleProfileUpdate}
            onLogout={handleLogout}
          />
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
