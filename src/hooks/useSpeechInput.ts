import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Web Speech API types (not in all TS dom lib versions) ───────────────────

interface ISpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { readonly transcript: string; readonly confidence: number };
}

interface ISpeechRecognitionResultList {
  readonly length: number;
  readonly resultIndex: number;
  readonly results: ISpeechRecognitionResult[];
  [index: number]: ISpeechRecognitionResult;
}

interface ISpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: ISpeechRecognitionResultList;
}

interface ISpeechRecognitionErrorEvent {
  readonly error: string;
}

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
}

type ISpeechRecognitionCtor = new () => ISpeechRecognition;

// ─── Hook types ───────────────────────────────────────────────────────────────

interface UseSpeechInputOptions {
  onResult: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
  lang?: string;
}

interface UseSpeechInputReturn {
  listening: boolean;
  supported: boolean;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getSpeechRecognition(): ISpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w['SpeechRecognition'] ?? w['webkitSpeechRecognition'] ?? null) as ISpeechRecognitionCtor | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSpeechInput({ onResult, onInterim, lang }: UseSpeechInputOptions): UseSpeechInputReturn {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Start as false on both server and client to avoid hydration mismatch;
  // set the real value after mount (client-only).
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    setSupported(!!getSpeechRecognition());
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    setError(null);
    finalTranscriptRef.current = '';

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang ?? navigator.language ?? 'en-IN';
    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interim = '';
      let final = finalTranscriptRef.current;
      const results = event.results;
      for (let i = event.resultIndex; i < results.length; i++) {
        const result = results[i];
        if (result.isFinal) {
          final += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      finalTranscriptRef.current = final;
      if (onInterim) onInterim(final + interim);
    };

    recognition.onend = () => {
      setListening(false);
      const transcript = finalTranscriptRef.current.trim();
      if (transcript) onResult(transcript);
      recognitionRef.current = null;
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      setListening(false);
      if (event.error === 'no-speech' || event.error === 'network') {
        // Silently stop — no speech detected or transient network blip
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone permission in your browser.');
      } else {
        setError(`Voice input error: ${event.error}`);
      }
      recognitionRef.current = null;
    };

    recognition.start();
  }, [lang, onResult, onInterim]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return { listening, supported, startListening, stopListening, error };
}
