# SETU TB Analyser

An offline financial review application. All workbook parsing, account suggestions, calculations, charts, management questions and exports run in the browser. There are no AI calls, API keys, cloud services, analytics or runtime CDN dependencies.

## Run without internet

With Node.js 20 or newer installed, run from the repository directory:

```sh
node backend/server.mjs
```

Open **http://127.0.0.1:4173/**. No package installation is needed. The app also caches its bundled assets after its first successful visit over localhost or HTTPS; wait for **Offline ready**. A first visit to an uncached hosted URL still needs connectivity. Browser cache removal removes offline availability. Use the local server for a completely disconnected first launch.

## Source folders

- `frontend/`: all browser UI, financial logic, importers, SVG charts, exports, bundled libraries and offline service worker.
- `backend/`: optional local static server. It accepts GET/HEAD only and has no upload or analysis endpoint.
- `tests/`: regression tests for imports, calculations, reconciliation, reports and cached assets.

The backend is intentionally not needed for financial processing, allowing the frontend to run on GitHub Pages or any static host.

## User workflow

1. Import one or several Excel/CSV workbooks (up to 20 files, 10 MB each). Each client holds up to three periods. Supported automatic layouts include separate yearly sheets, year-labelled debit/credit columns (adjacent or separated), and year-labelled signed closing columns. Title rows and repeated headers in the supplied export layouts are handled. Files are read locally, not uploaded to a server.
2. Entity and explicit currency metadata are detected when present. Currency symbols/number formats are considered; an ambiguous dollar sign alone does not establish USD. Missing or conflicting currencies require review. There is no exchange-rate conversion, and figures are taken in whole currency units, not automatically scaled from thousands/lakhs.
3. Review suggested account groups. Name-based classification is a draft, not a reliable substitute for accounting judgment. Unmapped accounts suppress statement and ratio values. Confirm completeness and stock adjustments under **Review data**. An unbalanced TB remains visible with reconciliation errors, never silently balanced.
4. Review dates. Where only a year is provided, the saved financial-year start setting is used and an assumption is recorded. Exact start/end dates can be edited separately for each period; overlapping dates are rejected. Use independent period activity, not cumulative year-to-date TBs. Unrecognized/undated layouts open the manual mapping screen.
5. Review Overview, Drivers & ratios, P&L & Balance Sheet, Working capital, Management insights, Management questions, Peer comparison, Review data, and Evidence & checks.
6. Supply cash-flow statement amounts and a source in Review data if available. The three statement tables include P&L, Balance Sheet and Cash Flow. Missing cash-flow amounts stay unavailable. The app checks both the cash-flow arithmetic and its closing-cash difference from the TB.
7. Export the Excel or PDF review pack. Both include all loaded clients, three statements, variances/common-size analysis, all 15 ratios and explanations, working capital, EBITDA bridge, management findings/questions, checks, peer comparisons and account-level source TBs. PDFs include revenue and waterfall charts; Excel provides their underlying numeric tables, wrapped text, frozen headings and formatted headers.

The app starts empty. **Analyse three-period sample** explicitly loads synthetic demonstration data, which is labelled illustrative. The downloadable template contains illustrative balances to replace, and currency metadata to update. It imports all three sheets together.

## Calculation conventions and boundaries

- Monetary arithmetic uses integer hundredths; no rounding plug is inserted to force reconciliation. Input must use dot decimals; negative numbers in explicit debit/credit columns are rejected, while signed-net columns preserve their signs. Two-decimal fixed precision is used for all supported currencies.
- P&L: revenue plus other income, less mapped COGS, operating expenses, depreciation/amortisation, finance costs and tax. It is not a statutory statement or automated accounting-adjustment engine.
- Balance Sheet: assets = liabilities + mapped equity + the unclosed P&L balance. Debt/equity and ROE use this same closing equity. If the P&L has already been closed out, its mapped nominal balance should be zero. Do not include both period activity and duplicate profit-transfer balances.
- All 15 ratios: revenue growth, gross/EBITDA/PAT margins, current/quick ratios, debt/equity, interest coverage, ROE, CFO/PAT, return on average assets, receivable/inventory/payable days and cash conversion cycle.
- Days use actual period length and closing balances. Revenue substitutes for credit sales, and COGS substitutes for purchases. ROA needs contiguous opening balances. Growth requires comparable period durations. No annualisation is applied.
- Common size uses revenue for P&L and total assets for Balance Sheet. Percentage variance requires a positive prior baseline; zero/negative baselines show unavailable. Absolute movements are still reported.
- The EBITDA waterfall reconciles prior EBITDA plus revenue, other income and cost contributions to latest EBITDA. Working-capital balance changes are not represented as measured cash flows.
- Management screening uses disclosed thresholds: 5% of prior revenue for large account movements, 1 percentage point for EBITDA margin, 5 days for cash-cycle components, current ratio below 1, interest cover below 2, losses and non-positive equity. It generates review questions, not invented business causes or assurance.
- Account movement matching aggregates trimmed, case-insensitive names. Renamed accounts appear separately. Source rows, GL codes and worksheet names remain available for review.
- TBs cannot establish debtor/creditor ageing, stock obsolescence, contractual debt maturities, statutory adjustments, or actual operating/investing/financing cash flows without supporting evidence. There are no fabricated industry benchmarks; import an actual peer TB for comparisons.
- PDF uses standard Latin fonts. Unsupported characters are preserved as explicit Unicode code-point labels, e.g. `[U+...]`; Excel retains the original Unicode text. Excel contains numeric results rather than editable financial calculation formulas.
- Financial data stays in page memory. Refresh/close clears it; export before leaving. Only the default fiscal-year month is remembered locally. The service worker stores application code, not client TBs.

## Tests

```sh
node --test tests/*.test.mjs
```

For a sandbox that blocks worker processes, use:

```sh
node --test --test-isolation=none tests/*.test.mjs
```

See `TESTING.md` for the latest test coverage and manual workflow results. Test outputs are excluded from Git.

## GitHub

Repository: https://github.com/sagar305/TB-analyser

GitHub Actions runs tests on pushes to `main`. Public hosting is **not automatically enabled or deployed**. The workflow includes an optional manual `deploy_pages` input for deployment to an already-enabled GitHub Pages site. Hosting requires the repository owner to enable Pages and deliberately run that deployment; source-code availability on GitHub is not the same as a live website. A Pages deployment serves only `frontend/`; no backend or financial APIs are required.

## Bundled dependencies

SheetJS 0.20.3 (Excel parsing/writing), pdf-lib 1.17.1 (local PDF generation), and JSZip 3.10.1 (Excel formatting). Their distributable code and licence files are in `frontend/vendor/`. These files are bundled, cached and used offline; there is no install step for end users. Developer/CI use of GitHub is separate from client-side TB analysis.
