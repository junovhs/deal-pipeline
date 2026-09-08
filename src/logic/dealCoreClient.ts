import initDealCore, {
  parseRawEmail as parseRawEmailWasm,
  validateWebsiteExport as validateWebsiteExportWasm,
} from '../wasm/deal-core/deal_core.js';

/** JSON-compatible success/failure envelope shared across the WASM boundary. */
export type CoreResult<T> =
  | {
      ok: true;
      data: T;
      diagnostics: Array<{
        kind: string;
        severity: string;
        message: string;
        lineNumber?: number;
        rawText?: string;
      }>;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
      diagnostics: Array<{
        kind: string;
        severity: string;
        message: string;
        lineNumber?: number;
        rawText?: string;
      }>;
    };

/** Initializes the generated WASM module before any typed core operation. */
export async function loadDealCore(): Promise<void> {
  await initDealCore();
}

/**
 * Initializes the WASM core and parses raw email text into lossless records with
 * source-line provenance and typed supplier resolution. Parser uncertainty is
 * returned as diagnostics or explicit supplier states, never hidden by a
 * JavaScript-side fallback interpretation.
 */
export async function parseRawEmail(
  rawText: string,
  _options: Record<string, unknown> = {},
): Promise<CoreResult<{
  sourceLineCount: number;
  records: Array<{
    id: string;
    lineNumber: number;
    rawText: string;
    normalizedText: string;
    tag: string;
    section?: string;
    supplier:
      | { status: 'known'; canonical: string }
      | { status: 'ambiguous'; candidates: string[]; preferred?: string }
      | { status: 'recognizedButIneligible'; canonical: string }
      | { status: 'unresolved'; raw?: string }
      | { status: 'unknown' };
    provenance: {
      source: string;
      lineNumber: number;
    };
  }>;
}>> {
  await loadDealCore();
  return parseRawEmailWasm(rawText) as CoreResult<{
    sourceLineCount: number;
    records: Array<{
      id: string;
      lineNumber: number;
      rawText: string;
      normalizedText: string;
      tag: string;
      section?: string;
      supplier:
        | { status: 'known'; canonical: string }
        | { status: 'ambiguous'; candidates: string[]; preferred?: string }
        | { status: 'recognizedButIneligible'; canonical: string }
        | { status: 'unresolved'; raw?: string }
        | { status: 'unknown' };
      provenance: {
        source: string;
        lineNumber: number;
      };
    }>;
  }>;
}

/** Accepted website rows plus accounting for inspected and discarded records. */
export type WebsiteExportBatch = {
  inspectedCount: number;
  recognizedCount: number;
  ignoredCount: number;
  rows: Record<string, unknown>[];
};

/**
 * Sends operator-supplied website rows through the versioned WASM schema
 * boundary before dedupe consumes them. The result distinguishes inspected,
 * recognized, and ignored rows and carries diagnostics instead of treating an
 * arbitrary JSON array as current-catalog truth.
 */
export async function validateWebsiteExport(
  rows: Record<string, unknown>[],
): Promise<CoreResult<WebsiteExportBatch>> {
  await loadDealCore();
  return validateWebsiteExportWasm(rows) as CoreResult<WebsiteExportBatch>;
}
