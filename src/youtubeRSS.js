// ── YouTube RSS Feed Fetcher ──
// Fetches recent videos from fitness YouTube channels via RSS.
// Uses a CORS proxy for client-side fetching from GitHub Pages.
// Falls back to curated videos if RSS fails.

// Fitness YouTube channels — channel IDs
const CHANNELS = {
  hiit: [
    { name: 'MadFit', id: 'UCpQ34afVgk8cRQBjSJ1xuJQ' },
    { name: 'THENX', id: 'UCqjwF8rxRsotnojGl4gM0Zw' },
  ],
  yoga: [
    { name: 'Yoga With Adriene', id: 'UCFKE7WVJfvaHW5q283SxchA' },
    { name: 'Boho Beautiful Yoga', id: 'UCWN2FPlvg9r-LnUyepH9IaQ' },
  ],
  strength: [
    { name: 'Sydney Cummings', id: 'UCVQJZE_on7It_pEv6tn-jdA' },
    { name: 'Jeff Nippard', id: 'UC68TLK0mAEzUyHx5x5k-S1Q' },
  ],
  cardio: [
    { name: 'Heather Robertson', id: 'UCOpsZxrmeDARilha1uq4slA' },
    { name: 'growwithjo', id: 'UCIJwWYOfsCfz6PjxbONYXSg' },
  ],
  stretch: [
    { name: 'Tom Merrick', id: 'UCU0DZhN-8KFLYO6beSaYljg' },
    { name: 'Breathe And Flow', id: 'UCBBSbhb4UXgkhSHfmJe-JXA' },
  ],
};

const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

// Cache fetched feeds for the session so tab switches don't re-fetch
const _feedCache = {};
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function parseRSSXml(xmlText, channelName) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const entries = doc.querySelectorAll('entry');
  const videos = [];

  entries.forEach((entry, i) => {
    const videoId = entry.querySelector('videoId')?.textContent
      || entry.querySelector('yt\\:videoId')?.textContent
      || '';
    const title = entry.querySelector('title')?.textContent || '';
    const published = entry.querySelector('published')?.textContent || '';
    const thumbnail = entry.querySelector('group thumbnail')?.getAttribute('url')
      || entry.querySelector('media\\:group media\\:thumbnail')?.getAttribute('url')
      || (videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : '');

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
  // Try direct first (works in some environments)
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

/**
 * Fetch recent videos for a category.
 * @param {string} category - 'hiit' | 'yoga' | 'strength' | 'cardio' | 'stretch'
 * @returns {Promise<Array>} videos sorted by publish date
 */
export async function fetchCategoryVideos(category) {
  const cached = _feedCache[category];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.videos;
  }

  const channels = CHANNELS[category] || [];
  const results = [];

  // Fetch all channels for this category in parallel
  const fetches = channels.map(async (ch) => {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`;
    const xml = await fetchWithProxy(url);
    if (xml) {
      return parseRSSXml(xml, ch.name);
    }
    return [];
  });

  const allResults = await Promise.allSettled(fetches);
  for (const r of allResults) {
    if (r.status === 'fulfilled') results.push(...r.value);
  }

  // Sort by publish date (newest first) and limit
  results.sort((a, b) => new Date(b.published) - new Date(a.published));
  const videos = results.slice(0, 20);

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
 * Get all available categories.
 */
export const VIDEO_CATEGORIES = Object.keys(CHANNELS).map(id => ({
  id,
  label: id.charAt(0).toUpperCase() + id.slice(1),
}));
