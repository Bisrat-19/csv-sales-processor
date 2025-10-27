import fs from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';
import { v4 as uuidv4 } from 'uuid';
import { JobStatus } from '../types';
import { makeSignedDownloadUrl, validateDownloadToken } from '../utils/signedUrl';
import { Request, Response } from 'express';

type ControllerDeps = {
  jobs: Map<string, JobStatus>;
  outputDir: string;
  workerExecArgs?: string[];
};

export function createJobController(deps: ControllerDeps) {
  const { jobs, outputDir, workerExecArgs } = deps;

  async function uploadHandler(req: Request, res: Response) {
    // Upload handler responsibility:
    // - Validate that a file was received
    // - Create a job entry and spawn a background worker to process the file
    // - Return a jobId that can be polled via /status/:jobId
    if (!req.file) return res.status(400).json({ error: 'file is required under field `file`' });

    const inputPath = (req.file as any).path as string;
    const jobId = uuidv4();
    jobs.set(jobId, { status: 'queued' });

  // Spawn a worker thread to do the heavy lifting so the HTTP process
  // remains responsive.
  const workerPath = path.resolve(__dirname, '..', 'worker.ts');
  const worker = new Worker(workerPath, { workerData: { inputPath, outputDir }, execArgv: workerExecArgs || ['-r', 'ts-node/register'] });

    jobs.set(jobId, { status: 'processing' });
    worker.on('message', (msg: any) => {
      if (msg.status === 'done') {
        const downloadUrl = makeSignedDownloadUrl(msg.fileName, Number(process.env.DOWNLOAD_EXPIRES_SEC) || 3600);
        jobs.set(jobId, { status: 'done', fileName: msg.fileName, metrics: msg.metrics, downloadUrl });
      } else if (msg.status === 'failed') {
        jobs.set(jobId, { status: 'failed', error: msg.error });
      }
    });

    worker.on('error', (err) => {
      jobs.set(jobId, { status: 'failed', error: err.message });
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        const current = jobs.get(jobId);
        if (current && current.status === 'processing') {
          jobs.set(jobId, { status: 'failed', error: `worker exited with code ${code}` });
        }
      }
    });

    const statusUrl = `/status/${jobId}`;
    return res.json({ jobId, statusUrl });
  }

  // Return current job state
  function statusHandler(req: Request, res: Response) {
    const jobId = req.params.jobId;
    const job = jobs.get(jobId);
    if (!job) return res.status(404).json({ error: 'job not found' });
    return res.json(job);
  }

  // Secure download handler. It first attempts to validate the signed token
  // (expires + token). If no valid token is present, it falls back to checking the upload API key 
  function downloadHandler(req: Request, res: Response) {
    const fileName = req.params.fileName;

    const token = req.query.token as string | undefined;
    const expires = req.query.expires as string | undefined;

    if (!validateDownloadToken(fileName, token, expires)) {
      const apiKey = process.env.UPLOAD_API_KEY;
      if (apiKey) {
        const provided = (req.headers['x-api-key'] as string) || (req.query['apiKey'] as string);
        if (provided !== apiKey) return res.status(401).json({ error: 'Invalid or expired download token' });
      } else {
        return res.status(401).json({ error: 'Invalid or expired download token' });
      }
    }

    const full = path.join(outputDir, fileName);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'file not found' });
    res.setHeader('Content-Type', 'text/csv');
    res.download(full);
  }

  return { uploadHandler, statusHandler, downloadHandler };
}
