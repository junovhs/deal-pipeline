import React, { useCallback, useEffect, useRef, useState } from 'react';
import DealtagStep from './components/DealtagStep';
import DedupeStep from './components/DedupeStep';
import CopywritingStep from './components/CopywritingStep';
import { DEFAULT_HOUSE_STYLE } from './logic/copywriting.js';
import { parseRawEmail } from './logic/dealCoreClient';

const STEPS = [
  { key: 'tag', label: 'Tag' },
  { key: 'dedupe', label: 'Compare' },
  { key: 'copy', label: 'Publish' },
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
      threshold: 0,
      supplierFilter: '',
      viewFilter: 'review',
      rejectedHQIds: [],
      decisions: {},
    },
    copy: {
      view: 'input',
      rawInput: '',
      jsonInput: '',
      finalGroups: [],
      houseStyle: DEFAULT_HOUSE_STYLE,
      dealNotes: {},
      sourceActions: [],
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

/**
 * Owns the three-step workflow shell and the durable browser session shared by
 * Tag, Dedupe, and Copy. Step handoffs deliberately reset downstream derived
 * state, while the global reset clears persisted work and remounts every step.
 */
const THEME_KEY = 'deal-pipeline-theme';

// The saved choice wins; otherwise follow the system. index.astro applies the
// same rule before first paint so there is no flash.
function initialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [session, setSession] = useState(loadSession);
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, next); } catch {}
      return next;
    });
  }, []);
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

  useEffect(() => {
    let cancelled = false;

    parseRawEmail('Carnival\nDeal line').then((result) => {
      if (!cancelled && !result.ok) {
        console.warn('deal-core smoke parse failed', result);
      }
    }).catch((error) => {
      if (!cancelled) {
        console.warn('deal-core smoke parse failed', error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const updateDedupeState = useCallback((updater) => {
    setSession((prev) => {
      const current = prev.dedupe;
      const next = typeof updater === 'function'
        ? updater(current)
        : { ...current, ...updater };
      const outputChanged = current.hqText !== next.hqText
        || current.lastRun !== next.lastRun
        || current.threshold !== next.threshold
        || current.rejectedHQIds !== next.rejectedHQIds
        || current.decisions !== next.decisions;

      return {
        ...prev,
        dedupe: next,
        copy: outputChanged
          ? { ...createDefaultSession().copy, houseStyle: prev.copy.houseStyle }
          : prev.copy,
      };
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
      decisions: {},
      },
      copy: {
        ...createDefaultSession().copy,
        houseStyle: prev.copy.houseStyle,
      },
    }));
    showToast('Tagged text loaded into Dedupe', 'success');
  }, [showToast]);

  const handleDedupeComplete = useCallback((text, sourceActions = []) => {
    setSession((prev) => ({
      ...prev,
      activeStep: 'copy',
      copy: {
        ...createDefaultSession().copy,
        rawInput: text,
        sourceActions,
        houseStyle: prev.copy.houseStyle,
      },
    }));
    showToast('New and changed deals loaded into Copywriting', 'success');
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

  const stepStates = {
    tag: session.tag.output?.trim() ? 'complete' : 'current',
    dedupe: session.dedupe.lastRun ? 'complete' : session.dedupe.hqText?.trim() ? 'ready' : 'waiting',
    copy: session.copy.finalGroups?.length && session.copy.finalGroups.every(group => group.deals.every(deal => deal.checked)) ? 'complete' : session.copy.rawInput?.trim() ? 'ready' : 'waiting',
  };

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="app-header">
        <span className="app-title">Deal Pipeline</span>
        <nav className="steps" aria-label="Weekly workflow">
          <ol>
            {STEPS.map((step, index) => {
              const state = stepStates[step.key];
              const current = session.activeStep === step.key;
              return (
                <li key={step.key}>
                  <button
                    className={`step ${current ? 'is-current' : ''} ${state === 'complete' ? 'is-done' : ''}`}
                    onClick={() => setStep(step.key)}
                    aria-current={current ? 'step' : undefined}
                  >
                    <span className="step-num" aria-hidden="true">{state === 'complete' ? '✓' : index + 1}</span>
                    {step.label}
                    {state === 'complete' && <span className="visually-hidden"> (done)</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="header-actions">
          <button className="link" onClick={() => setShowGlobalReset(true)}>Start over</button>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          </button>
        </div>
      </header>

      {showGlobalReset && (
        <div className="dialog-backdrop">
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="reset-title">
            <h2 id="reset-title">Start over?</h2>
            <p>This clears all three steps. You'll start fresh.</p>
            <div className="dialog-actions">
              <button className="btn" onClick={() => setShowGlobalReset(false)} autoFocus>Cancel</button>
              <button className="btn btn-danger" onClick={handleGlobalReset}>Clear everything</button>
            </div>
          </div>
        </div>
      )}

      <div className="toast-region" role="status" aria-live="polite">
        {notify && (
          <div className={`toast toast-${notify.type}`}>
            {notify.msg}
            <button className="toast-close" onClick={() => setNotify(null)} aria-label="Dismiss">×</button>
          </div>
        )}
      </div>

      <main className="app-main" id="main">
        <div className="step-stage" hidden={session.activeStep !== 'tag'}>
          <DealtagStep
            key={`tag-${resetVersion}`}
            session={session.tag}
            onSessionChange={(updater) => updateStepState('tag', updater)}
            onComplete={handleTagComplete}
            showToast={showToast}
          />
        </div>
        <div className="step-stage" hidden={session.activeStep !== 'dedupe'}>
          <DedupeStep
            key={`dedupe-${resetVersion}`}
            session={session.dedupe}
            onSessionChange={updateDedupeState}
            onComplete={handleDedupeComplete}
            showToast={showToast}
          />
        </div>
        <div className="step-stage" hidden={session.activeStep !== 'copy'}>
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
