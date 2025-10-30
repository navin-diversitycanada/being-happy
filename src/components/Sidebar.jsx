import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Sidebar (updated)
 * - Shows Login when not authenticated.
 * - When authenticated: shows Account and Log out instead of Login.
 * - Shows Admin when authenticated user has role === 'admin'.
 * - Keeps other SPA links unchanged (Home => /index).
 * - Calls onClose() after navigation or logout so the menu closes.
 *
 * Paste this file to src/components/Sidebar.jsx (overwrite existing).
 */
export default function Sidebar({ open, onClose }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout(e) {
    e.preventDefault();
    try {
      await logout();
    } catch (err) {
      // still navigate to login even if logout had an issue
      console.error("Logout error:", err);
    } finally {
      onClose && onClose();
      // Send user to login (or landing) after logout
      navigate("/login", { replace: true });
    }
  }

  return (
    <aside
      id="sidemenu"
      className={`sidemenu ${open ? "open" : ""}`}
      role="dialog"
      aria-hidden={!open}
    >
      <div className="sidemenu-content">
        <button
          className="close-sidemenu"
          onClick={onClose}
          aria-label="Close menu"
        >
          &times;
        </button>
        <ul>
          <li><Link to="/" onClick={onClose}>Home</Link></li>
          <li><Link to="/meditation" onClick={onClose}>Meditation</Link></li>
          <li><Link to="/video-library" onClick={onClose}>Video Library</Link></li>
          <li><Link to="/articles" onClick={onClose}>Articles</Link></li>
          <li><Link to="/directories" onClick={onClose}>Directory</Link></li>

          {user ? (
            <>
              <li><Link to="/account" onClick={onClose}>Account</Link></li>
              {/* show Admin only for admin users */}
              {role === "admin" && (
                <li><Link to="/admin" onClick={onClose}>Admin</Link></li>
              )}
              <li>
                <button
                  className="sidemenu-cta"
                  onClick={handleLogout}
                  aria-label="Log out"
                >
                  Log out
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link className="sidemenu-cta" to="/login" onClick={onClose}>Login</Link>
              </li>
      
            </>
          )}

          {/* keep an explicit Login entry removed for logged-in users (handled above) */}
        </ul>
      </div>
    </aside>
  );
}