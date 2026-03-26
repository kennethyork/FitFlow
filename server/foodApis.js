// ── External Food API integrations (all fully free) ──

// Noom color classification based on calorie density (cal per gram)
function noomColor(calories, servingGrams) {
  if (!servingGrams || !calories) return 'green';
  const density = calories / servingGrams;
  if (density <= 1.0) return 'green';   // <1 cal/g → green (most fruits, vegs, soups)
  if (density <= 2.4) return 'yellow';  // 1-2.4 cal/g → yellow (grains, lean meats)
  return 'red';                         // >2.4 cal/g → red (oils, sweets, fried)
}

// ═══════════════════════════════════════════════════
// 1) USDA FoodData Central  (free, DEMO_KEY or your own)
//    https://fdc.nal.usda.gov/api-guide
// ═══════════════════════════════════════════════════
async function searchUSDA(query, limit = 15) {
  const apiKey = process.env.USDA_API_KEY || 'DEMO_KEY';
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        pageSize: limit,
        dataType: ['Survey (FNDDS)', 'Foundation', 'SR Legacy'],
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.foods) return [];

    return data.foods.map(f => {
      const nutrients = {};
      for (const n of (f.foodNutrients || [])) {
        const id = n.nutrientId || n.nutrientNumber;
        // Energy (kcal)
        if (id === 1008 || n.nutrientName === 'Energy') nutrients.calories = Math.round(n.value || 0);
        // Protein
        if (id === 1003 || n.nutrientName === 'Protein') nutrients.protein = Math.round(n.value || 0);
        // Carbs
        if (id === 1005 || (n.nutrientName && n.nutrientName.includes('Carbohydrate'))) nutrients.carbs = Math.round(n.value || 0);
        // Fat
        if (id === 1004 || (n.nutrientName && n.nutrientName.includes('Total lipid'))) nutrients.fat = Math.round(n.value || 0);
        // Fiber
        if (id === 1079 || (n.nutrientName && n.nutrientName.includes('Fiber'))) nutrients.fiber = Math.round(n.value || 0);
        // Sugar
        if (id === 2000 || (n.nutrientName && n.nutrientName.includes('Sugars, total'))) nutrients.sugar = Math.round(n.value || 0);
      }

      const cal = nutrients.calories || 0;
      return {
        name: titleCase(f.description || ''),
        category: f.foodCategory || 'USDA',
        serving: '100g',
        calories: cal,
        protein: nutrients.protein || 0,
        carbs: nutrients.carbs || 0,
        fat: nutrients.fat || 0,
        fiber: nutrients.fiber || 0,
        sugar: nutrients.sugar || 0,
        color: noomColor(cal, 100),
        source: 'usda',
      };
    });
  } catch (err) {
    console.error('USDA API error:', err.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════
// 2) Open Food Facts  (free, no key, 3M+ products)
//    https://wiki.openfoodfacts.org/API
// ═══════════════════════════════════════════════════
async function searchOpenFoodFacts(query, limit = 15) {
  const url = `https://world.openfoodfacts.net/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${limit}&fields=product_name,nutriments,serving_size,categories_tags,brands`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'FitFlow/1.0 (fitness-tracker-app)' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.products) return [];

    return data.products
      .filter(p => p.product_name && p.nutriments)
      .map(p => {
        const n = p.nutriments;
        const cal = Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0);
        const protein = Math.round(n.proteins_100g || n.proteins || 0);
        const carbs = Math.round(n.carbohydrates_100g || n.carbohydrates || 0);
        const fat = Math.round(n.fat_100g || n.fat || 0);
        const fiber = Math.round(n.fiber_100g || n.fiber || 0);
        const sugar = Math.round(n.sugars_100g || n.sugars || 0);

        const brand = p.brands ? ` (${p.brands.split(',')[0].trim()})` : '';
        const name = titleCase(p.product_name) + brand;

        return {
          name,
          category: categorizeOFF(p.categories_tags),
          serving: p.serving_size || '100g',
          calories: cal,
          protein,
          carbs,
          fat,
          fiber,
          sugar,
          color: noomColor(cal, 100),
          source: 'openfoodfacts',
        };
      })
      .filter(f => f.calories > 0);
  } catch (err) {
    console.error('Open Food Facts API error:', err.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════
function titleCase(str) {
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-/])\w/g, c => c.toUpperCase())
    .replace(/,\s*$/, '')
    .trim();
}

function categorizeOFF(tags) {
  if (!tags || !tags.length) return 'Packaged Food';
  const t = tags.join(' ').toLowerCase();
  if (t.includes('beverage') || t.includes('drink') || t.includes('juice') || t.includes('water') || t.includes('coffee') || t.includes('tea')) return 'Beverages';
  if (t.includes('dairy') || t.includes('milk') || t.includes('cheese') || t.includes('yogurt')) return 'Dairy & Eggs';
  if (t.includes('meat') || t.includes('chicken') || t.includes('beef') || t.includes('pork') || t.includes('turkey')) return 'Protein';
  if (t.includes('fish') || t.includes('seafood') || t.includes('salmon') || t.includes('tuna') || t.includes('shrimp')) return 'Seafood';
  if (t.includes('snack') || t.includes('chip') || t.includes('cracker')) return 'Snacks';
  if (t.includes('cereal') || t.includes('bread') || t.includes('pasta') || t.includes('grain') || t.includes('rice')) return 'Grains';
  if (t.includes('fruit') || t.includes('apple') || t.includes('berry')) return 'Fruits';
  if (t.includes('vegetable') || t.includes('salad') || t.includes('legume')) return 'Vegetables';
  if (t.includes('sweet') || t.includes('chocolate') || t.includes('cookie') || t.includes('candy') || t.includes('dessert') || t.includes('ice-cream')) return 'Desserts';
  if (t.includes('sauce') || t.includes('condiment') || t.includes('oil') || t.includes('dressing')) return 'Oils & Sauces';
  if (t.includes('nut') || t.includes('seed')) return 'Nuts & Seeds';
  if (t.includes('meal') || t.includes('pizza') || t.includes('soup') || t.includes('sandwich')) return 'Prepared Meals';
  return 'Packaged Food';
}

module.exports = { searchUSDA, searchOpenFoodFacts, noomColor };
