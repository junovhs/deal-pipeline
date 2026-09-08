import React, { useMemo, useCallback, useRef, useState } from 'react';
import {
  parseHQ, resetIds, ingestWebsiteJSON, runFullMatch,
  categorizeDedupeResults, exportUnmatched, sameDay, dateFmt,
  MATCHER_VERSION,
} from '../logic/dedupe.js';
import { buildReviewQueue, dateChange } from '../logic/review.js';
import { validateWebsiteExport } from '../logic/dealCoreClient';

function parseWebsiteRows(text) {
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : data.entries || data.data || [];
}

/**
 * Orchestrates website-export validation, supplier-scoped matching, and human
 * review of matched, extension, unmatched, and excluded deals. Matcher inputs
 * are frozen into `lastRun`, rejected match proposals return to unmatched, and
 * only the reviewed unmatched set is handed to Copywriting.
 */
export default function DedupeStep({ session, onSessionChange, onComplete, showToast }) {
  const fileRef = useRef(null);
  const [importError, setImportError] = useState('');
  const [search, setSearch] = useState('');
  const [lastDecision, setLastDecision] = useState(null);
  const decisions = session.decisions || {};
  const activeView = ['review', 'actions', 'unchanged'].includes(session.viewFilter) ? session.viewFilter : 'review';

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
    if (lastRun.matcherVersion !== MATCHER_VERSION) return null;
    if (!lastRun.hqText.trim() || !lastRun.websiteRows.length) return null;
    resetIds();
    const lastRunDeals = parseHQ(lastRun.hqText);
    const lastRunWebsiteDeals = ingestWebsiteJSON(lastRun.websiteRows);
    return runFullMatch(lastRunDeals, lastRunWebsiteDeals, {
      filterSupplier: lastRun.supplierFilter,
    });
  }, [lastRun]);

  const categorized = useMemo(() => {
    if (!results) return null;
    return categorizeDedupeResults(results, {
      threshold,
      excludedHQIds: rejectedHQIds,
      excludeEndingToday: restrictToday,
    });
  }, [results, rejectedHQIds, restrictToday, threshold]);

  const queue = useMemo(() => buildReviewQueue(categorized, decisions), [categorized, decisions]);
  const needsCopy = [...queue.changes, ...queue.newDeals];
  const filtered = (rows) => rows.filter((row) => `${row.hq.vendor} ${row.hq.text} ${row.web?.raw?.title || ''}`.toLowerCase().includes(search.toLowerCase()));
  const decide = (id, value) => {
    setLastDecision({ previous: { ...decisions } });
    updateSession({ decisions: { ...decisions, [id]: value } });
  };
  const undo = () => {
    if (!lastDecision) return;
    updateSession({ decisions: lastDecision.previous });
    setLastDecision(null);
  };

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
        updateSession({ websiteRows: [], lastRun: null, rejectedHQIds: [], decisions: {} });
        showToast('Website export not recognized', 'error');
        return;
      }

      setImportError('');
      updateSession({ websiteRows: validation.data.rows, websiteFileName: file.name, lastRun: null, rejectedHQIds: [], decisions: {} });
      showToast(
        `${validation.data.recognizedCount} website deals loaded`,
        'success',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setImportError(`Could not read this JSON file: ${message}`);
      updateSession({ websiteRows: [], lastRun: null, rejectedHQIds: [], decisions: {} });
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
        matcherVersion: MATCHER_VERSION,
        hqText,
        websiteRows,
        supplierFilter,
      },
      rejectedHQIds: [],
      decisions: {},
      viewFilter: 'review',
    });
    setLastDecision(null);
  }, [hqDeals.length, hqText, showToast, supplierFilter, updateSession, websiteRows]);

  const handleExportUnmatched = async () => {
    if (!needsCopy.length) return;
    try {
      await navigator.clipboard.writeText(exportUnmatched(needsCopy.map(row => row.hq)));
      showToast('New and changed deals copied', 'success');
    } catch { showToast('Clipboard unavailable. Please try again.', 'error'); }
  };
  const handleSendToCopy = () => {
    if (needsCopy.length) onComplete(exportUnmatched(needsCopy.map(row => row.hq)), needsCopy.map(row => ({ vendor: row.hq.vendor, text: row.hq.text, action: queue.changes.includes(row) ? 'update' : 'new', websiteTitle: row.web?.raw?.title || '' })));
  };

  const canCompare = hqDeals.length > 0 && websiteDeals.length > 0;
  const sourceVendorCount = new Set(hqDeals.map((deal) => deal.vendor)).size;

  return (
    <div className="dedupe-step dedupe-workflow">
      <section className="dedupe-setup">
        <div className="dedupe-section-heading">
          <div><span className="workspace-eyebrow">Prepare the comparison</span><h3>Find what needs your attention.</h3></div>
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
            <div className="setup-card-copy"><span className="setup-label">Current website</span><strong>{websiteDeals.length ? `${websiteDeals.length} live deals loaded` : 'Load the website export'}</strong><button className="setup-link" onClick={() => fileRef.current?.click()}>{websiteDeals.length ? `Replace ${session.websiteFileName || 'JSON export'}` : 'Choose true_entries.json'}</button></div>
            <span className="setup-check">{websiteDeals.length ? '✓' : ''}</span>
            <input ref={fileRef} type="file" accept=".json" className="visually-hidden" onChange={handleFileLoad} />
          </article>
          <article className={`setup-card setup-action ${canCompare ? 'is-ready' : ''}`}>
            <span className="setup-index">3</span>
            <div className="setup-card-copy"><span className="setup-label">Compare</span><strong>{canCompare ? 'Find what is already live' : 'Waiting for both inputs'}</strong><span>Review matches, keep new and changed deals.</span></div>
            <button className="btn btn-accent compare-button" onClick={runMatcher} disabled={!canCompare}>{lastRun ? 'Compare again' : 'Compare deals'}</button>
          </article>
        </div>
        {importError && <div className="gate-warning gate-warning-error import-blocker" role="alert"><strong>That website export could not be used.</strong><div>{importError}</div></div>}
        <details className="dedupe-disclosure">
          <summary>Review source text and advanced matching options</summary>
          <div className="advanced-grid">
            <label className="advanced-source"><span>Tagged source</span><textarea value={hqText} onChange={(event) => updateSession({ hqText: event.target.value, lastRun: null, rejectedHQIds: [], decisions: {} })} spellCheck={false} /></label>
            <div className="advanced-controls">
              <label className="mini-label">Minimum score <input type="number" value={threshold} min={0} max={40} onChange={(event) => updateSession({ threshold: Math.max(0, Math.min(40, Number(event.target.value) || 0)), decisions: {} })} /></label>
              <label className="mini-label">Supplier <select value={supplierFilter} onChange={(event) => updateSession({ supplierFilter: event.target.value, lastRun: null, decisions: {}, rejectedHQIds: [] })}><option value="">All suppliers</option>{webSuppliers.map((supplier) => <option key={String(supplier)}>{String(supplier)}</option>)}</select></label>
              <button className={`btn ${restrictToday ? 'btn-danger' : ''}`} onClick={() => updateSession({ restrictToday: !restrictToday })}>Exclude ending today: {restrictToday ? 'On' : 'Off'}</button>
              {rejectedHQIds.length > 0 && <button className="btn" onClick={() => updateSession({ rejectedHQIds: [] })}>Undo no-match decisions ({rejectedHQIds.length})</button>}
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

      {categorized ? (
        <section className="dedupe-results">
          <div className="results-hero">
            <div><span className="workspace-eyebrow">Your action list</span><h3>{needsCopy.length} new or changed · {queue.review.length} to review</h3><p>Start with the weakest matches. Confirm unchanged deals to set them aside.</p></div>
            <div className="results-actions">
              <button className="btn" disabled={!needsCopy.length || !!queue.review.length} onClick={handleExportUnmatched}>Copy action list</button>
              <button className="btn btn-forward" disabled={!needsCopy.length || !!queue.review.length} onClick={handleSendToCopy}>{queue.review.length ? `Review ${queue.review.length} matches first` : `Send ${needsCopy.length} to Publish →`}</button>
            </div>
          </div>
          <div className="review-toolbar">
            <div className="review-tabs" aria-label="Comparison views">
              <button className={`btn ${activeView === 'review' ? 'btn-accent' : ''}`} onClick={() => updateSession({ viewFilter: 'review' })}>Review matches · {queue.review.length}</button>
              <button className={`btn ${activeView === 'actions' ? 'btn-accent' : ''}`} onClick={() => updateSession({ viewFilter: 'actions' })}>New & changes · {needsCopy.length}</button>
              <button className={`btn ${activeView === 'unchanged' ? 'btn-accent' : ''}`} onClick={() => updateSession({ viewFilter: 'unchanged' })}>No change · {queue.unchanged.length}</button>
            </div>
            <label className="review-search">Find a deal<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Supplier or offer…" /></label>
            <button className="btn" disabled={!lastDecision} onClick={undo}>Undo last decision</button>
          </div>
          {activeView === 'review' && <p className="review-hint">Lowest score first · A match score suggests the same offer; check the terms and dates before choosing “No change.”</p>}
          {activeView === 'review' && queue.review.length > 0 && <div className="review-finish"><span>Finished checking the list? Set aside the matches that need no work.</span><button className="btn" onClick={() => {
            setLastDecision({ previous: { ...decisions } });
            updateSession({ decisions: { ...decisions, ...Object.fromEntries(queue.review.map(row => [row.hq.id, 'unchanged'])) } });
          }}>Confirm all {queue.review.length} remaining unchanged</button></div>}
          <div className="compact-card-list">
            {activeView === 'review' && filtered(queue.review).map(row => <MatchCard key={row.hq.id} r={row} today={categorized.today} onDecision={decide} />)}
            {activeView === 'actions' && filtered(needsCopy).map(row => <MatchCard key={row.hq.id} r={row} today={categorized.today} onDecision={decide} decision={queue.changes.includes(row) ? 'change' : 'new'} canUndo={!!decisions[row.hq.id]} />)}
            {activeView === 'unchanged' && filtered(queue.unchanged).map(row => <MatchCard key={row.hq.id} r={row} today={categorized.today} onDecision={decide} decision="unchanged" />)}
          </div>
          {!filtered(activeView === 'review' ? queue.review : activeView === 'actions' ? needsCopy : queue.unchanged).length && <div className="dedupe-empty"><h3>{search ? 'No deals match your search' : activeView === 'review' ? 'Match review complete' : activeView === 'actions' ? 'No new or changed deals' : 'No unchanged deals confirmed yet'}</h3><p>{activeView === 'review' && !search ? 'Open New & changes to see the work moving forward.' : 'Your other lists are available above.'}</p></div>}
          {!!queue.excluded.length && <details className="dedupe-disclosure"><summary>Excluded by ending-today policy · {queue.excluded.length}</summary>{queue.excluded.map(row => <p key={row.hq.id} className="review-hint">{row.hq.vendor} · {row.hq.text}</p>)}</details>}
        </section>
      ) : <div className="dedupe-empty"><h3>{lastRun && lastRun.matcherVersion !== MATCHER_VERSION ? 'Matching has improved — compare again' : 'Load your website export, then compare'}</h3><p>{lastRun && lastRun.matcherVersion !== MATCHER_VERSION ? 'Your inputs are saved. Run a fresh comparison before reviewing the updated candidates.' : 'Your saved source and website file stay here while you move between steps.'}</p></div>}
    </div>
  );
}

