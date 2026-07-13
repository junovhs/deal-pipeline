use serde::{Deserialize, Serialize};

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
    pub fn success(data: T, diagnostics: Vec<CoreDiagnostic>) -> Self {
        Self {
            ok: true,
            data: Some(data),
            error: None,
            diagnostics,
        }
    }

    pub fn failure(error: CoreError, diagnostics: Vec<CoreDiagnostic>) -> Self {
        Self {
            ok: false,
            data: None,
            error: Some(error),
            diagnostics,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoreError {
    pub code: String,
    pub message: String,
}

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CoreDiagnosticKind {
    ParserSmoke,
    UnsupportedOptions,
    WebsiteExportSchema,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DiagnosticSeverity {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedBatch {
    pub source_line_count: u32,
    pub records: Vec<ParsedLineRecord>,
}

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SectionKind {
    ContemporaryCruise,
    LuxuryCruise,
    TopLand,
    Other(String),
}

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Provenance {
    pub source: DealSource,
    pub line_number: u32,
}

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
