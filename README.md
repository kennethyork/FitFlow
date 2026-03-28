# 🌿 FitFlow

**Free, open-source fitness & nutrition tracker that works on web and Android.**

No accounts. No subscriptions. Your tracking data stays on your device.

**[Launch the Web App](https://fitflow.kennethyork.com/)**

---

## What is FitFlow?

FitFlow is a personal fitness and nutrition companion that runs entirely on your device. It combines live food search, an AI coach, workout content, and habit tracking into a single app — all without requiring an account.

## Features

- **Live Food Search** — Search Open Food Facts directly from the app for branded and packaged foods without bundling a huge local food database.
- **AI Coach** — On-device coaching that adapts to your goals, habits, and progress. No API key required.
- **Workout Videos** — 9 categories from chair exercises to advanced HIIT, yoga, cooking demos, and mindset content.
- **Smart Habits** — Auto-generated daily, weekly, and monthly tasks tailored to your fitness goal.
- **Macro Tracking** — Calories, protein, carbs, and fat with visual breakdowns and weekly trend charts.
- **Progress Photos** — Take and store progress photos privately on your device.
- **Recipe Suggestions** — Get recipe ideas based on the foods you log with estimated macros.
- **Private Tracking** — Your profile, logs, favorites, habits, and photos stay local via IndexedDB (web) or on-device storage (mobile).

## Platforms

- **Web** — Visit [fitflow.kennethyork.com](https://fitflow.kennethyork.com/) in any modern browser. Installable as a PWA.
- **Android** — Native app with access to device pedometer, camera, haptics, notifications, and share.

## Mobile Features

When running as a native Android app, FitFlow gains access to:

- **Step Counter** — Reads your real step count from the device pedometer.
- **Camera** — Take progress photos directly from the app.
- **Haptic Feedback** — Tactile responses when completing tasks and logging food.
- **Push Notifications** — Reminders for meals, workouts, and daily check-ins.
- **Native Share** — Share your progress using the system share sheet.

## Self-Hosting

FitFlow is a fully static web app — **no server, no serverless platform (e.g. Vercel), and no database backend are required.**

All data is stored locally in the browser via IndexedDB. The AI coach, recipe generator, and habit tasks run entirely on-device. Food search makes optional calls to the USDA FoodData Central API directly from the browser — no proxy server is needed.

To build and deploy the app yourself:

```bash
# Install dependencies
npm install

# Build the static site (fetches RSS feeds then compiles with Vite)
npm run build

# The output is in dist/ — serve it from any static host:
# GitHub Pages, Netlify, Cloudflare Pages, an S3 bucket, a plain nginx/Apache server, etc.
```

Optionally, set `VITE_FDC_API_KEY` to a free key from [https://fdc.nal.usda.gov/api-key-signup.html](https://fdc.nal.usda.gov/api-key-signup.html) to raise the food-search rate limit (the app falls back to `DEMO_KEY` if the variable is not set).

## License

MIT
