//! Shared serialized contracts for parser output, diagnostics, provenance, and
//! supplier-resolution uncertainty.

use serde::{Deserialize, Serialize};

/// Stable API envelope that carries either data or a typed error plus any
/// non-fatal diagnostics gathered while producing the result.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoreResult<T> {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<CoreError>,
    pub diagnostics: Vec<CoreDiagnostic>,
}

impl<T> CoreResult<T> {
    /// Constructs a successful envelope while preserving advisory diagnostics.
    pub fn success(data: T, diagnostics: Vec<CoreDiagnostic>) -> Self {
        Self {
            ok: true,
            data: Some(data),
            error: None,
            diagnostics,
        }
    }

    /// Constructs a failed envelope with no data and the evidence explaining
    /// both the blocking error and any additional diagnostics.
    pub fn failure(error: CoreError, diagnostics: Vec<CoreDiagnostic>) -> Self {
        Self {
            ok: false,
            data: None,
            error: Some(error),
            diagnostics,
        }
    }
}

/// Machine-stable failure code paired with an operator-readable explanation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoreError {
    pub code: String,
    pub message: String,
}

/// Non-fatal or supporting evidence with optional source-line context.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoreDiagnostic {
    pub kind: CoreDiagnosticKind,
    pub severity: DiagnosticSeverity,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_number: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw_text: Option<String>,
}

/// Domain that produced a diagnostic, allowing the UI to route it correctly.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CoreDiagnosticKind {
    ParserSmoke,
    UnsupportedOptions,
    WebsiteExportSchema,
}

/// Operator-facing urgency of a diagnostic independent of its domain.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DiagnosticSeverity {
    Info,
    Warning,
    Error,
}

/// Lossless line-oriented result of parsing one raw promotion source.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedBatch {
    pub source_line_count: u32,
    pub records: Vec<ParsedLineRecord>,
}

/// One physical source line with normalized text, classification, supplier
/// resolution, and immutable provenance back to the original input.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedLineRecord {
    pub id: String,
    pub line_number: u32,
    pub raw_text: String,
    pub normalized_text: String,
    pub tag: DealTag,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub section: Option<SectionKind>,
    pub supplier: SupplierResolution,
    pub provenance: Provenance,
}

/// Structural role assigned to a parsed source line; unknown and ignored input
/// remain explicit variants so the parser never drops uncertainty silently.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DealTag {
    VendorHeading,
    StandardDeal,
    ExclusiveDeal,
    UnknownLine,
    SectionHeading,
    ProgramSubheading,
    IgnoredWhitespace,
}

/// High-level email section that may constrain supplier and deal interpretation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SectionKind {
    ContemporaryCruise,
    LuxuryCruise,
    TopLand,
    Other(String),
}

/// Typed supplier-linkage outcome that distinguishes confident identity,
/// bounded ambiguity, policy ineligibility, unresolved context, and no evidence.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum SupplierResolution {
    Known {
        canonical: String,
    },
    Ambiguous {
        candidates: Vec<String>,
        preferred: Option<String>,
    },
    RecognizedButIneligible {
        canonical: String,
    },
    Unresolved {
        raw: Option<String>,
    },
    Unknown,
}

/// Origin and one-based source line needed to explain or repair derived data.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Provenance {
    pub source: DealSource,
    pub line_number: u32,
}

/// Authorized origin of a deal observation or operator-authored correction.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DealSource {
    RawEmail,
    Website,
    OperatorPatch,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn core_result_serializes_success_shape() {
        let result = CoreResult::success(
            ParsedBatch {
                source_line_count: 0,
                records: Vec::new(),
            },
            Vec::new(),
        );
        let serialized = serde_json::to_value(result).expect("CoreResult serializes to JSON");

        assert_eq!(serialized["ok"], true);
        assert!(serialized.get("data").is_some());
        assert!(serialized.get("error").is_none());
        assert_eq!(serialized["diagnostics"].as_array().unwrap().len(), 0);
    }
}
