import React from "react";
import { Link } from "react-router-dom";
import { articles } from "../data/mockData";

/**
 * Articles page (copy of articles.html) converted to JSX.
 * Place as src/pages/Articles.jsx
 */

export default function Articles() {
  // Split articles into example subcategories for demo
  const howto = articles.filter(a => (a.categories || []).includes("How-to"));
  const research = articles.filter(a => (a.categories || []).includes("Research"));

  function renderCarousel(items, carouselId) {
    return (
      <div className="carousel-section">
        <div className="carousel-header">
          <span className="carousel-title">{carouselId === "howto" ? "How-to" : "Research"}</span>
          <div className="carousel-controls">
            <button className="carousel-btn" data-carousel={`articles-${carouselId}`} data-dir="left">&#8592;</button>
            <button className="carousel-btn" data-carousel={`articles-${carouselId}`} data-dir="right">&#8594;</button>
            <Link className="see-all-link" to={`/articles-${carouselId}`}>See All</Link>
          </div>
        </div>
        <div className="carousel-viewport">
          <div className="carousel" data-carousel={`articles-${carouselId}`}>
            {items.map(item => (
              <Link key={item.id} className="card" to={`/article/${item.id}`}>
                <img className="card-img" src={item.img} alt={item.title} />
                <div className="card-content">
                  <div className="card-title">{item.title}</div>
                  <div className="card-meta">Article</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="promo-box">
        <span className="promo-icon big" aria-hidden="false" role="img" title="Articles icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="6" y="4" width="12" height="14" rx="1.5" fill="white" opacity="0.06"/>
            <rect x="4" y="7" width="12" height="14" rx="1.5" fill="white" opacity="0.04"/>
            <path d="M8 9h8M8 12h8M8 15h5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
        <div className="promo-text">
          <div className="greeting">Articles</div>
        </div>
      </div>

      {renderCarousel(howto, "howto")}
      {renderCarousel(research, "research")}
    </div>
  );
}