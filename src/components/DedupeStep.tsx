import React, { useMemo, useCallback, useRef, useState } from 'react';
import {
  parseHQ, resetIds, ingestWebsiteJSON, runFullMatch,
  exportUnmatched, sameDay, dateFmt,
} from '../logic/dedupe.js';
import { validateWebsiteExport } from '../logic/dealCoreClient';

function parseWebsiteRows(text) {
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : data.entries || data.data || [];
}

export default function DedupeStep({ session, onSessionChange, onComplete, showToast }) {
  const fileRef = useRef(null);
  const [importError, setImportError] = useState('');

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
          matched: matched.filter((result) => (result.meta?.confidence ?? 'none') !== 'strong'),
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
      const validation = await validateWebsiteExport(rows);

      if ('error' in validation) {
        setImportError(validation.error.message);
        updateSession({ websiteRows: [], lastRun: null, rejectedHQIds: [] });
        showToast('Website export not recognized', 'error');
        return;
      }

      setImportError('');
      updateSession({ websiteRows: validation.data.rows, lastRun: null, rejectedHQIds: [] });
      showToast(
        `${validation.data.recognizedCount} website deals loaded`,
        'success',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setImportError(`Could not read this JSON file: ${message}`);
      updateSession({ websiteRows: [], lastRun: null, rejectedHQIds: [] });
      showToast('Failed to parse website JSON', 'error');
    } finally {
      event.target.value = '';
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

  const canCompare = hqDeals.length > 0 && websiteDeals.length > 0;
  const sourceVendorCount = new Set(hqDeals.map((deal) => deal.vendor)).size;

  return (
    <div className="dedupe-step dedupe-workflow">
      <section className="dedupe-setup">
        <div className="dedupe-section-heading">
          <div><span className="workspace-eyebrow">Prepare the comparison</span><h3>Two inputs. One clean decision.</h3></div>
          {lastRun && <span className="status-chip status-complete">Comparison ready</span>}
        </div>
        <div className="dedupe-setup-grid">
          <article className={`setup-card ${hqDeals.length ? 'is-ready' : ''}`}>
            <span className="setup-index">1</span>
            <div className="setup-card-copy"><span className="setup-label">New deal batch</span><strong>{hqDeals.length ? `${hqDeals.length} deals from ${sourceVendorCount} suppliers` : 'No deals loaded'}</strong><span>{hqDeals.length ? 'Carried forward from Tag' : 'Complete the Tag step first'}</span></div>
            <span className="setup-check">{hqDeals.length ? '✓' : ''}</span>
          </article>
          <article className={`setup-card ${websiteDeals.length ? 'is-ready' : ''}`}>
            <span className="setup-index">2</span>
            <div className="setup-card-copy"><span className="setup-label">Current website</span><strong>{websiteDeals.length ? `${websiteDeals.length} live deals loaded` : 'Load the website export'}</strong><button className="setup-link" onClick={() => fileRef.current?.click()}>{websiteDeals.length ? 'Replace JSON export' : 'Choose true_entries.json'}</button></div>
            <span className="setup-check">{websiteDeals.length ? '✓' : ''}</span>
            <input ref={fileRef} type="file" accept=".json" className="visually-hidden" onChange={handleFileLoad} />
          </article>
          <article className={`setup-card setup-action ${canCompare ? 'is-ready' : ''}`}>
            <span className="setup-index">3</span>
            <div className="setup-card-copy"><span className="setup-label">Compare</span><strong>{canCompare ? 'Find what is already live' : 'Waiting for both inputs'}</strong><span>Keep only genuinely new work.</span></div>
            <button className="btn btn-accent compare-button" onClick={runMatcher} disabled={!canCompare}>{lastRun ? 'Compare again' : 'Compare deals'}</button>
          </article>
        </div>
        {importError && <div className="gate-warning gate-warning-error import-blocker" role="alert"><strong>That website export could not be used.</strong><div>{importError}</div></div>}
        <details className="dedupe-disclosure">
          <summary>Review source text and advanced matching options</summary>
          <div className="advanced-grid">
            <label className="advanced-source"><span>Tagged source</span><textarea value={hqText} onChange={(event) => updateSession({ hqText: event.target.value, lastRun: null, rejectedHQIds: [] })} spellCheck={false} /></label>
            <div className="advanced-controls">
              <label className="mini-label">Minimum score <input type="number" value={threshold} min={1} max={40} onChange={(event) => updateSession({ threshold: +event.target.value })} /></label>
              <label className="mini-label">Supplier <select value={supplierFilter} onChange={(event) => updateSession({ supplierFilter: event.target.value })}><option value="">All suppliers</option>{webSuppliers.map((supplier) => <option key={String(supplier)}>{String(supplier)}</option>)}</select></label>
              <button className={`btn ${restrictToday ? 'btn-danger' : ''}`} onClick={() => updateSession({ restrictToday: !restrictToday })}>Exclude ending today: {restrictToday ? 'On' : 'Off'}</button>
              {rejectedHQIds.length > 0 && <button className="btn" onClick={() => updateSession({ rejectedHQIds: [] })}>Restore rejected matches ({rejectedHQIds.length})</button>}
            </div>
          </div>
        </details>
      </section>

      {dateWarnings.length > 0 && (
        <details className="dedupe-disclosure warning-disclosure">
          <summary>{dateWarnings.length} date {dateWarnings.length === 1 ? 'warning' : 'warnings'} need review</summary>
          {dateWarnings.map((deal, index) => <div key={index} className="date-warning"><strong>{deal.vendor}:</strong> {deal.dateWarning}<div className="mini">{deal.text}</div></div>)}
        </details>
      )}

      <div className="legacy-dedupe-inputs visually-hidden" aria-hidden="true">
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
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileLoad}
            />
            <span className="pill">{websiteDeals.length} loaded</span>
            {importError && (
              <div className="gate-warning gate-warning-error" role="alert">
                <strong>Website export not recognized.</strong>
                <div>{importError}</div>
              </div>
            )}
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
                {webSuppliers.map((supplier) => <option key={String(supplier)}>{String(supplier)}</option>)}
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
            <>
              <div className="results-hero">
                <div>
                  <span className="workspace-eyebrow">Comparison complete</span>
                  <h3>{categorized.matched.length + categorized.extensions.length} already covered. {categorized.unmatched.length} to move forward.</h3>
                  <p>Existing deals are set aside so you can focus on genuinely new work.</p>
                </div>
                <div className="results-actions">
                  <button className="btn" onClick={handleExportUnmatched}>Copy new deals</button>
                  <button className="btn btn-forward results-primary" onClick={handleSendToCopy} disabled={!categorized.unmatched.length}>Send {categorized.unmatched.length} to Copy →</button>
                </div>
              </div>
              <div className="decision-metrics">
                <button className={`decision-metric metric-good ${viewFilter === 'matched' ? 'is-active' : ''}`} onClick={() => updateSession({ viewFilter: 'matched' })}><strong>{categorized.matched.length}</strong><span>Existing matches</span></button>
                <button className={`decision-metric metric-purple ${viewFilter === 'updates' ? 'is-active' : ''}`} onClick={() => updateSession({ viewFilter: 'updates' })}><strong>{categorized.extensions.length}</strong><span>Extensions</span></button>
                <button className={`decision-metric metric-new ${viewFilter === 'unmatched' ? 'is-active' : ''}`} onClick={() => updateSession({ viewFilter: 'unmatched' })}><strong>{categorized.unmatched.length}</strong><span>Needs copy</span></button>
                <button className={`decision-metric metric-total ${viewFilter === 'all' ? 'is-active' : ''}`} onClick={() => updateSession({ viewFilter: 'all' })}><strong>{categorized.total}</strong><span>Source total</span></button>
              </div>
            </>
          )}

          {!results && <div className="dedupe-empty"><span className="empty-orbit">↗</span><h3>Ready when both inputs are green</h3><p>The comparison will separate existing website deals from the deals that need copy.</p></div>}

          {visible && (
            <div className="match-list focused-results">
              {visible.unmatched.length > 0 && (
                <section className="result-group result-group-new">
                  <div className="result-group-heading"><div><span className="result-kicker">Next action</span><h4>New deals to prepare ({visible.unmatched.length})</h4></div><p>These did not clear the match threshold.</p></div>
                  <div className="compact-card-list">{visible.unmatched.map((result) => <UnmatchedCard key={result.hq.id} r={result} today={categorized.today} />)}</div>
                </section>
              )}
              {visible.extensions.length > 0 && (
                <details className="result-group result-group-collapsible" open={viewFilter === 'updates'}>
                  <summary>Possible extensions <span>{visible.extensions.length}</span></summary>
                  <div className="compact-card-list">{visible.extensions.map((result) => <MatchCard key={result.hq.id} r={result} today={categorized.today} onReject={handleReject} />)}</div>
                </details>
              )}
              {visible.matched.length > 0 && (
                <details className="result-group result-group-collapsible" open={viewFilter === 'matched'}>
                  <summary>Existing website matches <span>{visible.matched.length}</span><small>Hidden by default so you can focus on new work</small></summary>
                  <div className="compact-card-list">{visible.matched.map((result) => <MatchCard key={result.hq.id} r={result} today={categorized.today} onReject={handleReject} />)}</div>
                </details>
              )}
            </div>
          )}
        </div>
    </div>
  );
}

