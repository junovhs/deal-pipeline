import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  parseHQ, resetIds, ingestWebsiteJSON, runFullMatch,
  exportUnmatched, sameDay, dateFmt
} from '../logic/dedupe';

export default function DedupeStep({ initialText, onComplete, showToast }) {
  const [hqText, setHqText] = useState(() => {
    try { return localStorage.getItem('dp-dedupe-hqtext') || initialText || ''; } catch { return initialText || ''; }
  });
  const [hqDeals, setHqDeals] = useState([]);
  const [websiteDeals, setWebsiteDeals] = useState([]);
  const [results, setResults] = useState(null);
  const [threshold, setThreshold] = useState(8);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [viewFilter, setViewFilter] = useState('all');
  const [restrictToday, setRestrictToday] = useState(false);
  const [rejectedHQ, setRejectedHQ] = useState(new Set());
  const [webSuppliers, setWebSuppliers] = useState([]);
  const fileRef = useRef(null);

  // Persist HQ text
  useEffect(() => { try { localStorage.setItem('dp-dedupe-hqtext', hqText); } catch {} }, [hqText]);

  // Sync initialText when it changes (coming from Dealtag) — only if new data is arriving
  useEffect(() => {
    if (initialText && initialText !== hqText) setHqText(initialText);
  }, [initialText]);

  const handleFileLoad = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : data.entries || data.data || [];
      const ingested = ingestWebsiteJSON(arr);
      setWebsiteDeals(ingested);
      const uniq = [...new Set(ingested.map(d => d.supplier))].sort();
      setWebSuppliers(uniq);
      showToast(`${ingested.length} website deals loaded`, 'success');
    } catch (err) {
      showToast('Failed to parse JSON: ' + err.message, 'error');
    }
  }, [showToast]);

  const runMatcher = useCallback(() => {
    let deals = hqDeals;
    if (!deals.length && hqText.trim()) {
      resetIds();
      deals = parseHQ(hqText);
      setHqDeals(deals);
    }
    if (!deals.length) { showToast('Paste HQ text first', 'error'); return; }
    if (!websiteDeals.length) { showToast('Load website JSON first', 'error'); return; }

    const rows = runFullMatch(deals, websiteDeals, { filterSupplier: supplierFilter });
    setResults(rows);
  }, [hqDeals, hqText, websiteDeals, supplierFilter, showToast]);

  const handleReject = useCallback((id) => {
    setRejectedHQ(prev => { const n = new Set(prev); n.add(id); return n; });
  }, []);

  // Categorize results
  const categorized = React.useMemo(() => {
    if (!results) return null;
    const today = new Date(); // Fresh each render — no stale date
    let matched = [], unmatched = [], extensions = [];

    for (const r of results) {
      const sc = r.meta?.score ?? 0;
      if (rejectedHQ.has(r.hq.id) || !r.web || sc < threshold) {
        unmatched.push(r);
      } else if (r.meta.isExtension) {
        extensions.push(r);
      } else {
        matched.push(r);
      }
    }

    if (restrictToday) {
      unmatched = unmatched.filter(r => !sameDay(r.hq.end, today));
    }

    matched.sort((a, b) => (b.meta?.score ?? 0) - (a.meta?.score ?? 0));
    unmatched.sort((a, b) => a.hq.vendor.localeCompare(b.hq.vendor));

    return { matched, unmatched, extensions, total: results.length, today };
  }, [results, rejectedHQ, threshold, restrictToday]);

  // Filter by view
  const visible = React.useMemo(() => {
    if (!categorized) return null;
    const { matched, unmatched, extensions } = categorized;
    switch (viewFilter) {
      case 'unmatched': return { matched: [], unmatched, extensions: [] };
      case 'matched': return { matched, unmatched: [], extensions: [] };
      case 'updates': return { matched: [], unmatched: [], extensions };
      case 'weak': return { matched: matched.filter(r => (r.meta?.score ?? 0) < 15), unmatched: [], extensions: [] };
      default: return { matched, unmatched, extensions };
    }
  }, [categorized, viewFilter]);

  const handleExportUnmatched = useCallback(() => {
    if (!categorized) return;
    const deals = categorized.unmatched.map(r => r.hq);
    if (!deals.length) { showToast('No unmatched deals', 'error'); return; }
    const text = exportUnmatched(deals);
    navigator.clipboard.writeText(text).then(() => showToast('Unmatched copied', 'success'));
  }, [categorized, showToast]);

  const handleSendToCopy = useCallback(() => {
    if (!categorized) return;
    const deals = categorized.unmatched.map(r => r.hq);
    if (!deals.length) { showToast('No unmatched deals', 'error'); return; }
    onComplete(exportUnmatched(deals));
  }, [categorized, onComplete, showToast]);

  // Date warnings
  const dateWarnings = React.useMemo(() => {
    return hqDeals.filter(d => d.dateWarning);
  }, [hqDeals]);

  return (
    <div className="dedupe-step">
      <div className="dedupe-layout">
        {/* Left: Controls */}
        <div className="dedupe-sidebar">
          <div className="section">
            <h3>HQ Paste (v/d/ed format)</h3>
            <textarea
              value={hqText}
              onChange={e => { setHqText(e.target.value); setHqDeals([]); }}
              placeholder={'v Carnival\nd Bundle Offer: up to $500 OBC\ned EXCLUSIVE Covert 10% Savings'}
              spellCheck={false}
            />
            <div className="pill">{hqDeals.length ? `${new Set(hqDeals.map(d => d.vendor)).size} vendors · ${hqDeals.length} deals` : '0 parsed'}</div>
          </div>

          {dateWarnings.length > 0 && (
            <div className="section section-warn">
              <h3>⚠ Date Warnings</h3>
              {dateWarnings.map((d, i) => (
                <div key={i} className="date-warning">
                  <strong>{d.vendor}:</strong> {d.dateWarning}
                  <div className="mini">{d.text}</div>
                </div>
              ))}
            </div>
          )}

          <div className="section">
            <h3>Website JSON</h3>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              Choose entries JSON…
            </button>
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileLoad} />
            <span className="pill">{websiteDeals.length} loaded</span>
          </div>

          <div className="section">
            <h3>Controls</h3>
            <div className="control-row">
              <button className="btn btn-accent" onClick={runMatcher}>▶ Run Matcher</button>
              <label className="mini-label">
                Min Score
                <input type="number" value={threshold} min={1} max={40}
                  onChange={e => setThreshold(+e.target.value)} />
              </label>
            </div>
            <div className="control-row">
              <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
                <option value="">All suppliers</option>
                {webSuppliers.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={viewFilter} onChange={e => setViewFilter(e.target.value)}>
                <option value="all">Show All</option>
                <option value="unmatched">Unmatched Only</option>
                <option value="matched">Matched Only</option>
                <option value="updates">Extensions Only</option>
                <option value="weak">Weak (&lt;15)</option>
              </select>
            </div>
            <div className="control-row">
              <button
                className={`btn ${restrictToday ? 'btn-danger' : ''}`}
                onClick={() => setRestrictToday(r => !r)}
              >
                Ends Today: {restrictToday ? 'On' : 'Off'}
              </button>
              {rejectedHQ.size > 0 && (
                <button className="btn" onClick={() => setRejectedHQ(new Set())}>
                  Reset Rejects ({rejectedHQ.size})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="dedupe-results">
          {categorized && (
            <div className="stats-bar">
              <div className="stat-box"><div className="stat-n stat-good">{categorized.matched.length}</div><div className="stat-l">Matched</div></div>
              <div className="stat-box"><div className="stat-n stat-purple">{categorized.extensions.length}</div><div className="stat-l">Extended</div></div>
              <div className="stat-box"><div className="stat-n stat-bad">{categorized.unmatched.length}</div><div className="stat-l">Unmatched</div></div>
              <div className="stat-box"><div className="stat-n">{categorized.total}</div><div className="stat-l">Total HQ</div></div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn" onClick={handleExportUnmatched}>Copy Unmatched</button>
                <button className="btn btn-forward" onClick={handleSendToCopy}>Send to Copy →</button>
              </div>
            </div>
          )}

          {!results && <div className="empty-state">Paste HQ deals, load website JSON, then run the matcher</div>}

          {visible && (
            <div className="match-list">
              {/* Extensions */}
              {visible.extensions.length > 0 && (
                <>
                  <h4 className="section-heading heading-purple">⇄ Possible Extensions ({visible.extensions.length})</h4>
                  {visible.extensions.map(r => <MatchCard key={r.hq.id} r={r} today={categorized.today} onReject={handleReject} />)}
                </>
              )}
              {/* Matched */}
              {visible.matched.length > 0 && (
                <>
                  <h4 className="section-heading heading-good">✓ Matched ({visible.matched.length})</h4>
                  {visible.matched.map(r => <MatchCard key={r.hq.id} r={r} today={categorized.today} onReject={handleReject} />)}
                </>
              )}
              {/* Unmatched */}
              {visible.unmatched.length > 0 && (
                <>
                  <h4 className="section-heading heading-bad">✗ Unmatched ({visible.unmatched.length})</h4>
                  {visible.unmatched.map(r => <UnmatchedCard key={r.hq.id} r={r} today={categorized.today} />)}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Match card ---
function MatchCard({ r, today, onReject }) {
  const sc = r.meta?.score ?? 0;
  const cls = r.meta.isExtension ? 'card-ext' : sc >= 15 ? 'card-high' : sc >= 10 ? 'card-mid' : 'card-low';
  const scoreCls = sc >= 15 ? 'stat-good' : sc >= 10 ? 'stat-warn' : 'stat-bad';
  const endsToday = sameDay(r.hq.end, today);

  return (
    <div className={`match-card ${cls} ${endsToday ? 'card-today' : ''}`}>
      <div className="match-header">
        <div className={`score-box ${scoreCls}`}>{sc}</div>
        <span className="supplier-name">{r.hq.vendor}</span>
        {r.hq.type === 'exclusive' && <span className="pill pill-bad">EXCLUSIVE</span>}
        {r.meta.isExtension && <span className="pill pill-purple">⇄ EXTENSION</span>}
        {endsToday && <span className="pill pill-danger">ENDS TODAY</span>}
      </div>
      <div className="match-grid">
        <div className="match-side">
          <h4>HQ Deal</h4>
          <div className="match-text">{r.hq.text}</div>
          <div className="match-meta">{r.hq.ongoing ? 'Ongoing' : r.hq.end ? 'Ends: ' + dateFmt.format(r.hq.end) : ''}</div>
        </div>
        <div className="match-side">
          <h4>Website Deal</h4>
          <div className="match-text">{r.web?.raw?.title || ''}</div>
          <div className="match-meta">{r.web?.raw?.shopListing || ''}</div>
          <div className="match-meta">{r.web?.expiryDate ? 'Ends: ' + dateFmt.format(r.web.expiryDate) : 'No expiry'}</div>
        </div>
      </div>
      <div className="why-chips">
        {(r.meta.why || []).map((w, i) => (
          <span key={i} className={`why-chip chip-${w.type}`}>{w.text}</span>
        ))}
      </div>
      <div className="card-actions">
        <button className="btn btn-reject" onClick={() => onReject(r.hq.id)}>👎 Reject</button>
      </div>
    </div>
  );
}

// --- Unmatched card ---
function UnmatchedCard({ r, today }) {
  const endsToday = sameDay(r.hq.end, today);
  return (
    <div className={`match-card card-unmatched ${endsToday ? 'card-today' : ''}`}>
      <div className="match-header">
        <span className="supplier-name">{r.hq.vendor}</span>
        {r.hq.type === 'exclusive' && <span className="pill pill-bad">EXCLUSIVE</span>}
        {endsToday && <span className="pill pill-danger">ENDS TODAY</span>}
        {r.hq.dateWarning && <span className="pill pill-warn" title={r.hq.dateWarning}>⚠ DATE</span>}
      </div>
      <div className="match-text">{r.hq.text}</div>
      <div className="match-meta">{r.hq.ongoing ? 'Ongoing' : r.hq.end ? 'Ends: ' + dateFmt.format(r.hq.end) : ''}</div>
      <div className="feature-chips">
        {[...r.hq.bag.features].map(f => <span key={f} className="feature-chip">{f}</span>)}
      </div>
    </div>
  );
}
