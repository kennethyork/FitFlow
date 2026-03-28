// ── Client-side Food Search ──
// Searches Open Food Facts directly from the browser using the v2 REST API.
// Keeps a small session cache so repeated searches feel instant.

const SEARCH_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/search';
const PRODUCT_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';
const MIN_SEARCH_LENGTH = 2;
const MAX_RESULTS = 20;
const FETCH_TIMEOUT_MS = 8000;
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
  // Fruits
  { name: 'Banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, serving: '1 medium', color: 'yellow', category: 'Fruits' },
  { name: 'Apple', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, serving: '1 medium', color: 'green', category: 'Fruits' },
  { name: 'Orange', calories: 62, protein: 1.2, carbs: 15, fat: 0.2, serving: '1 medium', color: 'green', category: 'Fruits' },
  { name: 'Strawberries', calories: 49, protein: 1, carbs: 12, fat: 0.5, serving: '1 cup', color: 'green', category: 'Fruits' },
  { name: 'Blueberries', calories: 84, protein: 1.1, carbs: 21, fat: 0.5, serving: '1 cup', color: 'green', category: 'Fruits' },
  { name: 'Grapes', calories: 104, protein: 1.1, carbs: 27, fat: 0.2, serving: '1 cup', color: 'yellow', category: 'Fruits' },
  { name: 'Mango', calories: 99, protein: 1.4, carbs: 25, fat: 0.6, serving: '1 cup', color: 'yellow', category: 'Fruits' },
  { name: 'Pineapple', calories: 82, protein: 0.9, carbs: 22, fat: 0.2, serving: '1 cup', color: 'green', category: 'Fruits' },
  { name: 'Watermelon', calories: 46, protein: 0.9, carbs: 11, fat: 0.2, serving: '1 cup', color: 'green', category: 'Fruits' },
  // Vegetables
  { name: 'Broccoli', calories: 55, protein: 3.7, carbs: 11, fat: 0.6, serving: '1 cup', color: 'green', category: 'Vegetables' },
  { name: 'Spinach', calories: 7, protein: 0.9, carbs: 1.1, fat: 0.1, serving: '1 cup raw', color: 'green', category: 'Vegetables' },
  { name: 'Carrots', calories: 52, protein: 1.2, carbs: 12, fat: 0.3, serving: '1 cup', color: 'green', category: 'Vegetables' },
  { name: 'Sweet Potato', calories: 103, protein: 2.3, carbs: 24, fat: 0.1, serving: '1 medium', color: 'yellow', category: 'Vegetables' },
  { name: 'Salad Bowl', calories: 90, protein: 3, carbs: 11, fat: 4, serving: '1 bowl', color: 'green', category: 'Vegetables' },
  { name: 'Tomato', calories: 35, protein: 1.5, carbs: 7, fat: 0.4, serving: '1 cup', color: 'green', category: 'Vegetables' },
  { name: 'Cucumber', calories: 16, protein: 0.7, carbs: 3.6, fat: 0.1, serving: '1 cup', color: 'green', category: 'Vegetables' },
  { name: 'Bell Pepper', calories: 31, protein: 1, carbs: 7.6, fat: 0.3, serving: '1 medium', color: 'green', category: 'Vegetables' },
  // Grains & Bakery
  { name: 'White Rice', calories: 205, protein: 4.3, carbs: 45, fat: 0.4, serving: '1 cup cooked', color: 'yellow', category: 'Grains & Bakery' },
  { name: 'Brown Rice', calories: 216, protein: 5, carbs: 45, fat: 1.8, serving: '1 cup cooked', color: 'yellow', category: 'Grains & Bakery' },
  { name: 'Oatmeal', calories: 150, protein: 5, carbs: 27, fat: 3, serving: '1 cup cooked', color: 'yellow', category: 'Grains & Bakery' },
  { name: 'Whole Wheat Bread', calories: 69, protein: 3.6, carbs: 12, fat: 1, serving: '1 slice', color: 'yellow', category: 'Grains & Bakery' },
  { name: 'White Bread', calories: 67, protein: 2.7, carbs: 12.7, fat: 0.9, serving: '1 slice', color: 'yellow', category: 'Grains & Bakery' },
  { name: 'Pasta', calories: 220, protein: 8, carbs: 43, fat: 1.3, serving: '1 cup cooked', color: 'yellow', category: 'Grains & Bakery' },
  { name: 'Bagel', calories: 270, protein: 10, carbs: 53, fat: 1.5, serving: '1 medium', color: 'yellow', category: 'Grains & Bakery' },
  { name: 'Tortilla', calories: 146, protein: 3.5, carbs: 25, fat: 3.5, serving: '1 medium', color: 'yellow', category: 'Grains & Bakery' },
  { name: 'Granola Bar', calories: 190, protein: 4, carbs: 29, fat: 7, serving: '1 bar', color: 'yellow', category: 'Grains & Bakery' },
  // Meat & Poultry
  { name: 'Grilled Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 4, serving: '100 g', color: 'yellow', category: 'Meat' },
  { name: 'Chicken Thigh', calories: 209, protein: 26, carbs: 0, fat: 11, serving: '100 g', color: 'yellow', category: 'Meat' },
  { name: 'Ground Beef (80/20)', calories: 215, protein: 26, carbs: 0, fat: 13, serving: '100 g', color: 'yellow', category: 'Meat' },
  { name: 'Steak (Sirloin)', calories: 207, protein: 26, carbs: 0, fat: 11, serving: '100 g', color: 'yellow', category: 'Meat' },
  { name: 'Turkey Breast', calories: 135, protein: 30, carbs: 0, fat: 1, serving: '100 g', color: 'yellow', category: 'Meat' },
  { name: 'Pork Chop', calories: 187, protein: 27, carbs: 0, fat: 9, serving: '100 g', color: 'yellow', category: 'Meat' },
  { name: 'Bacon', calories: 541, protein: 37, carbs: 1.4, fat: 42, serving: '100 g', color: 'red', category: 'Meat' },
  { name: 'Ham', calories: 163, protein: 17, carbs: 4, fat: 8, serving: '100 g', color: 'yellow', category: 'Meat' },
  // Seafood
  { name: 'Salmon Fillet', calories: 208, protein: 20, carbs: 0, fat: 13, serving: '100 g', color: 'yellow', category: 'Seafood' },
  { name: 'Tuna (canned)', calories: 116, protein: 26, carbs: 0, fat: 1, serving: '100 g', color: 'yellow', category: 'Seafood' },
  { name: 'Shrimp', calories: 99, protein: 24, carbs: 0.2, fat: 0.3, serving: '100 g', color: 'yellow', category: 'Seafood' },
  { name: 'Tilapia', calories: 128, protein: 26, carbs: 0, fat: 3, serving: '100 g', color: 'yellow', category: 'Seafood' },
  { name: 'Cod', calories: 105, protein: 23, carbs: 0, fat: 1, serving: '100 g', color: 'yellow', category: 'Seafood' },
  // Dairy & Eggs
  { name: 'Scrambled Eggs', calories: 140, protein: 12, carbs: 1, fat: 10, serving: '2 eggs', color: 'yellow', category: 'Dairy & Eggs' },
  { name: 'Boiled Egg', calories: 78, protein: 6, carbs: 0.6, fat: 5, serving: '1 large', color: 'yellow', category: 'Dairy & Eggs' },
  { name: 'Greek Yogurt', calories: 120, protein: 15, carbs: 6, fat: 4, serving: '1 container', color: 'yellow', category: 'Dairy & Eggs' },
  { name: 'Whole Milk', calories: 149, protein: 8, carbs: 12, fat: 8, serving: '1 cup', color: 'yellow', category: 'Dairy & Eggs' },
  { name: 'Skim Milk', calories: 83, protein: 8, carbs: 12, fat: 0.2, serving: '1 cup', color: 'green', category: 'Dairy & Eggs' },
  { name: 'Cheddar Cheese', calories: 113, protein: 7, carbs: 0.4, fat: 9, serving: '1 oz', color: 'yellow', category: 'Dairy & Eggs' },
  { name: 'Cottage Cheese', calories: 163, protein: 28, carbs: 6, fat: 2, serving: '1 cup', color: 'yellow', category: 'Dairy & Eggs' },
  { name: 'Butter', calories: 102, protein: 0.1, carbs: 0, fat: 11.5, serving: '1 tbsp', color: 'yellow', category: 'Dairy & Eggs' },
  // Legumes
  { name: 'Black Beans', calories: 227, protein: 15, carbs: 41, fat: 0.9, serving: '1 cup cooked', color: 'yellow', category: 'Legumes' },
  { name: 'Chickpeas', calories: 269, protein: 15, carbs: 45, fat: 4, serving: '1 cup cooked', color: 'yellow', category: 'Legumes' },
  { name: 'Lentils', calories: 230, protein: 18, carbs: 40, fat: 0.8, serving: '1 cup cooked', color: 'yellow', category: 'Legumes' },
  { name: 'Kidney Beans', calories: 225, protein: 15, carbs: 40, fat: 0.9, serving: '1 cup cooked', color: 'yellow', category: 'Legumes' },
  { name: 'Edamame', calories: 188, protein: 17, carbs: 14, fat: 8, serving: '1 cup', color: 'yellow', category: 'Legumes' },
  // Nuts & Seeds
  { name: 'Peanut Butter', calories: 190, protein: 7, carbs: 8, fat: 16, serving: '2 tbsp', color: 'yellow', category: 'Nuts & Seeds' },
  { name: 'Almonds', calories: 164, protein: 6, carbs: 6, fat: 14, serving: '1 oz', color: 'yellow', category: 'Nuts & Seeds' },
  { name: 'Walnuts', calories: 185, protein: 4, carbs: 4, fat: 18, serving: '1 oz', color: 'yellow', category: 'Nuts & Seeds' },
  { name: 'Cashews', calories: 157, protein: 5, carbs: 9, fat: 12, serving: '1 oz', color: 'yellow', category: 'Nuts & Seeds' },
  { name: 'Trail Mix', calories: 180, protein: 5, carbs: 16, fat: 12, serving: '1 oz', color: 'yellow', category: 'Snacks' },
  { name: 'Sunflower Seeds', calories: 165, protein: 5.5, carbs: 7, fat: 14, serving: '1 oz', color: 'yellow', category: 'Nuts & Seeds' },
  // Prepared & Fast Food
  { name: 'Avocado Toast', calories: 230, protein: 6, carbs: 24, fat: 12, serving: '1 slice', color: 'yellow', category: 'Prepared Meals' },
  { name: 'Burger', calories: 540, protein: 34, carbs: 40, fat: 27, serving: '1 burger', color: 'red', category: 'Fast Food' },
  { name: 'Pizza Slice', calories: 285, protein: 12, carbs: 36, fat: 10, serving: '1 slice', color: 'yellow', category: 'Fast Food' },
  { name: 'French Fries', calories: 365, protein: 4, carbs: 48, fat: 17, serving: 'medium serving', color: 'red', category: 'Fast Food' },
  { name: 'Burrito', calories: 490, protein: 23, carbs: 62, fat: 17, serving: '1 burrito', color: 'red', category: 'Prepared Meals' },
  { name: 'Caesar Salad', calories: 360, protein: 9, carbs: 17, fat: 30, serving: '1 serving', color: 'red', category: 'Restaurant' },
  { name: 'Sushi Roll', calories: 250, protein: 9, carbs: 44, fat: 4, serving: '8 pieces', color: 'yellow', category: 'Restaurant' },
  { name: 'Grilled Cheese Sandwich', calories: 370, protein: 13, carbs: 34, fat: 21, serving: '1 sandwich', color: 'red', category: 'Prepared Meals' },
  { name: 'Mac and Cheese', calories: 450, protein: 18, carbs: 56, fat: 18, serving: '1 cup', color: 'red', category: 'Prepared Meals' },
  { name: 'Soup (Chicken Noodle)', calories: 150, protein: 8, carbs: 20, fat: 4, serving: '1.5 cups', color: 'yellow', category: 'Soups & Sauces' },
  // Beverages
  { name: 'Orange Juice', calories: 112, protein: 1.7, carbs: 26, fat: 0.5, serving: '1 cup', color: 'yellow', category: 'Beverages' },
  { name: 'Coffee (black)', calories: 5, protein: 0.3, carbs: 0, fat: 0, serving: '8 oz', color: 'green', category: 'Beverages' },
  { name: 'Latte', calories: 190, protein: 10, carbs: 19, fat: 7, serving: '16 oz', color: 'yellow', category: 'Beverages' },
  { name: 'Smoothie', calories: 260, protein: 5, carbs: 55, fat: 2, serving: '16 oz', color: 'yellow', category: 'Beverages' },
  // Snacks & Sweets
  { name: 'Protein Shake', calories: 160, protein: 30, carbs: 7, fat: 2, serving: '1 bottle', color: 'yellow', category: 'Supplements' },
  { name: 'Chocolate Bar', calories: 235, protein: 3, carbs: 26, fat: 13, serving: '1.5 oz', color: 'yellow', category: 'Sweets & Desserts' },
  { name: 'Ice Cream', calories: 267, protein: 4.6, carbs: 31, fat: 14, serving: '1 cup', color: 'yellow', category: 'Sweets & Desserts' },
  { name: 'Cookies', calories: 140, protein: 1.5, carbs: 19, fat: 6.5, serving: '2 cookies', color: 'yellow', category: 'Sweets & Desserts' },
  { name: 'Potato Chips', calories: 155, protein: 2, carbs: 14, fat: 10, serving: '1 oz', color: 'yellow', category: 'Snacks' },
  { name: 'Popcorn', calories: 110, protein: 3.5, carbs: 22, fat: 1, serving: '3 cups', color: 'yellow', category: 'Snacks' },
  { name: 'Hummus', calories: 70, protein: 2, carbs: 8, fat: 3, serving: '2 tbsp', color: 'green', category: 'Condiments' },
  // Oils & Condiments
  { name: 'Olive Oil', calories: 119, protein: 0, carbs: 0, fat: 13.5, serving: '1 tbsp', color: 'yellow', category: 'Oils & Fats' },
  { name: 'Mayonnaise', calories: 94, protein: 0.1, carbs: 0.1, fat: 10, serving: '1 tbsp', color: 'yellow', category: 'Condiments' },
  { name: 'Ketchup', calories: 19, protein: 0.3, carbs: 4.6, fat: 0, serving: '1 tbsp', color: 'green', category: 'Condiments' },
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
    fields: PRODUCT_FIELDS,
    page_size: String(MAX_RESULTS),
    page: '1',
    sort_by: 'unique_scans_n',
  });

  let results;
  try {
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
    results = (data.products || [])
      .map((product, index) => normalizeFood(product, index))
      .filter(Boolean);
  } catch (err) {
    // Re-throw only when the caller explicitly cancelled the request so the
    // caller can ignore the result.  A timeout abort falls through to the
    // offline fallback so the user still sees suggestions.
    if (err?.name === 'AbortError' && options.signal?.aborted) throw err;
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
