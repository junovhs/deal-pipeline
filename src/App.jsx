import React, { useState, useCallback, useRef } from 'react';
import DealtagStep from './components/DealtagStep';
import DedupeStep from './components/DedupeStep';
import CopywritingStep from './components/CopywritingStep';

const STEPS = [
  { key: 'tag', label: '1. Tag', desc: 'Classify raw deals' },
  { key: 'dedupe', label: '2. Dedupe', desc: 'Match against website' },
  { key: 'copy', label: '3. Copy', desc: 'Write & track' },
];

const LS_KEY = 'deal-pipeline-step';

function loadStep() {
  try { return localStorage.getItem(LS_KEY) || 'tag'; } catch { return 'tag'; }
}

export default function App() {
  const [step, setStepRaw] = useState(loadStep);
  const [taggedText, setTaggedText] = useState('');
  const [unmatchedText, setUnmatchedText] = useState('');
  const [notify, setNotify] = useState(null);
  const [showGlobalReset, setShowGlobalReset] = useState(false);
  const resetRefs = useRef({ tag: null, dedupe: null, copy: null });

  const setStep = useCallback((s) => {
    setStepRaw(s);
    try { localStorage.setItem(LS_KEY, s); } catch {}
  }, []);

  const showToast = useCallback((msg, type = 'info') => {
    setNotify({ msg, type });
    setTimeout(() => setNotify(null), 4000);
  }, []);

  // Flow data forward: Tag → Dedupe
  const handleTagComplete = useCallback((text) => {
    setTaggedText(text);
    setStep('dedupe');
    showToast('Tagged text loaded into Dedupe', 'success');
  }, [showToast, setStep]);

  // Flow data forward: Dedupe → Copy
  const handleDedupeComplete = useCallback((text) => {
    setUnmatchedText(text);
    setStep('copy');
    showToast('Unmatched deals loaded into Copywriting', 'success');
  }, [showToast, setStep]);

  const handleGlobalReset = useCallback(() => {
    // Clear all localStorage keys used by steps
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('dp-') || k === LS_KEY) localStorage.removeItem(k);
      });
    } catch {}
    setTaggedText('');
    setUnmatchedText('');
    setShowGlobalReset(false);
    setStep('tag');
    // Force remount all steps by toggling a key
    window.location.reload();
  }, [setStep]);

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">Deal Pipeline</h1>
        <nav className="step-nav">
          {STEPS.map(s => (
            <button
              key={s.key}
              className={`step-tab ${step === s.key ? 'active' : ''}`}
              onClick={() => setStep(s.key)}
            >
              <span className="step-label">{s.label}</span>
              <span className="step-desc">{s.desc}</span>
            </button>
          ))}
        </nav>
        <button className="btn btn-reset-global" onClick={() => setShowGlobalReset(true)}>
          Reset All
        </button>
      </header>

      {/* Global reset modal */}
      {showGlobalReset && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Reset Everything?</h3>
            <div className="modal-body">
              <p>This will clear ALL data across all three steps. You'll start completely fresh.</p>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowGlobalReset(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleGlobalReset}>Yes, Reset Everything</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {notify && (
        <div className={`toast toast-${notify.type}`}>
          {notify.msg}
          <button onClick={() => setNotify(null)}>×</button>
        </div>
      )}

      {/* ALL steps stay mounted — hidden via CSS so state persists on tab switch */}
      <main className="app-main">
        <div style={{ display: step === 'tag' ? 'block' : 'none' }}>
          <DealtagStep
            onComplete={handleTagComplete}
            showToast={showToast}
          />
        </div>
        <div style={{ display: step === 'dedupe' ? 'block' : 'none' }}>
          <DedupeStep
            initialText={taggedText}
            onComplete={handleDedupeComplete}
            showToast={showToast}
          />
        </div>
        <div style={{ display: step === 'copy' ? 'block' : 'none' }}>
          <CopywritingStep
            initialText={unmatchedText}
            showToast={showToast}
          />
        </div>
      </main>
    </div>
  );
}
