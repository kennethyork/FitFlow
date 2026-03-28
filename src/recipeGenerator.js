// ── Local Recipe Generator ──
// Generates simple recipes based on food name keywords.
// No API calls — fully offline, instant results.

const PROTEINS = ['chicken breast', 'salmon fillet', 'ground turkey', 'tofu', 'shrimp', 'lean beef', 'eggs', 'tuna', 'pork tenderloin', 'cod fillet', 'tempeh', 'greek yogurt'];
const VEGGIES = ['broccoli', 'spinach', 'bell peppers', 'zucchini', 'asparagus', 'green beans', 'kale', 'sweet potato', 'carrots', 'mushrooms', 'cauliflower', 'tomatoes'];
const GRAINS = ['brown rice', 'quinoa', 'whole wheat pasta', 'oats', 'farro', 'couscous', 'sweet potato', 'whole grain bread'];
const FATS = ['olive oil', 'avocado', 'almonds', 'peanut butter', 'coconut oil', 'walnuts', 'tahini', 'chia seeds'];
const SEASONINGS = ['garlic, salt & pepper', 'cumin, paprika & chili flakes', 'Italian seasoning & garlic', 'soy sauce, ginger & sesame oil', 'lemon juice, dill & garlic', 'oregano, basil & red pepper', 'turmeric, cumin & coriander', 'rosemary, thyme & black pepper'];
const METHODS = ['Bake at 400°F for 20-25 min', 'Pan-sear on medium-high 4-5 min per side', 'Grill on medium heat 5-6 min per side', 'Stir-fry on high heat for 6-8 min', 'Simmer on low for 15-20 min', 'Air fry at 390°F for 12-15 min', 'Roast at 425°F for 20-25 min'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pick2(arr) {
  const a = pick(arr);
  let b = pick(arr);
  while (b === a && arr.length > 1) b = pick(arr);
  return [a, b];
}

const RECIPES = {
  chicken: {
    ingredients: (name) => {
      const [v1, v2] = pick2(VEGGIES);
      return [`2 ${name.includes('thigh') ? 'chicken thighs' : 'chicken breasts'} (6 oz each)`, `1 cup ${v1}`, `1 cup ${v2}`, `1 tbsp ${pick(FATS)}`, `Season with ${pick(SEASONINGS)}`];
    },
    steps: () => [`Season chicken and let rest 5 min.`, `Heat oil in a skillet over medium-high heat.`, `Cook chicken 5-6 min per side until golden and cooked through (165°F).`, `Sauté veggies in the same pan 3-4 min.`, `Plate together and serve.`],
  },
  turkey: {
    ingredients: () => {
      const v = pick(VEGGIES);
      const g = pick(GRAINS);
      return [`1 lb ground turkey`, `1 cup ${g}`, `1 cup ${v}, diced`, `1 tbsp ${pick(FATS)}`, `Season with ${pick(SEASONINGS)}`];
    },
    steps: () => [`Cook ${pick(GRAINS)} according to package directions.`, `Brown turkey in a large skillet, breaking into pieces, 6-8 min.`, `Add diced veggies and cook 3-4 min.`, `Season and stir to combine.`, `Serve over grain.`],
  },
  salmon: {
    ingredients: () => {
      const [v1, v2] = pick2(VEGGIES);
      return [`2 salmon fillets (5 oz each)`, `1 cup ${v1}`, `1 cup ${v2}`, `1 tbsp ${pick(FATS)}`, `Season with ${pick(SEASONINGS)}`];
    },
    steps: () => [`Preheat oven to 400°F.`, `Season salmon and place on a lined baking sheet.`, `Toss veggies with oil and spread around salmon.`, `Bake 12-15 min until salmon flakes easily.`, `Squeeze lemon on top and serve.`],
  },
  fish: {
    ingredients: (name) => {
      const v = pick(VEGGIES);
      return [`2 ${name || 'white fish'} fillets`, `1 cup ${v}`, `1 tbsp ${pick(FATS)}`, `1 lemon, sliced`, `Season with ${pick(SEASONINGS)}`];
    },
    steps: () => [`Pat fish dry and season generously.`, `Heat oil in a non-stick skillet over medium-high.`, `Cook fish 3-4 min per side until flaky.`, `Steam or sauté veggies on the side.`, `Serve with lemon wedges.`],
  },
  salad: {
    ingredients: (name) => {
      const p = pick(PROTEINS);
      return [`4 cups mixed greens or ${name.includes('spinach') ? 'baby spinach' : 'romaine'}`, `4 oz ${p}, sliced`, `½ cup cherry tomatoes`, `¼ cup ${pick(['feta cheese', 'goat cheese', 'parmesan shavings', 'sliced almonds'])}`, `2 tbsp ${pick(['balsamic vinaigrette', 'olive oil & lemon', 'ranch dressing', 'greek dressing'])}`];
    },
    steps: () => [`Wash and dry greens, place in a large bowl.`, `Cook or prep protein of choice.`, `Add tomatoes and toppings.`, `Drizzle with dressing and toss gently.`, `Serve immediately.`],
  },
  egg: {
    ingredients: () => {
      const v = pick(VEGGIES);
      return [`3 large eggs`, `1 cup ${v}, diced`, `¼ cup ${pick(['shredded cheese', 'feta', 'goat cheese'])}`, `1 tsp ${pick(FATS)}`, `Season with salt, pepper & ${pick(['paprika', 'chives', 'hot sauce', 'herbs'])}`];
    },
    steps: () => [`Whisk eggs with a pinch of salt.`, `Heat oil in a non-stick pan over medium heat.`, `Sauté veggies 2-3 min until tender.`, `Pour eggs over veggies, cook 2 min, then fold or scramble.`, `Top with cheese and serve.`],
  },
  pasta: {
    ingredients: () => {
      const p = pick(['chicken breast', 'shrimp', 'ground turkey', 'Italian sausage']);
      const v = pick(VEGGIES);
      return [`8 oz whole wheat pasta`, `6 oz ${p}`, `1 cup ${v}`, `½ cup marinara or pesto sauce`, `Season with ${pick(SEASONINGS)}`];
    },
    steps: () => [`Cook pasta al dente, reserve ½ cup pasta water.`, `Cook protein in a skillet until done, set aside.`, `Sauté veggies in same pan 3-4 min.`, `Toss pasta, protein, veggies & sauce together. Add pasta water to loosen.`, `Serve with parmesan if desired.`],
  },
  rice: {
    ingredients: () => {
      const p = pick(PROTEINS);
      const [v1, v2] = pick2(VEGGIES);
      return [`1 cup brown rice or quinoa`, `6 oz ${p}`, `1 cup ${v1}`, `½ cup ${v2}`, `Season with ${pick(SEASONINGS)}`];
    },
    steps: () => [`Cook rice according to package directions.`, `Season and cook protein in a skillet 5-7 min.`, `Sauté veggies until tender-crisp, 3-4 min.`, `Build bowls: rice on bottom, protein & veggies on top.`, `Drizzle with sauce of choice and serve.`],
  },
  soup: {
    ingredients: () => {
      const p = pick(['chicken breast', 'white beans', 'lentils', 'ground turkey']);
      const [v1, v2] = pick2(VEGGIES);
      return [`6 oz ${p}`, `1 cup ${v1}, chopped`, `1 cup ${v2}, chopped`, `4 cups low-sodium broth`, `Season with ${pick(SEASONINGS)}`];
    },
    steps: () => [`Dice all veggies. If using meat, cut into bite-size pieces.`, `Heat oil in a pot and sauté veggies 4-5 min.`, `Add protein and cook 3-4 min.`, `Pour in broth, bring to a boil, then simmer 15-20 min.`, `Season to taste and serve hot.`],
  },
  smoothie: {
    ingredients: () => {
      const fruit = pick(['banana', 'mixed berries', 'mango', 'strawberries']);
      return [`1 cup ${fruit}`, `1 scoop protein powder`, `1 cup ${pick(['almond milk', 'oat milk', 'greek yogurt', 'coconut water'])}`, `1 tbsp ${pick(['peanut butter', 'chia seeds', 'honey', 'flaxseed'])}`, `Handful of ice`];
    },
    steps: () => [`Add all ingredients to a blender.`, `Blend on high for 30-60 seconds until smooth.`, `Pour into a glass and enjoy immediately.`],
  },
  steak: {
    ingredients: () => {
      const [v1, v2] = pick2(VEGGIES);
      return [`8 oz ${pick(['sirloin', 'ribeye', 'NY strip', 'flank steak'])}`, `1 cup ${v1}`, `1 cup ${v2}`, `1 tbsp ${pick(FATS)}`, `Season with salt, pepper & garlic powder`];
    },
    steps: () => [`Let steak come to room temperature 20 min before cooking.`, `Season generously on both sides.`, `Heat a cast iron skillet over high heat until smoking.`, `Sear steak 3-4 min per side for medium-rare. Rest 5 min.`, `Roast or sauté veggies as a side. Slice and serve.`],
  },
  sandwich: {
    ingredients: () => {
      const p = pick(['turkey slices', 'grilled chicken', 'tuna salad', 'roast beef']);
      return [`2 slices whole grain bread`, `4 oz ${p}`, `Lettuce, tomato & onion`, `1 tbsp ${pick(['mustard', 'hummus', 'avocado spread', 'light mayo'])}`, `Season with salt & pepper`];
    },
    steps: () => [`Toast bread if desired.`, `Layer protein, veggies, and spread on bread.`, `Season, close sandwich, and slice in half.`, `Serve with a side salad or fruit.`],
  },
  bowl: {
    ingredients: () => {
      const p = pick(PROTEINS);
      const g = pick(GRAINS);
      const [v1, v2] = pick2(VEGGIES);
      return [`1 cup ${g}`, `5 oz ${p}`, `1 cup ${v1}`, `½ cup ${v2}`, `Drizzle with ${pick(['tahini', 'soy-ginger sauce', 'sriracha mayo', 'chimichurri'])}`];
    },
    steps: () => [`Cook grain and protein separately.`, `Roast or sauté veggies with a little oil, 5-7 min.`, `Assemble bowl: grain base, protein, and veggies on top.`, `Add sauce and any extra toppings (seeds, avocado, pickled onion).`, `Enjoy!`],
  },
};

// Keywords → recipe type mapping
const KEYWORD_MAP = [
  [/chicken|poultry/i, 'chicken'],
  [/turkey/i, 'turkey'],
  [/salmon/i, 'salmon'],
  [/fish|cod|tilapia|tuna|seafood|shrimp|halibut/i, 'fish'],
  [/salad|greens|slaw|dressing/i, 'salad'],
  [/egg|omelet|frittata/i, 'egg'],
  [/pasta|noodle|spaghetti|penne|mac/i, 'pasta'],
  [/rice|quinoa|grain|farro/i, 'rice'],
  [/soup|stew|chili|chowder|broth/i, 'soup'],
  [/smoothie|shake|juice|blend/i, 'smoothie'],
  [/steak|beef|sirloin|ribeye|burger/i, 'steak'],
  [/sandwich|wrap|sub|panini|toast/i, 'sandwich'],
  [/bowl|burrito|taco/i, 'bowl'],
];

/**
 * Generate a recipe for a given meal name.
 * @param {string} name - The food/meal name
 * @returns {{ ingredients: string[], steps: string[] }}
 */
export function generateRecipe(name) {
  const lower = name.toLowerCase();
  for (const [regex, type] of KEYWORD_MAP) {
    if (regex.test(lower)) {
      const r = RECIPES[type];
      return {
        ingredients: r.ingredients(name),
        steps: r.steps(),
      };
    }
  }
  // Generic fallback
  const p = pick(PROTEINS);
  const [v1, v2] = pick2(VEGGIES);
  const g = pick(GRAINS);
  return {
    ingredients: [
      `6 oz ${p}`,
      `1 cup ${v1}`,
      `½ cup ${v2}`,
      `1 cup ${g}`,
      `1 tbsp ${pick(FATS)}`,
      `Season with ${pick(SEASONINGS)}`,
    ],
    steps: [
      `Prep all ingredients — wash, chop, and measure.`,
      `Cook ${g} according to package directions.`,
      `Season and cook ${p}: ${pick(METHODS)}.`,
      `Sauté ${v1} and ${v2} in a little oil for 3-5 min.`,
      `Plate everything together and serve.`,
    ],
  };
}
