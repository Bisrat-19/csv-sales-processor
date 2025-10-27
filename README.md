
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


## How to test

Run unit tests with Jest:

```bash
cd backend
npm test
```

## Environment variables

Create `backend/.env` with values like:

- `UPLOAD_API_KEY` — API key to protect upload/status endpoints
- `DOWNLOAD_SECRET` — HMAC secret used to sign download URLs (recommended in prod)
- `DOWNLOAD_EXPIRES_SEC` — number of seconds a signed URL is valid (default ~3600)

## Algorithm explanation & memory-efficiency strategy

The backend processes CSV uploads using streaming parsing (the `csv-parser` package). Key ideas:

- The uploaded file is saved directly to disk (via `multer` disk storage) — it is not buffered in memory.
- A worker thread reads the CSV as a stream and parses it row-by-row. For each row it extracts the department name and numeric sales value, and increments an in-memory counter for that department.
- Only the aggregated totals per department are retained in memory (a Map keyed by department name). This keeps memory usage proportional to the number of distinct departments rather than the number of rows in the CSV.

This approach allows processing of very large CSVs because rows are handled incrementally and discarded after aggregation.


## API Endpoints (backend)

All backend endpoints are mounted on the server started in `backend/` (default http://localhost:3000).

- POST /upload
	- Description: Accepts a CSV file upload and queues a background job to process it.
	- Headers: `x-api-key: <UPLOAD_API_KEY>` (required if `UPLOAD_API_KEY` is set)
	- Content-Type: multipart/form-data
	- Form field: `file` — the CSV file to upload
	- Example success response:

```json
{ "jobId": "c3f8b2a1-...", "statusUrl": "/status/c3f8b2a1-..." }
```

- GET /status/:jobId
	- Description: Returns the current status of a processing job.
	- Headers: `x-api-key: <UPLOAD_API_KEY>` (required if `UPLOAD_API_KEY` is set)
	- Example responses:

Queued / Processing:

```json
{ "status": "queued" }
```

```json
{ "status": "processing" }
```

Done:

```json
{
	"status": "done",
	"fileName": "d6eea3ad-20f5-4147-8a0c-b819a682bf22.csv",
	"metrics": { "processingTimeMs": 1234, "departmentCount": 12 },
	"downloadUrl": "/download/d6eea3ad-20f5-4147-8a0c-b819a682bf22.csv?expires=1700000000&token=..."
}
```

Failed:

```json
{ "status": "failed", "error": "parsing error on row 123" }
```

- GET /download/:fileName
	- Description: Serves the processed CSV file. The endpoint validates a signed token (query params `expires` and `token`) if `DOWNLOAD_SECRET` is configured. If no token is provided, the endpoint will accept the `x-api-key` header as a fallback (useful for internal downloads).
	- Example: `GET /download/d6eea3ad-20f5-4147-8a0c-b819a682bf22.csv?expires=1700000000&token=...`
	- Successful response: returns the CSV file with `Content-Type: text/csv`. Example CSV content:

```
Department Name,Total Number of Sales
Sales,130
Boston,50
```

Security notes: signed URLs are HMAC-SHA256 tokens computed over `${fileName}:${expires}` using `DOWNLOAD_SECRET`. The server validates expiry and token integrity using a timing-safe compare.


## Estimated complexity

- Time complexity: O(N) where N is the number of rows in the input CSV. Each row is parsed once and its sales value is added to the department's running total.
- Space complexity: O(D) where D is the number of distinct departments. Only one numeric accumulator per department is kept in memory; rows themselves are not stored.


## Frontend (development)

This repository includes a small Next.js frontend that provides a UI to upload CSVs, poll job status, and download processed results.

Run the frontend locally:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 in your browser. The frontend communicates with the backend at the URL configured in `frontend/.env.local` (use `NEXT_PUBLIC_API_URL`).


[Demo video: Streaming CSV processor walkthrough](/home/bisrat/Videos/Screencasts/Screencast from 2025-10-27 16-18-12.webm)

