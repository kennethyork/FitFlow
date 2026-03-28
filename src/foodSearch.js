// ── Client-side Food Search ──
// Searches Open Food Facts directly from the browser.
// Keeps a small session cache so repeated searches feel instant.

const SEARCH_ENDPOINT = 'https://world.openfoodfacts.org/cgi/search.pl';
const PRODUCT_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';
const MIN_SEARCH_LENGTH = 2;
const MAX_RESULTS = 20;
const HOUR_IN_MS = 1000 * 60 * 60;
// Cache repeated searches for the same session so we stay fast and avoid
// re-hitting the public search endpoint for terms the user just typed.
// Six hours covers a typical day of meal logging even if the tab stays open.
const CACHE_TTL_MS = 6 * HOUR_IN_MS;
const CACHE_LIMIT = 50;
const SESSION_CACHE_KEY = 'ff_food_search_cache_v1';
const PRODUCT_FIELDS = [
  'code',
  'product_name',
  'generic_name',
  'abbreviated_product_name',
  'brands',
  'categories',
  'serving_size',
  'quantity',
  'nutriments',
].join(',');

export const FOOD_CATEGORIES = [
  'Baby Foods', 'Beverages', 'Condiments', 'Dairy & Eggs', 'Fast Food',
  'Fruits', 'Grains & Bakery', 'Legumes', 'Meat', 'Nuts & Seeds',
  'Oils & Fats', 'Other', 'Prepared Meals', 'Restaurant', 'Seafood',
  'Snacks', 'Soups & Sauces', 'Spices & Herbs', 'Supplements',
  'Sweets & Desserts', 'Vegetables',
];

// Approximate macros used only when the public API is unavailable so search
// still returns useful starter foods instead of failing empty.
const FALLBACK_MEALS = [
  { name: 'Banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, serving: '1 medium', color: 'yellow', category: 'Fruits' },
  { name: 'Apple', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, serving: '1 medium', color: 'green', category: 'Fruits' },
  { name: 'White Rice', calories: 205, protein: 4.3, carbs: 45, fat: 0.4, serving: '1 cup cooked', color: 'yellow', category: 'Grains & Bakery' },
  { name: 'Scrambled Eggs', calories: 140, protein: 12, carbs: 1, fat: 10, serving: '2 eggs', color: 'yellow', category: 'Dairy & Eggs' },
  { name: 'Greek Yogurt', calories: 120, protein: 15, carbs: 6, fat: 4, serving: '1 container', color: 'yellow', category: 'Dairy & Eggs' },
  { name: 'Grilled Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 4, serving: '100 g', color: 'yellow', category: 'Meat' },
  { name: 'Oatmeal', calories: 150, protein: 5, carbs: 27, fat: 3, serving: '1 cup cooked', color: 'yellow', category: 'Grains & Bakery' },
  { name: 'Salad Bowl', calories: 90, protein: 3, carbs: 11, fat: 4, serving: '1 bowl', color: 'green', category: 'Vegetables' },
  { name: 'Salmon Fillet', calories: 208, protein: 20, carbs: 0, fat: 13, serving: '100 g', color: 'yellow', category: 'Seafood' },
  { name: 'Avocado Toast', calories: 230, protein: 6, carbs: 24, fat: 12, serving: '1 slice', color: 'yellow', category: 'Prepared Meals' },
  { name: 'Peanut Butter', calories: 190, protein: 7, carbs: 8, fat: 16, serving: '2 tbsp', color: 'yellow', category: 'Nuts & Seeds' },
  { name: 'Trail Mix', calories: 180, protein: 5, carbs: 16, fat: 12, serving: '1 oz', color: 'yellow', category: 'Snacks' },
  { name: 'Protein Shake', calories: 160, protein: 30, carbs: 7, fat: 2, serving: '1 bottle', color: 'yellow', category: 'Supplements' },
];

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

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function firstNumber(...values) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return roundNumber(num);
  }
  return 0;
}

function normalizeServing(product) {
  return firstString(product.serving_size, product.quantity) || '100 g';
}

function normalizeCategory(product) {
  const primary = firstString(product.categories);
  if (primary) return primary.split(',')[0].trim();
  return 'Other';
}

function normalizeFood(product, index = 0) {
  const nutriments = product?.nutriments || {};
  const name = firstString(product.product_name, product.generic_name, product.abbreviated_product_name);
  if (!name) return null;

  const calories = firstNumber(
    nutriments['energy-kcal_serving'],
    nutriments['energy-kcal_100g'],
    nutriments['energy-kcal'],
    nutriments['energy-kcal_value'],
  );

  const food = {
    id: firstString(product.code) || `${name}-${index}`,
    name,
    brand: firstString(product.brands).split(',')[0]?.trim() || '',
    category: normalizeCategory(product),
    serving: normalizeServing(product),
    calories,
    protein: firstNumber(nutriments.proteins_serving, nutriments.proteins_100g, nutriments.proteins, nutriments.proteins_value),
    carbs: firstNumber(
      nutriments.carbohydrates_serving,
      nutriments.carbohydrates_100g,
      nutriments.carbohydrates,
      nutriments.carbohydrates_value,
    ),
    fat: firstNumber(nutriments.fat_serving, nutriments.fat_100g, nutriments.fat, nutriments.fat_value),
    fiber: firstNumber(nutriments.fiber_serving, nutriments.fiber_100g, nutriments.fiber, nutriments.fiber_value),
    sugar: firstNumber(nutriments.sugars_serving, nutriments.sugars_100g, nutriments.sugars, nutriments.sugars_value),
    barcode: firstString(product.code),
  };

  return { ...food, color: assignColor(food.calories) };
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

function searchFallbackFoods(query, limit = MAX_RESULTS) {
  const q = query.toLowerCase();
  return FALLBACK_MEALS
    .filter((food) => {
      const haystacks = [food.name, food.category].filter(Boolean).map((value) => value.toLowerCase());
      return haystacks.some((value) => value.includes(q));
    })
    .slice(0, limit);
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
    search_terms: q,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(MAX_RESULTS),
    fields: PRODUCT_FIELDS,
  });

  let results;
  try {
    const response = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`, {
      signal: options.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Food search failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    results = (data.products || [])
      .map((product, index) => normalizeFood(product, index))
      .filter(Boolean);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    results = searchFallbackFoods(q);
  }

  cacheResults(q, results);
  updateRecentFoods(results);
  return results;
}

export async function lookupBarcode(code, options = {}) {
  const trimmed = (code || '').trim();
  if (!trimmed) return null;

  const response = await fetch(`${PRODUCT_ENDPOINT}/${encodeURIComponent(trimmed)}?fields=${encodeURIComponent(PRODUCT_FIELDS)}`, {
    signal: options.signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) return null;
  const data = await response.json();
  const food = normalizeFood(data.product);
  if (food) updateRecentFoods([food]);
  return food;
}

export function getMealSuggestions(remainingCals, goalType) {
  const maxCalories = remainingCals > 0 ? remainingCals : 500;
  const pool = (_recentFoods.length ? _recentFoods : FALLBACK_MEALS)
    .filter((food) => food.calories > 0 && food.calories <= maxCalories);

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
