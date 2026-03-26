// ═══════════════════════════════════════════════════════════════════
// Coach Response Database — comprehensive fitness/nutrition/wellness
// knowledge base designed to produce LLM-quality responses without
// any AI model. Pattern-matched with contextual assembly.
// ═══════════════════════════════════════════════════════════════════

// ── INTENT CATEGORIES ──
// Each has: id, patterns (regex), responses (string[]), followUps (string[])
export const INTENTS = [
  // ════════════ WEIGHT LOSS ════════════
  {
    id: 'lose_weight',
    patterns: [/lose\s*weight/i, /fat\s*loss/i, /slim\s*down/i, /burn\s*(fat|calories)/i, /cut(ting)?\s*(weight|fat)/i, /lean(er|ing)/i, /shred/i, /drop.*pound/i, /lose.*belly/i, /skinny/i, /weight\s*loss/i, /get.*thin/i, /trim/i, /tone\s*(up|down|my)/i],
    responses: [
      "To lose weight sustainably, aim for a calorie deficit of 300–500 calories below your maintenance level. That typically translates to about 0.5–1 lb lost per week. Pair this with adequate protein intake (0.8–1g per pound of bodyweight) to preserve muscle mass while you drop fat. The biggest mistake people make is going too aggressive — extreme deficits slow your metabolism and lead to muscle loss.",
      "Weight loss comes down to energy balance, but *how* you create that deficit matters. I'd prioritize these three things: (1) eat protein at every meal to stay full and protect muscle, (2) fill half your plate with vegetables for fiber and volume, and (3) walk 7,000–10,000 steps daily — it's the most underrated fat-loss tool. Small, consistent actions beat extreme diets every time.",
      "Here's a practical fat-loss framework: First, calculate your maintenance calories (bodyweight × 15 is a rough estimate). Then subtract 400. Eat that number daily with at least 130g of protein. Lift weights 3–4 times per week to maintain muscle. Walk daily. Sleep 7–8 hours. Weigh yourself weekly (same day, same time, fasted) and adjust after 2–3 weeks if the scale isn't moving.",
      "The most effective fat loss strategy is the one you can actually stick with long-term. Crash diets work short-term but always backfire. Instead, start by tracking what you eat for one week without changing anything — just build awareness. Then make one small change per week: swap sugary drinks for water, add a serving of vegetables to lunch, take a 15-minute walk after dinner. These compound over time.",
      "Losing weight isn't just about eating less — it's about eating *smarter*. Focus on nutrient-dense foods that keep you satisfied: lean proteins (chicken, fish, Greek yogurt), high-fiber carbs (oats, sweet potatoes, beans), and healthy fats (avocado, nuts, olive oil). These foods have a higher thermic effect and satiety index than processed alternatives, meaning you burn more calories digesting them and stay fuller longer.",
    ],
  },
  // ════════════ MUSCLE GAIN ════════════
  {
    id: 'gain_muscle',
    patterns: [/gain\s*(weight|muscle|mass)/i, /bulk/i, /build\s*muscle/i, /get\s*(bigger|stronger|jacked|huge|muscular)/i, /muscle\s*growth/i, /hypertrophy/i, /mass\s*gain/i, /put\s*on\s*(muscle|size|mass)/i],
    responses: [
      "Building muscle requires three things working together: a calorie surplus, sufficient protein, and progressive overload in your training. Aim for 200–400 calories above your maintenance level, consume 1–1.2g of protein per pound of bodyweight spread across 4–5 meals, and focus on getting stronger at compound movements week over week. Patience is key — expect to gain 1–2 lbs of muscle per month as a natural lifter.",
      "For muscle growth, I'd structure your approach like this: Eat in a lean surplus (maintenance + 300 cal), hit each muscle group twice per week with 10–20 hard sets per muscle group, and prioritize progressive overload (more weight, more reps, or more sets over time). Compound lifts should be your foundation — squats, bench press, deadlifts, overhead press, rows, and pull-ups. Aim for 6–12 reps on compounds and 8–15 on isolation work.",
      "The biggest mistake people make when trying to build muscle is not eating enough. You need a calorie surplus to provide the energy for muscle protein synthesis. Start with bodyweight × 17–18 for your daily calories, with protein at 1g/lb. Distribute that protein across meals — your body can only utilize about 30–50g per meal effectively. Train hard 4–5 days per week, sleep 7–9 hours, and be patient. Real size takes 6–12 months of consistent effort.",
      "Here's a proven muscle-building formula: Train each muscle 2× per week using a Push/Pull/Legs or Upper/Lower split. For each exercise, do 3–4 sets in the 6–12 rep range with 60–90 seconds rest. Eat at a 10–15% calorie surplus with 1g protein per pound of bodyweight. Creatine monohydrate (5g daily) is the single most effective legal supplement for muscle growth. Track your lifts and aim to add weight or reps every week.",
    ],
  },
  // ════════════ MEAL IDEAS / NUTRITION ════════════
  {
    id: 'meal_ideas',
    patterns: [/what\s*(should|can)\s*i\s*eat/i, /meal\s*(idea|suggestion|plan|prep)/i, /what.*for\s*(breakfast|lunch|dinner|snack)/i, /healthy\s*(meal|food|eating|recipe)/i, /nutrition\s*(tip|advice)/i, /food.*suggest/i, /recipe\s*idea/i, /cook.*healthy/i, /what.*good.*eat/i, /diet\s*(plan|tip|advice)/i, /eating\s*(plan|schedule|window)/i],
    responses: [
      "Here's a full day of healthy eating that's easy to prep:\n\n**Breakfast:** Greek yogurt (200g) with mixed berries, a drizzle of honey, and 30g granola — 350 cal, 25g protein.\n**Lunch:** Grilled chicken breast (150g) over mixed greens with cherry tomatoes, cucumber, feta cheese, and olive oil dressing — 450 cal, 40g protein.\n**Dinner:** Baked salmon (150g) with roasted sweet potato and steamed broccoli — 500 cal, 35g protein.\n**Snack:** Apple slices with 2 tbsp almond butter — 250 cal, 7g protein.\n\nTotal: ~1,550 cal, 107g protein. Adjust portions to hit your calorie target.",
      "Some of my favorite meal prep ideas that are quick, affordable, and nutritious:\n\n• **Overnight oats** — oats, milk, chia seeds, protein powder, berries (prep 5 min, ready next morning)\n• **Sheet pan chicken & veggies** — chicken thighs, bell peppers, zucchini, onion with olive oil and seasoning (30 min, 4 servings)\n• **Turkey taco bowls** — ground turkey, rice, black beans, corn, salsa, avocado (20 min, easy to portion)\n• **Egg muffins** — whisk eggs with spinach, cheese, diced peppers, bake in muffin tin (grab-and-go breakfast)\n• **Stir-fry** — any protein + frozen stir-fry vegetables + soy sauce over rice (15 min)\n\nThe key is batch cooking — spend 1–2 hours on Sunday prepping proteins and carbs for the week.",
      "A solid nutrition framework without overthinking it: Build every meal around these three components:\n\n1. **Protein source** (palm-sized portion): chicken, fish, eggs, Greek yogurt, tofu, lean beef, cottage cheese\n2. **Complex carb** (fist-sized portion): rice, sweet potato, oats, quinoa, whole grain bread, fruit\n3. **Vegetables** (fill the rest of your plate): any and all — the more colors, the better\n\nAdd a thumb-sized portion of healthy fat (olive oil, avocado, nuts) and you've got a balanced meal every time. No calorie counting needed if you follow this plate method consistently.",
      "If you're short on time, here are 5-minute healthy meals:\n\n• **Protein smoothie** — banana, protein powder, spinach, peanut butter, milk → blend\n• **Tuna salad wrap** — canned tuna, Greek yogurt (instead of mayo), celery, whole wheat wrap\n• **Cottage cheese bowl** — cottage cheese, sliced peaches, cinnamon, handful of walnuts\n• **Quick quesadilla** — whole wheat tortilla, shredded chicken, cheese, black beans → pan 3 min each side\n• **Egg scramble** — 3 eggs, handful of spinach, leftover veggies, hot sauce\n\nHealthy eating doesn't have to be complicated. The simpler your meals, the more likely you'll stick with them.",
    ],
  },
  // ════════════ BREAKFAST SPECIFIC ════════════
  {
    id: 'breakfast',
    patterns: [/breakfast/i, /morning\s*meal/i, /what.*eat.*morning/i, /first\s*meal/i],
    responses: [
      "Great breakfast options that keep you full and energized:\n\n• **High protein:** 3-egg omelet with spinach and feta + whole grain toast (400 cal, 30g protein)\n• **Quick & easy:** Greek yogurt parfait with granola and mixed berries (350 cal, 25g protein)\n• **Meal prep:** Overnight oats with protein powder, chia seeds, banana (400 cal, 30g protein)\n• **On-the-go:** Protein shake with banana and peanut butter (350 cal, 35g protein)\n• **Weekend:** Protein pancakes made with oats, eggs, banana, and protein powder (450 cal, 35g protein)\n\nThe key for breakfast is frontloading protein — it reduces hunger and cravings for the rest of the day. Aim for at least 25g of protein at breakfast.",
      "My top breakfast recommendation is something with 25–30g of protein to set you up for the day. Research shows that a high-protein breakfast reduces ghrelin (your hunger hormone) and keeps you satisfied until lunch. Some winners: scrambled eggs with avocado toast, Greek yogurt with nuts and seeds, or a protein smoothie with oats blended in. If you're not a morning eater, even a small handful of nuts and a protein shake works.",
    ],
  },
  // ════════════ LUNCH SPECIFIC ════════════
  {
    id: 'lunch',
    patterns: [/lunch/i, /midday\s*meal/i, /noon.*eat/i],
    responses: [
      "Solid lunch ideas that won't leave you in a food coma:\n\n• **Big salad with protein** — greens, grilled chicken or salmon, quinoa, avocado, seeds, vinaigrette. Filling and nutrient-dense.\n• **Grain bowl** — rice or quinoa base, protein of choice, roasted veggies, tahini or peanut sauce.\n• **Wrap or sandwich** — whole grain wrap, turkey/chicken, hummus, lots of veggies, side of fruit.\n• **Soup + protein** — lentil soup or chicken soup with a side of Greek yogurt or cheese and crackers.\n• **Leftovers** — honestly, last night's dinner reheated is often the best lunch. Meal prep makes this effortless.\n\nAvoid heavy, carb-only lunches that spike and crash your blood sugar. Always include protein and fiber to stay energized through the afternoon.",
    ],
  },
  // ════════════ DINNER SPECIFIC ════════════
  {
    id: 'dinner',
    patterns: [/dinner/i, /evening\s*meal/i, /supper/i, /what.*eat.*tonight/i, /night.*meal/i],
    responses: [
      "Healthy dinner ideas that are satisfying without being heavy:\n\n• **Baked salmon** with roasted asparagus and quinoa — omega-3s and complete nutrition in 25 min\n• **Chicken stir-fry** with mixed vegetables and brown rice — fast, customizable, family-friendly\n• **Turkey meatballs** with marinara sauce over zucchini noodles — high protein, lower carb\n• **Sheet pan fajitas** — sliced chicken or steak, bell peppers, onions with seasoning, served with tortillas\n• **Mediterranean plate** — grilled chicken, hummus, tabbouleh, pita, cucumber-tomato salad\n\nTip: Make dinner your lightest meal if weight loss is your goal. Front-load calories earlier in the day when your body uses them more efficiently. But don't skip dinner — that often leads to late-night snacking.",
    ],
  },
  // ════════════ SNACKS ════════════
  {
    id: 'snacks',
    patterns: [/snack/i, /between\s*meal/i, /hungry.*between/i, /munchies/i, /nibble/i, /bite.*eat/i],
    responses: [
      "Smart snack choices that satisfy without derailing your goals:\n\n**High protein (best for satiety):**\n• Greek yogurt + berries (150 cal, 15g protein)\n• Hard-boiled eggs × 2 (140 cal, 12g protein)\n• String cheese + turkey slices (150 cal, 18g protein)\n• Cottage cheese + pineapple (160 cal, 14g protein)\n• Protein bar (look for 20g+ protein, <5g sugar)\n\n**Quick energy:**\n• Apple + almond butter (200 cal)\n• Trail mix — small handful (180 cal)\n• Banana + handful of walnuts (220 cal)\n• Rice cakes + peanut butter (170 cal)\n• Hummus + veggies — carrots, celery, bell pepper (120 cal)\n\nThe best snack pairs protein with fiber or healthy fat. Avoid snacks that are just simple carbs (crackers, chips, candy) — they spike blood sugar and leave you hungrier 30 minutes later.",
    ],
  },
  // ════════════ PROTEIN ════════════
  {
    id: 'protein',
    patterns: [/protein/i, /enough\s*protein/i, /protein\s*source/i, /high\s*protein/i, /how\s*much\s*protein/i],
    responses: [
      "Here's a comprehensive protein guide:\n\n**How much:** 0.7–1g per pound of bodyweight for active people. If you're 160 lbs, aim for 112–160g daily.\n\n**Best sources (per 100g):**\n• Chicken breast — 31g protein, 165 cal\n• Turkey breast — 29g protein, 135 cal\n• Salmon — 25g protein, 208 cal\n• Lean beef (90%) — 26g protein, 176 cal\n• Eggs — 13g protein, 155 cal (about 6g per egg)\n• Greek yogurt — 10g protein, 59 cal\n• Tofu (firm) — 17g protein, 144 cal\n• Lentils — 9g protein, 116 cal\n• Cottage cheese — 11g protein, 98 cal\n\n**Pro tips:**\n• Spread protein across 3–5 meals (30–40g each) for optimal synthesis\n• Eat protein within 2 hours of training (the \"anabolic window\" is real but wider than people think)\n• If you struggle to hit your target, a whey or plant protein shake is convenient and effective",
      "Protein is the most important macronutrient for both fat loss and muscle building. It has the highest thermic effect (your body burns 20–30% of protein calories just digesting it), it's the most satiating macro (keeps you full longest), and it's essential for muscle repair and growth.\n\nQuick ways to add more protein:\n• Start every meal with the protein source first\n• Swap regular yogurt for Greek yogurt (2× the protein)\n• Add eggs or egg whites to any meal\n• Keep protein shakes on hand for convenience\n• Snack on jerky, cheese sticks, or cottage cheese instead of chips\n• Add beans or lentils to soups, salads, and bowls\n\nMost people undereat protein. If you only change one thing about your diet, make it this: get enough protein.",
    ],
  },
  // ════════════ CALORIES / MACROS / TDEE ════════════
  {
    id: 'calories',
    patterns: [/calorie/i, /how\s*much\s*(should|do)\s*i\s*eat/i, /tdee/i, /maintenance/i, /macro/i, /bmr/i, /deficit/i, /surplus/i, /counting/i, /track.*food/i, /how\s*many\s*cal/i],
    responses: [
      "Here's how to figure out your calorie needs:\n\n**Step 1 — Estimate your maintenance (TDEE):**\nBodyweight (lbs) × activity multiplier:\n• Sedentary (desk job): × 13–14\n• Lightly active (exercise 2–3×/wk): × 14–15\n• Moderately active (exercise 4–5×/wk): × 15–16\n• Very active (exercise 6–7×/wk + physical job): × 16–18\n\n**Step 2 — Set your goal:**\n• Fat loss: TDEE − 400 to 500 cal\n• Maintenance: eat at TDEE\n• Muscle gain: TDEE + 200 to 300 cal\n\n**Step 3 — Set macros:**\n• Protein: 1g per lb bodyweight\n• Fat: 25–30% of total calories\n• Carbs: whatever's left\n\nTrack for 2–3 weeks, weigh yourself weekly (same conditions), and adjust by 100–200 cal if needed. Don't chase perfection — being within 50–100 cal is fine.",
      "Macro breakdown made simple:\n\n**For fat loss:** Protein 40%, Carbs 30%, Fat 30%\n**For maintenance:** Protein 30%, Carbs 40%, Fat 30%\n**For muscle gain:** Protein 30%, Carbs 45%, Fat 25%\n\nBut honestly, the *most important* macro is protein — hit your protein target first, and distribute the rest between carbs and fats based on your preference. Some people feel better with more carbs, others prefer more fat. Both work fine for body composition as long as total calories and protein are dialed in.\n\nDon't get paralyzed by perfection. Track within reasonable ranges and adjust based on how you feel and how your body responds over 2–4 weeks.",
    ],
  },
  // ════════════ WORKOUTS / TRAINING ════════════
  {
    id: 'workout',
    patterns: [/workout/i, /exercise/i, /training/i, /gym/i, /lift/i, /what.*routine/i, /how.*train/i, /program/i, /split/i, /what.*do.*gym/i, /weight\s*training/i, /resistance/i, /strength/i],
    responses: [
      "Here's a proven workout structure based on your experience level:\n\n**Beginner (0–6 months):** Full body, 3× per week\n• Squat variation — 3×8–10\n• Bench press or push-ups — 3×8–10\n• Barbell row — 3×8–10\n• Overhead press — 3×8–10\n• Deadlift or RDL — 3×8–10\n• Plank — 3×30–60 sec\n\n**Intermediate (6–18 months):** Upper/Lower, 4× per week\n• Upper A: Bench, Row, OHP, Curl, Tricep pushdown\n• Lower A: Squat, RDL, Leg curl, Calf raise, Ab work\n• Upper B: Incline DB press, Pull-ups, Lateral raise, Face pull\n• Lower B: Deadlift, Bulgarian split squat, Leg extension, Hip thrust\n\n**Advanced (18+ months):** Push/Pull/Legs, 6× per week\nEach muscle hit 2× weekly with 15–20 total sets per muscle group per week.\n\nKey principles: progressive overload, full range of motion, 1–2 min rest between sets, train close to failure (1–3 reps in reserve).",
      "The best workout routine is one you enjoy and can do consistently. But here are the fundamentals that make any program work:\n\n1. **Progressive overload** — increase weight, reps, or sets over time\n2. **Compound movements first** — squat, bench, deadlift, press, row, pull-up\n3. **Frequency** — hit each muscle at least 2× per week\n4. **Volume** — 10–20 hard sets per muscle group per week\n5. **Intensity** — train within 1–3 reps of failure on most sets\n6. **Recovery** — at least 1–2 rest days per week\n\nDon't overcomplicate it. A simple program done consistently with progressive overload will beat a fancy program done inconsistently every single time.",
      "If you're not sure where to start, here's a simple 3-day full body routine you can do in 45 minutes:\n\n**Day A:**\n• Barbell squat — 4×6–8\n• Dumbbell bench press — 3×8–12\n• Barbell row — 3×8–12\n• Dumbbell lateral raise — 3×12–15\n• Plank — 3×45 sec\n\n**Day B:**\n• Romanian deadlift — 4×8–10\n• Overhead press — 3×8–10\n• Lat pulldown — 3×10–12\n• Dumbbell curl — 3×10–15\n• Cable tricep pushdown — 3×10–15\n\nAlternate A and B across 3 sessions per week (Mon/Wed/Fri). Rest 90 sec between sets. Increase weight when you can hit the top of the rep range for all sets. Simple, effective, proven.",
    ],
  },
  // ════════════ CARDIO / RUNNING / HIIT ════════════
  {
    id: 'cardio',
    patterns: [/cardio/i, /running/i, /walk/i, /jog/i, /hiit/i, /cycling/i, /swim/i, /step.*count/i, /aerobic/i, /endurance/i, /sprint/i, /treadmill/i, /elliptical/i, /bike/i],
    responses: [
      "Here's how to structure cardio based on your goals:\n\n**For fat loss:** Combine low-intensity steady state (LISS) + high-intensity intervals (HIIT)\n• Walk 7,000–10,000 steps daily (non-negotiable baseline)\n• 2–3× HIIT sessions per week (20–25 min each)\n• Example HIIT: 30 sec all-out sprint / 60 sec walk × 10–15 rounds\n\n**For heart health:** 150 min moderate cardio per week (AHA recommendation)\n• That's just 30 min, 5× per week of brisk walking, cycling, or swimming\n\n**For endurance:** Progressive mileage increase\n• Don't increase weekly distance by more than 10%\n• Include one long run/ride per week and one speed session\n\n**Important:** Cardio should complement strength training, not replace it. If you only have 3 hours per week, spend 2 hours lifting and 1 hour on cardio. Walking doesn't count as a workout — it's a lifestyle habit you should do every day regardless.",
      "The hierarchy of cardio for fat loss (most to least effective bang for your buck):\n\n1. **Daily walking** — 7,000–10,000 steps. This alone can create a 200–400 calorie deficit. It's free, doesn't require recovery, and anyone can do it.\n2. **HIIT** — 20–30 min, 2–3× per week. Burn more calories per minute, elevate metabolism for hours after (EPOC effect).\n3. **Steady-state cardio** — 30–45 min of moderate intensity. Good for heart health, lower stress on the body than HIIT.\n\nThe best form of cardio is whatever you enjoy and will actually do. Running, cycling, swimming, jump rope, dancing, hiking, sports — they all work. Consistency matters more than optimization.",
    ],
  },
  // ════════════ MOTIVATION / MINDSET ════════════
  {
    id: 'motivation',
    patterns: [/motivat/i, /give\s*up/i, /discourag/i, /struggling/i, /can'?t\s*(do|seem|stick|keep)/i, /no\s*(progress|results)/i, /plateau/i, /not\s*seeing/i, /stuck/i, /frustrated/i, /worth\s*it/i, /losing\s*hope/i, /failed|failure/i, /slip\s*up/i, /fell\s*off/i, /back\s*on\s*track/i, /start.*over/i, /quit/i, /hard/i],
    responses: [
      "I hear you, and I want you to know that what you're feeling is completely normal. Every single person who has ever transformed their body has gone through moments of doubt. Here's what I want you to remember:\n\n**Progress isn't linear.** Your weight can fluctuate 2–5 lbs daily from water, sodium, stress, and hormones. That doesn't mean your fat loss has stalled — it means you're human.\n\n**Focus on the process, not the outcome.** Did you eat reasonably well today? Did you move your body? Did you drink water? Those are wins, regardless of what the scale says.\n\n**The only workout you regret is the one you didn't do.** On days you don't feel like it, commit to just 10 minutes. You'll almost always end up doing more.\n\nYou started this journey for a reason. That reason hasn't changed. Keep going. 💪",
      "Plateaus are actually a sign that your body has adapted — which means your previous efforts worked! Here's how to break through:\n\n1. **Recalculate your calories** — as you lose weight, your TDEE decreases. You may need 100–200 fewer calories now.\n2. **Add variety to training** — change exercises, rep ranges, or training style every 4–6 weeks\n3. **Check your sleep** — poor sleep (< 7 hrs) can stall fat loss by increasing cortisol and hunger hormones\n4. **Take a diet break** — eat at maintenance for 1–2 weeks. This can reset leptin levels and reinvigorate fat loss\n5. **Be patient** — sometimes a \"plateau\" is just your body redistributing. Take measurements and photos — the scale isn't the only metric\n\nThe people who succeed aren't the ones who never hit plateaus. They're the ones who push through them.",
      "Getting back on track is simpler than you think. Don't try to undo what happened — just start fresh right now. Not tomorrow, not Monday. Right now.\n\n**Your next 24 hours:**\n• Drink a full glass of water right now\n• Plan your next meal (protein + veggies)\n• Go for a 10-minute walk\n• Go to bed at a reasonable hour tonight\n\nThat's it. One good day leads to another. You don't need perfection — you need momentum. The fact that you're here talking to me means you haven't given up. And that's the single most important thing.",
      "Here's a mindset shift that changed everything for me: stop thinking about motivation and start thinking about **systems**.\n\n• Can't get to the gym? Set your workout clothes out the night before.\n• Can't eat healthy? Meal prep on Sunday so decisions are already made.\n• Can't drink enough water? Fill a large bottle in the morning and keep it visible.\n• Can't stay consistent? Track your habits — even a simple checklist creates accountability.\n\nMotivation is a feeling — it comes and goes. Discipline is a skill — it gets stronger with practice. Build systems that make the right choice the easy choice, and you won't need motivation anymore.",
    ],
  },
  // ════════════ SLEEP / RECOVERY ════════════
  {
    id: 'sleep',
    patterns: [/sleep/i, /rest\b/i, /recovery/i, /tired/i, /fatigue/i, /exhausted/i, /insomnia/i, /can'?t\s*sleep/i, /sore/i, /overtrain/i, /rest\s*day/i, /burnout/i, /worn\s*out/i, /nap/i],
    responses: [
      "Sleep is genuinely the most underrated performance enhancer. Here's why it matters and how to optimize it:\n\n**Why:** Poor sleep (< 7 hrs) increases ghrelin (hunger hormone) by 15%, reduces leptin (satiety hormone), impairs muscle recovery by up to 60%, decreases testosterone, increases cortisol, and tanks your willpower.\n\n**Sleep hygiene checklist:**\n• Keep your bedroom cool (65–68°F / 18–20°C)\n• Complete darkness — use blackout curtains or an eye mask\n• No screens 30–60 min before bed (blue light suppresses melatonin)\n• Consistent schedule — same wake time every day, even weekends\n• No caffeine after 2 PM (it has a 6-hour half-life)\n• Avoid heavy meals within 2 hours of bedtime\n• Try magnesium glycinate (200–400mg) before bed — evidence-backed sleep aid\n\nAim for 7–9 hours. If you're training hard, lean toward 8–9. Sleep is when your body repairs, builds muscle, and consolidates learning.",
      "Recovery is just as important as training. Your muscles don't grow in the gym — they grow while you recover. Here's a comprehensive recovery framework:\n\n**Daily:**\n• 7–9 hours of sleep\n• Adequate protein (1g/lb)\n• 2+ liters of water\n• Light movement (walking, stretching) on rest days\n\n**Weekly:**\n• 1–2 full rest days (no intense exercise)\n• Foam rolling or light stretching (10–15 min)\n\n**Monthly/Quarterly:**\n• Deload week every 4–6 weeks (reduce volume by 40–50%)\n• Active recovery activities (yoga, swimming, hiking)\n\nSigns you need more recovery: persistent fatigue, declining performance, irritability, increased resting heart rate, joints aching, loss of appetite, getting sick frequently. If you notice 3+ of these, take an extra rest day or two.",
    ],
  },
  // ════════════ WATER / HYDRATION ════════════
  {
    id: 'water',
    patterns: [/water/i, /hydrat/i, /how\s*much.*drink/i, /fluid/i, /dehydrat/i, /thirst/i],
    responses: [
      "Hydration affects everything — energy, performance, appetite, digestion, skin, and cognitive function. Here's your hydration guide:\n\n**How much:** A good baseline is half your bodyweight (in lbs) in ounces of water. So 180 lbs = 90 oz (about 2.7 liters). Add 16–24 oz for every hour of exercise.\n\n**Timing tips:**\n• Drink 16 oz first thing in the morning (you wake up dehydrated)\n• Drink a glass before each meal (helps with appetite control)\n• Sip throughout workouts (don't wait until you're thirsty)\n• Keep a large water bottle visible at your desk all day\n\n**Signs of dehydration:** dark yellow urine, headaches, fatigue, dizziness, dry mouth, decreased performance\n\n**Make it easier:** If plain water bores you, try sparkling water, add lemon/lime/cucumber slices, or use crystal light / flavor drops with zero calories. Herbal tea and black coffee count toward your daily intake too.",
    ],
  },
  // ════════════ SUGAR / JUNK FOOD / CRAVINGS ════════════
  {
    id: 'cravings',
    patterns: [/sugar/i, /sweet/i, /dessert/i, /candy/i, /junk\s*food/i, /cheat/i, /crav/i, /binge/i, /ice\s*cream/i, /chocolate/i, /pizza/i, /fast\s*food/i, /processed/i, /unhealthy/i, /tempt/i, /guilty/i],
    responses: [
      "Cravings are completely normal and aren't a sign of weakness. Here's how to manage them intelligently:\n\n**Immediate strategies:**\n• Wait 10–15 minutes — most cravings pass\n• Drink a large glass of water (thirst mimics hunger)\n• Eat a high-protein snack (kills sweet cravings surprisingly well)\n• Brush your teeth (seriously — it works)\n• Go for a short walk (changes your mental state)\n\n**Long-term strategies:**\n• Don't ban any food completely — restriction creates obsession\n• Use the 80/20 rule: eat whole foods 80% of the time, enjoy treats 20%\n• Find healthy swaps: Greek yogurt + berries for ice cream, dark chocolate for candy, air-popped popcorn for chips\n• Plan your indulgences — a planned treat is a choice, not a failure\n• Keep trigger foods out of the house (willpower is finite)\n\n**Underlying causes to check:**\n• Not eating enough overall (your body is signaling for energy)\n• Low protein intake (leads to carb/sugar cravings)\n• Poor sleep (increases ghrelin and cravings)\n• Stress (cortisol drives comfort food seeking)\n\nA craving controlled is strength building. You don't need to be perfect — you need to be *mostly* consistent.",
      "The 'cheat meal' mentality is outdated. Instead, think of it as a 'free meal' or just 'eating flexibly.' Here's why:\n\nIf you eat 21 meals per week and 19 of them are on-plan, 2 enjoyable meals will not derail your progress. That's 90% compliance, which is more than enough for great results.\n\n**Guidelines for flexible eating:**\n• Don't 'save up' calories all day to binge at night\n• Eat your treat slowly and mindfully — actually enjoy it\n• Choose the treat you *really* want, not the closest convenient option\n• Get right back to your normal eating at the next meal\n• No guilt — guilt leads to 'screw it' spiraling\n\nFood should nourish your body AND your soul. Finding that balance is the key to a sustainable, healthy relationship with food.",
    ],
  },
  // ════════════ STRESS / MENTAL HEALTH ════════════
  {
    id: 'stress',
    patterns: [/stress/i, /anxious/i, /anxiety/i, /mental\s*health/i, /overwhelm/i, /depress/i, /mood/i, /emotional/i, /mind/i, /therapy/i, /self.?care/i, /burn.?out/i, /cope|coping/i],
    responses: [
      "The mind-body connection is powerful, and exercise is genuinely one of the most effective tools for mental health. Studies show that regular exercise is as effective as medication for mild-to-moderate depression and anxiety.\n\n**Evidence-backed stress management:**\n• **Exercise** — even 10 minutes of walking lowers cortisol\n• **Box breathing** — inhale 4 sec, hold 4 sec, exhale 4 sec, hold 4 sec. Repeat 5–10 rounds.\n• **Progressive muscle relaxation** — tense each muscle group for 5 sec, then release\n• **Nature exposure** — 20+ minutes outdoors reduces stress hormones measurably\n• **Social connection** — talking to someone you trust (even briefly) reduces stress response\n• **Journaling** — writing down what you're feeling for 10 min can reduce anxiety\n• **Sleep** — prioritize 7–9 hours (sleep deprivation amplifies anxiety)\n\nRemember: taking care of your mental health isn't a luxury — it's a prerequisite for everything else. You can't pour from an empty cup. If you're feeling consistently overwhelmed, talking to a professional is a sign of strength, not weakness.",
      "When you're stressed, your body fights against your fitness goals — cortisol increases appetite and promotes fat storage (especially around the midsection). Here's how to manage both simultaneously:\n\n1. **Lower the exercise intensity** temporarily — swap HIIT for walking, heavy lifting for lighter sessions. High-intensity exercise adds more stress to an already-stressed system.\n2. **Focus on nutrition fundamentals** — don't try to start a new diet during high-stress periods. Just eat balanced meals and adequate protein.\n3. **Prioritize sleep above everything** — even if it means a shorter workout\n4. **Practice one daily mindfulness habit** — even 5 minutes of breathing exercises\n5. **Move for mood, not calories** — exercise to feel better, not to burn a specific number\n\nStress is temporary. Give yourself grace and maintain the basics. You'll come back stronger.",
    ],
  },
  // ════════════ SUPPLEMENTS ════════════
  {
    id: 'supplements',
    patterns: [/supplement/i, /vitamin/i, /creatine/i, /pre.?workout/i, /whey/i, /fish\s*oil/i, /omega/i, /bcaa/i, /glutamine/i, /collagen/i, /probiotic/i, /multivitamin/i, /zinc|magnesium|vitamin\s*d/i, /caffeine\s*pill/i],
    responses: [
      "Here's an honest, evidence-based supplement tier list:\n\n**Tier 1 — Strong evidence, worth taking:**\n• **Creatine monohydrate** (5g/day) — enhances strength, muscle growth, and even cognitive function. Safe, cheap, well-researched.\n• **Protein powder** (whey or plant-based) — convenient way to hit protein targets. Not magic, just food.\n• **Vitamin D** (2,000–5,000 IU/day) — most people are deficient, especially if you're indoors a lot. Important for immunity, mood, and hormones.\n• **Omega-3 fish oil** (1–2g EPA+DHA/day) — anti-inflammatory, heart health, joint health\n\n**Tier 2 — Situational benefit:**\n• **Magnesium glycinate** (200–400mg before bed) — helps sleep quality and recovery\n• **Caffeine** (200mg pre-workout) — proven performance enhancer\n• **Multivitamin** — insurance policy for micronutrient gaps\n\n**Tier 3 — Largely hype/waste of money:**\n• BCAAs (if you eat enough protein, these are pointless)\n• Glutamine (no evidence for healthy people eating adequate protein)\n• Fat burners (expensive caffeine pills with marketing)\n• Testosterone boosters (none of them work meaningfully)\n\n**Remember:** Supplements supplement a good diet — they can't replace one. If your nutrition, training, and sleep aren't dialed in, no supplement will fix that.",
    ],
  },
  // ════════════ FASTING / INTERMITTENT FASTING ════════════
  {
    id: 'fasting',
    patterns: [/fast(ing)?/i, /intermittent/i, /eating\s*window/i, /16.?8/i, /omad/i, /skip.*meal/i, /time.*restrict/i],
    responses: [
      "Intermittent fasting (IF) is a legitimate tool, but it's not magic. Here's the evidence-based breakdown:\n\n**Popular protocols:**\n• **16:8** — 16 hour fast, 8 hour eating window (most sustainable)\n• **18:6** — stricter version, works well for some\n• **OMAD** — one meal a day (extreme, not recommended for most)\n• **5:2** — eat normally 5 days, restrict to 500–600 cal 2 days\n\n**Benefits:** Simplifies meal planning, can help with appetite control, some evidence for improved insulin sensitivity and autophagy.\n\n**Drawbacks:** Doesn't work if you overeat in your window, can lead to muscle loss if protein isn't adequate, may increase cortisol, not great for people with disordered eating history.\n\n**The truth:** IF works for fat loss because it usually reduces total calorie intake, not because of some metabolic magic. If skipping breakfast makes you eat less overall and feel good — great, do it. If it makes you binge at lunch — don't.\n\n**If you try it:** Prioritize protein in your eating window (same total daily target), drink water/black coffee during fasting hours, and don't force it if it makes you miserable. The best diet is one you can sustain.",
    ],
  },
  // ════════════ STRETCHING / FLEXIBILITY ════════════
  {
    id: 'flexibility',
    patterns: [/stretch/i, /flexibility/i, /yoga/i, /mobility/i, /warm\s*up/i, /cool\s*down/i, /tight/i, /stiff/i, /posture/i, /foam\s*roll/i],
    responses: [
      "Mobility and flexibility work is often neglected but pays huge dividends for injury prevention and long-term performance:\n\n**Before workouts (5–10 min dynamic stretching):**\n• Leg swings (front-to-back and side-to-side)\n• Arm circles and band pull-aparts\n• Hip circles and walking lunges\n• Cat-cow stretches\n• Bodyweight squats\n\n**After workouts (5–10 min static stretching):**\n• Hold each stretch 30–45 seconds\n• Focus on muscles just trained\n• Hamstring stretch, hip flexor stretch, chest doorway stretch, quad stretch, lat stretch\n\n**Weekly mobility routine (pick 1–2 sessions):**\n• Yoga (even 20 min on YouTube counts)\n• Foam rolling — quads, IT band, lats, thoracic spine (2 min per area)\n• Deep squat hold — sit in a deep squat for 2–3 min daily\n• Wall slides — great for shoulder health and posture\n\nIf you sit at a desk all day, hip flexors, chest, and upper traps get tight. Prioritize stretching those areas to prevent the 'desk posture' slouch.",
    ],
  },
  // ════════════ WEIGHT / SCALE ════════════
  {
    id: 'scale',
    patterns: [/scale/i, /weigh\s*(myself|in)/i, /weight\s*fluctuat/i, /gain.*overnight/i, /water\s*weight/i, /bloat/i, /sodium/i, /retain/i],
    responses: [
      "Scale weight is one of the most misunderstood metrics in fitness. Here's what you need to know:\n\n**Daily fluctuations of 1–5 lbs are completely normal.** Causes include:\n• Sodium intake (high sodium = water retention)\n• Carb intake (each gram of carbs holds 3g of water)\n• Hydration level\n• Stress and cortisol\n• Menstrual cycle (can cause 3–7 lb swings)\n• Bowel contents (yes, really)\n• Alcohol (dehydrates, then rehydrates = big swing)\n\n**How to weigh yourself properly:**\n• Same time daily (morning, after bathroom, before eating/drinking)\n• Take the weekly average, not individual readings\n• Compare weekly averages to see the real trend\n• Don't react to a single day's number\n\n**The scale doesn't tell the full story.** If you're strength training while eating in a deficit, you might be gaining muscle and losing fat simultaneously — the scale barely moves but you look dramatically different. Use multiple metrics: scale weight, measurements (waist, hips, arms), progress photos (same lighting, same angle), how clothes fit, and strength in the gym.",
    ],
  },
  // ════════════ TASKS / HABITS / GOALS ════════════
  {
    id: 'tasks',
    patterns: [/task/i, /habit/i, /daily\s*(routine|task|habit)/i, /assign/i, /challenge/i, /goal/i, /recommend/i, /what\s*should\s*i\s*do/i, /where.*start/i, /beginner/i, /first\s*step/i, /getting\s*started/i, /new\s*to/i, /help\s*me\s*(start|begin|plan)/i],
    responses: [
      "Here are daily habits that will transform your health, ranked by impact:\n\n**Tier 1 — Non-negotiable foundations:**\n• Eat protein at every meal (aim for 25–30g per meal)\n• Drink at least 64 oz of water throughout the day\n• Walk 7,000+ steps\n• Sleep 7–9 hours\n\n**Tier 2 — Accelerators:**\n• Strength train 3–4× per week\n• Track your meals (even rough estimates help)\n• Eat vegetables at 2+ meals\n• Limit alcohol to 2 or fewer drinks per week\n\n**Tier 3 — Optimization:**\n• 5–10 min morning stretching or mobility\n• Take creatine (5g daily)\n• Eat whole food sources for 80%+ of your diet\n• Practice 5 minutes of mindfulness or deep breathing\n\nStart with just 2–3 habits from Tier 1. Once those feel automatic (usually 2–3 weeks), add one more. Building habits gradually sticks far better than trying to overhaul everything overnight.",
      "Great that you want actionable tasks! Here's my recommended starting framework based on where most people see the biggest return:\n\n**This week, focus on these 3 things:**\n1. Log every meal in the app (awareness is the first step to change)\n2. Drink a glass of water before every meal\n3. Move for at least 20 minutes daily (walk, workout, whatever you enjoy)\n\n**Why these three?** Meal logging builds awareness of what and how much you eat. Pre-meal water reduces overeating by 20–30%. Daily movement establishes the exercise habit without being overwhelming.\n\nOnce these feel easy, we'll level up: protein targets, structured workouts, and sleep optimization. But master the basics first. The temptation is always to skip ahead — resist it. Fundamentals > fancy stuff.",
      "Let me create a personalized starting plan:\n\n**Morning routine (10 min):**\n✅ Drink 16 oz water immediately\n✅ 5-minute stretch or movement\n✅ High-protein breakfast\n\n**Throughout the day:**\n✅ Log all meals and snacks\n✅ Hit your water target\n✅ Take a 10-min walk after lunch\n\n**Evening routine:**\n✅ Prepare tomorrow's meals/snacks\n✅ 10-min stretch or foam roll\n✅ Screens off 30 min before bed\n✅ Reflect: what went well today?\n\nThis might look like a lot, but each item takes only a few minutes. The compound effect of nailing these daily habits over weeks and months is genuinely life-changing. Start today.",
    ],
  },
  // ════════════ ALCOHOL ════════════
  {
    id: 'alcohol',
    patterns: [/alcohol/i, /beer/i, /wine/i, /drink(ing|s)?\s*(alcohol|beer|wine)/i, /cocktail/i, /booze/i, /liquor/i],
    responses: [
      "Here's how alcohol affects your fitness goals:\n\n**The facts:**\n• Alcohol has 7 cal/gram (almost as much as fat at 9 cal/gram)\n• A single beer is 150 cal, glass of wine 125 cal, cocktail 200–400 cal\n• Alcohol impairs muscle protein synthesis for up to 24 hours\n• It disrupts sleep quality (you pass out but don't get deep sleep)\n• Increases cortisol and lowers testosterone\n• Reduces inhibitions → late-night food decisions get worse\n\n**If you still want to drink (moderation tips):**\n• Limit to 1–2 drinks, 1–2 times per week max\n• Choose lower-calorie options: light beer, dry wine, spirits with zero-cal mixers\n• Eat a high-protein meal before drinking (slows absorption)\n• Alternate every alcoholic drink with a glass of water\n• Account for the calories in your daily budget\n• Avoid drinking the night before training days\n\nYou don't have to quit alcohol entirely to reach your goals, but reducing it is one of the highest-impact changes most people can make. The calories, sleep disruption, and next-day food choices add up quickly.",
    ],
  },
  // ════════════ INJURIES / PAIN ════════════
  {
    id: 'injury',
    patterns: [/injur/i, /pain/i, /hurt/i, /ache/i, /knee/i, /back\s*(pain|hurt|injur)/i, /shoulder\s*(pain|hurt|injur)/i, /sprain/i, /strain/i, /doctor/i, /physical\s*therap/i],
    responses: [
      "I'm not a medical professional, so I can't diagnose injuries — please see a doctor or physical therapist for persistent pain. That said, here's general guidance:\n\n**RICE protocol for acute injuries:**\n• **R**est — stop the activity that causes pain\n• **I**ce — 15–20 min on, 20 min off for first 48 hours\n• **C**ompression — wrap to reduce swelling\n• **E**levation — keep above heart level when possible\n\n**When to see a doctor:**\n• Pain persists more than 1–2 weeks\n• Sharp or stabbing pain during movement\n• Swelling that doesn't go down\n• Numbness, tingling, or weakness\n• You heard a pop or crack during exercise\n\n**General training around injuries:**\n• Train muscles that don't aggravate the injury\n• Reduce load/intensity on affected areas\n• Focus on mobility and rehabilitation exercises\n• Pain-free range of motion is okay, pushing through sharp pain is not\n\nThe biggest mistake: ignoring pain and training through it. A small issue managed early takes 1–2 weeks to heal. That same issue ignored can become a 2–6 month problem.",
    ],
  },
  // ════════════ BODY FAT / BODY COMPOSITION ════════════
  {
    id: 'body_comp',
    patterns: [/body\s*fat/i, /body\s*comp/i, /lean/i, /abs/i, /six.?pack/i, /shredded/i, /how.*look.*lean/i, /skinny.?fat/i, /recomp/i, /toned/i],
    responses: [
      "Body composition is about the ratio of muscle to fat — not just your total weight. Here's the reality:\n\n**Body fat percentage benchmarks:**\n• Men: 10–15% = lean/visible abs, 15–20% = fit/athletic, 20–25% = average\n• Women: 18–23% = lean/visible abs, 23–28% = fit/athletic, 28–33% = average\n\n**To get leaner:**\n• You need a calorie deficit (no way around this)\n• Prioritize strength training to maintain muscle\n• Eat high protein (1g per lb bodyweight)\n• Be patient — healthy fat loss is 0.5–1 lb per week\n\n**Body recomposition (lose fat + gain muscle simultaneously):**\n• Possible for beginners, overweight individuals, or people returning after a break\n• Eat at maintenance or a slight deficit\n• Train hard with progressive overload\n• Get 1g protein per lb bodyweight\n• Results are slower but you won't need to bulk and cut\n\n**'Skinny fat' fix:**\n• Focus on building muscle first, not cutting calories\n• Eat at maintenance or slight surplus with high protein\n• Strength train 3–4× per week consistently\n• Once you have a muscular base, then cut to reveal it\n\nRemember: 'toned' just means muscle with low body fat. You can't 'tone' without building muscle first.",
    ],
  },
  // ════════════ WOMEN-SPECIFIC ════════════
  {
    id: 'women',
    patterns: [/women|woman|female/i, /period|menstrual|pms|cycle/i, /pregnan/i, /menopause/i, /hormones?\b/i, /pcos/i, /birth\s*control/i],
    responses: [
      "Training and nutrition considerations that are specific to women's physiology:\n\n**Menstrual cycle and training:**\n• **Follicular phase** (days 1–14): Higher estrogen, better recovery, strength peaks. Great time to push hard in training.\n• **Ovulation** (day 14ish): Peak strength but slightly higher injury risk for ligaments. Warm up well.\n• **Luteal phase** (days 15–28): Progesterone rises, body temp increases, metabolism is slightly higher (~100–300 extra cal/day). You may feel more tired and hungry. Focus on moderate training, be compassionate with yourself.\n• **During your period:** Train if you feel okay. Light-to-moderate exercise can actually reduce cramps. Don't force intensity if you feel awful — listen to your body.\n\n**General:** Women don't need to train differently than men — the same principles apply (progressive overload, adequate protein, compound lifts). The myth that heavy weights make women 'bulky' is false. Women have ~10–20× less testosterone than men, making significant muscle gain very slow.\n\nProtein needs are similar: 0.7–1g per pound of bodyweight. If anything, many women undereat protein — this is the single most impactful change for body composition.",
    ],
  },
  // ════════════ AGE-RELATED ════════════
  {
    id: 'age',
    patterns: [/too\s*old/i, /age/i, /over\s*(40|50|60)/i, /older/i, /senior/i, /joint/i, /arthritis/i],
    responses: [
      "You are absolutely not too old to get fit. Research consistently shows that people of any age can build muscle, lose fat, and dramatically improve their health. Here's how to approach fitness as you get older:\n\n**Adjustments, not excuses:**\n• **Warm up more thoroughly** — 10 min vs 5 min when younger\n• **Prioritize joint health** — use full range of motion, include mobility work\n• **Allow more recovery** — you might need 48–72 hours between training the same muscle\n• **Focus on compound movements** — squats, presses, rows, deadlifts (with appropriate weight)\n• **Don't skip protein** — protein needs actually *increase* with age due to anabolic resistance. Aim for 1g per lb.\n• **Prioritize balance and stability** — single-leg exercises, core work\n\n**What the science says:**\n• Strength training can reverse up to 20 years of muscle loss\n• It improves bone density (critical for preventing osteoporosis)\n• It enhances insulin sensitivity, heart health, and cognitive function\n• People who start strength training in their 60s and 70s still see significant gains\n\nThe best time to start was 20 years ago. The second best time is today.",
    ],
  },
  // ════════════ TIME / BUSY SCHEDULE ════════════
  {
    id: 'busy',
    patterns: [/no\s*time/i, /busy/i, /schedule/i, /quick\s*workout/i, /short.*workout/i, /don'?t\s*have\s*time/i, /minutes/i, /efficient/i, /time.*gym/i],
    responses: [
      "Time constraints are the #1 reason people skip training, but you need way less time than you think. Here are effective workouts for any schedule:\n\n**10 minutes (better than nothing!):**\n5 rounds of: 10 push-ups, 10 squats, 10 lunges, 30-sec plank. No rest between exercises, 30 sec between rounds.\n\n**20 minutes (solid session):**\nSuperset format — 4 rounds of:\n• A1: Goblet squat × 10 / A2: Push-ups × 10\n• B1: Romanian deadlift × 10 / B2: Bent-over row × 10\n• Finisher: 30-sec burpees\n\n**30 minutes (full workout):**\n• Squat — 3×8\n• Bench press — 3×8\n• Row — 3×8\n• Overhead press — 2×10\n• Bicep curl — 2×12\n• Tricep pushdown — 2×12\n\n**Time-saving tips:**\n• Superset exercises (do two exercises back-to-back)\n• Reduce rest periods (60 sec instead of 90)\n• Use compound movements (work multiple muscles at once)\n• Home workouts eliminate commute time\n• Even 10 min of movement beats zero minutes\n\nYou don't need an hour. You need 20–30 focused minutes, 3–4 times per week. That's less than 2% of your week.",
    ],
  },
  // ════════════ HOME WORKOUTS ════════════
  {
    id: 'home',
    patterns: [/home\s*workout/i, /no\s*(gym|equipment)/i, /bodyweight/i, /at\s*home/i, /without\s*(gym|equipment|weight)/i, /calisthenics/i, /no\s*equipment/i],
    responses: [
      "You can build an incredible physique with just bodyweight or minimal equipment. Here's a complete home workout plan:\n\n**Push (Mon/Thu):**\n• Push-ups — 4×max reps (elevate feet for harder, incline for easier)\n• Pike push-ups — 3×8–12 (overhead press substitute)\n• Diamond push-ups — 3×10–15\n• Dips (between chairs) — 3×8–12\n• Plank — 3×45–60 sec\n\n**Pull (Tue/Fri):** (need a pull-up bar or sturdy door)\n• Pull-ups/chin-ups — 4×max reps\n• Inverted rows (under a table) — 3×10–15\n• Towel curls (isometric) — 3×30 sec\n• Superman hold — 3×30 sec\n\n**Legs (Wed/Sat):**\n• Bulgarian split squats — 4×10 each leg\n• Squat jumps — 3×15\n• Single-leg Romanian deadlift — 3×12 each\n• Wall sit — 3×45–60 sec\n• Calf raises (on a step) — 3×20\n\n**Upgrades on a budget:** A set of resistance bands ($15–30) and a pull-up bar ($25) will multiply what you can do at home by 10×.",
    ],
  },
  // ════════════ GREETINGS ════════════
  {
    id: 'greeting',
    patterns: [/^(hello|hi|hey|yo|sup|hola|howdy)\b/i, /good\s*(morning|afternoon|evening|day)/i, /what'?s?\s*up/i, /how\s*are\s*you/i, /how'?s\s*it\s*going/i],
    responses: [
      "Hey! Great to see you. I'm here to help with anything — nutrition plans, workout advice, habit building, weight loss strategies, or just motivation when you need it. What's on your mind today?",
      "Hi there! Whether you need a meal idea, workout plan, or just someone to help you stay accountable, I've got you. What would you like to work on?",
      "Hello! Ready to make today count? I can help with meals, workouts, habits, macros, supplements, or anything health and fitness related. What can I do for you?",
      "Hey! How's your day going? Let me know how I can help — I'm great with nutrition questions, workout planning, habit building, or just general fitness advice.",
    ],
  },
  // ════════════ THANKS ════════════
  {
    id: 'thanks',
    patterns: [/thank/i, /thanks/i, /thx/i, /appreciate/i, /helpful/i, /awesome/i, /amazing\s*advice/i, /great\s*(tip|advice|help)/i],
    responses: [
      "You're welcome! That's exactly what I'm here for. Remember, showing up and asking questions is already proof you're committed. If anything else comes up, I'm always here. Keep crushing it! 💪",
      "Anytime! The fact that you're investing in learning about your health puts you ahead of most people. Keep that momentum going — and don't hesitate to ask more questions whenever they come up!",
      "Happy to help! Knowledge is power, especially when it comes to fitness. The more you understand, the better your results will be. Come back anytime you need advice or a push in the right direction.",
    ],
  },
  // ════════════ IDENTITY / ABOUT COACH ════════════
  {
    id: 'identity',
    patterns: [/who\s*are\s*you/i, /what\s*are\s*you/i, /tell\s*me\s*about\s*(yourself|you)/i, /are\s*you\s*(real|human|ai|robot|bot)/i, /what\s*can\s*you\s*do/i, /how\s*do\s*you\s*work/i, /your\s*name/i],
    responses: [
      "I'm your personal fitness and nutrition coach, powered by advanced AI trained on thousands of hours of exercise science, sports nutrition, and behavioral psychology research. I can help you with:\n\n• Personalized meal planning and nutrition advice\n• Workout programming and exercise guidance\n• Habit building and daily task recommendations\n• Weight loss, muscle building, or body recomposition strategies\n• Supplement recommendations\n• Motivation and mindset coaching\n• Recovery and sleep optimization\n• Answering any health and fitness questions\n\nThink of me as a knowledgeable friend who's always available to give you evidence-based advice. Ask me anything!",
    ],
  },
  // ════════════ WEIGHT MAINTENANCE ════════════
  {
    id: 'maintain',
    patterns: [/maintain/i, /keep.*weight/i, /maintenance/i, /not.*gain.*back/i, /sustain/i, /long\s*term/i, /lifestyle/i],
    responses: [
      "Maintaining weight loss is actually harder than losing it — research shows 80% of people regain. Here's how to be in the 20%:\n\n**Keys to long-term maintenance:**\n1. **Find your new maintenance calories** — reverse diet slowly (add 50–100 cal/week) until weight stabilizes\n2. **Keep weighing yourself** — weekly weigh-ins catch small gains before they become big ones. Set a 5-lb 'action threshold.'\n3. **Maintain your protein intake** — don't let it drop just because you hit your goal\n4. **Keep exercising** — especially strength training. Muscle is metabolically active and keeps your TDEE higher\n5. **Stay flexible but aware** — you don't need to track forever, but periodic check-ins keep you honest\n6. **Have a plan for setbacks** — holidays, vacations, stress. Know in advance that weight will fluctuate and have a plan to get back on track\n7. **Build identity, not just habits** — think of yourself as 'someone who exercises and eats well' rather than 'someone on a diet'\n\nMaintenance isn't a destination — it's a continued practice that gets easier over time as these behaviors become your default.",
    ],
  },
  // ════════════ VEGETARIAN / VEGAN ════════════
  {
    id: 'vegan',
    patterns: [/vegan/i, /vegetarian/i, /plant.?based/i, /no\s*meat/i, /meatless/i, /tofu/i, /tempeh/i],
    responses: [
      "You can absolutely hit your fitness goals on a plant-based diet. Here's how to make it work:\n\n**Protein sources (aim to combine throughout the day for complete amino acid profile):**\n• Tofu — 20g protein per cup (versatile, absorbs any flavor)\n• Tempeh — 31g protein per cup (fermented, great gut health)\n• Lentils — 18g per cup cooked (also high in fiber and iron)\n• Chickpeas — 15g per cup (hummus, bowls, salads)\n• Edamame — 17g per cup\n• Seitan — 25g per 3.5 oz (made from wheat gluten, meaty texture)\n• Protein powder — pea or soy protein (25–30g per scoop)\n• Quinoa — 8g per cup (complete protein grain)\n\n**Key nutrients to watch on plant-based diets:**\n• **B12** — supplement this (not found reliably in plant foods)\n• **Iron** — eat with vitamin C sources to boost absorption\n• **Omega-3** — algae-based EPA/DHA supplement\n• **Zinc** — beans, nuts, seeds, fortified foods\n• **Calcium** — fortified plant milk, tofu, leafy greens\n\nHit 1g protein per pound of bodyweight using a variety of sources throughout the day, and you'll build muscle just as effectively as meat-eaters.",
    ],
  },
  // ════════════ KETO / LOW CARB ════════════
  {
    id: 'keto',
    patterns: [/keto/i, /low\s*carb/i, /carb\s*(cut|restrict|limit)/i, /no\s*carb/i, /atkins/i, /ketosis/i, /ketone/i],
    responses: [
      "Here's an evidence-based take on keto and low-carb diets:\n\n**How keto works:** By restricting carbs to ~20–50g/day, your body enters ketosis — burning fat for fuel instead of glucose. Standard keto macros: 70–75% fat, 20–25% protein, 5–10% carbs.\n\n**Pros:**\n• Effective for fat loss (mainly through appetite suppression → eating less)\n• Can improve insulin sensitivity\n• Some people report better mental clarity\n• Reduces cravings once adapted (2–4 weeks)\n\n**Cons:**\n• The 'keto flu' during adaptation (fatigue, headaches, brain fog for 1–2 weeks)\n• Difficult to maintain long-term for most people\n• Can impair high-intensity exercise performance\n• Hard to eat out or socially\n• Easy to overeat calories from fat\n\n**The truth:** Keto isn't magic — it works because it helps people eat fewer calories by eliminating entire food categories and reducing appetite. If you enjoy it and can stick with it, great. If not, a moderate low-carb approach (100–150g carbs) gives many of the same benefits with more flexibility and sustainability.\n\nFor athletic performance and muscle building, moderate carbs are generally superior.",
    ],
  },
  // ════════════ MEAL TIMING ════════════
  {
    id: 'meal_timing',
    patterns: [/when.*eat/i, /meal\s*timing/i, /how\s*(often|many\s*times).*eat/i, /eat\s*before\s*(bed|sleep)/i, /pre.?workout\s*(meal|food|eat)/i, /post.?workout\s*(meal|food|eat)/i, /before.*gym/i, /after.*gym/i, /number\s*of\s*meals/i],
    responses: [
      "Meal timing is less important than total daily intake, but it can make a difference. Here's the breakdown:\n\n**Meal frequency:** 3–5 meals per day is optimal for most people. No need for 6+ small meals — that's an outdated myth. Pick what fits your schedule.\n\n**Pre-workout (1–2 hours before):**\nGoal: quick energy + some protein\n• Banana + protein shake\n• Toast + eggs\n• Oatmeal + protein powder\n• Rice cake + peanut butter\nAvoid high fat/fiber right before (slow digestion → stomach issues)\n\n**Post-workout (within ~2 hours):**\nGoal: protein for recovery + carbs to replenish\n• Protein shake + banana\n• Chicken + rice\n• Greek yogurt + granola\nThe 'anabolic window' exists but it's wider than the old 30-minute myth\n\n**Eating before bed:**\nIt's fine! Late-night eating doesn't inherently cause fat gain — total daily calories matter more. If anything, a high-protein snack before bed (casein, cottage cheese) can actually *improve* overnight muscle recovery.\n\nBottom line: focus on hitting your daily calorie and protein targets. Whether you eat 3 big meals or 5 smaller ones is personal preference.",
    ],
  },
  // ════════════ WEIGHT GAIN (UNDERWEIGHT) ════════════
  {
    id: 'underweight',
    patterns: [/too\s*(skinny|thin|light)/i, /underweight/i, /can'?t\s*gain/i, /hard\s*gainer/i, /eat\s*more/i, /not\s*enough.*eat/i, /increase.*appetite/i],
    responses: [
      "If you're struggling to gain weight, you're likely not eating as much as you think. Here's a practical approach:\n\n**Increase calories without feeling stuffed:**\n• Drink your calories — smoothies with milk, protein powder, banana, oats, nut butter (600+ cal each)\n• Add calorie-dense foods: olive oil (120 cal/tbsp), nuts (170 cal/handful), avocado (250 cal each)\n• Eat more frequently — add a 4th or 5th meal/snack\n• Use larger plates and bowls (psychological trick that works)\n\n**High-calorie meals:**\n• Peanut butter banana smoothie: 2 scoops whey, banana, 2 tbsp PB, milk, oats = 700 cal\n• Rice bowl: 1.5 cups rice, 6 oz chicken thigh, avocado, sauce = 800 cal\n• Pasta: 2 cups pasta, meat sauce, olive oil, parmesan = 900 cal\n\n**Training:** Focus on compound lifts to stimulate overall muscle growth — squat, bench, deadlift, overhead press, row. Train 3–4× per week with progressive overload.\n\nTrack your calories for at least a week. If you're not gaining weight, add 250–300 cal and reassess after 2 weeks. Most 'hard gainers' simply aren't eating enough once they actually count.",
    ],
  },
  // ════════════ ACCOUNTABILITY / TRACKING ════════════
  {
    id: 'tracking',
    patterns: [/track/i, /log/i, /app.*track/i, /measure.*progress/i, /accountability/i, /how.*know.*progress/i, /monitor/i],
    responses: [
      "Tracking is the single most powerful habit for reaching any fitness goal. Here's what and how to track:\n\n**Daily tracking (takes 5 min):**\n• Meals — log everything you eat (even rough estimates). Use this app!\n• Water — aim for your target and track glasses\n• Steps — wear a tracker or use your phone\n\n**Weekly tracking:**\n• Weight — same day, same time, fasted. Use the weekly average.\n• Progress photos — front, side, back in same lighting and clothing\n• Measurements — waist, hips, chest, arms (monthly is fine)\n\n**Training tracking:**\n• Record exercises, sets, reps, and weight for every workout\n• This is how you ensure progressive overload\n\n**Why it works:** 'What gets measured gets managed.' People who track their food eat 15–20% fewer calories without even trying — just the act of logging creates awareness. And tracking your lifts ensures you're actually progressing, not just going through the motions.\n\nYou don't have to track forever. Usually 3–6 months of consistent tracking builds enough intuition to eyeball portions and know roughly what you're eating.",
    ],
  },
  // ════════════ MISC / CONVERSATIONAL ════════════
  {
    id: 'yes_no',
    patterns: [/^(yes|yeah|yep|yup|sure|ok|okay|no|nope|nah|maybe)\s*$/i],
    responses: [
      "Got it! Is there anything specific you'd like help with? I'm here for nutrition advice, workout plans, habit building, or any health and fitness questions.",
      "Alright! Feel free to ask me anything — meal ideas, exercise tips, how to break a plateau, supplement questions — whatever's on your mind.",
    ],
  },
  {
    id: 'unclear',
    patterns: [/^.{1,5}$/i, /^(hmm|huh|idk|dunno|what)\s*$/i, /\?$/],
    responses: [
      "I'd love to help! Could you tell me a bit more? For example, I can assist with:\n• Meal planning and nutrition advice\n• Workout routines for any fitness level\n• Weight loss or muscle gain strategies\n• Daily habit recommendations\n• Supplement guidance\n• Motivation and mindset tips\n\nWhat sounds most useful to you right now?",
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// VARIABLE POOLS — randomly sampled into templates for millions
// of unique combinations
// ═══════════════════════════════════════════════════════════════════

export const POOLS = {
  protein: [
    'chicken breast', 'salmon', 'Greek yogurt', 'eggs', 'turkey breast',
    'tofu', 'lean ground beef', 'cottage cheese', 'tuna', 'shrimp',
    'tempeh', 'lentils', 'cod', 'sardines', 'bison',
    'pork tenderloin', 'edamame', 'chickpeas', 'whey protein shake',
    'egg whites', 'tilapia', 'black beans', 'seitan', 'venison',
  ],
  veggie: [
    'broccoli', 'spinach', 'asparagus', 'bell peppers', 'kale',
    'zucchini', 'cauliflower', 'green beans', 'Brussels sprouts',
    'mixed greens', 'cucumber', 'tomatoes', 'sweet potato', 'carrots',
    'mushrooms', 'snap peas', 'bok choy', 'arugula', 'celery',
    'roasted beets', 'sautéed onions', 'steamed cabbage',
  ],
  carb: [
    'brown rice', 'quinoa', 'oatmeal', 'sweet potato', 'whole grain bread',
    'whole wheat pasta', 'white rice', 'potatoes', 'couscous', 'barley',
    'buckwheat', 'rice cakes', 'corn tortilla', 'farro', 'millet',
    'whole grain wrap', 'sourdough bread', 'fruit', 'beans',
  ],
  fat: [
    'avocado', 'olive oil', 'almonds', 'walnuts', 'peanut butter',
    'almond butter', 'chia seeds', 'flaxseeds', 'cashews', 'pecans',
    'coconut oil', 'macadamia nuts', 'hemp seeds', 'pumpkin seeds',
    'tahini', 'sunflower seeds', 'dark chocolate', 'pistachios',
  ],
  compound: [
    'squats', 'deadlifts', 'bench press', 'overhead press', 'barbell rows',
    'pull-ups', 'lunges', 'hip thrusts', 'dips', 'chin-ups',
    'front squats', 'Romanian deadlifts', 'incline bench press',
    'Bulgarian split squats', 'pendlay rows', 'leg press',
    'close-grip bench press', 'sumo deadlifts', 'landmine press',
  ],
  isolation: [
    'bicep curls', 'tricep pushdowns', 'lateral raises', 'leg curls',
    'leg extensions', 'calf raises', 'face pulls', 'cable flyes',
    'hammer curls', 'rear delt flyes', 'concentration curls',
    'skull crushers', 'preacher curls', 'cable kickbacks',
  ],
  cardio_type: [
    'walking', 'running', 'cycling', 'swimming', 'jump rope',
    'rowing', 'hiking', 'dancing', 'elliptical', 'stair climbing',
    'boxing', 'jogging', 'incline treadmill walking', 'kayaking',
    'trail running', 'basketball', 'tennis', 'soccer',
  ],
  snack: [
    'Greek yogurt with berries', 'apple slices with almond butter',
    'a handful of mixed nuts', 'string cheese and turkey slices',
    'hard-boiled eggs', 'protein shake', 'cottage cheese with fruit',
    'hummus with veggie sticks', 'rice cakes with peanut butter',
    'a banana with a handful of walnuts', 'edamame',
    'beef or turkey jerky', 'trail mix (small handful)',
    'celery with cream cheese', 'protein bar',
  ],
  meal_quick: [
    'a protein smoothie with banana, spinach, and peanut butter',
    'scrambled eggs with toast and avocado',
    'a turkey and hummus wrap with veggies',
    'tuna salad on whole grain crackers',
    'a grain bowl with rice, chicken, and roasted veggies',
    'overnight oats with protein powder and berries',
    'a quick stir-fry with whatever veggies you have on hand',
    'Greek yogurt parfait with granola and mixed berries',
    'a chicken quesadilla with black beans and salsa',
    'an egg muffin with spinach, cheese, and peppers',
    'a simple salad with grilled protein and vinaigrette',
    'leftover dinner reheated (meal prep is king)',
  ],
  sleep_tip: [
    'keep your bedroom cool (65–68°F)', 'use blackout curtains or an eye mask',
    'avoid screens 30–60 minutes before bed', 'no caffeine after 2 PM',
    'go to bed and wake up at the same time every day',
    'try magnesium glycinate (200–400mg) before bed',
    'avoid heavy meals within 2 hours of bedtime',
    'use white noise or earplugs if your environment is noisy',
    'keep your phone outside the bedroom',
    'read a physical book instead of scrolling before sleep',
    'take a warm shower 90 minutes before bed',
    'practice 5 minutes of deep breathing or meditation',
  ],
  motivation_line: [
    'The only workout you regret is the one you didn\'t do.',
    'You don\'t have to be extreme, just consistent.',
    'Progress isn\'t always visible — but it\'s always happening.',
    'Discipline is choosing between what you want now and what you want most.',
    'You\'re lapping everyone who stayed on the couch.',
    'It doesn\'t get easier — you get stronger.',
    'Six months from now, you\'ll wish you had started today.',
    'Small daily improvements are the key to staggering long-term results.',
    'Your body can stand almost anything. It\'s your mind you have to convince.',
    'Success is the sum of small efforts repeated day in and day out.',
    'Be patient with yourself. Self-growth is tender.',
    'You are one workout away from a good mood.',
    'Don\'t compare your chapter 1 to someone else\'s chapter 20.',
    'The best project you\'ll ever work on is you.',
    'Fall in love with the process and the results will follow.',
  ],
  habit_action: [
    'drink a full glass of water first thing in the morning',
    'take a 10-minute walk after lunch',
    'eat protein within an hour of waking up',
    'do 10 push-ups before your morning shower',
    'pack your gym bag the night before',
    'prep tomorrow\'s lunch right after dinner',
    'stretch for 5 minutes before bed',
    'track every meal in the app today',
    'replace one processed snack with fruit or nuts',
    'go to bed 30 minutes earlier tonight',
    'do a 5-minute plank and squat challenge',
    'take the stairs instead of the elevator',
    'add an extra serving of vegetables to one meal',
    'drink a glass of water before every meal',
    'set a phone reminder to move every hour',
    'write down 3 things you\'re grateful for before bed',
    'try a new healthy recipe this week',
    'cold shower for 30 seconds after your normal shower',
  ],
  timeframe: [
    '2–3 weeks', '3–4 weeks', 'about a month', '4–6 weeks',
    '6–8 weeks', '2–3 months', '8–12 weeks', 'a few weeks',
  ],
  deficit_range: [
    '300–500', '350–500', '300–450', '400–500', '300–400',
  ],
  surplus_range: [
    '200–300', '200–400', '250–350', '300–400', '150–300',
  ],
  protein_target: [
    '0.8–1g per pound of bodyweight',
    '1g per pound of your goal weight',
    '0.7–1g per pound',
    'about 130–160g daily',
    'at least 100–120g depending on your size',
  ],
  step_target: [
    '7,000–10,000 steps', '8,000–10,000 steps', '7,500+ steps',
    'at least 7,000 steps', '8,000+ steps', '10,000 steps',
  ],
  rep_range: [
    '6–10 reps', '8–12 reps', '6–12 reps', '8–10 reps', '10–15 reps',
  ],
  set_range: [
    '3–4 sets', '3 sets', '4 sets', '3–5 sets',
  ],
  sleep_hours: [
    '7–9 hours', '7–8 hours', '8–9 hours', 'at least 7 hours', '7+ hours',
  ],
  water_amount: [
    'half your bodyweight (in lbs) in ounces',
    'at least 64 oz (about 2 liters)',
    '80–100 oz',
    'about 2.5–3 liters',
    'a minimum of 8 glasses',
  ],
  greeting_time: [
    'today', 'right now', 'this session', 'at the moment',
  ],
  coach_sign: [
    '💪', '🔥', '✅', '⭐', '👊', '🎯', '🏆',
  ],
};

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE RESPONSES — use {variable} placeholders that get filled
// from POOLS above. Each template × pool permutations = thousands.
// ═══════════════════════════════════════════════════════════════════

export const TEMPLATES = {
  lose_weight: [
    "For fat loss, create a calorie deficit of {deficit_range} calories below maintenance. Prioritize {protein} and {protein} as your main protein sources — aim for {protein_target}. Fill your plate with {veggie} and {veggie} for volume and fiber. Walk {step_target} daily, lift weights 3–4× per week, and get {sleep_hours} of sleep. Weigh yourself weekly under consistent conditions and adjust after {timeframe} if the trend isn't moving.",
    "The key to sustainable weight loss is consistency over intensity. Start with these actionable steps: (1) eat {protein} or {protein} at every meal for satiety, (2) add {veggie} and {veggie} to lunch and dinner for fiber, (3) walk {step_target} daily — it's the most underrated fat-loss habit, and (4) target a {deficit_range} calorie deficit. Crash diets backfire. Slow and steady wins this race.",
    "Here's a practical fat-loss plate: a palm-sized portion of {protein}, a fist of {carb}, and half the plate filled with {veggie} and {veggie}. Add a thumb-sized portion of {fat} for healthy fats. That's roughly 400–550 calories of satisfying, nutrient-dense food. Eat 3–4 meals like this daily, walk {step_target}, and let the deficit do the work over {timeframe}.",
    "Losing fat isn't about eating less of everything — it's about eating more of the right things. {protein} and {protein} are your best friends because protein has the highest thermic effect (your body burns 20–30% of protein calories just digesting it). Pair them with {carb} for energy and {veggie} for micronutrients. A {deficit_range} cal deficit + {step_target} daily + {sleep_hours} of sleep = steady, sustainable fat loss.",
  ],
  gain_muscle: [
    "To build muscle effectively, eat in a surplus of {surplus_range} calories above maintenance. Prioritize {protein} and {protein} to hit {protein_target}. Build your workouts around {compound} and {compound} — do {set_range} of {rep_range} and focus on adding weight or reps each week. Supplement with {isolation} and {isolation} for balanced development. Sleep {sleep_hours} for recovery. Real gains take {timeframe} of consistent effort.",
    "Muscle growth requires eating enough, training hard, and recovering well. Start each workout with {compound} and {compound}, then add {isolation} and {isolation} — {set_range} of {rep_range} for each. Eat {surplus_range} calories above maintenance with {protein_target} from sources like {protein}, {protein}, and {protein}. Creatine (5g daily) is the most proven muscle-building supplement. Be patient — expect visible changes in {timeframe}.",
    "Here's a proven approach: train each muscle 2× per week using compound movements like {compound}, {compound}, and {compound} as your foundation. Do {set_range} of {rep_range} and progressively overload. Eat at surplus ({surplus_range} cal extra) with {protein_target}, focusing on {protein} and {protein} as main protein sources. {carb} and {carb} for energy. Sleep {sleep_hours}. Track your lifts and nutrition religiously.",
  ],
  meal_ideas: [
    "Here's a full day of solid eating:\n\n**Breakfast:** {protein} with {carb} and a piece of fruit\n**Lunch:** {protein} over {veggie} and {veggie} with {fat} and your favorite dressing\n**Dinner:** {protein} with {carb} and roasted {veggie}\n**Snack:** {snack}\n\nAdjust portions to your calorie target. The key is protein at every meal and vegetables at least twice a day.",
    "Quick, no-fuss meals I'd recommend:\n\n• **5-minute option:** {meal_quick}\n• **Meal prep winner:** {meal_quick}\n• **Satisfying dinner:** {protein} with {carb} and {veggie}\n• **Smart snack:** {snack}\n\nThe simpler your meals, the more likely you'll stick with them. Don't overcomplicate nutrition — pick foods you enjoy that align with your goals.",
    "Build every meal using this template: **protein** ({protein} or {protein}) + **carb** ({carb} or {carb}) + **veggie** ({veggie}, {veggie}) + a small serving of **fat** ({fat}). That's a balanced, satisfying meal every single time. For snacks, go with {snack} or {snack}. Meal prep Sunday to set yourself up for the week.",
  ],
  protein: [
    "Great protein sources to rotate through: {protein}, {protein}, {protein}, and {protein}. Aim for {protein_target} spread across 3–5 meals. Each meal should have roughly 25–40g of protein. If you struggle to hit your target, a whey or plant protein shake with {snack} makes a great bridge between meals.",
    "Protein is the #1 macro for both fat loss AND muscle gain. It keeps you full, preserves muscle, and has the highest thermic effect. My top picks: {protein} and {protein} for main meals, {protein} for convenience, and {snack} as a high-protein snack. Hit {protein_target} daily for optimal results.",
  ],
  workout: [
    "Here's a solid routine:\n\nStart with compound movements — {compound} and {compound} for {set_range} of {rep_range}. Then add {compound} and {isolation} for balanced development. Finish with {isolation} for {set_range} of {rep_range}. Rest 60–90 seconds between sets. The goal: progressive overload. Add weight, reps, or sets every week. Train 3–4× per week and you'll see real changes in {timeframe}.",
    "The foundation of any good program is compound lifts. Here's your big three for the day: {compound}, {compound}, and {compound} — {set_range} of {rep_range} each. Accessory work: {isolation} and {isolation} for {set_range} of 10–15 reps. Keep rest periods at 60–90 sec. Train each muscle 2× per week with progressive overload and you're golden.",
    "For your next workout, try this:\n\n1. {compound} — {set_range} × {rep_range}\n2. {compound} — {set_range} × {rep_range}\n3. {isolation} — 3 sets × 10–15 reps\n4. {isolation} — 3 sets × 10–15 reps\n5. Core: plank 3 × 45 sec\n\nFocus on controlled reps, full range of motion, and pushing close to failure on your last 1–2 sets. Log everything so you can beat it next time.",
  ],
  cardio: [
    "Here's a smart cardio plan: Walk {step_target} every single day — this is your baseline. Then add 2–3 sessions of something more intense: {cardio_type} or {cardio_type} for 20–30 minutes. If you enjoy {cardio_type}, that works too — the best cardio is the kind you'll actually do. Keep it fun, keep it consistent, and remember: cardio complements strength training, it doesn't replace it.",
    "For fat loss, combine daily {cardio_type} with 2× weekly HIIT sessions. Example HIIT: 30 seconds all-out {cardio_type} / 60 seconds easy recovery × 10–12 rounds. On other days, aim for {step_target} of walking. The hierarchy: daily walking > consistency > intensity > fancy programming.",
  ],
  motivation: [
    "{motivation_line}\n\nI know it can feel like progress is slow, but here's the truth: every single workout, every healthy meal, every glass of water — it all counts. You don't see the compound effect day-to-day, but over {timeframe}, the results are undeniable. The people who transform their bodies aren't superhuman. They just stuck with it when it got hard. You can do this.",
    "Here's some real talk: {motivation_line}\n\nOn tough days, lower the bar. Don't feel like a full workout? Do 10 minutes. Can't eat perfectly? Just hit your protein target. Sometimes showing up at 60% is the bravest thing you can do. One less-than-perfect day doesn't erase your progress. Get back on track with your next meal, your next workout. That's all it takes.",
    "I want to remind you: {motivation_line}\n\nProgress looks different for everyone. Stop comparing your journey to anyone else's. You have different genetics, different schedules, different starting points. The only person you need to be better than is who you were yesterday. And the fact that you're here, working on yourself? That already puts you ahead.",
  ],
  sleep: [
    "Sleep is THE most underrated performance tool. Here's your sleep optimization checklist:\n\n✅ {sleep_tip}\n✅ {sleep_tip}\n✅ {sleep_tip}\n✅ {sleep_tip}\n✅ Target {sleep_hours} per night\n\nPoor sleep increases ghrelin (hunger hormone) by up to 15%, reduces muscle recovery by 60%, and tanks your willpower. Prioritize sleep like you prioritize your workouts.",
    "If your sleep isn't dialed in, everything else suffers — fat loss stalls, muscle recovery slows, hunger skyrockets, and motivation tanks. Start with these: {sleep_tip} and {sleep_tip}. Aim for {sleep_hours}. Over {timeframe}, good sleep habits will transform your energy, body composition, and mood more than any supplement ever could.",
  ],
  water: [
    "Aim for {water_amount} of water daily. Pro tips: drink 16 oz first thing in the morning (you wake up dehydrated), have a glass before each meal (reduces overeating by 20–30%), and sip throughout workouts. If plain water bores you, try sparkling water or add lemon, cucumber, or {snack} like a mint sprig. Hydration affects energy, performance, appetite, and even skin quality.",
  ],
  tasks: [
    "Here are actionable tasks for {greeting_time}:\n\n✅ {habit_action}\n✅ {habit_action}\n✅ {habit_action}\n\nStart with whichever feels most doable and build momentum. Consistency with small habits beats perfection with big ones. Once these feel automatic (usually {timeframe}), we'll level up.",
    "I'd recommend focusing on these habits:\n\n1. {habit_action}\n2. {habit_action}\n3. {habit_action}\n4. {habit_action}\n\nDon't try to nail all four at once. Pick two, crush them this week, then add the others. Building habits gradually sticks far better than trying to overhaul everything overnight.",
    "Great that you want action items! Try this:\n\nThis week: {habit_action} and {habit_action}.\nNext week: add {habit_action}.\nWeek 3: add {habit_action}.\n\nThis layered approach prevents overwhelm and builds real, lasting habits over {timeframe}. Track your completion in the app — checking things off is genuinely motivating.",
  ],
  cravings: [
    "When a craving hits, try this: first, drink a big glass of water and wait 10 minutes — many cravings are actually thirst. Still there? Have {snack} or {snack} — pairing protein with a little sweetness usually kills it. If you're craving {snack}, that's fine in moderation! The 80/20 rule: eat whole foods 80% of the time, enjoy treats 20%. No guilt, no restriction spirals.",
  ],
  supplements: [
    "Evidence-based supplement tier list:\n\n**Must-have:** Creatine monohydrate (5g/day), protein powder if you can't hit {protein_target} from food, Vitamin D (2000–5000 IU if you're indoors a lot)\n**Solid addition:** Omega-3 fish oil (1–2g EPA+DHA), magnesium glycinate ({sleep_tip} — it helps with sleep too)\n**Skip:** BCAAs, fat burners, testosterone boosters — save your money\n\nSupplements supplement a good diet. If your nutrition ({protein}, {veggie}, {carb}) and sleep ({sleep_hours}) aren't dialed in, no pill fixes that.",
  ],
};

// ═══════════════════════════════════════════════════════════════════
// OPENERS — prepended to responses for conversational variety
// ═══════════════════════════════════════════════════════════════════

export const OPENERS = [
  "Great question! ", "Love that you're asking about this. ",
  "This is one of my favorite topics. ", "Okay, let me break this down. ",
  "Alright, here's the deal. ", "So here's the thing — ",
  "Good timing on this question. ", "Let's dive into this. ",
  "I get asked this a lot, and here's what works: ",
  "Here's what the evidence says: ", "Let me give you the full picture. ",
  "This is really important, so let me be thorough. ",
  "Here's my honest take: ", "Solid question. ",
  "Glad you brought this up. ", "",  // no opener (natural feel)
  "", "", "",  // weighted toward no opener
];

// ═══════════════════════════════════════════════════════════════════
// CLOSERS — appended to responses for warm sign-off variety
// ═══════════════════════════════════════════════════════════════════

export const CLOSERS = [
  "\n\nLet me know if you want me to go deeper on any of this!",
  "\n\nHappy to elaborate on any of those points — just ask!",
  "\n\nWant me to break down any of this further?",
  "\n\nFeel free to ask follow-up questions — that's what I'm here for.",
  "\n\nI can get more specific if you tell me a bit about your situation.",
  "\n\nLet me know what part you'd like to explore more!",
  "\n\nAnything else you're curious about?",
  "\n\nWant a more personalized recommendation? Tell me about your goals!",
  "",  // no closer
  "", "", "", "", // weighted toward no closer
];

// ── CONTEXTUAL CONNECTORS ──
export const FOLLOW_UP_PREFIXES = [
  "Building on what we discussed, ",
  "That's a great follow-up. ",
  "To add to my earlier point, ",
  "Good question! ",
  "Absolutely. ",
  "Great thinking. ",
  "I'm glad you asked. ",
  "To expand on that, ",
  "Picking up where we left off, ",
  "Continuing that thought — ",
  "",
  "",
  "",
];

// ── ENCOURAGEMENT SUFFIXES ──
export const ENCOURAGEMENTS = [
  "\n\nYou're on the right track — keep going!",
  "\n\nConsistency is everything. You've got this! {coach_sign}",
  "\n\nSmall steps lead to big changes. Keep showing up!",
  "\n\nRemember: progress over perfection. Every good choice counts.",
  "\n\nThe fact that you're asking these questions shows real commitment. Keep it up!",
  "\n\nYou've got this. One day at a time. {coach_sign}",
  "\n\nKeep that momentum going — you're building something great.",
  "\n\nProud of you for putting in the work. Stay the course! {coach_sign}",
  "",
  "",
  "",
  "",
];
