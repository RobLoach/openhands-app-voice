// What Voice chat, Hands-free and Read aloud buttons need from the browser,
// and the listening chime.

// Two short rising tones, made on the fly so the app needs no sound file,
// and how long they last.
export const CHIME_MS = 350;
let chimes = null;

export function playChime(volume = 1) {
  const Context = window.AudioContext ?? window.webkitAudioContext;
  if (!Context) return;
  chimes ??= new Context();
  chimes.resume?.();
  const start = chimes.currentTime;
  [660, 880].forEach((frequency, index) => {
    const at = start + index * 0.15;
    const oscillator = chimes.createOscillator();
    const gain = chimes.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.15 * volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.14);
    oscillator.connect(gain).connect(chimes.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.14);
  });
}

export function closeChimes() {
  Promise.resolve(chimes?.close?.()).catch(() => {});
  chimes = null;
}

export function speechProblem() {
  return window.speechSynthesis && window.SpeechSynthesisUtterance
    ? null
    : "Your browser can't read text aloud.";
}

export async function requestMic() {
  if (!window.navigator.mediaDevices?.getUserMedia) {
    return 'Your browser only lets apps use the mic over HTTPS or on localhost.';
  }
  try {
    const stream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return null;
  } catch {
    return 'The mic is blocked for this site in your browser settings.';
  }
}
