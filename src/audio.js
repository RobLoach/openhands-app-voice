// What Voice chat, Hands-free and Read aloud buttons need from the browser.

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
