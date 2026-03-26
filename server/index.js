const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
let PrismaBetterSqlite3;
if (!process.env.VERCEL) {
  // Dynamic string prevents Vercel NFT from tracing these dev-only native modules
  PrismaBetterSqlite3 = require('@prisma/adapter-' + 'better-sqlite3').PrismaBetterSqlite3;
}
const { PrismaD1 } = require('@prisma/adapter-d1');
const { D1HttpDatabase } = require('./d1Client');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Resend } = require('resend');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { FOOD_DB, FOOD_CATEGORIES } = require('./foodDatabase');
const { searchUSDA, searchOpenFoodFacts } = require('./foodApis');
const { XMLParser } = require('fast-xml-parser');

const app = express();

// ── Security middleware ──
app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'];
if (process.env.VERCEL) {
  allowedOrigins.push('https://kennethyork.github.io');
}
app.use(cors({
  origin(origin, cb) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return cb(null, true);
    if (allowedOrigins.some(o => origin === o || origin.startsWith(o))) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));
// Explicit OPTIONS handler for preflight
app.options('*', cors());
app.use(express.json({ limit: '1mb' }));

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many attempts, try again in 15 minutes' } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100, message: { error: 'Too many requests, slow down' } });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/', apiLimiter);

// ── Database adapter ──
let prisma;
if (process.env.D1_DATABASE_ID) {
  const d1 = new D1HttpDatabase({
    accountId: process.env.D1_ACCOUNT_ID,
    databaseId: process.env.D1_DATABASE_ID,
    apiToken: process.env.D1_API_TOKEN,
  });
  const adapter = new PrismaD1(d1);
  prisma = new PrismaClient({ adapter });
  console.log('Using Cloudflare D1 database');
} else if (process.env.VERCEL) {
  console.error('ERROR: D1_DATABASE_ID, D1_ACCOUNT_ID, and D1_API_TOKEN must be set on Vercel');
  // Create a minimal prisma that throws helpful errors
  prisma = new Proxy({}, {
    get: () => { throw new Error('Database not configured. Set D1 env vars in Vercel dashboard.'); }
  });
} else {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
  prisma = new PrismaClient({ adapter });
  console.log('Using local SQLite database');
}
const upload = multer({ dest: 'uploads/', limits: { fileSize: 10 * 1024 * 1024 } });

const s3Config = { region: process.env.AWS_REGION || 'us-east-1' };
if (process.env.S3_ENDPOINT) {
  s3Config.endpoint = process.env.S3_ENDPOINT;
  s3Config.forcePathStyle = true;
}
const s3 = new S3Client(s3Config);

async function uploadToS3(filePath, fileName, mimetype) {
  if (!process.env.S3_BUCKET) throw new Error('S3_BUCKET not configured');
  const body = fs.createReadStream(filePath);
  const key = `uploads/${Date.now()}_${fileName}`;
  const bucket = process.env.S3_BUCKET;
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: mimetype,
    ACL: 'public-read',
  }));
  return `https://${bucket}.s3.amazonaws.com/${key}`;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fitflow-dev-secret-change-in-production';

// ── Email (Resend) ──
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://kennethyork.github.io/FitFlow';

function generateVerifyToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function sendVerificationEmail(email, token) {
  const verifyUrl = `${FRONTEND_URL}?verify=${token}`;
  if (!resend) {
    console.log(`[DEV] Verify email for ${email}: ${verifyUrl}`);
    return;
  }
  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'FitFlow <noreply@fitflow.app>',
    to: email,
    subject: 'Verify your FitFlow account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f1117;color:#e0e0e0;border-radius:12px">
        <h1 style="color:#00a86b;text-align:center">🌿 FitFlow</h1>
        <p>Welcome! Please verify your email to get started:</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${verifyUrl}" style="background:#00a86b;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Verify Email</a>
        </div>
        <p style="font-size:13px;color:#888">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
      </div>
    `,
  });
}

// ── PayPal setup (direct REST API — no SDK needed) ──
const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken() {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`PayPal auth failed: ${data.error_description || res.status}`);
  return data.access_token;
}

const paypalConfigured = !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
if (paypalConfigured) console.log(`PayPal configured (${process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox'})`);

const PAYPAL_PRICES = {
  pro: 4.99,
  premium: 9.99,
  unlimited: 19.99,
};
const PAYPAL_PLAN_NAMES = {
  pro: 'FitFlow Pro (Monthly)',
  premium: 'FitFlow Premium (Monthly)',
  unlimited: 'FitFlow Unlimited (Monthly)',
};

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
  free:      { foodLogs: 5,   habits: 3   },
  pro:       { foodLogs: 50,  habits: 20  },
  premium:   { foodLogs: 200, habits: 100 },
  unlimited: { foodLogs: -1,  habits: -1  },
};

app.get('/api/tiers', (req, res) => {
  res.json({
    plans: [
      { id: 'free',      name: 'Free',      price: 0,     period: null,    features: ['5 food logs/day', '3 habits', '3 coach messages/day', 'Lessons & workouts'] },
      { id: 'pro',       name: 'Pro',       price: 4.99,  period: 'month', features: ['50 food logs/day', '20 habits', '50 coach messages/day', 'Meal Suggestions', 'Favorite Meals', 'Priority support'] },
      { id: 'premium',   name: 'Premium',   price: 9.99,  period: 'month', features: ['200 food logs/day', '100 habits', '200 coach messages/day', 'Meal Suggestions', 'Favorite Meals', 'Custom workout plans', 'Priority support', 'Early access features'] },
      { id: 'unlimited', name: 'Unlimited', price: 19.99, period: 'month', features: ['Unlimited food logs', 'Unlimited habits', 'Unlimited coach messages', 'Meal Suggestions', 'Favorite Meals', 'Custom workout plans', 'Priority support', 'Early access features', 'Weekly Reports', 'Family sharing (5 members)'] },
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
    const verifyToken = generateVerifyToken();
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    const user = await prisma.user.create({ data: { email, password: hash, name, tier: chosenTier, verifyToken, verifyExpires } });

    // Send verification email (non-blocking)
    sendVerificationEmail(email, verifyToken).catch(err => console.error('Failed to send verification email:', err));

    const token = signToken(user);
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier, onboarded: user.onboarded, calorieGoal: user.calorieGoal, emailVerified: false }, needsVerification: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.get('/api/auth/verify', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Verification token required' });

    const user = await prisma.user.findFirst({ where: { verifyToken: token } });
    if (!user) return res.status(400).json({ error: 'Invalid verification link' });
    if (user.verifyExpires && new Date(user.verifyExpires) < new Date()) {
      return res.status(400).json({ error: 'Verification link expired. Please request a new one.' });
    }

    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true, verifyToken: null, verifyExpires: null } });
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/auth/resend-verification', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.emailVerified) return res.json({ message: 'Email already verified' });

    const verifyToken = generateVerifyToken();
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { verifyToken, verifyExpires } });
    await sendVerificationEmail(user.email, verifyToken);
    res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to resend verification email' });
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
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier, onboarded: user.onboarded, calorieGoal: user.calorieGoal, emailVerified: user.emailVerified } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, name: true, tier: true, onboarded: true, calorieGoal: true, goalType: true, activityLevel: true, createdAt: true, emailVerified: true } });
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
    if (!['free', 'pro', 'premium', 'unlimited'].includes(tier)) return res.status(400).json({ error: 'Invalid tier' });

    // Downgrade to free — no payment needed
    if (tier === 'free') {
      const user = await prisma.user.update({ where: { id: req.user.id }, data: { tier } });
      const token = signToken(user);
      return res.json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier, onboarded: user.onboarded, calorieGoal: user.calorieGoal } });
    }

    // PayPal: create order and return approval URL
    if (paypalConfigured && PAYPAL_PRICES[tier]) {
      const appUrl = process.env.APP_URL || 'http://localhost:5173';
      const accessToken = await getPayPalAccessToken();
      const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: { currency_code: 'USD', value: PAYPAL_PRICES[tier].toFixed(2) },
            description: PAYPAL_PLAN_NAMES[tier],
            custom_id: JSON.stringify({ userId: req.user.id, tier }),
          }],
          application_context: {
            brand_name: 'FitFlow',
            return_url: `${appUrl}/?paypal_capture=pending&tier=${tier}`,
            cancel_url: `${appUrl}/?cancelled=true`,
            user_action: 'PAY_NOW',
          },
        }),
      });
      const order = await res.json();
      if (!res.ok) return res.status(500).json({ error: 'PayPal order creation failed' });
      const approvalLink = order.links?.find(l => l.rel === 'approve');
      if (approvalLink) {
        return res.json({ checkoutUrl: approvalLink.href, paypalOrderId: order.id });
      }
      return res.status(500).json({ error: 'PayPal order created but no approval link' });
    }

    // Dev fallback: no payment provider configured, upgrade directly
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { tier } });
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier, onboarded: user.onboarded, calorieGoal: user.calorieGoal } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Upgrade failed' });
  }
});

// PayPal: capture payment after user approves
app.post('/api/paypal/capture', auth, async (req, res) => {
  try {
    if (!paypalConfigured) return res.status(400).json({ error: 'PayPal not configured' });
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    const accessToken = await getPayPalAccessToken();
    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    const capture = await captureRes.json();

    if (capture.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Payment not completed', status: capture.status });
    }

    // Extract tier from custom_id
    const customId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id
                  || capture.purchase_units?.[0]?.custom_id;
    let tier = null;
    try {
      const meta = JSON.parse(customId);
      tier = meta.tier;
    } catch { /* ignore */ }

    if (!tier || !['pro', 'premium', 'unlimited'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier in payment' });
    }

    const user = await prisma.user.update({ where: { id: req.user.id }, data: { tier } });
    const token = signToken(user);
    console.log(`PayPal: upgraded user ${req.user.id} to ${tier} (order ${orderId})`);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier, onboarded: user.onboarded, calorieGoal: user.calorieGoal } });
  } catch (error) {
    console.error('PayPal capture error:', error);
    res.status(500).json({ error: 'Payment capture failed' });
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

// ── Account management routes ──
app.put('/api/auth/profile', auth, async (req, res) => {
  try {
    const { name, email, goalType, activityLevel, calorieGoal } = req.body;
    const data = {};
    if (name !== undefined) data.name = String(name).trim().slice(0, 100);
    if (email !== undefined) {
      const clean = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return res.status(400).json({ error: 'Invalid email' });
      const existing = await prisma.user.findUnique({ where: { email: clean } });
      if (existing && existing.id !== req.user.id) return res.status(409).json({ error: 'Email already in use' });
      data.email = clean;
    }
    if (['lose', 'maintain', 'gain'].includes(goalType)) data.goalType = goalType;
    if (['sedentary', 'light', 'moderate', 'active'].includes(activityLevel)) data.activityLevel = activityLevel;
    if (calorieGoal && Number(calorieGoal) > 0) data.calorieGoal = Number(calorieGoal);
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No fields to update' });
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier, onboarded: user.onboarded, calorieGoal: user.calorieGoal, goalType: user.goalType, activityLevel: user.activityLevel, createdAt: user.createdAt } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Profile update failed' });
  }
});

