#!/usr/bin/env python3
"""
Extract ALL foods from all 4 FDC datasets and split into per-category JSON files.
Output goes to public/data/foods/ as static JSON files for lazy loading into RxDB.

Datasets:
  - Foundation Foods (Dec 2025): ~365 foods
  - SR Legacy (Apr 2018): ~7,793 foods
  - FNDDS Survey Foods (Oct 2024): ~5,432 foods
  - Branded Foods (Oct 2024): ~440,000 foods
"""

import json, os, time, re, sys
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, 'fdc-data')
OUT_DIR = os.path.join(SCRIPT_DIR, '..', 'public', 'data', 'foods')

NUTRIENT_MAP = {1008: 'calories', 1003: 'protein', 1005: 'carbs', 1004: 'fat', 1079: 'fiber', 2000: 'sugar'}

# ── Category normalization ──

SR_CATEGORY_MAP = {
    'Baked Products': 'Grains & Bakery',
    'Beef Products': 'Meat',
    'Beverages': 'Beverages',
    'Breakfast Cereals': 'Grains & Bakery',
    'Cereal Grains and Pasta': 'Grains & Bakery',
    'Dairy and Egg Products': 'Dairy & Eggs',
    'Fats and Oils': 'Oils & Fats',
    'Finfish and Shellfish Products': 'Seafood',
    'Fruits and Fruit Juices': 'Fruits',
    'Lamb, Veal, and Game Products': 'Meat',
    'Legumes and Legume Products': 'Legumes',
    'Meals, Entrees, and Side Dishes': 'Prepared Meals',
    'Nut and Seed Products': 'Nuts & Seeds',
    'Pork Products': 'Meat',
    'Poultry Products': 'Meat',
    'Restaurant Foods': 'Restaurant',
    'Sausages and Luncheon Meats': 'Meat',
    'Snacks': 'Snacks',
    'Soups, Sauces, and Gravies': 'Soups & Sauces',
    'Spices and Herbs': 'Spices & Herbs',
    'Sweets': 'Sweets & Desserts',
    'Vegetables and Vegetable Products': 'Vegetables',
    'Baby Foods': 'Baby Foods',
    'Fast Foods': 'Fast Food',
    'American Indian/Alaska Native Foods': 'Prepared Meals',
    'Alcoholic Beverages': 'Beverages',
}

def map_sr_category(cat):
    if not cat:
        return 'Other'
    return SR_CATEGORY_MAP.get(cat, cat)

