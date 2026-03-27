#!/usr/bin/env node
/**
 * Extract top ~30K branded foods from FDC Branded Foods dataset.
 * Uses increased heap to load the 3.1GB JSON directly (faster than streaming).
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, 'fdc-data/branded/brandedDownload.json');
const OUTPUT = path.join(__dirname, '..', 'public', 'branded-foods.json');

const NUTRIENT_IDS = { 1008: 'k', 1003: 'p', 1005: 'cb', 1004: 'f', 1079: 'fb', 2000: 'su' };

const TOP_BRANDS = new Set([
  "GENERAL MILLS", "KELLOGG'S", "KELLOGG", "KRAFT", "KRAFT HEINZ", "NESTLE",
  "PEPSI", "PEPSICO", "COCA-COLA", "THE COCA-COLA COMPANY",
  "FRITO-LAY", "NABISCO", "QUAKER", "DANNON", "YOPLAIT", "CHOBANI",
  "TYSON", "PERDUE", "HORMEL", "OSCAR MAYER", "JIMMY DEAN",
  "STOUFFER'S", "LEAN CUISINE", "HEALTHY CHOICE", "BANQUET",
  "BIRDS EYE", "GREEN GIANT", "DEL MONTE", "DOLE", "SMUCKER'S",
  "JIF", "SKIPPY", "PETER PAN", "BARILLA", "RAGU", "PREGO",
  "CAMPBELL'S", "PROGRESSO", "HEINZ", "FRENCH'S", "HELLMANN'S",
  "BEST FOODS", "HIDDEN VALLEY", "KIKKOMAN",
  "STARBUCKS", "DUNKIN'", "MCDONALD'S", "SUBWAY", "CHICK-FIL-A",
  "TRADER JOE'S", "TRADER JOE", "WHOLE FOODS", "365",
  "GREAT VALUE", "KIRKLAND", "MARKET PANTRY", "GOOD & GATHER",
  "SIMPLY", "MINUTE MAID", "TROPICANA", "OCEAN SPRAY",
  "NATURE VALLEY", "KIND", "CLIF", "RXBAR", "LARABAR",
  "CHEERIOS", "FROSTED FLAKES", "RAISIN BRAN", "SPECIAL K",
  "OREO", "RITZ", "GOLDFISH", "CHEEZ-IT",
  "DORITOS", "LAYS", "LAY'S", "CHEETOS", "TOSTITOS", "PRINGLES",
  "MISSION", "OLD EL PASO", "TACO BELL",
  "PILLSBURY", "BETTY CROCKER", "DUNCAN HINES",
  "SARA LEE", "THOMAS'", "DAVE'S KILLER BREAD", "ARNOLD",
  "PHILADELPHIA", "SARGENTO", "TILLAMOOK", "CABOT",
  "BLUE DIAMOND", "PLANTERS", "WONDERFUL",
  "GATORADE", "POWERADE", "BODY ARMOR",
  "HERSHEY'S", "MARS", "M&M'S", "SNICKERS", "REESE'S",
  "BEN & JERRY'S", "HAAGEN-DAZS", "BREYERS", "TALENTI",
  "OATLY", "SILK", "ALMOND BREEZE", "SO DELICIOUS",
  "BEYOND MEAT", "IMPOSSIBLE", "MORNINGSTAR",
  "ANNIE'S", "AMY'S", "EARTH'S BEST", "ORGANIC VALLEY",
  "FAIRLIFE", "LACTAID", "HORIZON",
  "DIGIORNO", "TOTINO'S", "RED BARON", "TOMBSTONE",
  "HOT POCKETS", "BAGEL BITES", "EGGO",
  "SMART ONES", "ATKINS", "QUEST",
  "ENSURE", "BOOST", "PREMIER PROTEIN",
]);

function isTopBrand(brandOwner) {
  if (!brandOwner) return false;
  const upper = brandOwner.toUpperCase();
  for (const b of TOP_BRANDS) {
    if (upper.includes(b)) return true;
  }
  return false;
}

function titleCase(str) {
  return str.toLowerCase()
    .replace(/(?:^|\s|[-/(])\w/g, c => c.toUpperCase())
    .replace(/,\s*$/, '').trim();
}

console.log('Loading branded foods JSON (3.1GB, this takes ~30s)...');
const t0 = Date.now();
const raw = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
const foods = raw.BrandedFoods;
console.log(`Loaded ${foods.length} branded foods in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const seen = new Map();
const topBrandFoods = [];
const otherFoods = [];
let skippedNoMacros = 0;
let skippedDupe = 0;

for (const f of foods) {
  const macros = { k: 0, p: 0, cb: 0, f: 0, fb: 0, su: 0 };
  for (const fn of f.foodNutrients || []) {
    const field = NUTRIENT_IDS[fn.nutrient?.id];
    if (field) macros[field] = Math.round(fn.amount || 0);
  }

  if (macros.k === 0 && macros.p === 0 && macros.cb === 0) { skippedNoMacros++; continue; }

  const brand = (f.brandOwner || '').trim();
  const desc = (f.description || '').trim();
  if (!desc || desc.length < 3) continue;

  const key = `${brand}|||${desc}`.toLowerCase();
  if (seen.has(key)) { skippedDupe++; continue; }

  const food = {
    n: titleCase(desc),
    b: titleCase(brand),
    c: f.brandedFoodCategory || 'Other',
    s: f.householdServingFullText
      ? `${f.householdServingFullText} (${f.servingSize || 100}${f.servingSizeUnit || 'g'})`
      : `${f.servingSize || 100}${f.servingSizeUnit || 'g'}`,
    ...macros,
  };
  if (f.gtinUpc) food.u = f.gtinUpc;

  seen.set(key, food);
  if (isTopBrand(brand)) {
    topBrandFoods.push(food);
  } else {
    otherFoods.push(food);
  }
}

console.log(`Skipped (no macros): ${skippedNoMacros}`);
console.log(`Skipped (duplicate): ${skippedDupe}`);
console.log(`Top brand foods: ${topBrandFoods.length}`);
console.log(`Other brand foods: ${otherFoods.length}`);
console.log(`Total unique: ${seen.size}`);

const TARGET = 30000;
let result;
if (topBrandFoods.length >= TARGET) {
  result = topBrandFoods.slice(0, TARGET);
} else {
  const remaining = TARGET - topBrandFoods.length;
  result = [...topBrandFoods, ...otherFoods.slice(0, remaining)];
}

result.sort((a, b) => {
  const cc = a.c.localeCompare(b.c);
  return cc !== 0 ? cc : a.n.localeCompare(b.n);
});

console.log(`\nFinal selection: ${result.length} foods`);
console.log(`Categories: ${new Set(result.map(f => f.c)).size}`);

const json = JSON.stringify(result);
fs.writeFileSync(OUTPUT, json, 'utf-8');

const sizeMB = (Buffer.byteLength(json, 'utf-8') / 1024 / 1024).toFixed(1);
console.log(`Wrote ${OUTPUT} (${sizeMB} MB)`);
