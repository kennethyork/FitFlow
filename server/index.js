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
const { FOOD_DB, FOOD_CATEGORIES } = require('./foodDatabase');
const { searchUSDA, searchOpenFoodFacts } = require('./foodApis');
const { XMLParser } = require('fast-xml-parser');

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
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier, onboarded: user.onboarded, calorieGoal: user.calorieGoal } });
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
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier, onboarded: user.onboarded, calorieGoal: user.calorieGoal } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, name: true, tier: true, onboarded: true, calorieGoal: true, goalType: true, activityLevel: true, createdAt: true } });
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
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier, onboarded: user.onboarded, calorieGoal: user.calorieGoal } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Upgrade failed' });
  }
});

app.post('/api/auth/onboard', auth, async (req, res) => {
  try {
    const { name, goalType, activityLevel, calorieGoal } = req.body;
    const data = { onboarded: true };
    if (name) data.name = name;
    if (['lose', 'maintain', 'gain'].includes(goalType)) data.goalType = goalType;
    if (['sedentary', 'light', 'moderate', 'active'].includes(activityLevel)) data.activityLevel = activityLevel;
    if (calorieGoal && calorieGoal > 0) data.calorieGoal = calorieGoal;
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier, onboarded: user.onboarded, calorieGoal: user.calorieGoal } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Onboarding failed' });
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

app.put('/api/food/logs/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { meal, calories, protein, carbs, fat } = req.body;
    const existing = await prisma.foodLog.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id) return res.status(404).json({ error: 'Log not found' });
    const updated = await prisma.foodLog.update({
      where: { id },
      data: { meal, calories, protein, carbs, fat },
    });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update food log' });
  }
});

