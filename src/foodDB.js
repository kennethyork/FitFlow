// ── Food Reference Database (Dexie/IndexedDB) ──
// 388K foods from FoodData Central, loaded from static JSON files on first visit.
// Uses Dexie directly (same IndexedDB engine as RxDB) for bulk-import performance.
// After loading, an in-memory cache enables instant search.

import { Dexie } from 'dexie';

const foodDb = new Dexie('fitflow-foods');
foodDb.version(1).stores({
  foods: 'id, category, barcode',
  meta: 'key',
});

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
  const meta = await foodDb.meta.get('version');

  if (meta?.value === FOOD_DB_VERSION) {
    // Already imported — load from IndexedDB into memory
    onProgress?.({ status: 'cache', message: 'Loading food database...' });
    const all = await foodDb.foods.toArray();
    _cache = all.map((f) => ({ ...f, _lower: f.name.toLowerCase(), color: assignColor(f) }));
    _ready = true;
    onProgress?.({ status: 'done', loaded: _cache.length, total: _cache.length });
    return;
  }

  // First time — download JSON files and bulk-insert
  await foodDb.foods.clear();
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

    const records = foods.map((f) => {
      const id = String(idCounter++);
      return { id, ...f };
    });

    // Bulk insert into Dexie (chunked to avoid huge transactions)
    const CHUNK = 5000;
    for (let i = 0; i < records.length; i += CHUNK) {
      await foodDb.foods.bulkAdd(records.slice(i, i + CHUNK));
    }

    // Add to in-memory cache as we go (progressive search)
    for (const r of records) {
      _cache.push({ ...r, _lower: r.name.toLowerCase(), color: assignColor(r) });
    }

    loaded += foods.length;
    onProgress?.({ status: 'downloading', loaded, total, category });
  }

  await foodDb.meta.put({ key: 'version', value: FOOD_DB_VERSION });
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

  let sorted;
  if (goalType === 'lose') {
    sorted = pool.filter((f) => f.color !== 'red').sort((a, b) => (b.protein || 0) - (a.protein || 0));
  } else if (goalType === 'gain') {
    sorted = [...pool].sort((a, b) => b.calories - a.calories);
  } else {
    sorted = [...pool].sort(() => Math.random() - 0.5);
  }

  const picks = [];
  const usedCats = new Set();
  for (const f of sorted) {
    if (picks.length >= 5) break;
    if (!usedCats.has(f.category)) {
      usedCats.add(f.category);
      picks.push(f);
    }
  }
  for (const f of sorted) {
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
  await foodDb.foods.clear();
  await foodDb.meta.clear();
  _cache = [];
  _ready = false;
}
