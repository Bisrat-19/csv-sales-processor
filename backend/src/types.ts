export type JobStatus =
  | { status: 'queued' }
  | { status: 'processing' }
  | { status: 'done'; fileName: string; metrics: { processingTimeMs: number; departmentCount: number }; downloadUrl?: string }
  | { status: 'failed'; error: string };