app.delete('/api/food/logs/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.foodLog.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id) return res.status(404).json({ error: 'Log not found' });
    await prisma.foodLog.delete({ where: { id } });
    res.json({ deleted: true, refunded: { calories: existing.calories, protein: existing.protein, carbs: existing.carbs, fat: existing.fat } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete food log' });
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

// ── Food Database Search (local + USDA + Open Food Facts) ──
app.get('/api/food/search', async (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  const cat = (req.query.category || '').trim();
  const source = (req.query.source || '').trim(); // 'local', 'usda', 'openfoodfacts', or '' for all
  if (!q && !cat) return res.json({ results: [], categories: FOOD_CATEGORIES });

  // 1) Local results (instant)
  let local = FOOD_DB;
  if (cat) local = local.filter(f => f.category === cat);
  if (q) local = local.filter(f => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q));
  local = local.slice(0, 20).map(f => ({ ...f, source: 'local' }));

  if (source === 'local' || !q) {
    return res.json({ results: local, categories: FOOD_CATEGORIES });
  }

  // 2) Query USDA + Open Food Facts in parallel
  const [usdaResults, offResults] = await Promise.all([
    source && source !== 'usda' ? [] : searchUSDA(q, 15),
    source && source !== 'openfoodfacts' ? [] : searchOpenFoodFacts(q, 15),
  ]);

  // 3) Merge: local first, then USDA, then Open Food Facts — dedupe by name
  const seen = new Set();
  const merged = [];
  for (const item of [...local, ...usdaResults, ...offResults]) {
    const key = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  res.json({ results: merged.slice(0, 50), categories: FOOD_CATEGORIES });
});

app.get('/api/food/categories', (_req, res) => {
  res.json({ categories: FOOD_CATEGORIES });
});

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

// ── Daily Meal Plans & Recipes ──
const RECIPE_POOL = {
  breakfast: [
    { name: 'Shakshuka', emoji: '🍳', calories: 390, protein: 22, carbs: 28, fat: 22, time: '25 min', ingredients: ['2 tbsp olive oil', '1 yellow onion, diced', '1 red bell pepper, diced', '4 cloves garlic, minced', '1 tsp cumin', '1 tsp paprika', '1/4 tsp cayenne', '1 (28-oz) can crushed San Marzano tomatoes', '4 large eggs', '1/2 cup crumbled feta', 'Fresh cilantro', 'Crusty bread for serving'], steps: ['Heat olive oil in a large skillet over medium heat. Sauté onion and bell pepper 5 minutes until softened.', 'Add garlic, cumin, paprika, and cayenne. Cook 1 minute until fragrant.', 'Pour in crushed tomatoes, season with salt and pepper. Simmer 10 minutes until slightly thickened.', 'Make 4 wells in the sauce and crack an egg into each. Cover and cook 5-7 minutes until whites are set but yolks are still runny.', 'Top with feta and cilantro. Serve with crusty bread for dipping.'] },
    { name: 'Banana Oat Pancakes', emoji: '🥞', calories: 420, protein: 20, carbs: 58, fat: 14, time: '15 min', ingredients: ['2 ripe bananas', '2 large eggs', '1 cup rolled oats', '1/2 tsp baking powder', '1/2 tsp cinnamon', '1 tsp vanilla extract', '1 tbsp coconut oil for cooking', 'Fresh blueberries', 'Pure maple syrup'], steps: ['Blend bananas, eggs, oats, baking powder, cinnamon, and vanilla in a blender until smooth. Let batter rest 5 minutes.', 'Heat coconut oil in a non-stick pan over medium-low heat.', 'Pour 1/4 cup batter per pancake. Drop a few blueberries on top.', 'Cook 2-3 minutes until bubbles form on surface, then flip and cook 1-2 minutes more.', 'Serve stacked with remaining blueberries and a drizzle of maple syrup.'] },
    { name: 'Egg & Black Bean Breakfast Tacos', emoji: '🌮', calories: 440, protein: 26, carbs: 40, fat: 20, time: '12 min', ingredients: ['4 large eggs', '1 (15-oz) can black beans, drained and rinsed', '1/2 tsp cumin', 'Juice of 1 lime', '4 small corn tortillas', '1 avocado, sliced', '1/4 cup pico de gallo', 'Hot sauce (Cholula or Tapatio)', 'Fresh cilantro'], steps: ['Warm black beans in a small pot with cumin, lime juice, and a pinch of salt. Mash slightly with a fork.', 'Scramble eggs in a non-stick pan over medium heat until just set (still slightly wet — they will continue cooking from residual heat).', 'Char tortillas directly over a gas flame or in a dry skillet for 30 seconds per side.', 'Layer each tortilla with mashed beans, scrambled eggs, avocado slices, and pico de gallo.', 'Finish with a dash of hot sauce and cilantro.'] },
    { name: 'Smoked Salmon Toast', emoji: '🐟', calories: 380, protein: 28, carbs: 30, fat: 16, time: '8 min', ingredients: ['2 slices sourdough bread', '4 oz smoked salmon (lox)', '3 tbsp cream cheese (or whipped)', '1 tbsp capers, drained', '1/4 red onion, thinly sliced', 'Fresh dill', 'Lemon wedge', 'Everything bagel seasoning'], steps: ['Toast sourdough until golden and crisp.', 'Spread cream cheese generously on each slice.', 'Lay smoked salmon over the cream cheese in folds.', 'Top with capers, red onion rings, and fresh dill.', 'Squeeze lemon over the top and sprinkle with everything bagel seasoning.'] },
    { name: 'Steel-Cut Oatmeal with Caramelized Apples', emoji: '🍎', calories: 360, protein: 12, carbs: 56, fat: 12, time: '30 min', ingredients: ['1 cup steel-cut oats', '3 cups water', '1/2 cup milk', 'Pinch of salt', '1 large apple (Honeycrisp), diced', '1 tbsp butter', '2 tbsp brown sugar', '1/2 tsp cinnamon', '2 tbsp chopped walnuts'], steps: ['Bring water and salt to a boil. Add steel-cut oats, reduce to low, and simmer 25 minutes, stirring occasionally. Stir in milk at the end.', 'While oats cook, melt butter in a small skillet over medium heat. Add diced apples, brown sugar, and cinnamon.', 'Cook apples 5-7 minutes until soft and caramelized, stirring occasionally.', 'Divide oatmeal into bowls and top with caramelized apples and chopped walnuts.'] },
    { name: 'Huevos Rancheros', emoji: '🇲🇽', calories: 460, protein: 24, carbs: 42, fat: 22, time: '20 min', ingredients: ['2 corn tortillas', '2 large eggs', '1/2 cup canned black beans, warmed', '1/2 cup salsa roja (or store-bought)', '1/4 avocado, sliced', '2 tbsp crumbled cotija cheese', '1 tbsp olive oil', 'Fresh cilantro', 'Lime wedge'], steps: ['Fry tortillas in oil for 30 seconds per side until slightly crispy. Set on plates.', 'In the same pan, fry eggs sunny-side up over medium heat until whites are set (about 3 minutes).', 'Place eggs on tortillas. Spoon warm black beans alongside.', 'Ladle salsa roja over the eggs and beans.', 'Top with avocado, cotija cheese, cilantro, and a squeeze of lime.'] },
    { name: 'Açaí Bowl', emoji: '🫐', calories: 410, protein: 10, carbs: 68, fat: 12, time: '5 min', ingredients: ['2 (3.5-oz) frozen açaí packets (Sambazon unsweetened)', '1 frozen banana', '1/2 cup frozen mixed berries', '1/3 cup almond milk', 'Toppings: granola, sliced banana, coconut flakes, chia seeds, honey drizzle'], steps: ['Run açaí packets under warm water for 5 seconds, then break into chunks.', 'Blend açaí, frozen banana, frozen berries, and almond milk until thick and smooth — should be thicker than a smoothie.', 'Pour into a bowl', 'Top with a line of granola down the center, sliced banana, coconut flakes, and chia seeds.', 'Drizzle with honey and serve immediately.'] },
    { name: 'French Omelette with Herbs', emoji: '🇫🇷', calories: 340, protein: 24, carbs: 4, fat: 26, time: '8 min', ingredients: ['3 large eggs', '1 tbsp butter', '1 tbsp fresh chives, minced', '1 tbsp fresh tarragon, minced', '1 tbsp fresh parsley, minced', '1 oz goat cheese', 'Salt and white pepper', 'Side of mixed greens'], steps: ['Whisk eggs with a pinch of salt and white pepper until fully blended (no streaks of white).', 'Melt butter in an 8-inch non-stick pan over medium-high heat until foaming.', 'Pour in eggs and immediately stir vigorously with a fork while shaking the pan back and forth. Cook until mostly set but still slightly wet on top (about 90 seconds).', 'Sprinkle herbs and goat cheese across the center. Tilt pan and fold omelette into thirds onto a warm plate.', 'Serve with mixed greens. The inside should be creamy and custardy.'] },
  ],
  lunch: [
    { name: 'Chicken Caesar Salad', emoji: '🥗', calories: 480, protein: 42, carbs: 18, fat: 28, time: '20 min', ingredients: ['2 boneless skinless chicken breasts (6 oz each)', '1 head romaine lettuce, chopped', '1/2 cup shaved Parmesan', '1 cup croutons', 'Caesar dressing: 2 anchovy fillets (mashed), 1 clove garlic (minced), 1 egg yolk, 1 tbsp Dijon mustard, juice of 1 lemon, 1/3 cup olive oil, 2 tbsp Parmesan'], steps: ['Season chicken with salt, pepper, and olive oil. Grill or pan-sear over medium-high heat, 6-7 minutes per side until internal temp reaches 165°F. Rest 5 minutes, then slice.', 'For the dressing: whisk mashed anchovy, garlic, egg yolk, Dijon, and lemon juice. Slowly drizzle in olive oil while whisking. Stir in Parmesan. Season to taste.', 'Toss romaine with enough dressing to coat (you may not need it all).', 'Plate salad, top with sliced chicken, croutons, and shaved Parmesan.', 'Crack fresh black pepper over the top.'] },
    { name: 'Thai Peanut Chicken Lettuce Wraps', emoji: '🥬', calories: 420, protein: 36, carbs: 22, fat: 22, time: '15 min', ingredients: ['1 lb ground chicken', '2 cloves garlic, minced', '1 tbsp fresh ginger, grated', '1 tbsp sesame oil', 'Peanut sauce: 3 tbsp peanut butter, 2 tbsp soy sauce, 1 tbsp rice vinegar, 1 tbsp sriracha, 1 tsp honey', '1 head butter lettuce', '1/2 cup shredded carrots', '1/4 cup chopped peanuts', 'Lime wedges, cilantro'], steps: ['Heat sesame oil in a skillet over medium-high heat. Cook ground chicken, breaking it apart, until no longer pink (5-6 minutes).', 'Add garlic and ginger, cook 1 minute more.', 'Whisk together all peanut sauce ingredients. Pour over the chicken and toss to coat. Cook 1 minute.', 'Separate butter lettuce into cups and spoon chicken mixture into each.', 'Top with shredded carrots, chopped peanuts, cilantro, and a squeeze of lime.'] },
    { name: 'Mediterranean Grain Bowl', emoji: '🍲', calories: 490, protein: 22, carbs: 54, fat: 22, time: '25 min', ingredients: ['1 cup farro (or bulgur wheat), cooked', '1 (15-oz) can chickpeas, drained and roasted', '1 English cucumber, diced', '1 cup cherry tomatoes, halved', '1/3 cup Kalamata olives, halved', '1/4 red onion, thinly sliced', '1/2 cup crumbled feta', 'Dressing: 3 tbsp olive oil, 2 tbsp lemon juice, 1 tsp dried oregano, 1 clove garlic minced'], steps: ['Cook farro per package directions. Let cool slightly.', 'Toss drained chickpeas with a drizzle of olive oil, paprika, and salt. Roast at 425°F for 20 minutes until crispy.', 'Whisk together dressing ingredients.', 'Assemble bowls: farro, then cucumber, tomatoes, olives, red onion, crispy chickpeas.', 'Drizzle dressing over everything and top with crumbled feta.'] },
    { name: 'Vietnamese Banh Mi Sandwich', emoji: '🥖', calories: 460, protein: 30, carbs: 46, fat: 18, time: '20 min', ingredients: ['1 French baguette, cut into 2 portions', '8 oz pork tenderloin (or chicken thigh), thinly sliced', '2 tbsp soy sauce', '1 tbsp fish sauce', '1 tbsp sugar', '2 cloves garlic, minced', 'Quick pickles: 1 carrot + 1 daikon (julienned), 1/4 cup rice vinegar, 1 tbsp sugar', 'Jalapeño slices, cilantro, mayo, sriracha'], steps: ['Marinate pork in soy sauce, fish sauce, sugar, and garlic for 10 minutes (or overnight).', 'Quick pickle: toss julienned carrot and daikon with rice vinegar and sugar. Let sit while you cook.', 'Cook marinated pork in a hot skillet over high heat, 2-3 minutes per side until caramelized.', 'Split baguette lengthwise. Spread mayo and sriracha on both sides.', 'Layer pork, pickled vegetables, jalapeño slices, and a generous amount of fresh cilantro.'] },
    { name: 'Japanese Miso Soup with Tofu & Soba', emoji: '🍜', calories: 380, protein: 22, carbs: 48, fat: 10, time: '15 min', ingredients: ['4 cups dashi stock (or 4 cups water + 2 tsp dashi powder)', '3 tbsp white miso paste', '7 oz firm tofu, cubed', '4 oz soba noodles', '2 green onions, sliced', '1 cup baby spinach', '1 sheet nori, cut into strips', '1 tsp sesame oil'], steps: ['Cook soba noodles per package directions. Rinse under cold water and set aside.', 'Heat dashi stock in a pot until simmering (do not boil).', 'Remove a ladleful of stock and dissolve miso paste into it, then pour back into the pot.', 'Add tofu cubes and spinach. Cook 2 minutes until spinach wilts.', 'Divide soba into bowls, ladle soup over the noodles. Top with green onions, nori strips, and a drizzle of sesame oil.'] },
    { name: 'Cobb Salad', emoji: '🥗', calories: 520, protein: 40, carbs: 14, fat: 36, time: '20 min', ingredients: ['2 chicken breasts, grilled and diced', '4 slices bacon, cooked crispy and crumbled', '2 hard-boiled eggs, quartered', '1 large avocado, diced', '1 cup cherry tomatoes, halved', '1/2 cup crumbled blue cheese', '1 head romaine, chopped', 'Red wine vinaigrette: 2 tbsp red wine vinegar, 1 tsp Dijon, 1/4 cup olive oil'], steps: ['Grill chicken breasts seasoned with salt and pepper, 6-7 minutes per side. Let rest, then dice.', 'Cook bacon until crispy. Crumble when cooled.', 'Hard-boil eggs: place in cold water, bring to a boil, cover, remove from heat, let sit 12 minutes. Ice bath, then peel and quarter.', 'Arrange chopped romaine on a platter. Line up rows of chicken, bacon, eggs, avocado, tomatoes, and blue cheese.', 'Whisk vinaigrette ingredients. Drizzle over salad just before serving.'] },
    { name: 'Korean Bibimbap', emoji: '🍚', calories: 510, protein: 30, carbs: 56, fat: 18, time: '30 min', ingredients: ['1.5 cups cooked short-grain rice', '6 oz ground beef (or bulgogi)', '2 tbsp gochujang (Korean chili paste)', '1 tbsp soy sauce', '1 tsp sesame oil', '1 cup spinach, blanched', '1 carrot, julienned and sautéed', '1 zucchini, sliced and sautéed', '1 fried egg', 'Sesame seeds, kimchi'], steps: ['Cook ground beef with soy sauce and 1 tbsp gochujang until browned.', 'Blanch spinach for 30 seconds, squeeze dry, toss with sesame oil and salt.', 'Sauté julienned carrots and zucchini separately in a little oil, 2 minutes each.', 'Place rice in a bowl. Arrange beef, spinach, carrots, and zucchini in sections on top.', 'Top with a fried egg. Serve with remaining gochujang, sesame seeds, and kimchi on the side. Mix everything together before eating.'] },
    { name: 'Tuscan White Bean Soup', emoji: '🇮🇹', calories: 380, protein: 20, carbs: 48, fat: 12, time: '30 min', ingredients: ['2 tbsp olive oil', '1 yellow onion, diced', '3 cloves garlic, minced', '2 (15-oz) cans cannellini beans, drained', '1 (14-oz) can diced tomatoes', '4 cups chicken or vegetable broth', '2 cups Tuscan kale (lacinato), stems removed, chopped', '1 tsp Italian seasoning', 'Parmesan rind (optional)', 'Crusty bread'], steps: ['Heat olive oil in a Dutch oven over medium heat. Sauté onion 5 minutes until translucent.', 'Add garlic and Italian seasoning, cook 1 minute.', 'Add beans, tomatoes, broth, and Parmesan rind if using. Bring to a boil then reduce to a simmer for 15 minutes.', 'Mash some beans against the side of the pot with a spoon to thicken the soup. Add kale and cook 5 minutes until wilted and tender.', 'Remove Parmesan rind. Season with salt and pepper. Serve with crusty bread and a drizzle of good olive oil.'] },
  ],
  dinner: [
    { name: 'Pan-Seared Salmon with Lemon-Dill Sauce', emoji: '🐟', calories: 520, protein: 42, carbs: 18, fat: 32, time: '20 min', ingredients: ['2 (6-oz) skin-on salmon fillets', '2 tbsp olive oil', 'Salt and pepper', '2 tbsp butter', '2 cloves garlic, minced', '1/3 cup dry white wine', 'Juice of 1 lemon', '2 tbsp fresh dill, chopped', '1 bunch asparagus, trimmed', '1 cup cooked quinoa'], steps: ['Pat salmon dry and season generously with salt and pepper.', 'Heat olive oil in a skillet over medium-high heat. Place salmon skin-side up and sear 4 minutes until a golden crust forms. Flip and cook 3 minutes more. Remove to a plate.', 'In the same pan, reduce heat to medium. Add butter and garlic, cook 30 seconds. Add wine, lemon juice, and dill. Simmer 2 minutes until slightly reduced.', 'Meanwhile, roast or blanch asparagus (toss with oil, salt, roast at 425°F for 8 minutes).', 'Serve salmon over quinoa with asparagus. Spoon lemon-dill sauce over the fish.'] },
    { name: 'Chicken Tikka Masala', emoji: '🍛', calories: 540, protein: 38, carbs: 42, fat: 24, time: '40 min', ingredients: ['1.5 lbs boneless chicken thighs, cubed', 'Marinade: 1 cup yogurt, 2 tsp garam masala, 1 tsp turmeric, 1 tsp cumin, salt', '2 tbsp butter or ghee', '1 yellow onion, diced', '4 cloves garlic, minced', '1 tbsp fresh ginger, grated', '1 (14-oz) can crushed tomatoes', '1 cup heavy cream (or coconut cream)', '1 tsp garam masala, 1 tsp paprika', 'Basmati rice, naan bread, cilantro'], steps: ['Marinate chicken in yogurt, garam masala, turmeric, cumin, and salt for at least 30 minutes (overnight is better).', 'Cook marinated chicken in a hot skillet over high heat until charred on edges, about 5-6 minutes. Remove and set aside.', 'In the same pan, melt butter over medium heat. Sauté onion 5 minutes, then add garlic and ginger for 1 minute.', 'Add crushed tomatoes, garam masala, and paprika. Simmer 10 minutes. Stir in cream and return chicken. Simmer 5 more minutes.', 'Serve over basmati rice with warm naan and fresh cilantro.'] },
    { name: 'Spaghetti Aglio e Olio', emoji: '🍝', calories: 480, protein: 16, carbs: 58, fat: 22, time: '15 min', ingredients: ['12 oz spaghetti', '1/3 cup extra-virgin olive oil', '6 cloves garlic, thinly sliced', '1/2 tsp red pepper flakes', '1/2 cup pasta water (reserved)', '1/2 cup fresh parsley, chopped', '1/2 cup Pecorino Romano, grated', 'Salt to taste'], steps: ['Cook spaghetti in heavily salted water until 1 minute before al dente. Reserve 1 cup of pasta water before draining.', 'While pasta cooks, heat olive oil in a large skillet over medium-low heat. Add sliced garlic and red pepper flakes. Cook gently 3-4 minutes until garlic is golden (not brown).', 'Add drained spaghetti directly to the garlic oil. Toss with tongs, adding pasta water a splash at a time until a silky sauce coats the noodles.', 'Remove from heat. Toss in parsley and half the cheese.', 'Plate and top with remaining Pecorino. This is a 500-year-old Roman recipe — the quality of olive oil and garlic matters.'] },
    { name: 'Korean Beef Bulgogi with Banchan', emoji: '🇰🇷', calories: 510, protein: 36, carbs: 48, fat: 20, time: '25 min (+ marinade)', ingredients: ['1 lb ribeye or sirloin, thinly sliced', 'Marinade: 1/4 cup soy sauce, 2 tbsp brown sugar, 1 tbsp sesame oil, 3 cloves garlic minced, 1 Asian pear grated (or 2 tbsp pear juice), 1 tsp black pepper', '1 green onion, sliced', 'Sesame seeds', 'Steamed rice', 'Banchan: kimchi, pickled radish, seasoned spinach'], steps: ['Mix all marinade ingredients. Add sliced beef and marinate at least 30 minutes (overnight is ideal).', 'Heat a cast iron skillet or grill pan over high heat until smoking hot.', 'Cook beef in a single layer (don\'t crowd the pan) for 2-3 minutes per side until caramelized. Work in batches.', 'Garnish with green onion and sesame seeds.', 'Serve with steamed rice, kimchi, pickled radish, and seasoned spinach banchan.'] },
    { name: 'Stuffed Bell Peppers (Mexican Style)', emoji: '🫑', calories: 460, protein: 32, carbs: 38, fat: 20, time: '45 min', ingredients: ['4 large bell peppers (any color), tops cut off and seeded', '1 lb lean ground turkey', '1 cup cooked rice', '1 (15-oz) can black beans, drained', '1 cup corn kernels', '1 cup salsa', '1 tsp cumin', '1 tsp chili powder', '1 cup shredded Mexican cheese', 'Sour cream, cilantro, lime'], steps: ['Preheat oven to 375°F. Place peppers cut-side up in a baking dish.', 'Brown ground turkey in a skillet. Add cumin, chili powder, and salt.', 'Mix turkey with cooked rice, black beans, corn, and salsa.', 'Stuff each pepper generously. Top with shredded cheese. Add 1/4 cup water to the baking dish, cover with foil.', 'Bake covered for 25 minutes, then uncovered for 10 minutes until cheese is bubbly and peppers are tender. Serve with sour cream, cilantro, and lime.'] },
    { name: 'Thai Green Curry with Chicken', emoji: '🍛', calories: 490, protein: 34, carbs: 38, fat: 24, time: '25 min', ingredients: ['1 lb chicken breast, sliced thin', '2 tbsp green curry paste (Mae Ploy or similar)', '1 (13.5-oz) can coconut milk', '1 cup bamboo shoots', '1 red bell pepper, sliced', '1 small Japanese eggplant, sliced', '1 cup Thai basil leaves', '2 tbsp fish sauce', '1 tbsp brown sugar', 'Jasmine rice', 'Lime wedge'], steps: ['Heat 2 tbsp of the thick cream from the top of the coconut milk in a wok over medium-high heat.', 'Add green curry paste and fry for 1 minute until fragrant.', 'Add chicken and stir-fry 3-4 minutes until nearly cooked through.', 'Pour in remaining coconut milk, bamboo shoots, bell pepper, and eggplant. Add fish sauce and sugar. Simmer 8-10 minutes until vegetables are tender.', 'Stir in Thai basil (it will wilt). Serve over jasmine rice with a lime wedge. Adjust fish sauce and sugar to taste (Thai food balances salty, sweet, and spicy).'] },
    { name: 'Lemon Herb Roasted Chicken Thighs', emoji: '🍋', calories: 480, protein: 40, carbs: 26, fat: 24, time: '40 min', ingredients: ['4 bone-in, skin-on chicken thighs', '1 lb baby potatoes, halved', '2 cups green beans, trimmed', '3 tbsp olive oil', '4 cloves garlic, whole', 'Juice and zest of 2 lemons', '2 tbsp fresh rosemary, chopped', '1 tbsp fresh thyme leaves', 'Salt and pepper'], steps: ['Preheat oven to 425°F.', 'Toss potatoes with 1 tbsp olive oil, salt, and pepper on a sheet pan. Roast 10 minutes to get a head start.', 'Season chicken thighs generously with salt, pepper, lemon zest, rosemary, and thyme. Drizzle with olive oil.', 'Nestle chicken skin-side up among the potatoes. Add garlic cloves and green beans. Squeeze lemon juice over everything.', 'Roast 25-30 minutes until chicken skin is golden and crispy and internal temp is 175°F. The potatoes should be crispy and the beans blistered.'] },
    { name: 'Beef & Broccoli Stir-Fry', emoji: '🥦', calories: 460, protein: 38, carbs: 34, fat: 18, time: '20 min', ingredients: ['1 lb flank steak, thinly sliced against the grain', '4 cups broccoli florets', '3 cloves garlic, minced', '1 tbsp fresh ginger, minced', '2 tbsp vegetable oil', 'Sauce: 1/4 cup soy sauce, 2 tbsp oyster sauce, 1 tbsp cornstarch, 1 tbsp brown sugar, 1/4 cup water', 'Steamed rice', 'Sesame seeds, sliced green onion'], steps: ['Whisk together all sauce ingredients in a bowl. Set aside.', 'Blanch broccoli in boiling water for 1 minute. Drain and shock in ice water to keep it bright green.', 'Heat oil in a wok over high heat until smoking. Sear beef in a single layer (work in batches) for 1-2 minutes until browned. Remove.', 'Add garlic and ginger to the wok, stir 30 seconds. Return beef, add broccoli, and pour in sauce. Toss everything together 1-2 minutes until sauce thickens and glazes the beef.', 'Serve over steamed rice, topped with sesame seeds and green onion.'] },
  ],
  snack: [
    { name: 'Homemade Hummus with Crudités', emoji: '🧆', calories: 240, protein: 10, carbs: 26, fat: 12, time: '10 min', ingredients: ['1 (15-oz) can chickpeas, drained (reserve liquid)', '3 tbsp tahini', '2 cloves garlic', 'Juice of 1 lemon', '2 tbsp ice water', '2 tbsp olive oil + more for drizzle', 'Salt, cumin, paprika', 'Crudités: carrots, cucumber, bell pepper strips, celery'], steps: ['Add tahini, lemon juice, garlic, and salt to a food processor. Blend 1 minute until very smooth and fluffy.', 'Add chickpeas and blend 1 minute, scraping sides. With processor running, drizzle in ice water and olive oil until silky smooth (2-3 minutes total is key).', 'Taste and adjust lemon/salt/garlic.', 'Spread on a plate, make swirls with a spoon, drizzle olive oil, and sprinkle paprika and cumin.', 'Serve with fresh cut vegetables.'] },
    { name: 'No-Bake Energy Bites', emoji: '⚡', calories: 210, protein: 8, carbs: 24, fat: 10, time: '10 min', ingredients: ['1 cup rolled oats', '1/2 cup peanut butter (or almond butter)', '1/3 cup honey', '1/4 cup dark chocolate chips', '2 tbsp ground flaxseed', '1 tsp vanilla extract', 'Pinch of salt'], steps: ['Mix all ingredients together in a bowl until well combined.', 'Refrigerate mixture for 30 minutes to make it easier to handle.', 'Roll into 12 balls (about 1 tablespoon each).', 'Store in an airtight container in the fridge for up to 1 week.', 'These are great pre- or post-workout — the oats provide sustained energy and the nut butter gives staying power.'] },
    { name: 'Caprese Skewers', emoji: '🍅', calories: 200, protein: 14, carbs: 6, fat: 14, time: '5 min', ingredients: ['8 oz fresh mozzarella (ciliegine or bocconcini)', '1 pint cherry tomatoes', 'Fresh basil leaves', '2 tbsp balsamic glaze', '1 tbsp extra-virgin olive oil', 'Flaky sea salt', 'Wooden skewers or toothpicks'], steps: ['Thread a basil leaf, a mozzarella ball, and a cherry tomato onto each skewer.', 'Arrange on a platter.', 'Drizzle with olive oil and balsamic glaze.', 'Sprinkle with flaky sea salt.', 'These are best when tomatoes and mozzarella are at room temperature, not fridge-cold.'] },
    { name: 'Frozen Yogurt Bark', emoji: '🍫', calories: 180, protein: 12, carbs: 24, fat: 4, time: '5 min (+ 2 hr freeze)', ingredients: ['2 cups plain Greek yogurt', '2 tbsp honey', '1/2 tsp vanilla', '1/3 cup mixed berries (raspberries, blueberries)', '2 tbsp dark chocolate chips', '2 tbsp granola', '1 tbsp pistachios, chopped'], steps: ['Mix yogurt with honey and vanilla.', 'Spread onto a parchment-lined sheet pan about 1/4 inch thick.', 'Press berries, chocolate chips, granola, and pistachios into the surface.', 'Freeze for at least 2 hours until solid.', 'Break into shards like bark. Store in a freezer bag for up to 2 weeks. Tastes like frozen yogurt in snackable form.'] },
    { name: 'Apple Nachos', emoji: '🍏', calories: 260, protein: 10, carbs: 34, fat: 12, time: '5 min', ingredients: ['2 large apples (Granny Smith), cored and thinly sliced', '2 tbsp almond butter, melted', '1 tbsp honey', '2 tbsp dark chocolate chips', '2 tbsp granola', '1 tbsp unsweetened coconut flakes', 'Pinch of cinnamon'], steps: ['Arrange apple slices on a plate in a single layer, overlapping slightly.', 'Drizzle melted almond butter and honey over the apples.', 'Scatter chocolate chips, granola, and coconut flakes on top.', 'Dust with cinnamon.', 'Eat immediately — this satisfies sweet cravings while packing in fiber and healthy fats.'] },
    { name: 'Cottage Cheese Bowl', emoji: '🍑', calories: 230, protein: 24, carbs: 22, fat: 6, time: '3 min', ingredients: ['1 cup cottage cheese (2% or whole)', '1 ripe peach or nectarine, sliced (or thawed frozen)', '1 tbsp honey', '2 tbsp walnuts, roughly chopped', 'Pinch of cinnamon', 'Fresh mint leaves (optional)'], steps: ['Scoop cottage cheese into a bowl.', 'Arrange peach slices on top.', 'Drizzle with honey and sprinkle walnuts, cinnamon, and mint.', 'This is a high-protein snack trending on TikTok for good reason — cottage cheese is one of the best protein-to-calorie ratio foods available.', 'Try it savory too: with everything bagel seasoning, cherry tomatoes, and cucumber.'] },
  ],
};

function getDailyMeals(userId, goalType) {
  const seed = getDailySeed(userId);
  const pick = (arr, s) => seededShuffle(arr, s)[0];
  return {
    breakfast: pick(RECIPE_POOL.breakfast, seed),
    lunch: pick(RECIPE_POOL.lunch, seed + 100),
    dinner: pick(RECIPE_POOL.dinner, seed + 200),
    snack: pick(RECIPE_POOL.snack, seed + 300),
  };
}

app.get('/api/meals', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { goalType: true } });
  const goalType = user?.goalType || 'lose';
  const meals = getDailyMeals(req.user.id, goalType);
  res.json(meals);
});

