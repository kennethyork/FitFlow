#!/usr/bin/env python3
"""Extract top ~30K branded foods from FDC Branded Foods dataset (3.1GB)."""

import json, sys, os, time
from collections import defaultdict

INPUT = os.path.join(os.path.dirname(__file__), 'fdc-data/branded/brandedDownload.json')
OUTPUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'branded-foods.json')

NUTRIENT_MAP = {1008: 'k', 1003: 'p', 1005: 'cb', 1004: 'f', 1079: 'fb', 2000: 'su'}

TOP_BRANDS = {
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
}

def is_top_brand(owner):
    if not owner:
        return False
    upper = owner.upper()
    return any(b in upper for b in TOP_BRANDS)

def title_case(s):
    return s.strip().title().rstrip(',').strip()

print(f'Loading {INPUT} ...')
t0 = time.time()
with open(INPUT, 'r', encoding='utf-8') as fh:
    data = json.load(fh)
foods = data['BrandedFoods']
print(f'Loaded {len(foods)} foods in {time.time()-t0:.1f}s')

seen = set()
top_brand = []
other_brand = []
skipped_macros = 0
skipped_dupe = 0

for f in foods:
    macros = {v: 0 for v in NUTRIENT_MAP.values()}
    for fn in (f.get('foodNutrients') or []):
        nid = (fn.get('nutrient') or {}).get('id')
        field = NUTRIENT_MAP.get(nid)
        if field:
            macros[field] = round(fn.get('amount', 0) or 0)

    if macros['k'] == 0 and macros['p'] == 0 and macros['cb'] == 0:
        skipped_macros += 1
        continue

    brand = (f.get('brandOwner') or '').strip()
    desc = (f.get('description') or '').strip()
    if not desc or len(desc) < 3:
        continue

    key = f'{brand}|||{desc}'.lower()
    if key in seen:
        skipped_dupe += 1
        continue
    seen.add(key)

    serving_txt = f.get('householdServingFullText')
    serving_sz = f.get('servingSize', 100)
    serving_unit = f.get('servingSizeUnit', 'g')
    if serving_txt:
        s = f'{serving_txt} ({serving_sz}{serving_unit})'
    else:
        s = f'{serving_sz}{serving_unit}'

    food = {
        'n': title_case(desc),
        'b': title_case(brand),
        'c': f.get('brandedFoodCategory', 'Other'),
        's': s,
        **macros,
    }
    upc = f.get('gtinUpc')
    if upc:
        food['u'] = upc

    if is_top_brand(brand):
        top_brand.append(food)
    else:
        other_brand.append(food)

print(f'Skipped (no macros): {skipped_macros}')
print(f'Skipped (duplicate): {skipped_dupe}')
print(f'Top brand foods: {len(top_brand)}')
print(f'Other brand foods: {len(other_brand)}')
print(f'Total unique: {len(seen)}')

TARGET = 30000
if len(top_brand) >= TARGET:
    result = top_brand[:TARGET]
else:
    remaining = TARGET - len(top_brand)
    result = top_brand + other_brand[:remaining]

result.sort(key=lambda x: (x['c'], x['n']))

print(f'\nFinal selection: {len(result)} foods')
cats = set(r['c'] for r in result)
print(f'Categories: {len(cats)}')

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
with open(OUTPUT, 'w', encoding='utf-8') as fh:
    json.dump(result, fh, separators=(',', ':'))

size_mb = os.path.getsize(OUTPUT) / 1024 / 1024
print(f'\nWrote {OUTPUT} ({size_mb:.1f} MB)')
