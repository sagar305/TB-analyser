# Setu Trial Balance Analyser

A private, offline trial balance analyser with a cream / forest-green interface inspired by the supplied StatementLab reference.

## Run locally

Install Node.js 20 or newer, then run from this folder:

```sh
node backend/server.mjs
```

Open http://127.0.0.1:4173. No package installation or internet connection is required. The bundled Excel library is included in the repository. Alternatively serve `frontend/` with any static web server. Use HTTPS for hosted offline caching.

## Folders

- `frontend/`: interface, workbook parsing, deterministic analysis engine, locally bundled Excel parser, and offline service worker.
- `backend/`: optional dependency-free static server, bound to loopback. It has no analysis/upload endpoints and receives no TB data.
- `tests/`: analysis regression tests. Run `node --test tests/*.test.mjs`.

## Workflow

1. Import up to three XLSX, XLS, XLSM or CSV files at once (maximum 10 MB each). Macros are never executed. One dataset holds three periods; a separate peer dataset holds three more.
2. For each file, select a slot, period label, start/end dates, worksheet, and header row. Map account, closing debit, closing credit, and optional category/ratio group columns. To use three worksheets from one workbook, import that workbook into each slot and select the relevant worksheet. Periods are sorted chronologically; overlapping dates are rejected.
3. Correct invalid source rows and import again. Blank amounts count as zero; named Total / Grand Total rows are excluded.
4. In Review data, review each period's ratio groups and confirm completeness. Suggestions are not authoritative. Purchases are left unmapped until stock adjustments are included in cost of sales. Changing a classification revokes that period's confirmation.
5. Inspect Overview, Drivers & ratios, Peer comparison, Review data, and Evidence & checks. Add peer TBs to compare periods with identical start/end dates. The three-period sample includes an illustrative peer when loaded using the sample button.
6. Enter operating cash flow and a source note for each period in Review data to enable CFO/PAT. Blank means unavailable; an explicitly entered zero is valid.
7. Export an Excel pack containing all company/peer TBs, ratio explanations, account drivers, comparisons, and evidence. Print / PDF includes the active dataset's analysis plus peer comparisons.

Use standalone period income and expenses, not cumulative YTD figures. The first real import removes illustrative periods from that dataset. Replacing one real period preserves the other two. All data remains in page memory.

## Ratios and comparison rules

All twelve reference ratios are included: revenue growth, EBITDA margin, PAT margin, current ratio, debt/equity, interest coverage, return on equity, CFO/PAT, receivable days, inventory days, payable days, and cash conversion cycle. Gross margin, quick ratio, and return on average assets are also included. Each row shows all periods, latest-period change (percentage points for percentage ratios), and a plain-language explanation of what it indicates and what to review.

- Ratios require complete, confirmed ratio groups. Missing inputs and non-positive denominators produce N/A, never infinity or invented values.
- Revenue growth compares durations differing by at most one day (to accommodate leap years).
- Day ratios use closing balances and actual period days, matching the reference's closing-balance convention. Total revenue proxies credit sales; COGS proxies credit purchases. Quarter/month day counts are not forced to 365.
- EBITDA includes other income under the displayed formula. PAT depends on included interest, tax, and adjustments.
- ROE and debt/equity use mapped closing equity; profit is not automatically added because that could double-count closed earnings.
- Return on average assets requires the preceding period to end one day before the current period starts; it is not annualised.
- CFO is supplied from a cash-flow statement or reconciled schedule, with evidence retained. It is not guessed from TB movements.
- Account drivers aggregate matching names case-insensitively. Renamed accounts remain separate. Different classifications across periods are flagged.

Amounts are INR, with dot decimal separators and optional comma grouping. Debit and credit columns must be non-negative. Calculations use integer paise; totals outside JavaScript's safe integer range are rejected. Only closing debit/credit format is supported; convert signed-balance or opening/movement exports first. Subtotal rows other than exact Total / Grand Total must be removed from the input.

## Privacy and offline behavior

Analysis and exports run entirely in the browser without API calls, telemetry, external fonts, CDNs, or remote processing. A `connect-src 'none'` content security policy blocks page network API requests. Static assets load when opening the application. A service worker caches the app after its first successful visit; wait for the Offline ready notice before disconnecting. Browser storage deletion removes this cache. For a first launch without internet, distribute this repository and use the local server.

TB data is kept only in page memory, never localStorage or a database. Refreshing or Clear analysis discards it; downloaded files remain on the client's device. No login or API key is required.

## Accounting scope

The financial summary and ratios are provisional and based on reviewed account groups. Balance agreement does not prove completeness or correctness. Contra accounts may legitimately trigger unusual-direction flags. Trends require multiple TBs; liquidity ratios require reviewed current/non-current groupings. Cash flows, ageing, and statutory disclosures are not inferred from TBs. PDFs are not accepted as structured TB inputs.

## Third-party software

SheetJS Community Edition 0.20.3 is vendored in `frontend/vendor/`; see its Apache 2.0 license there. No runtime package downloads are needed.

## Deployment

Publish `frontend/` as the static directory on Netlify, GitHub Pages, or another HTTPS static host. No build command or backend deployment is necessary. The requested source repository is https://github.com/sagar305/TB-analyser.


## Review data statements

Review data shows three comparative tables: Profit & Loss, Balance Sheet, and Cash Flow Statement, each with all imported periods. The account classification editor is expandable below them. P&L and Balance Sheet require complete reviewed account groups. The Balance Sheet presents the net unclosed P&L separately from mapped equity to reconcile an unclosed TB.

The Cash Flow Statement uses locally entered operating, investing, and financing cash flows, opening/closing cash, and exchange or other reconciling effects. Enter explicit zero where applicable; missing data stays unavailable. Save a source note with the figures. The table calculates closing cash and flags any reconciliation difference. It is a summary of supporting cash-flow evidence, not an automatic cash-flow reconstruction from TB movements. All three statements are also included in Excel and print/PDF output.

## Automatic multi-period imports

A sheet with an account-name column and two or three year-labelled debit/credit pairs (for example FY23 DR, FY24 DR, FY25 DR, FY23 CR, FY24 CR, FY25 CR) is detected automatically, including nonadjacent columns and header rows below a title. The import preview pairs the columns, displays dates and reconciliation differences, and lets you edit suggested ratio groups once for every period. Confirm the financial-year start: FY23 is interpreted as the year ending in 2023. Import replaces the selected company's three slots only when you click Import all detected periods.

When supplied, Statement distinguishes balance-sheet accounts from P&L accounts. Suggestions handle contra-assets, prepaid expenses, deferred revenue and service-sector account names. Review these suggestions before confirming completeness. GL code, department, statement, and source row are preserved; the workbook itself is never saved to the repository. Manual mapping remains available for other layouts. Cash flow still requires supporting evidence.
