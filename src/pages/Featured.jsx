import React from "react";
import { Link } from "react-router-dom";
import { featured, findArticle, findAudio, findVideo, findDirectory } from "../data/mockData";

/**
 * Featured page converted to JSX.
 * Place as src/pages/Featured.jsx
 * It resolves items by type and id to create the featured grid.
 */

function resolve(item) {
  if (item.type === "article") return { ...findArticle(item.id), route: `/article/${item.id}`, label: "Article" };
  if (item.type === "audio") return { ...findAudio(item.id), route: `/audio/${item.id}`, label: "Audio" };
  if (item.type === "video") return { ...findVideo(item.id), route: `/video/${item.id}`, label: "Video" };
  if (item.type === "directory") return { ...findDirectory(item.id), route: `/directory/${item.id}`, label: "Directory" };
  return null;
}

export default function Featured() {
  const resolved = featured.map(resolve).filter(Boolean);

  return (
    <div className="main-content">
      <div className="promo-box">
        <span className="promo-icon big" aria-hidden="false" role="img" title="Featured">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 17.3l6.18 3.86-1.64-7.03L21 9.24l-7.19-.62L12 2 10.19 8.62 3 9.24l4.46 4.89L5.82 21.16 12 17.3z" fill="white" opacity="0.95"/>
          </svg>
        </span>
        <div className="promo-text">
          <div className="greeting">Featured</div>
          <div className="promo-description">Hand-picked highlights</div>
        </div>
      </div>

      <div className="carousel-section">
        <div className="carousel-header">
          <span className="carousel-title">Featured — All</span>
        </div>
        <div className="carousel-viewport">
          <div className="flex-card-grid" role="list">
            {resolved.map((it, idx) => (
              <Link key={idx} className="card" to={it.route}>
                <img className="card-img" src={it.img || "/images/placeholder.png"} alt={it.title || "Featured"} />
                <div className="card-content">
                  <div className="card-title">{it.title}</div>
                  <div className="card-meta">{it.type ? it.type.charAt(0).toUpperCase() + it.type.slice(1) : "Item"} • Featured</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}