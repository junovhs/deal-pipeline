import React, { useMemo, useRef, useCallback } from 'react';
import { transform } from '../logic/dealtag.js';

function parseLines(output) {
  if (!output) return [];
  return output.split('\n').map((line) => {
    const tag = line.split('\t', 1)[0];
    return { tag, text: line.slice(tag.length + 1) };
  });
}

export default function DealtagStep({ session, onSessionChange, onComplete, showToast }) {
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const syncing = useRef(false);

  const { input, output, stats, includeX } = session;
  const lines = useMemo(() => parseLines(output), [output]);

  const updateSession = useCallback((patch) => {
    onSessionChange((prev) => (
      typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
    ));
  }, [onSessionChange]);

  const run = useCallback(() => {
    const result = transform(input, { includeUnknowns: includeX });
    updateSession({
      output: result.text,
      stats: result.stats,
    });
  }, [includeX, input, updateSession]);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(output).then(() => showToast('Output copied', 'success'));
  }, [output, showToast]);

  const sendToDedupe = useCallback(() => {
    if (!output) {
      showToast('Run transform first', 'error');
      return;
    }
    onComplete(output);
  }, [onComplete, output, showToast]);

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
        <div className="panel">
          <div className="panel-header">
            <h2>Input</h2>
            <span className="pill">{input.split('\n').length} lines</span>
          </div>
          <div
            className="panel-body"
            ref={leftRef}
            onScroll={() => rightRef.current && syncScroll(leftRef.current, rightRef.current)}
          >
            <textarea
              value={input}
              onChange={(e) => updateSession({ input: e.target.value })}
              placeholder="Paste your full promo list here..."
              spellCheck={false}
            />
          </div>
          <div className="panel-footer">
            <label className="toggle">
              <input
                type="checkbox"
                checked={includeX}
                onChange={(e) => updateSession({ includeX: e.target.checked })}
              />
              Include unknowns (X)
            </label>
            <button className="btn btn-accent" onClick={run}>Transform</button>
            <button className="btn" onClick={copy} disabled={!output}>Copy Output</button>
          </div>
        </div>

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
          <div
            className="panel-body scrollpane"
            ref={rightRef}
            onScroll={() => leftRef.current && syncScroll(rightRef.current, leftRef.current)}
          >
            <div className="output-lines">
              {lines.map((line, index) => (
                <div key={index} className="output-line">
                  <span className={`tag tag-${line.tag}`}>{line.tag}</span>
                  <span className="tag-text">{line.text}</span>
                </div>
              ))}
              {lines.length === 0 && <div className="empty-state">Output will appear here after Transform</div>}
            </div>
          </div>
          <div className="panel-footer">
            <button className="btn btn-forward" onClick={sendToDedupe} disabled={!output}>
              Send to Dedupe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
