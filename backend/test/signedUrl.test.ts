import { makeSignedDownloadUrl, validateDownloadToken } from '../src/utils/signedUrl';

describe('signedUrl utils', () => {
  const original = process.env.DOWNLOAD_SECRET;

  afterEach(() => {
    process.env.DOWNLOAD_SECRET = original;
  });

  test('generates and validates signed url when secret set', () => {
    process.env.DOWNLOAD_SECRET = 'testsecret123';
    const url = makeSignedDownloadUrl('file.csv', 60);
    // url should contain token and expires
    expect(url).toContain('token=');
    expect(url).toContain('expires=');

    const [, query] = url.split('?');
    const params = new URLSearchParams(query);
    const token = params.get('token')!;
    const expires = params.get('expires')!;

    expect(validateDownloadToken('file.csv', token, expires)).toBe(true);
  });

  test('rejects expired token', () => {
    process.env.DOWNLOAD_SECRET = 'testsecret123';
    const expires = `${Math.floor(Date.now() / 1000) - 10}`; // in the past
    const crypto = require('crypto');
    const token = crypto.createHmac('sha256', process.env.DOWNLOAD_SECRET).update(`file.csv:${expires}`).digest('hex');
    expect(validateDownloadToken('file.csv', token, expires)).toBe(false);
  });

  test('bypasses validation when secret not set', () => {
    process.env.DOWNLOAD_SECRET = '';
    const url = makeSignedDownloadUrl('file.csv', 60);
    expect(url).toBe('/download/file.csv');
    expect(validateDownloadToken('file.csv', undefined, undefined)).toBe(true);
  });
});
