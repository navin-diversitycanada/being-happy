import React from "react";
import { Link } from "react-router-dom";
import { audios } from "../data/mockData";

/**
 * Meditation page converted to JSX.
 * Place as src/pages/Meditation.jsx
 */

export default function Meditation() {
  return (
    <div className="main-content">
      <div className="promo-box">
        <span className="promo-icon big" aria-hidden="false" role="img" title="Meditation audio icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M3 13v-1a9 9 0 0 1 18 0v1" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.95"/>
            <rect x="2" y="13" width="4" height="6" rx="1.5" fill="white" opacity="0.06"/>
            <rect x="18" y="13" width="4" height="6" rx="1.5" fill="white" opacity="0.06"/>
          </svg>
        </span>
        <div className="promo-text">
          <div className="greeting">Meditation</div>
        </div>
      </div>

      <div className="carousel-section">
        <div className="carousel-header">
          <span className="carousel-title">Audio</span>
          <div className="carousel-controls">
            <button className="carousel-btn" data-carousel="meditation-audio" data-dir="left">&#8592;</button>
            <button className="carousel-btn" data-carousel="meditation-audio" data-dir="right">&#8594;</button>
            <Link className="see-all-link" to="/meditation">See All</Link>
          </div>
        </div>
        <div className="carousel-viewport">
          <div className="carousel" data-carousel="meditation-audio">
            {audios.map(a => (
              <Link key={a.id} className="card" to={`/audio/${a.id}`}>
                <img className="card-img" src={a.img} alt={a.title} />
                <div className="card-content">
                  <div className="card-title">{a.title}</div>
                  <div className="card-meta">Audio • {a.length || ""}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}