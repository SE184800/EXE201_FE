import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderPaymentSummary, supplierPaymentBank } from '../src/utils/orderPayment.ts';
const order = { subtotal: 100000, deliveryFee: 10000, depositAmount: 20000, depositStatus: 'PAID' };

test('remaining amount subtracts only a paid deposit and caps damaged goods at the subtotal', () => {
  assert.equal(orderPaymentSummary(order).remaining, 90000);
  assert.equal(orderPaymentSummary({ ...order, depositStatus: 'SUBMITTED' }).remaining, 110000);
  assert.equal(orderPaymentSummary(order, 15000).remaining, 75000);
  assert.equal(orderPaymentSummary({ ...order, depositStatus: 'PENDING' }, 999999).remaining, 10000);
});
test('paid wallet or confirmed cash never asks the buyer to pay again', () => {
  assert.equal(orderPaymentSummary({ ...order, walletPayment: { status: 'SETTLED', amount: 110000 } }).remaining, 0);
  assert.equal(orderPaymentSummary({ ...order, driverInfo: { paymentInfo: { status: 'CONFIRMED' } } }).remaining, 0);
  assert.equal(orderPaymentSummary({ ...order, walletPayment: { status: 'SETTLED', amount: 110000, refunded: true } }).paid, false);
  assert.equal(orderPaymentSummary({ ...order, walletPayment: { status: 'SETTLED', amount: 1 } }).paid, false);
  assert.equal(orderPaymentSummary({ ...order, status: 'REJECTED' }).remaining, 0);
});
test('missing or demo bank details never fall back to another bank account', () => {
  assert.equal(supplierPaymentBank(null), null);
  assert.equal(supplierPaymentBank({ bankName: 'DEMO', bankAccountNumber: 'DEMO0000', bankAccountHolder: 'DEMO' }), null);
  assert.deepEqual(supplierPaymentBank({ bankName: ' Bank ', bankAccountNumber: '123456789', bankAccountHolder: ' Shop ' }), { name: 'Bank', account: '123456789', holder: 'Shop' });
});
