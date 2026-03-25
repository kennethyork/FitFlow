const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });
const upload = multer({ dest: 'uploads/' });

const s3Config = { region: process.env.AWS_REGION };
if (process.env.S3_ENDPOINT) {
  s3Config.endpoint = process.env.S3_ENDPOINT;
  s3Config.s3ForcePathStyle = true;
}
const s3 = new AWS.S3(s3Config);

async function uploadToS3(filePath, fileName, mimetype) {
  if (!process.env.S3_BUCKET) throw new Error('S3_BUCKET not configured');
  const body = fs.createReadStream(filePath);
  const key = `uploads/${Date.now()}_${fileName}`;
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: mimetype,
    ACL: 'public-read',
  };
  const { Location } = await s3.upload(params).promise();
  return Location;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fitflow-dev-secret-change-in-production';

// ── Auth helpers ──
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, tier: user.tier }, JWT_SECRET, { expiresIn: '7d' });
}

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireTier(...tiers) {
  return (req, res, next) => {
    if (!tiers.includes(req.user.tier)) {
      return res.status(403).json({ error: 'Upgrade required', requiredTier: tiers[0], currentTier: req.user.tier });
    }
    next();
  };
}

// ── Tier limits ──
const TIER_LIMITS = {
  free:      { foodLogs: 5,   habits: 3,   coachQueries: 3,   photoAI: false, voiceAI: false },
  pro:       { foodLogs: 50,  habits: 20,  coachQueries: 50,  photoAI: true,  voiceAI: true  },
  premium:   { foodLogs: 200, habits: 100, coachQueries: 200, photoAI: true,  voiceAI: true  },
  unlimited: { foodLogs: -1,  habits: -1,  coachQueries: -1,  photoAI: true,  voiceAI: true  },
};

app.get('/api/tiers', (req, res) => {
  res.json({
    plans: [
      { id: 'free',      name: 'Free',      price: 0,     period: null,    features: ['5 food logs/day', '3 habits', '3 coach messages/day', 'Lessons & workouts'] },
      { id: 'pro',       name: 'Pro',       price: 4.99,  period: 'month', features: ['50 food logs/day', '20 habits', '50 coach messages/day', 'Photo AI analysis', 'Voice to Text', 'Priority support'] },
      { id: 'premium',   name: 'Premium',   price: 9.99,  period: 'month', features: ['200 food logs/day', '100 habits', '200 coach messages/day', 'Photo AI analysis', 'Voice to Text', 'Custom workout plans', 'Priority support', 'Early access features'] },
      { id: 'unlimited', name: 'Unlimited', price: 19.99, period: 'month', features: ['Unlimited food logs', 'Unlimited habits', 'Unlimited coach messages', 'Photo AI analysis', 'Voice to Text', 'Custom workout plans', 'Priority support', 'Early access features', 'API access', 'Family sharing (5 members)'] },
    ],
  });
});

// ── Auth routes ──
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name, tier } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const validTiers = ['free', 'pro', 'premium', 'unlimited'];
    const chosenTier = validTiers.includes(tier) ? tier : 'free';

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hash, name, tier: chosenTier } });
    const token = signToken(user);
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, name: true, tier: true, createdAt: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.put('/api/auth/upgrade', auth, async (req, res) => {
  try {
    const { tier } = req.body;
    if (!['free', 'pro', 'premium'].includes(tier)) return res.status(400).json({ error: 'Invalid tier' });
    // TODO: integrate Stripe payment verification here before upgrading
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { tier } });
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Upgrade failed' });
  }
});

