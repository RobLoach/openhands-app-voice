import { JSDOM } from 'jsdom';

// Conversations.
export const A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
export const B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

let loads = 0;

// Lets pending promises, observer callbacks and jsdom's own events run,
// without moving the mocked clock.
export async function flush() {
  for (let turn = 0; turn < 5; turn++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

// A Canvas-like page in jsdom, installed as the globals extension.js uses,
// with controls for the browser state jsdom can't produce on its own, and a
// mocked clock. It's torn down after the test `t`: the app is disabled before
// the window closes, as closing it empties the page under the app's
// observers.
export function setupPage(
  t,
  { url = 'https://canvas.test/apps', head = '', body = '', settings } = {},
) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
  const dom = new JSDOM(
    `<!doctype html><html><head>${head}</head><body>${body}</body></html>`,
    { url },
  );
  const { window } = dom;
  const page = {
    window,
    document: window.document,
    hidden: false,
    // What the app read aloud, still reading or done, and the mic's level
    // and open streams, for Voice chat and Hands-free.
    utterances: [],
    // The utterances themselves, with their voice and rate, and the
    // browser's voices.
    spoken: [],
    voices: [],
    micLevel: 0,
    micStreams: 0,
    micAnswer: true,
    // Screen wake locks held.
    wakeLocks: 0,
  };

  Object.defineProperty(window.document, 'hidden', { get: () => page.hidden });
  Object.defineProperty(window, 'isSecureContext', { value: true });

  // jsdom has no Web Audio: Hands-free hears the mic at page.micLevel.
  window.AudioContext = class {
    close() {
      return Promise.resolve();
    }
    createAnalyser() {
      return {
        fftSize: 0,
        getFloatTimeDomainData(samples) {
          samples.fill(page.micLevel);
        },
      };
    }
    createMediaStreamSource() {
      return { connect: (node) => node };
    }
  };

  // Records what's read aloud; finishSpeaking() reads out what's queued.
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  window.speechSynthesis = {
    queue: [],
    get speaking() {
      return this.queue.length > 0;
    },
    pending: false,
    getVoices: () => page.voices,
    onvoiceschanged: null,
    addEventListener: (type, listener) => window.addEventListener(`speech-${type}`, listener),
    removeEventListener: (type, listener) =>
      window.removeEventListener(`speech-${type}`, listener),
    speak(utterance) {
      page.utterances.push(utterance.text);
      page.spoken.push(utterance);
      this.queue.push(utterance);
    },
    cancel() {
      const queue = this.queue;
      this.queue = [];
      for (const utterance of queue) utterance.onerror?.({ error: 'canceled' });
    },
  };

  Object.defineProperty(window.navigator, 'wakeLock', {
    value: {
      async request() {
        page.wakeLocks += 1;
        let held = true;
        return {
          async release() {
            if (held) page.wakeLocks -= 1;
            held = false;
          },
        };
      },
    },
  });

  Object.defineProperty(window.navigator, 'mediaDevices', {
    value: {
      async getUserMedia() {
        if (!page.micAnswer) throw new Error('NotAllowedError');
        page.micStreams += 1;
        let live = true;
        return {
          getTracks: () => [
            {
              stop() {
                if (live) page.micStreams -= 1;
                live = false;
              },
            },
          ],
        };
      },
    },
  });

  Object.assign(globalThis, {
    window,
    document: window.document,
    localStorage: window.localStorage,
    MutationObserver: window.MutationObserver,
    Node: window.Node,
  });
  Object.defineProperty(globalThis, 'location', {
    get: () => window.location,
    configurable: true,
  });

  Object.assign(page, {
    settings(values) {
      window.localStorage.setItem('openhands-voice:settings', JSON.stringify(values));
    },
    // Settings changed in another tab, which applies them here too.
    async changeSettings(values) {
      page.settings(values);
      window.dispatchEvent(
        new window.StorageEvent('storage', { key: 'openhands-voice:settings' }),
      );
      await flush();
    },
    navigate(path) {
      window.history.pushState({}, '', path);
    },
    // Any DOM change, like Canvas rendering a chat event.
    mutate() {
      window.document.body.append(window.document.createElement('div'));
    },
    // Time passes.
    async wait(ms) {
      t.mock.timers.tick(ms);
      await flush();
    },
    // The browser finds its voices.
    async setVoices(voices) {
      page.voices = voices;
      window.speechSynthesis.onvoiceschanged?.();
      window.dispatchEvent(new window.Event('speech-voiceschanged'));
      await flush();
    },
    async finishSpeaking() {
      const queue = window.speechSynthesis.queue;
      window.speechSynthesis.queue = [];
      for (const utterance of queue) utterance.onend?.();
      await flush();
    },
    dispose: () => {},
  });
  if (settings) page.settings(settings);
  t.after(() => {
    page.dispose();
    window.close();
  });
  return page;
}

// A host as Canvas passes to activate(), backed by fake conversations.
export function fakeHost({
  statuses = {},
  // Each conversation's last message from you and its latest event, by id.
  turns = {},
  finalResponse = '',
} = {}) {
  const host = {
    apiVersion: '1',
    extension: { name: 'openhands-app-voice', version: '0.0.0', resolvedRef: null },
    backend: { id: 'test', kind: 'local', orgId: null },
    statuses,
    turns,
    finalResponse,
    requests: [],
    navigations: [],
    // Each registered page's mount, by id.
    pages: new Map(),
    registerPage(id, mount) {
      host.pages.set(id, mount);
      return () => host.pages.delete(id);
    },
    navigate: (path) => host.navigations.push(path),
    agentServer: {
      async request({ path }) {
        host.requests.push(path);
        const url = new URL(path, 'https://agent.test');
        if (url.pathname.endsWith('/agent_final_response')) {
          return { response: host.finalResponse };
        }
        // GET /api/conversations?ids=…, as the Agent Server's batch endpoint.
        return url.searchParams.getAll('ids').map((id) => ({
          execution_status: host.statuses[id] ?? 'idle',
          last_user_message_id: host.turns[id]?.user ?? null,
          leaf_event_id: host.turns[id]?.leaf ?? null,
        }));
      },
    },
  };
  return host;
}

// A fresh copy of extension.js per test, as Canvas imports one per
// activation, so the voices Readium finds don't carry over. Returns the
// app's disposer, which is safe to call before the teardown.
export async function activateExtension(page, host) {
  loads += 1;
  const { activate } = await import(`../extension.js?load=${loads}`);
  const dispose = activate(host);
  let disposed = false;
  page.dispose = () => {
    if (!disposed) dispose();
    disposed = true;
  };
  await flush();
  return page.dispose;
}

// The app running on a Canvas page at `path`, with a host backed by fake
// conversations. before(page) sets the page up first, e.g. its storage.
export async function start(
  t,
  { path = '/apps', statuses, turns, finalResponse, before, ...pageOptions } = {},
) {
  const page = setupPage(t, { url: `https://canvas.test${path}`, ...pageOptions });
  const host = fakeHost({ statuses, turns, finalResponse });
  before?.(page);
  await activateExtension(page, host);
  return { page, host };
}

// One of the app's pages, mounted in a container on the page as Canvas does.
export async function mountPage(page, host, id, path = '') {
  const container = page.document.createElement('div');
  page.document.body.append(container);
  const unmount = host.pages.get(id)({ container, path, navigate: host.navigate });
  await flush();
  return { container, unmount };
}

// The app with its settings page open. Returns the app's disposer.
export async function openSettings(page, host = fakeHost()) {
  const dispose = await activateExtension(page, host);
  await mountPage(page, host, 'settings');
  return dispose;
}
