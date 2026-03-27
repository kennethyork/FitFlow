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
