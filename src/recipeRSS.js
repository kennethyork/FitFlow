// ── Recipe RSS Feed Fetcher ──
// Fetches healthy recipes from cooking blogs/sites via RSS.
// Uses the same CORS proxy + caching pattern as youtubeRSS.js.

const RECIPE_FEEDS = [
  { url: 'https://www.skinnytaste.com/feed/', name: 'Skinnytaste' },
  { url: 'https://minimalistbaker.com/feed/', name: 'Minimalist Baker' },
  { url: 'https://www.budgetbytes.com/feed/', name: 'Budget Bytes' },
  { url: 'https://www.eatingwell.com/feed/', name: 'EatingWell' },
  { url: 'https://cookinglsl.com/feed/', name: 'Cooking LSL' },
  { url: 'https://www.loveandlemons.com/feed/', name: 'Love and Lemons' },
];

// ── CORS proxies ──
const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

// ── Feed cache (30-minute TTL) ──
let _recipeCache = null;
let _recipeCacheTs = 0;
const CACHE_TTL = 30 * 60 * 1000;

function stripHtml(html) {
  if (!html) return '';
  // Remove tags, then decode all HTML entities via textarea trick
  const stripped = html.replace(/<[^>]*>/g, '');
  const ta = document.createElement('textarea');
  ta.innerHTML = stripped;
  return ta.value.replace(/\s+/g, ' ').trim();
}

function extractImage(item) {
  // Try media:content, enclosure, or img in content
  const media = item.querySelector('content[url]');
  if (media) return media.getAttribute('url');
  const enc = item.querySelector('enclosure[url]');
  if (enc) return enc.getAttribute('url');
  const content = item.querySelector('content\\:encoded, description');
  if (content) {
    const match = content.textContent.match(/<img[^>]+src=["']([^"']+)["']/);
    if (match) return match[1];
  }
  return '';
}

function parseRecipeXml(xmlText, sourceName) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const items = doc.querySelectorAll('item');
  const recipes = [];

  items.forEach((item) => {
    const title = item.querySelector('title')?.textContent?.trim() || '';
    const link = item.querySelector('link')?.textContent?.trim() || '';
    const pubDate = item.querySelector('pubDate')?.textContent || '';
    const desc = stripHtml(
      item.querySelector('description')?.textContent || ''
    );
    const image = extractImage(item);

    if (title && link) {
      recipes.push({
        id: `rss-${btoa(link).slice(0, 20)}`,
        title,
        link,
        description: desc.slice(0, 200),
        image,
        source: sourceName,
        published: pubDate,
      });
    }
  });

  return recipes;
}

async function fetchWithProxy(url) {
  const attempts = CORS_PROXIES.map(async (makeProxy) => {
    const res = await fetch(makeProxy(url), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('not ok');
    const text = await res.text();
    if (!text.includes('<rss') && !text.includes('<feed') && !text.includes('<item'))
      throw new Error('not xml');
    return text;
  });
  try {
    return await Promise.any(attempts);
  } catch {
    return null;
  }
}

// Deterministic daily shuffle (same as youtubeRSS)
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
 * Fetch recipes from all RSS feeds.
 * Returns up to 20 recipes, shuffled daily.
 */
export async function fetchRecipeFeeds() {
  if (_recipeCache && Date.now() - _recipeCacheTs < CACHE_TTL) {
    return _recipeCache;
  }

  const allRecipes = [];

  const fetches = RECIPE_FEEDS.map(async (feed) => {
    const xml = await fetchWithProxy(feed.url);
    return xml ? parseRecipeXml(xml, feed.name) : [];
  });

  const results = await Promise.allSettled(fetches);
  for (const r of results) {
    if (r.status === 'fulfilled') allRecipes.push(...r.value);
  }

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