function MatchCard({ r, today, onDecision, decision = null, canUndo = true }) {
  const change = dateChange(r);
  return <article className={`match-card review-card ${decision ? `decision-${decision}` : ''}`}>
    <div className="match-header">
      <span className="supplier-name">{r.hq.vendor}</span>
      {r.web && <span className="pill">Score {r.meta?.score ?? 0}</span>}
      {r.hq.type === 'exclusive' && <span className="pill pill-purple">Exclusive</span>}
      {decision && <span className="pill">{decision === 'new' ? 'New deal' : decision === 'change' ? 'Update existing deal' : 'No change needed'}</span>}
      {sameDay(r.hq.end, today) && <span className="pill pill-warn">Ends today</span>}
    </div>
    {r.meta?.ambiguous && <div className="comparison-alert">Ambiguous match — another website candidate scores {r.meta.candidateMargin < 0 ? 'higher' : 'within 3 points'}. Check the alternatives below.</div>}
    {r.meta?.numbersMismatch && <div className="comparison-alert">Offer amounts differ. This may be an update or a different offer.</div>}
    {change && <div className="comparison-alert">{change}</div>}
    <div className="match-grid">
      <div className="match-side"><h4>Incoming offer</h4><p className="match-text">{r.hq.text}</p><div className="match-meta">{r.hq.ongoing ? 'Ongoing' : r.hq.end ? `Ends ${dateFmt.format(r.hq.end)}` : 'No end date in source'}</div></div>
      <div className="match-side"><h4>{decision === 'new' ? 'Closest website candidate' : 'Currently on the website'}</h4><p className="match-text">{r.web?.raw?.title || r.web?.text || 'No website candidate'}</p><p className="website-description">{r.web?.raw?.shopListing || ''}</p><div className="match-meta">{r.web?.expiryDate ? `Ends ${dateFmt.format(r.web.expiryDate)}` : 'No website expiry'}</div></div>
    </div>
    <div className="card-actions">
      {decision ? (canUndo && <button className="btn" onClick={() => onDecision(r.hq.id, undefined)}>Undo decision / review again</button>) : <>
        <button className="btn btn-success" onClick={() => onDecision(r.hq.id, 'unchanged')}>Same offer · no change</button>
        <button className="btn" onClick={() => onDecision(r.hq.id, 'change')}>Same offer · needs changes</button>
        <button className="btn btn-reject" onClick={() => onDecision(r.hq.id, 'new')}>Doesn’t match · new deal</button>
      </>}
      {r.web && <a className="btn" href={`https://travelperks.com/admin/entries/deals?search=${encodeURIComponent(r.web.raw?.title || r.hq.vendor)}`} target="travelperks-admin" rel="noreferrer">Find on website ↗</a>}
    </div>
    <details className="match-evidence"><summary>Why this candidate? / Alternatives</summary>
      {(r.meta?.candidateRankings || []).map((candidate, index) => <p className="match-meta" key={index}><strong>{candidate.title}</strong> · score {candidate.score}</p>)}<div className="why-chips">{(r.meta?.why || []).map((why, i) => <span className={`why-chip chip-${why.type}`} key={i}>{why.text}</span>)}</div>{(r.meta?.stages || []).map(stage => <p className="match-meta" key={stage.key}>{stage.label}: {stage.delta > 0 ? '+' : ''}{stage.delta} · {stage.reasons.join(', ') || 'no signal'}</p>)}</details>
  </article>;
}
