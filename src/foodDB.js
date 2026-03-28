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
const FOOD_DB_VERSION = '2026.03.28';

// In-memory cache for instant search
let _cache = [];
let _ready = false;
// True only after buildSearchIndex() has finished — until then, searchFoods
// uses a linear scan so results are available as categories stream in.
let _indexReady = false;

// Prevents concurrent loadFoodDatabase calls from racing
let _loadingPromise = null;

// Minimum characters required for a query / word entry to be indexed
const MIN_SEARCH_LENGTH = 2;

// Sorted word-level index for fast prefix lookups: [word, cacheIndex][]
let _wordIndex = [];

// Binary search: first position in _cache where _lower >= q
function lowerBound(q) {
  let lo = 0, hi = _cache.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (_cache[mid]._lower < q) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Binary search: first position in _wordIndex where entry[0] >= q
function wordLowerBound(q) {
  let lo = 0, hi = _wordIndex.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (_wordIndex[mid][0] < q) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Build search indexes after _cache is fully populated.
// Sorts _cache in-place and creates the word-level index.
function buildSearchIndex() {
  _cache.sort((a, b) => (a._lower < b._lower ? -1 : a._lower > b._lower ? 1 : 0));
  const entries = [];
  for (let i = 0; i < _cache.length; i++) {
    for (const word of _cache[i]._lower.split(/\s+/)) {
      if (word.length >= MIN_SEARCH_LENGTH) entries.push([word, i]);
    }
  }
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  _wordIndex = entries;
}

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
  // Deduplicate concurrent calls — return the in-flight promise if one exists
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = _doLoad(onProgress).finally(() => { _loadingPromise = null; });
  return _loadingPromise;
}

async function _doLoad(onProgress, _retry = false) {
  const db = await getFoodDB();
  const metaDoc = await db.meta.findOne('version').exec();

  if (metaDoc?.value === FOOD_DB_VERSION) {
    // Already imported — load from RxDB into memory
    onProgress?.({ status: 'cache', message: 'Loading food database...' });
    const all = await db.foods.find().exec();

    // If the stored version matches but the DB is empty, a previous download was
    // interrupted after the version meta was written but before foods were inserted.
    // Clear the stale meta and attempt one fresh import.  Guard against looping.
    if (all.length === 0) {
      if (_retry) throw new Error(`[foodDB] Food database is empty after re-import attempt (version ${FOOD_DB_VERSION}). Try clearing site data manually.`);
      await db.meta.find().remove();
      return _doLoad(onProgress, true);
    }

    _cache = all.map((d) => {
      const f = d.toJSON();
      return { ...f, _lower: f.name.toLowerCase(), color: assignColor(f) };
    });
    _ready = true;
    buildSearchIndex();
    _indexReady = true;
    onProgress?.({ status: 'done', loaded: _cache.length, total: _cache.length });
    return;
  }

  // First time (or version changed) — download JSON files and bulk-insert
  await db.foods.find().remove();
  _cache = [];

  let total = 0;
  let loaded = 0;
  let idCounter = 0;
  let insertErrors = 0;
  const CHUNK = 5000;

  // Try a single combined foods.json first; fall back to per-category manifest.
  const singleResp = await fetch(`${BASE}data/foods/foods.json`).catch(() => null);

  if (singleResp?.ok) {
    // ── Single-file path ──
    onProgress?.({ status: 'downloading', loaded: 0, total: 0, category: 'All' });
    const allFoods = await singleResp.json();
    total = allFoods.length;

    for (let i = 0; i < allFoods.length; i += CHUNK) {
      const slice = allFoods.slice(i, i + CHUNK);
      const records = slice.map((f) => ({
        id: String(idCounter++),
        name: f.name || '',
        brand: f.brand || '',
        category: f.category || 'Other',
        serving: f.serving || '100g',
        calories: f.calories || 0,
        protein: f.protein || 0,
        carbs: f.carbs || 0,
        fat: f.fat || 0,
        fiber: f.fiber || 0,
        sugar: f.sugar || 0,
        barcode: f.barcode || '',
      }));

      const { error } = await db.foods.bulkInsert(records);
      if (error?.length) {
        insertErrors += error.length;
        console.warn(`[foodDB] bulkInsert: ${error.length} errors in chunk ${Math.floor(i / CHUNK)}`, error[0]);
      }

      for (const r of records) {
        _cache.push({ ...r, _lower: r.name.toLowerCase(), color: assignColor(r) });
      }

      if (!_ready) _ready = true;
      loaded += slice.length;
      onProgress?.({ status: 'downloading', loaded, total, category: 'All' });
    }
  } else {
    // ── Multi-file path (manifest) ──
    const resp = await fetch(`${BASE}data/foods/manifest.json`);
    const manifest = await resp.json();
    const categories = Object.entries(manifest);
    total = categories.reduce((s, [, v]) => s + v.count, 0);

    // Start all category fetches in parallel and process whichever file finishes
    // first so smaller categories do not sit idle behind large earlier files.
    const pendingFetches = new Map(
      categories.map(([category, info]) => [
        category,
        fetch(`${BASE}data/foods/${info.file}`)
          .then(async (r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return { category, foods: await r.json() };
          })
          .catch((err) => { throw new Error(`[foodDB] Failed to fetch "${category}" (${info.file}): ${err.message}`); }),
      ]),
    );

    while (pendingFetches.size) {
      const { category, foods } = await Promise.race(pendingFetches.values());
      pendingFetches.delete(category);

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
      for (let i = 0; i < records.length; i += CHUNK) {
        const { error } = await db.foods.bulkInsert(records.slice(i, i + CHUNK));
        if (error?.length) {
          insertErrors += error.length;
          console.warn(`[foodDB] bulkInsert: ${error.length} errors in "${category}" chunk ${Math.floor(i / CHUNK)}`, error[0]);
        }
      }

      // Add to in-memory cache progressively (always, so current session can search)
      for (const r of records) {
        _cache.push({ ...r, _lower: r.name.toLowerCase(), color: assignColor(r) });
      }

      // Enable search as soon as the first batch of foods is available.
      // The full binary-search index isn't built yet, so searchFoods will
      // fall back to a linear scan until _indexReady is set below.
      if (!_ready) _ready = true;

      loaded += foods.length;
      onProgress?.({ status: 'downloading', loaded, total, category });
    }
  }

  // Only persist the version if all records were stored successfully.
  // If inserts failed, the DB is incomplete — skip writing the version so the
  // next session retries the full download rather than loading partial data.
  if (insertErrors === 0) {
    await db.meta.upsert({ key: 'version', value: FOOD_DB_VERSION });
  } else {
    console.warn(`[foodDB] Skipping version write — ${insertErrors} insert error(s) detected; will retry on next load. If this persists, clear site data in browser settings.`);
  }
  buildSearchIndex();
  _indexReady = true;
  onProgress?.({ status: 'done', loaded, total });
}

// ── Search (in-memory, instant) ──

export function searchFoods(query, limit = 50) {
  const q = (query || '').trim().toLowerCase();
  if (q.length < MIN_SEARCH_LENGTH) return [];
  // No data yet — first batch hasn't arrived; return empty rather than scanning nothing.
  if (!_ready) return [];

  // While the sorted index is still being built (first-download in progress),
  // fall back to a linear scan so search is available from the first batch.
  if (!_indexReady) {
    const seen = new Set();
    const results = [];
    // Pass 1: full-name prefix
    for (const food of _cache) {
      if (food._lower.startsWith(q)) {
        seen.add(food);
        results.push(food);
        if (results.length >= limit) return results;
      }
    }
    // Pass 2: any-word prefix
    for (const food of _cache) {
      if (!seen.has(food)) {
        const words = food._lower.split(/\s+/);
        if (words.some((w) => w.startsWith(q))) {
          results.push(food);
          if (results.length >= limit) return results;
        }
      }
    }
    return results;
  }

  const seen = new Set();
  const results = [];

  // Phase 1: full-name prefix matches — binary search O(log n + k)
  let si = lowerBound(q);
  while (si < _cache.length && _cache[si]._lower.startsWith(q)) {
    seen.add(si);
    results.push(_cache[si]);
    if (results.length >= limit) return results;
    si++;
  }

  // Phase 2: any-word prefix matches — binary search on word index O(log m + j)
  let wi = wordLowerBound(q);
  while (wi < _wordIndex.length && _wordIndex[wi][0].startsWith(q)) {
    const ci = _wordIndex[wi][1];
    if (!seen.has(ci)) {
      seen.add(ci);
      results.push(_cache[ci]);
      if (results.length >= limit) return results;
    }
    wi++;
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
  _wordIndex = [];
  _ready = false;
  _indexReady = false;
  _loadingPromise = null;
}
