import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import {
  parseHQ, resetIds, ingestWebsiteJSON, runFullMatch, compareMarkers,
  categorizeDedupeResults, exportUnmatched, dateFmt,
  MATCHER_VERSION,
} from '../logic/dedupe.js';
import { compareWithJev, applyJevAnswers, applyDecisions } from '../logic/jev.js';
import { validateWebsiteExport } from '../logic/dealCoreClient';

function parseWebsiteRows(text) {
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : data.entries || data.data || [];
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// One Jev request through the server-side proxy; the key never reaches here.
async function callJev(body) {
  const response = await fetch('/api/jev', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Jev ${response.status}`);
  return (await response.json()).answers;
}

const CALL = {
  update: 'Same deal — update it',
  'on-site': 'Already live — nothing to do',
  new: 'New deal — not on the site',
};

/**
 * Compares the tagged batch with the website export using Jev (DEC-07) and
 * lands on one sentence and one button. Jev's calls can be reviewed one card
 * at a time, least sure first; the operator's call always wins. The whole
 * step accepts a dropped website export, and comparison starts by itself.
 */
export default function DedupeStep({ session, onSessionChange, onComplete, showToast }) {
  const fileRef = useRef(null);
  const [importError, setImportError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null);
  const [reviewAt, setReviewAt] = useState(-1);
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

  // Changing either input clears lastRun, so a run of this version is current.
  const current = !!lastRun && lastRun.matcherVersion === MATCHER_VERSION && lastRun.hqText === hqText;
  const canCompare = hqDeals.length > 0 && websiteRows.length > 0;

  const frozen = useMemo(() => {
    if (!current) return null;
    resetIds();
    return { hq: parseHQ(lastRun.hqText), web: ingestWebsiteJSON(lastRun.websiteRows) };
  }, [current, lastRun]);

  // Start a comparison as soon as both inputs exist; ask Jev once per run.
  useEffect(() => {
    if (!canCompare || current) return;
    updateSession({ lastRun: { matcherVersion: MATCHER_VERSION, hqText, websiteRows, jev: null }, decisions: {} });
    setReviewAt(-1);
  }, [canCompare, current, hqText, websiteRows, updateSession]);

  useEffect(() => {
    if (!frozen || lastRun.jev) return;
    let cancelled = false;
    setProgress({ done: 0, total: frozen.hq.length });
    compareWithJev(frozen.hq, frozen.web, callJev, {
      onProgress: (done, total) => { if (!cancelled) setProgress({ done, total }); },
    }).then(({ answers }) => {
      if (cancelled) return;
      setProgress(null);
      updateSession((prev) => (prev.lastRun === lastRun ? { ...prev, lastRun: { ...lastRun, jev: answers } } : prev));
    });
    return () => { cancelled = true; };
  }, [frozen, lastRun, updateSession]);

  const results = useMemo(() => {
    if (!frozen || !lastRun.jev) return null;
    const jevResults = applyJevAnswers(runFullMatch(frozen.hq, frozen.web), frozen.web, lastRun.jev);
    return applyDecisions(jevResults, decisions, frozen.web);
  }, [frozen, lastRun, decisions]);

  const categorized = useMemo(() => (results ? categorizeDedupeResults(results) : null), [results]);
  const jevDown = !!results && results.some(r => r.meta?.candidates?.length) && results.every(r => !r.meta?.candidates?.length || r.meta?.jevError);

  // Every call Jev made against a real website deal, least sure first.
  const reviewable = useMemo(() => {
    if (!categorized) return [];
    return [...categorized.update, ...categorized.onSite, ...categorized.added]
      .filter(r => r.meta?.candidates?.length)
      .sort((a, b) => (a.meta?.jevError ? -1 : a.meta?.confidence ?? 0) - (b.meta?.jevError ? -1 : b.meta?.confidence ?? 0) || a.hq.id - b.hq.id);
  }, [categorized]);
  // Freeze the order when review starts so cards don't jump as calls change.
  const [reviewOrder, setReviewOrder] = useState([]);
  const startReview = () => {
    const unreviewed = reviewable.filter(r => !decisions[r.hq.id]);
    setReviewOrder((unreviewed.length ? unreviewed : reviewable).map(r => r.hq.id));
    setReviewAt(0);
  };

  const decide = useCallback((row, verdict, webIndex) => {
    updateSession({ decisions: { ...decisions, [row.hq.id]: { verdict, web: verdict === 'new' ? null : webIndex } } });
    setReviewAt((at) => at + 1);
  }, [decisions, updateSession]);

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

  if (!categorized) {
    const pct = progress?.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return <div className="calm">
      <p className="calm-head">Jev is comparing your deals…</p>
      <div className="calm-bar"><span style={{ width: `${pct}%` }} /></div>
      <p className="calm-sub">{progress ? `${progress.done} of ${progress.total}` : ''}</p>
    </div>;
  }

  const byId = new Map<number, any>((results || []).map((r: any) => [r.hq.id, r]));
  const reviewRow = reviewAt >= 0 && reviewAt < reviewOrder.length ? byId.get(reviewOrder[reviewAt]) : null;
  if (reviewRow) {
    return <ReviewCard
      key={reviewRow.hq.id}
      r={reviewRow}
      websiteDeals={frozen.web}
      position={reviewAt + 1}
      total={reviewOrder.length}
      onDecide={decide}
      onBack={() => setReviewAt((at) => Math.max(0, at - 1))}
      onClose={() => setReviewAt(-1)}
    />;
  }

  const toPublish = [...categorized.update, ...categorized.added];
  const reviewed = reviewable.filter(r => decisions[r.hq.id]).length;
  const leftToReview = reviewable.length - reviewed;
  const sendToPublish = () => {
    if (!toPublish.length) return;
    // Updates keep the website entry's URL in Publish; new deals get a slug.
    onComplete(exportUnmatched(toPublish.map(row => row.hq)), [
      ...categorized.update.map(row => ({ vendor: row.hq.vendor, text: row.hq.text, action: 'update', websiteTitle: row.web?.raw?.title || '' })),
      ...categorized.added.map(row => ({ vendor: row.hq.vendor, text: row.hq.text, action: 'new', websiteTitle: '' })),
    ]);
  };

  return (
    <div className={`calm ${dragging ? 'is-dragging' : ''}`} {...dropProps}>
      <p className="calm-head">{toPublish.length ? `${plural(toPublish.length, 'deal')} ready for Publish.` : 'Everything is already on the site.'}</p>
      <p className="calm-sub">{[
        categorized.update.length && plural(categorized.update.length, 'update'),
        categorized.added.length && `${categorized.added.length} new`,
        categorized.onSite.length && `${categorized.onSite.length} already live`,
        categorized.excluded.length && `${categorized.excluded.length} ending today, left out`,
      ].filter(Boolean).join(' · ')}</p>
      {jevDown && <p className="calm-sub calm-error">Jev isn't connected, so these are the built-in rules' calls.</p>}
      <div className="calm-actions">
        {leftToReview > 0 && <button className="calm-go" onClick={startReview}>Review Jev's calls →</button>}
        {!!toPublish.length && <button className={leftToReview > 0 ? 'calm-second' : 'calm-go'} onClick={sendToPublish}>Continue to Publish →</button>}
      </div>
      <p className="calm-note">{leftToReview > 0
        ? `${plural(leftToReview, 'call')} to look over, least sure first.${reviewed ? ` ${reviewed} done.` : ''}`
        : reviewable.length ? <>All of Jev's calls reviewed. <button onClick={startReview}>look again</button></> : ''}</p>
      {importError && <p className="calm-sub calm-error">{importError}</p>}
      <p className="calm-foot">{session.websiteFileName || 'Website export'} · <button onClick={() => fileRef.current?.click()}>replace</button>{fileInput}</p>
    </div>
  );
}

function ends(date, ongoing = false) {
  return ongoing ? 'Ongoing' : date ? `Ends ${dateFmt.format(date)}` : 'No end date';
}

/**
 * One of Jev's calls: this week's deal beside the website deal Jev picked,
 * what differs, and Jev's verdict. → keeps Jev's call; U / L / N set update,
 * live or new; number keys compare against another website deal instead.
 */
function ReviewCard({ r, websiteDeals, position, total, onDecide, onBack, onClose }) {
  const candidates = r.meta?.candidates || [];
  const pickedIndex = r.web ? websiteDeals.indexOf(r.web) : -1;
  const [shown, setShown] = useState(pickedIndex >= 0 ? pickedIndex : -1);
  const web = shown >= 0 ? websiteDeals[shown] : null;
  const changes = web ? compareMarkers(r.hq, web).changes : [];
  const jevVerdict = r.web ? r.meta?.verdict : 'new';
  const sure = r.meta?.jevError ? null : Math.round((r.meta?.confidence ?? 0) * 100);

  useEffect(() => {
    const onKey = (event) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
      const key = event.key.toLowerCase();
      if (key === 'arrowright' || key === 'enter') onDecide(r, jevVerdict, pickedIndex);
      else if (key === 'arrowleft') onBack();
      else if (key === 'escape') onClose();
      else if (key === 'u' && web) onDecide(r, 'update', shown);
      else if (key === 'l' && web) onDecide(r, 'on-site', shown);
      else if (key === 'n') onDecide(r, 'new', null);
      else if (/^[1-9]$/.test(key) && candidates[+key - 1]) setShown(websiteDeals.indexOf(candidates[+key - 1]));
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [r, jevVerdict, pickedIndex, web, shown, candidates, websiteDeals, onDecide, onBack, onClose]);

  return <div className="review">
    <div className="review-top">
      <span>{position} of {total}</span>
      <button onClick={onClose}>done for now</button>
    </div>
    <p className="review-supplier">{r.hq.vendor}</p>
    <div className="review-pair">
      <div className="review-side">
        <span className="review-label">This week</span>
        <p className="review-text">{r.hq.text}</p>
        <span className="review-date">{ends(r.hq.end, r.hq.ongoing)}{r.hq.type === 'exclusive' ? ' · Exclusive' : ''}</span>
      </div>
      <div className="review-side is-site">
        <span className="review-label">{shown === pickedIndex && web ? 'On the website — Jev\'s pick' : 'On the website'}</span>
        {web ? <>
          <p className="review-text">{web.raw?.title}</p>
          {web.raw?.shopListing && <p className="review-desc">{web.raw.shopListing}</p>}
          <span className="review-date">{ends(web.expiryDate)}</span>
        </> : <p className="review-text review-none">Nothing on the site matches.</p>}
      </div>
    </div>
    {changes.length > 0 && <p className="review-diff">{changes.join(' · ')}</p>}
    <p className="review-call">Jev: <strong>{CALL[jevVerdict]}</strong>{sure !== null ? ` · ${sure}% sure` : ' · Jev unavailable, built-in rules'}</p>
    <div className="review-buttons">
      <button className="is-main" onClick={() => onDecide(r, jevVerdict, pickedIndex)}>Jev's right <kbd>→</kbd></button>
      <button disabled={!web} onClick={() => onDecide(r, 'update', shown)}>Update <kbd>U</kbd></button>
      <button disabled={!web} onClick={() => onDecide(r, 'on-site', shown)}>Already live <kbd>L</kbd></button>
      <button onClick={() => onDecide(r, 'new', null)}>New <kbd>N</kbd></button>
    </div>
    {candidates.length > 1 && <p className="review-others">
      {candidates.map((c, i) => {
        const index = websiteDeals.indexOf(c);
        return <button key={index} className={index === shown ? 'is-on' : ''} onClick={() => setShown(index)}><kbd>{i + 1}</kbd> {c.raw?.title}</button>;
      })}
    </p>}
  </div>;
}
