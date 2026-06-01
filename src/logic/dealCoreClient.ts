import initDealCore, {
  parseRawEmail as parseRawEmailWasm,
} from '../wasm/deal-core/deal_core.js';

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

export async function loadDealCore(): Promise<void> {
  await initDealCore();
}

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
