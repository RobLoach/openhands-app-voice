// Voice chat and Hands-free: after you speak a message with Canvas's mic,
// send it, read the agent's reply aloud and listen again, and stop the mic
// once you stop talking.

import { CHIME_MS, closeChimes, playChime, speechProblem } from './audio.js';
import { COMPOSER, conversationKey, MIC, openConversationId, SEND, STOP } from './canvas.js';
import { commandFor } from './commands.js';
import { silenceDetector } from './hands-free.js';
import { spokenSentences } from './sentences.js';
import { settings } from './settings.js';
import { read, stopSpeaking, volume } from './speech.js';

// A run's statuses while it goes.
const ACTIVE_STATUSES = new Set(['running', 'waiting_for_confirmation']);

// How often to ask the Agent Server whether the reply is in, and how long to
// wait for what you said to reach the message box.
const REPLY_CHECK_MS = 2000;
const SEND_CHECK_MS = 100;
const SEND_TIMEOUT_MS = 3000;
const TRANSCRIBE_TIMEOUT_MS = 30000;

// What's said instead of a reply.
const SAY = {
  waiting_for_confirmation: 'The agent needs your confirmation.',
  error: 'The agent stopped with an error.',
  stuck: 'The agent got stuck.',
};

const findMic = () => document.querySelector(MIC);
const pressed = (mic) => mic?.getAttribute('aria-pressed') === 'true';
const busy = (mic) => mic?.getAttribute('aria-busy') === 'true';

// The send button beside the mic, as there may be other message boxes.
function sendButton(mic) {
  for (let node = mic?.parentElement; node; node = node.parentElement) {
    const button = node.querySelector(SEND);
    if (button) return button;
  }
  return null;
}

