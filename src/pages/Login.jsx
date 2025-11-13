import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Login page — uses AuthContext.login
 */
export default function Login() {
  const { login, user, role, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || null;

  useEffect(() => {
    if (!loading && user && role) {
      if (from) { navigate(from, { replace: true }); return; }
      if (role === "admin") { navigate("/admin", { replace: true }); return; }
      navigate("/index", { replace: true });
    }
  }, [user, role, loading, from, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      await login(email, password);
    } catch (error) {
      setErr(error.message || "Login failed");
    }
  }

  return (
    <div className="main-content">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2 className="auth-title">Login to Being Happy</h2>

        <div className="socials">
          <button className="social-btn" type="button"><img src="/images/google.svg" alt="" width="18" /> Continue with Google</button>
          <button className="social-btn" type="button"><img src="/images/facebook.svg" alt="" width="18" /> Continue with Facebook</button>
          <button className="social-btn" type="button"><img src="/images/apple.svg" alt="" width="18" /> Continue with Apple</button>
        </div>

        <hr className="auth-divider" />
        <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Login</button>

        {err && <div style={{ color: "salmon", marginTop: 8 }}>{err}</div>}
        <div className="switch">Don't have an account? <Link to="/register">Register</Link></div>
      </form>
    </div>
  );
}