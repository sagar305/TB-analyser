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

1. Import XLSX, XLS, XLSM or CSV (maximum 10 MB). Macros are never executed.
2. Choose worksheet and header row; map account, closing debit, closing credit, and optional category columns.
3. Correct invalid source rows and import again. Blank amounts count as zero; named Total / Grand Total rows are excluded.
4. Review and edit classifications. Name-based suggestions are not authoritative.
5. Inspect reconciliation, duplicate accounts, unusual balance directions, and unclassified accounts.
6. Export an Excel pack or use Print / PDF brief to save a local PDF.

Amounts are INR, with dot decimal separators and optional comma grouping. Debit and credit columns must be non-negative. Calculations use integer paise; totals outside JavaScript's safe integer range are rejected. Only closing debit/credit format is supported; convert signed-balance or opening/movement exports first. Subtotal rows other than exact Total / Grand Total must be removed from the input.

## Privacy and offline behavior

Analysis and exports run entirely in the browser without API calls, telemetry, external fonts, CDNs, or remote processing. A `connect-src 'none'` content security policy blocks page network API requests. Static assets load when opening the application. A service worker caches the app after its first successful visit; wait for the Offline ready notice before disconnecting. Browser storage deletion removes this cache. For a first launch without internet, distribute this repository and use the local server.

TB data is kept only in page memory, never localStorage or a database. Refreshing or Clear analysis discards it; downloaded files remain on the client's device. No login or API key is required.

## Accounting scope

The financial summary is provisional and based on reviewed account categories. Balance agreement does not prove completeness or correctness. Contra accounts may legitimately trigger unusual-direction flags. This app does not infer cash flows, comparative trends, ageing, statutory disclosures, or current/non-current ratios from a single TB. PDFs are not accepted as structured TB inputs.

## Third-party software

SheetJS Community Edition 0.20.3 is vendored in `frontend/vendor/`; see its Apache 2.0 license there. No runtime package downloads are needed.

## Deployment

Publish `frontend/` as the static directory on Netlify, GitHub Pages, or another HTTPS static host. No build command or backend deployment is necessary. The requested source repository is https://github.com/sagar305/TB-analyser.
