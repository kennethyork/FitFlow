// ── RxDB Local Database (IndexedDB-backed) ──
// All data stays on the user's device. No server needed.

import { createRxDatabase, addRxPlugin } from 'rxdb/plugins/core';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';

addRxPlugin(RxDBQueryBuilderPlugin);

// ── Schemas ──

const userProfileSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    goalType: { type: 'string' },
    activityLevel: { type: 'string' },
    calorieGoal: { type: 'number' },
    onboarded: { type: 'boolean' },
    createdAt: { type: 'string' },
  },
  required: ['id'],
};

const foodLogSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    meal: { type: 'string' },
    calories: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
    recipeUrl: { type: 'string' },
    loggedAt: { type: 'string', maxLength: 30 },
  },
  required: ['id', 'meal', 'loggedAt'],
  indexes: ['loggedAt'],
};

const habitSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    title: { type: 'string' },
    completed: { type: 'boolean' },
    source: { type: 'string' },  // daily, weekly, monthly, coach, custom
    createdAt: { type: 'string' },
  },
  required: ['id', 'title'],
};

const weightLogSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    weight: { type: 'number' },
    unit: { type: 'string' },
    loggedAt: { type: 'string', maxLength: 30 },
  },
  required: ['id', 'loggedAt'],
  indexes: ['loggedAt'],
};

const waterLogSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    glasses: { type: 'number' },
    date: { type: 'string', maxLength: 10 },
  },
  required: ['id'],
};

const stepLogSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    steps: { type: 'number' },
    date: { type: 'string', maxLength: 10 },
  },
  required: ['id'],
};

const chatMessageSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    role: { type: 'string' },
    text: { type: 'string' },
    createdAt: { type: 'string', maxLength: 30 },
  },
  required: ['id', 'createdAt'],
  indexes: ['createdAt'],
};

const favoriteMealSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    meal: { type: 'string' },
    calories: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
  },
  required: ['id', 'meal'],
};

const recipeSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    servings: { type: 'number' },
    calories: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
    fiber: { type: 'number' },
    sugar: { type: 'number' },
    ingredients: { type: 'string' },
    instructions: { type: 'string' },
    createdAt: { type: 'string' },
  },
  required: ['id', 'name'],
};

// ── Database singleton (survives HMR + Strict Mode double-invoke) ──

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const collections = {
  profiles: { schema: userProfileSchema },
  food_logs: { schema: foodLogSchema },
  habits: { schema: habitSchema },
  weight_logs: { schema: weightLogSchema },
  water_logs: { schema: waterLogSchema },
  step_logs: { schema: stepLogSchema },
  chat_messages: { schema: chatMessageSchema },
  favorite_meals: { schema: favoriteMealSchema },
  recipes: { schema: recipeSchema },
};

async function initDB() {
  // Suppress RxDB promotional console message about premium storage
  const _warn = console.warn;
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('https://rxdb.info/premium')) return;
    _warn.apply(console, args);
  };
  const db = await createRxDatabase({
    name: 'fitflow2',
    storage: getRxStorageDexie(),
    multiInstance: false,
    closeDuplicates: true,
  });
  await db.addCollections(collections);
  console.warn = _warn;
  return db;
}

// Store the promise on globalThis so it survives Vite HMR module re-evaluation.
// The key '_ffDB' is checked synchronously before any async work begins,
// so concurrent calls (React Strict Mode) all get the same promise.
function getDB() {
  if (!globalThis._ffDB) {
    globalThis._ffDB = initDB().catch((err) => {
      globalThis._ffDB = null;
      throw err;
    });
  }
  return globalThis._ffDB;
}

// ── Profile ──

export async function getProfile() {
  const db = await getDB();
  const doc = await db.profiles.findOne('default').exec();
  return doc ? doc.toJSON() : null;
}

export async function saveProfile(data) {
  const db = await getDB();
  const existing = await db.profiles.findOne('default').exec();
  const now = new Date().toISOString();
  if (existing) {
    await existing.incrementalPatch(data);
    return (await db.profiles.findOne('default').exec()).toJSON();
  } else {
    const doc = await db.profiles.insert({
      id: 'default',
      name: data.name || '',
      goalType: data.goalType || 'lose',
      activityLevel: data.activityLevel || 'moderate',
      calorieGoal: data.calorieGoal || 1800,
      onboarded: data.onboarded || false,
      createdAt: now,
    });
    return doc.toJSON();
  }
}

// ── Food Logs ──

export async function getFoodLogs(dateStr) {
  const db = await getDB();
  const d = dateStr || today();
  const startOfDay = d + 'T00:00:00.000Z';
  const endOfDay = d + 'T23:59:59.999Z';
  const docs = await db.food_logs.find({
    selector: { loggedAt: { $gte: startOfDay, $lte: endOfDay } },
    sort: [{ loggedAt: 'desc' }],
  }).exec();
  return docs.map((d) => d.toJSON());
}