// ── Daily task pool (goal-aware) ──
const TASK_POOL = {
  general: [
    'Drink 8 glasses of water',
    'Take a 10-minute walk',
    'Practice deep breathing for 5 minutes',
    'Get 7+ hours of sleep tonight',
    'Eat a vegetable with every meal',
    'Take the stairs instead of the elevator',
    'Stretch for 10 minutes',
    'Avoid screens 30 minutes before bed',
    'Eat slowly and mindfully at one meal',
    'Stand up and move every hour',
    'Write down 3 things you\'re grateful for',
    'Prep tomorrow\'s meals',
    'Track every meal today',
    'Go outside for fresh air',
    'Limit caffeine after 2 PM',
  ],
  lose: [
    'Stay in a calorie deficit today',
    'Eat protein with every meal',
    'Do 30 minutes of cardio',
    'Skip sugary drinks today',
    'Eat a high-fiber breakfast',
    'Walk 10,000 steps',
    'Replace one snack with fruit',
    'Measure food portions at one meal',
    'Eat dinner before 7 PM',
    'Do a HIIT session (15 min)',
    'Swap refined carbs for whole grains',
    'Drink water before every meal',
  ],
  maintain: [
    'Hit your calorie target within 100 kcal',
    'Do 30 minutes of moderate exercise',
    'Eat balanced macros today',
    'Cook a homemade meal',
    'Practice portion awareness',
    'Maintain your hydration streak',
    'Do strength training for 20 min',
    'Have a rest day if you trained 3+ days',
    'Eat 5 servings of fruits and veggies',
    'Review your weekly progress',
    'Try a new healthy recipe',
    'Take a recovery walk',
  ],
  gain: [
    'Eat in a calorie surplus today',
    'Hit 1g protein per lb of bodyweight',
    'Do heavy compound lifts',
    'Eat a protein-rich snack before bed',
    'Have a post-workout shake',
    'Lift weights for 45+ minutes',
    'Eat 4-5 meals today',
    'Add healthy fats (nuts, avocado)',
    'Focus on progressive overload',
    'Rest properly between sets',
    'Eat a big breakfast within an hour of waking',
    'Track your lifts and aim for PRs',
  ],
};

