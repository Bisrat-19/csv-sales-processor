
# CSV Sales Processor — Backend

This repository contains a small Node.js + TypeScript backend that accepts large CSV uploads, aggregates total sales per department in a memory-efficient streaming manner, and produces an aggregated CSV for download.

## How to run the app (development)

1. Install dependencies (from repository root):

```bash
cd backend
npm install
```

2. Start the dev server (uses `ts-node-dev`):

```bash
npm run dev
```

The server listens on port 3000 by default. Environment variables can be set using a `.env` file in `backend/` (see below).

## How to run (production)

1. Build:

```bash
cd backend
npm run build
```

2. Start the built app:

```bash
npm run start
```

## How to test

Run unit tests with Jest:

```bash
cd backend
npm test
```

## Environment variables

Create `backend/.env` (not committed) with values like:

- `UPLOAD_API_KEY` — optional API key to protect upload/status endpoints
- `DOWNLOAD_SECRET` — HMAC secret used to sign download URLs (recommended in prod)
- `DOWNLOAD_EXPIRES_SEC` — number of seconds a signed URL is valid (default ~3600)

## Algorithm explanation & memory-efficiency strategy

The backend processes CSV uploads using streaming parsing (the `csv-parser` package). Key ideas:

- The uploaded file is saved directly to disk (via `multer` disk storage) — it is not buffered in memory.
- A worker thread reads the CSV as a stream and parses it row-by-row. For each row it extracts the department name and numeric sales value, and increments an in-memory counter for that department.
- Only the aggregated totals per department are retained in memory (a Map keyed by department name). This keeps memory usage proportional to the number of distinct departments rather than the number of rows in the CSV.

This approach allows processing of very large CSVs because rows are handled incrementally and discarded after aggregation.

Notes on headers: The parser attempts to detect header names (e.g., columns containing `department` and `sales`). There is also a fallback function used for headerless CSVs that treats the first three columns as `department,date,sales`.

## Estimated complexity

- Time complexity: O(N) where N is the number of rows in the input CSV. Each row is parsed once and its sales value is added to the department's running total.
- Space complexity: O(D) where D is the number of distinct departments. Only one numeric accumulator per department is kept in memory; rows themselves are not stored.

## Security & production notes

- The repository includes an optional upload API key middleware and a signed-download URL mechanism. In production you should set `DOWNLOAD_SECRET` and rotate it securely.
- The current job state is stored in an in-memory Map (single-node). For horizontal scaling and durability, use a job backend like Redis + Bull or a persistent DB.
- Output files are stored on local disk under `backend/output/`. For large-scale deployments, replace with durable object storage (S3/GCS) and generate pre-signed URLs.

## Troubleshooting

- If uploads appear to be missing: ensure `backend/uploads` exists and has write permissions.
- If a download link fails, check `DOWNLOAD_SECRET` and expiry timestamp; the server validates both the token and expiry.
