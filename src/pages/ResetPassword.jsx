// src/pages/ResetPassword.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * ResetPassword page
 * - If no oobCode query param: shows a simple form to enter email to receive a reset email.
 * - If oobCode is present: shows new password & confirm form and attempts confirmPasswordReset.
 *
 * This page is styled to match the login form layout (uses .auth-form).
 */

export default function ResetPassword() {
  const { requestPasswordReset, confirmPasswordReset } = useAuth();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode");
  const [email, setEmail] = useState("");
  const [sentMsg, setSentMsg] = useState("");
  const [error, setError] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setSentMsg("");
    setError("");
  }, [oobCode]);

  async function handleSendReset(e) {
    e?.preventDefault?.();
    setError("");
    setSentMsg("");
    if (!email) { setError("Enter your email."); return; }
    try {
      setBusy(true);
      await requestPasswordReset(email);
      setSentMsg("Password reset email sent. Check your inbox.");
    } catch (err) {
      setError(err?.message || "Failed to send reset email.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(e) {
    e?.preventDefault?.();
    setError("");
    if (!newPass || !confirmPass) { setError("Enter and confirm your new password."); return; }
    if (newPass !== confirmPass) { setError("Passwords do not match."); return; }
    try {
      setBusy(true);
      await confirmPasswordReset(oobCode, newPass);
      // navigate to login with success message
      navigate("/login", { replace: true, state: { resetSuccess: true } });
    } catch (err) {
      setError(err?.message || "Failed to set new password.");
    } finally {
      setBusy(false);
    }
  }

  // If oobCode present -> confirm new password view
  if (oobCode) {
    return (
      <div className="main-content">
        <form className="auth-form" onSubmit={handleConfirm}>
          <h2 className="auth-title">Set new password</h2>
          <input type="password" placeholder="New password" required value={newPass} onChange={(e) => setNewPass(e.target.value)} />
          <input type="password" placeholder="Confirm new password" required value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} />
          <button type="submit" disabled={busy}>{busy ? "Setting…" : "Set new password"}</button>
          {error && <div style={{ color: "salmon", marginTop: 8 }}>{error}</div>}
          <div style={{ marginTop: 12 }}>
            <Link className="link-badge" to="/login">Back to Login</Link>
            <span style={{ marginLeft: 8 }} />
            <Link className="link-badge" to="/register">Register</Link>
          </div>
        </form>
      </div>
    );
  }

  // No oobCode -> send reset email view
  return (
    <div className="main-content">
      <form className="auth-form" onSubmit={handleSendReset}>
        <h2 className="auth-title">Reset your password</h2>
        <p style={{ marginBottom: 12 }} className="muted">Enter the email for your account and we'll send a password reset link.</p>
        <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset email"}</button>
        {sentMsg && <div style={{ color: "#4BB543", marginTop: 8 }}>{sentMsg}</div>}
        {error && <div style={{ color: "salmon", marginTop: 8 }}>{error}</div>}
        <div className="switch" style={{ marginTop: 12 }}>
          <Link className="link-badge" to="/login">Back to Login</Link>
          <span style={{ marginLeft: 8 }} />
          <Link className="link-badge" to="/register">Register</Link>
        </div>
      </form>
    </div>
  );
}