// Deterministic daily seed from date + userId
function getDailySeed(userId) {
  const dateStr = new Date().toISOString().slice(0, 10);
  let hash = 0;
  const s = dateStr + ':' + userId;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Weekly seed: same for the whole ISO week
function getWeeklySeed(userId) {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  const s = `${now.getFullYear()}-W${weekNum}:${userId}`;
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Monthly seed: same for the whole month
function getMonthlySeed(userId) {
  const now = new Date();
  const s = `${now.getFullYear()}-${now.getMonth()}:${userId}`;
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getDailyTasks(userId, goalType, count = 5) {
  const seed = getDailySeed(userId);
  const general = TASK_POOL.general;
  const goalTasks = TASK_POOL[goalType] || [];
  // Mix: pick some goal-specific + some general
  const goalPicks = seededShuffle(goalTasks, seed).slice(0, Math.min(3, goalTasks.length));
  const generalPicks = seededShuffle(general, seed + 1).slice(0, count - goalPicks.length);
  const combined = [...goalPicks, ...generalPicks].slice(0, count);
  return combined.map((title, i) => ({
    id: `daily-${i + 1}`,
    title,
    completed: false,
    source: 'daily',
  }));
}

// ── Weekly Goals Pool ──
const WEEKLY_POOL = {
  general: [
    'Exercise at least 3 days this week',
    'Cook meals at home 5+ times this week',
    'Sleep 7+ hours every night this week',
    'Complete all daily tasks at least 4 days',
    'Drink 2+ liters of water every day this week',
    'Take a rest day — active recovery only',
    'Try one new healthy recipe',
    'No fast food this week',
    'Meditate or do breathwork 3 times',
    'Walk at least 30 min on 5 days',
  ],
  lose: [
    'Stay in a calorie deficit 5 out of 7 days',
    'Do 3 cardio sessions this week',
    'Cut added sugar this entire week',
    'Walk 50,000 total steps this week',
    'Meal prep for the week on Sunday',
    'No eating after 8 PM all week',
  ],
  maintain: [
    'Hit your calorie target (±200) every day',
    'Strength train 3 times this week',
    'Eat 5 servings of vegetables daily',
    'Log every meal for 7 days straight',
    'Do mobility/stretching 3 times',
    'Try a new type of workout',
  ],
  gain: [
    'Hit a calorie surplus every day this week',
    'Lift weights 4+ times this week',
    'Eat 150g+ protein every day',
    'Get 8+ hours of sleep every night',
    'Do progressive overload on one lift',
    'Eat 5+ meals every day this week',
  ],
};

function getWeeklyGoals(userId, goalType, count = 3) {
  const seed = getWeeklySeed(userId);
  const general = WEEKLY_POOL.general;
  const goalTasks = WEEKLY_POOL[goalType] || [];
  const goalPicks = seededShuffle(goalTasks, seed).slice(0, Math.min(2, goalTasks.length));
  const generalPicks = seededShuffle(general, seed + 1).slice(0, count - goalPicks.length);
  const combined = [...goalPicks, ...generalPicks].slice(0, count);
  return combined.map((title, i) => ({
    id: `weekly-${i + 1}`,
    title,
    completed: false,
    source: 'weekly',
  }));
}

// ── Monthly Challenges Pool ──
const MONTHLY_POOL = {
  general: [
    'Complete 20+ workouts this month',
    'Log food every single day',
    'Read or watch 4 health/fitness resources',
    'Establish a consistent sleep schedule',
    'Reduce processed food intake by half',
    'Build a 30-day meditation habit',
    'Average 8,000+ steps per day',
    'Try 4 new healthy recipes',
  ],
  lose: [
    'Lose 2-4 lbs this month (healthy pace)',
    'No sugary drinks for 30 days',
    'Complete 12+ cardio sessions',
    'Track calories every day for 30 days',
    'Reduce snacking to planned snacks only',
  ],
  maintain: [
    'Maintain weight within ±2 lbs all month',
    'Hit protein target 25+ days',
    'Do both cardio and strength each week',
    'Master 4 new healthy recipes',
    'Complete a fitness challenge (plank, push-up, etc.)',
  ],
  gain: [
    'Gain 2-4 lbs this month (lean bulk)',
    'Hit a new PR on a compound lift',
    'Never miss a protein target',
    'Complete 16+ lifting sessions',
    'Eat 4+ meals every day for 30 days',
  ],
};

function getMonthlyChallenges(userId, goalType, count = 2) {
  const seed = getMonthlySeed(userId);
  const general = MONTHLY_POOL.general;
  const goalTasks = MONTHLY_POOL[goalType] || [];
  const goalPicks = seededShuffle(goalTasks, seed).slice(0, Math.min(1, goalTasks.length));
  const generalPicks = seededShuffle(general, seed + 1).slice(0, count - goalPicks.length);
  const combined = [...goalPicks, ...generalPicks].slice(0, count);
  return combined.map((title, i) => ({
    id: `monthly-${i + 1}`,
    title,
    completed: false,
    source: 'monthly',
  }));
}

// In-memory habit store per user
const userHabits = {};

function getUserHabits(userId, goalType) {
  const today = new Date().toISOString().slice(0, 10);
  if (!userHabits[userId] || userHabits[userId].date !== today) {
    // Preserve weekly/monthly toggles across days
    const prevToggles = userHabits[userId]?.toggledIds || new Set();
    const weeklyToggles = new Set([...prevToggles].filter(id => id.startsWith('weekly-')));
    const monthlyToggles = new Set([...prevToggles].filter(id => id.startsWith('monthly-')));

    // Check if week/month changed
    const prevWeeklySeed = userHabits[userId]?.weeklySeed;
    const prevMonthlySeed = userHabits[userId]?.monthlySeed;
    const curWeeklySeed = getWeeklySeed(userId);
    const curMonthlySeed = getMonthlySeed(userId);

    userHabits[userId] = {
      date: today,
      weeklySeed: curWeeklySeed,
      monthlySeed: curMonthlySeed,
      daily: getDailyTasks(userId, goalType),
      weekly: prevWeeklySeed === curWeeklySeed && userHabits[userId]?.weekly
        ? userHabits[userId].weekly
        : getWeeklyGoals(userId, goalType),
      monthly: prevMonthlySeed === curMonthlySeed && userHabits[userId]?.monthly
        ? userHabits[userId].monthly
        : getMonthlyChallenges(userId, goalType),
      custom: [],
      aiAssigned: [],
      nextCustomId: 1,
      toggledIds: new Set([
        ...(prevWeeklySeed === curWeeklySeed ? weeklyToggles : []),
        ...(prevMonthlySeed === curMonthlySeed ? monthlyToggles : []),
      ]),
    };
  }
  const store = userHabits[userId];
  const all = [...store.daily, ...store.weekly, ...store.monthly, ...store.aiAssigned, ...store.custom];
  return all.map(h => ({ ...h, completed: store.toggledIds.has(h.id) }));
}

// Habit management API
app.get('/api/habits', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { goalType: true } });
  const goalType = user?.goalType || 'lose';
  res.json(getUserHabits(req.user.id, goalType));
});

