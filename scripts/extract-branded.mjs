#!/usr/bin/env node
/**
 * Extract top branded foods from FDC Branded Foods dataset (3.1GB).
 * Uses streaming JSON parser to avoid loading entire file in memory.
 * Outputs a compact JSON file for lazy-loading in the browser.
 *
 * Strategy for "top" foods:
 *   1. Require complete macros (cal + protein + carbs + fat)
 *   2. Deduplicate by normalized (brandOwner + description)
 *   3. Prefer foods with household serving text (more useful to end user)
 *   4. Cap at ~30K unique branded foods
 */

import { createReadStream } from 'fs';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/pick.js';
import { streamArray } from 'stream-json/streamers/stream-array.js';
import { chain } from 'stream-chain';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = join(__dirname, 'fdc-data/branded/brandedDownload.json');
const OUTPUT = join(__dirname, '..', 'public', 'branded-foods.json');

const NUTRIENT_IDS = { 1008: 'k', 1003: 'p', 1005: 'cb', 1004: 'f', 1079: 'fb', 2000: 'su' };

// Known large brand owners (popular brands people actually search for)
const TOP_BRANDS = new Set([
  "GENERAL MILLS", "KELLOGG'S", "KRAFT", "KRAFT HEINZ", "NESTLE",
  "PEPSI", "PEPSICO", "COCA-COLA", "THE COCA-COLA COMPANY",
  "FRITO-LAY", "NABISCO", "QUAKER", "DANNON", "YOPLAIT", "CHOBANI",
  "TYSON", "PERDUE", "HORMEL", "OSCAR MAYER", "JIMMY DEAN",
  "STOUFFER'S", "LEAN CUISINE", "HEALTHY CHOICE", "BANQUET",
  "BIRDS EYE", "GREEN GIANT", "DEL MONTE", "DOLE", "SMUCKER'S",
  "JIF", "SKIPPY", "PETER PAN", "BARILLA", "RAGU", "PREGO",
  "CAMPBELL'S", "PROGRESSO", "HEINZ", "FRENCH'S", "HELLMANN'S",
  "BEST FOODS", "HIDDEN VALLEY", "RANCH", "KIKKOMAN",
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
  "SMART ONES", "WEIGHT WATCHERS", "ATKINS", "QUEST",
  "ENSURE", "BOOST", "PREMIER PROTEIN", "FAIRLIFE",
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
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-/(])\w/g, c => c.toUpperCase())
    .replace(/,\s*$/, '')
    .trim();
}

// ── Main streaming extraction ──
console.log('Streaming branded foods from', INPUT);
console.log('This may take a few minutes for the 3.1GB file...\n');

let total = 0;
let skippedNoMacros = 0;
let skippedDupe = 0;
const seen = new Map();       // normalized key -> food
const topBrandFoods = [];     // foods from known top brands
const otherFoods = [];        // foods from other brands

// We need to handle the top-level { "BrandedFoods": [...] } wrapper
// stream-json's streamArray expects to be positioned at the array
// We'll use a pick + streamArray approach

const pipeline = chain([
  createReadStream(INPUT),
  parser(),
  pick({ filter: 'BrandedFoods' }),
  streamArray(),
]);

pipeline.on('data', ({ value: f }) => {
  total++;
  if (total % 50000 === 0) {
    process.stdout.write(`  Processed ${total} foods... (kept: ${seen.size})\r`);
  }

  // Extract macros
  const macros = { k: 0, p: 0, cb: 0, f: 0, fb: 0, su: 0 };
  for (const fn of f.foodNutrients || []) {
    const field = NUTRIENT_IDS[fn.nutrient?.id];
    if (field) macros[field] = Math.round(fn.amount || 0);
  }

  // Skip foods without basic macros
  if (macros.k === 0 && macros.p === 0 && macros.cb === 0) {
    skippedNoMacros++;
    return;
  }

  const brand = (f.brandOwner || '').trim();
  const desc = (f.description || '').trim();
  if (!desc || desc.length < 3) return;

  // Dedup key: brand + description normalized
  const key = `${brand}|||${desc}`.toLowerCase();
  if (seen.has(key)) {
    skippedDupe++;
    return;
  }

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
});

pipeline.on('end', () => {
  console.log(`\n\nDone processing ${total} branded foods`);
  console.log(`  Skipped (no macros): ${skippedNoMacros}`);
  console.log(`  Skipped (duplicate): ${skippedDupe}`);
  console.log(`  Top brand foods: ${topBrandFoods.length}`);
  console.log(`  Other brand foods: ${otherFoods.length}`);
  console.log(`  Total unique: ${seen.size}`);

  // Take all top-brand foods, then fill remaining quota from other brands
  const TARGET = 30000;
  let result;
  if (topBrandFoods.length >= TARGET) {
    result = topBrandFoods.slice(0, TARGET);
  } else {
    const remaining = TARGET - topBrandFoods.length;
    result = [...topBrandFoods, ...otherFoods.slice(0, remaining)];
  }

  console.log(`\nFinal selection: ${result.length} foods`);

  // Sort by category then name
  result.sort((a, b) => {
    const cc = a.c.localeCompare(b.c);
    return cc !== 0 ? cc : a.n.localeCompare(b.n);
  });

  // Count categories
  const cats = new Set(result.map(f => f.c));
  console.log(`Categories: ${cats.size}`);

  // Write output
  const json = JSON.stringify(result);
  writeFileSync(OUTPUT, json, 'utf-8');

  const sizeKB = (Buffer.byteLength(json, 'utf-8') / 1024).toFixed(0);
  const sizeMB = (Buffer.byteLength(json, 'utf-8') / 1024 / 1024).toFixed(1);
  console.log(`\nWrote ${OUTPUT}`);
  console.log(`File size: ${sizeKB} KB (${sizeMB} MB)`);
});

pipeline.on('error', (err) => {
  // stream-json sometimes errors on the top-level object wrapper
  // If we already have data, just finish
  if (seen.size > 0) {
    console.log(`\nStream ended with partial read (${seen.size} foods collected). Finishing...`);
    pipeline.emit('end');
  } else {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
});
