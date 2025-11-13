import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Header with logo behavior:
 * - Unauthenticated -> "/"
 * - Authenticated -> "/index"
 *
 * Clicking the logo uses navigate to avoid sending authenticated admins to the Landing
 * component which auto-redirects to /admin. We explicitly send authenticated users to /index.
 */
export default function Header({ onMenuClick }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  function handleLogoClick(e) {
    e.preventDefault();
    if (user) {
      navigate("/Index".toLowerCase()); // go to /index for authenticated users
    } else {
      navigate("/");
    }
  }

  return (
    <nav className="navbar" role="banner">
      <a href={user ? "/index" : "/"} className="navbar-logo" onClick={handleLogoClick}>
        Being Happy
      </a>
      <div className="navbar-actions">
        <button className="navbar-menu" id="menuBtn" aria-label="menu" onClick={onMenuClick}>
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>
  );
}