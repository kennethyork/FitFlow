// ── Client-side Food Search ──
// Searches USDA FoodData Central directly from the browser using the v1 REST API.
// Keeps a small session cache so repeated searches feel instant.

// Set VITE_FDC_API_KEY in your environment for production use.
// Request a free key at https://fdc.nal.usda.gov/api-key-signup.html
const FDC_API_KEY = import.meta.env.VITE_FDC_API_KEY || 'DEMO_KEY';
const SEARCH_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const MIN_SEARCH_LENGTH = 2;
const MAX_RESULTS = 20;
const FETCH_TIMEOUT_MS = 8000;
const HOUR_IN_MS = 1000 * 60 * 60;
// Cache repeated searches for the same session so we stay fast and avoid
// re-hitting the public search endpoint for terms the user just typed.
// Six hours covers a typical day of meal logging even if the tab stays open.
const CACHE_TTL_MS = 6 * HOUR_IN_MS;
const CACHE_LIMIT = 50;
const SESSION_CACHE_KEY = 'ff_food_search_cache_v2';

export const FOOD_CATEGORIES = [
  'Baby Foods', 'Beverages', 'Condiments', 'Dairy & Eggs', 'Fast Food',
  'Fruits', 'Grains & Bakery', 'Legumes', 'Meat', 'Nuts & Seeds',
  'Oils & Fats', 'Other', 'Prepared Meals', 'Restaurant', 'Seafood',
  'Snacks', 'Soups & Sauces', 'Spices & Herbs', 'Supplements',
  'Sweets & Desserts', 'Vegetables',
];

// Map USDA FDC food categories to the app's canonical categories.
const CATEGORY_MAP = {
  'Baked Products': 'Grains & Bakery',
  'Beef Products': 'Meat',
  'Beverages': 'Beverages',
  'Breakfast Cereals': 'Grains & Bakery',
  'Cereal Grains and Pasta': 'Grains & Bakery',
  'Dairy and Egg Products': 'Dairy & Eggs',
  'Fats and Oils': 'Oils & Fats',
  'Finfish and Shellfish Products': 'Seafood',
  'Fruits and Fruit Juices': 'Fruits',
  'Lamb, Veal, and Game Products': 'Meat',
  'Legumes and Legume Products': 'Legumes',
  'Meals, Entrees, and Side Dishes': 'Prepared Meals',
  'Nut and Seed Products': 'Nuts & Seeds',
  'Pork Products': 'Meat',
  'Poultry Products': 'Meat',
  'Restaurant Foods': 'Restaurant',
  'Sausages and Luncheon Meats': 'Meat',
  'Snacks': 'Snacks',
  'Soups, Sauces, and Gravies': 'Soups & Sauces',
  'Spices and Herbs': 'Spices & Herbs',
  'Sweets': 'Sweets & Desserts',
  'Vegetables and Vegetable Products': 'Vegetables',
  'Baby Foods': 'Baby Foods',
  'Fast Foods': 'Fast Food',
};

let _ready = true;
let _searchCache = loadSearchCache();
let _recentFoods = [];

function loadSearchCache() {
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    return new Map(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Map();
  }
}

function persistSearchCache() {
  try {
    const entries = Array.from(_searchCache.entries());
    while (entries.length > CACHE_LIMIT) entries.shift();
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage issues (private mode, quota, etc.)
  }
}

function roundNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 10) / 10;
}

function assignColor(calories) {
  if (calories <= 100) return 'green';
  if (calories <= 300) return 'yellow';
  return 'red';
}

function extractNutrient(foodNutrients, nutrientId) {
  const found = (foodNutrients || []).find((n) => n.nutrientId === nutrientId);
  return found ? roundNumber(found.value) : 0;
}

function normalizeServing(food) {
  if (food.householdServingFullText) return food.householdServingFullText.trim();
  if (food.servingSize && food.servingSizeUnit) {
    return `${food.servingSize} ${food.servingSizeUnit}`.trim();
  }
  return '100 g';
}

function normalizeCategory(food) {
  const cat = food.foodCategory || '';
  return CATEGORY_MAP[cat] || (cat ? cat.trim() : 'Other');
}

