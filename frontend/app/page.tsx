"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
 

export default function Home() {
  const apiKey = (process.env.NEXT_PUBLIC_UPLOAD_API_KEY as string) || '';

  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const pollingRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setProgress(0);
    setStatus(null);
    setJobId(null);
    setDownloadUrl(null);
    setMetrics(null);
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  async function handleUpload(e?: React.FormEvent) {
    if (e && typeof (e as any).preventDefault === 'function') (e as React.FormEvent).preventDefault();
    if (!file) return;
    reset();

    const fd = new FormData();
    fd.append("file", file);

    try {
  const headers: Record<string, string> = { "Content-Type": "multipart/form-data" };
  if (apiKey) headers['x-api-key'] = apiKey;

      const res = await axios.post(`${API_BASE}/upload`, fd, {
        headers,
        onUploadProgress: (evt: any) => {
          const total = evt.total ?? evt.currentTarget?.total ?? evt.nativeEvent?.total;
          const loaded = evt.loaded ?? evt.currentTarget?.loaded ?? evt.nativeEvent?.loaded;
          if (total) {
            const p = Math.round((loaded / total) * 100);
            setProgress(p);
          }
        },
      });

      const { jobId, statusUrl } = res.data;
      setJobId(jobId);
      setStatus("queued");

      // Poll status until done/failed
      pollingRef.current = window.setInterval(async () => {
        try {
          const sres = await axios.get(`${API_BASE}/status/${jobId}`, { headers: apiKey ? { 'x-api-key': apiKey } : undefined });
          const st = sres.data;
          setStatus(st.status);
          if (st.status === "done") {
            // server provides downloadUrl (path) and fileName
            const maybeDownload = st.downloadUrl || (st.fileName ? `/download/${encodeURIComponent(st.fileName)}` : null);
            setMetrics(st.metrics || null);
            if (maybeDownload) {
              // If server requires API key for download (no signed token), append as query param so anchor can be used.
              const full = `${API_BASE}${maybeDownload}`;
              if (apiKey && !full.includes('token=') && !full.includes('apiKey=')) {
                const sep = full.includes('?') ? '&' : '?';
                setDownloadUrl(`${full}${sep}apiKey=${encodeURIComponent(apiKey)}`);
              } else {
                setDownloadUrl(full);
              }
            }
            if (pollingRef.current) {
              window.clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            setProgress(100);
          } else if (st.status === "failed") {
            if (pollingRef.current) {
              window.clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          }
        } catch (err) {
          // polling error - stop polling
          console.error("status poll error", err);
          if (pollingRef.current) {
            window.clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setStatus("failed");
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#3e4246ff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ width: '100%', maxWidth: 820, background: '#ffffff', padding: 28, borderRadius: 10, boxShadow: '0 6px 24px rgba(15,23,42,0.06)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: '#0f172a' }}>CSV Sales Processor</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ color: '#0f172a', fontSize: 14, fontWeight: 600 }}>{file ? `Selected: ${file.name}` : 'Browse...'}</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
            style={{ padding: 8, borderRadius: 6, border: '1px solid #D1D5DB', color: '#0f172a', background: '#ffffff' }}
          />

          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => {
                if (!file) {
                  // open file picker if no file selected
                  fileInputRef.current?.click();
                  return;
                }
                handleUpload();
              }}
              style={{ padding: '10px 16px', background: '#2563EB', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer' }}
            >
              {file ? 'Upload' : 'Choose file'}
            </button>

            <button
              type="button"
              onClick={() => {
                setFile(null);
                reset();
              }}
              style={{ padding: '10px 14px', background: '#F3F4F6', color: '#111827', borderRadius: 8, border: 'none', cursor: 'pointer' }}
            >
              Reset
            </button>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ height: 12, background: '#E6E6E6', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#10B981', width: `${progress}%`, transition: 'width 200ms' }} />
          </div>
          <div style={{ marginTop: 8, color: '#0f172a' }}>Progress: {progress}%</div>
          <div style={{ marginTop: 4, color: '#475569' }}>Status: {status ?? 'idle'}</div>
        </div>

        {metrics && (
          <div style={{ marginTop: 18, padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #eef2ff' }}>
            <h3 style={{ fontWeight: 600, color: '#0f172a' }}>Metrics</h3>
            <pre style={{ fontSize: 13, marginTop: 8, color: '#0f172a', whiteSpace: 'pre-wrap' }}>{JSON.stringify(metrics, null, 2)}</pre>
          </div>
        )}

        {downloadUrl && (
          <div style={{ marginTop: 18, display: 'flex', gap: 12 }}>
            <a
              style={{ padding: '10px 16px', background: '#059669', color: '#fff', borderRadius: 8, textDecoration: 'none' }}
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download Result
            </a>
          </div>
        )}

        {status === 'failed' && (
          <div style={{ marginTop: 12, color: '#DC2626' }}>Job failed. Check backend logs for details.</div>
        )}
      </div>
    </div>
  );
}