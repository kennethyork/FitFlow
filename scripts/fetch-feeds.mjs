#!/usr/bin/env node
// Build-time script: fetches YouTube RSS + recipe RSS feeds and writes static JSON.
// Run before `vite build` so the client loads same-origin JSON instead of cross-origin XML.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../public/data');

// ── YouTube channels (same as youtubeRSS.js) ──
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

const RECIPE_FEEDS = [
  { url: 'https://www.skinnytaste.com/feed/', name: 'Skinnytaste' },
  { url: 'https://minimalistbaker.com/feed/', name: 'Minimalist Baker' },
  { url: 'https://www.budgetbytes.com/feed/', name: 'Budget Bytes' },
  { url: 'https://www.eatingwell.com/feed/', name: 'EatingWell' },
  { url: 'https://cookinglsl.com/feed/', name: 'Cooking LSL' },
  { url: 'https://www.loveandlemons.com/feed/', name: 'Love and Lemons' },
];

// ── Helpers ──
function parseYouTubeXml(xmlText, channelName) {
  const videos = [];
  // Simple regex extraction — no DOMParser in Node
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRe.exec(xmlText)) !== null) {
    const block = match[1];
    const videoId = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
      || block.match(/<videoId>([^<]+)<\/videoId>/)?.[1] || '';
    const title = block.match(/<title>([^<]+)<\/title>/)?.[1] || '';
    const published = block.match(/<published>([^<]+)<\/published>/)?.[1] || '';
    if (videoId && title) {
      videos.push({
        id: `rss-${videoId}`,
        videoId,
        title,
        channel: channelName,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        published,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        lengthSeconds: 0,
      });
    }
  }
  return videos;
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseRecipeXml(xmlText, sourceName) {
  const recipes = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRe.exec(xmlText)) !== null) {
    const block = match[1];
    const title = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || '';
    const link = block.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/)?.[1]?.trim() || '';
    const pubDate = block.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] || '';
    const descRaw = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1] || '';
    const desc = stripHtml(descRaw).slice(0, 200);
    // Extract image
    let image = '';
    const mediaUrl = block.match(/<media:content[^>]+url="([^"]+)"/)?.[1]
      || block.match(/<enclosure[^>]+url="([^"]+)"/)?.[1];
    if (mediaUrl) { image = mediaUrl; }
    else {
      const imgMatch = block.match(/<img[^>]+src=["']([^"']+)["']/);
      if (imgMatch) image = imgMatch[1];
    }
    if (title && link) {
      const id = Buffer.from(link).toString('base64').slice(0, 20);
      recipes.push({ id: `rss-${id}`, title, link, description: desc, image, source: sourceName, published: pubDate });
    }
  }
  return recipes;
}

async function fetchUrl(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FitFlow/1.0)' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (i === retries) return null;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return null;
}

// ── Load existing data to preserve when fetches fail ──
function loadExisting(filename) {
  try {
    const raw = fs.readFileSync(path.join(OUT_DIR, filename), 'utf-8');
    return JSON.parse(raw);
  } catch { return null; }
}

// ── Main ──
async function main() {
  console.log('🔄 Fetching RSS feeds...');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const existingYt = loadExisting('youtube-feeds.json');
  const existingRecipes = loadExisting('recipe-feeds.json');

  // 1. YouTube feeds — deduplicate channels across categories
  const uniqueChannels = new Map();
  for (const [, channels] of Object.entries(CHANNELS)) {
    for (const ch of channels) uniqueChannels.set(ch.id, ch.name);
  }

  console.log(`  YouTube: ${uniqueChannels.size} unique channels`);
  const channelVideos = {}; // channelId → videos[]

  const ytFetches = [...uniqueChannels.entries()].map(async ([chId, chName]) => {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${chId}`;
    const xml = await fetchUrl(url);
    if (xml) {
      channelVideos[chId] = parseYouTubeXml(xml, chName);
    }
  });

  await Promise.allSettled(ytFetches);

  // Build per-category video lists, preserving existing data when fetch returns empty
  const youtubeData = {};
  for (const [category, channels] of Object.entries(CHANNELS)) {
    const videos = [];
    for (const ch of channels) {
      if (channelVideos[ch.id]) videos.push(...channelVideos[ch.id]);
    }
    if (videos.length > 0) {
      youtubeData[category] = videos;
    } else if (existingYt && existingYt[category]?.length > 0) {
      youtubeData[category] = existingYt[category];
      console.log(`  YouTube: keeping existing ${existingYt[category].length} videos for "${category}" (fetch returned 0)`);
    } else {
      youtubeData[category] = [];
    }
  }

  const ytCount = Object.values(youtubeData).reduce((s, v) => s + v.length, 0);
  console.log(`  YouTube: ${ytCount} total videos across ${Object.keys(youtubeData).length} categories`);

  fs.writeFileSync(
    path.join(OUT_DIR, 'youtube-feeds.json'),
    JSON.stringify(youtubeData),
  );

  // 2. Recipe feeds
  console.log(`  Recipes: ${RECIPE_FEEDS.length} feeds`);
  const allRecipes = [];

  const recipeFetches = RECIPE_FEEDS.map(async (feed) => {
    const xml = await fetchUrl(feed.url);
    if (xml) allRecipes.push(...parseRecipeXml(xml, feed.name));
  });

  await Promise.allSettled(recipeFetches);
  console.log(`  Recipes: ${allRecipes.length} total items`);

  // Preserve existing recipes if new fetch got nothing
  const finalRecipes = allRecipes.length > 0 ? allRecipes
    : (existingRecipes?.length > 0 ? existingRecipes : []);
  if (allRecipes.length === 0 && existingRecipes?.length > 0) {
    console.log(`  Recipes: keeping existing ${existingRecipes.length} items (fetch returned 0)`);
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'recipe-feeds.json'),
    JSON.stringify(finalRecipes),
  );

  console.log('✅ RSS feeds saved to public/data/');
}

main().catch((e) => {
  console.error('Feed fetch failed:', e);
  // Don't fail the build — stale data is better than no build
  process.exit(0);
});
