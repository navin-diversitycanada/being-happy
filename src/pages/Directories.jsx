import React from "react";
import { Link } from "react-router-dom";
import { directories } from "../data/mockData";

/**
 * Directories page converted to JSX.
 * Place as src/pages/Directories.jsx
 */

export default function Directories() {
  return (
    <div className="main-content">
      <div className="promo-box">
        <span className="promo-icon" aria-hidden="false" role="img" title="Directory icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 2C8.686 2 6 4.686 6 8c0 4.418 6 12 6 12s6-7.582 6-12c0-3.314-2.686-6-6-6z" fill="white" opacity="0.95"/>
            <circle cx="12" cy="8" r="2" fill="var(--purple)" />
          </svg>
        </span>
        <div className="promo-text">
          <div className="greeting">Directories</div>
          <div className="promo-description">Recommended apps, centers and groups</div>
        </div>
      </div>

      {/* Free Apps (carousel) */}
      <div className="carousel-section">
        <div className="carousel-header">
          <span className="carousel-title">Recommended</span>
          <div className="carousel-controls">
            <button className="carousel-btn" data-carousel="dirs-reco" data-dir="left">&#8592;</button>
            <button className="carousel-btn" data-carousel="dirs-reco" data-dir="right">&#8594;</button>
            <Link className="see-all-link" to="/directories">See All</Link>
          </div>
        </div>
        <div className="carousel-viewport">
          <div className="carousel carousel-directory" data-carousel="dirs-reco">
            {directories.map(d => (
              <Link key={d.id} className="card directory-card" to={`/directory/${d.id}`}>
                <div className="directory-content">
                  <div className="directory-title">{d.title}</div>
                  <div className="directory-meta">{(d.tags || []).join(" • ")}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}