(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const money = amount => amount.toLocaleString('vi-VN') + ' ₫';
  const date = value => value ? new Date(value).toLocaleDateString('vi-VN') : '—';
  const store = VipDemo.createStore(window.DemoStorage || {
    read: () => localStorage.getItem('supplymind-vip-demo'),
    write: value => { localStorage.setItem('supplymind-vip-demo', value); return true; },
  });
  let locked = false;
  const id = () => globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2);
  function notify(text, error = false) {
    $('message').textContent = text;
    $('message').hidden = false;
    $('message').classList.toggle('error', error);
    $('message').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function render() {
    const state = store.read();
    const active = !!state.expiresAt && new Date(state.expiresAt) > new Date();
    $('balance').textContent = money(state.balance);
    $('plan-name').textContent = active ? 'VIP Basic' : state.expiresAt ? 'Gói đã hết hạn' : 'Chưa có gói VIP';
    $('badge').textContent = active ? 'Đang dùng · demo' : 'Chưa kích hoạt';
    $('badge').classList.toggle('active', active);
    $('plan-description').textContent = active ? 'Gói Basic đã được kích hoạt trên điện thoại này.' : 'Mua Basic để trải nghiệm luồng kích hoạt gói.';
    $('expiry').textContent = date(state.expiresAt);
    $('days').textContent = Math.max(0, Math.ceil((new Date(state.expiresAt || 0).getTime() - Date.now()) / 86400000)) + ' ngày';
    const shortage = Math.max(0, VipDemo.PRICE - state.balance);
    $('purchase-hint').textContent = shortage ? 'Số dư demo chưa đủ để mua gói.' : 'Ví còn ' + money(state.balance - VipDemo.PRICE) + ' sau khi mua.';
    $('buy').textContent = active ? 'Gia hạn 1 tháng · 19.000đ' : 'Mua VIP Basic · 19.000đ';
    $('rights-status').textContent = active ? 'Gói demo đang hoạt động đến ' + date(state.expiresAt) : 'Chưa kích hoạt gói demo';
    $('history-empty').hidden = state.history.length > 0;
    $('transactions').replaceChildren();
    state.history.forEach(item => {
      const li = document.createElement('li');
      const row = document.createElement('div'); row.className = 'row';
      const label = document.createElement('b'); label.textContent = item.type === 'DEPOSIT' ? 'Nạp thử vào ví' : 'Mua VIP Basic';
      const amount = document.createElement('span'); amount.className = 'amount ' + (item.type === 'DEPOSIT' ? 'credit' : 'debit');
      amount.textContent = (item.type === 'DEPOSIT' ? '+' : '−') + money(item.amount);
      row.append(label, amount); li.append(row);
      const details = document.createElement('small'); details.textContent = new Date(item.at).toLocaleString('vi-VN') + ' · Số dư ' + money(item.balanceAfter); li.append(details);
      if (item.periodEnd) { const period = document.createElement('small'); period.textContent = 'Thời hạn thêm: ' + date(item.periodStart) + ' → ' + date(item.periodEnd); li.append(period); }
      $('transactions').append(li);
    });
  }
  function transact(operation, message) {
    if (locked) return;
    locked = true;
    $('buy').disabled = true;
    try { const result = operation(); render(); notify(message(result)); }
    catch (error) { notify(error.message, true); }
    finally { setTimeout(() => { locked = false; $('buy').disabled = false; }, 650); }
  }
  $('buy').onclick = () => {
    if (locked) return;
    try {
      const state = store.read();
      if (state.balance < VipDemo.PRICE) { notify('Số dư demo chưa đủ để mua gói.', true); return; }
      $('confirm-eyebrow').textContent = 'XÁC NHẬN MUA GÓI';
      $('confirm-title').textContent = 'Kích hoạt thêm 1 tháng Basic?';
      $('confirm-description').textContent = 'Trừ 19.000đ từ ví demo. Số dư sau khi mua: ' + money(state.balance - VipDemo.PRICE) + '. Thời gian còn lại được giữ nguyên.';
      $('confirm-action').textContent = 'Trừ 19.000đ & kích hoạt';
      $('confirm').showModal();
    } catch (error) { notify(error.message, true); }
  };
  $('confirm').addEventListener('close', () => {
    if ($('confirm').returnValue !== 'confirm') return;
    $('confirm').returnValue = '';
    transact(() => store.purchase(id()), state => 'Đã trừ 19.000đ. VIP Basic hoạt động đến ' + date(state.expiresAt) + '.');
  });
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.onclick = () => {
      document.querySelectorAll('[data-tab]').forEach(item => { const selected = item === button; item.classList.toggle('selected', selected); item.setAttribute('aria-selected', String(selected)); });
      document.querySelectorAll('.panel').forEach(panel => { panel.hidden = panel.id !== button.dataset.tab; });
      render();
    };
  });
  $('open-main').onclick = () => {
    if (window.DemoStorage?.openMain) window.DemoStorage.openMain();
    else notify('Nút này mở app chính khi chạy bản APK trên Android.');
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { try { render(); } catch (e) { notify(e.message, true); } } });
  try { render(); } catch (error) { notify(error.message, true); $('buy').disabled = true; }
})();
