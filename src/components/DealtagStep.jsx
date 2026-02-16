import React, { useState, useRef, useCallback, useEffect } from 'react';
import { transform } from '../logic/dealtag';

export default function DealtagStep({ onComplete, showToast }) {
  const [input, setInput] = useState(() => {
    try { return localStorage.getItem('dp-tag-input') || ''; } catch { return ''; }
  });
  const [output, setOutput] = useState(() => {
    try { return localStorage.getItem('dp-tag-output') || ''; } catch { return ''; }
  });
  const [stats, setStats] = useState(() => {
    try { const s = localStorage.getItem('dp-tag-stats'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [includeX, setIncludeX] = useState(true);
  const [lines, setLines] = useState(() => {
    try {
      const o = localStorage.getItem('dp-tag-output');
      if (!o) return [];
      return o.split('\n').map(l => { const tag = l.split('\t', 1)[0]; return { tag, text: l.slice(tag.length + 1) }; });
    } catch { return []; }
  });
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const syncing = useRef(false);

  // Persist to localStorage
  useEffect(() => { try { localStorage.setItem('dp-tag-input', input); } catch {} }, [input]);
  useEffect(() => { try { localStorage.setItem('dp-tag-output', output); } catch {} }, [output]);
  useEffect(() => { try { localStorage.setItem('dp-tag-stats', JSON.stringify(stats)); } catch {} }, [stats]);

  const run = useCallback(() => {
    const res = transform(input, { includeUnknowns: includeX });
    setOutput(res.text);
    setStats(res.stats);
    const parsed = res.text ? res.text.split('\n').map(l => {
      const tag = l.split('\t', 1)[0];
      const text = l.slice(tag.length + 1);
      return { tag, text };
    }) : [];
    setLines(parsed);
  }, [input, includeX]);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(output).then(() => showToast('Output copied', 'success'));
  }, [output, showToast]);

  const sendToDedupe = useCallback(() => {
    if (!output) { showToast('Run transform first', 'error'); return; }
    onComplete(output);
  }, [output, onComplete, showToast]);

  // Scroll sync
  const syncScroll = useCallback((from, to) => {
    if (syncing.current) return;
    syncing.current = true;
    const maxFrom = Math.max(1, from.scrollHeight - from.clientHeight);
    const ratio = from.scrollTop / maxFrom;
    const maxTo = Math.max(1, to.scrollHeight - to.clientHeight);
    to.scrollTop = ratio * maxTo;
    syncing.current = false;
  }, []);

  return (
    <div className="dealtag-step">
      <div className="two-col">
        {/* Left: Input */}
        <div className="panel">
          <div className="panel-header">
            <h2>Input</h2>
            <span className="pill">{input.split('\n').length} lines</span>
          </div>
          <div className="panel-body" ref={leftRef}
            onScroll={() => rightRef.current && syncScroll(leftRef.current, rightRef.current)}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Paste your full promo list here…"
              spellCheck={false}
            />
          </div>
          <div className="panel-footer">
            <label className="toggle">
              <input type="checkbox" checked={includeX} onChange={e => setIncludeX(e.target.checked)} />
              Include unknowns (X)
            </label>
            <button className="btn btn-accent" onClick={run}>Transform</button>
            <button className="btn" onClick={copy} disabled={!output}>Copy Output</button>
          </div>
        </div>

        {/* Right: Output */}
        <div className="panel">
          <div className="panel-header">
            <h2>Output</h2>
            {stats && (
              <div className="stat-pills">
                <span className="pill pill-ok">v:{stats.vendors}</span>
                <span className="pill">d:{stats.deals}</span>
                <span className="pill pill-warn">ed:{stats.excl}</span>
                <span className="pill pill-bad">X:{stats.unknownSuppliers}</span>
              </div>
            )}
          </div>
          <div className="panel-body scrollpane" ref={rightRef}
            onScroll={() => leftRef.current && syncScroll(rightRef.current, leftRef.current)}>
            <div className="output-lines">
              {lines.map((l, i) => (
                <div key={i} className="output-line">
                  <span className={`tag tag-${l.tag}`}>{l.tag}</span>
                  <span className="tag-text">{l.text}</span>
                </div>
              ))}
              {lines.length === 0 && <div className="empty-state">Output will appear here after Transform</div>}
            </div>
          </div>
          <div className="panel-footer">
            <button className="btn btn-forward" onClick={sendToDedupe} disabled={!output}>
              Send to Dedupe →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
