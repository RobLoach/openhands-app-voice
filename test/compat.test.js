import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, B, activateExtension, fakeHost, flush, mountPage, setupPage } from './helpers.js';

// Canvas's message box, with its mic and send button.
const CHAT = `
  <div data-testid="chat-input" contenteditable="true"></div>
  <button type="button" data-testid="chat-dictation-button"></button>
  <button type="button" data-testid="submit-button"></button>`;

const warning = (page) =>
  page.document.querySelector('[data-testid="voice-canvas-warning"]')?.textContent;

// The app on a page of Canvas, given time to check it, then its settings
// page.
async function check(t, { path, body = '', recognition = false }) {
  const page = setupPage(t, { url: `https://canvas.test${path}`, body });
  if (recognition) page.window.webkitSpeechRecognition = class {};
  const host = fakeHost();
  await activateExtension(page, host);
  await page.wait(3000);
  await mountPage(page, host, 'settings');
  return page;
}

test('says nothing when it finds the parts of Canvas it works with', async (t) => {
  const page = await check(t, { path: `/conversations/${A}`, body: CHAT, recognition: true });

  assert.equal(warning(page), undefined);
});

test("warns when a conversation has no message box or send button, as an update to Canvas may do", async (t) => {
  const page = await check(t, { path: `/conversations/${A}` });

  assert.equal(
    warning(page),
    "This version of Canvas may not be supported: Voice couldn't find its message box and send button the last time it looked, so features that need them may not work.",
  );
});

test('only warns about the mic where Canvas would show one', async (t) => {
  const chat = CHAT.replace(/<button[^>]*chat-dictation-button[^>]*><\/button>/, '');
  const page = await check(t, { path: `/conversations/${A}`, body: chat, recognition: true });
  assert.match(warning(page), /find its mic the last time it looked, so features that need it/);
});

test("doesn't warn about the mic where Canvas can't transcribe", async (t) => {
  const chat = CHAT.replace(/<button[^>]*chat-dictation-button[^>]*><\/button>/, '');
  const page = await check(t, { path: `/conversations/${A}`, body: chat });

  assert.equal(warning(page), undefined);
});

test("warns when Customize's menu has no Apps", async (t) => {
  const page = await check(t, { path: '/apps' });
  assert.match(warning(page), /find its Customize menu/);
});

test('stops warning once a later look finds them', async (t) => {
  const page = setupPage(t, { url: `https://canvas.test/conversations/${A}` });
  const host = fakeHost();
  await activateExtension(page, host);
  await page.wait(3000);
  page.document.body.insertAdjacentHTML('beforeend', CHAT);
  page.navigate(`/conversations/${B}`);
  page.mutate();
  await flush();
  await page.wait(3000);
  await mountPage(page, host, 'settings');

  assert.equal(warning(page), undefined);
});

test('gives Canvas time to draw the page before looking', async (t) => {
  const page = setupPage(t, { url: `https://canvas.test/conversations/${A}` });
  const host = fakeHost();
  await activateExtension(page, host);
  await page.wait(2000);
  page.document.body.insertAdjacentHTML('beforeend', CHAT);
  await page.wait(1000);
  await mountPage(page, host, 'settings');

  assert.equal(warning(page), undefined);
});
