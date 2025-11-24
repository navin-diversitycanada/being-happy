import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Login page — uses AuthContext.login and social sign-ins exposed by AuthContext.
 * If an account is disabled, AuthContext.disabledMessage will contain the message.
 * If the user has just registered, we show a verification-sent message.
 */
export default function Login() {
  const { login, signInWithGoogle, signInWithFacebook, user, role, loading, disabledMessage, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || null;
  const resetSuccess = location.state?.resetSuccess || false;
  const verifySent = location.state?.verifySent || false;

  useEffect(() => {
    if (resetSuccess) {
      setErr("Password updated — please log in with your new password.");
    }
  }, [resetSuccess]);

  useEffect(() => {
    if (verifySent) {
      setErr("Verification email sent — check your inbox and follow the link to complete registration.");
    }
  }, [verifySent]);

  useEffect(() => {
    if (!loading && user && role) {
      if (from) { navigate(from, { replace: true }); return; }
      if (role === "admin") { navigate("/admin", { replace: true }); return; }
      navigate("/index", { replace: true });
    }
  }, [user, role, loading, from, navigate]);

  useEffect(() => {
    // If AuthContext has disabledMessage (set when a disabled or unverified user attempted to sign in),
    // show it to the user in the form area.
    if (disabledMessage) {
      setErr(disabledMessage);
    }
  }, [disabledMessage]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      const cred = await login(email, password);
      // If the email/password account isn't verified, ensure we do not leave them signed in.
      if (cred && cred.user && !cred.user.emailVerified) {
        // Sign out and show explicit message
        try { await logout(); } catch (err) { /* ignore */ }
        setErr("Verify to login — check your email for the verification link.");
        return;
      }
      // Otherwise the onAuthStateChanged handler will redirect when user state is ready.
    } catch (error) {
      setErr("Error logging in. Please check your credentials.");
      console.error("Login error:", error);
    }
  }

  async function handleGoogle() {
    setErr("");
    try {
      await signInWithGoogle();
    } catch (err) {
      if (err && err.message && err.message.toLowerCase().includes("disabled")) {
        setErr("Your account is disabled");
      } else {
        setErr("Social login failed. Please try again.");
      }
      console.error("Google sign-in error:", err);
    }
  }

  async function handleFacebook() {
    setErr("");
    try {
      await signInWithFacebook();
    } catch (err) {
      if (err && err.message && err.message.toLowerCase().includes("disabled")) {
        setErr("Your account is disabled");
      } else {
        setErr("Social login failed. Please try again.");
      }
      console.error("Facebook sign-in error:", err);
    }
  }

  return (
    <div className="main-content">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2 className="auth-title">Login to Being Happy</h2>

        <div className="socials">
          <button className="social-btn" type="button" onClick={handleGoogle}><img src="/images/google.svg" alt="" width="18" /> Continue with Google</button>
          <button className="social-btn" type="button" onClick={handleFacebook}><img src="/images/facebook.svg" alt="" width="18" /> Continue with Facebook</button>
        </div>

        <hr className="auth-divider" />
        <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Login</button>

        {err && <div style={{ color: "salmon", marginTop: 8 }}>{err}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
          <Link className="link-badge" to="/register">Register</Link>
          <Link className="link-badge" to="/reset-password">Forgot password?</Link>
        </div>

      </form>
    </div>
  );
}