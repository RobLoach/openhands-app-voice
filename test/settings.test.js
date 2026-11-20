import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateExtension, fakeHost, flush, openSettings, setupPage } from './helpers.js';

const SETTINGS_URL = 'https://canvas.test/extensions/openhands-app-voice/settings';
const SWITCH_KEYS = ['voiceChat', 'handsFree', 'listeningChime', 'keyboardShortcut', 'readAloud'];
const switchFor = (page, key) =>
  page.document.querySelector(`[data-testid="voice-${key}-switch"]`);
const stored = (page) =>
  JSON.parse(page.window.localStorage.getItem('openhands-voice:settings'));

test('lists every switch under its group, off at first but one', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  await openSettings(page);

  const headings = [...page.document.querySelectorAll('h3')].map((h) => h.textContent);
  assert.deepEqual(headings, ['Talking', 'Reading aloud']);
  for (const key of SWITCH_KEYS) {
    assert.equal(switchFor(page, key).checked, false, key);
    assert.ok(page.document.getElementById(`voice-${key}-hint`).textContent, key);
  }
  // But for On-device voices only, which keeps what's read on this device.
  assert.equal(switchFor(page, 'onDeviceOnly').checked, true);
});

test('saves a switch, and Reset settings puts them all back', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  await openSettings(page);
  switchFor(page, 'readAloud').click();
  await flush();
  assert.deepEqual(stored(page).readAloud, true);

  page.document.querySelector('[data-testid="voice-reset-settings"]').click();
  await flush();
  assert.equal(stored(page), null);
  assert.equal(switchFor(page, 'readAloud').checked, false);
});

test('shows settings changed in another tab', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  await openSettings(page);
  await page.changeSettings({ voiceChat: true });

  assert.equal(switchFor(page, 'voiceChat').checked, true);
});

test('leaves Alt+V alone while the Keyboard shortcut is off', async (t) => {
  const page = setupPage(t, {
    url: 'https://canvas.test/conversations/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    body: '<button type="button" data-testid="chat-dictation-button" aria-pressed="false"></button>',
  });
  await activateExtension(page, fakeHost());
  let pressed = 0;
  page.document
    .querySelector('[data-testid="chat-dictation-button"]')
    .addEventListener('click', () => (pressed += 1));
  const event = new page.window.KeyboardEvent('keydown', {
    code: 'KeyV',
    altKey: true,
    cancelable: true,
  });
  page.window.dispatchEvent(event);

  assert.equal(pressed, 0);
  assert.equal(event.defaultPrevented, false);
});

test('stops the copy already running when activated again', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  const first = fakeHost();
  await activateExtension(page, first);
  const second = fakeHost();
  await activateExtension(page, second);

  assert.equal(first.pages.size, 0);
  assert.equal(second.pages.size, 1);
});

// Customize's menu, as Canvas renders it, and Extras' link, which that app
// puts right after Apps.
const MENU =
  '<div id="menu"><a data-testid="sidebar-extensions-/plugins" href="/plugins">Plugins</a><a data-testid="sidebar-extensions-/apps" href="/apps">Apps</a></div>';
const EXTRAS = '<a data-testid="sidebar-extensions-extras" href="/extras">Extras</a>';
const menuLinks = (page) =>
  [...page.document.querySelectorAll('#menu > a')].map((link) => link.textContent);

test("adds Voice under Apps in Customize's menu, and takes it away with the app", async (t) => {
  const page = setupPage(t, { body: MENU });
  const host = fakeHost();
  const dispose = await activateExtension(page, host);

  assert.deepEqual(menuLinks(page), ['Plugins', 'Apps', 'Voice']);
  page.document.querySelector('[data-testid="sidebar-extensions-voice"]').click();
  assert.deepEqual(host.navigations, ['/extensions/openhands-app-voice/settings']);

  dispose();
  assert.deepEqual(menuLinks(page), ['Plugins', 'Apps']);
});

test("puts Voice after Extras' link, whichever app comes first", async (t) => {
  const page = setupPage(t, { body: MENU.replace('Apps</a>', `Apps</a>${EXTRAS}`) });
  await activateExtension(page, fakeHost());
  assert.deepEqual(menuLinks(page), ['Plugins', 'Apps', 'Extras', 'Voice']);

  // Extras adds its link after Voice's, right after Apps.
  page.document.querySelector('[data-testid="sidebar-extensions-extras"]').remove();
  page.document
    .querySelector('[data-testid="sidebar-extensions-/apps"]')
    .insertAdjacentHTML('afterend', EXTRAS);
  await flush();
  assert.deepEqual(menuLinks(page), ['Plugins', 'Apps', 'Extras', 'Voice']);
});

test("hides the settings page's sidebar link, and shows Customize's menu on it", async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  await openSettings(page);

  assert.match(
    page.document.getElementById('openhands-voice-sidebar').textContent,
    /sidebar-canvas-extension-openhands-app-voice-settings/,
  );
  const current = page.document.querySelector('aside [aria-current="page"]');
  assert.equal(current.textContent, 'Voice');
});
