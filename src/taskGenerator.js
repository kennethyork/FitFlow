// ── Smart Task Generator ──
// Generates daily, weekly, and monthly tasks based on user profile.
// Purely local — no API calls. Deterministic seed per day/week/month
// so the same tasks persist for their period.

const DAILY_TASKS = {
  lose: [
    'Drink 8 glasses of water',
    'Take a 30-minute walk',
    'Eat at least 3 servings of vegetables',
    'Skip sugary drinks today',
    'Get 7+ hours of sleep tonight',
    'Track all meals today',
    'Do 10 minutes of stretching',
    'Eat a protein-rich breakfast',
    'Take the stairs instead of the elevator',
    'Eat dinner before 8pm',
    'Do a 15-minute bodyweight workout',
    'Replace one snack with fruit',
    'Practice mindful eating — no screens at meals',
    'Walk 10,000 steps',
    'Cook a healthy meal at home',
    'Do 20 jumping jacks right now',
    'Limit carbs to under 150g today',
    'Eat a salad for lunch',
    'Stand up and move every hour',
    'No eating after 9pm',
  ],
  gain: [
    'Eat 500+ calories above maintenance',
    'Drink a protein shake after workout',
    'Eat 5 meals today (3 main + 2 snacks)',
    'Hit your protein goal (1g per lb bodyweight)',
    'Do a strength training session',
    'Eat a calorie-dense snack (nuts, PB, avocado)',
    'Track all meals today',
    'Eat a big breakfast within 1 hour of waking',
    'Drink a mass gainer or smoothie',
    'Do compound lifts (squat, bench, deadlift)',
    'Add extra rice or pasta to one meal',
    'Eat at least 4 eggs today',
    'Sleep 8+ hours tonight for recovery',
    'Have a pre-bed snack (cottage cheese, casein)',
    'Stretch for 10 minutes after training',
    'Cook a high-calorie meal at home',
    'Add olive oil or butter to your meals',
    'Eat red meat or salmon today',
    'Drink whole milk with a meal',
    'Do progressive overload on one exercise',
  ],
  maintain: [
    'Drink 8 glasses of water',
    'Take a 30-minute walk or jog',
    'Eat a balanced breakfast',
    'Track all meals today',
    'Get 7+ hours of sleep tonight',
    'Do 20 minutes of exercise',
    'Eat at least 2 servings of fruit',
    'Eat a protein-rich lunch',
    'Limit processed food today',
    'Stand up and stretch every hour',
    'Cook a healthy dinner at home',
    'Take 10 minutes for meditation or breathing',
    'Walk 8,000+ steps',
    'Eat veggies with every meal',
    'Swap one unhealthy snack for a healthy one',
    'Do a quick core workout (planks, crunches)',
    'Stay within your calorie goal today',
    'Eat slowly and stop when full',
    'Prep tomorrow\'s lunch tonight',
    'Do 15 minutes of yoga or stretching',
  ],
};

const WEEKLY_GOALS = {
  lose: [
    'Exercise at least 4 days this week',
    'Lose 0.5–1 lb this week',
    'Meal prep for 3+ days',
    'Try one new healthy recipe',
    'Complete 3 cardio sessions',
    'Drink zero sugary beverages all week',
    'Hit your calorie target 5 out of 7 days',
    'Walk 50,000+ steps total this week',
    'Go grocery shopping for whole foods',
    'Do a full body workout twice',
    'Get 7+ hours sleep every night',
    'Track every meal all week',
  ],
  gain: [
    'Hit calorie surplus every day this week',
    'Lift weights at least 4 days',
    'Gain 0.5 lb this week',
    'Meal prep high-calorie meals for 3+ days',
    'Try a new muscle-building recipe',
    'Increase weight on one lift',
    'Eat 150g+ protein every day',
    'Sleep 8+ hours every night',
    'Do legs day at least once',
    'Drink a post-workout shake every training day',
    'Track every meal all week',
    'Do a push/pull/legs split',
  ],
  maintain: [
    'Exercise at least 3 days this week',
    'Stay within ±200 calories of goal daily',
    'Try one new healthy recipe',
    'Meal prep for 3+ days',
    'Complete 2 strength sessions and 2 cardio',
    'Walk 40,000+ steps total this week',
    'Sleep 7+ hours every night',
    'Cook at home at least 4 times',
    'Track every meal all week',
    'Do one flexibility/mobility session',
    'Eat 5 servings of fruits/veggies daily',
    'Spend 1 hour on an active hobby',
  ],
};