// A turn goes listening → sending → waiting → speaking, then listens again
// by pressing the mic. Pressing a key, leaving the conversation or turning
// Voice chat off ends it. Each step that waits checks the turn is still the
// current one after.
export function voiceChat(host) {
  // Conversations from the Agent Server, by id, as its batch endpoint gives
  // them.
  const loadConversations = (ids) =>
    host.agentServer.request({
      path: `/api/conversations?${ids.map((id) => `ids=${conversationKey(id)}`).join('&')}`,
    });
  // The turn: its stage, the conversation it's in, null on a new chat until
  // Canvas opens it, your last message there when it started, and whether
  // the run answering you was seen going.
  let turn = null;
  let wasPressed = false;
  let timer = 0;
  let stopDetector = null;
  let unlocked = false;
  // The screen's wake lock while a turn goes, as a promise of it.
  let wakeLock = null;

  const on = () => settings.voiceChat || settings.handsFree;
  const at = (stage) => turn?.stage === stage;

  // Ends the turn, and stops whatever's read aloud, such as its reply.
  function end() {
    turn = null;
    clearTimeout(timer);
    timer = 0;
    letSleep();
    stopSpeaking();
  }

  // Phones sleep, and stop listening, after a while without a touch.
  function keepAwake() {
    if (wakeLock || document.hidden || !window.navigator.wakeLock) return;
    wakeLock = window.navigator.wakeLock.request('screen').catch(() => null);
  }

  function letSleep() {
    const lock = wakeLock;
    wakeLock = null;
    lock?.then((sentinel) => sentinel?.release()).catch(() => {});
  }

  // The browser lets go of the lock when the tab's hidden.
  function onVisibility() {
    if (document.hidden || !turn) return;
    letSleep();
    keepAwake();
  }

  function stopListening() {
    stopDetector?.();
    stopDetector = null;
  }

  function onListen() {
    if (settings.handsFree && !stopDetector) {
      stopDetector = silenceDetector(() => {
        stopDetector = null;
        const mic = findMic();
        if (pressed(mic)) mic.click();
      });
    }
    if (!settings.voiceChat) return;
    // Pressing the mic while the reply is read talks over it.
    end();
    const id = openConversationId();
    const current = { stage: 'listening', id, baseline: id ? undefined : null, sawActive: false };
    turn = current;
    keepAwake();
    if (!id) return;
    loadConversations([id])
      .then(([info]) => {
        current.baseline = info?.last_user_message_id ?? null;
      })
      // Without it, there's no telling the reply from the last one.
      .catch(() => {
        if (turn === current) end();
      });
  }

  // Once what you said is in the message box, send it.
  function onStopped() {
    stopListening();
    if (!at('listening')) return;
    turn.stage = 'sending';
    const started = Date.now();
    const trySend = () => {
      const mic = findMic();
      const composer = document.querySelector(COMPOSER);
      const send = sendButton(mic);
      const waited = Date.now() - started;
      const text = composer?.textContent.trim();
      const command = text && !busy(mic) && commandFor(text);
      // Your last message before this one tells its reply from the last.
      const known = turn.baseline !== undefined;
      if (command) {
        clearComposer(composer);
        runCommand(command);
      } else if (text && known && send && !send.disabled && !busy(mic)) {
        send.click();
        turn.stage = 'waiting';
        timer = setTimeout(checkReply, REPLY_CHECK_MS);
      } else if (waited < (busy(mic) ? TRANSCRIBE_TIMEOUT_MS : SEND_TIMEOUT_MS)) {
        timer = setTimeout(trySend, SEND_CHECK_MS);
      } else {
        end();
      }
    };
    timer = setTimeout(trySend, SEND_CHECK_MS);
  }

  // Canvas's message box keeps its text in its own state, which hears input.
  function clearComposer(composer) {
    composer.textContent = '';
    composer.dispatchEvent(new window.InputEvent('input', { bubbles: true }));
  }

  // "Stop" presses Canvas's Stop, for a run you talked over; "repeat" reads
  // the last reply again; "new chat" opens one and listens there.
  async function runCommand(command) {
    const current = turn;
    if (command === 'stop') {
      document.querySelector(STOP)?.click();
      speak(['Stopped.'], false);
    } else if (command === 'cancel') {
      end();
    } else if (command === 'newChat') {
      host.navigate('/conversations');
      current.id = null;
      speak(['New chat.'], true);
    } else if (command === 'repeat' && current.id) {
      const result = await host.agentServer
        .request({ path: `/api/conversations/${current.id}/agent_final_response` })
        .catch(() => null);
      if (turn !== current) return;
      speak(spokenSentences(result?.response ?? ''), true);
    } else {
      end();
    }
  }

  // The reply is in once the run that answers your message has stopped:
  // the run was seen going, or the agent has added to the conversation since
  // your message.
  async function checkReply() {
    const current = turn;
    current.id ??= openConversationId();
    const info = current.id
      ? await loadConversations([current.id])
          .then(([result]) => result)
          .catch(() => null)
      : null;
    if (turn !== current) return;
    const status = info?.execution_status;
    const message = info?.last_user_message_id;
    const answered =
      !!message && current.baseline !== undefined && message !== current.baseline;
    const running = ACTIVE_STATUSES.has(status);
    if (answered && running) current.sawActive = true;
    const agentActed = !!info?.leaf_event_id && info.leaf_event_id !== message;
    const needsYou = status === 'waiting_for_confirmation';
    if (!answered || (running && !needsYou) || (!running && !current.sawActive && !agentActed)) {
      timer = setTimeout(checkReply, REPLY_CHECK_MS);
      return;
    }
    if (status === 'finished') {
      const result = await host.agentServer
        .request({ path: `/api/conversations/${current.id}/agent_final_response` })
        .catch(() => null);
      if (turn !== current) return;
      speak(spokenSentences(result?.response ?? ''), true);
    } else if (SAY[status]) {
      speak([SAY[status]], false);
    } else {
      end();
    }
  }

  // Reads the sentences, then, after a reply, listens again if you're still
  // looking at the conversation. Reading something else, such as with a Read
  // aloud button, ends the turn.
  function speak(sentences, again) {
    const done = () => (again ? listenAgain() : end());
    if (!sentences.length || speechProblem()) {
      done();
      return;
    }
    const current = turn;
    current.stage = 'speaking';
    read(sentences, {
      onDone: () => {
        if (turn === current) done();
      },
      onStopped: () => {
        if (turn === current) end();
      },
    });
  }

  // Presses the mic, after the listening chime when it's on, so the chime
  // isn't heard as you talking.
  function listenAgain() {
    const { id } = turn;
    end();
    const press = () => {
      const mic = findMic();
      if (!settings.voiceChat || document.hidden || openConversationId() !== id) return;
      if (mic && !mic.disabled && !pressed(mic) && !busy(mic)) mic.click();
    };
    if (!settings.listeningChime) {
      press();
      return;
    }
    playChime(volume());
    timer = setTimeout(press, CHIME_MS);
  }

  // Browsers only let a page speak after a click or key press on it, and
  // Safari only from one, so the first press of the mic says nothing, in the
  // voice replies will be read in: never an online one while Keep voice on
  // this device is on.
  function onPointerDown(event) {
    if (unlocked || !settings.voiceChat || !event.target?.closest?.(MIC)) return;
    if (speechProblem()) return;
    unlocked = true;
    read(['']);
  }

  // A key press ends the turn, unless it's while you're talking, as dictation
  // takes keys too.
  function onKeyDown(event) {
    if (!at('waiting') && !at('speaking')) return;
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
    end();
  }

  function onMicChange() {
    const now = pressed(findMic());
    if (now !== wasPressed) {
      wasPressed = now;
      if (now) onListen();
      else onStopped();
    }
    // Leaving the conversation ends its turn.
    if (turn?.id && openConversationId() !== turn.id) end();
  }

  // Canvas's mic only changes attributes as it starts and stops, which the
  // app's own page observer doesn't hear.
  const attributes = new MutationObserver(onMicChange);
  let listening = false;

  function listen(next) {
    if (next === listening) return;
    listening = next;
    if (next) {
      attributes.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-pressed', 'aria-busy'],
      });
      window.addEventListener('pointerdown', onPointerDown, true);
      window.addEventListener('keydown', onKeyDown, true);
      document.addEventListener('visibilitychange', onVisibility);
      wasPressed = pressed(findMic());
    } else {
      attributes.disconnect();
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('visibilitychange', onVisibility);
      stopListening();
      end();
    }
  }

  return {
    refresh() {
      listen(on());
      if (!settings.handsFree) stopListening();
      if (!settings.voiceChat && turn) end();
    },
    onDomChange() {
      if (listening) onMicChange();
    },
    dispose() {
      listen(false);
      closeChimes();
    },
  };
}
