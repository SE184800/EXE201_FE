import { useEffect, useState, type FormEvent } from 'react';
import Icon from '../components/Icon';
import { getApiError, isUnauthenticated } from '../services/api';
import {
  acceptMarketingQuote,
  getStoreQuotes,
  rejectMarketingQuote,
  type MarketingQuote,
} from '../services/quote.api';
import './catalog.css';

const money = (value: number) => value.toLocaleString('vi-VN') + ' ₫';
const labels: Record<string, string> = {
  SENT: 'Chờ phản hồi',
  ACCEPTED: 'Đã chấp nhận',
  REJECTED: 'Đã từ chối',
  CANCELLED: 'Chủ vựa đã hủy',
  EXPIRED: 'Đã hết hạn',
};

export default function StoreQuotes({ onLogout }: { onLogout: () => void }) {
  const [quotes, setQuotes] = useState<MarketingQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState('');
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<MarketingQuote | null>(null);
  const [rejecting, setRejecting] = useState<MarketingQuote | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getStoreQuotes(1, status)
      .then((data) => {
        if (active) {
          setQuotes(data.quotes);
          setError('');
        }
      })
      .catch((issue) => {
        if (active) {
          setError(getApiError(issue));
          if (isUnauthenticated(issue)) onLogout();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onLogout, revision, status]);

  async function reject(quote: MarketingQuote, responseNote: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await rejectMarketingQuote(quote.id, responseNote);
      setRejecting(null);
      setNotice(`Đã từ chối báo giá #${quote.id}.`);
      setRevision((value) => value + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="store-quotes">
      <div className="catalog-hero">
        <div>
          <p className="form-eyebrow">ĐỀ XUẤT TỪ CHỦ VỰA</p>
          <h1>Báo giá tiếp thị</h1>
          <p>
            Xem giá riêng chủ vựa gửi cho cửa hàng, điều kiện đặt cọc và chuyển báo giá thành đơn
            mua chỉ với một lần xác nhận.
          </p>
        </div>
        <Icon name="box" />
      </div>
      <div className="catalog-results-heading">
        <label className="order-filter">
          Trạng thái
          <select
            value={status}
            onChange={(event) => {
              setLoading(true);
              setStatus(event.target.value);
            }}
          >
            <option value="">Tất cả</option>
            <option value="SENT">Chờ phản hồi</option>
            <option value="ACCEPTED">Đã chấp nhận</option>
            <option value="REJECTED">Đã từ chối</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </label>
        <button
          className="ghost-button"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setRevision((value) => value + 1);
          }}
        >
          ↻ Tải lại báo giá
        </button>
      </div>
      {notice && (
        <p className="supplier-success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error-notice" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="supplier-panel" role="status">
          Đang tải báo giá…
        </p>
      ) : !quotes.length ? (
        <section className="supplier-panel catalog-empty">
          <Icon name="box" />
          <h2>Chưa có báo giá</h2>
          <p>Khi chủ vựa tiếp thị và gửi giá riêng, báo giá sẽ xuất hiện tại đây.</p>
        </section>
      ) : (
        <div className="store-quote-grid">
          {quotes.map((quote) => (
            <article className="supplier-panel quote-card" key={quote.id}>
              <div className="quote-card-head">
                <div>
                  <span className="supplier-panel-label">BÁO GIÁ #{quote.id}</span>
                  <h2>{quote.title}</h2>
                  <p>
                    {quote.supplier?.businessName}
                    {quote.supplier?.phone ? ` · ${quote.supplier.phone}` : ''}
                  </p>
                </div>
                <span className={`quote-status quote-${quote.status.toLowerCase()}`}>
                  {labels[quote.status]}
                </span>
              </div>
              <div className="quote-items">
                {quote.lines.map((line) => (
                  <span key={line.id}>
                    <strong>{line.productName}</strong> · {line.quantity} × {line.packaging} ·{' '}
                    {money(line.unitPrice)} = {money(line.lineTotal)}
                  </span>
                ))}
              </div>
              {quote.note && (
                <p className="order-delivery">
                  <strong>Điều kiện từ chủ vựa:</strong>
                  <br />
                  {quote.note}
                </p>
              )}
              <dl className="quote-summary">
                <div>
                  <dt>Tiền hàng</dt>
                  <dd>{money(quote.subtotal)}</dd>
                </div>
                <div>
                  <dt>Phí giao</dt>
                  <dd>{money(quote.deliveryFee)}</dd>
                </div>
                <div>
                  <dt>Cọc chuyển khoản {quote.depositRate}%</dt>
                  <dd>{money(quote.depositAmount)}</dd>
                </div>
                <div>
                  <dt>Tổng báo giá</dt>
                  <dd>{money(quote.total)}</dd>
                </div>
              </dl>
              {quote.depositAmount > 0 && quote.supplier?.bankAccountNumber && (
                <p className="quote-bank-note">
                  Cọc chuyển trực tiếp đến {quote.supplier.bankName} ·{' '}
                  <strong>{quote.supplier.bankAccountNumber}</strong> ·{' '}
                  {quote.supplier.bankAccountHolder}
                </p>
              )}
              <p className="catalog-hint">
                Hiệu lực đến {new Date(quote.validUntil + 'T00:00:00').toLocaleDateString('vi-VN')}.
              </p>
              {quote.responseNote && (
                <p className="order-rejection">Phản hồi của cửa hàng: {quote.responseNote}</p>
              )}
              {quote.orderId && (
                <p className="supplier-success">
                  Đã tạo đơn mua #{quote.orderId}. Theo dõi tại mục Đơn mua hàng.
                </p>
              )}
              {quote.status === 'SENT' && (
                <div className="supplier-dialog-actions">
                  <button
                    className="ghost-button"
                    disabled={busy}
                    onClick={() => setRejecting(quote)}
                  >
                    Từ chối
                  </button>
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={() => setSelected(quote)}
                  >
                    Chấp nhận & tạo đơn
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {selected && (
        <AcceptQuoteDialog
          quote={selected}
          busy={busy}
          onCancel={() => setSelected(null)}
          onLogout={onLogout}
          onAccepted={(orderId) => {
            setSelected(null);
            setNotice(
              `Đã tạo đơn mua #${orderId}. ${selected.depositAmount > 0 ? 'Hãy vào Đơn mua hàng để xem thông tin chuyển cọc.' : ''}`,
            );
            setRevision((value) => value + 1);
          }}
        />
      )}
      {rejecting && (
        <RejectQuoteDialog
          quote={rejecting}
          busy={busy}
          onCancel={() => setRejecting(null)}
          onReject={(note) => void reject(rejecting, note)}
        />
      )}
    </section>
  );
}

function AcceptQuoteDialog({
  quote,
  busy,
  onCancel,
  onLogout,
  onAccepted,
}: {
  quote: MarketingQuote;
  busy: boolean;
  onCancel: () => void;
  onLogout: () => void;
  onAccepted: (orderId: number) => void;
}) {
  const [form, setForm] = useState({
    recipientName: quote.buyer?.name || '',
    recipientPhone: quote.buyer?.phone || '',
    deliveryAddress: '',
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const order = await acceptMarketingQuote(quote.id, {
        ...form,
        requestId: crypto.randomUUID(),
      });
      onAccepted(order.id);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="supplier-dialog-backdrop">
      <form className="supplier-dialog quote-accept-dialog" onSubmit={submit}>
        <span className="supplier-panel-label">BÁO GIÁ #{quote.id}</span>
        <h2>Chấp nhận và tạo đơn mua</h2>
        <p>Giá và số lượng được giữ theo báo giá. Chủ vựa vẫn kiểm tra tồn trước khi duyệt đơn.</p>
        <label className="supplier-dialog-field">
          <span>Người nhận</span>
          <input
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            placeholder="Ví dụ: Võ Ngọc Duy"
            value={form.recipientName}
            onChange={(event) => setForm({ ...form, recipientName: event.target.value })}
          />
        </label>
        <label className="supplier-dialog-field">
          <span>Số điện thoại</span>
          <input
            required
            type="tel"
            maxLength={30}
            inputMode="tel"
            autoComplete="tel"
            placeholder="Ví dụ: 0912345678"
            value={form.recipientPhone}
            onChange={(event) => setForm({ ...form, recipientPhone: event.target.value })}
          />
        </label>
        <label className="supplier-dialog-field">
          <span>Địa chỉ giao hàng</span>
          <textarea
            required
            minLength={10}
            maxLength={500}
            rows={3}
            value={form.deliveryAddress}
            onChange={(event) => setForm({ ...form, deliveryAddress: event.target.value })}
          />
        </label>
        <label className="supplier-dialog-field">
          <span>Ghi chú thêm</span>
          <textarea
            maxLength={500}
            rows={2}
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </label>
        <div className="quote-total">
          <span>Tổng đơn: {money(quote.total)}</span>
          <span>Cọc chuyển khoản: {money(quote.depositAmount)}</span>
          <strong>Còn lại khi giao: {money(quote.total - quote.depositAmount)}</strong>
        </div>
        {error && <p className="error-notice">{error}</p>}
        <div className="supplier-dialog-actions">
          <button
            type="button"
            className="ghost-button"
            disabled={saving || busy}
            onClick={onCancel}
          >
            Hủy
          </button>
          <button className="primary-button" disabled={saving || busy}>
            {saving ? 'Đang tạo đơn…' : 'Chấp nhận báo giá'}
          </button>
        </div>
      </form>
    </div>
  );
}

function RejectQuoteDialog({
  quote,
  busy,
  onCancel,
  onReject,
}: {
  quote: MarketingQuote;
  busy: boolean;
  onCancel: () => void;
  onReject: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  return (
    <div className="supplier-dialog-backdrop">
      <form
        className="supplier-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onReject(note);
        }}
      >
        <span className="supplier-panel-label">BÁO GIÁ #{quote.id}</span>
        <h2>Từ chối báo giá</h2>
        <label className="supplier-dialog-field">
          <span>Lý do / phản hồi cho chủ vựa</span>
          <textarea
            maxLength={500}
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ví dụ: giá chưa phù hợp hoặc chưa cần nhập đợt này…"
          />
        </label>
        <div className="supplier-dialog-actions">
          <button type="button" className="ghost-button" disabled={busy} onClick={onCancel}>
            Hủy
          </button>
          <button className="table-button danger" disabled={busy}>
            {busy ? 'Đang gửi…' : 'Xác nhận từ chối'}
          </button>
        </div>
      </form>
    </div>
  );
}