const MONTHLY_CHALLENGES = {
  lose: [
    'Lose 4–6 lbs this month',
    'Complete 16+ workout sessions',
    'Go sugar-free for 7 consecutive days',
    'Run/walk 50+ miles total',
    'Learn 5 new healthy recipes',
    'Achieve a personal best in a cardio activity',
    'Meal prep every week this month',
    'Log every meal for 30 days straight',
    'Cut out fast food for the entire month',
    'Drink 1 gallon of water daily for a week',
  ],
  gain: [
    'Gain 2–4 lbs this month',
    'Increase your squat, bench, or deadlift PR',
    'Complete 20+ training sessions',
    'Hit 150g+ protein every single day',
    'Learn 5 new high-calorie recipes',
    'Bulk meal prep every Sunday',
    'Never miss a scheduled workout',
    'Take progress photos weekly',
    'Add 5 lbs to a compound lift',
    'Sleep 8+ hours every night for a week',
  ],
  maintain: [
    'Stay within ±2 lbs of current weight',
    'Exercise 15+ days this month',
    'Try 5 new healthy recipes',
    'Complete a 7-day streak of meal tracking',
    'Run/walk 40+ miles total',
    'Do a fitness challenge (plank, pushup, etc.)',
    'Meal prep every week this month',
    'Achieve a personal best in any exercise',
    'Meditate or do yoga 10+ times',
    'Cook at home 20+ times this month',
  ],
};

