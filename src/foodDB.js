// ── Food Reference Database (RxDB/IndexedDB) ──
// 388K foods from FoodData Central, loaded from static JSON files on first visit.
// Stored in a dedicated RxDB database. In-memory cache enables instant search.

import { createRxDatabase } from 'rxdb/plugins/core';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

const foodSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 10 },
    name: { type: 'string' },
    brand: { type: 'string' },
    category: { type: 'string' },
    serving: { type: 'string' },
    calories: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
    fiber: { type: 'number' },
    sugar: { type: 'number' },
    barcode: { type: 'string' },
  },
  required: ['id', 'name'],
};

const metaSchema = {
  version: 0,
  primaryKey: 'key',
  type: 'object',
  properties: {
    key: { type: 'string', maxLength: 50 },
    value: { type: 'string' },
  },
  required: ['key'],
};

function getFoodDB() {
  if (!globalThis._ffFoodDB) {
    const _warn = console.warn;
    console.warn = (...args) => {
      if (typeof args[0] === 'string' && args[0].includes('https://rxdb.info/premium')) return;
      _warn.apply(console, args);
    };
    globalThis._ffFoodDB = createRxDatabase({
      name: 'fitflow-foods',
      storage: getRxStorageDexie(),
      multiInstance: false,
      closeDuplicates: true,
    }).then(async (db) => {
      console.warn = _warn;
      await db.addCollections({
        foods: { schema: foodSchema },
        meta: { schema: metaSchema },
      });
      return db;
    }).catch((err) => {
      console.warn = _warn;
      globalThis._ffFoodDB = null;
      throw err;
    });
  }
  return globalThis._ffFoodDB;
}

const BASE = import.meta.env.BASE_URL || '/';
const FOOD_DB_VERSION = '2026.03.27';

// In-memory cache for instant search
let _cache = [];
let _ready = false;

export const FOOD_CATEGORIES = [
  'Baby Foods', 'Beverages', 'Condiments', 'Dairy & Eggs', 'Fast Food',
  'Fruits', 'Grains & Bakery', 'Legumes', 'Meat', 'Nuts & Seeds',
  'Oils & Fats', 'Other', 'Prepared Meals', 'Restaurant', 'Seafood',
  'Snacks', 'Soups & Sauces', 'Spices & Herbs', 'Supplements',
  'Sweets & Desserts', 'Vegetables',
];

export function isFoodDBReady() {
  return _ready;
}

export function getFoodCount() {
  return _cache.length;
}

// Color based on calorie density (per serving, Noom-style traffic light)
function assignColor(f) {
  if (f.calories <= 100) return 'green';
  if (f.calories <= 300) return 'yellow';
  return 'red';
}

export async function loadFoodDatabase(onProgress) {
  const db = await getFoodDB();
  const metaDoc = await db.meta.findOne('version').exec();

  if (metaDoc?.value === FOOD_DB_VERSION) {
    // Already imported — load from RxDB into memory
    onProgress?.({ status: 'cache', message: 'Loading food database...' });
    const all = await db.foods.find().exec();
    _cache = all.map((d) => {
      const f = d.toJSON();
      return { ...f, _lower: f.name.toLowerCase(), color: assignColor(f) };
    });
    _ready = true;
    onProgress?.({ status: 'done', loaded: _cache.length, total: _cache.length });
    return;
  }

  // First time — download JSON files and bulk-insert
  await db.foods.find().remove();
  _cache = [];

  const resp = await fetch(`${BASE}data/foods/manifest.json`);
  const manifest = await resp.json();
  const categories = Object.entries(manifest);
  const total = categories.reduce((s, [, v]) => s + v.count, 0);
  let loaded = 0;
  let idCounter = 0;

  for (const [category, info] of categories) {
    const catResp = await fetch(`${BASE}data/foods/${info.file}`);
    const foods = await catResp.json();

    const records = foods.map((f) => ({
      id: String(idCounter++),
      name: f.name || '',
      brand: f.brand || '',
      category: f.category || category,
      serving: f.serving || '100g',
      calories: f.calories || 0,
      protein: f.protein || 0,
      carbs: f.carbs || 0,
      fat: f.fat || 0,
      fiber: f.fiber || 0,
      sugar: f.sugar || 0,
      barcode: f.barcode || '',
    }));

    // Bulk insert (chunked for memory)
    const CHUNK = 5000;
    for (let i = 0; i < records.length; i += CHUNK) {
      await db.foods.bulkInsert(records.slice(i, i + CHUNK));
    }

    // Add to in-memory cache progressively
    for (const r of records) {
      _cache.push({ ...r, _lower: r.name.toLowerCase(), color: assignColor(r) });
    }

    loaded += foods.length;
    onProgress?.({ status: 'downloading', loaded, total, category });
  }

  await db.meta.upsert({ key: 'version', value: FOOD_DB_VERSION });
  _ready = true;
  onProgress?.({ status: 'done', loaded, total });
}

// ── Search (in-memory, instant) ──

export function searchFoods(query, limit = 50) {
  const q = (query || '').trim().toLowerCase();
  if (q.length < 2) return [];

  const results = [];
  // Prefer prefix matches first
  for (const f of _cache) {
    if (f._lower.startsWith(q)) {
      results.push(f);
      if (results.length >= limit) return results;
    }
  }
  // Then contains matches
  for (const f of _cache) {
    if (!f._lower.startsWith(q) && f._lower.includes(q)) {
      results.push(f);
      if (results.length >= limit) return results;
    }
  }
  return results;
}

export function lookupBarcode(code) {
  if (!code || !_cache.length) return null;
  const c = code.trim();
  return _cache.find((f) => f.barcode === c) || null;
}

export function getMealSuggestions(remainingCals, goalType) {
  if (!_cache.length) return [];
  const maxCal = remainingCals > 0 ? remainingCals : 500;
  const pool = _cache.filter((f) => f.calories <= maxCal && f.calories > 50);

  let filtered;
  if (goalType === 'lose') {
    filtered = pool.filter((f) => f.color !== 'red');
  } else {
    filtered = [...pool];
  }

  // Shuffle so each call gives different results
  for (let i = filtered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
  }

  const picks = [];
  const usedCats = new Set();
  for (const f of filtered) {
    if (picks.length >= 5) break;
    if (!usedCats.has(f.category)) {
      usedCats.add(f.category);
      picks.push(f);
    }
  }
  for (const f of filtered) {
    if (picks.length >= 5) break;
    if (!picks.includes(f)) picks.push(f);
  }

  return picks.map((f) => ({
    name: f.name,
    calories: f.calories,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
    serving: f.serving,
    color: f.color,
  }));
}

// ── Clear all food data (for reset) ──

export async function clearFoodDatabase() {
  const db = await getFoodDB();
  await db.foods.find().remove();
  await db.meta.find().remove();
  _cache = [];
  _ready = false;
}