app.post('/api/habits', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { goalType: true, tier: true } });
  const goalType = user?.goalType || 'lose';
  // ensure initialized
  getUserHabits(req.user.id, goalType);
  const store = userHabits[req.user.id];
  const allCount = store.daily.length + store.aiAssigned.length + store.custom.length;
  const limit = TIER_LIMITS[user?.tier || req.user.tier]?.habits || 3;
  if (limit > 0 && allCount >= limit) return res.status(403).json({ error: `Habit limit (${limit}) reached. Upgrade for more.`, upgrade: true });
  const { title } = req.body;
  const next = { id: `custom-${store.nextCustomId++}`, title, completed: false, source: 'custom' };
  store.custom.push(next);
  res.status(201).json(next);
});

// AI coach assigns a task
app.post('/api/habits/assign', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { goalType: true } });
  const goalType = user?.goalType || 'lose';
  getUserHabits(req.user.id, goalType);
  const store = userHabits[req.user.id];
  const { title } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Task title required' });
  const next = { id: `ai-${Date.now()}`, title: title.trim(), completed: false, source: 'coach' };
  store.aiAssigned.push(next);
  res.status(201).json(next);
});

app.put('/api/habits/:id/toggle', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { goalType: true } });
  const goalType = user?.goalType || 'lose';
  const all = getUserHabits(req.user.id, goalType);
  const id = req.params.id;
  const habit = all.find((h) => h.id === id);
  if (!habit) return res.status(404).json({ error: 'Habit not found' });
  const store = userHabits[req.user.id];
  if (store.toggledIds.has(id)) {
    store.toggledIds.delete(id);
    habit.completed = false;
  } else {
    store.toggledIds.add(id);
    habit.completed = true;
  }
  res.json(habit);
});

