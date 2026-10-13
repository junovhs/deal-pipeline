import React, { useMemo, useCallback, useRef, useState } from 'react';
import {
  parseHQ, resetIds, ingestWebsiteJSON, runFullMatch,
  categorizeDedupeResults, exportUnmatched, dateFmt,
  MATCHER_VERSION,
} from '../logic/dedupe.js';
import { buildReviewQueue } from '../logic/review.js';
import { validateWebsiteExport } from '../logic/dealCoreClient';

function parseWebsiteRows(text) {
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : data.entries || data.data || [];
}

/**
 * Orchestrates website-export validation, supplier-scoped marker matching, and
 * the matcher's verdicts: every incoming deal is already on the site, an
 * update to a website deal, or new. Only rows the matcher abstains on ask the
 * operator; the rest are one-line rows that can be overridden. Update and new
 * rows are handed to Publish. Matcher inputs are frozen into `lastRun`.
 */
export default function DedupeStep({ session, onSessionChange, onComplete, showToast }) {
  const fileRef = useRef(null);
  const [importError, setImportError] = useState('');
  const [search, setSearch] = useState('');
  const [lastDecision, setLastDecision] = useState(null);
  const decisions = session.decisions || {};

  const {
    hqText,
    websiteRows,
    lastRun,
    supplierFilter,
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

  const categorized = useMemo(() => (results ? categorizeDedupeResults(results) : null), [results]);
  const queue = useMemo(() => buildReviewQueue(categorized, decisions), [categorized, decisions]);
  const filtered = (rows) => rows.filter((row) => `${row.hq.vendor} ${row.hq.text} ${row.web?.raw?.title || ''}`.toLowerCase().includes(search.toLowerCase()));

  // Choosing the matcher's own verdict clears the override.
  const decide = (row, value) => {
    setLastDecision({ previous: { ...decisions } });
    const next = { ...decisions };
    const natural = row.web ? row.meta?.verdict : 'new';
    if (value === natural) delete next[row.hq.id]; else next[row.hq.id] = value;
    updateSession({ decisions: next });
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
        updateSession({ websiteRows: [], lastRun: null, decisions: {} });
        showToast('Website export not recognized', 'error');
        return;
      }

      setImportError('');
      updateSession({ websiteRows: validation.data.rows, websiteFileName: file.name, lastRun: null, decisions: {} });
      showToast(
        `${validation.data.recognizedCount} website deals loaded`,
        'success',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setImportError(`Could not read this JSON file: ${message}`);
      updateSession({ websiteRows: [], lastRun: null, decisions: {} });
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
      decisions: {},
    });
    setLastDecision(null);
  }, [hqDeals.length, hqText, showToast, supplierFilter, updateSession, websiteRows]);

  const toPublish = [...queue.update, ...queue.added];
  const handleExportWork = async () => {
    if (!toPublish.length) return;
    try {
      await navigator.clipboard.writeText(exportUnmatched(toPublish.map(row => row.hq)));
      showToast('Work list copied', 'success');
    } catch { showToast('Clipboard unavailable. Please try again.', 'error'); }
  };
  const handleSendToCopy = () => {
    if (!toPublish.length || queue.ask.length) return;
    // Updates keep the website entry's URL in Publish; new deals get a slug.
    onComplete(exportUnmatched(toPublish.map(row => row.hq)), [
      ...queue.update.map(row => ({ vendor: row.hq.vendor, text: row.hq.text, action: 'update', websiteTitle: row.web?.raw?.title || '' })),
      ...queue.added.map(row => ({ vendor: row.hq.vendor, text: row.hq.text, action: 'new', websiteTitle: '' })),
    ]);
  };

  const canCompare = hqDeals.length > 0 && websiteDeals.length > 0;
  const sourceVendorCount = new Set(hqDeals.map((deal) => deal.vendor)).size;
  const fileInput = <input ref={fileRef} type="file" accept=".json" className="visually-hidden" onChange={handleFileLoad} />;
  const sourceControls = (
    <details className="cmp-source">
      <summary>Source &amp; filters</summary>
      <div className="advanced-grid">
        <label className="advanced-source"><span>Tagged source</span><textarea value={hqText} onChange={(event) => updateSession({ hqText: event.target.value, lastRun: null, decisions: {} })} spellCheck={false} /></label>
        <div className="advanced-controls">
          <label className="mini-label">Supplier <select value={supplierFilter} onChange={(event) => updateSession({ supplierFilter: event.target.value, lastRun: null, decisions: {} })}><option value="">All suppliers</option>{webSuppliers.map((supplier) => <option key={String(supplier)}>{String(supplier)}</option>)}</select></label>
        </div>
      </div>
    </details>
  );

  return (
    <div className="dedupe-step cmp">
      {categorized ? (
        <div className="cmp-inputs">
          <span><strong>{hqDeals.length}</strong> incoming from {sourceVendorCount} suppliers</span>
          <span>·</span>
          <span><strong>{websiteDeals.length}</strong> on the website</span>
          <button className="setup-link" onClick={() => fileRef.current?.click()}>Replace {session.websiteFileName || 'export'}</button>
          {fileInput}
          <button className="btn btn-sm" onClick={runMatcher} disabled={!canCompare}>Compare again</button>
          {sourceControls}
        </div>
      ) : (
        <section className="dedupe-setup">
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
              {fileInput}
            </article>
            <article className={`setup-card setup-action ${canCompare ? 'is-ready' : ''}`}>
              <span className="setup-index">3</span>
              <div className="setup-card-copy"><span className="setup-label">Compare</span><strong>{canCompare ? 'Find what is already live' : 'Waiting for both inputs'}</strong></div>
              <button className="btn btn-accent compare-button" onClick={runMatcher} disabled={!canCompare}>Compare deals</button>
            </article>
          </div>
          {sourceControls}
        </section>
      )}
      {importError && <div className="gate-warning gate-warning-error import-blocker" role="alert"><strong>That website export could not be used.</strong><div>{importError}</div></div>}

      {dateWarnings.length > 0 && (
        <details className="cmp-group cmp-warnings">
          <summary>{dateWarnings.length} date {dateWarnings.length === 1 ? 'warning' : 'warnings'}</summary>
          {dateWarnings.map((deal, index) => <div key={index} className="cmp-note"><strong>{deal.vendor}:</strong> {deal.dateWarning} — {deal.text}</div>)}
        </details>
      )}

      {categorized ? (
        <>
          <div className="cmp-bar">
            <div className="cmp-counts">
              <span className={queue.ask.length ? 'is-ask' : 'is-done'}>{queue.ask.length ? `${queue.ask.length} need you` : '✓ Nothing needs you'}</span>
              <span>{queue.update.length} update</span>
              <span>{queue.added.length} new</span>
              <span>{queue.onSite.length} on site</span>
              {!!queue.excluded.length && <span>{queue.excluded.length} ending today</span>}
            </div>
            <input className="cmp-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter…" />
            <button className="btn btn-sm" disabled={!lastDecision} onClick={undo}>Undo</button>
            <button className="btn btn-sm" disabled={!toPublish.length} onClick={handleExportWork}>Copy list</button>
            <button className="btn btn-sm btn-forward" disabled={!toPublish.length || !!queue.ask.length} onClick={handleSendToCopy}>{queue.ask.length ? `Decide ${queue.ask.length} first` : `Send ${toPublish.length} to Publish →`}</button>
          </div>

          {!!queue.ask.length && <section className="cmp-group cmp-ask">
            <h3>Needs your call · {queue.ask.length}</h3>
            {filtered(queue.ask).map(row => <DealRow key={row.hq.id} r={row} bucket="ask" onDecision={decide} />)}
          </section>}
          <RowGroup title="Update the website deal" rows={filtered(queue.update)} bucket="update" onDecision={decide} open />
          <RowGroup title="New — nothing like it on the site" rows={filtered(queue.added)} bucket="new" onDecision={decide} />
          <RowGroup title="Already on site" rows={filtered(queue.onSite)} bucket="on-site" onDecision={decide} />
          {!!queue.excluded.length && <details className="cmp-group">
            <summary>Ending today — not listed · {queue.excluded.length}</summary>
            {queue.excluded.map(row => <div key={row.hq.id} className="cmp-note"><strong>{row.hq.vendor}</strong> {row.hq.text}</div>)}
          </details>}
        </>
      ) : <div className="dedupe-empty"><h3>{lastRun && lastRun.matcherVersion !== MATCHER_VERSION ? 'Matching has improved — compare again' : 'Load your website export, then compare'}</h3><p>{lastRun && lastRun.matcherVersion !== MATCHER_VERSION ? 'Your inputs are saved. Run a fresh comparison to get the new verdicts.' : 'Your saved source and website file stay here while you move between steps.'}</p></div>}
    </div>
  );
}

