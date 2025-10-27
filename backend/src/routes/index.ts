import { Express } from 'express';
import { JobStatus } from '../types';
import { createJobController } from '../controllers/jobController';

type RegisterOptions = {
  app: Express;
  jobs: Map<string, JobStatus>;
  uploadDir: string;
  outputDir: string;
  uploadMiddleware: any; 
  requireApiKey: any;
  workerExecArgs?: string[];
};

export default function registerRoutes(opts: RegisterOptions) {
  const { app, jobs, outputDir, uploadMiddleware, requireApiKey, workerExecArgs } = opts;

  const { uploadHandler, statusHandler, downloadHandler } = createJobController({ jobs, outputDir, workerExecArgs });

  // POST /upload - protected by API key middleware when configured.
  // Uses multer (passed via uploadMiddleware) to accept a single file under
  // the `file` form field and then hands control to uploadHandler which
  // will queue the background processing job.
  app.post('/upload', requireApiKey, uploadMiddleware.single('file'), uploadHandler);

  // GET /status/:jobId - returns current job state (queued/processing/done/failed).
  app.get('/status/:jobId', requireApiKey, statusHandler);

  // GET /download/:fileName - serves the resulting CSV. This endpoint performs
  // token validation (signed URLs) or accepts the API key as a fallback.
  app.get('/download/:fileName', downloadHandler);
}
