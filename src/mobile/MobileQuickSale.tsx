import { useEffect, useRef, useState } from 'react';
import { api, getApiError, isUnauthenticated } from '../services/api';
import {
  normalizeSaleText,
  parseSpokenSale,
  readJournal,
  SALE_STORAGE_PREFIX,
  saleTotal,
  unavailableReason,
  validateSale,
  type SaleItem,
  type SaleJournal,
  type SaleRequest,
} from './quickSale';
import { useSaleSpeech } from './useSaleSpeech';
const money = (value: number) => value.toLocaleString('vi-VN') + ' ₫';

export default function MobileQuickSale({
  ownerId,
  items,
  loading,
  onRefresh,
  onLogout,
}: {
  ownerId: number;
  items: SaleItem[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const key = SALE_STORAGE_PREFIX + ownerId;
  const empty = (): SaleJournal => ({ version: 1, ownerId, phase: 'draft', rows: [] });
  const [journal, setJournal] = useState<SaleJournal>(() => {
    try {
      return readJournal(localStorage.getItem(key), ownerId) || empty();
    } catch {
      return empty();
    }
  });
  const current = useRef(journal);
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [heard, setHeard] = useState('');
  const pending = journal.phase === 'pending';
  const rows = journal.phase === 'done' ? [] : journal.rows;

  function persist(value: SaleJournal) {
    // Persist before a request: an interrupted app must retry the same IDs.
    localStorage.setItem(key, JSON.stringify(value));
    current.current = value;
    setJournal(value);
  }
  function editRows(next: SaleRequest[]) {
    if (sending.current || current.current.phase === 'pending') return;
    try {
      persist({ ...empty(), rows: next });
      setMessage('');
    } catch {
      setMessage('Không lưu được lượt bán trên thiết bị. Kiểm tra dung lượng trống rồi thử lại.');
    }
  }
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== key || sending.current) return;
      const next = readJournal(event.newValue, ownerId);
      if (next) {
        current.current = next;
        setJournal(next);
      }
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [key, ownerId]);

  function addItems(additions: { item: SaleItem; quantity: number }[]) {
    const next = [...(current.current.phase === 'done' ? [] : current.current.rows)].map((row) => ({
      ...row,
    }));
    for (const { item, quantity } of additions) {
      const existing = next.find((row) => row.itemId === item.id);
      if (existing) existing.quantity += quantity;
      else
        next.push({
          itemId: item.id,
          name: item.name,
          unit: item.unit,
          quantity,
          unitSalePrice: item.sellingPrice ?? 0,
          requestId: crypto.randomUUID(),
        });
    }
    const issue = validateSale(next, items);
    if (issue) {
      setMessage(issue);
      return;
    }
    editRows(next);
  }
  const speech = useSaleSpeech((text) => {
    setHeard(text);
    const result = parseSpokenSale(text, items);
    if (result.error) setMessage(result.error);
    else addItems(result.lines);
  }, setMessage);

  async function save() {
    if (sending.current || speech.listening) return;
    sending.current = true;
    setBusy(true);
    setMessage('');
    const submit = async () => {
      // Another tab may already have submitted this draft. Reuse its immutable request.
      const stored = readJournal(localStorage.getItem(key), ownerId);
      if (stored?.phase === 'done' && current.current.phase !== 'done') {
        current.current = stored;
        setJournal(stored);
        setMessage('Lượt bán này đã được lưu ở cửa sổ khác.');
        return;
      }
      const source = stored?.phase === 'pending' ? stored : current.current;
      if (source.phase === 'done' || !source.rows.length) return;
      const wasPending = source.phase === 'pending';
      if (!wasPending) {
        const issue = validateSale(source.rows, items);
        if (loading || issue) {
          setMessage(issue || 'Đang tải kho. Chờ tải xong rồi xác nhận.');
          return;
        }
      }
      const request: SaleJournal = { ...source, phase: 'pending' };
      persist(request);
      try {
        const { data } = await api.post<{ movements: { id: string }[] }>(
          '/inventory/sales/batch',
          {
            rows: request.rows.map(({ itemId, unit, quantity, unitSalePrice, requestId }) => ({
              itemId,
              unit,
              quantity,
              unitSalePrice,
              requestId,
            })),
          },
          { timeout: 30000 },
        );
        if (
          !Array.isArray(data.movements) ||
          request.rows.some(
            (row) => !data.movements.some((movement) => movement.id === row.requestId),
          )
        )
          throw new Error('Unconfirmed sale response');
        persist({ ...request, phase: 'done', savedAt: new Date().toISOString() });
        setHeard('');
        try {
          await onRefresh();
        } catch {
          setMessage('Đã lưu lượt bán. Chưa tải lại được số tồn; hãy bấm tải lại kho.');
        }
      } catch (error) {
        const status = (error as { response?: { status?: number } }).response?.status;
        // A definitive rejection of the first attempt allows corrections. Once a
        // result is uncertain, never change the payload until the server confirms it.
        if (!wasPending && status && [400, 403, 404, 409, 422].includes(status)) {
          persist({ ...request, phase: 'draft' });
          setMessage(getApiError(error));
          await onRefresh().catch(() => {});
        } else {
          setMessage(
            'Chưa xác nhận được kết quả. Giữ nguyên lượt bán và bấm “Kiểm tra lại lượt bán”; app sẽ không tạo lượt mới.',
          );
        }
        if (isUnauthenticated(error)) onLogout();
      }
    };
    try {
      if (navigator.locks)
        await navigator.locks.request(key, { ifAvailable: true }, async (lock) => {
          if (!lock) {
            setMessage('Lượt bán đang được xử lý ở cửa sổ khác. Chờ một chút rồi thử lại.');
            return;
          }
          await submit();
        });
      else await submit();
    } catch {
      setMessage('Không lưu được trạng thái lượt bán trên thiết bị. Chưa thể gửi lượt bán mới.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const matches = items.filter((item) =>
    normalizeSaleText(item.name + ' ' + item.unit).includes(normalizeSaleText(search)),
  );
  const issue = rows.length ? validateSale(rows, items) : '';
  return (
    <section className="mobile-quick-sale" aria-label="Bán nhanh">
      <div className="mobile-sale-intro">
        <span>BÁN HÀNG TẠI QUẦY</span>
        <h1>Bán nhanh</h1>
        <p>Chọn hàng hoặc nói tên món. Kiểm tra rồi lưu một lần.</p>
      </div>
      {journal.phase === 'done' && (
        <div className="mobile-sale-receipt" role="status">
          <strong>✓ Đã ghi nhận bán · {money(saleTotal(journal.rows))}</strong>
          <p>{journal.rows.map((row) => `${row.name} × ${row.quantity}`).join(' · ')}</p>
          <small>Đã trừ kho và ghi nhận doanh thu. Chọn hàng để bắt đầu lượt mới.</small>
        </div>
      )}
      {pending && (
        <div className="mobile-sale-warning" role="alert">
          <strong>Lượt bán đang chờ xác nhận</strong>
          <p>
            Giữ nguyên mặt hàng và số lượng để kiểm tra kết quả an toàn, kể cả khi bạn vừa mở lại
            app.
          </p>
        </div>
      )}
      {message && (
        <p className="mobile-sale-message" role="alert">
          {message}
        </p>
      )}
      <div className="mobile-sale-entry">
        <button
          type="button"
          className="mobile-voice-button"
          disabled={busy || pending || loading}
          onClick={speech.listening ? speech.stop : speech.start}
        >
          <span aria-hidden="true">{speech.listening ? '■' : '🎙'}</span>
          <span>
            <strong>{speech.listening ? 'Đang nghe · Bấm để dừng' : 'Nói để thêm hàng'}</strong>
            <small>Ví dụ: “Coca 2 và mì Hảo Hảo 3”</small>
          </span>
        </button>
        {heard && (
          <p className="mobile-heard">Đã nghe: “{heard}” — hãy kiểm tra lại các món bên dưới.</p>
        )}
        <label className="mobile-search">
          <span>Tìm mặt hàng</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tên hàng, đơn vị…"
            autoComplete="off"
          />
        </label>
      </div>
      {rows.length > 0 && (
        <section className="mobile-sale-cart" aria-label="Lượt bán hiện tại">
          <div className="mobile-section-title">
            <h2>
              Đang bán <span>{rows.length} món</span>
            </h2>
            <button disabled={busy || pending || speech.listening} onClick={() => editRows([])}>
              Bỏ tất cả
            </button>
          </div>
          {rows.map((row) => (
            <article className="mobile-cart-row" key={row.itemId}>
              <div>
                <strong>{row.name}</strong>
                <small>
                  {money(row.unitSalePrice)} / {row.unit}
                </small>
              </div>
              <button
                className="mobile-remove"
                aria-label={`Bỏ ${row.name}`}
                disabled={busy || pending || speech.listening}
                onClick={() => editRows(rows.filter((item) => item.itemId !== row.itemId))}
              >
                ×
              </button>
              <div className="mobile-stepper">
                <button
                  aria-label={`Giảm ${row.name}`}
                  disabled={busy || pending || speech.listening || row.quantity <= 1}
                  onClick={() =>
                    editRows(
                      rows.map((item) =>
                        item.itemId === row.itemId
                          ? { ...item, quantity: item.quantity - 1 }
                          : item,
                      ),
                    )
                  }
                >
                  −
                </button>
                <input
                  aria-label={`Số lượng ${row.name}`}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  disabled={busy || pending || speech.listening}
                  value={row.quantity || ''}
                  onChange={(event) =>
                    editRows(
                      rows.map((item) =>
                        item.itemId === row.itemId
                          ? { ...item, quantity: Number(event.target.value) }
                          : item,
                      ),
                    )
                  }
                />
                <button
                  aria-label={`Tăng ${row.name}`}
                  disabled={
                    busy ||
                    pending ||
                    speech.listening ||
                    row.quantity >= (items.find((item) => item.id === row.itemId)?.quantity ?? 0)
                  }
                  onClick={() =>
                    addItems([{ item: items.find((item) => item.id === row.itemId)!, quantity: 1 }])
                  }
                >
                  +
                </button>
              </div>
              <b>{money(row.quantity * row.unitSalePrice)}</b>
            </article>
          ))}
          {!pending && issue && (
            <p className="mobile-sale-message" role="alert">
              {issue}
            </p>
          )}
        </section>
      )}
      <div className="mobile-section-title">
        <h2>
          Hàng trong kho <span>{matches.length}</span>
        </h2>
        <button
          disabled={busy || loading}
          onClick={() =>
            void onRefresh().catch(() =>
              setMessage('Chưa tải được kho. Kiểm tra kết nối rồi thử lại.'),
            )
          }
        >
          {loading ? 'Đang tải…' : 'Tải lại'}
        </button>
      </div>
      {!loading && !matches.length && (
        <p className="mobile-empty">
          {search
            ? 'Không tìm thấy mặt hàng phù hợp.'
            : 'Kho chưa có hàng. Nhập hàng trên web rồi tải lại tại đây.'}
        </p>
      )}
      <div className="mobile-sale-products">
        {matches.map((item) => {
          const reason = unavailableReason(item);
          const selected = rows.find((row) => row.itemId === item.id)?.quantity || 0;
          return (
            <button
              key={item.id}
              type="button"
              className={selected ? 'selected' : ''}
              disabled={
                !!reason ||
                busy ||
                pending ||
                loading ||
                speech.listening ||
                selected >= item.quantity
              }
              onClick={() => addItems([{ item, quantity: 1 }])}
              aria-label={`Thêm ${item.name}`}
            >
              <span className="mobile-product-symbol" aria-hidden="true">
                {item.name.slice(0, 1).toUpperCase()}
              </span>
              <strong>{item.name}</strong>
              <small>{reason || `Còn ${item.quantity} ${item.unit}`}</small>
              <b>{item.sellingPrice != null ? money(item.sellingPrice) : 'Chưa có giá'}</b>
              <span className="mobile-add-mark">{selected ? `Đã chọn ${selected}` : '+'}</span>
            </button>
          );
        })}
      </div>
      {rows.length > 0 && (
        <div className="mobile-sale-checkout">
          <div>
            <span>{rows.reduce((sum, row) => sum + row.quantity, 0)} đơn vị · Tổng tiền</span>
            <strong>{money(saleTotal(rows))}</strong>
          </div>
          <button
            disabled={busy || speech.listening || (!pending && (!!issue || loading))}
            onClick={() => void save()}
          >
            {busy ? 'Đang xác nhận…' : pending ? 'Kiểm tra lại lượt bán' : 'Ghi nhận bán'}
          </button>
        </div>
      )}
    </section>
  );
}