// Lesson and workouts APIs
const lessons = [];
app.get('/api/lessons', auth, (req, res) => res.json(lessons));

// ── Video API (YouTube RSS channel feeds — legal, no API key needed) ──
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// Curated fitness YouTube channels per category (8 per tab ≈ 120 videos each)
const VIDEO_TABS = {
  easy: {
    label: '🪑 Easy / Chair',
    channels: [
      { id: 'UCOSeFk4ires3UVG2GHEbHHQ', name: 'SilverSneakers' },
      { id: 'UCCgLoMYIyP0U56dEhEL1wXQ', name: 'Grow Young Fitness' },
      { id: 'UC-1-zPmGtrOBbchBQ0fSu0g', name: 'HASfit' },
      { id: 'UCIJwWYOfsCfz6PjxbONYXSg', name: 'Sit and Be Fit' },
      { id: 'UCOLtE_SBYO3aGH2JiNzAEjg', name: 'Improved Health' },
      { id: 'UCK9RGzCfXGEIA6W2GQIK4Mg', name: 'More Life Health' },
      { id: 'UC4ZhhJfMODBNMruFKGHPBmQ', name: 'Senior Fitness with Meredith' },
      { id: 'UCR7FqmP3piPYSJNxo8ynE-g', name: 'Fitness With Cindy' },
    ],
  },
  moderate: {
    label: '🚶 Moderate',
    channels: [
      { id: 'UCBINFWq52ShSgUFEoynfSwg', name: 'WALK at Home' },
      { id: 'UC-1-zPmGtrOBbchBQ0fSu0g', name: 'HASfit' },
      { id: 'UCM1Nde-9eorUhq-teKPUqOA', name: 'Team Body Project' },
      { id: 'UCpis3RcTw6t47XO0R_KY4lg', name: 'POPSUGAR Fitness' },
      { id: 'UCBcRGuvGR2qXiALYBE-UERg', name: 'Pahla B Fitness' },
      { id: 'UCOiGERTfI4LhzqYP_oECHOQ', name: 'Juice & Toya' },
      { id: 'UCIuvJhfsp-SO72xJGCdY3SA', name: 'growwithjo' },
      { id: 'UCvGEK5_U-kLgO6-AMDPeTUQ', name: 'Penny Barnshaw' },
    ],
  },
  intermediate: {
    label: '🏃 Intermediate',
    channels: [
      { id: 'UCpQ34afVgk8cRQBjSJ1xuJQ', name: 'MadFit' },
      { id: 'UCVQJZE_on7It_pEv6tn-jdA', name: 'Sydney Cummings' },
      { id: 'UCIJwWYOfsCfz6PjxbONYXSg', name: 'FitnessBlender' },
      { id: 'UC68TLK0mAEzUyHx5x5k-S1Q', name: 'Heather Robertson' },
      { id: 'UCM1Nde-9eorUhq-teKPUqOA', name: 'Team Body Project' },
      { id: 'UCK5GY6o42wDiMkj9rEvNs7A', name: 'Caroline Girvan' },
      { id: 'UCCsx1kuY16yTrOvTBSlIHTg', name: 'Fitness Kaykay' },
      { id: 'UC97k3hlbE-1rVN8y56zyEEA', name: 'JUICE & TOYA' },
    ],
  },
  advanced: {
    label: '🔥 Advanced',
    channels: [
      { id: 'UCe0TLA0EsQbE-MjuHXevj2A', name: 'THENX' },
      { id: 'UCGXHiIMcPZ9IQNwmJOv12dQ', name: 'Jeff Nippard' },
      { id: 'UCERm5yFZ1SptUEU4wZ2vJvw', name: 'Jeremy Ethier' },
      { id: 'UCK5GY6o42wDiMkj9rEvNs7A', name: 'Caroline Girvan' },
      { id: 'UCaBqRxHEMomgFU-AkSENMnw', name: 'Chloe Ting' },
      { id: 'UCfAq1BqwuA9INIPpabe48EA', name: 'Athlean-X' },
      { id: 'UCOFCwvhDoAzaqB5MBuiQP4g', name: 'Natacha Oceane' },
      { id: 'UCwrXi5ZknKThezJc2CvNNZA', name: 'Fraser Wilson' },
    ],
  },
  yoga: {
    label: '🧘 Yoga',
    channels: [
      { id: 'UCFKE7WVJfvaHW5q283SxchA', name: 'Yoga With Adriene' },
      { id: 'UCcgBSeDacWLg4xjAgCXPfOw', name: 'Boho Beautiful Yoga' },
      { id: 'UC-0CzRZeML8zw4pFTVDq65Q', name: 'SarahBethYoga' },
      { id: 'UCHJBoCDxaCmx7JCxKIq3-UQ', name: 'Breathe and Flow' },
      { id: 'UCLkY4jbxLMD46MYHggSoIYg', name: 'Cat Meffan' },
      { id: 'UCPk6JTfBET30OvSYP6DuBiA', name: 'Travis Eliot' },
      { id: 'UCXyT8BElASD8B8M_iyVAA9Q', name: 'Kassandra' },
      { id: 'UCFAQjGCKnGm-h-Hhc7BGNKQ', name: 'Tim Senesi Yoga' },
    ],
  },
  foodtips: {
    label: '🥗 Food Tips',
    channels: [
      { id: 'UCj0V0aG4LcdHmdPJ7aTtSCQ', name: 'Pick Up Limes' },
      { id: 'UCGXHiIMcPZ9IQNwmJOv12dQ', name: 'Jeff Nippard' },
      { id: 'UCIaH-gZIVC432YRjNVvnyCA', name: 'Abbey Sharp' },
      { id: 'UCKScmfMIcP1kJIlSRl1Xhbg', name: 'EatingWell' },
      { id: 'UCG-KntY7aVnIGXYEBQvmBAQ', name: 'Thomas DeLauer' },
      { id: 'UCSHkffs2lu3bMDYcNt4JQVQ', name: 'Dr. Eric Berg' },
      { id: 'UCpyhJZhJQWKDPOdc8FkKnSA', name: 'Mike Israetel' },
      { id: 'UCLLdi5lFXkOh3UTgfsnU5Qg', name: 'Natacha Oceane' },
    ],
  },
  cooking: {
    label: '👨‍🍳 Cooking',
    channels: [
      { id: 'UCj0V0aG4LcdHmdPJ7aTtSCQ', name: 'Pick Up Limes' },
      { id: 'UC1RRJCMyFSHGMQrYmMyi0Hw', name: 'Downshiftology' },
      { id: 'UCcjhYlL1WRBjKaJsMHSbGYQ', name: 'Joshua Weissman' },
      { id: 'UC9_p50tH3WmMslWRWKnM7dQ', name: 'Adam Ragusea' },
      { id: 'UCJFp8uSYCjXOMnkUyb3CQ3Q', name: 'Tasty' },
      { id: 'UCNbngWUqL2eqRw12yAwcICg', name: 'Gordon Ramsay' },
      { id: 'UCWF2gUMiB_rFJIYiRKLk4Hg', name: 'Ethan Chlebowski' },
      { id: 'UCW-0FkOQBZ6TMq-F0KNFJ4Q', name: 'Rainbow Plant Life' },
    ],
  },
  mindset: {
    label: '🧠 Mindset',
    channels: [
      { id: 'UCG-KntY7aVnIGXYEBQvmBAQ', name: 'Thomas DeLauer' },
      { id: 'UC3w193M5tYPJqF0Hi-7U-2g', name: 'Lavendaire' },
      { id: 'UCkDpk-CG4jqH5OHSNbm8cAA', name: 'Mel Robbins' },
      { id: 'UCbF-4yQQAWw-UnuCd2Azfzg', name: 'Andrew Huberman' },
      { id: 'UCIRiWCPZoUde5Y9eNqpUklQ', name: 'The School of Life' },
      { id: 'UCNjFICBPRffCaZwkdbaHLsQ', name: 'Jay Shetty' },
      { id: 'UCIHdDJ0tjn_3j-FS7s_X1kQ', name: 'Therapy in a Nutshell' },
      { id: 'UCkRfAT3uy4Kf5GifMlTXkjg', name: 'Matt D\'Avella' },
    ],
  },
};

