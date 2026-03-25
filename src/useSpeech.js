import { useState, useRef, useCallback } from 'react';

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

export default function useSpeech() {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => !!SpeechRecognition);
  const recRef = useRef(null);

  const start = useCallback((onResult) => {
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      onResult(text);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, []);

  const stop = useCallback(() => {
    if (recRef.current) {
      recRef.current.stop();
      setListening(false);
    }
  }, []);

  return { listening, supported, start, stop };
}
