import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { filterAcceptedTaggedText, transform } from '../logic/dealtag.js';

function parseLines(output) {
  if (!output) return [];
  return output.split('\n').map((line) => {
    const tag = line.split('\t', 1)[0];
    return { tag, text: line.slice(tag.length + 1) };
  });
}

// Consecutive skipped (X) lines collapse into one quiet row.
function groupLines(lines) {
  const out = [];
  for (const line of lines) {
    const last = out[out.length - 1];
    if (line.tag === 'X' && last?.tag === 'X') last.items.push(line.text);
    else out.push(line.tag === 'X' ? { tag: 'X', items: [line.text] } : line);
  }
  return out;
}

/**
 * The weekly email on the left becomes tagged deals on the right as it is
 * pasted: no button to press. Suppliers read as headings, deals beneath them,
 * exclusivity and skipped lines in words. Only accepted lines go to Compare.
 */
export default function DealtagStep({ session, onSessionChange, onComplete, showToast }) {
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const syncing = useRef(false);
  const [openSkips, setOpenSkips] = useState({});

  const { input, output, stats, includeX } = session;
  const groups = useMemo(() => groupLines(parseLines(output)), [output]);

  const updateSession = useCallback((patch) => {
    onSessionChange((prev) => (
      typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
    ));
  }, [onSessionChange]);

  // Tag as the email is pasted or edited.
  useEffect(() => {
    if (!input.trim()) {
      if (output) updateSession({ output: '', stats: null });
      return;
    }
    if (output) return;
    const timer = setTimeout(() => {
      const result = transform(input, { includeUnknowns: includeX });
      updateSession({ output: result.text, stats: result.stats });
    }, 200);
    return () => clearTimeout(timer);
  }, [input, includeX, output, updateSession]);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(output).then(() => showToast('Tagged text copied', 'success')).catch(() => showToast('Could not copy. Please try again.', 'error'));
  }, [output, showToast]);

  const sendToCompare = useCallback(() => {
    const accepted = filterAcceptedTaggedText(output);
    if (!accepted) {
      showToast('No deals to compare yet', 'error');
      return;
    }
    onComplete(accepted);
  }, [onComplete, output, showToast]);

  const syncScroll = useCallback((from, to) => {
    if (syncing.current) return;
    syncing.current = true;
    const ratio = from.scrollTop / Math.max(1, from.scrollHeight - from.clientHeight);
    to.scrollTop = ratio * Math.max(1, to.scrollHeight - to.clientHeight);
    syncing.current = false;
  }, []);

  return (
    <div className="tag-step">
      <div className="pair">
        <section className="pair-side" aria-labelledby="tag-in">
          <div className="pair-head">
            <h2 id="tag-in">Weekly promo email</h2>
            <label className="check">
              <input
                type="checkbox"
                checked={includeX}
                onChange={(e) => updateSession({ includeX: e.target.checked, output: '', stats: null })}
              />
              Show skipped lines
            </label>
          </div>
          <textarea
            ref={leftRef}
            className="pair-body source"
            aria-labelledby="tag-in"
            value={input}
            onChange={(e) => updateSession({ input: e.target.value, output: '', stats: null })}
            onScroll={() => rightRef.current && syncScroll(leftRef.current, rightRef.current)}
            placeholder="Paste this week's promo email here."
            spellCheck={false}
          />
        </section>

        <section className="pair-side" aria-labelledby="tag-out">
          <div className="pair-head">
            <h2 id="tag-out">Tagged deals</h2>
            {stats && <p className="muted">{stats.deals} deals from {stats.vendors} suppliers · {stats.excl} exclusive{stats.unknownSuppliers ? ` · ${stats.unknownSuppliers} unknown suppliers skipped` : ''}</p>}
          </div>
          <div
            ref={rightRef}
            className="pair-body tagged"
            onScroll={() => leftRef.current && syncScroll(rightRef.current, leftRef.current)}
            tabIndex={0}
            aria-label="Tagged deals"
          >
            {!groups.length && <p className="empty">Tagged deals appear here as soon as you paste.</p>}
            {groups.map((line, index) => {
              if (line.tag === 'v') return <h3 key={index} className="tagged-supplier">{line.text}</h3>;
              if (line.tag === 'X') {
                const open = !!openSkips[index];
                return <div key={index} className="tagged-skip">
                  <button className="link" aria-expanded={open} onClick={() => setOpenSkips({ ...openSkips, [index]: !open })}>
                    Skipped {line.items.length === 1 ? '1 line' : `${line.items.length} lines`}: {line.items[0]}{line.items.length > 1 ? '…' : ''}
                  </button>
                  {open && <ul>{line.items.map((item, i) => <li key={i}>{item}</li>)}</ul>}
                </div>;
              }
              return <p key={index} className="tagged-deal">
                {line.tag === 'ed' && <span className="label label-exclusive">Exclusive</span>}
                {line.text}
              </p>;
            })}
          </div>
        </section>
      </div>

      <div className="step-actions">
        <button className="link" onClick={copy} disabled={!output}>Copy tagged text</button>
        <button className="btn btn-primary" onClick={sendToCompare} disabled={!output}>Continue to Compare →</button>
      </div>
    </div>
  );
}
