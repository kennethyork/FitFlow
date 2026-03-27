#!/usr/bin/env node
/**
 * Extract compact food data from USDA FoodData Central JSON files.
 * Produces a single ES module (foodData.js) with all foods from:
 *   - Foundation Foods (Dec 2025)
 *   - SR Legacy (Apr 2018)
 *   - FNDDS / Survey Foods (Oct 2024)
 *
 * Nutrient IDs:
 *   1008 = Energy (kcal), 1003 = Protein, 1005 = Carbs, 1004 = Fat,
 *   1079 = Fiber, 2000 = Total Sugars
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'fdc-data');

// ── Nutrient extraction ──
const NUTRIENT_IDS = {
  1008: 'calories',
  1003: 'protein',
  1005: 'carbs',
  1004: 'fat',
  1079: 'fiber',
  2000: 'sugar',
};

function extractNutrients(foodNutrients) {
  const out = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };
  for (const fn of foodNutrients || []) {
    const id = fn.nutrient?.id;
    if (id && NUTRIENT_IDS[id]) {
      out[NUTRIENT_IDS[id]] = Math.round(fn.amount || 0);
    }
  }
  return out;
}

// ── Serving size from portions ──
function bestServing(portions) {
  if (!portions || !portions.length) return '100g';
  // Prefer portions with gramWeight > 0 and a description
  const good = portions.filter(p => p.gramWeight > 0);
  if (!good.length) return '100g';
  // Prefer "1 cup", "1 medium", etc.
  const preferred = good.find(p =>
    /^1\s+(cup|medium|large|small|slice|piece|tbsp|tablespoon|oz|ounce)/i.test(p.portionDescription || p.modifier || '')
  );
  if (preferred) {
    const desc = preferred.portionDescription || preferred.modifier || '';
    return `${desc} (${Math.round(preferred.gramWeight)}g)`;
  }
  // Take the first with a description
  const first = good.find(p => p.portionDescription || p.modifier);
  if (first) {
    const desc = first.portionDescription || first.modifier || '';
    return `${desc} (${Math.round(first.gramWeight)}g)`;
  }
  return '100g';
}

// ── Title case helper ──
function titleCase(str) {
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-/(])\w/g, c => c.toUpperCase())
    .replace(/,\s*$/, '')
    .trim();
}

// ── Noom-style color ──
function noomColor(cal) {
  // per 100g: green ≤100, yellow ≤250, red >250
  if (cal <= 100) return 'green';
  if (cal <= 250) return 'yellow';
  return 'red';
}

// ── Category mapping ──
const CATEGORY_MAP = {
  'Baked Products': 'Grains & Bakery',
  'Beef Products': 'Protein',
  'Beverages': 'Beverages',
  'Breakfast Cereals': 'Grains & Bakery',
  'Cereal Grains and Pasta': 'Grains & Bakery',
  'Dairy and Egg Products': 'Dairy & Eggs',
  'Fats and Oils': 'Oils & Fats',
  'Finfish and Shellfish Products': 'Seafood',
  'Fruits and Fruit Juices': 'Fruits',
  'Lamb, Veal, and Game Products': 'Protein',
  'Legumes and Legume Products': 'Legumes',
  'Meals, Entrees, and Side Dishes': 'Prepared Meals',
  'Nut and Seed Products': 'Nuts & Seeds',
  'Pork Products': 'Protein',
  'Poultry Products': 'Protein',
  'Restaurant Foods': 'Prepared Meals',
  'Sausages and Luncheon Meats': 'Protein',
  'Snacks': 'Snacks',
  'Soups, Sauces, and Gravies': 'Prepared Meals',
  'Spices and Herbs': 'Spices',
  'Sweets': 'Desserts',
  'Vegetables and Vegetable Products': 'Vegetables',
  'Baby Foods': 'Baby Foods',
  'Fast Foods': 'Fast Food',
  'American Indian/Alaska Native Foods': 'Prepared Meals',
  'Alcoholic Beverages': 'Beverages',
};

function mapCategory(cat) {
  if (!cat) return 'Other';
  return CATEGORY_MAP[cat] || cat;
}

// ── WWEIA category mapping (for FNDDS) ──
const WWEIA_MAP = {
  'Milk, whole': 'Dairy & Eggs',
  'Milk, reduced fat': 'Dairy & Eggs',
  'Milk, lowfat': 'Dairy & Eggs',
  'Milk, nonfat': 'Dairy & Eggs',
  'Flavored milk, whole': 'Dairy & Eggs',
  'Flavored milk, reduced fat': 'Dairy & Eggs',
  'Cheese': 'Dairy & Eggs',
  'Yogurt, regular': 'Dairy & Eggs',
  'Yogurt, Greek': 'Dairy & Eggs',
};

function mapWweiaCategory(wweia) {
  if (!wweia) return 'Other';
  const desc = wweia.wweiaFoodCategoryDescription || '';
  if (WWEIA_MAP[desc]) return WWEIA_MAP[desc];
  const d = desc.toLowerCase();
  if (d.includes('milk') || d.includes('cheese') || d.includes('yogurt') || d.includes('dairy') || d.includes('cream')) return 'Dairy & Eggs';
  if (d.includes('egg')) return 'Dairy & Eggs';
  if (d.includes('beef') || d.includes('pork') || d.includes('lamb') || d.includes('chicken') || d.includes('turkey') || d.includes('poultry') || d.includes('meat') || d.includes('sausage') || d.includes('frank') || d.includes('bacon')) return 'Protein';
  if (d.includes('fish') || d.includes('seafood') || d.includes('shellfish') || d.includes('shrimp') || d.includes('crab')) return 'Seafood';
  if (d.includes('bean') || d.includes('legume') || d.includes('lentil') || d.includes('tofu') || d.includes('soy')) return 'Legumes';
  if (d.includes('nut') || d.includes('seed')) return 'Nuts & Seeds';
  if (d.includes('fruit') || d.includes('apple') || d.includes('banana') || d.includes('berry') || d.includes('citrus') || d.includes('melon')) return 'Fruits';
  if (d.includes('vegetable') || d.includes('potato') || d.includes('tomato') || d.includes('lettuce') || d.includes('carrot') || d.includes('broccoli') || d.includes('corn') || d.includes('green') || d.includes('onion') || d.includes('pepper') || d.includes('squash')) return 'Vegetables';
  if (d.includes('bread') || d.includes('cereal') || d.includes('rice') || d.includes('pasta') || d.includes('grain') || d.includes('oat') || d.includes('pancake') || d.includes('waffle') || d.includes('tortilla') || d.includes('biscuit') || d.includes('roll') || d.includes('cracker') || d.includes('muffin') || d.includes('bagel')) return 'Grains & Bakery';
  if (d.includes('candy') || d.includes('cake') || d.includes('cookie') || d.includes('pie') || d.includes('donut') || d.includes('pastry') || d.includes('sweet') || d.includes('ice cream') || d.includes('frozen dairy') || d.includes('sugar') || d.includes('chocolate') || d.includes('dessert')) return 'Desserts';
  if (d.includes('chip') || d.includes('snack') || d.includes('pretzel') || d.includes('popcorn')) return 'Snacks';
  if (d.includes('beverage') || d.includes('coffee') || d.includes('tea') || d.includes('juice') || d.includes('water') || d.includes('soda') || d.includes('drink') || d.includes('beer') || d.includes('wine') || d.includes('alcohol') || d.includes('liquor') || d.includes('smoothie')) return 'Beverages';
  if (d.includes('soup') || d.includes('stew')) return 'Prepared Meals';
  if (d.includes('sauce') || d.includes('dip') || d.includes('condiment') || d.includes('dressing') || d.includes('gravy') || d.includes('salsa') || d.includes('mayonnaise') || d.includes('mustard') || d.includes('ketchup')) return 'Condiments';
  if (d.includes('oil') || d.includes('butter') || d.includes('margarine') || d.includes('fat') || d.includes('shortening')) return 'Oils & Fats';
  if (d.includes('pizza') || d.includes('burger') || d.includes('sandwich') || d.includes('taco') || d.includes('burrito') || d.includes('wrap') || d.includes('sub') || d.includes('hot dog')) return 'Fast Food';
  if (d.includes('baby') || d.includes('infant') || d.includes('formula')) return 'Baby Foods';
  if (d.includes('bar') || d.includes('protein') || d.includes('supplement') || d.includes('nutrition') || d.includes('meal replacement')) return 'Supplements';
  if (d.includes('salad')) return 'Vegetables';
  return 'Other';
}

// ── Load & process ──
console.log('Loading Foundation Foods...');
const foundation = JSON.parse(readFileSync(join(DATA_DIR, 'foundation/FoodData_Central_foundation_food_json_2025-12-18.json'), 'utf-8'));
console.log(`  ${foundation.FoundationFoods.length} foods`);

console.log('Loading SR Legacy...');
const srLegacy = JSON.parse(readFileSync(join(DATA_DIR, 'sr_legacy/FoodData_Central_sr_legacy_food_json_2018-04.json'), 'utf-8'));
console.log(`  ${srLegacy.SRLegacyFoods.length} foods`);

console.log('Loading FNDDS...');
const fndds = JSON.parse(readFileSync(join(DATA_DIR, 'fndds/surveyDownload.json'), 'utf-8'));
console.log(`  ${fndds.SurveyFoods.length} foods`);

// Process Foundation Foods
const foods = new Map(); // key: lowercase name -> food object

for (const f of foundation.FoundationFoods) {
  const name = titleCase(f.description || '');
  if (!name || name.length < 3) continue;
  const nutrients = extractNutrients(f.foodNutrients);
  if (nutrients.calories === 0 && nutrients.protein === 0 && nutrients.carbs === 0) continue;
  const key = name.toLowerCase();
  if (foods.has(key)) continue;
  foods.set(key, {
    n: name,
    c: mapCategory(f.foodCategory?.description),
    s: bestServing(f.foodPortions),
    k: nutrients.calories,
    p: nutrients.protein,
    cb: nutrients.carbs,
    f: nutrients.fat,
    fb: nutrients.fiber,
    su: nutrients.sugar,
  });
}
console.log(`After Foundation: ${foods.size} unique foods`);

// Process SR Legacy
for (const f of srLegacy.SRLegacyFoods) {
  const name = titleCase(f.description || '');
  if (!name || name.length < 3) continue;
  const nutrients = extractNutrients(f.foodNutrients);
  if (nutrients.calories === 0 && nutrients.protein === 0 && nutrients.carbs === 0) continue;
  const key = name.toLowerCase();
  if (foods.has(key)) continue;
  foods.set(key, {
    n: name,
    c: mapCategory(f.foodCategory?.description),
    s: bestServing(f.foodPortions),
    k: nutrients.calories,
    p: nutrients.protein,
    cb: nutrients.carbs,
    f: nutrients.fat,
    fb: nutrients.fiber,
    su: nutrients.sugar,
  });
}
console.log(`After SR Legacy: ${foods.size} unique foods`);

// Process FNDDS (Survey Foods)
for (const f of fndds.SurveyFoods) {
  const name = titleCase(f.description || '');
  if (!name || name.length < 3) continue;
  const nutrients = extractNutrients(f.foodNutrients);
  if (nutrients.calories === 0 && nutrients.protein === 0 && nutrients.carbs === 0) continue;
  const key = name.toLowerCase();
  if (foods.has(key)) continue;
  foods.set(key, {
    n: name,
    c: mapWweiaCategory(f.wweiaFoodCategory),
    s: bestServing(f.foodPortions),
    k: nutrients.calories,
    p: nutrients.protein,
    cb: nutrients.carbs,
    f: nutrients.fat,
    fb: nutrients.fiber,
    su: nutrients.sugar,
  });
}
console.log(`After FNDDS: ${foods.size} unique foods`);

// Sort by category then name
const sorted = [...foods.values()].sort((a, b) => {
  const catCmp = a.c.localeCompare(b.c);
  return catCmp !== 0 ? catCmp : a.n.localeCompare(b.n);
});

// Get unique categories
const categories = [...new Set(sorted.map(f => f.c))].sort();
console.log(`\nCategories (${categories.length}):`, categories.join(', '));
console.log(`Total foods: ${sorted.length}`);

// Estimate output size
const jsonStr = JSON.stringify(sorted);
console.log(`JSON size: ${(jsonStr.length / 1024).toFixed(0)} KB`);

// Generate the ES module
let output = `// ── FoodData Central Database ──
// Generated from USDA FoodData Central public domain data:
//   - Foundation Foods (Dec 2025): ${foundation.FoundationFoods.length} foods
//   - SR Legacy (Apr 2018): ${srLegacy.SRLegacyFoods.length} foods
//   - FNDDS Survey Foods (Oct 2024): ${fndds.SurveyFoods.length} foods
// Total unique: ${sorted.length} foods
// All values per 100g unless serving size noted.
// Compact keys: n=name, c=category, s=serving, k=kcal, p=protein, cb=carbs, f=fat, fb=fiber, su=sugar

const _DB = ${JSON.stringify(sorted)};

// Expand compact format to full objects
export const FOOD_DB = _DB.map(f => ({
  name: f.n,
  category: f.c,
  serving: f.s,
  calories: f.k,
  protein: f.p,
  carbs: f.cb,
  fat: f.f,
  fiber: f.fb,
  sugar: f.su,
  color: f.k <= 100 ? 'green' : f.k <= 250 ? 'yellow' : 'red',
}));

export const FOOD_CATEGORIES = ${JSON.stringify(categories)};
`;

const outPath = join(__dirname, '..', 'src', 'foodData.js');
writeFileSync(outPath, output, 'utf-8');

const sizeKB = (Buffer.byteLength(output, 'utf-8') / 1024).toFixed(0);
console.log(`\nWrote ${outPath}`);
console.log(`File size: ${sizeKB} KB`);
