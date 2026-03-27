# 🌿 FitFlow

**Free, open-source fitness & nutrition tracker that runs entirely in your browser.**

No accounts. No servers. No subscriptions. 100% private.

**[Launch the App](https://kennethyork.github.io/FitFlow/)**

---

## Features

- **388,000+ Foods** — Full USDA FoodData Central database (branded, generic, restaurant) built in and searchable offline.
- **AI Coach** — On-device coaching that adapts to your goals, habits, and progress. No API key required.
- **Workout Videos** — 9 categories (chair exercises → advanced HIIT, yoga, cooking, mindset) streamed from YouTube RSS.
- **Smart Habits** — Auto-generated daily, weekly, and monthly tasks tailored to your fitness goal.
- **Macro Tracking** — Calories, protein, carbs, and fat with visual breakdowns and weekly trend charts.
- **100% Private** — All data is stored locally in your browser via IndexedDB. Nothing is ever sent to a server.

## Tech Stack

| Layer | Tech |
|-------|------|
| UI | React 19 |
| Build | Vite 8 |
| Local DB | RxDB + IndexedDB |
| Food Data | USDA FoodData Central (static JSON) |
| Hosting | GitHub Pages |

## Getting Started

```bash
# Clone the repo
git clone https://github.com/kennethyork/FitFlow.git
cd FitFlow

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:5173/FitFlow/](http://localhost:5173/FitFlow/) in your browser.

## Building for Production

```bash
npm run build
```

The output is written to `dist/`. The app is deployed automatically to GitHub Pages on every push to `main`.

## Project Structure

```
src/
  App.jsx            # Main app — tabs, state, data loading
  LandingPage.jsx    # Marketing / landing page
  OnboardingScreen.jsx # First-run onboarding flow
  AccountScreen.jsx  # Settings & data management
  db.js              # RxDB database layer
  foodSearch.js      # Food search across 388K+ items
  taskGenerator.js   # Deterministic habit/task generator
  useCoachAI.js      # AI coach hook
  youtubeRSS.js      # YouTube RSS video feeds (9 categories)
public/data/foods/   # 21 static JSON files — USDA food database
```

## License

MIT
