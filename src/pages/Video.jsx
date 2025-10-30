import React from "react";
import { useParams, Link } from "react-router-dom";
import { findVideo } from "../data/mockData";

/**
 * Video detail page (src/pages/Video.jsx)
 * Route: /video/:id
 */

export default function Video() {
  const { id } = useParams();
  const video = findVideo(id);

  if (!video) {
    return (
      <div className="main-content">
        <div className="notfound">
          <div className="nf-card">
            <h2>Video not found</h2>
            <Link to="/video-library" className="see-all-link">Back to Video Library</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="detail-card">
        <img className="detail-img" src={video.img} alt={video.title} />
        <div className="detail-title">{video.title}</div>
        <div className="detail-categories">
          <span className="detail-category-box">Video</span>
        </div>

        <div style={{ marginTop: 12, marginBottom: 14 }}>
          <button className="account-action-btn" aria-pressed="false">Add to Favorites</button>
        </div>

        <div className="detail-description">{video.desc}</div>

        <div className="detail-youtube">
          <iframe src={`https://www.youtube.com/embed/${video.youtube}`} title={video.title} frameBorder="0" allowFullScreen></iframe>
        </div>
      </div>
    </div>
  );
}