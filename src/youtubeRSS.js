// ── YouTube RSS Feed Fetcher ──
// Fetches recent videos from fitness YouTube channels via RSS.
// Restores all original categories (chair, easy, moderate, etc.)
// with keyword filters and deterministic daily shuffle.

// ── Channels per category (from original server) ──
const CHANNELS = {
  chair: [
    { id: 'UCRp-32Yi0KC2YMgHIg6mTag', name: 'SilverSneakers' },
    { id: 'UCPG8CxOlWesGSPlKRR8B3zw', name: 'Grow Young Fitness' },
    { id: 'UC2BaKQ5vqal9yaC-VbpD5ZQ', name: 'Senior Fitness With Meredith' },
    { id: 'UCxqJgKLsc1zQAHbtrXxmfig', name: 'Improved Health' },
    { id: 'UCC4TRhL4BiA7--jpxVVXcpQ', name: 'More Life Health' },
    { id: 'UCwxmeTw7TLIOqUEDM5HniBw', name: 'Fitness With Cindy' },
    { id: 'UC34J4TasPOq6krJS28XdEng', name: 'HASfit' },
    { id: 'UC-0CzRZeML8zw4pFTVDq65Q', name: 'SarahBethYoga' },
  ],
  easy: [
    { id: 'UC34J4TasPOq6krJS28XdEng', name: 'HASfit' },
    { id: 'UCY-8TLORCEHyUeqgTH16PcA', name: 'Walk at Home' },
    { id: 'UCZUUZFex6AaIU4QTopFudYA', name: 'growwithjo' },
    { id: 'UCjyhdvQO16xizyqzk5hCWxw', name: 'Juice & Toya' },
    { id: 'UCpQ34afVgk8cRQBjSJ1xuJQ', name: 'MadFit' },
    { id: 'UCIJwWYOfsCfz6PjxbONYXSg', name: 'blogilates' },
    { id: 'UCE2ygZPYvOwcAOJT-8bViZg', name: 'Heather Robertson' },
    { id: 'UCVQJZE_on7It_pEv6tn-jdA', name: 'Sydney Cummings' },
  ],
  moderate: [
    { id: 'UCY-8TLORCEHyUeqgTH16PcA', name: 'Walk at Home' },
    { id: 'UC34J4TasPOq6krJS28XdEng', name: 'HASfit' },
    { id: 'UCE2ygZPYvOwcAOJT-8bViZg', name: 'Heather Robertson' },
    { id: 'UCjyhdvQO16xizyqzk5hCWxw', name: 'Juice & Toya' },
    { id: 'UCZUUZFex6AaIU4QTopFudYA', name: 'growwithjo' },
    { id: 'UCIJwWYOfsCfz6PjxbONYXSg', name: 'blogilates' },
    { id: 'UCpQ34afVgk8cRQBjSJ1xuJQ', name: 'MadFit' },
    { id: 'UCVQJZE_on7It_pEv6tn-jdA', name: 'Sydney Cummings' },
  ],
  intermediate: [
    { id: 'UCpQ34afVgk8cRQBjSJ1xuJQ', name: 'MadFit' },
    { id: 'UCVQJZE_on7It_pEv6tn-jdA', name: 'Sydney Cummings' },
    { id: 'UCE2ygZPYvOwcAOJT-8bViZg', name: 'Heather Robertson' },
    { id: 'UCpis3RcTw6t47XO0R_KY4WQ', name: 'Caroline Girvan' },
    { id: 'UCBrcDabYtwbR1VIhwH5efZA', name: 'Chloe Ting' },
    { id: 'UCIJwWYOfsCfz6PjxbONYXSg', name: 'blogilates' },
    { id: 'UChECmemk1JRsp_1a8L513OA', name: 'Fraser Wilson' },
    { id: 'UCjyhdvQO16xizyqzk5hCWxw', name: 'Juice & Toya' },
  ],
  advanced: [
    { id: 'UCMHkz3SDZADtMaQ43bLGdUQ', name: 'Chris Heria' },
    { id: 'UCpis3RcTw6t47XO0R_KY4WQ', name: 'Caroline Girvan' },
    { id: 'UCBrcDabYtwbR1VIhwH5efZA', name: 'Chloe Ting' },
    { id: 'UChECmemk1JRsp_1a8L513OA', name: 'Fraser Wilson' },
    { id: 'UCE2ygZPYvOwcAOJT-8bViZg', name: 'Heather Robertson' },
    { id: 'UCVQJZE_on7It_pEv6tn-jdA', name: 'Sydney Cummings' },
    { id: 'UCpQ34afVgk8cRQBjSJ1xuJQ', name: 'MadFit' },
    { id: 'UCZUUZFex6AaIU4QTopFudYA', name: 'growwithjo' },
  ],
  yoga: [
    { id: 'UCFKE7WVJfvaHW5q283SxchA', name: 'Yoga With Adriene' },
    { id: 'UCGQk-FB8sWnE7Sc0c1A0pIw', name: 'Boho Beautiful Yoga' },
    { id: 'UC-0CzRZeML8zw4pFTVDq65Q', name: 'SarahBethYoga' },
    { id: 'UCbfPq-uRqonJQli41muSLeQ', name: 'Breathe and Flow' },
    { id: 'UCVrWHW_xYpDnr3p3OR4KYGw', name: 'Cat Meffan' },
    { id: 'UCHTisXO8TeozyYOxEZGC8XQ', name: 'Travis Eliot' },
    { id: 'UCX32D3gKXENrhOXdZjWWtMA', name: 'Yoga with Kassandra' },
    { id: 'UCIJwWYOfsCfz6PjxbONYXSg', name: 'blogilates' },
  ],
  foodtips: [
    { id: 'UCq2E1mIwUKMWzCA4liA_XGQ', name: 'Pick Up Limes' },
    { id: 'UCjTp-nBKswYLumqmVeBPwYw', name: 'Jeff Nippard' },
    { id: 'UCKLz-9xkpPNjK26PqbjHn7Q', name: 'Abbey Sharp' },
    { id: 'UCbNF3nemgJUHJuVRgH7V0YQ', name: 'EatingWell' },
    { id: 'UCS-gN7Jui5cJIAMOF7yoqPw', name: 'Thomas DeLauer' },
    { id: 'UCpWhiwlOPxOmwQu5xyjtLDw', name: 'Dr. Eric Berg' },
    { id: 'UCfQgsKhHjSyRLOp9mnffqVg', name: 'Renaissance Periodization' },
    { id: 'UCYidQwKhM3WTDKpT8pwfJzw', name: 'Downshiftology' },
  ],
  cooking: [
    { id: 'UCq2E1mIwUKMWzCA4liA_XGQ', name: 'Pick Up Limes' },
    { id: 'UCYidQwKhM3WTDKpT8pwfJzw', name: 'Downshiftology' },
    { id: 'UCUAg71CJEvFdOnujmep1Svw', name: 'Joshua Weissman' },
    { id: 'UC9_p50tH3WmMslWRWKnM7dQ', name: 'Adam Ragusea' },
    { id: 'UCJFp8uSYCjXOMnkUyb3CQ3Q', name: 'Tasty' },
    { id: 'UCHxiNbnE_4-Gw4oGfF8DDpg', name: 'Gordon Ramsay' },
    { id: 'UCICdNqyJqyHB3_uDVtmFhPA', name: 'Ethan Chlebowski' },
    { id: 'UCDbZvuDA_tZ6XP5wKKFuemQ', name: 'Rainbow Plant Life' },
  ],
  mindset: [
    { id: 'UC-ga3onzHSJFAGsIebtVeBg', name: 'Lavendaire' },
    { id: 'UCk2U-Oqn7RXf-ydPqfSxG5g', name: 'Mel Robbins' },
    { id: 'UC2D2CMWXMOVWx7giW1n3LIg', name: 'Andrew Huberman' },
    { id: 'UC7IcJI8PUf5Z3zKxnZvTBog', name: 'The School of Life' },
    { id: 'UCbk_QsfaFZG6PdQeCvaYXJQ', name: 'Jay Shetty' },
    { id: 'UChdr6MfklpKiAlZRju73lwQ', name: 'Therapy in a Nutshell' },
    { id: 'UCJ24N4O0bP7LGLBDvye7oCA', name: "Matt D'Avella" },
    { id: 'UCkJEpR7JmS36tajD34Gp4VA', name: 'Psych2Go' },
  ],
};

