// Web Worker — runs AI model off the main thread
import { pipeline, env } from '@huggingface/transformers';

const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';

let generator = null;

async function init() {
  env.allowLocalModels = false;

  // No navigator.gpu in workers on most browsers — use WASM
  const device = typeof navigator !== 'undefined' && navigator.gpu ? 'webgpu' : 'wasm';
  const dtype = device === 'webgpu' ? 'fp16' : 'q4f16';

  generator = await pipeline('text-generation', MODEL_ID, {
    device,
    dtype,
    progress_callback: (p) => {
      if (p.status === 'progress' && p.total) {
        const pct = Math.round((p.loaded / p.total) * 100);
        self.postMessage({ type: 'progress', text: `Chat restarting… ${pct}%` });
      } else if (p.status === 'ready') {
        self.postMessage({ type: 'progress', text: 'Chat ready' });
      }
    },
  });

  self.postMessage({ type: 'status', status: 'ready' });
}

async function generate(id, messages) {
  if (!generator) {
    self.postMessage({ type: 'result', id, text: 'AI coach is still loading — please wait a moment and try again.' });
    return;
  }

  try {
    const output = await generator(messages, {
      max_new_tokens: 150,
      do_sample: true,
      temperature: 0.7,
      top_p: 0.9,
      repetition_penalty: 1.3,
      no_repeat_ngram_size: 3,
    });

    const generated = output[0]?.generated_text;
    let answer = "I'm not sure — could you rephrase that?";
    if (Array.isArray(generated)) {
      const last = generated.filter((m) => m.role === 'assistant').pop();
      if (last?.content) answer = last.content;
    } else if (generated) {
      answer = generated;
    }

    // De-duplicate repeated sentences
    const sentences = answer.split(/(?<=[.!?])\s+/);
    const seen = new Set();
    const deduped = sentences.filter((s) => {
      const key = s.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    answer = deduped.join(' ').trim() || answer;

    self.postMessage({ type: 'result', id, text: answer });
  } catch (err) {
    self.postMessage({ type: 'result', id, text: "Sorry, I couldn't process that. Try again!" });
  }
}

// Handle messages from main thread
self.onmessage = (e) => {
  const { type, id, messages } = e.data;
  if (type === 'init') {
    init().catch((err) => {
      self.postMessage({ type: 'status', status: 'error', error: err?.message || 'Failed to load AI model.' });
    });
  } else if (type === 'chat') {
    generate(id, messages);
  }
};
