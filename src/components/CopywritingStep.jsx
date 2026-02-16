import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { parseRawToGroups, generatePrompt, validateAndMerge } from '../logic/copywriting';

let confettiLoaded = false;
let confettiFn = null;

function loadConfetti() {
  if (confettiLoaded) return Promise.resolve(confettiFn);
  return import('canvas-confetti').then(mod => {
    confettiFn = mod.default;
    confettiLoaded = true;
    return confettiFn;
  }).catch(() => null);
}

function fireConfetti() {
  if (confettiFn) {
    confettiFn({
      particleCount: 100, spread: 70, origin: { y: 0.6 },
      colors: ['#3b82f6', '#10b981', '#8b5cf6', '#f97316'],
      zIndex: 2000, disableForReducedMotion: true
    });
  }
}

// localStorage helpers
function lsGet(key, fallback) {
  try { const v = localStorage.getItem('dp-copy-' + key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem('dp-copy-' + key, JSON.stringify(val)); } catch {}
}

export default function CopywritingStep({ initialText, showToast }) {
  const [view, setView] = useState(() => lsGet('view', 'input'));
  const [rawInput, setRawInput] = useState(() => lsGet('rawInput', '') || initialText || '');
  const [jsonInput, setJsonInput] = useState(() => lsGet('jsonInput', ''));
  const [finalGroups, setFinalGroups] = useState(() => lsGet('finalGroups', []));
  const [copySuccess, setCopySuccess] = useState({});
  const [validationError, setValidationError] = useState(null);
  const [validationWarnings, setValidationWarnings] = useState(null); // gate state
  const [pendingData, setPendingData] = useState(null); // data waiting behind gate
  const [showReset, setShowReset] = useState(false);

  // Persist key state
  useEffect(() => { lsSet('view', view); }, [view]);
  useEffect(() => { lsSet('rawInput', rawInput); }, [rawInput]);
  useEffect(() => { lsSet('jsonInput', jsonInput); }, [jsonInput]);
  useEffect(() => { lsSet('finalGroups', finalGroups); }, [finalGroups]);

  // Sync initialText from Dedupe
  useEffect(() => {
    if (initialText && initialText !== rawInput) setRawInput(initialText);
  }, [initialText]);

  useEffect(() => { loadConfetti(); }, []);

  const handleGeneratePrompt = useCallback(() => {
    const groups = parseRawToGroups(rawInput);
    if (groups.length === 0) { showToast("No vendors found. Use 'v Name' format.", 'error'); return; }
    const prompt = generatePrompt(groups);
    navigator.clipboard.writeText(prompt).then(() => {
      showToast(`Prompt for ${groups.length} Vendors copied!`, 'success');
    });
  }, [rawInput, showToast]);

  // Step 1: Validate JSON and check for warnings
  const handleValidate = useCallback(() => {
    try {
      const rawGroups = parseRawToGroups(rawInput);
      const result = validateAndMerge(rawGroups, jsonInput);

      if (result.error) {
        setValidationError(result.error);
        return;
      }

      // Check for warnings — if any, show the gate
      if (result.warnings && result.warnings.length > 0) {
        setValidationWarnings(result.warnings);
        setPendingData(result.data);
        return;
      }

      // No warnings: proceed directly
      setFinalGroups(result.data);
      setView('work');
      window.scrollTo(0, 0);
    } catch (e) {
      showToast('JSON Syntax Error: ' + e.message, 'error');
    }
  }, [rawInput, jsonInput, showToast]);

  // Step 2: User reviewed warnings and chooses to proceed
  const handleProceedPastGate = useCallback(() => {
    if (pendingData) {
      setFinalGroups(pendingData);
      setView('work');
      setValidationWarnings(null);
      setPendingData(null);
      window.scrollTo(0, 0);
    }
  }, [pendingData]);

  const handleCancelGate = useCallback(() => {
    setValidationWarnings(null);
    setPendingData(null);
  }, []);

  const handleCopy = useCallback((text, key, isComplete, vIdx, dIdx) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(prev => ({ ...prev, [key]: true }));
      if (isComplete) toggleCheck(vIdx, dIdx, true);
      setTimeout(() => setCopySuccess(prev => { const n = { ...prev }; delete n[key]; return n; }), 1500);
    });
  }, []);

  const toggleCheck = useCallback((vIdx, dIdx, forceState = null) => {
    setFinalGroups(prev => {
      const newGroups = prev.map((g, gi) => ({
        ...g,
        deals: g.deals.map((d, di) => {
          if (gi === vIdx && di === dIdx) {
            const next = forceState !== null ? forceState : !d.checked;
            if (next) fireConfetti();
            return { ...d, checked: next };
          }
          return d;
        })
      }));
      return newGroups;
    });
  }, []);

  const reset = useCallback(() => {
    setRawInput('');
    setJsonInput('');
    setFinalGroups([]);
    setView('input');
    setShowReset(false);
    setValidationWarnings(null);
    setPendingData(null);
  }, []);

  const totalDeals = finalGroups.reduce((acc, g) => acc + g.deals.length, 0);
  const doneDeals = finalGroups.reduce((acc, g) => acc + g.deals.filter(d => d.checked).length, 0);

  // Count warnings by severity across all deals
  const warningCounts = useMemo(() => {
    let errors = 0, warns = 0;
    finalGroups.forEach(g => g.deals.forEach(d => {
      (d.warnings || []).forEach(w => {
        if (w.severity === 'error') errors++;
        else warns++;
      });
    }));
    return { errors, warns };
  }, [finalGroups]);

  // ===== WORK VIEW =====
  if (view === 'work') {
    return (
      <div className="copy-step">
        <div className="copy-toolbar">
          <button className="btn" onClick={() => setShowReset(true)}>← Start Over</button>
          <div className="stat-pills">
            <span className="pill">Vendors: {finalGroups.length}</span>
            <span className="pill pill-accent">Deals: {doneDeals} / {totalDeals}</span>
            {warningCounts.errors > 0 && <span className="pill pill-bad">{warningCounts.errors} errors</span>}
            {warningCounts.warns > 0 && <span className="pill pill-warn">{warningCounts.warns} warnings</span>}
          </div>
        </div>

        {showReset && (
          <Modal title="Start Over?" onConfirm={reset} onCancel={() => setShowReset(false)} confirmText="Yes, Reset">
            <p>All current progress will be lost.</p>
          </Modal>
        )}

        {finalGroups.map((group, vIdx) => (
          <div key={vIdx} className="vendor-block">
            <h2 className="vendor-block-title">{group.name}</h2>
            <div className="deal-list">
              {group.deals.map((deal, dIdx) => (
                <div key={dIdx} className={`deal-row ${deal.checked ? 'deal-checked' : ''}`}>
                  <div className="deal-check" onClick={() => toggleCheck(vIdx, dIdx)}>
                    <div className={`circle-check ${deal.checked ? 'circle-active' : ''}`}>
                      {deal.checked && '✓'}
                    </div>
                  </div>
                  <div className="deal-content">
                    {/* Inline warnings for this deal */}
                    {deal.warnings && deal.warnings.length > 0 && (
                      <div className="deal-warnings">
                        {deal.warnings.map((w, wi) => (
                          <div key={wi} className={`deal-warning deal-warning-${w.severity}`}>
                            {w.severity === 'error' ? '🚨' : '⚠️'} {w.msg}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="deal-line">
                      <span
                        className={`copy-text deal-headline ${deal.isExclusive ? 'deal-exclusive' : ''}`}
                        onClick={() => handleCopy(deal.headline, `h${vIdx}${dIdx}`)}
                      >{deal.headline}</span>
                      {copySuccess[`h${vIdx}${dIdx}`] && <span className="copied-badge">Copied</span>}
                    </div>
                    <div className="deal-line">
                      <span
                        className="copy-text deal-desc"
                        onClick={() => handleCopy(deal.description, `d${vIdx}${dIdx}`, true, vIdx, dIdx)}
                      >{deal.description}</span>
                      {copySuccess[`d${vIdx}${dIdx}`] && <span className="copied-badge">Copied</span>}
                    </div>
                    <div className="original-context">
                      <span className="context-label">ORIGINAL:</span> {deal.originalText}
                    </div>
                    <div className="dates-row">
                      {deal.startDate && (
                        <span className="date-pill date-start" onClick={() => handleCopy(deal.startDate, `sd${vIdx}${dIdx}`)}>
                          Starts: {deal.startDate}
                        </span>
                      )}
                      {deal.endDate && (
                        <span className="date-pill date-end" onClick={() => handleCopy(deal.endDate, `ed${vIdx}${dIdx}`)}>
                          Ends: {deal.endDate}
                        </span>
                      )}
                      {(copySuccess[`sd${vIdx}${dIdx}`] || copySuccess[`ed${vIdx}${dIdx}`]) && <span className="copied-badge">Copied</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ===== INPUT VIEW =====
  return (
    <div className="copy-step">
      {/* Structural error modal (vendor/deal count mismatch) */}
      {validationError && (
        <Modal
          title={validationError.title}
          onConfirm={() => setValidationError(null)}
          confirmText="OK, I'll Fix It"
        >
          <p>{validationError.msg}</p>
          {validationError.details && (
            <ul className="error-list">
              {validationError.details.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          )}
        </Modal>
      )}

      {/* VALIDATION GATE: warnings modal before proceeding */}
      {validationWarnings && (
        <div className="modal-overlay">
          <div className="modal modal-wide">
            <h3>⚠ Review Before Proceeding</h3>
            <div className="modal-body">
              <p className="gate-intro">The AI output has {validationWarnings.length} item{validationWarnings.length > 1 ? 's' : ''} that need your attention. Review each one, then decide whether to proceed or go back and fix the JSON.</p>

              <div className="gate-warnings">
                {validationWarnings.map((item, i) => (
                  <div key={i} className="gate-item">
                    <div className="gate-item-header">
                      <strong>{item.vendorName}</strong> — Deal {item.dealIdx}
                    </div>
                    {item.headline && <div className="gate-headline">Headline: {item.headline}</div>}
                    {item.description && <div className="gate-desc">Description: {item.description}</div>}
                    <div className="gate-source">Source: {item.dealText}</div>
                    {item.warnings.map((w, wi) => (
                      <div key={wi} className={`gate-warning gate-warning-${w.severity}`}>
                        {w.severity === 'error' ? '🚨' : '⚠️'} {w.msg}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={handleCancelGate}>← Go Back & Fix JSON</button>
              <button className="btn btn-accent" onClick={handleProceedPastGate}>
                I've Reviewed — Proceed Anyway →
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="two-col">
        <div className="panel">
          <div className="panel-header">
            <div className="badge-circle">1</div>
            <h2>Raw Text</h2>
          </div>
          <div className="panel-body">
            <textarea
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
              placeholder="v Vendor Name&#10;d Deal text..."
              spellCheck={false}
            />
          </div>
          <div className="panel-footer">
            <button className="btn btn-accent full-width" onClick={handleGeneratePrompt}>
              Copy Prompt
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="badge-circle">2</div>
            <h2>AI Response</h2>
          </div>
          <div className="panel-body">
            <textarea
              value={jsonInput}
              onChange={e => setJsonInput(e.target.value)}
              placeholder="Paste JSON here..."
              spellCheck={false}
            />
          </div>
          <div className="panel-footer">
            <button
              className="btn btn-success full-width"
              onClick={handleValidate}
              disabled={!jsonInput}
            >
              Verify & Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Simple modal ---
function Modal({ title, children, onConfirm, onCancel, confirmText = "Confirm" }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          {onCancel && <button className="btn" onClick={onCancel}>Cancel</button>}
          {onConfirm && <button className="btn btn-accent" onClick={onConfirm}>{confirmText}</button>}
        </div>
      </div>
    </div>
  );
}