// ── Tab-specific keyword filters ──
const TAB_FILTERS = {
  chair: {
    include: /workout|exercise|seated|chair|sit\b|stretch|low.?impact|routine|warm.?up|cool.?down|gentle|beginner|senior|follow.?along|cardio|strength|balance|flexibility|upper.?body|lower.?body|full.?body|arms|legs|core|standing|\d+\s*min.*(workout|exercise|stretch|yoga|cardio|routine)/i,
    exclude: /vlog|review|q\s*[&]\s*a|haul|what i eat|day in my|reaction|unbox|grocery|shop with me|mukbang|taste test|try on|get ready|trailer|teaser|behind the scenes|recipe|#?healthy\s*food|meal|protein\s*(meal|snack|lunch|dinner|breakfast)/i,
  },
  easy: {
    include: /workout|exercise|walk|dance|stretch|low.?impact|beginner|routine|warm.?up|cool.?down|cardio|follow.?along|standing|no.?equipment|home.?workout|full.?body|burn|tone|step|aerobic|arms|legs|abs|core|upper|lower|strength|sculpt|pilates|barre|\d+\s*min.*(workout|exercise|stretch|walk|cardio|dance)/i,
    exclude: /vlog|review|q\s*[&]\s*a|haul|what i eat|day in my|reaction|unbox|grocery|shop with me|mukbang|taste test|try on|get ready|trailer|challenge results|recipe|meal.?prep/i,
  },
  moderate: {
    include: /workout|exercise|walk|cardio|stretch|routine|follow.?along|burn|tone|full.?body|low.?impact|strength|hiit|circuit|standing|no.?equipment|aerobic|step|dance|arms|legs|abs|core|upper|lower|sculpt|pilates|barre|\d+\s*min.*(workout|exercise|stretch|walk|cardio)/i,
    exclude: /vlog|review|tested|q\s*[&]\s*a|haul|what i eat|day in my|reaction|unbox|grocery|shop with me|mukbang|taste test|try on|get ready|trailer|no longer|influencer|celebrity|recipe|meal.?prep/i,
  },
  intermediate: {
    include: /workout|exercise|hiit|cardio|strength|routine|\d+\s*min|follow.?along|burn|full.?body|abs|legs|arms|glutes|core|back|chest|shoulder|squat|circuit|tabata|tone|sculpt|plank|pilates|home|no.?equipment|dumbbell|kettlebell|resistance|band|upper|lower|booty|bicep|tricep/i,
    exclude: /vlog|review|q\s*[&]\s*a|haul|what i eat|day in my|reaction|unbox|grocery|shop with me|mukbang|taste test|try on|get ready|trailer/i,
  },
  advanced: {
    include: /workout|exercise|hiit|cardio|strength|routine|\d+\s*min|follow.?along|burn|full.?body|abs|legs|arms|glutes|core|back|chest|shoulder|squat|circuit|tabata|intense|killer|advanced|heavy|power|muscle|calisthenics|pull.?up|push.?up|burpee|emom|amrap|dumbbell|kettlebell|barbell|upper|lower|booty|shred/i,
    exclude: /vlog|review|q\s*[&]\s*a|haul|what i eat|day in my|reaction|unbox|grocery|shop with me|mukbang|taste test|try on|get ready|explained|the science|trailer/i,
  },
  yoga: {
    include: /yoga|stretch|flow|meditat|flex|mindful|breathe|pose|asana|yin|vinyasa|hatha|restor|relax|morning|bedtime|mobility|pilates|gentle|open|release|hip|back|full.?body|\d+\s*min|routine|practice|balance|strength|power|ashtanga|chair/i,
    exclude: /vlog|haul|what i eat|review|unbox|mukbang|taste test|try on|trailer/i,
  },
  foodtips: {
    include: /nutrition|diet|meal|food|eat|calorie|protein|macro|weight.?loss|healthy|snack|recipe|prep|tip|mistake|fat.?loss|supplement|vitamin|mineral|nutrient|carb|fiber|sugar|fast|intermittent|keto|vegan|vegetarian|whole.?food|clean.?eat|anti.?inflam|gut|metabol/i,
    exclude: /vlog|full.?body.?workout|follow.?along.?workout|unbox|trailer|sponsor|brand.?deal|youtube.?tip|camera|filming|thumbnail/i,
  },
  cooking: {
    include: /recipe|cook|meal|prep|how to make|breakfast|lunch|dinner|snack|healthy|easy|quick|bake|roast|grill|salad|soup|bowl|smoothie|ingredient|kitchen|food|dish|stir.?fry|saut[eé]|steam|boil|one.?pot|budget|high.?protein|low.?calorie|what i eat|eat in a day/i,
    exclude: /vlog|full.?body.?workout|follow.?along.?workout|unbox|trailer/i,
  },
  mindset: {
    include: /mindset|motiv|discipline|mental.?health|stress|anxiety|self.?care|self.?improv|morning.?routine|focus|meditat|journal|gratitude|wellness|sleep|brain|confidence|fear|purpose|transform|heal|emotion|therapy|psych|burnout|calm|peace|happy|joy|overthink|letting.?go|growth|resilien|self.?worth|self.?love|inner|mindful/i,
    exclude: /full.?body.?workout|follow.?along.?workout|recipe|cook|trailer|unbox|windows|apps? review|money|invest|financ|budget|crypto|stock|income/i,
  },
};

