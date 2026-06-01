use wasm_bindgen::prelude::*;

mod types;

pub use types::*;

#[wasm_bindgen(js_name = parseRawEmail)]
pub fn parse_raw_email(raw_text: &str) -> JsValue {
    let result = parse_raw_email_core(raw_text);
    serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
}

pub fn parse_raw_email_core(raw_text: &str) -> CoreResult<ParsedBatch> {
    let mut records = Vec::new();
    let mut active_supplier: Option<String> = None;

    for (index, raw_line) in raw_text.lines().enumerate() {
        let line_number = (index + 1) as u32;
        let raw = raw_line.trim_end_matches('\r').to_string();
        let normalized = raw.trim().to_string();
        let tag = classify_smoke_line(&normalized, active_supplier.is_some());

        if matches!(tag, DealTag::VendorHeading) {
            active_supplier = Some(normalized.clone());
        }

        let supplier = match tag {
            DealTag::VendorHeading => SupplierResolution::Unresolved {
                raw: Some(normalized.clone()),
            },
            DealTag::StandardDeal => SupplierResolution::Unresolved {
                raw: active_supplier.clone(),
            },
            _ => SupplierResolution::Unknown,
        };

        records.push(ParsedLineRecord {
            id: format!("raw-line-{line_number}"),
            line_number,
            raw_text: raw,
            normalized_text: normalized,
            tag,
            section: None,
            supplier,
            provenance: Provenance {
                source: DealSource::RawEmail,
                line_number,
            },
        });
    }

    CoreResult::success(
        ParsedBatch {
            source_line_count: records.len() as u32,
            records,
        },
        Vec::new(),
    )
}

fn classify_smoke_line(normalized: &str, has_active_supplier: bool) -> DealTag {
    if normalized.is_empty() {
        return DealTag::IgnoredWhitespace;
    }

    if !has_active_supplier && looks_like_smoke_heading(normalized) {
        return DealTag::VendorHeading;
    }

    DealTag::StandardDeal
}

fn looks_like_smoke_heading(normalized: &str) -> bool {
    let word_count = normalized.split_whitespace().count();
    word_count <= 4
        && normalized.chars().any(|ch| ch.is_alphabetic())
        && !normalized.contains(':')
        && !normalized.contains('$')
        && !normalized.contains('%')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn smoke_parse_preserves_lines_and_supplier_context() {
        let result = parse_raw_email_core("Carnival\nDeal line");

        assert!(result.ok);
        let batch = result.data.expect("smoke parser returns a parsed batch");
        assert_eq!(batch.source_line_count, 2);
        assert_eq!(batch.records[0].tag, DealTag::VendorHeading);
        assert_eq!(batch.records[0].raw_text, "Carnival");
        assert_eq!(batch.records[1].tag, DealTag::StandardDeal);
        assert_eq!(
            batch.records[1].supplier,
            SupplierResolution::Unresolved {
                raw: Some("Carnival".to_string())
            }
        );
    }

    #[test]
    fn smoke_parse_handles_windows_line_endings() {
        let result = parse_raw_email_core("Carnival\r\nDeal line\r\n");
        let batch = result.data.expect("smoke parser returns a parsed batch");

        assert_eq!(batch.source_line_count, 2);
        assert_eq!(batch.records[0].raw_text, "Carnival");
        assert_eq!(batch.records[1].raw_text, "Deal line");
    }
}
