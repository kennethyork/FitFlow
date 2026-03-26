import { useState, useRef, useCallback, useEffect } from 'react';

const COACH_NAMES = [
  'Maya', 'Jordan', 'Alex', 'Sam', 'Taylor',
  'Casey', 'Riley', 'Morgan', 'Avery', 'Quinn',
  'Jamie', 'Skyler', 'Sage', 'Reese', 'Blair',
];

function pickCoachName(userId) {
  if (userId) {
    // Deterministic per-user: simple hash of userId
    let hash = 0;
    const s = String(userId);
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return COACH_NAMES[Math.abs(hash) % COACH_NAMES.length];
  }
  return COACH_NAMES[0];
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Track used responses so we never repeat in the same session
const usedResponses = new Set();

function pickUnique(arr) {
  // Try to find one we haven't used yet
  const unused = arr.filter((r) => !usedResponses.has(r));
  if (unused.length > 0) {
    const chosen = unused[Math.floor(Math.random() * unused.length)];
    usedResponses.add(chosen);
    return chosen;
  }
  // All used — clear and start fresh
  arr.forEach((r) => usedResponses.delete(r));
  const chosen = arr[Math.floor(Math.random() * arr.length)];
  usedResponses.add(chosen);
  return chosen;
}

// ── Smart response engine ──
// Pattern-matched curated responses for common fitness/nutrition questions.
// The small AI model is only used as a fallback for truly novel queries.
const INTENT_MAP = [
  {
    patterns: [/lose\s*weight/i, /fat\s*loss/i, /slim\s*down/i, /burn\s*(fat|calories)/i, /cut(ting)?\s*(weight|fat)/i],
    responses: [
      "Focus on a moderate calorie deficit of 300-500 calories below your maintenance. Pair that with protein at every meal (around 0.8-1g per pound of bodyweight) to preserve muscle. Consistency beats perfection — small daily choices compound!",
      "The most effective fat loss strategy is one you can stick with. Start by tracking what you eat for a week, then reduce portions slightly. Add 20-30 minutes of walking daily — it's underrated but incredibly effective.",
      "Prioritize protein and fiber to stay full on fewer calories. Aim for veggies at every meal, drink plenty of water, and get 7-8 hours of sleep — poor sleep increases hunger hormones significantly.",
    ],
  },
  {
    patterns: [/gain\s*(weight|muscle|mass)/i, /bulk/i, /build\s*muscle/i, /get\s*(bigger|stronger|jacked)/i],
    responses: [
      "To build muscle, eat in a slight calorie surplus (200-300 above maintenance) with high protein (1g per pound of bodyweight). Focus on compound lifts — squats, deadlifts, bench press, overhead press — and aim for progressive overload each week.",
      "Muscle growth needs 3 things: a calorie surplus, enough protein (1-1.2g/lb), and progressive resistance training. Train each muscle group 2x per week, prioritize sleep, and be patient — real gains take months.",
      "Eat big, lift big, sleep big. Aim for 4-5 meals a day with 30-40g protein each. Focus on getting stronger at compound movements over time, and make sure you're sleeping 7-9 hours for recovery.",
    ],
  },
  {
    patterns: [/what\s*(should|can)\s*i\s*eat/i, /meal\s*(idea|suggestion|plan|prep)/i, /what.*for\s*(breakfast|lunch|dinner|snack)/i, /healthy\s*(meal|food|eating|recipe)/i, /nutrition\s*(tip|advice)/i],
    responses: [
      "A balanced meal has protein (chicken, fish, tofu, eggs), complex carbs (rice, sweet potato, oats), and healthy fats (avocado, olive oil, nuts). Try meal prepping on Sunday — cook protein in bulk, wash and chop veggies, and portion into containers.",
      "Quick healthy meal ideas: Greek yogurt with berries and granola for breakfast, grilled chicken salad for lunch, salmon with roasted veggies for dinner. Keep hard-boiled eggs and mixed nuts on hand for snacks.",
      "Focus on whole foods: lean proteins, colorful vegetables, whole grains, and healthy fats. Don't overcomplicate it — a simple plate is 1/4 protein, 1/4 carbs, 1/2 vegetables. Season well and you'll look forward to eating healthy!",
    ],
  },
  {
    patterns: [/protein/i],
    responses: [
      "Great protein sources: chicken breast (31g/100g), Greek yogurt (17g/cup), eggs (6g each), salmon (25g/100g), lentils (18g/cup cooked), tofu (20g/cup). Aim for 0.7-1g of protein per pound of your goal bodyweight, spread across meals.",
      "Protein is the MVP of any fitness goal — it builds muscle, keeps you full, and has the highest thermic effect of any macro. Try to include a palm-sized portion of protein at every meal. Whey protein shakes are convenient post-workout.",
    ],
  },
  {
    patterns: [/calorie/i, /how\s*much\s*(should|do)\s*i\s*eat/i, /tdee|maintenance/i, /macro/i],
    responses: [
      "Your calorie target depends on your goal. For weight loss, eat 300-500 below maintenance. For muscle gain, eat 200-300 above. A rough estimate: multiply your bodyweight in pounds by 12 (fat loss), 15 (maintenance), or 17 (muscle gain).",
      "Macros matter! A solid starting point: protein 30%, carbs 40%, fat 30%. Track for a week to build awareness, then adjust based on how you feel and your results. Don't stress exact numbers — ranges are more sustainable.",
    ],
  },
  {
    patterns: [/workout|exercise|training|gym|lift/i, /what.*routine/i, /how.*train/i],
    responses: [
      "If you're starting out, a full-body routine 3x per week is ideal. Focus on: squats, push-ups (or bench press), rows, overhead press, and deadlifts. Start light, learn proper form, and add weight gradually each week.",
      "A great split for intermediate lifters: Push (chest, shoulders, triceps), Pull (back, biceps), Legs — twice a week. Keep rest days between the same muscle groups. Aim for 3-4 sets of 8-12 reps on each exercise.",
      "The best workout is one you enjoy and do consistently. Mix strength training (3-4x/week) with some cardio (2-3x/week). Walking counts! Prioritize compound movements that work multiple muscles at once.",
    ],
  },
  {
    patterns: [/cardio/i, /running|walk|jog|hiit|cycling|swim/i],
    responses: [
      "For fat loss, a mix of HIIT (2x/week) and steady-state cardio like walking (daily) works great. HIIT burns more calories per minute, but walking is easy to recover from and adds up. Aim for 7,000-10,000 steps a day as a baseline.",
      "Cardio is great for heart health and calorie burn. If you hate running, try cycling, swimming, jump rope, or even dancing. The key is finding something you enjoy — you'll do it more consistently!",
    ],
  },
  {
    patterns: [/motivat/i, /give\s*up/i, /discourag/i, /struggling/i, /can'?t\s*(do|seem|stick|keep)/i, /no\s*(progress|results)/i, /plateau/i],
    responses: [
      "Progress isn't always linear, and that's completely normal. Look at how far you've come, not just how far you have to go. Every workout you do, every healthy meal you eat — that's a win. Trust the process and keep showing up. 💪",
      "Plateaus happen to everyone. Try changing one variable: increase intensity, switch exercises, adjust calories by 100-200, or add an extra rest day. Sometimes your body just needs a new stimulus. You've got this!",
      "Consistency beats motivation every time. On days you don't feel like it, just do 10 minutes — you'll usually end up doing more. And if you don't, 10 minutes is still better than zero. Progress is progress, no matter how small.",
    ],
  },
  {
    patterns: [/sleep/i, /rest|recovery/i, /tired|fatigue|exhausted/i],
    responses: [
      "Sleep is your secret weapon. Aim for 7-9 hours per night. Poor sleep increases hunger hormones, reduces willpower, and impairs muscle recovery. Tips: keep your room cool and dark, avoid screens 30 min before bed, and stick to a consistent sleep schedule.",
      "Recovery is when your body actually builds muscle and adapts. Make sure you're getting enough sleep (7-9 hrs), eating enough protein, and taking 1-2 rest days per week. Overtraining hurts more than it helps.",
    ],
  },
  {
    patterns: [/water|hydrat|drink/i],
    responses: [
      "Aim for about half your bodyweight (in pounds) in ounces of water daily. So if you weigh 160 lbs, target 80 oz. Drink a glass first thing in the morning and before each meal — it helps with energy, digestion, and even appetite control.",
      "Staying hydrated boosts energy, improves workout performance, and helps your body process nutrients. Carry a water bottle everywhere, and if plain water bores you, add lemon, cucumber, or a splash of fruit juice.",
    ],
  },
  {
    patterns: [/sugar|sweet|dessert|candy|junk\s*food|cheat/i],
    responses: [
      "You don't have to cut out sugar completely — that often backfires. Instead, reduce it gradually. Swap soda for sparkling water, choose fruit over candy, and save treats for special occasions. The 80/20 rule works great: eat well 80% of the time.",
      "Cravings are normal! When they hit, wait 10 minutes and drink some water first. If you still want it, have a small portion mindfully. Deprivation leads to binging — allow yourself treats in moderation and don't feel guilty about it.",
    ],
  },
  {
    patterns: [/stress|anxious|anxiety|mental\s*health|overwhelm/i],
    responses: [
      "Exercise is one of the best stress relievers out there. Even a 10-minute walk can lower cortisol levels. Try deep breathing (4 counts in, 7 hold, 8 out), and remember that taking care of your body is taking care of your mind too.",
      "When you're stressed, your body holds onto fat and craves comfort food. Prioritize sleep, do some gentle movement like yoga or walking, and don't be hard on yourself. Progress during stressful times is still progress.",
    ],
  },
  {
    patterns: [/task|habit|daily|assign|challenge|goal|recommend|what\s*should\s*i\s*do/i],
    responses: [
      "Here are some great daily habits to build: drink water first thing in the morning, take a 10-minute walk after meals, eat protein at every meal, and stretch before bed. Start with just one or two and build from there!",
      "I suggest starting with these fundamentals: track your meals today, drink 8 glasses of water, do at least 20 minutes of movement, and get to bed on time. Master the basics before adding more!",
      "Great that you're looking for tasks! Focus on: logging every meal (awareness is power), hitting your protein target, moving for 30 minutes, and doing something active you enjoy. Small consistent actions beat big sporadic ones.",
    ],
  },
  {
    patterns: [/stretch|flexibility|yoga|mobility|warm\s*up|cool\s*down/i],
    responses: [
      "Stretching and mobility work prevent injuries and improve performance. Try 5-10 minutes of dynamic stretching before workouts (leg swings, arm circles) and static stretching after (hold each stretch 30 seconds). Yoga 1-2x per week is amazing for flexibility.",
    ],
  },
  {
    patterns: [/supplement|vitamin|creatine|pre.?workout|whey/i],
    responses: [
      "The most evidence-backed supplements are: creatine monohydrate (5g daily — safe and effective for strength), protein powder (convenient, not magic), vitamin D (if you don't get sun), and omega-3 fish oil. Everything else is optional. Food first, supplements second.",
    ],
  },
  {
    patterns: [/hello|hi |hey|good\s*(morning|afternoon|evening)|what'?s\s*up|how\s*are\s*you/i],
    responses: [
      "Hey! Great to see you here. How can I help you today? I can give advice on nutrition, workouts, habits, or just help you stay on track with your goals!",
      "Hi there! I'm here to help with anything fitness or nutrition related. What's on your mind today?",
      "Hello! Ready to crush your goals today? Ask me about workouts, meals, habits, or anything health-related!",
    ],
  },
  {
    patterns: [/thank|thanks|thx|appreciate/i],
    responses: [
      "You're welcome! That's what I'm here for. Keep up the great work — every step counts. Let me know if you need anything else! 💪",
      "Anytime! Remember, showing up and asking questions is already a sign you're on the right track. Keep going!",
    ],
  },
];

function getSmartResponse(userText) {
  const text = userText.toLowerCase();
  for (const intent of INTENT_MAP) {
    for (const pattern of intent.patterns) {
      if (pattern.test(text)) {
        return pickUnique(intent.responses);
      }
    }
  }
  return null; // No match — fall back to AI model
}

const SYSTEM_PROMPT = (name) =>
  `You are Coach ${name}, a warm, motivating fitness and nutrition coach inside the FitFlow app. ` +
  `You can talk about any topic, but always steer the conversation back toward health, fitness, nutrition, or wellness. ` +
  `If someone asks about something unrelated, briefly answer, then connect it to a health or fitness angle. ` +
  `Keep answers concise (2-4 sentences). Be encouraging, practical, and conversational. ` +
  `Give actionable advice when possible. Never give medical diagnoses or prescribe medication.`;

export default function useCoachAI(userId) {
  const [coachName] = useState(() => pickCoachName(userId));
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState('');
  const workerRef = useRef(null);
  const pendingRef = useRef({});
  const nextId = useRef(0);

  useEffect(() => {
    const worker = new Worker(
      new URL('./coachWorker.js', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        setProgress(msg.text);
        setStatus((s) => s === 'idle' ? 'loading' : s);
      } else if (msg.type === 'status') {
        setStatus(msg.status);
        if (msg.status === 'ready') setProgress('');
        if (msg.status === 'error') setProgress(msg.error || 'Failed to load AI model.');
      } else if (msg.type === 'result') {
        const resolve = pendingRef.current[msg.id];
        if (resolve) {
          resolve(msg.text);
          delete pendingRef.current[msg.id];
        }
      }
    };

    workerRef.current = worker;
    setStatus('loading');
    setProgress('Chat restarting…');
    worker.postMessage({ type: 'init' });

    return () => worker.terminate();
  }, []);

  const chat = useCallback(
    (messages) => {
      // Send everything to the AI model
      if (!workerRef.current) {
        return Promise.resolve('AI coach is still loading — please wait a moment and try again.');
      }

      const chatMessages = [
        { role: 'system', content: SYSTEM_PROMPT(coachName) },
        ...messages.map((m) => ({
          role: m.role === 'coach' ? 'assistant' : 'user',
          content: m.text,
        })),
      ];

      const id = nextId.current++;
      return new Promise((resolve) => {
        pendingRef.current[id] = resolve;
        workerRef.current.postMessage({ type: 'chat', id, messages: chatMessages });
      });
    },
    [coachName]
  );

  return { coachName, status, progress, chat };
}
