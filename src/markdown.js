// Replies are Markdown, which is read out as raw text. Strip the syntax,
// keeping a line break between lines, such as list items and headings, and
// cut on a word boundary without splitting an emoji.
export function plainText(markdown, max = 200) {
  const text = markdown
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, ' ')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/\*+|~~|`+/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const cut = chars.slice(0, max).join('');
  const space = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('\n'));
  return `${(space > cut.length / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
