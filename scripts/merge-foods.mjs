#!/usr/bin/env node
// Merges all per-category food JSON files (listed in manifest.json) into a
// single public/data/foods/foods.json flat array.
//
// Usage:
//   node scripts/merge-foods.mjs
//
// The output file is intentionally git-ignored (~92 MB).  Serve it alongside
// the existing category files — the app will prefer foods.json when present
// and fall back to the per-category manifest otherwise.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../public/data/foods');
const manifestPath = path.join(dataDir, 'manifest.json');
const outPath = path.join(dataDir, 'foods.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const allFoods = [];

console.log('Merging food categories...');
for (const [category, info] of Object.entries(manifest)) {
  const filePath = path.join(dataDir, info.file);
  const foods = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  allFoods.push(...foods);
  console.log(`  ${category}: ${foods.length.toLocaleString()} foods`);
}

fs.writeFileSync(outPath, JSON.stringify(allFoods) + '\n');
console.log(`\n✅ Wrote ${allFoods.length.toLocaleString()} foods → ${outPath}`);