// ── CORS proxies for client-side fetching ──
const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

// ── Feed cache (15-minute TTL) ──
const _feedCache = {};
const CACHE_TTL = 15 * 60 * 1000;

function parseRSSXml(xmlText, channelName) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const entries = doc.querySelectorAll('entry');
  const videos = [];

  entries.forEach((entry) => {
    const videoId = entry.querySelector('videoId')?.textContent
      || entry.querySelector('yt\\:videoId')?.textContent
      || '';
    const title = entry.querySelector('title')?.textContent || '';
    const published = entry.querySelector('published')?.textContent || '';
    const thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : '';

    if (videoId && title) {
      videos.push({
        id: `rss-${videoId}`,
        videoId,
        title,
        channel: channelName,
        thumbnail,
        published,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        lengthSeconds: 0,
      });
    }
  });

  return videos;
}

async function fetchWithProxy(url) {
  for (const makeProxy of [null, ...CORS_PROXIES]) {
    try {
      const fetchUrl = makeProxy ? makeProxy(url) : url;
      const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const text = await res.text();
        if (text.includes('<feed') || text.includes('<entry')) return text;
      }
    } catch { /* try next proxy */ }
  }
  return null;
}

// Deterministic daily shuffle — same videos per day, different on refresh next day
function dailyShuffle(arr) {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const seed = dayOfYear * 7 + 13;
  return arr
    .map((v, i) => ({ v, sort: ((seed + i * 2654435761) >>> 0) % 1000000 }))
    .sort((a, b) => a.sort - b.sort)
    .map((x) => x.v);
}

