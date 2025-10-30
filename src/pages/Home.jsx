import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Home page converted from index.html
 * - Displays user's name in the greeting (first letter capitalized).
 * - Contains the promo and carousel markup. The existing script.js (copied to public/script.js)
 *   will still run and power carousels/sidemenu.
 */

function capitalizeName(raw = "") {
  if (!raw) return "";
  // Split into words, uppercase first letter of each, lowercase the rest
  return raw
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

export default function Home() {
  const auth = useAuth();
  const rawName =
    auth?.user?.displayName ||
    (auth?.user?.email ? auth.user.email.split("@")[0] : "") ||
    "";
  const displayName = capitalizeName(rawName);

  return (
    <div>
      <div className="main-content">
        <div className="promo-box" id="promoBox">
          <span className="promo-icon">
            <svg width="28" height="28" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="11" />
              <line x1="14" y1="8" x2="14" y2="14" />
              <line x1="14" y1="14" x2="18" y2="16" />
            </svg>
          </span>
          <span className="promo-text">
            <div className="greeting">
              {displayName ? `Welcome, ${displayName}` : "Welcome"}
            </div>
          </span>
        </div>

        {/* Featured Section */}
        <div className="carousel-section">
          <div className="carousel-header">
            <span className="carousel-title">Featured</span>
            <div className="carousel-controls">
              <button className="carousel-btn" data-carousel="featured" data-dir="left">&#8592;</button>
              <button className="carousel-btn" data-carousel="featured" data-dir="right">&#8594;</button>
              <Link className="see-all-link" to="/featured">See All</Link>
            </div>
          </div>
          <div className="carousel-viewport">
            <div className="carousel" data-carousel="featured">
              <Link className="card" to="/meditation">
                <img className="card-img" src="/images/2.jpg" alt="Mindful Breathing" />
                <div className="card-content">
                  <div className="card-title">Mindful Breathing</div>
                  <div className="card-meta">Audio</div>
                </div>
              </Link>

              <Link className="card" to="/video-library">
                <img className="card-img" src="/images/4.jpg" alt="Joyful Moments" />
                <div className="card-content">
                  <div className="card-title">Joyful Moments</div>
                  <div className="card-meta">Video</div>
                </div>
              </Link>

              <Link className="card" to="/articles">
                <img className="card-img" src="/images/1.jpg" alt="Building Resilience" />
                <div className="card-content">
                  <div className="card-title">Building Resilience</div>
                  <div className="card-meta">Article</div>
                </div>
              </Link>

              <Link className="card" to="/meditation">
                <img className="card-img" src="/images/6.jpg" alt="Stress Relief" />
                <div className="card-content">
                  <div className="card-title">Stress Relief</div>
                  <div className="card-meta">Audio</div>
                </div>
              </Link>

              <Link className="card" to="/articles">
                <img className="card-img" src="/images/3.jpg" alt="Overcoming Stress" />
                <div className="card-content">
                  <div className="card-title">Overcoming Stress</div>
                  <div className="card-meta">Article</div>
                </div>
              </Link>

              <Link className="card" to="/video-library">
                <img className="card-img" src="/images/5.jpg" alt="Introduction to Mindfulness" />
                <div className="card-content">
                  <div className="card-title">Introduction to Mindfulness</div>
                  <div className="card-meta">Video</div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Meditation Section */}
        <div className="carousel-section">
          <div className="carousel-header">
            <span className="carousel-title">Meditation</span>
            <div className="carousel-controls">
              <button className="carousel-btn" data-carousel="meditation" data-dir="left">&#8592;</button>
              <button className="carousel-btn" data-carousel="meditation" data-dir="right">&#8594;</button>
              <Link className="see-all-link" to="/meditation">See All</Link>
            </div>
          </div>
          <div className="carousel-viewport">
            <div className="carousel" data-carousel="meditation">
              <Link className="card" to="/meditation"><img className="card-img" src="/images/1.jpg" alt="5 Steps to Happiness" /><div className="card-content"><div className="card-title">5 Steps to Happiness</div><div className="card-meta">Audio</div></div></Link>
              <Link className="card" to="/meditation"><img className="card-img" src="/images/2.jpg" alt="Mindful Breathing" /><div className="card-content"><div className="card-title">Mindful Breathing</div><div className="card-meta">Audio</div></div></Link>
              <Link className="card" to="/meditation"><img className="card-img" src="/images/3.jpg" alt="Evening Calm" /><div className="card-content"><div className="card-title">Evening Calm</div><div className="card-meta">Audio</div></div></Link>
              <Link className="card" to="/meditation"><img className="card-img" src="/images/4.jpg" alt="Body Scan" /><div className="card-content"><div className="card-title">Body Scan</div><div className="card-meta">Audio</div></div></Link>
            </div>
          </div>
        </div>

        {/* Video Library, Articles, Directories sections similar... */}
        <div className="carousel-section">
          <div className="carousel-header">
            <span className="carousel-title">Video Library</span>
            <div className="carousel-controls">
              <button className="carousel-btn" data-carousel="video-library" data-dir="left">&#8592;</button>
              <button className="carousel-btn" data-carousel="video-library" data-dir="right">&#8594;</button>
              <Link className="see-all-link" to="/video-library">See All</Link>
            </div>
          </div>
          <div className="carousel-viewport">
            <div className="carousel" data-carousel="video-library">
              <Link className="card" to="/video-library"><img className="card-img" src="/images/5.jpg" alt="Introduction to Mindfulness" /><div className="card-content"><div className="card-title">Introduction to Mindfulness</div><div className="card-meta">Video</div></div></Link>
              <Link className="card" to="/video-library"><img className="card-img" src="/images/6.jpg" alt="Gratitude Practice" /><div className="card-content"><div className="card-title">Gratitude Practice</div><div className="card-meta">Video</div></div></Link>
            </div>
          </div>
        </div>

        <div className="carousel-section">
          <div className="carousel-header">
            <span className="carousel-title">Articles</span>
            <div className="carousel-controls">
              <button className="carousel-btn" data-carousel="articles" data-dir="left">&#8592;</button>
              <button className="carousel-btn" data-carousel="articles" data-dir="right">&#8594;</button>
              <Link className="see-all-link" to="/articles">See All</Link>
            </div>
          </div>
          <div className="carousel-viewport">
            <div className="carousel" data-carousel="articles">
              <Link className="card" to="/articles"><img className="card-img" src="/images/4.jpg" alt="Benefits of Meditation" /><div className="card-content"><div className="card-title">Benefits of Meditation</div><div className="card-meta">Article</div></div></Link>
              <Link className="card" to="/articles"><img className="card-img" src="/images/5.jpg" alt="Understanding Mindfulness" /><div className="card-content"><div className="card-title">Understanding Mindfulness</div><div className="card-meta">Article</div></div></Link>
            </div>
          </div>
        </div>

        <div className="carousel-section">
          <div className="carousel-header">
            <span className="carousel-title">Directories</span>
            <div className="carousel-controls">
              <button className="carousel-btn" data-carousel="directory" data-dir="left">&#8592;</button>
              <button className="carousel-btn" data-carousel="directory" data-dir="right">&#8594;</button>
              <Link className="see-all-link" to="/directories">See All</Link>
            </div>
          </div>
          <div className="carousel-viewport">
            <div className="carousel carousel-directory" data-carousel="directory">
              <Link className="card directory-card" to="/directories"><div className="directory-content"><div className="directory-title">Free Apps</div><div className="directory-meta">Find free apps</div></div></Link>
              <Link className="card directory-card" to="/directories"><div className="directory-content"><div className="directory-title">Paid Apps</div><div className="directory-meta">Find paid apps</div></div></Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}