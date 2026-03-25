const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient({
  adapter: {
    provider: 'sqlite',
    url: process.env.DATABASE_URL,
  },
});
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

app.post('/api/food/logs', async (req, res) => {
  try {
    const { userId, meal, calories, protein, carbs, fat, imageUrl } = req.body;
    const foodLog = await prisma.foodLog.create({ data: { userId, meal, calories, protein, carbs, fat, imageUrl } });
    res.json(foodLog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create food log' });
  }
});

app.get('/api/food/logs', async (req, res) => {
  try {
    const { userId } = req.query;
    const logs = await prisma.foodLog.findMany({ where: { userId: Number(userId) }, orderBy: { loggedAt: 'desc' } });
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch food logs' });
  }
});

app.post('/api/food/upload', upload.single('image'), async (req, res) => {
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

// AI coach endpoint (basic workflow)
app.post('/api/coach/query', async (req, res) => {
  try {
    const { userId, query, context } = req.body;
    // TODO: integrate with real LLM or reinforcement engine
    const answer = `I heard: "${query}". Keep your protein high and add 10 minutes of movement now. ` +
      'Tonight, try a small water break before bedtime to reduce late snacking.';

    res.json({ userId, query, answer, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'AI coach failed' });
  }
});

// Food AI skeleton endpoints
app.post('/api/food/photo', upload.single('image'), async (req, res) => {
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

app.post('/api/food/voice', async (req, res) => {
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
app.get('/api/habits', (req, res) => res.json(habits));
app.post('/api/habits', (req, res) => {
  const { title } = req.body;
  const next = { id: habits.length + 1, title, completed: false };
  habits.push(next);
  res.status(201).json(next);
});
app.put('/api/habits/:id/toggle', (req, res) => {
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
app.get('/api/lessons', (req, res) => res.json(lessons));

const workoutPlaylist = [
  { id: 1, title: '15-min HIIT', duration: '15m', difficulty: 'medium', source: 'YouTube', url: 'https://youtu.be/dummy1' },
  { id: 2, title: '20-min Yoga', duration: '20m', difficulty: 'low', source: 'YouTube', url: 'https://youtu.be/dummy2' },
];
app.get('/api/workouts/playlist', (req, res) => res.json(workoutPlaylist));

app.get('/api/workouts/search', (req, res) => {
  const { q } = req.query;
  const results = workoutPlaylist.filter((w) => w.title.toLowerCase().includes((q || '').toLowerCase()));
  res.json({ query: q, results });
});

app.listen(process.env.PORT || 4000, () => console.log(`Server listening on ${process.env.PORT || 4000}`));