function filterVideos(videos, tabId) {
  const filters = TAB_FILTERS[tabId];
  if (!filters) return videos;

  const filtered = videos.filter((v) => {
    if (filters.exclude && filters.exclude.test(v.title)) return false;
    if (filters.include && !filters.include.test(v.title)) return false;
    return true;
  });

  // If strict filtering gives us enough, use it
  if (filtered.length >= 6) return filtered;

  // Relax: only apply include filter
  const includeOnly = videos.filter((v) => !filters.include || filters.include.test(v.title));
  return includeOnly.length > filtered.length ? includeOnly : filtered;
}

/**
 * Fetch, filter, and shuffle videos for a category tab.
 * Returns up to 12 videos, shuffled deterministically per day.
 */
export async function fetchCategoryVideos(category) {
  const cached = _feedCache[category];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.videos;
  }

  const channels = CHANNELS[category] || [];
  const allVideos = [];

  const fetches = channels.map(async (ch) => {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`;
    const xml = await fetchWithProxy(url);
    return xml ? parseRSSXml(xml, ch.name) : [];
  });

  const results = await Promise.allSettled(fetches);
  for (const r of results) {
    if (r.status === 'fulfilled') allVideos.push(...r.value);
  }

  // Apply keyword filters, then deterministic daily shuffle, limit to 12
  const filtered = filterVideos(allVideos, category);
  const videos = dailyShuffle(filtered).slice(0, 12);

  _feedCache[category] = { videos, ts: Date.now() };
  return videos;
}

/**
 * Search across all cached videos.
 */
export function searchCachedVideos(query) {
  const q = query.toLowerCase();
  const all = Object.values(_feedCache).flatMap(c => c.videos || []);
  return all.filter(v => v.title.toLowerCase().includes(q) || v.channel.toLowerCase().includes(q));
}

/**
 * All available video tab categories with labels.
 */
export const VIDEO_CATEGORIES = [
  { id: 'chair', label: '🪑 Chair' },
  { id: 'easy', label: '🟢 Easy' },
  { id: 'moderate', label: '🚶 Moderate' },
  { id: 'intermediate', label: '🏃 Intermediate' },
  { id: 'advanced', label: '🔥 Advanced' },
  { id: 'yoga', label: '🧘 Yoga' },
  { id: 'foodtips', label: '🥗 Food Tips' },
  { id: 'cooking', label: '👨‍🍳 Cooking' },
  { id: 'mindset', label: '🧠 Mindset' },
];
