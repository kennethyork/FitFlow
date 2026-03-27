// ── Client-side Food Search ──
// Searches 388K+ foods from the local IndexedDB (Dexie) food database.
// Also searches user-created recipes from RxDB.
// Fully offline — no external API calls.

import {
  searchFoods as searchFoodDB,
  lookupBarcode as lookupBarcodeDB,
  getMealSuggestions as getMealSuggestionsDB,
  FOOD_CATEGORIES,
  isFoodDBReady,
  loadFoodDatabase,
  getFoodCount,
  clearFoodDatabase,
} from './foodDB.js';

export function searchFoods(query) {
  return searchFoodDB(query);
}

export function lookupBarcode(code) {
  return lookupBarcodeDB(code);
}

export function getMealSuggestions(remainingCals, goalType) {
  return getMealSuggestionsDB(remainingCals, goalType);
}

export { FOOD_CATEGORIES, isFoodDBReady, loadFoodDatabase, getFoodCount, clearFoodDatabase };