// Cache RSS feeds per channel (2 hours)
const rssCache = {};
const RSS_CACHE_TTL = 2 * 60 * 60 * 1000;

async function fetchChannelFeed(channelId, channelName) {
  const cached = rssCache[channelId];
  if (cached && cached.expires > Date.now()) return cached.data;

  try {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = xmlParser.parse(xml);
    let entries = parsed?.feed?.entry || [];
    if (!Array.isArray(entries)) entries = [entries];

    const videos = entries.map((e) => {
      const videoId = e['yt:videoId'] || '';
      return {
        id: videoId,
        title: e.title || 'Untitled',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        channel: e.author?.name || channelName || '',
        videoUrl: e.link?.['@_href'] || `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        published: e.published || '',
      };
    }).filter((v) => v.id);

    rssCache[channelId] = { data: videos, expires: Date.now() + RSS_CACHE_TTL };
    return videos;
  } catch (e) {
    console.error(`RSS feed error for ${channelName}:`, e.message);
    return [];
  }
}

async function getTabVideos(tabId, userId) {
  const tabDef = VIDEO_TABS[tabId] || VIDEO_TABS.easy;
  const allVideos = [];

  const feeds = await Promise.all(
    tabDef.channels.map((ch) => fetchChannelFeed(ch.id, ch.name))
  );
  for (const feed of feeds) allVideos.push(...feed);

  // Deterministic daily shuffle based on dayOfYear + userId
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const seed = dayOfYear * 7 + (userId || 1) * 13;
  const shuffled = allVideos
    .map((v, i) => ({ v, sort: ((seed + i * 2654435761) >>> 0) % 1000000 }))
    .sort((a, b) => a.sort - b.sort)
    .map((x) => x.v);

  return shuffled.slice(0, 12);
}

app.get('/api/workouts/playlist', auth, async (req, res) => {
  try {
    const videos = await getTabVideos('intermediate', req.user.id);
    res.json({ category: 'workout', workouts: videos.slice(0, 6) });
  } catch (error) {
    console.error('Workout playlist error:', error);
    res.json({ category: 'workout', workouts: [] });
  }
});

app.get('/api/workouts/search', auth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ query: q, workouts: [] });
  // Search across all cached feeds
  const term = q.toLowerCase();
  const allVideos = [];
  for (const [, cached] of Object.entries(rssCache)) {
    if (cached.expires > Date.now()) allVideos.push(...cached.data);
  }
  const matches = allVideos.filter((v) =>
    v.title.toLowerCase().includes(term) || v.channel.toLowerCase().includes(term)
  ).slice(0, 8);
  res.json({ query: q, workouts: matches });
});

app.get('/api/videos/tabs', auth, (req, res) => {
  const tabs = Object.entries(VIDEO_TABS).map(([id, tab]) => ({ id, label: tab.label }));
  res.json(tabs);
});

app.get('/api/videos/browse', auth, async (req, res) => {
  const { tab, q } = req.query;
  try {
    if (q) {
      // Filter across all tab feeds
      const term = q.toLowerCase();
      const allTabs = Object.keys(VIDEO_TABS);
      const feeds = await Promise.all(
        allTabs.map((t) => getTabVideos(t, req.user.id))
      );
      const allVideos = feeds.flat();
      const seen = new Set();
      const matches = allVideos.filter((v) => {
        if (seen.has(v.id)) return false;
        seen.add(v.id);
        return v.title.toLowerCase().includes(term) || v.channel.toLowerCase().includes(term);
      }).slice(0, 12);
      return res.json({ videos: matches });
    }
    const videos = await getTabVideos(tab || 'easy', req.user.id);
    res.json({ videos });
  } catch (error) {
    console.error('Video browse error:', error);
    res.json({ videos: [] });
  }
});

// ═══════ WEIGHT TRACKING ═══════
app.post('/api/weight', auth, async (req, res) => {
  try {
    const { weight, unit } = req.body;
    const log = await prisma.weightLog.create({ data: { userId: req.user.id, weight: parseFloat(weight), unit: unit || 'lbs' } });
    res.json(log);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to log weight' }); }
});

app.get('/api/weight', auth, async (req, res) => {
  try {
    const logs = await prisma.weightLog.findMany({ where: { userId: req.user.id }, orderBy: { loggedAt: 'desc' }, take: 90 });
    res.json(logs);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to fetch weight logs' }); }
});

app.delete('/api/weight/:id', auth, async (req, res) => {
  try {
    await prisma.weightLog.deleteMany({ where: { id: parseInt(req.params.id, 10), userId: req.user.id } });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to delete' }); }
});

// ═══════ WATER TRACKING ═══════
app.get('/api/water/today', auth, async (req, res) => {
  try {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const log = await prisma.waterLog.findFirst({ where: { userId: req.user.id, loggedAt: { gte: start, lte: end } } });
    res.json(log || { glasses: 0 });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/water', auth, async (req, res) => {
  try {
    const { glasses } = req.body;
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const existing = await prisma.waterLog.findFirst({ where: { userId: req.user.id, loggedAt: { gte: start, lte: end } } });
    if (existing) {
      const updated = await prisma.waterLog.update({ where: { id: existing.id }, data: { glasses: parseInt(glasses, 10) } });
      return res.json(updated);
    }
    const log = await prisma.waterLog.create({ data: { userId: req.user.id, glasses: parseInt(glasses, 10) } });
    res.json(log);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

// ═══════ PROGRESS PHOTOS ═══════
app.post('/api/progress-photos', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image' });
    let imageUrl;
    try {
      imageUrl = await uploadToS3(req.file.path, req.file.originalname, req.file.mimetype);
      fs.unlinkSync(req.file.path);
    } catch {
      const target = path.join(__dirname, 'uploads', `${Date.now()}_${req.file.originalname}`);
      fs.renameSync(req.file.path, target);
      imageUrl = `/uploads/${path.basename(target)}`;
    }
    const photo = await prisma.progressPhoto.create({ data: { userId: req.user.id, imageUrl, note: req.body.note || null } });
    res.json(photo);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Upload failed' }); }
});

app.get('/api/progress-photos', auth, async (req, res) => {
  try {
    const photos = await prisma.progressPhoto.findMany({ where: { userId: req.user.id }, orderBy: { loggedAt: 'desc' }, take: 50 });
    res.json(photos);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/progress-photos/:id', auth, async (req, res) => {
  try {
    await prisma.progressPhoto.deleteMany({ where: { id: parseInt(req.params.id, 10), userId: req.user.id } });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

// ═══════ STEP COUNTER ═══════
app.get('/api/steps/today', auth, async (req, res) => {
  try {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const log = await prisma.stepLog.findFirst({ where: { userId: req.user.id, loggedAt: { gte: start, lte: end } } });
    res.json(log || { steps: 0 });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/steps', auth, async (req, res) => {
  try {
    const { steps } = req.body;
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const existing = await prisma.stepLog.findFirst({ where: { userId: req.user.id, loggedAt: { gte: start, lte: end } } });
    if (existing) {
      const updated = await prisma.stepLog.update({ where: { id: existing.id }, data: { steps: parseInt(steps, 10) } });
      return res.json(updated);
    }
    const log = await prisma.stepLog.create({ data: { userId: req.user.id, steps: parseInt(steps, 10) } });
    res.json(log);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/steps', auth, async (req, res) => {
  try {
    const logs = await prisma.stepLog.findMany({ where: { userId: req.user.id }, orderBy: { loggedAt: 'desc' }, take: 30 });
    res.json(logs);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

app.listen(process.env.PORT || 4000, () => console.log(`Server listening on ${process.env.PORT || 4000}`));