function normalizeFood(food, index = 0) {
  const name = (food.description || '').trim();
  if (!name) return null;

  const nutrients = food.foodNutrients || [];
  const calories = extractNutrient(nutrients, 1008);

  return {
    id: food.fdcId ? String(food.fdcId) : `${name}-${index}`,
    name,
    brand: (food.brandOwner || food.brandName || '').trim(),
    category: normalizeCategory(food),
    serving: normalizeServing(food),
    calories,
    protein: extractNutrient(nutrients, 1003),
    carbs: extractNutrient(nutrients, 1005),
    fat: extractNutrient(nutrients, 1004),
    fiber: extractNutrient(nutrients, 1079),
    sugar: extractNutrient(nutrients, 2000),
    barcode: food.gtinUpc || '',
    color: assignColor(calories),
  };
}

function updateRecentFoods(foods) {
  const merged = [...foods, ..._recentFoods];
  const seen = new Set();
  _recentFoods = merged.filter((food) => {
    const key = food.barcode || `${food.name}|${food.brand}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 100);
}

function getCachedResults(query) {
  const cached = _searchCache.get(query);
  if (!cached) return null;
  if ((Date.now() - cached.ts) > CACHE_TTL_MS) {
    _searchCache.delete(query);
    persistSearchCache();
    return null;
  }
  return cached.results;
}

function cacheResults(query, results) {
  _searchCache.set(query, { ts: Date.now(), results });
  if (_searchCache.size > CACHE_LIMIT) {
    const oldestKey = _searchCache.keys().next().value;
    if (oldestKey) _searchCache.delete(oldestKey);
  }
  persistSearchCache();
}

export function isFoodDBReady() {
  return _ready;
}

export function getFoodCount() {
  return _recentFoods.length;
}

export async function loadFoodDatabase(onProgress) {
  _ready = true;
  onProgress?.({ status: 'done', loaded: getFoodCount(), total: getFoodCount() });
}

export async function searchFoods(query, options = {}) {
  const q = (query || '').trim().toLowerCase();
  if (q.length < MIN_SEARCH_LENGTH) return [];

  const cached = getCachedResults(q);
  if (cached) return cached;

  const params = new URLSearchParams({
    query: q,
    pageSize: String(MAX_RESULTS),
    pageNumber: '1',
    api_key: FDC_API_KEY, // USDA FDC API requires this as a query parameter
  });

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT_MS);

  // Combine caller's abort signal with the internal timeout signal.
  // AbortSignal.any is available in modern browsers; fall back to the
  // timeout-only controller in environments that don't have it yet.
  let signal;
  if (options.signal && typeof AbortSignal.any === 'function') {
    signal = AbortSignal.any([options.signal, timeoutController.signal]);
  } else {
    signal = timeoutController.signal;
  }

  let response;
  try {
    response = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Food search failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const results = (data.foods || [])
    .map((food, index) => normalizeFood(food, index))
    .filter(Boolean);

  cacheResults(q, results);
  updateRecentFoods(results);
  return results;
}

export async function lookupBarcode(code, options = {}) {
  const trimmed = (code || '').trim();
  if (!trimmed) return null;

  const params = new URLSearchParams({
    query: trimmed,
    pageSize: '5',
    pageNumber: '1',
    api_key: FDC_API_KEY,
  });

  const response = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`, {
    signal: options.signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) return null;
  const data = await response.json();
  const match = (data.foods || []).find((f) => f.gtinUpc === trimmed) || null;
  if (!match) return null;
  const food = normalizeFood(match);
  if (food) updateRecentFoods([food]);
  return food;
}

export function getMealSuggestions(remainingCals, goalType) {
  const maxCalories = remainingCals > 0 ? remainingCals : 500;
  const pool = _recentFoods.filter((food) => food.calories > 0 && food.calories <= maxCalories);

  const filtered = goalType === 'lose'
    ? pool.filter((food) => food.color !== 'red')
    : pool;

  const seenCategories = new Set();
  const picks = [];
  for (const food of filtered) {
    if (picks.length >= 5) break;
    if (!seenCategories.has(food.category)) {
      seenCategories.add(food.category);
      picks.push(food);
    }
  }
  for (const food of filtered) {
    if (picks.length >= 5) break;
    if (!picks.includes(food)) picks.push(food);
  }

  return picks.map((food) => ({
    name: food.name,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    serving: food.serving,
    color: food.color,
  }));
}

export async function clearFoodDatabase() {
  _searchCache.clear();
  _recentFoods = [];
  try {
    sessionStorage.removeItem(SESSION_CACHE_KEY);
  } catch {
    // Ignore storage issues
  }
}
