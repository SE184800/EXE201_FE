import { useEffect, useRef, useState } from 'react';
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void)
    | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};
export function useSaleSpeech(onText: (text: string) => void, onError: (message: string) => void) {
  const [listening, setListening] = useState(false);
  const active = useRef<Recognition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    const recognition = active.current;
    active.current = null;
    if (recognition) {
      recognition.onresult = recognition.onerror = recognition.onend = null;
      recognition.abort();
    }
    setListening(false);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      const recognition = active.current;
      if (recognition) {
        recognition.onresult = recognition.onerror = recognition.onend = null;
        recognition.abort();
      }
    },
    [],
  );
  const start = () => {
    if (active.current) return;
    const speechWindow = window as Window & {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      onError('Thiết bị chưa hỗ trợ giọng nói. Bạn vẫn có thể tìm và chọn hàng bằng tay.');
      return;
    }
    const recognition = new Constructor();
    active.current = recognition;
    recognition.lang = 'vi-VN';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || '';
      stop();
      onText(text);
    };
    recognition.onerror = (event) => {
      stop();
      onError(
        event.error === 'not-allowed'
          ? 'Chưa có quyền micro. Cho phép micro trong Cài đặt hoặc chọn hàng bằng tay.'
          : 'Chưa nhận được giọng nói. Thử lại hoặc chọn hàng bằng tay.',
      );
    };
    recognition.onend = () => {
      stop();
    };
    setListening(true);
    timer.current = setTimeout(() => {
      stop();
      onError('Hết thời gian nghe. Bạn có thể thử lại hoặc chọn hàng bằng tay.');
    }, 45000);
    try {
      recognition.start();
    } catch {
      stop();
      onError('Không mở được micro. Bạn có thể chọn hàng bằng tay.');
    }
  };
  return { listening, start, stop };
}
