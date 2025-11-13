import React, { useRef, useState } from "react";
import { uploadImage } from "../../api/upload";

/**
 * ImageUploader component
 * Props:
 * - workerUrl (string) required
 * - postId (string) optional
 * - uploadKey (string) optional - recommended to pass explicitly (do NOT embed in public builds)
 * - onUploaded(result) optional callback
 * - maxFileSize (number) default 6 MiB
 */
export default function ImageUploader({
  workerUrl,
  postId = "unspecified",
  uploadKey = null,
  onUploaded,
  maxFileSize = 6 * 1024 * 1024
}) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(e) {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > maxFileSize) {
      setError(`File too large. Max ${Math.round(maxFileSize / 1024 / 1024)} MB.`);
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    } catch (err) { /* ignore preview errors */ }

    setUploading(true);
    try {
      // Pass uploadKey explicitly if provided, otherwise uploadImage will read from env (for testing)
      const res = await uploadImage(file, postId, workerUrl, uploadKey);
      setUploading(false);
      if (onUploaded) onUploaded(res);
    } catch (err) {
      setUploading(false);
      setError(err.message || "Upload failed");
    }
  }

  return (
    <div>
      <label className="form-label">Image (upload)</label>
      <input type="file" accept="image/*" ref={fileRef} onChange={handleChange} />
      {uploading && <div style={{ marginTop: 8 }}>Uploading…</div>}
      {error && <div style={{ color: "salmon", marginTop: 8 }}>{error}</div>}
      {preview && <div style={{ marginTop: 12 }}><img src={preview} alt="Preview" style={{ maxWidth: 360, borderRadius: 6 }} /></div>}
    </div>
  );
}