def map_wweia_category(wweia):
    if not wweia:
        return 'Other'
    desc = (wweia.get('wweiaFoodCategoryDescription') or '').lower()
    if not desc:
        return 'Other'
    if any(w in desc for w in ['milk', 'cheese', 'yogurt', 'dairy', 'cream']):
        return 'Dairy & Eggs'
    if 'egg' in desc:
        return 'Dairy & Eggs'
    if any(w in desc for w in ['beef', 'pork', 'lamb', 'chicken', 'turkey', 'poultry', 'meat', 'sausage', 'frank', 'bacon']):
        return 'Meat'
    if any(w in desc for w in ['fish', 'seafood', 'shellfish', 'shrimp', 'crab']):
        return 'Seafood'
    if any(w in desc for w in ['bean', 'legume', 'lentil', 'tofu', 'soy']):
        return 'Legumes'
    if any(w in desc for w in ['nut', 'seed']):
        return 'Nuts & Seeds'
    if any(w in desc for w in ['fruit', 'apple', 'banana', 'berry', 'citrus', 'melon']):
        return 'Fruits'
    if any(w in desc for w in ['vegetable', 'potato', 'tomato', 'lettuce', 'carrot', 'broccoli', 'corn', 'green', 'onion', 'pepper', 'squash']):
        return 'Vegetables'
    if any(w in desc for w in ['bread', 'cereal', 'rice', 'pasta', 'grain', 'oat', 'pancake', 'waffle', 'tortilla', 'biscuit', 'roll', 'cracker', 'muffin', 'bagel']):
        return 'Grains & Bakery'
    if any(w in desc for w in ['candy', 'cake', 'cookie', 'pie', 'donut', 'pastry', 'sweet', 'ice cream', 'frozen dairy', 'sugar', 'chocolate', 'dessert']):
        return 'Sweets & Desserts'
    if any(w in desc for w in ['chip', 'snack', 'pretzel', 'popcorn']):
        return 'Snacks'
    if any(w in desc for w in ['beverage', 'coffee', 'tea', 'juice', 'water', 'soda', 'drink', 'beer', 'wine', 'alcohol', 'liquor', 'smoothie']):
        return 'Beverages'
    if any(w in desc for w in ['soup', 'stew']):
        return 'Soups & Sauces'
    if any(w in desc for w in ['sauce', 'dip', 'condiment', 'dressing', 'gravy', 'salsa', 'mayonnaise', 'mustard', 'ketchup']):
        return 'Condiments'
    if any(w in desc for w in ['oil', 'butter', 'margarine', 'fat', 'shortening']):
        return 'Oils & Fats'
    if any(w in desc for w in ['pizza', 'burger', 'sandwich', 'taco', 'burrito', 'wrap', 'hot dog']):
        return 'Fast Food'
    if any(w in desc for w in ['baby', 'infant', 'formula']):
        return 'Baby Foods'
    if any(w in desc for w in ['bar', 'protein', 'supplement', 'meal replacement']):
        return 'Supplements'
    if 'salad' in desc:
        return 'Vegetables'
    return 'Other'

def map_branded_category(cat):
    if not cat:
        return 'Other'
    c = cat.lower()
    if any(w in c for w in ['cheese', 'milk', 'yogurt', 'dairy', 'cream', 'butter', 'egg']):
        return 'Dairy & Eggs'
    if any(w in c for w in ['meat', 'beef', 'pork', 'chicken', 'turkey', 'sausage', 'hot dog', 'bacon', 'deli']):
        return 'Meat'
    if any(w in c for w in ['fish', 'seafood', 'shrimp', 'tuna', 'salmon']):
        return 'Seafood'
    if any(w in c for w in ['bread', 'cereal', 'rice', 'pasta', 'grain', 'oat', 'tortilla', 'cracker', 'biscuit', 'muffin', 'bagel', 'flour']):
        return 'Grains & Bakery'
    if any(w in c for w in ['fruit', 'apple', 'berry', 'banana', 'citrus', 'juice']):
        return 'Fruits'
    if any(w in c for w in ['vegetable', 'potato', 'tomato', 'corn', 'bean', 'pea', 'carrot', 'salad', 'pickle']):
        return 'Vegetables'
    if any(w in c for w in ['candy', 'chocolate', 'cookie', 'cake', 'pie', 'ice cream', 'dessert', 'sweet', 'sugar', 'pastry', 'donut', 'brownie']):
        return 'Sweets & Desserts'
    if any(w in c for w in ['snack', 'chip', 'pretzel', 'popcorn', 'nut', 'seed', 'trail mix']):
        return 'Snacks'
    if any(w in c for w in ['beverage', 'drink', 'coffee', 'tea', 'soda', 'water', 'beer', 'wine', 'alcohol', 'energy drink']):
        return 'Beverages'
    if any(w in c for w in ['sauce', 'condiment', 'dressing', 'salsa', 'mustard', 'ketchup', 'mayonnaise', 'vinegar', 'marinade', 'syrup', 'honey', 'jam', 'jelly']):
        return 'Condiments'
    if any(w in c for w in ['soup', 'broth', 'stew', 'chili']):
        return 'Soups & Sauces'
    if any(w in c for w in ['oil', 'fat', 'shortening', 'cooking spray']):
        return 'Oils & Fats'
    if any(w in c for w in ['spice', 'herb', 'seasoning', 'salt', 'pepper']):
        return 'Spices & Herbs'
    if any(w in c for w in ['baby', 'infant', 'formula', 'toddler']):
        return 'Baby Foods'
    if any(w in c for w in ['pizza', 'frozen meal', 'dinner', 'entree', 'burrito', 'sandwich']):
        return 'Prepared Meals'
    if any(w in c for w in ['protein', 'supplement', 'bar', 'shake', 'powder', 'vitamin']):
        return 'Supplements'
    if any(w in c for w in ['restaurant', 'fast food']):
        return 'Restaurant'
    if any(w in c for w in ['legume', 'lentil', 'tofu', 'soy', 'hummus']):
        return 'Legumes'
    if any(w in c for w in ['pet', 'dog', 'cat']):
        return None  # Skip pet foods
    return 'Other'

