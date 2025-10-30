import React from "react";
import { Link } from "react-router-dom";
import { videos } from "../data/mockData";

/**
 * Video Library page converted to JSX.
 * Place as src/pages/VideoLibrary.jsx
 */

export default function VideoLibrary() {
  return (
    <div className="main-content">
      <div className="promo-box">
        <span className="promo-icon big" aria-hidden="false" role="img" title="Video icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="2" fill="white" opacity="0.06"/>
            <path d="M10 8l6 4-6 4V8z" fill="white" opacity="0.95"/>
          </svg>
        </span>
        <div className="promo-text">
          <div className="greeting">Video Library</div>
        </div>
      </div>

      <div className="carousel-section">
        <div className="carousel-header">
          <span className="carousel-title">Short Clips</span>
          <div className="carousel-controls">
            <button className="carousel-btn" data-carousel="videos-short" data-dir="left">&#8592;</button>
            <button className="carousel-btn" data-carousel="videos-short" data-dir="right">&#8594;</button>
            <Link className="see-all-link" to="/video-library">See All</Link>
          </div>
        </div>
        <div className="carousel-viewport">
          <div className="carousel" data-carousel="videos-short">
            {videos.map(v => (
              <Link key={v.id} className="card" to={`/video/${v.id}`}>
                <img className="card-img" src={v.img} alt={v.title} />
                <div className="card-content">
                  <div className="card-title">{v.title}</div>
                  <div className="card-meta">Video</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}