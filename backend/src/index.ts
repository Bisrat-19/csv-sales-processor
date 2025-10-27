import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { JobStatus } from './types';
import registerRoutes from './routes';
import { requireApiKey } from './middleware/auth';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// Base directories for uploads and outputs. Using dedicated folders keeps
// uploaded files and processed results separate and easy to manage.
const BASE_DIR = path.resolve(__dirname, '..');
const UPLOAD_DIR = path.join(BASE_DIR, 'uploads');
const OUTPUT_DIR = path.join(BASE_DIR, 'output');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

// Multer instance used to handle multipart/form-data uploads.
// Files are streamed to disk (not kept in memory) to support very large uploads.
const upload = multer({ storage });


// In-memory job store for demo purposes.
const jobs = new Map<string, JobStatus>();

// Simple CORS middleware to allow the frontend dev server to talk to the
// backend without an extra dependency. In production you may want to use
// the `cors` package and restrict origins.
app.use((req, res, next) => {
  const origin = process.env.ALLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-KEY');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});


registerRoutes({ app, jobs, uploadDir: UPLOAD_DIR, outputDir: OUTPUT_DIR, uploadMiddleware: upload, requireApiKey, workerExecArgs: ['-r', 'ts-node/register'] });

app.listen(PORT, () => {
  console.log(`CSV processor backend listening on http://localhost:${PORT}`);
});
