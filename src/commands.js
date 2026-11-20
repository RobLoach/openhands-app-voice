// Spoken commands: things you can say to Voice chat instead of a message.

// Things you can say instead of a message, as what Canvas heard, without
// punctuation, gives them.
const COMMANDS = {
  stop: 'stop',
  'stop it': 'stop',
  pause: 'stop',
  cancel: 'cancel',
  'never mind': 'cancel',
  nevermind: 'cancel',
  repeat: 'repeat',
  'repeat that': 'repeat',
  'say that again': 'repeat',
  'new chat': 'newChat',
  'new conversation': 'newChat',
  'start a new chat': 'newChat',
};

export const commandFor = (text) =>
  COMMANDS[
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
  ] ?? null;