// ── Protected food routes ──
app.post('/api/food/logs', auth, async (req, res) => {
  try {
    const { meal, calories, protein, carbs, fat, imageUrl } = req.body;
    const userId = req.user.id;
    const limit = TIER_LIMITS[req.user.tier]?.foodLogs || 5;
    if (limit > 0) {
      const today = new Date(); today.setHours(0,0,0,0);
      const count = await prisma.foodLog.count({ where: { userId, loggedAt: { gte: today } } });
      if (count >= limit) return res.status(403).json({ error: `Daily food log limit (${limit}) reached. Upgrade for more.`, upgrade: true });
    }
    const foodLog = await prisma.foodLog.create({ data: { userId, meal, calories, protein, carbs, fat, imageUrl } });
    res.json(foodLog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create food log' });
  }
});

app.get('/api/food/logs', auth, async (req, res) => {
  try {
    const logs = await prisma.foodLog.findMany({ where: { userId: req.user.id }, orderBy: { loggedAt: 'desc' } });
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch food logs' });
  }
});

app.post('/api/food/upload', auth, upload.single('image'), async (req, res) => {
  try {
    const { path: localPath, originalname, mimetype } = req.file;
    let imageUrl;
    if (process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      imageUrl = await uploadToS3(localPath, originalname, mimetype);
      fs.unlinkSync(localPath);
    } else {
      const publicDir = path.join(__dirname, '..', 'public', 'uploads');
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
      const target = path.join(publicDir, `${Date.now()}_${originalname}`);
      fs.renameSync(localPath, target);
      imageUrl = `/uploads/${path.basename(target)}`;
    }
    res.json({ imageUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// AI coach endpoint (basic workflow — fallback for in-browser AI)
app.post('/api/coach/query', auth, async (req, res) => {
  try {
    const { query } = req.body;
    const answer = `I heard: "${query}". Keep your protein high and add 10 minutes of movement now. ` +
      'Tonight, try a small water break before bedtime to reduce late snacking.';

    res.json({ userId: req.user.id, query, answer, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'AI coach failed' });
  }
});

// Food AI skeleton endpoints (Pro+ only)
app.post('/api/food/photo', auth, requireTier('pro', 'premium', 'unlimited'), upload.single('image'), async (req, res) => {
  try {
    // TODO: connect image to AI vision model (e.g., Google Vision / custom model)
    const predicted = [
      { name: 'Chicken Salad', calories: 450, protein: 30, carbs: 22, fat: 24, confidence: 0.87 },
      { name: 'Apple', calories: 95, protein: 0, carbs: 25, fat: 0, confidence: 0.74 },
    ];
    res.json({ predictions: predicted });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Food image analysis failed' });
  }
});

app.post('/api/food/voice', auth, requireTier('pro', 'premium', 'unlimited'), async (req, res) => {
  try {
    const { transcript } = req.body;
    // TODO: parse transcript with NLP to structured meal
    const parsed = {
      meal: transcript,
      calories: 420,
      protein: 28,
      carbs: 34,
      fat: 16,
      suggestions: 'Try adding vegetables next time for fiber and 100 kcal more',
    };
    res.json({ parsed });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Voice parsing failed' });
  }
});

// Habit management API
const habits = [
  { id: 1, title: 'Drink 2 liters water', completed: false },
  { id: 2, title: '10-minute morning stretch', completed: true },
];
app.get('/api/habits', auth, (req, res) => res.json(habits));
app.post('/api/habits', auth, (req, res) => {
  const limit = TIER_LIMITS[req.user.tier]?.habits || 3;
  if (limit > 0 && habits.length >= limit) return res.status(403).json({ error: `Habit limit (${limit}) reached. Upgrade for more.`, upgrade: true });
  const { title } = req.body;
  const next = { id: habits.length + 1, title, completed: false };
  habits.push(next);
  res.status(201).json(next);
});
app.put('/api/habits/:id/toggle', auth, (req, res) => {
  const id = Number(req.params.id);
  const habit = habits.find((h) => h.id === id);
  if (!habit) return res.status(404).json({ error: 'Habit not found' });
  habit.completed = !habit.completed;
  res.json(habit);
});

// Lesson and workouts APIs
const lessons = [
  { id: 1, title: 'Behavior change strategy', progress: 20 },
  { id: 2, title: 'Macro counting essentials', progress: 50 },
];
app.get('/api/lessons', auth, (req, res) => res.json(lessons));

// ── Workout video API (Invidious — no API key needed) ──
const INVIDIOUS_INSTANCES = [
  'https://vid.puffyan.us',
  'https://inv.nadeko.net',
  'https://invidious.privacyredirect.com',
  'https://invidious.nerdvpn.de',
];

const WORKOUT_CATEGORIES = [
  'HIIT workout',
  'yoga for beginners',
  'full body strength training',
  'pilates workout',
  'cardio dance workout',
  'stretching routine',
  'core abs workout',
  'kettlebell workout',
  'bodyweight workout no equipment',
  'morning workout routine',
  'low impact workout',
  'tabata workout',
  'resistance band workout',
  'boxing fitness workout',
];

function getDailyCategory(userId) {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const seed = (dayOfYear * 7 + (userId || 1) * 13) % WORKOUT_CATEGORIES.length;
  return WORKOUT_CATEGORIES[seed];
}

const videoCache = {};

async function searchVideos(query, maxResults = 6) {
  const cacheKey = `${query}:${maxResults}`;
  const cached = videoCache[cacheKey];
  if (cached && cached.expires > Date.now()) return cached.data;

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const params = new URLSearchParams({
        q: query,
        type: 'video',
        sort_by: 'relevance',
      });
      const res = await fetch(`${instance}/api/v1/search?${params}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const json = await res.json();

      const results = json.slice(0, maxResults).map((item) => {
        const thumb = item.videoThumbnails?.find((t) => t.quality === 'medium')
          || item.videoThumbnails?.[0];
        return {
          id: item.videoId,
          title: item.title,
          thumbnail: thumb?.url || null,
          channel: item.author,
          videoUrl: `https://www.youtube.com/watch?v=${item.videoId}`,
          embedUrl: `https://www.youtube.com/embed/${item.videoId}`,
          lengthSeconds: item.lengthSeconds,
        };
      });

      videoCache[cacheKey] = { data: results, expires: Date.now() + 6 * 60 * 60 * 1000 };
      return results;
    } catch {
      // try next instance
    }
  }
  return null;
}

app.get('/api/workouts/playlist', auth, async (req, res) => {
  try {
    const category = getDailyCategory(req.user.id);
    const results = await searchVideos(`${category} follow along`, 6);
    res.json({ category, workouts: results || [] });
  } catch (error) {
    console.error('Workout playlist error:', error);
    res.json({ category: 'workout', workouts: [] });
  }
});

app.get('/api/workouts/search', auth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ query: q, workouts: [] });
  try {
    const results = await searchVideos(`${q} workout follow along`, 8);
    res.json({ query: q, workouts: results || [] });
  } catch (error) {
    console.error('Workout search error:', error);
    res.json({ query: q, workouts: [] });
  }
});

app.listen(process.env.PORT || 4000, () => console.log(`Server listening on ${process.env.PORT || 4000}`));
