// src/api/upload.js - PUBLIC upload helper (no auth required)
// Usage: import { uploadImage } from "../api/upload";
// await uploadImage(file, postId, workerUrl)
//
// workerUrl defaults to process.env.REACT_APP_UPLOAD_WORKER_URL

export async function uploadImage(file, postId = "unspecified", workerUrl) {
  if (!file) throw new Error("No file provided");

  workerUrl = workerUrl || process.env.REACT_APP_UPLOAD_WORKER_URL;
  if (!workerUrl) throw new Error("Missing upload worker URL (REACT_APP_UPLOAD_WORKER_URL)");

  const fd = new FormData();
  fd.append("file", file);
  fd.append("postId", postId);

  const resp = await fetch(workerUrl, {
    method: "POST",
    // No Authorization or custom headers required
    body: fd
  });

  if (!resp.ok) {
    let body = null;
    try { body = await resp.json(); } catch (e) {}
    const msg = (body && (body.error || body.message)) ? (body.error || body.message) : `Upload failed: ${resp.status} ${resp.statusText}`;
    throw new Error(msg);
  }
  return resp.json();
}