function MatchCard({ r, today, onReject }) {
  const score = r.meta?.score ?? 0;
  const confidence = r.meta?.confidence ?? 'none';
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
        {confidence !== 'none' && <span className="pill">{confidence.toUpperCase()}</span>}
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
      {(r.meta.stages || []).length > 0 && (
        <div className="feature-chips">
          {r.meta.stages.map((stage) => (
            <div key={stage.key} className="match-meta">
              <strong>{stage.label}:</strong> {formatStageDelta(stage.delta)} {stage.reasons.length ? `· ${stage.reasons.join(', ')}` : '· no signal'}
            </div>
          ))}
        </div>
      )}
      <div className="card-actions">
        <button className="btn btn-reject" onClick={() => onReject(r.hq.id)}>Reject</button>
      </div>
    </div>
  );
}

function UnmatchedCard({ r, today }) {
  const endsToday = sameDay(r.hq.end, today);
  const topCandidates = (r.meta?.candidateRankings || []).filter((candidate) => candidate.score > 0);
  const closestCandidate = r.web
    ? { title: r.web.raw?.title || r.web.text, supplier: r.web.supplier, score: r.meta?.score ?? 0 }
    : topCandidates[0];
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
      {closestCandidate && (
        <div className="closest-candidate">
          <span>Closest website candidate · score {closestCandidate.score}</span>
          <strong>{closestCandidate.title || closestCandidate.supplier}</strong>
        </div>
      )}
      {(r.meta?.stages || []).map((stage) => (
        <div key={stage.key} className="match-meta">
          <strong>{stage.label}:</strong> {formatStageDelta(stage.delta)} {stage.reasons.length ? `· ${stage.reasons.join(', ')}` : '· no signal'}
        </div>
      ))}
      {topCandidates.length > 0 && (
        <div className="feature-chips">
          {topCandidates.map((candidate, index) => (
            <div key={`${candidate.supplier}-${index}`} className="match-meta">
              <strong>Candidate:</strong> {candidate.supplier} ({candidate.score}, {candidate.confidence})
            </div>
          ))}
        </div>
      )}
      <div className="feature-chips">
        {[...r.hq.bag.features].map((feature) => <span key={feature} className="feature-chip">{feature}</span>)}
      </div>
    </div>
  );
}

function formatStageDelta(delta) {
  return delta > 0 ? `+${delta}` : `${delta}`;
}
