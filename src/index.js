// Voice: talk with the agent in Agent Canvas, each feature a setting in
// settings.js, turned on from this app's settings page and saved in the
// browser's localStorage. The README says what each does. Canvas loads an
// app from one file, so these modules and Readium Speech are built into
// extension.js.
//
// Each feature is an object with any of refresh() (settings changed),
// onDomChange(), onStorage(key) and dispose(), which activate() calls.
import { STORAGE_KEY } from './storage.js';
import { loadSettings, saveSettings, settings } from './settings.js';
import { settingsPage } from './pages.js';
import { SETTINGS_PAGE, sidebarLinks, watchCustomizeMenu } from './customize.js';
import { loadVoices, restoreVoicesHandler, watchVoices } from './speech.js';
import { closeServerAudio, loadServerVoices, watchServer } from './speech-server.js';
import { voiceChat } from './voice.js';
import { readAloudButtons } from './read-aloud.js';
import { keyboardShortcut } from './shortcut.js';
import { onDeviceRecognition } from './recognition.js';
import { watchCanvas } from './compat.js';

// The running copy's dispose, on the page's window. Canvas disposes an app
// before activating it again; should a copy still be running anyway, the new
// one stops it first, as two copies would both answer the mic.
const INSTANCE = Symbol.for('openhands-app-voice');

export function activate(host) {
  if (host.apiVersion !== '1') {
    throw new Error(`Voice requires host API 1, got ${host.apiVersion}.`);
  }
  window[INSTANCE]?.();
  loadSettings();
  let disposed = false;
  // A switch can finish changing after the app is disposed, e.g. once you
  // answer a permission prompt.
  const settingsView = settingsPage(host, (next) => {
    if (disposed) return;
    saveSettings(next);
    each('refresh');
  });
  // Before anything starts, as Canvas throws for a page its copy of the
  // manifest doesn't declare.
  const unregisterSettings = host.registerPage(SETTINGS_PAGE, settingsView.mount);
  const unwatchVoices = watchVoices(() => settingsView.voicesFound());
  // The settings page says when the speech server fails, or works again.
  const unwatchServer = watchServer(() => settingsView.voicesFound());
  const features = [
    watchCustomizeMenu(host),
    sidebarLinks(host.extension.name),
    settingsView,
    voiceChat(host),
    readAloudButtons(),
    keyboardShortcut(),
    onDeviceRecognition(),
    watchCanvas(),
    // Readium finds the voices ahead of time, so reading starts at once, and
    // any the browser finds later, which the settings page then lists, and
    // the speech server's, when it's picked.
    {
      refresh() {
        if (settings.voiceChat || settings.readAloud) {
          loadVoices();
          loadServerVoices();
        }
      },
      dispose() {
        unwatchVoices();
        unwatchServer();
        restoreVoicesHandler();
        closeServerAudio();
      },
    },
  ];
  function each(method, ...args) {
    for (const feature of features) feature[method]?.(...args);
  }
  // Settings changed in another tab apply here too.
  const onStorage = ({ key }) => {
    if (key === STORAGE_KEY) loadSettings();
    each('onStorage', key);
    if (key === STORAGE_KEY) each('refresh');
  };
  window.addEventListener('storage', onStorage);
  each('refresh');
  // Canvas re-renders the chat as a run's events stream in, which may bring a
  // new mic or new messages.
  const observer = new MutationObserver(() => each('onDomChange'));
  observer.observe(document.body, { childList: true, subtree: true });
  // Each feature cleans up even if one before it fails, whose error is then
  // passed on for Canvas to report.
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (window[INSTANCE] === dispose) delete window[INSTANCE];
    observer.disconnect();
    unregisterSettings?.();
    window.removeEventListener('storage', onStorage);
    let failure = null;
    for (const feature of features) {
      try {
        feature.dispose?.();
      } catch (error) {
        failure ??= error;
      }
    }
    if (failure) throw failure;
  };
  window[INSTANCE] = dispose;
  return dispose;
}
