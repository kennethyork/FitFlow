import { useState, useCallback } from 'react';
import { INTENTS, POOLS, TEMPLATES, OPENERS, CLOSERS, FOLLOW_UP_PREFIXES, ENCOURAGEMENTS } from './coachDB';

const COACH_NAMES = [
  'Maya', 'Jordan', 'Alex', 'Sam', 'Taylor',
  'Casey', 'Riley', 'Morgan', 'Avery', 'Quinn',
  'Jamie', 'Skyler', 'Sage', 'Reese', 'Blair',
];

function pickCoachName(userId) {
  if (userId) {
    let hash = 0;
    const s = String(userId);
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return COACH_NAMES[Math.abs(hash) % COACH_NAMES.length];
  }
  return COACH_NAMES[0];
}

// ── Session-level uniqueness tracking ──
const usedResponses = new Set();

function pickUnique(arr) {
  const unused = arr.filter((r) => !usedResponses.has(r));
  if (unused.length > 0) {
    const chosen = unused[Math.floor(Math.random() * unused.length)];
    usedResponses.add(chosen);
    return chosen;
  }
  // All used — reset and pick fresh
  arr.forEach((r) => usedResponses.delete(r));
  const chosen = arr[Math.floor(Math.random() * arr.length)];
  usedResponses.add(chosen);
  return chosen;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Sample N unique items from a pool ──
function sampleUnique(pool, n) {
  const copy = [...pool];
  const result = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

// ── Template interpolation engine ──
// Replaces {variable} with random picks from POOLS.
// Multiple occurrences of the same {variable} get DIFFERENT values.
function interpolate(template) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const pool = POOLS[key];
    if (!pool || pool.length === 0) return match;
    return pool[Math.floor(Math.random() * pool.length)];
  });
}

// ── Multi-intent detection: finds ALL matching intents ──
function detectIntents(text) {
  const matches = [];
  for (const intent of INTENTS) {
    for (const pattern of intent.patterns) {
      if (pattern.test(text)) {
        matches.push(intent);
        break; // one match per intent is enough
      }
    }
  }
  return matches;
}

// ── Conversation context analysis ──
function analyzeConversation(messages) {
  const ctx = {
    turnCount: messages.length,
    previousTopics: new Set(),
    isFollowUp: false,
    userAskedQuestion: false,
    recentCoachResponse: null,
  };

  // Look at last 6 messages for context
  const recent = messages.slice(-6);
  for (const msg of recent) {
    if (msg.role === 'user') {
      const intents = detectIntents(msg.text);
      intents.forEach((i) => ctx.previousTopics.add(i.id));
    }
    if (msg.role === 'coach') {
      ctx.recentCoachResponse = msg.text;
    }
  }

  const lastUser = messages.filter((m) => m.role === 'user');
  if (lastUser.length >= 2) {
    const prev = lastUser[lastUser.length - 2]?.text || '';
    const curr = lastUser[lastUser.length - 1]?.text || '';
    // Follow-up if short reply or references previous topic
    if (curr.length < 30 || /more|else|another|also|what about|how about|tell me more|expand|explain/i.test(curr)) {
      ctx.isFollowUp = true;
    }
    // Follow-up if same topic detected in consecutive user messages
    const prevIntents = detectIntents(prev);
    const currIntents = detectIntents(curr);
    if (prevIntents.some((p) => currIntents.some((c) => c.id === p.id))) {
      ctx.isFollowUp = true;
    }
  }

  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.role === 'user' && /\?/.test(lastMsg.text)) {
    ctx.userAskedQuestion = true;
  }

  return ctx;
}

// ── Broad fallback responses (for completely unmatched queries) ──
const GENERAL_RESPONSES = [
  "That's a great question! Focus on consistency with your nutrition and training — small daily improvements add up to big results over time. Track what you eat, stay active, and prioritize sleep. If you want, ask me about something specific like meal ideas, workout plans, or supplements and I'll give you a detailed breakdown.",
  "I'd recommend starting with three pillars: nutrition (eat enough protein and whole foods), movement (strength training + daily walking), and recovery (7–9 hours of sleep). Which of these would you like to dive deeper into?",
  "Every step in the right direction counts. The people who transform their health aren't superhuman — they just showed up consistently when it was hard. What's one area you'd like to improve? I can give you a specific action plan for nutrition, workouts, habits, or anything else.",
  "Here's what I'd suggest: start with the basics. Are you eating enough protein? Drinking enough water? Getting 7–8 hours of sleep? These fundamentals account for 80% of results. Master them first — then we can talk about optimizing the details.",
  "The best fitness plan is one you can actually follow week after week. Don't try to overhaul everything at once. Pick one habit to focus on this week (drinking more water, eating protein at breakfast, walking after dinner) and build from there. What sounds most doable for you?",
  "Progress takes patience. Most people overestimate what they can do in a week and underestimate what they can do in 3 months. Stay consistent, trust the process, and measure progress weekly — not daily. What specific goal are you working toward? I can help you map it out.",
  "I can help with a lot! Nutrition plans, workout routines, supplement advice, motivation, sleep optimization, habit building, weight loss, muscle gain, and more. Just tell me what you're working on or what's challenging you, and I'll give you a detailed, actionable plan.",
  "My top advice: don't aim for perfection — aim for consistency. A decent plan followed every day beats a perfect plan followed sporadically. Log your meals, move your body, drink your water, and get your sleep. Do that for 30 days and you'll be amazed at the difference.",
];

