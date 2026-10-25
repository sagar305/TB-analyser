# Verification record — 20 October 2026

## Automated regression suite

41 tests passed, 0 failed using Node with `--test-isolation=none` in the local sandbox.

Coverage includes:

- Integer amount parsing, invalid-row rejection, totals exclusion and exact reconciliation.
- Multiple years with nonadjacent DR/CR columns, signed columns, separate sheets, repeated headers, date conventions and mapping overrides.
- Explicit/conflicting/absent currency metadata; no silent INR fallback.
- All 15 ratios, non-positive denominators, missing cash evidence, reporting gaps and differing durations.
- P&L and Balance Sheet ties, unclosed profit and closing equity consistency.
- Common-size statements, variances, working capital and a waterfall that reconciles even with losses.
- Deterministic findings/questions, cash-flow arithmetic and cash-to-TB differences.
- Excel round-trip numeric values, styling and frozen headers; PDF reopening and pagination.
- Locally bundled/cached runtime assets and absence of application network-call code.

## Supplied workbook checks (files retained locally, not committed)

| Workbook | Periods | Rows per period | Detected currency | TB and BS differences |
|---|---:|---:|---|---|
| Manufacturing | 3 | 28 | USD | 0 each |
| SaaS | 3 | 27 | INR | 0 each |
| Real estate | 3 | 27 | USD | 0 each |
| Messy wholesale | 3 | 24 | USD | 0 each |
| Healthcare | 3 | 29 | Not detected | 0 each |

All rows received suggested groups. This verifies import coverage and mathematical reconciliation, not that every suggested accounting policy is appropriate. The healthcare file requires currency selection because no explicit currency marker was detected.

## Browser workflow

- Empty initial workspace; sample only on explicit request.
- Imported an actual generated three-year XLSX through the file chooser: USD, 16 accounts per period, 3/3 reconciled.
- Verified common-size P&L and the EBITDA waterfall against sample amounts.
- Verified working-capital tables, generated management questions and all three comparative statement tables.
- Reloaded the app after stopping its local server: cached app loaded and interactive EBITDA chart worked.
- Generated PDF and Excel packs with the server stopped; the browser reported export success and its download event completed for Excel.
- No browser console errors were returned for these operations.
- Restored the local server for user testing.

## Export checks

A generated 23-page single-company sample PDF was reopened successfully. Rendered dashboard, cash-flow and ratio pages showed readable columns, wrapped text and page footers. Excel was reopened with SheetJS and its revenue/PAT amounts matched the calculation model. Larger client packs paginate independently by section.

## Explicit limitations / deployment status

- Public GitHub Pages hosting remains disabled; no live hosted deployment is claimed.
- Cash flows need a source schedule. TB-only ageing, non-cash adjustments and statutory presentation are not inferred.
- Arbitrary unfamiliar account names still require manual classification; undated or unrecognized layouts require mapping/date input.
- PDF standard-font limitations and fixed two-decimal monetary precision are documented in README.
- Client data is not persisted across page refresh. Export before leaving.
- Browser testing used the desktop in-app browser; no claim of exhaustive Safari/mobile-device or very-large-ledger testing.

## Restaurant single-period regression — 25 October 2026

42 automated tests passed. The restaurant workbook was verified locally and through the browser: 43 accounts, explicit 1 January–31 December 2025 dates, USD 750,000 revenue, USD 106,500 EBITDA, USD 79,500 profit, and zero TB/Balance Sheet differences. The importer selects pre-closing balances, stops at the account-table total, excludes journal sheets with a Journal ID column, and uses account-class hints. Closing transfers and post-closing balances are not mixed into the analysis. The source workbook is not committed. Automatic classifications remain subject to review.

## Simple layouts and classification feedback — 25 October 2026

45 regression tests passed. The simple restaurant workbook (no account-class column) now produces the same 43-account results as the detailed version: USD 750,000 revenue, USD 106,500 EBITDA, USD 79,500 profit, zero TB/Balance Sheet differences. Generic header detection supports DR/CR currency suffixes, whitespace/underscore variants, ledger-name headings and reordered columns. Descriptive account columns take priority over ledger identifiers. Reconciliation footer rows without account codes are excluded only after a total. Unknown actual accounts remain imported and visibly require review; their amounts are never silently assigned to a guessed group. A single explicit closing date is preserved, with a disclosed full-year opening-date assumption when no start date is supplied. Runtime network restrictions and separate frontend/backend folders are unchanged.

### 25 October 2026 — single-period analysis view
Reproduced the all-N/A display by selecting variance for the restaurant's single period. Single-period views now fall back to amounts and disable variance selectors, explain the missing prior period, and provide classification review guidance. Browser checks using Restaurant_2025_Simple_TB.xlsx: revenue USD 750,000; EBITDA USD 106,500; PAT USD 79,500; common-size EBITDA 14.2%. All 46 automated tests pass, including stale comparison selection after reducing period count. No API calls added; frontend/backend separation retained.
