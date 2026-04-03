// ── Recipe RSS Feed Fetcher ──
// Loads pre-fetched recipe data from build-time JSON.
// No CORS proxies needed — data is same-origin.

// ── Feed cache (30-minute TTL) ──
let _recipeCache = null;
let _recipeCacheTs = 0;
const CACHE_TTL = 30 * 60 * 1000;

// ── Static feed data (loaded once from build-time JSON) ──
let _staticRecipes = null;
async function loadStaticRecipes() {
  if (_staticRecipes) return _staticRecipes;
  try {
    const base = import.meta.env.BASE_URL || '/';
    const cacheBust = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${base}data/recipe-feeds.json?v=${cacheBust}`);
    if (res.ok) _staticRecipes = await res.json();
  } catch { /* ignore */ }
  return _staticRecipes || [];
}

// Deterministic daily shuffle
function dailyShuffle(arr) {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  const seed = dayOfYear * 7 + 31;
  return arr
    .map((v, i) => ({ v, sort: ((seed + i * 2654435761) >>> 0) % 1000000 }))
    .sort((a, b) => a.sort - b.sort)
    .map((x) => x.v);
}

// Keyword filter — keep only food/recipe-related titles
const INCLUDE = /recipe|cook|meal|prep|breakfast|lunch|dinner|snack|salad|soup|bowl|smoothie|bake|roast|grill|stir.?fry|slow.?cook|instant.?pot|sheet.?pan|one.?pot|healthy|protein|low.?calorie|chicken|salmon|tofu|pasta|rice|quinoa|oat|egg|wrap|sandwich|taco|curry|chili|stew/i;
const EXCLUDE = /sponsor|giveaway|roundup|best of \d|amazon|review|gift guide|linkup/i;

/**
 * Fetch recipes from build-time static JSON.
 * Returns up to 20 recipes, shuffled daily.
 */
export async function fetchRecipeFeeds() {
  if (_recipeCache && Date.now() - _recipeCacheTs < CACHE_TTL) {
    return _recipeCache;
  }

  const allRecipes = await loadStaticRecipes();

  const filtered = allRecipes.filter(
    (r) => INCLUDE.test(r.title) && !EXCLUDE.test(r.title)
  );

  // If strict filter is too aggressive, fall back to just exclude
  const pool = filtered.length >= 10
    ? filtered
    : allRecipes.filter((r) => !EXCLUDE.test(r.title));

  const shuffled = dailyShuffle(pool).slice(0, 20);

  _recipeCache = shuffled;
  _recipeCacheTs = Date.now();
  return shuffled;
}

/**
 * Pick 4 daily meal-slot recipes (breakfast, lunch, dinner, snack)
 * from RSS results. Uses title keyword heuristics for slot assignment.
 */
export function pickDailyMeals(recipes) {
  if (!recipes?.length) return null;

  const slots = { breakfast: null, lunch: null, dinner: null, snack: null };

  const breakfastRe = /breakfast|oat|pancake|waffle|egg|smoothie|muffin|granola|toast|morning|brunch/i;
  const snackRe = /snack|bar|bite|ball|dip|appetizer|trail.?mix|hummus|cracker/i;
  const dinnerRe = /dinner|stew|curry|chili|roast|sheet.?pan|slow.?cook|pot|casserole|salmon|chicken breast|steak|pasta|stir.?fry/i;

  for (const r of recipes) {
    if (!slots.breakfast && breakfastRe.test(r.title)) slots.breakfast = r;
    else if (!slots.snack && snackRe.test(r.title)) slots.snack = r;
    else if (!slots.dinner && dinnerRe.test(r.title)) slots.dinner = r;
    else if (!slots.lunch && !slots.lunch) slots.lunch = r;
    // Fill remaining empty slots with next available
    if (slots.breakfast && slots.lunch && slots.dinner && slots.snack) break;
  }

  // Fill any remaining nulls with whatever is left
  const used = new Set(Object.values(slots).filter(Boolean).map((r) => r.id));
  for (const key of Object.keys(slots)) {
    if (!slots[key]) {
      const next = recipes.find((r) => !used.has(r.id));
      if (next) {
        slots[key] = next;
        used.add(next.id);
      }
    }
  }

  // Return null if we couldn't fill any slots
  if (!Object.values(slots).some(Boolean)) return null;

  const emojis = { breakfast: '🍳', lunch: '🥗', dinner: '🍲', snack: '🍎' };

  const result = {};
  for (const [key, r] of Object.entries(slots)) {
    if (r) {
      result[key] = {
        name: r.title,
        emoji: emojis[key],
        link: r.link,
        source: r.source,
        image: r.image,
        description: r.description,
        // RSS doesn't provide macros — set to 0 so UI can handle gracefully
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        time: '',
        ingredients: [],
        steps: [],
      };
    }
  }

  return Object.keys(result).length ? result : null;
}
