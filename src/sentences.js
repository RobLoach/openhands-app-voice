// Text as speech: split into sentences, a reply's Markdown stripped and its
// code left on screen, and the agent's messages on the page read in full.

import { canvasLanguage } from './canvas.js';
import { plainText } from './markdown.js';

// Replies are cut to this many characters, and read a sentence at a time,
// as Chrome stops reading a long utterance after about 15 seconds.
const MAX_SPOKEN = 1500;

// Text split into sentences in Canvas's language, or in one go for a
// language the browser doesn't know.
function sentencesOf(text) {
  let segments;
  try {
    segments = [...new Intl.Segmenter(canvasLanguage(), { granularity: 'sentence' }).segment(text)];
  } catch {
    segments = [{ segment: text }];
  }
  return segments.map(({ segment }) => segment.trim()).filter(Boolean);
}

// A reply as speech: Markdown stripped and code left on screen.
export const spokenSentences = (markdown) =>
  sentencesOf(
    plainText(markdown.replace(/```[\s\S]*?(?:```|$)/g, ' The code is in the chat. '), MAX_SPOKEN),
  );

// One of the agent's messages on the page as speech, read in full, with
// paragraphs, items and cells as separate sentences.
export function messageSentences(article) {
  const copy = article.cloneNode(true);
  for (const node of copy.querySelectorAll(':scope > div.absolute, button')) node.remove();
  for (const code of copy.querySelectorAll('pre')) code.replaceWith(' The code is in the chat. ');
  for (const block of copy.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote')) {
    block.append('\n');
  }
  return copy.textContent.split(/\n+/).flatMap((line) => sentencesOf(line.replace(/\s+/g, ' ')));
}
