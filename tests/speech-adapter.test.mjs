import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/supplymind-speech.js', import.meta.url), 'utf8');

function setup() {
  const timers = new Map();
  const calls = [];
  const callbacks = [];
  let tick = 0;
  const document = new EventTarget();
  const window = new EventTarget();
  window.Capacitor = {
    Plugins: {
      SupplyMindSpeech: {
        listen(options, callback) {
          calls.push(['listen', options]);
          callbacks.push(callback);
        },
        async cancel(options) {
          calls.push(['cancel', options]);
        },
        async stop(options) {
          calls.push(['stop', options]);
        },
      },
    },
  };
  vm.runInNewContext(source, {
    window,
    document,
    EventTarget,
    Event,
    DOMException,
    setTimeout(fn) {
      timers.set(++tick, fn);
      return tick;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  });
  return { window, document, calls, callbacks, timers, Recognition: window.SpeechRecognition };
}

test('native results preserve the Web Speech shape used by the hosted FE', () => {
  const { Recognition, callbacks, timers } = setup();
  const speech = new Recognition();
  const events = [];
  speech.onstart = () => events.push('start');
  speech.onresult = (e) => {
    events.push(e.results[0][0].transcript);
    assert.equal(e.results[0].isFinal, true);
  };
  speech.onend = () => events.push('end');
  speech.start();
  assert.deepEqual(events, [], 'do not announce listening before native mic is ready');
  callbacks[0]({ type: 'start' });
  callbacks[0]({ type: 'result', transcript: 'Coca 2' });
  assert.deepEqual(events, ['start', 'Coca 2', 'end']);
  assert.equal(timers.size, 0);
});

test('permission denial ends the session and allows retry', () => {
  const { Recognition, callbacks, timers } = setup();
  const speech = new Recognition();
  const events = [];
  speech.onerror = (e) => events.push(e.error);
  speech.onend = () => events.push('end');
  speech.start();
  callbacks[0](null, { code: 'not-allowed', message: 'Permission denied' });
  assert.deepEqual(events, ['not-allowed', 'end']);
  assert.equal(timers.size, 0);
  assert.doesNotThrow(() => speech.start());
  speech.abort();
});

test('no response times out, cancels native recognition and ignores late results', () => {
  const { Recognition, callbacks, timers, calls } = setup();
  const speech = new Recognition();
  const events = [];
  speech.onerror = (e) => events.push(e.error);
  speech.onresult = () => events.push('result');
  speech.onend = () => events.push('end');
  speech.start();
  [...timers.values()][0]();
  callbacks[0]({ type: 'result', transcript: 'Late result' });
  assert.deepEqual(events, ['no-speech', 'end']);
  assert.equal(calls.at(-1)[0], 'cancel');
});

test('double start is rejected; cancellation and old callbacks cannot end a newer session', () => {
  const { Recognition, callbacks } = setup();
  const speech = new Recognition();
  speech.start();
  assert.throws(() => speech.start(), { name: 'InvalidStateError' });
  speech.abort();
  const events = [];
  speech.onend = () => events.push('end');
  speech.start();
  callbacks[0](null, { code: 'aborted' });
  assert.deepEqual(events, []);
  callbacks[1]({ type: 'result', transcript: 'Coca 1' });
  assert.deepEqual(events, ['end']);
});

test('leaving the app cancels recording', () => {
  const { Recognition, document, calls } = setup();
  const speech = new Recognition();
  let ended = false;
  speech.onend = () => {
    ended = true;
  };
  speech.start();
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(ended, true);
  assert.equal(calls.at(-1)[0], 'cancel');
});

test('stop waits for a final result but retains a timeout', () => {
  const { Recognition, calls, callbacks, timers } = setup();
  const speech = new Recognition();
  let text;
  speech.onresult = (e) => {
    text = e.results[0][0].transcript;
  };
  speech.start();
  callbacks[0]({ type: 'start' });
  speech.stop();
  assert.equal(calls.at(-1)[0], 'stop');
  assert.equal(timers.size, 1);
  callbacks[0]({ type: 'result', transcript: 'Sting 3' });
  assert.equal(text, 'Sting 3');
});

test('ordinary web browsers are left unchanged', () => {
  const original = function BrowserSpeech() {};
  const window = { SpeechRecognition: original };
  vm.runInNewContext(source, { window });
  assert.equal(window.SpeechRecognition, original);
});