// ── Smart response engine ──
// Uses a 50/50 mix of static (curated) and template (generated) responses.
// Templates are interpolated with random pool values each time → millions of combos.
function getSmartResponse(userText, messages) {
  const ctx = analyzeConversation(messages);
  const intents = detectIntents(userText);

  let response;

  if (intents.length === 0) {
    // No pattern match — use general response
    response = pickUnique(GENERAL_RESPONSES);
  } else if (intents.length >= 1) {
    const primary = intents[0];
    const intentId = primary.id;
    const templates = TEMPLATES[intentId];

    // 50% chance to use a template (if available), 50% curated static
    if (templates && templates.length > 0 && Math.random() < 0.5) {
      const template = pickRandom(templates);
      response = interpolate(template);
    } else {
      response = pickUnique(primary.responses);
    }

    // Multi-topic: bridge to secondary intent
    if (intents.length >= 2) {
      const secondary = intents[1];
      const secTemplates = TEMPLATES[secondary.id];
      let snippet;
      if (secTemplates && secTemplates.length > 0 && Math.random() < 0.5) {
        snippet = interpolate(pickRandom(secTemplates));
      } else {
        snippet = pickRandom(secondary.responses);
      }
      // Take first 1–2 sentences
      const short = snippet.split(/(?<=[.!])\s+/).slice(0, 2).join(' ');
      response += `\n\nSince you also mentioned ${secondary.id.replace(/_/g, ' ')}: ${short}`;
    }
  }

  // Add opener (40% chance, not on greetings/thanks/identity)
  const noOpener = intents.some((i) => ['greeting', 'thanks', 'identity', 'yes_no', 'unclear'].includes(i.id));
  if (!noOpener && Math.random() < 0.4) {
    const opener = pickRandom(OPENERS);
    if (opener) {
      response = opener + response.charAt(0).toLowerCase() + response.slice(1);
    }
  }

  // Add follow-up prefix if continuing a conversation thread
  if (ctx.isFollowUp && ctx.turnCount > 2) {
    const prefix = pickRandom(FOLLOW_UP_PREFIXES);
    if (prefix) {
      response = prefix + response.charAt(0).toLowerCase() + response.slice(1);
    }
  }

  // Add closer (25% chance, not on greetings/thanks)
  const noCloser = intents.some((i) => ['greeting', 'thanks', 'identity', 'yes_no', 'unclear'].includes(i.id));
  if (!noCloser && Math.random() < 0.25) {
    const closer = pickRandom(CLOSERS);
    if (closer) response += closer;
  }

  // Add encouragement (20% chance)
  if (!noCloser && Math.random() < 0.2) {
    const enc = interpolate(pickRandom(ENCOURAGEMENTS));
    if (enc) response += enc;
  }

  return response;
}

// ── LLM-style word-by-word streaming ──
function streamWords(text, onToken) {
  return new Promise((resolve) => {
    const words = text.split(/(\s+)/);
    let i = 0;
    function next() {
      if (i < words.length) {
        onToken(words[i]);
        i++;
        const delay = 20 + Math.floor(Math.random() * 40);
        setTimeout(next, delay);
      } else {
        resolve();
      }
    }
    setTimeout(next, 300 + Math.floor(Math.random() * 400));
  });
}

export default function useCoachAI(userId) {
  const [coachName] = useState(() => pickCoachName(userId));

  const chat = useCallback(
    async (messages, { onToken } = {}) => {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      const response = getSmartResponse(lastUser?.text || '', messages);

      if (onToken) {
        await streamWords(response, onToken);
      }

      return response;
    },
    [coachName]
  );

  return { coachName, status: 'ready', progress: '', chat };
}