export async function addFoodLog(data) {
  const db = await getDB();
  const doc = await db.food_logs.insert({
    id: uid(),
    meal: data.meal,
    calories: data.calories || 0,
    protein: data.protein || 0,
    carbs: data.carbs || 0,
    fat: data.fat || 0,
    recipeUrl: data.recipeUrl || '',
    loggedAt: new Date().toISOString(),
  });
  return doc.toJSON();
}

export async function updateFoodLog(id, data) {
  const db = await getDB();
  const doc = await db.food_logs.findOne(id).exec();
  if (!doc) return null;
  await doc.incrementalPatch({
    meal: data.meal,
    calories: data.calories || 0,
    protein: data.protein || 0,
    carbs: data.carbs || 0,
    fat: data.fat || 0,
  });
  return (await db.food_logs.findOne(id).exec()).toJSON();
}

export async function deleteFoodLog(id) {
  const db = await getDB();
  const doc = await db.food_logs.findOne(id).exec();
  if (doc) await doc.remove();
}

// ── Habits ──

export async function getHabits() {
  const db = await getDB();
  const docs = await db.habits.find().exec();
  return docs.map((d) => d.toJSON());
}

export async function addHabit(data) {
  const db = await getDB();
  const title = typeof data === 'string' ? data : data.title;
  const doc = await db.habits.insert({
    id: uid(),
    title,
    completed: false,
    source: (typeof data === 'object' && data.source) || 'custom',
    createdAt: new Date().toISOString(),
  });
  return doc.toJSON();
}

export async function toggleHabit(id) {
  const db = await getDB();
  const doc = await db.habits.findOne(id).exec();
  if (!doc) return null;
  await doc.incrementalPatch({ completed: !doc.completed });
  return (await db.habits.findOne(id).exec()).toJSON();
}

export async function deleteHabit(id) {
  const db = await getDB();
  const doc = await db.habits.findOne(id).exec();
  if (doc) await doc.remove();
}

export async function updateHabitSource(id, newSource) {
  const db = await getDB();
  const doc = await db.habits.findOne(id).exec();
  if (!doc) return null;
  await doc.incrementalPatch({ source: newSource });
  return (await db.habits.findOne(id).exec()).toJSON();
}

// ── Weight Logs ──

export async function getWeightLogs() {
  const db = await getDB();
  const docs = await db.weight_logs.find({ sort: [{ loggedAt: 'desc' }] }).exec();
  return docs.map((d) => d.toJSON());
}

export async function addWeightLog(data) {
  const db = await getDB();
  const doc = await db.weight_logs.insert({
    id: uid(),
    weight: data.weight,
    unit: data.unit || 'lbs',
    loggedAt: new Date().toISOString(),
  });
  return doc.toJSON();
}

// ── Water Logs ──

export async function getWaterToday() {
  const db = await getDB();
  const d = today();
  const doc = await db.water_logs.findOne(d).exec();
  return doc ? doc.glasses : 0;
}

export async function setWaterToday(glasses) {
  const db = await getDB();
  const d = today();
  const existing = await db.water_logs.findOne(d).exec();
  if (existing) {
    await existing.incrementalPatch({ glasses });
  } else {
    await db.water_logs.insert({ id: d, glasses, date: d });
  }
  return glasses;
}

// ── Step Logs ──

export async function getStepsToday() {
  const db = await getDB();
  const d = today();
  const doc = await db.step_logs.findOne(d).exec();
  return doc ? doc.steps : 0;
}

export async function setStepsToday(steps) {
  const db = await getDB();
  const d = today();
  const existing = await db.step_logs.findOne(d).exec();
  if (existing) {
    await existing.incrementalPatch({ steps });
  } else {
    await db.step_logs.insert({ id: d, steps, date: d });
  }
  return steps;
}

// ── Chat Messages ──

export async function getChatMessages() {
  const db = await getDB();
  const docs = await db.chat_messages.find({ sort: [{ createdAt: 'asc' }] }).exec();
  return docs.map((d) => d.toJSON());
}

export async function addChatMessages(messages) {
  const db = await getDB();
  const now = Date.now();
  for (let i = 0; i < messages.length; i++) {
    await db.chat_messages.insert({
      id: uid(),
      role: messages[i].role,
      text: messages[i].text,
      createdAt: new Date(now + i).toISOString(),
    });
  }
}

// ── Favorite Meals ──

export async function getFavoriteMeals() {
  const db = await getDB();
  const docs = await db.favorite_meals.find().exec();
  return docs.map((d) => d.toJSON());
}

export async function addFavoriteMeal(data) {
  const db = await getDB();
  const doc = await db.favorite_meals.insert({
    id: uid(),
    meal: data.meal,
    calories: data.calories || 0,
    protein: data.protein || 0,
    carbs: data.carbs || 0,
    fat: data.fat || 0,
  });
  return doc.toJSON();
}

export async function deleteFavoriteMeal(id) {
  const db = await getDB();
  const doc = await db.favorite_meals.findOne(id).exec();
  if (doc) await doc.remove();
}

