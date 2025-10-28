# CSV Sales Processor — Frontend 

This repository includes a small Next.js frontend that provides a UI to upload CSVs, poll job status, and download processed results.

Run the frontend locally:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 in your browser. The frontend communicates with the backend at the URL configured in `frontend/.env.local` 
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_UPLOAD_API_KEY=your-secret-api-key
```

## Demo video: https://drive.google.com/file/d/1YdtDTycFvahIep9IC2Bb2IykpIMQiLaW/view?usp=sharing



# CSV Sales Processor — Backend

This repository contains a small Node.js + TypeScript backend that accepts large CSV uploads, aggregates total sales per department in a memory-efficient streaming manner, and produces an aggregated CSV for download.

## How to run the app 

1. Install dependencies (from repository root):

```bash
cd backend
npm install
```

2. Start the dev server (uses `ts-node-dev`):

```bash
npm run dev
```

The server listens on port 3000 by default. Environment variables can be set using a `.env.` file in `backend/` (see below).


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


## Estimated complexity

- Time complexity: O(N) where N is the number of rows in the input CSV. Each row is parsed once and its sales value is added to the department's running total.
- Space complexity: O(D) where D is the number of distinct departments. Only one numeric accumulator per department is kept in memory; rows themselves are not stored.


