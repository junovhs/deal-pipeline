import React, { useCallback, useEffect, useRef, useState } from 'react';
import DealtagStep from './components/DealtagStep.jsx';
import DedupeStep from './components/DedupeStep.jsx';
import CopywritingStep from './components/CopywritingStep.jsx';
import { DEFAULT_HOUSE_STYLE } from './logic/copywriting.js';

const STEPS = [
  { key: 'tag', label: '1. Tag', desc: 'Classify raw deals' },
  { key: 'dedupe', label: '2. Dedupe', desc: 'Match against website' },
  { key: 'copy', label: '3. Copy', desc: 'Write & track' },
];

const STORAGE_KEY = 'deal-pipeline-session';

function createDefaultSession() {
  return {
    activeStep: 'tag',
    tag: {
      input: '',
      output: '',
      stats: null,
      includeX: true,
    },
    dedupe: {
      hqText: '',
      websiteRows: [],
      lastRun: null,
      threshold: 8,
      supplierFilter: '',
      viewFilter: 'all',
      restrictToday: false,
      rejectedHQIds: [],
    },
    copy: {
      view: 'input',
      rawInput: '',
      jsonInput: '',
      finalGroups: [],
      houseStyle: DEFAULT_HOUSE_STYLE,
      dealNotes: {},
    },
  };
}

function loadSession() {
  const fallback = createDefaultSession();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
      tag: { ...fallback.tag, ...(parsed.tag || {}) },
      dedupe: { ...fallback.dedupe, ...(parsed.dedupe || {}) },
      copy: { ...fallback.copy, ...(parsed.copy || {}) },
    };
  } catch {
    return fallback;
  }
}

export default function App() {
  const [session, setSession] = useState(loadSession);
  const [notify, setNotify] = useState(null);
  const [showGlobalReset, setShowGlobalReset] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {}
  }, [session]);

  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    },
    [],
  );

  const setStep = useCallback((step) => {
    setSession((prev) => ({ ...prev, activeStep: step }));
  }, []);

  const updateStepState = useCallback((stepKey, updater) => {
    setSession((prev) => {
      const current = prev[stepKey];
      const next =
        typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      return { ...prev, [stepKey]: next };
    });
  }, []);

  const showToast = useCallback((msg, type = 'info') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setNotify({ msg, type });
    toastTimerRef.current = setTimeout(() => {
      setNotify(null);
      toastTimerRef.current = null;
    }, 4000);
  }, []);

  const handleTagComplete = useCallback((text) => {
    setSession((prev) => ({
      ...prev,
      activeStep: 'dedupe',
      dedupe: {
        ...prev.dedupe,
        hqText: text,
        lastRun: null,
        rejectedHQIds: [],
      },
      copy: {
        ...createDefaultSession().copy,
        houseStyle: prev.copy.houseStyle,
      },
    }));
    showToast('Tagged text loaded into Dedupe', 'success');
  }, [showToast]);

  const handleDedupeComplete = useCallback((text) => {
    setSession((prev) => ({
      ...prev,
      activeStep: 'copy',
      copy: {
        ...createDefaultSession().copy,
        rawInput: text,
        houseStyle: prev.copy.houseStyle,
      },
    }));
    showToast('Unmatched deals loaded into Copywriting', 'success');
  }, [showToast]);

  const handleGlobalReset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setSession(createDefaultSession());
    setNotify(null);
    setShowGlobalReset(false);
    setResetVersion((version) => version + 1);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Deal Pipeline</h1>
        <nav className="step-nav">
          {STEPS.map((step) => (
            <button
              key={step.key}
              className={`step-tab ${session.activeStep === step.key ? 'active' : ''}`}
              onClick={() => setStep(step.key)}
            >
              <span className="step-label">{step.label}</span>
              <span className="step-desc">{step.desc}</span>
            </button>
          ))}
        </nav>
        <button className="btn btn-reset-global" onClick={() => setShowGlobalReset(true)}>
          Reset All
        </button>
      </header>

      {showGlobalReset && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Reset Everything?</h3>
            <div className="modal-body">
              <p>This will clear ALL data across all three steps. You&apos;ll start completely fresh.</p>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowGlobalReset(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleGlobalReset}>Yes, Reset Everything</button>
            </div>
          </div>
        </div>
      )}

      {notify && (
        <div className={`toast toast-${notify.type}`}>
          {notify.msg}
          <button onClick={() => setNotify(null)}>x</button>
        </div>
      )}

      <main className="app-main">
        <div style={{ display: session.activeStep === 'tag' ? 'block' : 'none' }}>
          <DealtagStep
            key={`tag-${resetVersion}`}
            session={session.tag}
            onSessionChange={(updater) => updateStepState('tag', updater)}
            onComplete={handleTagComplete}
            showToast={showToast}
          />
        </div>
        <div style={{ display: session.activeStep === 'dedupe' ? 'block' : 'none' }}>
          <DedupeStep
            key={`dedupe-${resetVersion}`}
            session={session.dedupe}
            onSessionChange={(updater) => updateStepState('dedupe', updater)}
            onComplete={handleDedupeComplete}
            showToast={showToast}
          />
        </div>
        <div style={{ display: session.activeStep === 'copy' ? 'block' : 'none' }}>
          <CopywritingStep
            key={`copy-${resetVersion}`}
            session={session.copy}
            onSessionChange={(updater) => updateStepState('copy', updater)}
            showToast={showToast}
          />
        </div>
      </main>
    </div>
  );
}