// ── Recipes ──

export async function getRecipes() {
  const db = await getDB();
  const docs = await db.recipes.find({ sort: [{ createdAt: 'desc' }] }).exec();
  return docs.map((d) => d.toJSON());
}

export async function addRecipe(data) {
  const db = await getDB();
  const doc = await db.recipes.insert({
    id: uid(),
    name: data.name,
    servings: data.servings || 1,
    calories: data.calories || 0,
    protein: data.protein || 0,
    carbs: data.carbs || 0,
    fat: data.fat || 0,
    fiber: data.fiber || 0,
    sugar: data.sugar || 0,
    ingredients: typeof data.ingredients === 'string' ? data.ingredients : JSON.stringify(data.ingredients || []),
    instructions: data.instructions || '',
    createdAt: new Date().toISOString(),
  });
  return doc.toJSON();
}

export async function updateRecipe(id, data) {
  const db = await getDB();
  const doc = await db.recipes.findOne(id).exec();
  if (!doc) return null;
  await doc.incrementalPatch({
    name: data.name,
    servings: data.servings,
    calories: data.calories || 0,
    protein: data.protein || 0,
    carbs: data.carbs || 0,
    fat: data.fat || 0,
    fiber: data.fiber || 0,
    sugar: data.sugar || 0,
    ingredients: typeof data.ingredients === 'string' ? data.ingredients : JSON.stringify(data.ingredients || []),
    instructions: data.instructions || '',
  });
  return (await db.recipes.findOne(id).exec()).toJSON();
}

export async function deleteRecipe(id) {
  const db = await getDB();
  const doc = await db.recipes.findOne(id).exec();
  if (doc) await doc.remove();
}

// ── Weekly Stats (computed from local data) ──

export async function getWeeklySummary() {
  const db = await getDB();
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const calorieByDay = [];
  let totalCals = 0, totalProtein = 0, daysLogged = 0, habitsCompleted = 0, totalSteps = 0, waterGoalDays = 0;

  for (const day of days) {
    const start = day + 'T00:00:00.000Z';
    const end = day + 'T23:59:59.999Z';
    const logs = await db.food_logs.find({ selector: { loggedAt: { $gte: start, $lte: end } } }).exec();
    const dayCals = logs.reduce((s, l) => s + (l.calories || 0), 0);
    const dayProtein = logs.reduce((s, l) => s + (l.protein || 0), 0);
    calorieByDay.push({ day: day.slice(5), calories: dayCals });
    totalCals += dayCals;
    totalProtein += dayProtein;
    if (logs.length > 0) daysLogged++;

    const water = await db.water_logs.findOne(day).exec();
    if (water && water.glasses >= 8) waterGoalDays++;

    const steps = await db.step_logs.findOne(day).exec();
    if (steps) totalSteps += steps.steps;
  }

  const allHabits = await db.habits.find().exec();
  habitsCompleted = allHabits.filter((h) => h.completed).length;

  const weights = await db.weight_logs.find({ sort: [{ loggedAt: 'desc' }] }).exec();
  let weightChange = null;
  if (weights.length >= 2) {
    weightChange = +(weights[0].weight - weights[weights.length - 1].weight).toFixed(1);
  }

  return {
    calorieByDay,
    avgCals: daysLogged > 0 ? Math.round(totalCals / daysLogged) : 0,
    totalProtein,
    daysLogged,
    habitsCompleted,
    avgSteps: Math.round(totalSteps / 7),
    waterGoalDays,
    weightChange,
  };
}

// ── Streaks ──

export async function getStreaks() {
  const db = await getDB();
  const now = new Date();
  let streak = 0;

  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const start = day + 'T00:00:00.000Z';
    const end = day + 'T23:59:59.999Z';
    const logs = await db.food_logs.find({ selector: { loggedAt: { $gte: start, $lte: end } } }).exec();
    if (logs.length > 0) streak++;
    else break;
  }

  const badges = [
    { name: '1 Day', icon: '🌱', earned: streak >= 1 },
    { name: '3 Days', icon: '🌿', earned: streak >= 3 },
    { name: '7 Days', icon: '🔥', earned: streak >= 7 },
    { name: '14 Days', icon: '💪', earned: streak >= 14 },
    { name: '30 Days', icon: '⭐', earned: streak >= 30 },
    { name: '60 Days', icon: '🏆', earned: streak >= 60 },
    { name: '100 Days', icon: '👑', earned: streak >= 100 },
  ];

  return { currentStreak: streak, badges };
}

// ── Reset all data ──

export async function clearAllData() {
  const db = await getDB();
  await Promise.all([
    db.profiles.find().remove(),
    db.food_logs.find().remove(),
    db.habits.find().remove(),
    db.weight_logs.find().remove(),
    db.water_logs.find().remove(),
    db.step_logs.find().remove(),
    db.chat_messages.find().remove(),
    db.favorite_meals.find().remove(),
    db.recipes.find().remove(),
  ]);
}
