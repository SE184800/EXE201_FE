(function (root) {
  'use strict';
  const PRICE = 19000;
  const TOP_UP = 5000000;
  const empty = () => ({ version: 1, balance: 0, expiresAt: null, history: [] });
  function addMonth(date) {
    const value = new Date(date);
    const day = value.getDate();
    value.setDate(1);
    value.setMonth(value.getMonth() + 1);
    const last = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
    value.setDate(Math.min(day, last));
    return value;
  }
  function createStore(storage, now = () => new Date()) {
    function read() {
      const raw = storage.read();
      if (!raw) return empty();
      const state = JSON.parse(raw);
      if (state.version !== 1 || !Number.isSafeInteger(state.balance) || state.balance < 0
        || !Array.isArray(state.history) || state.history.length > 100
        || (state.expiresAt !== null && !Number.isFinite(Date.parse(state.expiresAt)))) {
        throw new Error('Không đọc được dữ liệu demo. Chọn Đặt lại demo để bắt đầu lại.');
      }
      return state;
    }
    function save(state) {
      if (!storage.write(JSON.stringify(state))) throw new Error('Chưa lưu được dữ liệu trên máy. Giao dịch chưa hoàn tất.');
      return state;
    }
    function transact(type, requestId) {
      if (!requestId) throw new Error('Thiếu mã giao dịch.');
      const state = read();
      if (state.history.some(row => row.id === requestId)) return state;
      const time = now();
      let periodStart = null;
      if (type === 'DEPOSIT') {
        if (!Number.isSafeInteger(state.balance + TOP_UP)) throw new Error('Ví demo đã đạt giới hạn.');
        state.balance += TOP_UP;
      } else {
        if (state.balance < PRICE) {
          const error = new Error('Ví demo chưa đủ 19.000đ. Hãy nạp thử trước khi mua gói.');
          error.code = 'INSUFFICIENT_FUNDS';
          throw error;
        }
        periodStart = state.expiresAt && new Date(state.expiresAt) > time ? new Date(state.expiresAt) : time;
        state.expiresAt = addMonth(periodStart).toISOString();
        state.balance -= PRICE;
      }
      state.history.unshift({ id: requestId, type, amount: type === 'DEPOSIT' ? TOP_UP : PRICE,
        balanceAfter: state.balance, at: time.toISOString(), periodStart: periodStart?.toISOString() || null,
        periodEnd: type === 'PURCHASE' ? state.expiresAt : null });
      state.history = state.history.slice(0, 100);
      return save(state);
    }
    return { read, deposit: id => transact('DEPOSIT', id), purchase: id => transact('PURCHASE', id), reset: () => save(empty()) };
  }
  const api = { createStore, addMonth, PRICE, TOP_UP };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VipDemo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
