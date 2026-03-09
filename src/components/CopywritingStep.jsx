import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  parseRawToGroups,
  generatePrompt,
  generateSingleDealPrompt,
  validateAndMerge,
  cleanAndParsePatchJSON,
  applyDealPatch,
  appendDealToRawInput,
  DEFAULT_HOUSE_STYLE,
} from "../logic/copywriting";

let confettiLoaded = false;
let confettiFn = null;

function loadConfetti() {
  if (confettiLoaded) return Promise.resolve(confettiFn);
  return import("canvas-confetti")
    .then((mod) => {
      confettiFn = mod.default;
      confettiLoaded = true;
      return confettiFn;
    })
    .catch(() => null);
}

function fireConfetti() {
  if (confettiFn) {
    confettiFn({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#3b82f6", "#10b981", "#8b5cf6", "#f97316"],
      zIndex: 2000,
      disableForReducedMotion: true,
    });
  }
}

function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem("dp-copy-" + key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function lsSet(key, val) {
  try {
    localStorage.setItem("dp-copy-" + key, JSON.stringify(val));
  } catch {}
}

export default function CopywritingStep({ initialText, showToast }) {
  const [view, setView] = useState(() => lsGet("view", "input"));
  const [rawInput, setRawInput] = useState(
    () => lsGet("rawInput", "") || initialText || "",
  );
  const [jsonInput, setJsonInput] = useState(() => lsGet("jsonInput", ""));
  const [finalGroups, setFinalGroups] = useState(() =>
    lsGet("finalGroups", []),
  );
  const [copySuccess, setCopySuccess] = useState({});
  const [validationError, setValidationError] = useState(null);
  const [validationWarnings, setValidationWarnings] = useState(null);
  const [pendingData, setPendingData] = useState(null);
  const [showReset, setShowReset] = useState(false);

  const [houseStyle, setHouseStyle] = useState(() =>
    lsGet("houseStyle", DEFAULT_HOUSE_STYLE),
  );
  const [showStyleEditor, setShowStyleEditor] = useState(false);

  const [dealNotes, setDealNotes] = useState(() => lsGet("dealNotes", {}));
  const [expandedNotes, setExpandedNotes] = useState({});

  const [patchModal, setPatchModal] = useState(null);
  const [patchInput, setPatchInput] = useState("");

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddVendor, setQuickAddVendor] = useState("");
  const [quickAddDealText, setQuickAddDealText] = useState("");
  const [quickAddExclusive, setQuickAddExclusive] = useState(false);

  useEffect(() => {
    lsSet("view", view);
  }, [view]);
  useEffect(() => {
    lsSet("rawInput", rawInput);
  }, [rawInput]);
  useEffect(() => {
    lsSet("jsonInput", jsonInput);
  }, [jsonInput]);
  useEffect(() => {
    lsSet("finalGroups", finalGroups);
  }, [finalGroups]);
  useEffect(() => {
    lsSet("houseStyle", houseStyle);
  }, [houseStyle]);
  useEffect(() => {
    lsSet("dealNotes", dealNotes);
  }, [dealNotes]);

  useEffect(() => {
    if (initialText && initialText !== rawInput) setRawInput(initialText);
  }, [initialText]);

  useEffect(() => {
    loadConfetti();
  }, []);

  const handleGeneratePrompt = useCallback(() => {
    const groups = parseRawToGroups(rawInput);
    if (groups.length === 0) {
      showToast("No vendors found. Use 'v Name' format.", "error");
      return;
    }
    const prompt = generatePrompt(groups, houseStyle);
    navigator.clipboard.writeText(prompt).then(() => {
      showToast(`Prompt for ${groups.length} vendors copied`, "success");
    });
  }, [rawInput, houseStyle, showToast]);

  const handleValidate = useCallback(() => {
    try {
      const rawGroups = parseRawToGroups(rawInput);
      const result = validateAndMerge(rawGroups, jsonInput);

      if (result.error) {
        setValidationError(result.error);
        return;
      }

      if (result.warnings && result.warnings.length > 0) {
        setValidationWarnings(result.warnings);
        setPendingData(result.data);
        return;
      }

      setFinalGroups(result.data);
      setView("work");
      window.scrollTo(0, 0);
    } catch (e) {
      showToast("JSON Syntax Error: " + e.message, "error");
    }
  }, [rawInput, jsonInput, showToast]);

  const handleProceedPastGate = useCallback(() => {
    if (pendingData) {
      setFinalGroups(pendingData);
      setView("work");
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
      setCopySuccess((prev) => ({ ...prev, [key]: true }));
      if (isComplete) toggleCheck(vIdx, dIdx, true);
      setTimeout(() => {
        setCopySuccess((prev) => {
          const n = { ...prev };
          delete n[key];
          return n;
        });
      }, 1500);
    });
  }, []);

  const toggleCheck = useCallback((vIdx, dIdx, forceState = null) => {
    setFinalGroups((prev) =>
      prev.map((g, gi) => ({
        ...g,
        deals: g.deals.map((d, di) => {
          if (gi === vIdx && di === dIdx) {
            const next = forceState !== null ? forceState : !d.checked;
            if (next) fireConfetti();
            return { ...d, checked: next };
          }
          return d;
        }),
      })),
    );
  }, []);

  const reset = useCallback(() => {
    setRawInput("");
    setJsonInput("");
    setFinalGroups([]);
    setView("input");
    setShowReset(false);
    setValidationWarnings(null);
    setPendingData(null);
    setPatchModal(null);
    setPatchInput("");
  }, []);

  const handleSingleDealPrompt = useCallback(
    (group, deal, note = "") => {
      const prompt = generateSingleDealPrompt({
        vendorName: group.name,
        deal,
        note,
        currentHeadline: deal.headline,
        currentDescription: deal.description,
        houseStyle,
      });
      navigator.clipboard.writeText(prompt).then(() => {
        showToast(`Prompt copied for ${deal.dealId}`, "success");
      });
    },
    [houseStyle, showToast],
  );

  const handlePatchApply = useCallback(() => {
    if (!patchModal) return;
    try {
      const parsed = cleanAndParsePatchJSON(patchInput);
      const nextGroups = applyDealPatch(finalGroups, parsed, {
        dealId: patchModal.deal.dealId,
        vendorIndex: patchModal.group.vendorIndex,
        dealIndex: patchModal.deal.dealIndex,
      });
      setFinalGroups(nextGroups);
      setPatchModal(null);
      setPatchInput("");
      showToast("Deal updated", "success");
    } catch (e) {
      showToast(e.message, "error");
    }
  }, [patchInput, patchModal, finalGroups, showToast]);

  const handleQuickAdd = useCallback(() => {
    try {
      const nextRaw = appendDealToRawInput(rawInput, {
        vendorName: quickAddVendor,
        dealText: quickAddDealText,
        isExclusive: quickAddExclusive,
      });
      setRawInput(nextRaw);

      if (view === "work") {
        const groups = parseRawToGroups(nextRaw);
        const nextGroups = groups.map((rawGroup) => {
          const existingGroup = finalGroups.find(
            (g) => g.name === rawGroup.name,
          );
          if (!existingGroup) {
            return {
              vendorIndex: rawGroup.vendorIndex,
              name: rawGroup.name,
              deals: rawGroup.deals.map((d) => ({
                dealId: d.dealId,
                dealIndex: d.dealIndex,
                headline: "MISSING HEADLINE",
                description: "Needs copy. Call to speak with an agent!",
                startDate: null,
                endDate: null,
                dateNote: null,
                originalText: d.originalText,
                isExclusive: d.isExclusive,
                warnings: [
                  {
                    severity: "warn",
                    msg: "New deal added. Generate or paste copy for this row.",
                  },
                ],
                checked: false,
              })),
            };
          }

          const mergedDeals = rawGroup.deals.map((rawDeal) => {
            const existingDeal = existingGroup.deals.find(
              (d) => d.originalText === rawDeal.originalText,
            );
            return (
              existingDeal || {
                dealId: rawDeal.dealId,
                dealIndex: rawDeal.dealIndex,
                headline: "MISSING HEADLINE",
                description: "Needs copy. Call to speak with an agent!",
                startDate: null,
                endDate: null,
                dateNote: null,
                originalText: rawDeal.originalText,
                isExclusive: rawDeal.isExclusive,
                warnings: [
                  {
                    severity: "warn",
                    msg: "New deal added. Generate or paste copy for this row.",
                  },
                ],
                checked: false,
              }
            );
          });

          return {
            vendorIndex: rawGroup.vendorIndex,
            name: rawGroup.name,
            deals: mergedDeals,
          };
        });

        setFinalGroups(nextGroups);
      }

      setQuickAddVendor("");
      setQuickAddDealText("");
      setQuickAddExclusive(false);
      setShowQuickAdd(false);
      showToast("Deal added", "success");
    } catch (e) {
      showToast(e.message, "error");
    }
  }, [
    rawInput,
    quickAddVendor,
    quickAddDealText,
    quickAddExclusive,
    view,
    finalGroups,
    showToast,
  ]);

  const totalDeals = finalGroups.reduce((acc, g) => acc + g.deals.length, 0);
  const doneDeals = finalGroups.reduce(
    (acc, g) => acc + g.deals.filter((d) => d.checked).length,
    0,
  );

  const warningCounts = useMemo(() => {
    let errors = 0;
    let warns = 0;
    finalGroups.forEach((g) =>
      g.deals.forEach((d) => {
        (d.warnings || []).forEach((w) => {
          if (w.severity === "error") errors++;
          else warns++;
        });
      }),
    );
    return { errors, warns };
  }, [finalGroups]);

  if (view === "work") {
    return (
      <div className="copy-step">
        <div className="copy-toolbar">
          <div className="copy-toolbar-left">
            <button className="btn" onClick={() => setShowReset(true)}>
              ← Start Over
            </button>
            <button className="btn" onClick={() => setShowQuickAdd(true)}>
              + Quick Add Deal
            </button>
            <button className="btn" onClick={() => setShowStyleEditor(true)}>
              Edit House Style
            </button>
          </div>
          <div className="stat-pills">
            <span className="pill">Vendors: {finalGroups.length}</span>
            <span className="pill pill-accent">
              Deals: {doneDeals} / {totalDeals}
            </span>
            {warningCounts.errors > 0 && (
              <span className="pill pill-bad">
                {warningCounts.errors} errors
              </span>
            )}
            {warningCounts.warns > 0 && (
              <span className="pill pill-warn">
                {warningCounts.warns} warnings
              </span>
            )}
          </div>
        </div>

        {showReset && (
          <Modal
            title="Start Over?"
            onConfirm={reset}
            onCancel={() => setShowReset(false)}
            confirmText="Yes, Reset"
          >
            <p>All current progress will be lost.</p>
          </Modal>
        )}

        {showStyleEditor && (
          <Modal
            title="House Style"
            onConfirm={() => setShowStyleEditor(false)}
            onCancel={() => setShowStyleEditor(false)}
            confirmText="Done"
            wide
          >
            <textarea
              value={houseStyle}
              onChange={(e) => setHouseStyle(e.target.value)}
              className="modal-textarea"
              spellCheck={false}
            />
          </Modal>
        )}

        {showQuickAdd && (
          <Modal
            title="Quick Add Deal"
            onConfirm={handleQuickAdd}
            onCancel={() => setShowQuickAdd(false)}
            confirmText="Add Deal"
          >
            <div className="mini-form">
              <label className="mini-form-label">Vendor</label>
              <input
                className="mini-input"
                value={quickAddVendor}
                onChange={(e) => setQuickAddVendor(e.target.value)}
              />
              <label className="mini-form-label">Deal text</label>
              <textarea
                className="modal-textarea modal-textarea-short"
                value={quickAddDealText}
                onChange={(e) => setQuickAddDealText(e.target.value)}
                spellCheck={false}
              />
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={quickAddExclusive}
                  onChange={(e) => setQuickAddExclusive(e.target.checked)}
                />
                Mark as exclusive
              </label>
            </div>
          </Modal>
        )}

        {patchModal && (
          <Modal
            title={`Patch ${patchModal.deal.dealId}`}
            onConfirm={handlePatchApply}
            onCancel={() => {
              setPatchModal(null);
              setPatchInput("");
            }}
            confirmText="Apply Patch"
            wide
          >
            <div className="patch-context">
              <div className="patch-source">
                <strong>Source:</strong> {patchModal.deal.originalText}
              </div>
              <div className="patch-current">
                <strong>Current headline:</strong> {patchModal.deal.headline}
              </div>
              <div className="patch-current">
                <strong>Current description:</strong>{" "}
                {patchModal.deal.description}
              </div>
            </div>
            <textarea
              className="modal-textarea"
              value={patchInput}
              onChange={(e) => setPatchInput(e.target.value)}
              placeholder={`Paste a mini patch, for example:
{
  "headline": "EXCLUSIVE: Get $75 in Specialty Dining Credit",
  "description": "Enjoy $75 in Specialty Dining Credit with this exclusive offer.",
  "startDate": null,
  "endDate": "03/31/2026"
}`}
              spellCheck={false}
            />
          </Modal>
        )}

        {finalGroups.map((group, vIdx) => (
          <div key={group.vendorIndex || vIdx} className="vendor-block">
            <h2 className="vendor-block-title">{group.name}</h2>
            <div className="deal-list">
              {group.deals.map((deal, dIdx) => {
                const noteKey = deal.dealId || `${vIdx}-${dIdx}`;
                return (
                  <div
                    key={deal.dealId || dIdx}
                    className={`deal-row ${deal.checked ? "deal-checked" : ""}`}
                  >
                    <div
                      className="deal-check"
                      onClick={() => toggleCheck(vIdx, dIdx)}
                    >
                      <div
                        className={`circle-check ${deal.checked ? "circle-active" : ""}`}
                      >
                        {deal.checked && "✓"}
                      </div>
                    </div>

                    <div className="deal-content">
                      {deal.warnings && deal.warnings.length > 0 && (
                        <div className="deal-warnings">
                          {deal.warnings.map((w, wi) => (
                            <div
                              key={wi}
                              className={`deal-warning deal-warning-${w.severity}`}
                            >
                              {w.severity === "error" ? "🚨" : "⚠️"} {w.msg}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="deal-meta-row">
                        <span className="pill">{deal.dealId}</span>
                        {deal.isExclusive && (
                          <span className="pill pill-bad">EXCLUSIVE</span>
                        )}
                      </div>

                      <div className="deal-line">
                        <span
                          className={`copy-text deal-headline ${deal.isExclusive ? "deal-exclusive" : ""}`}
                          onClick={() =>
                            handleCopy(deal.headline, `h${vIdx}${dIdx}`)
                          }
                        >
                          {deal.headline}
                        </span>
                        {copySuccess[`h${vIdx}${dIdx}`] && (
                          <span className="copied-badge">Copied</span>
                        )}
                      </div>

                      <div className="deal-line">
                        <span
                          className="copy-text deal-desc"
                          onClick={() =>
                            handleCopy(
                              deal.description,
                              `d${vIdx}${dIdx}`,
                              true,
                              vIdx,
                              dIdx,
                            )
                          }
                        >
                          {deal.description}
                        </span>
                        {copySuccess[`d${vIdx}${dIdx}`] && (
                          <span className="copied-badge">Copied</span>
                        )}
                      </div>

                      <div className="original-context">
                        <span className="context-label">ORIGINAL:</span>{" "}
                        {deal.originalText}
                      </div>

                      <div className="dates-row">
                        {deal.startDate && (
                          <span
                            className="date-pill date-start"
                            onClick={() =>
                              handleCopy(deal.startDate, `sd${vIdx}${dIdx}`)
                            }
                          >
                            Starts: {deal.startDate}
                          </span>
                        )}
                        {deal.endDate && (
                          <span
                            className="date-pill date-end"
                            onClick={() =>
                              handleCopy(deal.endDate, `ed${vIdx}${dIdx}`)
                            }
                          >
                            Ends: {deal.endDate}
                          </span>
                        )}
                        {(copySuccess[`sd${vIdx}${dIdx}`] ||
                          copySuccess[`ed${vIdx}${dIdx}`]) && (
                          <span className="copied-badge">Copied</span>
                        )}
                      </div>

                      <div className="deal-actions">
                        <button
                          className="btn btn-small"
                          onClick={() =>
                            handleSingleDealPrompt(group, deal, "")
                          }
                        >
                          Copy Fix Prompt
                        </button>
                        <button
                          className="btn btn-small"
                          onClick={() =>
                            setExpandedNotes((prev) => ({
                              ...prev,
                              [noteKey]: !prev[noteKey],
                            }))
                          }
                        >
                          {expandedNotes[noteKey]
                            ? "Hide Notes"
                            : "Fix Prompt + Note"}
                        </button>
                        <button
                          className="btn btn-small"
                          onClick={() => {
                            setPatchModal({ group, deal });
                            setPatchInput("");
                          }}
                        >
                          Paste Patch JSON
                        </button>
                      </div>

                      {expandedNotes[noteKey] && (
                        <div className="deal-note-box">
                          <textarea
                            className="deal-note-input"
                            value={dealNotes[noteKey] || ""}
                            onChange={(e) =>
                              setDealNotes((prev) => ({
                                ...prev,
                                [noteKey]: e.target.value,
                              }))
                            }
                            placeholder="Example: make this more customer-facing, use a stronger CTA, don't say member offer"
                            spellCheck={false}
                          />
                          <div className="deal-note-actions">
                            <button
                              className="btn btn-small btn-accent"
                              onClick={() =>
                                handleSingleDealPrompt(
                                  group,
                                  deal,
                                  dealNotes[noteKey] || "",
                                )
                              }
                            >
                              Copy Prompt with Note
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="copy-step">
      {validationError && (
        <Modal
          title={validationError.title}
          onConfirm={() => setValidationError(null)}
          confirmText="OK, I'll Fix It"
        >
          <p>{validationError.msg}</p>
          {validationError.details && (
            <ul className="error-list">
              {validationError.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {validationWarnings && (
        <div className="modal-overlay">
          <div className="modal modal-wide">
            <h3>⚠ Review Before Proceeding</h3>
            <div className="modal-body">
              <p className="gate-intro">
                The AI output has {validationWarnings.length} item
                {validationWarnings.length > 1 ? "s" : ""} that need your
                attention. Review each one, then decide whether to proceed or go
                back and fix the JSON.
              </p>

              <div className="gate-warnings">
                {validationWarnings.map((item, i) => (
                  <div key={i} className="gate-item">
                    <div className="gate-item-header">
                      <strong>{item.vendorName}</strong> — Deal {item.dealIdx}
                    </div>
                    {item.headline && (
                      <div className="gate-headline">
                        Headline: {item.headline}
                      </div>
                    )}
                    {item.description && (
                      <div className="gate-desc">
                        Description: {item.description}
                      </div>
                    )}
                    <div className="gate-source">Source: {item.dealText}</div>
                    {item.warnings.map((w, wi) => (
                      <div
                        key={wi}
                        className={`gate-warning gate-warning-${w.severity}`}
                      >
                        {w.severity === "error" ? "🚨" : "⚠️"} {w.msg}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={handleCancelGate}>
                ← Go Back & Fix JSON
              </button>
              <button
                className="btn btn-accent"
                onClick={handleProceedPastGate}
              >
                I've Reviewed — Proceed Anyway →
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="copy-toolbar">
        <div className="copy-toolbar-left">
          <button className="btn" onClick={() => setShowQuickAdd(true)}>
            + Quick Add Deal
          </button>
          <button className="btn" onClick={() => setShowStyleEditor(true)}>
            Edit House Style
          </button>
        </div>
      </div>

      {showStyleEditor && (
        <Modal
          title="House Style"
          onConfirm={() => setShowStyleEditor(false)}
          onCancel={() => setShowStyleEditor(false)}
          confirmText="Done"
          wide
        >
          <textarea
            value={houseStyle}
            onChange={(e) => setHouseStyle(e.target.value)}
            className="modal-textarea"
            spellCheck={false}
          />
        </Modal>
      )}

      {showQuickAdd && (
        <Modal
          title="Quick Add Deal"
          onConfirm={handleQuickAdd}
          onCancel={() => setShowQuickAdd(false)}
          confirmText="Add Deal"
        >
          <div className="mini-form">
            <label className="mini-form-label">Vendor</label>
            <input
              className="mini-input"
              value={quickAddVendor}
              onChange={(e) => setQuickAddVendor(e.target.value)}
            />
            <label className="mini-form-label">Deal text</label>
            <textarea
              className="modal-textarea modal-textarea-short"
              value={quickAddDealText}
              onChange={(e) => setQuickAddDealText(e.target.value)}
              spellCheck={false}
            />
            <label className="toggle">
              <input
                type="checkbox"
                checked={quickAddExclusive}
                onChange={(e) => setQuickAddExclusive(e.target.checked)}
              />
              Mark as exclusive
            </label>
          </div>
        </Modal>
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
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="v Vendor Name&#10;d Deal text..."
              spellCheck={false}
            />
          </div>
          <div className="panel-footer">
            <button
              className="btn btn-accent full-width"
              onClick={handleGeneratePrompt}
            >
              Copy Batch Prompt
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
              onChange={(e) => setJsonInput(e.target.value)}
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

function Modal({
  title,
  children,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  wide = false,
}) {
  return (
    <div className="modal-overlay">
      <div className={`modal ${wide ? "modal-wide" : ""}`}>
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          {onCancel && (
            <button className="btn" onClick={onCancel}>
              Cancel
            </button>
          )}
          {onConfirm && (
            <button className="btn btn-accent" onClick={onConfirm}>
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
