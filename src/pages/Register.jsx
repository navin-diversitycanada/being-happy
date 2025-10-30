import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";

/**
 * Register component using AuthContext.register
 * - On success, it navigates to home (/) — AuthContext creates users/{uid} with role:'user'
 * - Copy to src/pages/Register.jsx
 */

export default function Register() {
  let auth;
  try { auth = useAuth(); } catch (e) { auth = null; }

  const register = auth?.register;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
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
      await register(email, password, { displayName: name });
      navigate("/", { replace: true });
    } catch (error) {
      setErr(error.message || "Registration failed");
    }
  }

  return (
    <div className="main-content">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2 className="auth-title">Register for Being Happy</h2>
        <div className="socials">
          <button className="social-btn" type="button"><img src="/images/google.svg" alt="" width="18" /> Continue with Google</button>
          <button className="social-btn" type="button"><img src="/images/facebook.svg" alt="" width="18" /> Continue with Facebook</button>
          <button className="social-btn" type="button"><img src="/images/apple.svg" alt="" width="18" /> Continue with Apple</button>
        </div>
        <hr className="auth-divider" />
        <input type="text" placeholder="Full Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <input type="password" placeholder="Confirm Password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button type="submit">Register</button>
        {err && <div style={{ color: "salmon", marginTop: 8 }}>{err}</div>}
        <div className="switch">Already have an account? <Link to="/login">Login</Link></div>
      </form>
    </div>
  );
}