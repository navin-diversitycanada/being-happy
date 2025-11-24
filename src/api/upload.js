// src/api/upload.js - Secure upload helper using Firebase ID Token
// Usage: import { uploadImageSecure } from "../api/upload";
// await uploadImageSecure(file, postId, workerUrl)
//
// workerUrl defaults to process.env.REACT_APP_UPLOAD_WORKER_URL
// Requires firebase/auth initialized and user signed in.

import { getAuth } from "firebase/auth";

export async function uploadImageSecure(file, postId = "unspecified", workerUrl) {
  if (!file) throw new Error("No file provided");
  if (!navigator.onLine) throw new Error("Online connection required to upload images.");

  workerUrl = workerUrl || process.env.REACT_APP_UPLOAD_WORKER_URL;
  if (!workerUrl) throw new Error("Missing upload worker URL (REACT_APP_UPLOAD_WORKER_URL)");

  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated. Sign in as an admin before uploading.");
  }

  let idToken;
  try {
    idToken = await user.getIdToken();
  } catch (err) {
    console.error("Failed to get ID token:", err);
    throw new Error("Failed to obtain authentication token.");
  }

  const fd = new FormData();
  fd.append("file", file);
  fd.append("postId", postId);

  const resp = await fetch(workerUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`
    },
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