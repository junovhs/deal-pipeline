use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{CoreDiagnostic, CoreDiagnosticKind, CoreError, CoreResult, DiagnosticSeverity};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebsiteExportBatch {
    pub inspected_count: u32,
    pub recognized_count: u32,
    pub ignored_count: u32,
    pub rows: Vec<Value>,
}

pub fn validate_website_export_core(rows: Vec<Value>) -> CoreResult<WebsiteExportBatch> {
    let inspected_count = rows.len() as u32;
    let recognized_rows: Vec<Value> = rows.into_iter().filter(is_deal_row).collect();
    let recognized_count = recognized_rows.len() as u32;
    let ignored_count = inspected_count.saturating_sub(recognized_count);

    if recognized_count == 0 {
        return CoreResult::failure(
            CoreError {
                code: "incompatible_website_export".to_string(),
                message: format!(
                    "Inspected {inspected_count} records but recognized 0 deals. Expected each deal to include a non-empty shopOverline and a title or shopListing. Export the website deal entries and try again."
                ),
            },
            vec![CoreDiagnostic {
                kind: CoreDiagnosticKind::WebsiteExportSchema,
                severity: DiagnosticSeverity::Error,
                message: "No records matched the website deal schema.".to_string(),
                line_number: None,
                raw_text: None,
            }],
        );
    }

    let diagnostics = if ignored_count > 0 {
        vec![CoreDiagnostic {
            kind: CoreDiagnosticKind::WebsiteExportSchema,
            severity: DiagnosticSeverity::Warning,
            message: format!(
                "Ignored {ignored_count} records that did not match the website deal schema."
            ),
            line_number: None,
            raw_text: None,
        }]
    } else {
        Vec::new()
    };

    CoreResult::success(
        WebsiteExportBatch {
            inspected_count,
            recognized_count,
            ignored_count,
            rows: recognized_rows,
        },
        diagnostics,
    )
}

fn is_deal_row(row: &Value) -> bool {
    let Some(object) = row.as_object() else {
        return false;
    };

    has_non_empty_string(object.get("shopOverline"))
        && (has_non_empty_string(object.get("title"))
            || has_non_empty_string(object.get("shopListing")))
}

fn has_non_empty_string(value: Option<&Value>) -> bool {
    value
        .and_then(Value::as_str)
        .is_some_and(|value| !value.trim().is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_valid_deal_rows() {
        let rows: Vec<Value> =
            serde_json::from_str(include_str!("../../fixtures/regression/website-deals.json"))
                .expect("valid website fixture");

        let result = validate_website_export_core(rows);
        let batch = result.data.expect("valid export returns data");

        assert!(result.ok);
        assert_eq!(batch.inspected_count, 2);
        assert_eq!(batch.recognized_count, 2);
        assert_eq!(batch.ignored_count, 0);
    }

    #[test]
    fn rejects_cms_pages_as_an_incompatible_export() {
        let rows: Vec<Value> = serde_json::from_str(include_str!(
            "../fixtures/dedupe/incompatible-cms-export.json"
        ))
        .expect("valid incompatible-export fixture");

        let result = validate_website_export_core(rows);

        assert!(!result.ok);
        assert!(result.data.is_none());
        assert_eq!(
            result.error.as_ref().unwrap().code,
            "incompatible_website_export"
        );
        assert!(result
            .error
            .unwrap()
            .message
            .contains("Inspected 2 records"));
    }

    #[test]
    fn filters_non_deal_rows_from_a_mixed_export() {
        let rows = vec![
            serde_json::json!({ "title": "About us", "typeId": 8 }),
            serde_json::json!({
                "shopOverline": "Norwegian Cruise Line",
                "title": "Free gratuities"
            }),
        ];

        let result = validate_website_export_core(rows);
        let batch = result.data.expect("mixed export retains deal rows");

        assert!(result.ok);
        assert_eq!(batch.inspected_count, 2);
        assert_eq!(batch.recognized_count, 1);
        assert_eq!(batch.ignored_count, 1);
        assert_eq!(result.diagnostics.len(), 1);
    }
}