# ── Helpers ──

def title_case(s):
    return s.strip().title().rstrip(',').strip()

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def extract_nutrients(food_nutrients):
    out = {v: 0 for v in NUTRIENT_MAP.values()}
    for fn in (food_nutrients or []):
        nid = (fn.get('nutrient') or {}).get('id')
        field = NUTRIENT_MAP.get(nid)
        if field:
            out[field] = round(fn.get('amount', 0) or 0)
    return out

def best_serving(portions):
    if not portions:
        return '100g'
    good = [p for p in portions if (p.get('gramWeight') or 0) > 0]
    if not good:
        return '100g'
    for p in good:
        desc = p.get('portionDescription') or p.get('modifier') or ''
        if re.match(r'^1\s+(cup|medium|large|small|slice|piece|tbsp|tablespoon|oz|ounce)', desc, re.I):
            return f"{desc} ({round(p['gramWeight'])}g)"
    first = next((p for p in good if p.get('portionDescription') or p.get('modifier')), None)
    if first:
        desc = first.get('portionDescription') or first.get('modifier') or ''
        return f"{desc} ({round(first['gramWeight'])}g)"
    return '100g'

# ── Main ──

all_foods = {}  # key (lowercase name+brand) -> food dict
cats = defaultdict(list)

def add_food(name, category, serving, nutrients, brand='', barcode='', source=''):
    if not name or len(name) < 3:
        return
    n = nutrients
    if n['calories'] == 0 and n['protein'] == 0 and n['carbs'] == 0:
        return
    if category is None:
        return  # e.g. pet foods
    key = f"{name}|||{brand}".lower()
    if key in all_foods:
        return
    food = {
        'name': name,
        'category': category,
        'serving': serving,
        'calories': n['calories'],
        'protein': n['protein'],
        'carbs': n['carbs'],
        'fat': n['fat'],
        'fiber': n['fiber'],
        'sugar': n['sugar'],
    }
    if brand:
        food['brand'] = brand
    if barcode:
        food['barcode'] = barcode
    if source:
        food['source'] = source
    all_foods[key] = food
    cats[category].append(food)

# 1. Foundation Foods
print('Loading Foundation Foods...')
t0 = time.time()
with open(os.path.join(DATA_DIR, 'foundation/FoodData_Central_foundation_food_json_2025-12-18.json'), 'r') as f:
    data = json.load(f)
for item in data['FoundationFoods']:
    add_food(
        name=title_case(item.get('description', '')),
        category=map_sr_category(item.get('foodCategory', {}).get('description')),
        serving=best_serving(item.get('foodPortions')),
        nutrients=extract_nutrients(item.get('foodNutrients')),
        source='foundation'
    )
print(f'  {len(data["FoundationFoods"])} foods, {len(all_foods)} unique total ({time.time()-t0:.1f}s)')

# 2. SR Legacy
print('Loading SR Legacy...')
t0 = time.time()
with open(os.path.join(DATA_DIR, 'sr_legacy/FoodData_Central_sr_legacy_food_json_2018-04.json'), 'r') as f:
    data = json.load(f)
