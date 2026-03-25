import { useState, useRef, useCallback, useEffect } from 'react';

const COACH_NAMES = [
  'Maya', 'Jordan', 'Alex', 'Sam', 'Taylor',
  'Casey', 'Riley', 'Morgan', 'Avery', 'Quinn',
  'Jamie', 'Skyler', 'Sage', 'Reese', 'Blair',
];

function pickCoachName() {
  return COACH_NAMES[Math.floor(Math.random() * COACH_NAMES.length)];
}

const SYSTEM_PROMPT = (name) =>
  `You are Coach ${name}, a friendly and knowledgeable fitness and nutrition coach inside the FitFlow app. ` +
  `Keep answers concise (2-4 sentences). Be encouraging, empathetic, and practical. ` +
  `Give actionable health, nutrition, and workout advice. Never give medical diagnoses.`;

// Smallest viable chat model — ~800 MB download, cached in IndexedDB after first load
const MODEL_ID = 'SmolLM2-360M-Instruct-q4f16_1-MLC';

export default function useCoachAI() {
  const [coachName] = useState(pickCoachName);
  const [status, setStatus] = useState('idle');      // idle | loading | ready | error
  const [progress, setProgress] = useState('');       // download / init progress text
  const engineRef = useRef(null);
  const initStarted = useRef(false);

  const initEngine = useCallback(async () => {
    if (initStarted.current) return;
    initStarted.current = true;

    try {
      setStatus('loading');
      // Dynamic import so web-llm isn't in the main bundle
      const webllm = await import('@mlc-ai/web-llm');
      const engine = await webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (info) => {
          setProgress(info.text || '');
        },
      });
      engineRef.current = engine;
      setStatus('ready');
    } catch (err) {
      console.error('WebLLM init failed:', err);
      setStatus('error');
      setProgress(err?.message || 'Browser AI not supported — using server fallback.');
    }
  }, []);

  // Start loading on mount
  useEffect(() => {
    initEngine();
  }, [initEngine]);

  const chat = useCallback(
    async (messages) => {
      // If engine ready, use in-browser model
      if (engineRef.current) {
        const formatted = [
          { role: 'system', content: SYSTEM_PROMPT(coachName) },
          ...messages.map((m) => ({
            role: m.role === 'coach' ? 'assistant' : 'user',
            content: m.text,
          })),
        ];
        const reply = await engineRef.current.chat.completions.create({
          messages: formatted,
          max_tokens: 256,
          temperature: 0.7,
        });
        return reply.choices[0]?.message?.content || "I'm not sure — could you rephrase that?";
      }

      // Fallback: server endpoint
      const last = messages[messages.length - 1];
      const res = await fetch('/api/coach/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 1, query: last?.text || '' }),
      });
      const data = await res.json();
      return data.answer;
    },
    [coachName]
  );

  return { coachName, status, progress, chat };
}
