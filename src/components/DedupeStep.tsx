import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import {
  parseHQ, resetIds, ingestWebsiteJSON, runFullMatch,
  categorizeDedupeResults, exportUnmatched,
  MATCHER_VERSION,
} from '../logic/dedupe.js';
import { buildReviewQueue } from '../logic/review.js';
import { validateWebsiteExport } from '../logic/dealCoreClient';

function parseWebsiteRows(text) {
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : data.entries || data.data || [];
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Compares the tagged batch with the website export and decides every deal
 * itself: already live, an update to a live deal, or new. The operator sees
 * one sentence and one button; the list behind it is opt-in, and any verdict
 * can be quietly overridden there. The whole step is a drop target for the
 * website export, and comparison runs as soon as both inputs exist.
 */
export default function DedupeStep({ session, onSessionChange, onComplete, showToast }) {
  const fileRef = useRef(null);
  const [importError, setImportError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showLeftOut, setShowLeftOut] = useState(false);
  const [lastDecision, setLastDecision] = useState(null);
  const decisions = session.decisions || {};
  const { hqText, websiteRows, lastRun } = session;

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

  const results = useMemo(() => {
    if (!lastRun || lastRun.matcherVersion !== MATCHER_VERSION) return null;
    if (!lastRun.hqText.trim() || !lastRun.websiteRows.length) return null;
    resetIds();
    return runFullMatch(parseHQ(lastRun.hqText), ingestWebsiteJSON(lastRun.websiteRows));
  }, [lastRun]);

  const canCompare = hqDeals.length > 0 && websiteRows.length > 0;

  // Nothing to press: compare as soon as both inputs are present.
  useEffect(() => {
    if (!canCompare || results) return;
    updateSession({
      lastRun: { matcherVersion: MATCHER_VERSION, hqText, websiteRows, supplierFilter: '' },
      decisions: {},
    });
    setLastDecision(null);
  }, [canCompare, results, hqText, websiteRows, updateSession]);

  const categorized = useMemo(() => (results ? categorizeDedupeResults(results) : null), [results]);
  const queue = useMemo(() => buildReviewQueue(categorized, decisions), [categorized, decisions]);

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

  const loadExport = useCallback(async (file) => {
    if (!file) return;
    try {
      const rows = parseWebsiteRows(await file.text());
      const validation = await validateWebsiteExport(rows);
      if ('error' in validation) {
        setImportError(validation.error.message);
        return;
      }
      setImportError('');
      updateSession({ websiteRows: validation.data.rows, websiteFileName: file.name, lastRun: null, decisions: {} });
    } catch (error) {
      setImportError(`That file isn't a website export (${error instanceof Error ? error.message : String(error)}).`);
    }
  }, [updateSession]);

  const dropProps = {
    onDragOver: (event) => { event.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop: (event) => { event.preventDefault(); setDragging(false); loadExport(event.dataTransfer.files?.[0]); },
  };
  const fileInput = <input ref={fileRef} type="file" accept=".json" className="visually-hidden" onChange={(event) => { loadExport(event.target.files?.[0]); event.target.value = ''; }} />;

  const toPublish = [...queue.update, ...queue.added];
  const sendToPublish = () => {
    if (!toPublish.length) return;
    // Updates keep the website entry's URL in Publish; new deals get a slug.
    onComplete(exportUnmatched(toPublish.map(row => row.hq)), [
      ...queue.update.map(row => ({ vendor: row.hq.vendor, text: row.hq.text, action: 'update', websiteTitle: row.web?.raw?.title || '' })),
      ...queue.added.map(row => ({ vendor: row.hq.vendor, text: row.hq.text, action: 'new', websiteTitle: '' })),
    ]);
  };
  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(exportUnmatched(toPublish.map(row => row.hq)));
      showToast('Copied', 'success');
    } catch { showToast('Clipboard unavailable', 'error'); }
  };

  if (!hqDeals.length) {
    return <div className="calm"><p className="calm-head">Nothing to compare yet.</p><p className="calm-sub">Tag this week's deals first.</p></div>;
  }

  if (!websiteRows.length) {
    return <div className={`calm calm-drop ${dragging ? 'is-dragging' : ''}`} {...dropProps} onClick={() => fileRef.current?.click()} role="button" tabIndex={0}>
      <p className="calm-head">Drop this week's website export here.</p>
      <p className="calm-sub">{importError || 'Or click anywhere to choose it.'}</p>
      {fileInput}
    </div>;
  }

  if (!categorized) return <div className="calm"><p className="calm-sub">Comparing…</p></div>;

  const leftOut = queue.onSite.length + queue.excluded.length;
  return (
    <div className={`calm ${dragging ? 'is-dragging' : ''}`} {...dropProps}>
      <p className="calm-head">{toPublish.length ? `${plural(toPublish.length, 'deal')} ready for Publish.` : 'Everything is already on the site.'}</p>
      {!!toPublish.length && <p className="calm-sub">{[queue.update.length && plural(queue.update.length, 'update'), queue.added.length && `${queue.added.length} new`].filter(Boolean).join(' and ')}</p>}
      {!!toPublish.length && <button className="calm-go" onClick={sendToPublish}>Continue →</button>}
      {importError && <p className="calm-sub calm-error">{importError}</p>}

      <div className="calm-links">
        {!!toPublish.length && <button onClick={() => setShowList(!showList)}>{showList ? 'hide' : 'look them over'}</button>}
        {lastDecision && <button onClick={undo}>undo</button>}
      </div>

      {showList && <div className="calm-list">
        {queue.update.map(row => <DealLine key={row.hq.id} r={row} kind="update" onLeaveOut={() => decide(row, 'on-site')} />)}
        {queue.added.map(row => <DealLine key={row.hq.id} r={row} kind="new" onLeaveOut={() => decide(row, 'on-site')} />)}
        <p className="calm-aside">
          {leftOut ? <>Left out {[queue.onSite.length && `${queue.onSite.length} already live`, queue.excluded.length && `${queue.excluded.length} ending today`].filter(Boolean).join(', ')}. <button onClick={() => setShowLeftOut(!showLeftOut)}>{showLeftOut ? 'hide' : 'show'}</button></> : null}
          {leftOut ? ' · ' : ''}<button onClick={copyList}>copy as text</button>
        </p>
        {showLeftOut && <>
          {queue.onSite.map(row => <DealLine key={row.hq.id} r={row} kind="live" onPutBack={() => decide(row, row.web ? 'update' : 'new')} />)}
          {queue.excluded.map(row => <DealLine key={row.hq.id} r={row} kind="ends today" />)}
        </>}
      </div>}

      <p className="calm-foot">{session.websiteFileName || 'Website export'} · <button onClick={() => fileRef.current?.click()}>replace</button>{fileInput}</p>
    </div>
  );
}

function DealLine({ r, kind, onLeaveOut = null, onPutBack = null }) {
  const changes = r.web && kind === 'update' ? (r.meta?.changes || []) : [];
  const hint = [
    r.web && kind === 'update' ? `Updates “${r.web.raw?.title || ''}”` : '',
    ...changes,
    r.meta?.guess ? 'Best guess — another website deal is similar' : '',
  ].filter(Boolean).join('\n');
  return <div className={`calm-line ${onPutBack || kind === 'ends today' ? 'is-out' : ''}`} title={hint}>
    <span className="calm-who">{r.hq.vendor}</span>
    <span className="calm-what">{r.hq.text}</span>
    <span className="calm-kind">{kind}{r.meta?.guess && kind === 'update' ? '?' : ''}</span>
    {onLeaveOut && <button className="calm-x" onClick={onLeaveOut} aria-label="Leave out">×</button>}
    {onPutBack && <button className="calm-x" onClick={onPutBack} aria-label="Put back">+</button>}
  </div>;
}