function RowGroup({ title, rows, bucket, onDecision, open = false }) {
  if (!rows.length) return null;
  return <details className="cmp-group" open={open}>
    <summary>{title} · {rows.length}</summary>
    {rows.map(row => <DealRow key={row.hq.id} r={row} bucket={bucket} onDecision={onDecision} />)}
  </details>;
}

const CHOICES = [['update', 'Update'], ['new', 'New'], ['on-site', 'On site']];

function endsLabel(hq) {
  return hq.ongoing ? 'Ongoing' : hq.end ? dateFmt.format(hq.end) : 'No end date';
}

function DealRow({ r, bucket, onDecision }) {
  const changes = r.web ? r.meta?.changes || [] : [];
  return <div className={`cmp-row ${r.decided ? 'is-overridden' : ''}`}>
    <div className="cmp-supplier">{r.hq.vendor}{r.hq.type === 'exclusive' && <span className="cmp-excl" title="Exclusive">EXCL</span>}</div>
    <div className="cmp-side">
      <span className="cmp-text">{r.hq.text}</span>
      <span className="cmp-date">{endsLabel(r.hq)}</span>
    </div>
    <div className="cmp-side cmp-web">
      {r.web ? <>
        <a className="cmp-text" href={`https://travelperks.com/admin/entries/deals?search=${encodeURIComponent(r.web.raw?.title || r.hq.vendor)}`} target="travelperks-admin" rel="noreferrer" title={r.web.raw?.shopListing || ''}>{r.web.raw?.title || r.web.text} ↗</a>
        <span className="cmp-date">{r.web.expiryDate ? dateFmt.format(r.web.expiryDate) : 'No expiry'}</span>
        {bucket === 'ask' && r.web.raw?.shopListing && <span className="cmp-desc">{r.web.raw.shopListing}</span>}
      </> : <span className="cmp-none">Nothing similar on site</span>}
    </div>
    <div className="cmp-choice" role="group" aria-label="Verdict">
      {CHOICES.map(([value, label]) => <button key={value} className={bucket === value ? 'is-on' : ''} disabled={value === 'update' && !r.web} onClick={() => onDecision(r, value)}>{label}</button>)}
    </div>
    {!!changes.length && <div className="cmp-changes">{changes.map((change, i) => <span key={i}>{change}</span>)}</div>}
  </div>;
}
