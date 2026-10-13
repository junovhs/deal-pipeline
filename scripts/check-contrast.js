// WCAG contrast check for the design tokens in src/App.css. Text colors must
// reach 4.5:1 (AA) on the backgrounds they are used on; control borders and
// the focus ring must reach 3:1 against white (non-text contrast).
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(m => [m[1], m[2]]));

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE = '#ffffff';
// [foreground, background, minimum, where it is used]
const pairs = [
  ['ink', 'bg', 4.5, 'body text'],
  ['ink-2', 'bg', 4.5, 'secondary text'],
  ['muted', 'bg', 4.5, 'muted text'],
  ['muted', 'hover', 4.5, 'muted text on hover rows'],
  ['accent', 'bg', 4.5, 'links'],
  ['accent', 'accent-soft', 4.5, 'links on the current field'],
  [WHITE, 'accent', 4.5, 'primary buttons'],
  [WHITE, 'accent-strong', 4.5, 'primary buttons, hover'],
  [WHITE, 'ink', 4.5, 'selected filter, toast'],
  [WHITE, 'bad', 4.5, 'danger buttons, error toast'],
  [WHITE, 'good', 4.5, 'published check'],
  ['good', 'bg', 4.5, 'copied / live text'],
  ['warn', 'bg', 4.5, 'warning text'],
  ['warn', 'warn-soft', 4.5, 'warning labels'],
  ['bad', 'bg', 4.5, 'error text'],
  ['bad', 'bad-soft', 4.5, 'error labels'],
  ['ink', 'bad-soft', 4.5, 'error notice text'],
  ['ink', 'warn-soft', 4.5, 'warning notice text'],
  ['purple', 'purple-soft', 4.5, 'exclusive labels'],
  ['control', 'bg', 3, 'input and button borders'],
  ['focus', 'bg', 3, 'focus ring'],
];

let failed = 0;
for (const [fg, bg, min, where] of pairs) {
  const a = fg.startsWith('#') ? fg : tokens[fg];
  const b = bg.startsWith('#') ? bg : tokens[bg];
  if (!a || !b) { console.error(`Missing token for ${fg} on ${bg}`); failed++; continue; }
  const r = ratio(a, b);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${r.toFixed(2)}:1 (min ${min}) ${fg} on ${bg} — ${where}`);
}
if (failed) { console.error(`${failed} contrast check(s) failed`); process.exit(1); }
console.log('Contrast (WCAG AA): PASS');
