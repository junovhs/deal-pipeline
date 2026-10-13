// WCAG contrast check for the design tokens in src/App.css, in both the light
// (:root) and dark (:root[data-theme="dark"]) themes. Text must reach 4.5:1
// (AA) on the backgrounds it is used on; control borders and the focus ring
// must reach 3:1 (non-text contrast).
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8');
function block(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No ${selector} block in App.css`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(m => [m[1], m[2]]));
}
const themes = { light: block(':root'), dark: { ...block(':root'), ...block(':root[data-theme="dark"]') } };

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum, where it is used]
const pairs = [
  ['ink', 'bg', 4.5, 'body text'],
  ['ink', 'surface', 4.5, 'text on surfaces'],
  ['ink-2', 'bg', 4.5, 'secondary text'],
  ['ink-2', 'surface', 4.5, 'secondary text on surfaces'],
  ['muted', 'bg', 4.5, 'muted text'],
  ['muted', 'surface', 4.5, 'muted text on surfaces'],
  ['muted', 'hover', 4.5, 'muted text on hover rows'],
  ['muted', 'surface-2', 4.5, 'muted labels'],
  ['accent', 'bg', 4.5, 'links'],
  ['accent', 'surface', 4.5, 'links on surfaces'],
  ['accent', 'accent-soft', 4.5, 'links on the current field'],
  ['on-accent', 'accent', 4.5, 'primary buttons'],
  ['on-accent', 'accent-strong', 4.5, 'primary buttons, hover'],
  ['bg', 'ink', 4.5, 'selected filter, toast'],
  ['on-bad', 'bad', 4.5, 'danger buttons, error toast'],
  ['surface', 'live', 4.5, 'published check, Correct button, ✓ glyph'],
  ['surface', 'bad', 4.5, '✗ glyph'],
  ['surface', 'update', 4.5, '~ glyph'],
  ['on-brand', 'brand', 4.5, 'header title'],
  ['brand-muted', 'brand', 4.5, 'header steps and links'],
  ['on-brand', 'brand-hover', 4.5, 'header step, hover'],
  ['on-mint', 'mint', 4.5, 'current step number'],
  ['live', 'bg', 4.5, 'live / copied text'],
  ['live', 'live-soft', 4.5, 'live pills'],
  ['update', 'bg', 4.5, 'update / warning text'],
  ['update', 'surface', 4.5, 'date chips'],
  ['update', 'update-soft', 4.5, 'update pills, warning labels'],
  ['new', 'bg', 4.5, 'new tally, this-week label'],
  ['new', 'new-soft', 4.5, 'new pills'],
  ['bad', 'bg', 4.5, 'error text'],
  ['bad', 'surface', 4.5, 'error text on surfaces'],
  ['bad', 'bad-soft', 4.5, 'error labels'],
  ['ink', 'bad-soft', 4.5, 'error notice text'],
  ['ink', 'update-soft', 4.5, 'warning notice text'],
  ['purple', 'purple-soft', 4.5, 'exclusive labels'],
  ['control', 'surface', 3, 'input and button borders'],
  ['focus', 'bg', 3, 'focus ring'],
];

let failed = 0;
for (const [name, tokens] of Object.entries(themes)) {
  for (const [fg, bg, min, where] of pairs) {
    const a = tokens[fg], b = tokens[bg];
    if (!a || !b) { console.error(`[${name}] missing token ${fg} or ${bg}`); failed++; continue; }
    const r = ratio(a, b);
    if (r < min) { failed++; console.log(`FAIL [${name}] ${r.toFixed(2)}:1 (min ${min}) ${fg} on ${bg} — ${where}`); }
  }
}
if (failed) { console.error(`${failed} contrast check(s) failed`); process.exit(1); }
console.log(`Contrast (WCAG AA): PASS — ${pairs.length} pairs × light and dark`);
