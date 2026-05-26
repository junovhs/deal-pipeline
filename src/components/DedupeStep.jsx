import React, { useMemo, useCallback, useRef } from 'react';
import {
  parseHQ, resetIds, ingestWebsiteJSON, runFullMatch,
  exportUnmatched, sameDay, dateFmt,
} from '../logic/dedupe';

function parseWebsiteRows(text) {
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : data.entries || data.data || [];
}

export default function DedupeStep({ session, onSessionChange, onComplete, showToast }) {
  const fileRef = useRef(null);

  const {
    hqText,
    websiteRows,
    lastRun,
    threshold,
    supplierFilter,
    viewFilter,
    restrictToday,
    rejectedHQIds,
  } = session;

  const updateSession = useCallback((patch) => {
    onSessionChange((prev) => (
      typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
    ));
  }, [onSessionChange]);

  const hqDeals = useMemo(() => {
    if (!hqText.trim()) return [];
    resetIds();
    return parseHQ(hqText);
  }, [hqText]);

  const websiteDeals = useMemo(() => ingestWebsiteJSON(websiteRows), [websiteRows]);
  const webSuppliers = useMemo(
    () => [...new Set(websiteDeals.map((deal) => deal.supplier))].sort(),
    [websiteDeals],
  );

  const results = useMemo(() => {
    if (!lastRun) return null;
    if (!lastRun.hqText.trim() || !lastRun.websiteRows.length) return null;
    resetIds();
    const lastRunDeals = parseHQ(lastRun.hqText);
    const lastRunWebsiteDeals = ingestWebsiteJSON(lastRun.websiteRows);
    return runFullMatch(lastRunDeals, lastRunWebsiteDeals, {
      filterSupplier: lastRun.supplierFilter,
    });
  }, [lastRun]);

  const rejectedHQ = useMemo(() => new Set(rejectedHQIds), [rejectedHQIds]);

  const categorized = useMemo(() => {
    if (!results) return null;
    const today = new Date();
    let matched = [];
    let unmatched = [];
    let extensions = [];

    for (const result of results) {
      const score = result.meta?.score ?? 0;
      if (rejectedHQ.has(result.hq.id) || !result.web || score < threshold) {
        unmatched.push(result);
      } else if (result.meta.isExtension) {
        extensions.push(result);
      } else {
        matched.push(result);
      }
    }

    if (restrictToday) {
      unmatched = unmatched.filter((result) => !sameDay(result.hq.end, today));
    }

    matched.sort((a, b) => (b.meta?.score ?? 0) - (a.meta?.score ?? 0));
    unmatched.sort((a, b) => a.hq.vendor.localeCompare(b.hq.vendor));

    return { matched, unmatched, extensions, total: results.length, today };
  }, [results, rejectedHQ, restrictToday, threshold]);

  const visible = useMemo(() => {
    if (!categorized) return null;
    const { matched, unmatched, extensions } = categorized;
    switch (viewFilter) {
      case 'unmatched':
        return { matched: [], unmatched, extensions: [] };
      case 'matched':
        return { matched, unmatched: [], extensions: [] };
      case 'updates':
        return { matched: [], unmatched: [], extensions };
      case 'weak':
        return {
          matched: matched.filter((result) => (result.meta?.score ?? 0) < 15),
          unmatched: [],
          extensions: [],
        };
      default:
        return { matched, unmatched, extensions };
    }
  }, [categorized, viewFilter]);

  const dateWarnings = useMemo(() => hqDeals.filter((deal) => deal.dateWarning), [hqDeals]);

  const handleFileLoad = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseWebsiteRows(text);
      updateSession({ websiteRows: rows, lastRun: null, rejectedHQIds: [] });
      showToast(`${rows.length} website deals loaded`, 'success');
    } catch (error) {
      showToast(`Failed to parse JSON: ${error.message}`, 'error');
    }
  }, [showToast, updateSession]);

  const runMatcher = useCallback(() => {
    if (!hqDeals.length) {
      showToast('Paste HQ text first', 'error');
      return;
    }
    if (!websiteRows.length) {
      showToast('Load website JSON first', 'error');
      return;
    }

    updateSession({
      lastRun: {
        hqText,
        websiteRows,
        supplierFilter,
      },
      rejectedHQIds: [],
    });
  }, [hqDeals.length, hqText, showToast, supplierFilter, updateSession, websiteRows]);

  const handleReject = useCallback((id) => {
    updateSession((prev) => ({
      ...prev,
      rejectedHQIds: prev.rejectedHQIds.includes(id)
        ? prev.rejectedHQIds
        : [...prev.rejectedHQIds, id],
    }));
  }, [updateSession]);

  const handleExportUnmatched = useCallback(() => {
    if (!categorized) return;
    const deals = categorized.unmatched.map((result) => result.hq);
    if (!deals.length) {
      showToast('No unmatched deals', 'error');
      return;
    }
    const text = exportUnmatched(deals);
    navigator.clipboard.writeText(text).then(() => showToast('Unmatched copied', 'success'));
  }, [categorized, showToast]);

  const handleSendToCopy = useCallback(() => {
    if (!categorized) return;
    const deals = categorized.unmatched.map((result) => result.hq);
    if (!deals.length) {
      showToast('No unmatched deals', 'error');
      return;
    }
    onComplete(exportUnmatched(deals));
  }, [categorized, onComplete, showToast]);

  return (
    <div className="dedupe-step">
      <div className="dedupe-layout">
        <div className="dedupe-sidebar">
          <div className="section">
            <h3>HQ Paste (v/d/ed format)</h3>
            <textarea
              value={hqText}
              onChange={(event) => updateSession({
                hqText: event.target.value,
                lastRun: null,
                rejectedHQIds: [],
              })}
              placeholder={'v Carnival\nd Bundle Offer: up to $500 OBC\ned EXCLUSIVE Covert 10% Savings'}
              spellCheck={false}
            />
            <div className="pill">
              {hqDeals.length
                ? `${new Set(hqDeals.map((deal) => deal.vendor)).size} vendors · ${hqDeals.length} deals`
                : '0 parsed'}
            </div>
          </div>

          {dateWarnings.length > 0 && (
            <div className="section section-warn">
              <h3>Date Warnings</h3>
              {dateWarnings.map((deal, index) => (
                <div key={index} className="date-warning">
                  <strong>{deal.vendor}:</strong> {deal.dateWarning}
                  <div className="mini">{deal.text}</div>
                </div>
              ))}
            </div>
          )}

          <div className="section">
            <h3>Website JSON</h3>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              Choose entries JSON...
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileLoad}
            />
            <span className="pill">{websiteDeals.length} loaded</span>
          </div>

          <div className="section">
            <h3>Controls</h3>
            <div className="control-row">
              <button className="btn btn-accent" onClick={runMatcher}>Run Matcher</button>
              <label className="mini-label">
                Min Score
                <input
                  type="number"
                  value={threshold}
                  min={1}
                  max={40}
                  onChange={(event) => updateSession({ threshold: +event.target.value })}
                />
              </label>
            </div>
            <div className="control-row">
              <select
                value={supplierFilter}
                onChange={(event) => updateSession({ supplierFilter: event.target.value })}
              >
                <option value="">All suppliers</option>
                {webSuppliers.map((supplier) => <option key={supplier}>{supplier}</option>)}
              </select>
              <select
                value={viewFilter}
                onChange={(event) => updateSession({ viewFilter: event.target.value })}
              >
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
                onClick={() => updateSession({ restrictToday: !restrictToday })}
              >
                Ends Today: {restrictToday ? 'On' : 'Off'}
              </button>
              {rejectedHQIds.length > 0 && (
                <button className="btn" onClick={() => updateSession({ rejectedHQIds: [] })}>
                  Reset Rejects ({rejectedHQIds.length})
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="dedupe-results">
          {categorized && (
            <div className="stats-bar">
              <div className="stat-box"><div className="stat-n stat-good">{categorized.matched.length}</div><div className="stat-l">Matched</div></div>
              <div className="stat-box"><div className="stat-n stat-purple">{categorized.extensions.length}</div><div className="stat-l">Extended</div></div>
              <div className="stat-box"><div className="stat-n stat-bad">{categorized.unmatched.length}</div><div className="stat-l">Unmatched</div></div>
              <div className="stat-box"><div className="stat-n">{categorized.total}</div><div className="stat-l">Total HQ</div></div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn" onClick={handleExportUnmatched}>Copy Unmatched</button>
                <button className="btn btn-forward" onClick={handleSendToCopy}>Send to Copy -&gt;</button>
              </div>
            </div>
          )}

          {!results && <div className="empty-state">Paste HQ deals, load website JSON, then run the matcher</div>}

          {visible && (
            <div className="match-list">
              {visible.extensions.length > 0 && (
                <>
                  <h4 className="section-heading heading-purple">Possible Extensions ({visible.extensions.length})</h4>
                  {visible.extensions.map((result) => (
                    <MatchCard key={result.hq.id} r={result} today={categorized.today} onReject={handleReject} />
                  ))}
                </>
              )}
              {visible.matched.length > 0 && (
                <>
                  <h4 className="section-heading heading-good">Matched ({visible.matched.length})</h4>
                  {visible.matched.map((result) => (
                    <MatchCard key={result.hq.id} r={result} today={categorized.today} onReject={handleReject} />
                  ))}
                </>
              )}
              {visible.unmatched.length > 0 && (
                <>
                  <h4 className="section-heading heading-bad">Unmatched ({visible.unmatched.length})</h4>
                  {visible.unmatched.map((result) => (
                    <UnmatchedCard key={result.hq.id} r={result} today={categorized.today} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ r, today, onReject }) {
  const score = r.meta?.score ?? 0;
  const cardClass = r.meta.isExtension ? 'card-ext' : score >= 15 ? 'card-high' : score >= 10 ? 'card-mid' : 'card-low';
  const scoreClass = score >= 15 ? 'stat-good' : score >= 10 ? 'stat-warn' : 'stat-bad';
  const endsToday = sameDay(r.hq.end, today);

  return (
    <div className={`match-card ${cardClass} ${endsToday ? 'card-today' : ''}`}>
      <div className="match-header">
        <div className={`score-box ${scoreClass}`}>{score}</div>
        <span className="supplier-name">{r.hq.vendor}</span>
        {r.hq.type === 'exclusive' && <span className="pill pill-bad">EXCLUSIVE</span>}
        {r.meta.isExtension && <span className="pill pill-purple">EXTENSION</span>}
        {endsToday && <span className="pill pill-danger">ENDS TODAY</span>}
      </div>
      <div className="match-grid">
        <div className="match-side">
          <h4>HQ Deal</h4>
          <div className="match-text">{r.hq.text}</div>
          <div className="match-meta">{r.hq.ongoing ? 'Ongoing' : r.hq.end ? `Ends: ${dateFmt.format(r.hq.end)}` : ''}</div>
        </div>
        <div className="match-side">
          <h4>Website Deal</h4>
          <div className="match-text">{r.web?.raw?.title || ''}</div>
          <div className="match-meta">{r.web?.raw?.shopListing || ''}</div>
          <div className="match-meta">{r.web?.expiryDate ? `Ends: ${dateFmt.format(r.web.expiryDate)}` : 'No expiry'}</div>
        </div>
      </div>
      <div className="why-chips">
        {(r.meta.why || []).map((why, index) => (
          <span key={index} className={`why-chip chip-${why.type}`}>{why.text}</span>
        ))}
      </div>
      <div className="card-actions">
        <button className="btn btn-reject" onClick={() => onReject(r.hq.id)}>Reject</button>
      </div>
    </div>
  );
}

function UnmatchedCard({ r, today }) {
  const endsToday = sameDay(r.hq.end, today);
  return (
    <div className={`match-card card-unmatched ${endsToday ? 'card-today' : ''}`}>
      <div className="match-header">
        <span className="supplier-name">{r.hq.vendor}</span>
        {r.hq.type === 'exclusive' && <span className="pill pill-bad">EXCLUSIVE</span>}
        {endsToday && <span className="pill pill-danger">ENDS TODAY</span>}
        {r.hq.dateWarning && <span className="pill pill-warn" title={r.hq.dateWarning}>DATE</span>}
      </div>
      <div className="match-text">{r.hq.text}</div>
      <div className="match-meta">{r.hq.ongoing ? 'Ongoing' : r.hq.end ? `Ends: ${dateFmt.format(r.hq.end)}` : ''}</div>
      <div className="feature-chips">
        {[...r.hq.bag.features].map((feature) => <span key={feature} className="feature-chip">{feature}</span>)}
      </div>
    </div>
  );
}
