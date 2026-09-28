/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { api, getApiError } from '../services/api';

type Product = { id: number; name: string; unit: string; sellingPrice: number | null };
const fillerWords = new Set(['chai', 'lon', 'goi', 'thung', 'hop', 'cai', 'lon', 'loai', 'lon']);
function cleanVoice(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[,.!?]/g, ' ').replace(/\s+/g, ' ').trim();
}
function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = old;
    }
  }
  return row[b.length];
}
function similar(a: string, b: string) {
  if (a === b || a.includes(b) || b.includes(a)) return 1;
  return 1 - distance(a, b) / Math.max(a.length, b.length);
}

export default function VoiceQuickSale({ items, onSaved }: { items: Product[]; onSaved: () => Promise<void> }) {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const [heardText, setHeardText] = useState('');
  const [pending, setPending] = useState<{ item: Product; quantity: number }[]>([]);
  async function confirm() {
    try {
      for (const row of pending) await api.post(`/inventory/${row.item.id}/movements`, { type: 'SALE', quantity: row.quantity, unitSalePrice: row.item.sellingPrice ?? 0, note: 'Bán nhanh bằng giọng nói', requestId: crypto.randomUUID() });
      setMessage(`Đã lưu: ${pending.map((row) => `${row.item.name} ${row.quantity}`).join(', ')}`);
      setPending([]); await onSaved();
    } catch (error) { setMessage(getApiError(error)); }
  }
  function start() {
    const SpeechRecognition = (window as Window & { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).SpeechRecognition || (window as Window & { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!SpeechRecognition) { setMessage('Hãy dùng Chrome hoặc Edge để nhập bằng giọng nói.'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN'; recognition.continuous = false; recognition.interimResults = false;
    setListening(true); setMessage('Đang nghe…');
    recognition.onresult = async (event: any) => {
      const text = String(event.results?.[0]?.[0]?.transcript || '');
      const normalized = cleanVoice(text);
      const segments = [...normalized.matchAll(/(.+?)\s+(\d+)(?=\s|$)/g)].map((match) => ({ phrase: match[1].trim(), quantity: Number(match[2]) }));
      const matched: { item: Product; quantity: number }[] = [];
      for (const segment of segments) {
        const spokenWords = segment.phrase.split(/\s+/).filter((word) => !fillerWords.has(word));
        const candidates = items.map((item) => {
          const words = cleanVoice(item.name).split(/\s+/).filter((word) => word.length > 1 && !fillerWords.has(word));
          const scores = words.map((word) => Math.max(...spokenWords.map((spoken) => similar(word, spoken)), 0));
          const score = scores.reduce((sum, value) => sum + value, 0) / Math.max(words.length, 1);
          const exact = words.filter((word) => spokenWords.includes(word)).length;
          return { item, score, exact, strong: scores.filter((value) => value >= 0.8).length };
        }).filter((candidate) => candidate.strong > 0 && candidate.score >= 0.3).sort((a, b) => b.exact - a.exact || b.score - a.score);
        if (!candidates.length) continue;
        if (candidates[0].exact === 0 && candidates[1] && candidates[0].score - candidates[1].score < 0.12) {
          setHeardText(text); setMessage(`Cụm “${segment.phrase} ${segment.quantity}” chưa rõ quy cách. Hãy nói thêm dung tích, ví dụ “Aquafina 350ml 5”.`); return;
        }
        matched.push({ item: candidates[0].item, quantity: segment.quantity });
      }
      if (!matched.length) { setMessage(`Đã nghe “${text}” nhưng chưa nhận ra sản phẩm.`); return; }
      setHeardText(text); setPending(matched); setMessage('Kiểm tra nội dung đã nghe rồi bấm Xác nhận lưu.');
    };
    recognition.onerror = () => setMessage('Không nghe rõ, hãy thử nói “Coca 12, Sting 8”.');
    recognition.onend = () => setListening(false);
    recognition.start();
  }
  return <section className="dashboard-card voice-quick-sale"><div className="card-heading"><div><span className="section-kicker">BÁN NHANH</span><h2>Nói để cập nhật cuối ca</h2></div><button className="dash-primary" type="button" onClick={start} disabled={listening}>{listening ? '🎙️ Đang nghe…' : '🎙️ Bắt đầu nói'}</button></div><p className="stock-help">Ví dụ: “Coca 12, Sting 8, mì Hảo Hảo 5”. Hệ thống sẽ hiện lại nội dung trước khi lưu.</p>{heardText && <div className="voice-preview" role="status"><strong>Đã nghe:</strong> “{heardText}”<ul>{pending.map((row) => <li key={row.item.id}>{row.item.name}: {row.quantity} {row.item.unit}</li>)}</ul><button className="dash-primary" type="button" onClick={() => void confirm()}>Xác nhận lưu</button><button type="button" onClick={() => { setPending([]); setHeardText(''); setMessage('Đã hủy, bạn có thể nói lại.'); }}>Nói lại</button></div>}{message && <p className="inventory-notice" role="status">{message}</p>}</section>;
}
