import { Request, Response, NextFunction } from 'express';

// Middleware that enforces the presence of the UPLOAD_API_KEY when configured.
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.UPLOAD_API_KEY;
  if (!apiKey) return next();
  const provided = (req.headers['x-api-key'] as string) || (req.query['apiKey'] as string);
  if (provided === apiKey) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}