app.put('/api/auth/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hash } });
    res.json({ message: 'Password updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

app.delete('/api/auth/account', auth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required to delete account' });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });
    await prisma.user.delete({ where: { id: req.user.id } });
    res.json({ message: 'Account deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Account deletion failed' });
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

// ── Meal Suggestions (builds real meals from local food DB) ──
app.get('/api/food/suggest', auth, async (req, res) => {
  const remaining = Math.max(0, parseInt(req.query.remaining, 10) || 600);
  const goalType = (req.query.goal || 'lose').toLowerCase();
  const perMeal = Math.round(remaining / 3);

  // Categorise foods by role
  const proteins = FOOD_DB.filter(f => f.category === 'Protein' || f.category === 'Seafood');
  const carbs = FOOD_DB.filter(f => ['Grains', 'Legumes'].includes(f.category));
  const vegs = FOOD_DB.filter(f => f.category === 'Vegetables' || f.category === 'Fruits');
  const extras = FOOD_DB.filter(f => ['Dairy', 'Nuts & Seeds', 'Snacks', 'Beverages'].includes(f.category));

  function seededRand(seed) {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
  }

  const baseSeed = Date.now() ^ (req.user.id * 2654435761);

  function pickWeighted(arr, budget, rand) {
    // filter to items that fit within budget, prefer items that use 20-70% of budget
    const fits = arr.filter(f => f.calories > 0 && f.calories <= budget);
    if (!fits.length) return null;
    const scored = fits.map(f => {
      const ratio = f.calories / budget;
      const idealScore = 1 - Math.abs(ratio - 0.45); // prefer ~45% of budget
      const proteinBonus = goalType === 'gain' ? (f.protein / 50) : goalType === 'lose' ? (f.protein / 40) : 0;
      return { ...f, score: idealScore + proteinBonus + rand() * 0.4 };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0];
  }

  const meals = [];
  const usedNames = new Set();

  for (let i = 0; i < 3; i++) {
    const rand = seededRand(baseSeed + i * 7919);
    let budget = perMeal;
    const components = [];

    // 1. Pick a protein
    const protein = pickWeighted(proteins.filter(f => !usedNames.has(f.name)), budget, rand);
    if (protein) {
      components.push(protein);
      usedNames.add(protein.name);
      budget -= protein.calories;
    }

    // 2. Pick a carb/grain
    if (budget > 50) {
      const carb = pickWeighted(carbs.filter(f => !usedNames.has(f.name)), budget, rand);
      if (carb) {
        components.push(carb);
        usedNames.add(carb.name);
        budget -= carb.calories;
      }
    }

    // 3. Pick a vegetable/fruit
    if (budget > 20) {
      const veg = pickWeighted(vegs.filter(f => !usedNames.has(f.name)), budget, rand);
      if (veg) {
        components.push(veg);
        usedNames.add(veg.name);
        budget -= veg.calories;
      }
    }

    // 4. Optional extra if budget allows
    if (budget > 40) {
      const extra = pickWeighted(extras.filter(f => !usedNames.has(f.name)), budget, rand);
      if (extra) {
        components.push(extra);
        usedNames.add(extra.name);
      }
    }

    if (components.length === 0) continue;

    const totals = components.reduce(
      (acc, c) => ({ calories: acc.calories + c.calories, protein: acc.protein + c.protein, carbs: acc.carbs + c.carbs, fat: acc.fat + c.fat }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const mealName = components.map(c => c.name.replace(/\s*\(.*?\)\s*/g, '')).join(' + ');
    const recipeQuery = components.map(c => c.name.replace(/\s*\(.*?\)\s*/g, '')).join(' ');
    meals.push({
      name: mealName,
      components,
      ...totals,
      recipeUrl: `https://www.google.com/search?q=${encodeURIComponent(recipeQuery + ' recipe')}`,
    });
  }

  res.json(meals);
});

// Coach endpoint (basic fallback — coach runs client-side now)
app.post('/api/coach/query', auth, async (req, res) => {
  try {
    const { query } = req.body;
    // Smart fallback responses based on keywords
    const q = (query || '').toLowerCase();
    const responses = [
      "Great question! The key is consistency — focus on small, sustainable changes rather than drastic overhauls. Track your meals, stay active, and trust the process.",
      "Here's my advice: prioritize protein at every meal, drink plenty of water, and aim for at least 30 minutes of movement daily. Small habits compound into big results!",
      "That's something a lot of people wonder about. The most important thing is finding an approach that fits your lifestyle. What works for someone else might not work for you — and that's okay!",
      "Focus on the fundamentals: eat whole foods, get enough sleep (7-9 hours), stay hydrated, and move your body regularly. These basics account for 90% of results.",
      "I'd suggest starting simple — log your meals for a week to build awareness, then make one small improvement at a time. Trying to change everything at once usually backfires.",
    ];
    // Deterministic pick based on query
    let hash = 0;
    for (let i = 0; i < q.length; i++) hash = ((hash << 5) - hash + q.charCodeAt(i)) | 0;
    const answer = responses[Math.abs(hash) % responses.length];

    res.json({ userId: req.user.id, query, answer, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'AI coach failed' });
  }
});

// ── Favorite Meals (Pro+ only) ──
app.get('/api/food/favorites', auth, requireTier('pro', 'premium', 'unlimited'), async (req, res) => {
  try {
    const favs = await prisma.favoriteMeal.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json(favs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load favorites' });
  }
});

app.post('/api/food/favorites', auth, requireTier('pro', 'premium', 'unlimited'), async (req, res) => {
  try {
    const { meal, calories, protein, carbs, fat } = req.body;
    if (!meal) return res.status(400).json({ error: 'Meal name required' });
    const fav = await prisma.favoriteMeal.create({ data: { userId: req.user.id, meal, calories: calories || 0, protein: protein || 0, carbs: carbs || 0, fat: fat || 0 } });
    res.json(fav);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save favorite' });
  }
});

app.delete('/api/food/favorites/:id', auth, requireTier('pro', 'premium', 'unlimited'), async (req, res) => {
  try {
    await prisma.favoriteMeal.deleteMany({ where: { id: parseInt(req.params.id), userId: req.user.id } });
    res.json({ deleted: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete favorite' });
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

// ── DB-backed habit helpers ──
function getCurrentPeriods() {
  const now = new Date();
  const daily = now.toISOString().slice(0, 10);
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  const weekly = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  const monthly = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return { daily, weekly, monthly };
}

async function ensureHabits(userId, goalType) {
  const { daily, weekly, monthly } = getCurrentPeriods();

  const [dCount, wCount, mCount] = await Promise.all([
    prisma.habit.count({ where: { userId, source: 'daily', period: daily } }),
    prisma.habit.count({ where: { userId, source: 'weekly', period: weekly } }),
    prisma.habit.count({ where: { userId, source: 'monthly', period: monthly } }),
  ]);

  const inserts = [];
  if (dCount === 0) {
    for (const t of getDailyTasks(userId, goalType))
      inserts.push({ userId, title: t.title, source: 'daily', period: daily });
  }
  if (wCount === 0) {
    for (const t of getWeeklyGoals(userId, goalType))
      inserts.push({ userId, title: t.title, source: 'weekly', period: weekly });
  }
  if (mCount === 0) {
    for (const t of getMonthlyChallenges(userId, goalType))
      inserts.push({ userId, title: t.title, source: 'monthly', period: monthly });
  }
  if (inserts.length) await prisma.habit.createMany({ data: inserts });

  return prisma.habit.findMany({
    where: {
      userId,
      OR: [
        { source: 'daily', period: daily },
        { source: 'weekly', period: weekly },
        { source: 'monthly', period: monthly },
        { source: 'custom' },
        { source: 'coach' },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });
}

// ── Chat History API (persisted in DB) ──
app.get('/api/chat', auth, async (req, res) => {
  const messages = await prisma.chatMessage.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  res.json(messages.map(m => ({ role: m.role, text: m.text })));
});

app.post('/api/chat', auth, async (req, res) => {
  const msgs = req.body.messages;
  if (!Array.isArray(msgs) || msgs.length === 0) return res.status(400).json({ error: 'messages required' });
  const data = msgs
    .filter(m => m.role && m.text)
    .map(m => ({ userId: req.user.id, role: String(m.role).slice(0, 10), text: String(m.text).slice(0, 5000) }));
  if (data.length === 0) return res.status(400).json({ error: 'invalid messages' });
  await prisma.chatMessage.createMany({ data });
  res.json({ saved: data.length });
});

app.delete('/api/chat', auth, async (req, res) => {
  await prisma.chatMessage.deleteMany({ where: { userId: req.user.id } });
  res.json({ cleared: true });
});

// Habit management API (DB-backed)
app.get('/api/habits', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { goalType: true } });
    const habits = await ensureHabits(req.user.id, user?.goalType || 'lose');
    res.json(habits);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to load habits' }); }
});

app.post('/api/habits', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { tier: true } });
    const limit = TIER_LIMITS[user?.tier || 'free']?.habits || 3;
    if (limit > 0) {
      const count = await prisma.habit.count({ where: { userId: req.user.id, source: { in: ['custom', 'coach'] } } });
      if (count >= limit) return res.status(403).json({ error: `Habit limit (${limit}) reached. Upgrade for more.`, upgrade: true });
    }
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
    const habit = await prisma.habit.create({ data: { userId: req.user.id, title: title.trim(), source: 'custom', period: '' } });
    res.status(201).json(habit);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to add habit' }); }
});

app.post('/api/habits/assign', auth, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Task title required' });
    const habit = await prisma.habit.create({ data: { userId: req.user.id, title: title.trim(), source: 'coach', period: '' } });
    res.status(201).json(habit);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to assign habit' }); }
});

app.put('/api/habits/:id/toggle', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const habit = await prisma.habit.findFirst({ where: { id, userId: req.user.id } });
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    const updated = await prisma.habit.update({ where: { id }, data: { completed: !habit.completed } });
    res.json(updated);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to toggle habit' }); }
});

app.delete('/api/habits/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const habit = await prisma.habit.findFirst({ where: { id, userId: req.user.id } });
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    if (habit.source !== 'custom' && habit.source !== 'coach')
      return res.status(400).json({ error: 'Only custom/coach habits can be deleted' });
    await prisma.habit.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to delete habit' }); }
});

// Lesson and workouts APIs
const lessons = [
  { id: 1, title: 'Understanding Calories', progress: 0, category: 'nutrition', content: 'Calories are units of energy. Your body needs a certain amount each day to function. Eating fewer calories than you burn leads to weight loss, while eating more leads to weight gain.' },
  { id: 2, title: 'Macros 101: Protein', progress: 0, category: 'nutrition', content: 'Protein is essential for muscle repair and growth. Aim for 0.7–1g per pound of body weight. Great sources include chicken, fish, eggs, Greek yogurt, and legumes.' },
  { id: 3, title: 'Macros 101: Carbs & Fats', progress: 0, category: 'nutrition', content: 'Carbs are your body\'s main energy source. Fats support hormone production and nutrient absorption. Neither is "bad" — balance and quality matter most.' },
  { id: 4, title: 'Building Healthy Habits', progress: 0, category: 'mindset', content: 'Start small. Stack new habits onto existing routines. Track consistency, not perfection. It takes roughly 66 days for a new behavior to become automatic.' },
  { id: 5, title: 'Hydration & Performance', progress: 0, category: 'nutrition', content: 'Water makes up ~60% of your body. Even mild dehydration reduces focus and energy. Aim for 8+ glasses daily, more if you exercise.' },
  { id: 6, title: 'Strength Training Basics', progress: 0, category: 'fitness', content: 'Compound movements (squat, deadlift, bench, row) build the most muscle efficiently. Start with 3 sessions per week, focusing on progressive overload.' },
  { id: 7, title: 'Cardio: Finding Your Zone', progress: 0, category: 'fitness', content: 'Zone 2 cardio (conversational pace) burns fat and builds endurance. HIIT burns more calories in less time. A mix of both is optimal.' },
  { id: 8, title: 'Sleep & Recovery', progress: 0, category: 'mindset', content: '7–9 hours of sleep is critical for muscle recovery, hormone regulation, and appetite control. Poor sleep increases cravings and cortisol.' },
  { id: 9, title: 'Reading Food Labels', progress: 0, category: 'nutrition', content: 'Check serving size first. Compare calories, protein, fiber, and added sugars. Ingredients are listed by weight — the first few matter most.' },
  { id: 10, title: 'Meal Prep Strategies', progress: 0, category: 'nutrition', content: 'Prep proteins and grains in bulk on Sunday. Store in portions. Having healthy food ready makes it 3x easier to stick to your plan.' },
  { id: 11, title: 'Managing Plateaus', progress: 0, category: 'mindset', content: 'Weight loss plateaus are normal. Your metabolism adapts. Solutions: adjust calories, change exercise routine, ensure adequate sleep, and be patient.' },
  { id: 12, title: 'Mindful Eating', progress: 0, category: 'mindset', content: 'Eat slowly, without screens. Notice hunger and fullness cues. Chewing thoroughly improves digestion and helps you eat less naturally.' },
];
app.get('/api/lessons', auth, (req, res) => res.json(lessons));

// ── Video API (YouTube RSS channel feeds — legal, no API key needed) ──
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// Curated fitness YouTube channels per category (8 per tab ≈ 120 videos each)
const VIDEO_TABS = {
  chair: {
    label: '🪑 Chair',
    channels: [
      { id: 'UCRp-32Yi0KC2YMgHIg6mTag', name: 'SilverSneakers' },
      { id: 'UCPG8CxOlWesGSPlKRR8B3zw', name: 'Grow Young Fitness' },
      { id: 'UC2BaKQ5vqal9yaC-VbpD5ZQ', name: 'Senior Fitness With Meredith' },
      { id: 'UCxqJgKLsc1zQAHbtrXxmfig', name: 'Improved Health' },
      { id: 'UCC4TRhL4BiA7--jpxVVXcpQ', name: 'More Life Health' },
      { id: 'UCwxmeTw7TLIOqUEDM5HniBw', name: 'Fitness With Cindy' },
      { id: 'UC34J4TasPOq6krJS28XdEng', name: 'HASfit' },
      { id: 'UC-0CzRZeML8zw4pFTVDq65Q', name: 'SarahBethYoga' },
    ],
  },
  easy: {
    label: '🟢 Easy',
    channels: [
      { id: 'UC34J4TasPOq6krJS28XdEng', name: 'HASfit' },
      { id: 'UCY-8TLORCEHyUeqgTH16PcA', name: 'Walk at Home' },
      { id: 'UCZUUZFex6AaIU4QTopFudYA', name: 'growwithjo' },
      { id: 'UCjyhdvQO16xizyqzk5hCWxw', name: 'Juice & Toya' },
      { id: 'UCpQ34afVgk8cRQBjSJ1xuJQ', name: 'MadFit' },
      { id: 'UCIJwWYOfsCfz6PjxbONYXSg', name: 'blogilates' },
      { id: 'UCE2ygZPYvOwcAOJT-8bViZg', name: 'Heather Robertson' },
      { id: 'UCVQJZE_on7It_pEv6tn-jdA', name: 'Sydney Cummings' },
    ],
  },
  moderate: {
    label: '🚶 Moderate',
    channels: [
      { id: 'UCY-8TLORCEHyUeqgTH16PcA', name: 'Walk at Home' },
      { id: 'UC34J4TasPOq6krJS28XdEng', name: 'HASfit' },
      { id: 'UCE2ygZPYvOwcAOJT-8bViZg', name: 'Heather Robertson' },
      { id: 'UCjyhdvQO16xizyqzk5hCWxw', name: 'Juice & Toya' },
      { id: 'UCZUUZFex6AaIU4QTopFudYA', name: 'growwithjo' },
      { id: 'UCIJwWYOfsCfz6PjxbONYXSg', name: 'blogilates' },
      { id: 'UCpQ34afVgk8cRQBjSJ1xuJQ', name: 'MadFit' },
      { id: 'UCVQJZE_on7It_pEv6tn-jdA', name: 'Sydney Cummings' },
    ],
  },
  intermediate: {
    label: '🏃 Intermediate',
    channels: [
      { id: 'UCpQ34afVgk8cRQBjSJ1xuJQ', name: 'MadFit' },
      { id: 'UCVQJZE_on7It_pEv6tn-jdA', name: 'Sydney Cummings' },
      { id: 'UCE2ygZPYvOwcAOJT-8bViZg', name: 'Heather Robertson' },
      { id: 'UCpis3RcTw6t47XO0R_KY4WQ', name: 'Caroline Girvan' },
      { id: 'UCBrcDabYtwbR1VIhwH5efZA', name: 'Chloe Ting' },
      { id: 'UCIJwWYOfsCfz6PjxbONYXSg', name: 'blogilates' },
      { id: 'UChECmemk1JRsp_1a8L513OA', name: 'Fraser Wilson' },
      { id: 'UCjyhdvQO16xizyqzk5hCWxw', name: 'Juice & Toya' },
    ],
  },
  advanced: {
    label: '🔥 Advanced',
    channels: [
      { id: 'UCMHkz3SDZADtMaQ43bLGdUQ', name: 'Chris Heria' },
      { id: 'UCpis3RcTw6t47XO0R_KY4WQ', name: 'Caroline Girvan' },
      { id: 'UCBrcDabYtwbR1VIhwH5efZA', name: 'Chloe Ting' },
      { id: 'UChECmemk1JRsp_1a8L513OA', name: 'Fraser Wilson' },
      { id: 'UCE2ygZPYvOwcAOJT-8bViZg', name: 'Heather Robertson' },
      { id: 'UCVQJZE_on7It_pEv6tn-jdA', name: 'Sydney Cummings' },
      { id: 'UCpQ34afVgk8cRQBjSJ1xuJQ', name: 'MadFit' },
      { id: 'UCZUUZFex6AaIU4QTopFudYA', name: 'growwithjo' },
    ],
  },
  yoga: {
    label: '🧘 Yoga',
    channels: [
      { id: 'UCFKE7WVJfvaHW5q283SxchA', name: 'Yoga With Adriene' },
      { id: 'UCGQk-FB8sWnE7Sc0c1A0pIw', name: 'Boho Beautiful Yoga' },
      { id: 'UC-0CzRZeML8zw4pFTVDq65Q', name: 'SarahBethYoga' },
      { id: 'UCbfPq-uRqonJQli41muSLeQ', name: 'Breathe and Flow' },
      { id: 'UCVrWHW_xYpDnr3p3OR4KYGw', name: 'Cat Meffan' },
      { id: 'UCHTisXO8TeozyYOxEZGC8XQ', name: 'Travis Eliot' },
      { id: 'UCX32D3gKXENrhOXdZjWWtMA', name: 'Yoga with Kassandra' },
      { id: 'UCIJwWYOfsCfz6PjxbONYXSg', name: 'blogilates' },
    ],
  },
  foodtips: {
    label: '🥗 Food Tips',
    channels: [
      { id: 'UCq2E1mIwUKMWzCA4liA_XGQ', name: 'Pick Up Limes' },
      { id: 'UCjTp-nBKswYLumqmVeBPwYw', name: 'Jeff Nippard' },
      { id: 'UCKLz-9xkpPNjK26PqbjHn7Q', name: 'Abbey Sharp' },
      { id: 'UCbNF3nemgJUHJuVRgH7V0YQ', name: 'EatingWell' },
      { id: 'UCS-gN7Jui5cJIAMOF7yoqPw', name: 'Thomas DeLauer' },
      { id: 'UCpWhiwlOPxOmwQu5xyjtLDw', name: 'Dr. Eric Berg' },
      { id: 'UCfQgsKhHjSyRLOp9mnffqVg', name: 'Renaissance Periodization' },
      { id: 'UCYidQwKhM3WTDKpT8pwfJzw', name: 'Downshiftology' },
    ],
  },
  cooking: {
    label: '👨‍🍳 Cooking',
    channels: [
      { id: 'UCq2E1mIwUKMWzCA4liA_XGQ', name: 'Pick Up Limes' },
      { id: 'UCYidQwKhM3WTDKpT8pwfJzw', name: 'Downshiftology' },
      { id: 'UCUAg71CJEvFdOnujmep1Svw', name: 'Joshua Weissman' },
      { id: 'UC9_p50tH3WmMslWRWKnM7dQ', name: 'Adam Ragusea' },
      { id: 'UCJFp8uSYCjXOMnkUyb3CQ3Q', name: 'Tasty' },
      { id: 'UCHxiNbnE_4-Gw4oGfF8DDpg', name: 'Gordon Ramsay' },
      { id: 'UCICdNqyJqyHB3_uDVtmFhPA', name: 'Ethan Chlebowski' },
      { id: 'UCDbZvuDA_tZ6XP5wKKFuemQ', name: 'Rainbow Plant Life' },
    ],
  },
  mindset: {
    label: '🧠 Mindset',
    channels: [
      { id: 'UC-ga3onzHSJFAGsIebtVeBg', name: 'Lavendaire' },
      { id: 'UCk2U-Oqn7RXf-ydPqfSxG5g', name: 'Mel Robbins' },
      { id: 'UC2D2CMWXMOVWx7giW1n3LIg', name: 'Andrew Huberman' },
      { id: 'UC7IcJI8PUf5Z3zKxnZvTBog', name: 'The School of Life' },
      { id: 'UCbk_QsfaFZG6PdQeCvaYXJQ', name: 'Jay Shetty' },
      { id: 'UChdr6MfklpKiAlZRju73lwQ', name: 'Therapy in a Nutshell' },
      { id: 'UCJ24N4O0bP7LGLBDvye7oCA', name: 'Matt D\'Avella' },
      { id: 'UCkJEpR7JmS36tajD34Gp4VA', name: 'Psych2Go' },
    ],
  },
};

// Tab-specific keyword filters — ensure each tab shows relevant content
const TAB_FILTERS = {
  chair: {
    include: /workout|exercise|seated|chair|sit\b|stretch|low.?impact|routine|warm.?up|cool.?down|gentle|beginner|senior|follow.?along|cardio|strength|balance|flexibility|upper.?body|lower.?body|full.?body|arms|legs|core|standing|\d+\s*min.*(workout|exercise|stretch|yoga|cardio|routine)/i,
    exclude: /vlog|review|q\s*[&]\s*a|haul|what i eat|day in my|reaction|unbox|grocery|shop with me|mukbang|taste test|try on|get ready|trailer|teaser|behind the scenes|recipe|#?healthy\s*food|meal|protein\s*(meal|snack|lunch|dinner|breakfast)/i,
  },
  easy: {
    include: /workout|exercise|walk|dance|stretch|low.?impact|beginner|routine|warm.?up|cool.?down|cardio|follow.?along|standing|no.?equipment|home.?workout|full.?body|burn|tone|step|aerobic|arms|legs|abs|core|upper|lower|strength|sculpt|pilates|barre|\d+\s*min.*(workout|exercise|stretch|walk|cardio|dance)/i,
    exclude: /vlog|review|q\s*[&]\s*a|haul|what i eat|day in my|reaction|unbox|grocery|shop with me|mukbang|taste test|try on|get ready|trailer|challenge results|recipe|meal.?prep/i,
  },
  moderate: {
    include: /workout|exercise|walk|cardio|stretch|routine|follow.?along|burn|tone|full.?body|low.?impact|strength|hiit|circuit|standing|no.?equipment|aerobic|step|dance|arms|legs|abs|core|upper|lower|sculpt|pilates|barre|\d+\s*min.*(workout|exercise|stretch|walk|cardio)/i,
    exclude: /vlog|review|tested|q\s*[&]\s*a|haul|what i eat|day in my|reaction|unbox|grocery|shop with me|mukbang|taste test|try on|get ready|trailer|no longer|influencer|celebrity|recipe|meal.?prep/i,
  },
  intermediate: {
    include: /workout|exercise|hiit|cardio|strength|routine|\d+\s*min|follow.?along|burn|full.?body|abs|legs|arms|glutes|core|back|chest|shoulder|squat|circuit|tabata|tone|sculpt|plank|pilates|home|no.?equipment|dumbbell|kettlebell|resistance|band|upper|lower|booty|bicep|tricep/i,
    exclude: /vlog|review|q\s*[&]\s*a|haul|what i eat|day in my|reaction|unbox|grocery|shop with me|mukbang|taste test|try on|get ready|trailer/i,
  },
  advanced: {
    include: /workout|exercise|hiit|cardio|strength|routine|\d+\s*min|follow.?along|burn|full.?body|abs|legs|arms|glutes|core|back|chest|shoulder|squat|circuit|tabata|intense|killer|advanced|heavy|power|muscle|calisthenics|pull.?up|push.?up|burpee|emom|amrap|dumbbell|kettlebell|barbell|upper|lower|booty|shred/i,
    exclude: /vlog|review|q\s*[&]\s*a|haul|what i eat|day in my|reaction|unbox|grocery|shop with me|mukbang|taste test|try on|get ready|explained|the science|trailer/i,
  },
  yoga: {
    include: /yoga|stretch|flow|meditat|flex|mindful|breathe|pose|asana|yin|vinyasa|hatha|restor|relax|morning|bedtime|mobility|pilates|gentle|open|release|hip|back|full.?body|\d+\s*min|routine|practice|balance|strength|power|ashtanga|chair/i,
    exclude: /vlog|haul|what i eat|review|unbox|mukbang|taste test|try on|trailer/i,
  },
  foodtips: {
    include: /nutrition|diet|meal|food|eat|calorie|protein|macro|weight.?loss|healthy|snack|recipe|prep|tip|mistake|fat.?loss|supplement|vitamin|mineral|nutrient|carb|fiber|sugar|fast|intermittent|keto|vegan|vegetarian|whole.?food|clean.?eat|anti.?inflam|gut|metabol/i,
    exclude: /vlog|full.?body.?workout|follow.?along.?workout|unbox|trailer|sponsor|brand.?deal|youtube.?tip|camera|filming|thumbnail/i,
  },
  cooking: {
    include: /recipe|cook|meal|prep|how to make|breakfast|lunch|dinner|snack|healthy|easy|quick|bake|roast|grill|salad|soup|bowl|smoothie|ingredient|kitchen|food|dish|stir.?fry|saut[eé]|steam|boil|one.?pot|budget|high.?protein|low.?calorie|what i eat|eat in a day/i,
    exclude: /vlog|full.?body.?workout|follow.?along.?workout|unbox|trailer/i,
  },
  mindset: {
    include: /mindset|motiv|discipline|mental.?health|stress|anxiety|self.?care|self.?improv|morning.?routine|focus|meditat|journal|gratitude|wellness|sleep|brain|confidence|fear|purpose|transform|heal|emotion|therapy|psych|burnout|calm|peace|happy|joy|overthink|letting.?go|growth|resilien|self.?worth|self.?love|inner|mindful/i,
    exclude: /full.?body.?workout|follow.?along.?workout|recipe|cook|trailer|unbox|windows|apps? review|money|invest|financ|budget|crypto|stock|income/i,
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
  const tabDef = VIDEO_TABS[tabId] || VIDEO_TABS.chair;
  const allVideos = [];

  const feeds = await Promise.all(
    tabDef.channels.map((ch) => fetchChannelFeed(ch.id, ch.name))
  );
  for (const feed of feeds) allVideos.push(...feed);

  // Filter videos by tab-specific keywords to ensure relevant content
  const filters = TAB_FILTERS[tabId];
  let pool = allVideos;
  if (filters) {
    const filtered = allVideos.filter((v) => {
      const title = v.title;
      if (filters.exclude && filters.exclude.test(title)) return false;
      if (filters.include && !filters.include.test(title)) return false;
      return true;
    });
    if (filtered.length >= 6) {
      pool = filtered;
    } else {
      // Relax: only apply include filter (skip exclude) to get more results
      const includeOnly = allVideos.filter((v) => !filters.include || filters.include.test(v.title));
      pool = includeOnly.length > filtered.length ? includeOnly : filtered;
    }
  }

  // Deterministic daily shuffle based on dayOfYear + userId
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const seed = dayOfYear * 7 + (userId || 1) * 13;
  const shuffled = pool
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
    const videos = await getTabVideos(tab || 'chair', req.user.id);
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

// ── Barcode Lookup (OpenFoodFacts) ──
app.get('/api/food/barcode/:code', async (req, res) => {
  const code = req.params.code.replace(/\D/g, '');
  if (!code) return res.status(400).json({ error: 'Invalid barcode' });
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`, { signal: ctrl.signal });
    clearTimeout(timer);
    const data = await r.json();
    if (data.status !== 1 || !data.product) return res.status(404).json({ error: 'Product not found' });
    const p = data.product;
    const n = p.nutriments || {};
    res.json({
      name: p.product_name || p.generic_name || 'Unknown',
      brand: p.brands || '',
      serving: p.serving_size || p.quantity || '',
      calories: Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0),
      protein: Math.round(n.proteins_100g || n.proteins || 0),
      carbs: Math.round(n.carbohydrates_100g || n.carbohydrates || 0),
      fat: Math.round(n.fat_100g || n.fat || 0),
      image: p.image_front_small_url || p.image_url || null,
      barcode: code,
    });
  } catch (e) {
    console.error('Barcode lookup error:', e.message);
    res.status(502).json({ error: 'Barcode service unavailable' });
  }
});

// ── Streaks & Badges ──
app.get('/api/progress/streaks', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    // Get all food log dates
    const foodLogs = await prisma.foodLog.findMany({ where: { userId }, select: { loggedAt: true }, orderBy: { loggedAt: 'desc' } });
    const logDates = new Set(foodLogs.map(l => l.loggedAt.toISOString().slice(0, 10)));

    // Calculate current streak
    let streak = 0;
    const today = new Date(); today.setHours(0,0,0,0);
    const d = new Date(today);
    // Check today first, if not logged, check yesterday as start
    if (!logDates.has(d.toISOString().slice(0, 10))) {
      d.setDate(d.getDate() - 1);
    }
    while (logDates.has(d.toISOString().slice(0, 10))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }

    // Total unique days logged
    const totalDaysLogged = logDates.size;

    // Total meals logged
    const totalMeals = foodLogs.length;

    // Total weight entries
    const weightCount = await prisma.weightLog.count({ where: { userId } });

    // Total habits completed (all time)
    const habitsCompleted = await prisma.habit.count({ where: { userId, completed: true } });

    // Total steps logged
    const stepLogs = await prisma.stepLog.findMany({ where: { userId }, select: { steps: true } });
    const totalSteps = stepLogs.reduce((s, l) => s + l.steps, 0);

    // Water streaks (days with >= 8 glasses)
    const waterLogs = await prisma.waterLog.findMany({ where: { userId, glasses: { gte: 8 } }, select: { loggedAt: true } });
    const waterDays = waterLogs.length;

    // Calculate badges
    const badges = [];
    if (streak >= 1) badges.push({ id: 'streak1', icon: '🔥', name: 'First Flame', desc: '1-day logging streak' });
    if (streak >= 7) badges.push({ id: 'streak7', icon: '🔥', name: 'Week Warrior', desc: '7-day logging streak' });
    if (streak >= 30) badges.push({ id: 'streak30', icon: '💪', name: 'Monthly Master', desc: '30-day logging streak' });
    if (totalMeals >= 10) badges.push({ id: 'meals10', icon: '🍽️', name: 'Meal Tracker', desc: 'Logged 10 meals' });
    if (totalMeals >= 100) badges.push({ id: 'meals100', icon: '🏅', name: 'Century Logger', desc: 'Logged 100 meals' });
    if (totalMeals >= 500) badges.push({ id: 'meals500', icon: '👑', name: 'Meal Legend', desc: 'Logged 500 meals' });
    if (habitsCompleted >= 10) badges.push({ id: 'habits10', icon: '✅', name: 'Habit Builder', desc: 'Completed 10 habits' });
    if (habitsCompleted >= 50) badges.push({ id: 'habits50', icon: '⭐', name: 'Habit Champion', desc: 'Completed 50 habits' });
    if (totalSteps >= 100000) badges.push({ id: 'steps100k', icon: '👟', name: 'Step Master', desc: '100k total steps' });
    if (totalSteps >= 500000) badges.push({ id: 'steps500k', icon: '🏃', name: 'Marathon Walker', desc: '500k total steps' });
    if (weightCount >= 5) badges.push({ id: 'weight5', icon: '⚖️', name: 'Weight Watcher', desc: 'Logged weight 5 times' });
    if (weightCount >= 30) badges.push({ id: 'weight30', icon: '📈', name: 'Trend Tracker', desc: 'Logged weight 30 times' });
    if (waterDays >= 7) badges.push({ id: 'water7', icon: '💧', name: 'Hydration Hero', desc: '7 days at water goal' });
    if (waterDays >= 30) badges.push({ id: 'water30', icon: '🌊', name: 'Water Champion', desc: '30 days at water goal' });
    if (totalDaysLogged >= 7) badges.push({ id: 'days7', icon: '📆', name: 'One Week In', desc: 'Logged food on 7 days' });
    if (totalDaysLogged >= 30) badges.push({ id: 'days30', icon: '🗓️', name: 'Monthly Regular', desc: 'Logged food on 30 days' });

    res.json({ streak, totalDaysLogged, totalMeals, habitsCompleted, totalSteps, waterDays, weightCount, badges });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

// ── Weekly Progress Summary ──
app.get('/api/progress/weekly', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7); weekAgo.setHours(0,0,0,0);

    // Food logs this week
    const foodLogs = await prisma.foodLog.findMany({ where: { userId, loggedAt: { gte: weekAgo } } });
    const totalCals = foodLogs.reduce((s, l) => s + l.calories, 0);
    const totalProtein = foodLogs.reduce((s, l) => s + l.protein, 0);
    const totalCarbs = foodLogs.reduce((s, l) => s + l.carbs, 0);
    const totalFat = foodLogs.reduce((s, l) => s + l.fat, 0);
    const avgCals = foodLogs.length ? Math.round(totalCals / 7) : 0;
    const daysLogged = new Set(foodLogs.map(l => l.loggedAt.toISOString().slice(0, 10))).size;

    // Weight change
    const weightLogs = await prisma.weightLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 30 });
    const recentWeight = weightLogs.find(w => w.loggedAt >= weekAgo);
    const prevWeight = weightLogs.find(w => w.loggedAt < weekAgo);
    const weightChange = (recentWeight && prevWeight) ? +(recentWeight.weight - prevWeight.weight).toFixed(1) : null;
    const currentWeight = weightLogs[0] || null;

    // Habits completed this week
    const habits = await prisma.habit.findMany({ where: { userId, completed: true, createdAt: { gte: weekAgo } } });
    const habitsCompleted = habits.length;

    // Steps this week
    const stepLogs = await prisma.stepLog.findMany({ where: { userId, loggedAt: { gte: weekAgo } } });
    const totalSteps = stepLogs.reduce((s, l) => s + l.steps, 0);
    const avgSteps = stepLogs.length ? Math.round(totalSteps / 7) : 0;

    // Water this week
    const waterLogs = await prisma.waterLog.findMany({ where: { userId, loggedAt: { gte: weekAgo } } });
    const waterGoalDays = waterLogs.filter(w => w.glasses >= 8).length;
    const avgWater = waterLogs.length ? +(waterLogs.reduce((s, w) => s + w.glasses, 0) / 7).toFixed(1) : 0;

    // Calorie history by day (last 7 days)
    const calorieByDay = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const dayStr = d.toISOString().slice(0, 10);
      const dayCals = foodLogs.filter(l => l.loggedAt.toISOString().slice(0, 10) === dayStr).reduce((s, l) => s + l.calories, 0);
      calorieByDay.push({ date: dayStr, day: d.toLocaleDateString('en', { weekday: 'short' }), calories: dayCals });
    }

    res.json({ totalCals, avgCals, totalProtein, totalCarbs, totalFat, daysLogged, mealsLogged: foodLogs.length, weightChange, currentWeight, habitsCompleted, totalSteps, avgSteps, waterGoalDays, avgWater, calorieByDay });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(process.env.PORT || 4000, () => console.log(`Server listening on ${process.env.PORT || 4000}`));
}
