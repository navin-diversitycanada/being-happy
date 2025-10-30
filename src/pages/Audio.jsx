import React from "react";
import { useParams, Link } from "react-router-dom";
import { findAudio } from "../data/mockData";

/**
 * Audio detail page (src/pages/Audio.jsx)
 * Route: /audio/:id
 */

export default function Audio() {
  const { id } = useParams();
  const audio = findAudio(id);

  if (!audio) {
    return (
      <div className="main-content">
        <div className="notfound">
          <div className="nf-card">
            <h2>Audio not found</h2>
            <Link to="/meditation" className="see-all-link">Back to Meditation</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="detail-card">
        <img className="detail-img" src={audio.img} alt={audio.title} />
        <div className="detail-title">{audio.title}</div>
        <div className="detail-categories">
          <span className="detail-category-box">Meditation</span>
          <span className="detail-category-box">Audio</span>
        </div>

        <div style={{ marginTop: 12, marginBottom: 14 }}>
          <button className="account-action-btn" aria-pressed="false">Add to Favorites</button>
        </div>

        <div className="detail-description">{audio.desc}</div>

        {/* No real audio player provided in mock data; embed placeholder or YouTube if available */}
        {/* Example: if audio.embed contained a URL, you could render an <audio> or iframe here */}
      </div>
    </div>
  );
}