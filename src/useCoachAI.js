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

const MODEL_ID = 'HuggingFaceTB/SmolLM2-360M-Instruct';

export default function useCoachAI() {
  const [coachName] = useState(pickCoachName);
  const [status, setStatus] = useState('idle');      // idle | loading | ready | error
  const [progress, setProgress] = useState('');       // download / init progress text
  const pipelineRef = useRef(null);
  const initStarted = useRef(false);

  const initEngine = useCallback(async () => {
    if (initStarted.current) return;
    initStarted.current = true;

    try {
      setStatus('loading');
      setProgress('Loading AI model…');
      const { pipeline, env } = await import('@huggingface/transformers');
      // Use WebGPU if available, otherwise fall back to WASM (works everywhere)
      const device = navigator.gpu ? 'webgpu' : 'wasm';
      env.allowLocalModels = false;
      const generator = await pipeline('text-generation', MODEL_ID, {
        device,
        dtype: device === 'webgpu' ? 'fp16' : 'q4',
        progress_callback: (p) => {
          if (p.status === 'progress' && p.total) {
            const pct = Math.round((p.loaded / p.total) * 100);
            setProgress(`Downloading model… ${pct}%`);
          } else if (p.status === 'ready') {
            setProgress('Model ready');
          }
        },
      });
      pipelineRef.current = generator;
      setStatus('ready');
      setProgress('');
    } catch (err) {
      console.error('AI init failed:', err);
      setStatus('error');
      setProgress(err?.message || 'Failed to load AI model.');
    }
  }, []);

  useEffect(() => {
    initEngine();
  }, [initEngine]);

  const chat = useCallback(
    async (messages) => {
      if (!pipelineRef.current) {
        return 'AI coach is still loading — please wait a moment and try again.';
      }

      const chatMessages = [
        { role: 'system', content: SYSTEM_PROMPT(coachName) },
        ...messages.map((m) => ({
          role: m.role === 'coach' ? 'assistant' : 'user',
          content: m.text,
        })),
      ];

      const output = await pipelineRef.current(chatMessages, {
        max_new_tokens: 256,
        temperature: 0.7,
        do_sample: true,
      });

      const generated = output[0]?.generated_text;
      // generated_text is the full conversation array — grab the last assistant message
      if (Array.isArray(generated)) {
        const last = generated.filter((m) => m.role === 'assistant').pop();
        return last?.content || "I'm not sure — could you rephrase that?";
      }
      return generated || "I'm not sure — could you rephrase that?";
    },
    [coachName]
  );

  return { coachName, status, progress, chat };
}
