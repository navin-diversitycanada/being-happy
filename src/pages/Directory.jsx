import React from "react";
import { useParams, Link } from "react-router-dom";
import { findDirectory } from "../data/mockData";

/**
 * Directory detail page (src/pages/Directory.jsx)
 * Route: /directory/:id
 */

export default function Directory() {
  const { id } = useParams();
  const dir = findDirectory(id);

  if (!dir) {
    return (
      <div className="main-content">
        <div className="notfound">
          <div className="nf-card">
            <h2>Directory item not found</h2>
            <Link to="/directories" className="see-all-link">Back to Directories</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="detail-card">
        <div className="detail-title">{dir.title}</div>
        <div className="detail-categories">
          {(dir.tags || []).map(t => <span key={t} className="detail-category-box">{t}</span>)}
        </div>

        <div style={{ marginTop: 12, marginBottom: 14 }}>
          <button className="account-action-btn" aria-pressed="false">Add to Favorites</button>
        </div>

        <div className="detail-description"><strong>Description:</strong> {dir.desc}</div>
        <div className="detail-description"><strong>Website/App Link:</strong> <a href={dir.link} target="_blank" rel="noreferrer" style={{ color: "var(--cream)", textDecoration: "underline" }}>{dir.link}</a></div>
      </div>
    </div>
  );
}