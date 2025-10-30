import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Header with logo behavior:
 * - Unauthenticated -> "/"
 * - Authenticated -> "/index"
 */
export default function Header({ onMenuClick }) {
  const { user } = useAuth();
  const logoTarget = user ? "/index" : "/";

  return (
    <nav className="navbar" role="banner">
      <Link to={logoTarget} className="navbar-logo">Being Happy</Link>
      <div className="navbar-actions">
        <button className="navbar-menu" id="menuBtn" aria-label="menu" onClick={onMenuClick}>
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>
  );
}