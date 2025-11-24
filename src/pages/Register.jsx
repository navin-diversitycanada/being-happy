import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";

/**
 * Register component using AuthContext.register
 * - Sends verification email at registration. User must verify before being allowed to log in.
 * - UX change: the Register button keeps its label ("Register") at all times.
 *   While the request is in progress the button is disabled (no label change).
 * - All messages/errors appear below the button in salmon color.
 */
export default function Register() {
  const auth = useAuth();
  const register = auth?.register;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    if (password !== confirm) {
      setErr("Passwords do not match");
      return;
    }
    if (!register) {
      setErr("Auth not configured");
      return;
    }
    try {
      setBusy(true);
      await register(email, password, { displayName: name });
      // After successful registration, we send the verification link inside register()
      // and redirect the user to the login page with a friendly notice.
      navigate("/login", { replace: true, state: { verifySent: true } });
    } catch (error) {
      // Show friendly message returned by AuthContext.register
      setErr(error?.message || "Registration failed. Please try again.");
      console.error("Register error:", error);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    try {
      await auth.signInWithGoogle();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Google sign-in error:", err);
      setErr("Social login failed. Please try again.");
    }
  }

  async function handleFacebook() {
    try {
      await auth.signInWithFacebook();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Facebook sign-in error:", err);
      setErr("Social login failed. Please try again.");
    }
  }

  return (
    <div className="main-content">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2 className="auth-title">Register for Being Happy</h2>
        <div className="socials">
          <button
            className="social-btn"
            type="button"
            onClick={handleGoogle}
            disabled={busy}
          >
            <img src="/images/google.svg" alt="" width="18" /> Continue with Google
          </button>
          <button
            className="social-btn"
            type="button"
            onClick={handleFacebook}
            disabled={busy}
          >
            <img src="/images/facebook.svg" alt="" width="18" /> Continue with Facebook
          </button>
        </div>
        <hr className="auth-divider" />
        <input
          type="text"
          placeholder="Full Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <input
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
        <input
          type="password"
          placeholder="Confirm Password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={busy}
        />

        {/* Button label remains "Register" at all times; we only disable it while busy */}
        <button
          type="submit"
          disabled={busy}
          aria-busy={busy}
        >
          Register
        </button>

        {/* All messages/errors appear below the button in salmon color */}
        {err && <div style={{ color: "salmon", marginTop: 8 }}>{err}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Link className="link-badge" to="/login">Already have an account? Login</Link>
        </div>
      </form>
    </div>
  );
}