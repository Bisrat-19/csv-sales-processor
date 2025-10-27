import crypto from 'crypto';

// Read the secret at call time so tests and ephemeral processes can set it
// dynamically. Using a fixed secret read at module load time makes testing
// harder and requires process restart when rotating secrets.
function getSecret() {
  return process.env.DOWNLOAD_SECRET || '';
}

// Create a time-limited HMAC token that encodes the fileName and expiry.
// The token is a hex HMAC over `${fileName}:${expires}` using DOWNLOAD_SECRET.
// The returned URL includes `expires` and `token` query parameters.
export function makeSignedDownloadUrl(fileName: string, expiresInSec = 300) {
  const DOWNLOAD_SECRET = getSecret();
  // If no secret is configured we fall back to an unsigned URL. This is
  // deliberate to make local development easy; in production set DOWNLOAD_SECRET.
  if (!DOWNLOAD_SECRET) return `/download/${encodeURIComponent(fileName)}`;
  const expires = Math.floor(Date.now() / 1000) + expiresInSec;
  const message = `${fileName}:${expires}`;
  const token = crypto.createHmac('sha256', DOWNLOAD_SECRET).update(message).digest('hex');
  return `/download/${encodeURIComponent(fileName)}?expires=${expires}&token=${token}`;
}

// Validate the provided token and expiry
export function validateDownloadToken(fileName: string, token: string | undefined, expiresStr: string | undefined) {
  const DOWNLOAD_SECRET = getSecret();
  if (!DOWNLOAD_SECRET) return false;
  if (!token || !expiresStr) return false;
  const expires = parseInt(expiresStr, 10);
  if (!expires || Math.floor(Date.now() / 1000) > expires) return false;
  const expected = crypto.createHmac('sha256', DOWNLOAD_SECRET).update(`${fileName}:${expires}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'));
  } catch (_) {
    return false;
  }
}