// ── Deterministic seeded pick ──
// Same seed = same tasks for the period, so they don't shuffle on reload.
function seededShuffle(arr, seed) {
  const shuffled = [...arr];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function dateSeed(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = ((h << 5) - h + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Returns the Monday of the current ISO week
function weekKey(date) {
  const d = new Date(date);
  const day = d.getDay() || 7; // Mon=1 … Sun=7
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function monthKey(date) {
  return date.toISOString().slice(0, 7); // "2026-03"
}

/**
 * Generate tasks for today.
 * @param {object} profile - { goalType: 'lose'|'gain'|'maintain' }
 * @returns {{ daily: string[], weekly: string[], monthly: string[] }}
 */
export function generateTasks(profile) {
  const goal = profile?.goalType || 'maintain';
  const now = new Date();
  const dayStr = now.toISOString().slice(0, 10); // "2026-03-27"
  const wk = weekKey(now);
  const mo = monthKey(now);

  const dailyPool = DAILY_TASKS[goal] || DAILY_TASKS.maintain;
  const weeklyPool = WEEKLY_GOALS[goal] || WEEKLY_GOALS.maintain;
  const monthlyPool = MONTHLY_CHALLENGES[goal] || MONTHLY_CHALLENGES.maintain;

  const daily = seededShuffle(dailyPool, dateSeed(dayStr)).slice(0, 3);
  const weekly = seededShuffle(weeklyPool, dateSeed(wk)).slice(0, 2);
  const monthly = seededShuffle(monthlyPool, dateSeed(mo)).slice(0, 2);

  return { daily, weekly, monthly };
}

/**
 * Returns the period key for each category to detect when tasks should refresh.
 */
export function currentPeriodKeys() {
  const now = new Date();
  return {
    daily: now.toISOString().slice(0, 10),
    weekly: weekKey(now),
    monthly: monthKey(now),
  };
}

// ── Coach-assigned tasks: topic-aware pools ──
// When the user asks the coach for a task, we pick from curated pools
// that match what they actually asked about — not extract fragments
// from long-form advice paragraphs.

const COACH_TASKS = {
  lose_weight: [
    'Eat in a 400-calorie deficit today',
    'Walk 10,000 steps today',
    'Drink 8 glasses of water',
    'Skip sugary drinks today',
    'Eat protein at every meal today',
    'Fill half your plate with vegetables at each meal',
    'Track every meal today',
    'Take a 30-minute brisk walk',
    'Do a 20-minute HIIT session',
    'Replace one processed snack with fruit',
    'Eat a high-protein breakfast within an hour of waking',
    'No eating after 8pm tonight',
    'Cook a healthy meal at home instead of ordering out',
    'Do 15 minutes of bodyweight exercises',
    'Take the stairs all day instead of the elevator',
  ],
  gain_muscle: [
    'Hit your protein target today (1g per lb bodyweight)',
    'Eat 300+ calories above maintenance today',
    'Do a strength training session (compound lifts)',
    'Drink a protein shake after your workout',
    'Eat 5 meals today — 3 main + 2 snacks',
    'Do progressive overload on one exercise today',
    'Eat a calorie-dense snack (nuts, PB, avocado)',
    'Sleep 8+ hours tonight for recovery',
    'Do 3 sets of squats, bench press, and rows',
    'Add extra rice or pasta to one meal',
    'Eat at least 4 eggs today',
    'Stretch for 10 minutes after training',
    'Track your lifts and aim to beat last session',
    'Drink a mass gainer smoothie today',
    'Have a pre-bed snack (cottage cheese or casein shake)',
  ],
  workout: [
    'Complete a full-body workout today',
    'Do 3 sets of push-ups, squats, and planks',
    'Go for a 30-minute jog or run',
    'Do a 20-minute HIIT workout',
    'Complete a stretching or yoga session',
    'Do 100 bodyweight squats throughout the day',
    'Hit the gym for at least 45 minutes',
    'Do 5 sets of pull-ups or inverted rows',
    'Complete a 15-minute core workout',
    'Walk or bike instead of driving today',
    'Do a push/pull/legs workout',
    'Try a new exercise you haven\'t done before',
    'Do 10 minutes of mobility work before training',
    'Complete 3 sets of deadlifts or RDLs',
    'Exercise for at least 30 minutes today',
  ],
  meal_ideas: [
    'Meal prep lunch for the next 3 days',
    'Cook a high-protein dinner at home tonight',
    'Make overnight oats for tomorrow\'s breakfast',
    'Prepare a big batch of grilled chicken and veggies',
    'Try a new healthy recipe today',
    'Make a protein smoothie for breakfast',
    'Prep healthy snacks for the week (cut veggies, boil eggs)',
    'Cook a sheet-pan meal with protein and vegetables',
    'Pack a balanced lunch instead of eating out',
    'Make a big salad with at least 30g of protein',
    'Eat at least 3 different colors of vegetables today',
    'Replace one meal with a healthier homemade version',
  ],
  protein: [
    'Eat at least 30g of protein at every meal today',
    'Have a protein-rich snack between meals (Greek yogurt, eggs)',
    'Track your protein intake — aim for your bodyweight in grams',
    'Swap regular yogurt for Greek yogurt today',
    'Eat a protein source within 2 hours of training',
    'Add eggs or egg whites to one meal today',
    'Have chicken, fish, or tofu as your main protein at dinner',
  ],
  sleep: [
    'Get 7+ hours of sleep tonight',
    'No screens 30 minutes before bed',
    'Set a consistent bedtime and stick to it tonight',
    'Do 5 minutes of deep breathing before bed',
    'Avoid caffeine after 2pm today',
    'Keep your bedroom cool and dark tonight',
    'Wind down with light stretching before sleep',
  ],
  water: [
    'Drink 8 glasses (64 oz) of water today',
    'Drink a glass of water before every meal',
    'Carry a water bottle everywhere today',
    'Replace one sugary drink with water',
    'Drink a full glass of water right now',
    'Finish 1 liter of water before lunch',
  ],
  cardio: [
    'Do 30 minutes of cardio today',
    'Go for a brisk 20-minute walk',
    'Do a 15-minute jump rope session',
    'Take a 45-minute bike ride or use the stationary bike',
    'Run or jog for 20 minutes',
    'Do 20 minutes of stair climbing',
    'Walk 8,000+ steps today',
  ],
  habits: [
    'Track every meal today without skipping',
    'Take a 10-minute walk after each meal',
    'Eat mindfully — no screens during meals today',
    'Prep tomorrow\'s meals tonight before bed',
    'Weigh yourself first thing tomorrow morning',
    'Write down 3 things you did well today',
    'Set a reminder to drink water every hour',
    'Go to bed 30 minutes earlier than usual',
    'Stand up and move for 5 minutes every hour',
    'Replace one unhealthy habit with a healthy one today',
  ],
  supplements: [
    'Take your creatine (5g) today',
    'Drink a protein shake today',
    'Take your multivitamin with breakfast',
    'Have a serving of fish oil or omega-3s today',
    'Make sure to take your vitamin D supplement',
  ],
  motivation: [
    'Complete your workout even if you only have 15 minutes',
    'Do something active for at least 10 minutes right now',
    'Hit all your nutrition targets today — no excuses',
    'Share your progress with a friend or accountability partner',
    'Complete every task on your list today',
    'Do one thing today that your future self will thank you for',
    'No skipping — show up and do something, even if small',
  ],
  stress: [
    'Do 10 minutes of meditation or deep breathing',
    'Take a 20-minute walk outside in nature',
    'Do a gentle yoga or stretching session',
    'Journal for 5 minutes about how you\'re feeling',
    'Limit social media to 30 minutes today',
    'Practice box breathing (4-4-4-4) for 5 rounds',
    'Take a tech-free break for at least 1 hour',
  ],
};

// Map user message patterns → which task pool(s) to draw from
const TASK_INTENT_MAP = [
  { patterns: [/lose\s*weight/i, /fat\s*loss/i, /burn.*fat/i, /cut(ting)?/i, /lean/i, /slim/i, /shred/i, /deficit/i], pool: 'lose_weight' },
  { patterns: [/gain.*muscle/i, /bulk/i, /build\s*muscle/i, /get\s*(bigger|stronger|jacked)/i, /mass\s*gain/i, /hypertrophy/i], pool: 'gain_muscle' },
  { patterns: [/workout/i, /exercise/i, /training/i, /gym/i, /lift/i, /routine/i, /strength/i, /resistance/i], pool: 'workout' },
  { patterns: [/meal/i, /cook/i, /recipe/i, /food/i, /eat(ing)?/i, /nutrition/i, /diet/i, /prep/i, /breakfast/i, /lunch/i, /dinner/i, /snack/i], pool: 'meal_ideas' },
  { patterns: [/protein/i], pool: 'protein' },
  { patterns: [/sleep/i, /rest/i, /recovery/i, /tired/i, /insomnia/i, /bed/i], pool: 'sleep' },
  { patterns: [/water/i, /hydrat/i, /drink/i, /thirst/i], pool: 'water' },
  { patterns: [/cardio/i, /run(ning)?/i, /jog/i, /walk/i, /step/i, /endurance/i, /aerobic/i], pool: 'cardio' },
  { patterns: [/habit/i, /routine/i, /consistent/i, /discipline/i, /daily/i, /track/i], pool: 'habits' },
  { patterns: [/supplement/i, /creatine/i, /vitamin/i, /omega/i, /fish\s*oil/i], pool: 'supplements' },
  { patterns: [/motivat/i, /lazy/i, /can'?t\s*(do|start)/i, /no\s*energy/i, /give\s*up/i, /stuck/i, /push/i, /discipline/i], pool: 'motivation' },
  { patterns: [/stress/i, /anxi/i, /overwhelm/i, /mental/i, /relax/i, /calm/i, /mindful/i, /meditat/i], pool: 'stress' },
];

/**
 * Pick a sensible, actionable task based on what the user asked the coach about.
 * Falls back to goal-type daily tasks if no topic match.
 * Avoids duplicating tasks already in the user's task list.
 *
 * @param {string} userText - What the user said to the coach
 * @param {string} goalType - 'lose' | 'gain' | 'maintain'
 * @param {string[]} existingTitles - Titles of tasks already on the list
 * @returns {string} A clean, actionable task title
 */
export function pickCoachTask(userText, goalType, existingTitles = []) {
  const existing = new Set(existingTitles.map(t => t.toLowerCase()));

  // Find matching topic pools based on what the user said
  const matchedPools = [];
  for (const entry of TASK_INTENT_MAP) {
    if (entry.patterns.some(p => p.test(userText))) {
      matchedPools.push(entry.pool);
    }
  }

  // Build candidate list: matched topic pools first, then goal-type fallback
  let candidates = [];
  for (const poolKey of matchedPools) {
    candidates.push(...(COACH_TASKS[poolKey] || []));
  }

  // If no topic match or very few candidates, add goal-type tasks
  if (candidates.length < 5) {
    const goalPool = goalType === 'gain'
      ? [...(COACH_TASKS.gain_muscle || []), ...(DAILY_TASKS.gain || [])]
      : goalType === 'lose'
        ? [...(COACH_TASKS.lose_weight || []), ...(DAILY_TASKS.lose || [])]
        : [...(COACH_TASKS.habits || []), ...(DAILY_TASKS.maintain || [])];
    candidates.push(...goalPool);
  }

  // Filter out tasks already on the list
  const available = candidates.filter(t => !existing.has(t.toLowerCase()));

  // If everything is taken, just use full candidate list
  const pool = available.length > 0 ? available : candidates;

  return pool[Math.floor(Math.random() * pool.length)];
}