for item in data['SRLegacyFoods']:
    cat_raw = item.get('foodCategory')
    cat_str = cat_raw.get('description') if isinstance(cat_raw, dict) else cat_raw
    add_food(
        name=title_case(item.get('description', '')),
        category=map_sr_category(cat_str),
        serving=best_serving(item.get('foodPortions')),
        nutrients=extract_nutrients(item.get('foodNutrients')),
        source='sr_legacy'
    )
print(f'  {len(data["SRLegacyFoods"])} foods, {len(all_foods)} unique total ({time.time()-t0:.1f}s)')

# 3. FNDDS
print('Loading FNDDS Survey Foods...')
t0 = time.time()
with open(os.path.join(DATA_DIR, 'fndds/surveyDownload.json'), 'r') as f:
    data = json.load(f)
for item in data['SurveyFoods']:
    add_food(
        name=title_case(item.get('description', '')),
        category=map_wweia_category(item.get('wweiaFoodCategory')),
        serving=best_serving(item.get('foodPortions')),
        nutrients=extract_nutrients(item.get('foodNutrients')),
        source='fndds'
    )
print(f'  {len(data["SurveyFoods"])} foods, {len(all_foods)} unique total ({time.time()-t0:.1f}s)')
del data  # free memory before branded

# 4. Branded Foods (3.1GB)
print('Loading Branded Foods (this takes ~60s for 3.1GB)...')
t0 = time.time()
with open(os.path.join(DATA_DIR, 'branded/brandedDownload.json'), 'r') as f:
    data = json.load(f)
branded_count = len(data['BrandedFoods'])
print(f'  Loaded {branded_count} branded foods in {time.time()-t0:.1f}s, processing...')

t0 = time.time()
for i, item in enumerate(data['BrandedFoods']):
    if i % 100000 == 0 and i > 0:
        print(f'    {i}/{branded_count}...')
    
    brand_owner = (item.get('brandOwner') or '').strip()
    serving_txt = item.get('householdServingFullText')
    serving_sz = item.get('servingSize', 100)
    serving_unit = item.get('servingSizeUnit', 'g')
    if serving_txt:
        serving = f"{serving_txt} ({serving_sz}{serving_unit})"
    else:
        serving = f"{serving_sz}{serving_unit}"
    
    add_food(
        name=title_case(item.get('description', '')),
        category=map_branded_category(item.get('brandedFoodCategory')),
        serving=serving,
        nutrients=extract_nutrients(item.get('foodNutrients')),
        brand=title_case(brand_owner),
        barcode=item.get('gtinUpc', ''),
        source='branded'
    )
print(f'  Processed in {time.time()-t0:.1f}s, {len(all_foods)} unique total')
del data

# ── Write output ──
os.makedirs(OUT_DIR, exist_ok=True)

print(f'\nTotal unique foods: {len(all_foods)}')
print(f'Categories: {len(cats)}')

# Write per-category JSON files
manifest = {}
for category, foods in sorted(cats.items()):
    foods.sort(key=lambda f: f['name'])
    filename = slug(category) + '.json'
    filepath = os.path.join(OUT_DIR, filename)
    with open(filepath, 'w') as f:
        json.dump(foods, f, separators=(',', ':'))
    size_kb = os.path.getsize(filepath) / 1024
    manifest[category] = {'file': filename, 'count': len(foods)}
    print(f'  {category}: {len(foods)} foods ({size_kb:.0f} KB)')

# Write manifest
manifest_path = os.path.join(OUT_DIR, 'manifest.json')
with open(manifest_path, 'w') as f:
    json.dump(manifest, f, indent=2)

total_size = sum(os.path.getsize(os.path.join(OUT_DIR, e['file'])) for e in manifest.values())
print(f'\nTotal data size: {total_size / 1024 / 1024:.1f} MB across {len(manifest)} files')
print(f'Manifest: {manifest_path}')
