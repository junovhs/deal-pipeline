#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FixtureCaseReport {
    pub name: &'static str,
    pub passed: bool,
    pub detail: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FixtureReport {
    pub suite: &'static str,
    pub cases: Vec<FixtureCaseReport>,
}

impl FixtureReport {
    pub fn passed(&self) -> bool {
        self.cases.iter().all(|case| case.passed)
    }
}

pub fn run_fixture_suite() -> FixtureReport {
    let raw = include_str!("../fixtures/weekly/2026-06-01/raw-email.txt");
    let parsed = crate::parse_raw_email_core(raw);
    let source_line_count = raw.lines().count() as u32;
    let actual_line_count = parsed
        .data
        .as_ref()
        .map(|batch| batch.source_line_count)
        .unwrap_or_default();

    let weekly_case_passed = parsed.ok
        && parsed.error.is_none()
        && actual_line_count == source_line_count
        && parsed
            .data
            .as_ref()
            .is_some_and(|batch| !batch.records.is_empty());

    FixtureReport {
        suite: "deal-core fixtures",
        cases: vec![FixtureCaseReport {
            name: "weekly/2026-06-01/raw-email",
            passed: weekly_case_passed,
            detail: format!(
                "expected {source_line_count} source lines; parsed {actual_line_count}"
            ),
        }],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weekly_raw_email_fixture_matches() {
        let report = run_fixture_suite();

        assert!(report.passed(), "fixture suite failed: {:?}", report.cases);
        assert_eq!(report.cases.len(), 1);
        assert_eq!(report.cases[0].name, "weekly/2026-06-01/raw-email");
    }

    #[test]
    fn report_fails_when_any_case_fails() {
        let report = FixtureReport {
            suite: "smoke",
            cases: vec![FixtureCaseReport {
                name: "intentional mismatch",
                passed: false,
                detail: "expected mismatch".to_string(),
            }],
        };

        assert!(!report.passed());
    }
}
