// src/pages/Home.jsx
// Modified: reordered carousel-controls so arrow buttons appear before the "See All" link
// (See All should be on the right, arrows on the left within controls).
// Also minor tidy-up of Featured controls order.

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { listByType, listFeatured } from "../api/posts";
import { listCategories } from "../api/categories";
import { getVisibleCountForViewport } from "../utils/carouselHelpers";

/**
 * Home — shows Featured and four type sections (Articles, Meditation, Video Library, Directories)
 * - Each section fetches up to 20 items.
 * - Home featured excludes directories and only shows mixed-type featured for home.
 * - Type sections display only items of their type (featured items excluded).
 */

function capitalizeName(raw = "") {
  if (!raw) return "";
  return raw.split(" ").map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : "")).join(" ");
}

export default function Home() {
  const auth = useAuth();
  const rawName = auth?.user?.displayName || (auth?.user?.email ? auth.user.email.split("@")[0] : "") || "";
  const displayName = capitalizeName(rawName);

  const [featured, setFeatured] = useState([]);
  const [articles, setArticles] = useState([]);
  const [audios, setAudios] = useState([]);
  const [videos, setVideos] = useState([]);
  const [directories, setDirectories] = useState([]);
  const [catsMap, setCatsMap] = useState({});

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadAll() {
      setLoading(true);
      try {
        const cats = await listCategories().catch(() => []);
        const map = {};
        (cats || []).forEach(c => { map[c.id] = c.name; });
        if (!mounted) return;
        setCatsMap(map);

        // Fetch featured first (50) then derive per-type featured slices
        const feats = await listFeatured(50).catch(() => []);
        // Home: exclude directories from home featured
        const featsHome = (feats || []).filter(f => (f.type || "").toLowerCase() !== "directory");
        const featIds = new Set((featsHome || []).map(f => f.id));
        setFeatured(featsHome.slice(0, 8));

        // Fetch each type up to 20 and remove featured items from types
        const [arts, vids, auds, dirs] = await Promise.all([
          listByType("article", 20).catch(() => []),
          listByType("video", 20).catch(() => []),
          listByType("audio", 20).catch(() => []),
          listByType("directory", 20).catch(() => [])
        ]);

        if (!mounted) return;
        setArticles((arts || []).filter(a => !featIds.has(a.id)));
        setVideos((vids || []).filter(v => !featIds.has(v.id)));
        setAudios((auds || []).filter(a => !featIds.has(a.id)));
        setDirectories((dirs || []).filter(d => !featIds.has(d.id)));
      } catch (err) {
        console.error("Failed to load home content", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAll();
    return () => { mounted = false; };
  }, []);

  const visibleCount = getVisibleCountForViewport();

  function renderCard(item) {
    const url = item.type === "article" ? `/article/${item.id}` : item.type === "audio" ? `/audio/${item.id}` : item.type === "video" ? `/video/${item.id}` : `/directory/${item.id}`;
    const meta = item.type === "article" ? "Article" : item.type === "audio" ? "Audio" : item.type === "video" ? "Video" : "Directory";
    return (
      <Link key={item.id} className="card" to={url}>
        <img className="card-img" src={item.thumbnailUrl || item.imageUrl || "/images/placeholder.png"} alt={item.title} />
        <div className="card-content">
          <div className="card-title">{item.title}</div>
          <div className="card-meta">{meta}</div>
        </div>
      </Link>
    );
  }

  return (
    <div>
      <div className="main-content">
        <div className="promo-box" id="promoBox">
          <span className="promo-icon" />
          <span className="promo-text">
            <div className="greeting">{displayName ? `Welcome, ${displayName}` : "Welcome"}</div>
            <div className="promo-description">Explore the latest articles, meditations, videos and recommended resources.</div>
          </span>
        </div>

        {/* Featured */}
        <section className="carousel-section">
          <div className="carousel-header">
            <span className="carousel-title">Featured</span>
            <div className="carousel-controls">
              {featured.length > visibleCount && (
                <>
                  <button className="carousel-btn" data-carousel="home-featured" data-dir="left">&#8592;</button>
                  <button className="carousel-btn" data-carousel="home-featured" data-dir="right">&#8594;</button>
                </>
              )}
              <Link className="see-all-link" to="/featured">See All</Link>
            </div>
          </div>
          <div className="carousel-viewport">
            <div className="carousel" data-carousel="home-featured">
              {loading && <div style={{ padding: 12 }}>Loading…</div>}
              {!loading && (featured.length === 0 ? <div style={{ padding: 12 }}>No featured items yet.</div> : featured.map(it => renderCard(it)))}
            </div>
          </div>
        </section>

        {/* Articles */}
        <section className="carousel-section">
          <div className="carousel-header">
            <span className="carousel-title">Articles</span>
            <div className="carousel-controls">
              {articles.length > visibleCount && (
                <>
                  <button className="carousel-btn" data-carousel="home-articles" data-dir="left">&#8592;</button>
                  <button className="carousel-btn" data-carousel="home-articles" data-dir="right">&#8594;</button>
                </>
              )}
              <Link className="see-all-link" to="/articles">See All</Link>
            </div>
          </div>
          <div className="carousel-viewport"><div className="carousel" data-carousel="home-articles">{loading && <div style={{ padding: 12 }}>Loading…</div>}{!loading && (articles.length === 0 ? <div style={{ padding: 12 }}>No articles yet.</div> : articles.map(a => renderCard(a)))}</div></div>
        </section>

        {/* Meditation */}
        <section className="carousel-section">
          <div className="carousel-header">
            <span className="carousel-title">Meditation</span>
            <div className="carousel-controls">
              {audios.length > visibleCount && (
                <>
                  <button className="carousel-btn" data-carousel="home-audios" data-dir="left">&#8592;</button>
                  <button className="carousel-btn" data-carousel="home-audios" data-dir="right">&#8594;</button>
                </>
              )}
              <Link className="see-all-link" to="/meditation">See All</Link>
            </div>
          </div>
          <div className="carousel-viewport"><div className="carousel" data-carousel="home-audios">{loading && <div style={{ padding: 12 }}>Loading…</div>}{!loading && (audios.length === 0 ? <div style={{ padding: 12 }}>No audio items yet.</div> : audios.map(a => renderCard(a)))}</div></div>
        </section>

        {/* Videos */}
        <section className="carousel-section">
          <div className="carousel-header">
            <span className="carousel-title">Video Library</span>
            <div className="carousel-controls">
              {videos.length > visibleCount && (
                <>
                  <button className="carousel-btn" data-carousel="home-videos" data-dir="left">&#8592;</button>
                  <button className="carousel-btn" data-carousel="home-videos" data-dir="right">&#8594;</button>
                </>
              )}
              <Link className="see-all-link" to="/video-library">See All</Link>
            </div>
          </div>
          <div className="carousel-viewport"><div className="carousel" data-carousel="home-videos">{loading && <div style={{ padding: 12 }}>Loading…</div>}{!loading && (videos.length === 0 ? <div style={{ padding: 12 }}>No videos yet.</div> : videos.map(v => renderCard(v)))}</div></div>
        </section>

        {/* Directories */}
        <section className="carousel-section">
          <div className="carousel-header">
            <span className="carousel-title">Directories</span>
            <div className="carousel-controls">
              {directories.length > visibleCount && (
                <>
                  <button className="carousel-btn" data-carousel="home-directories" data-dir="left">&#8592;</button>
                  <button className="carousel-btn" data-carousel="home-directories" data-dir="right">&#8594;</button>
                </>
              )}
              <Link className="see-all-link" to="/directories">See All</Link>
            </div>
          </div>
          <div className="carousel-viewport"><div className="carousel carousel-directory" data-carousel="home-directories">{loading && <div style={{ padding: 12 }}>Loading…</div>}{!loading && (directories.length === 0 ? <div style={{ padding: 12 }}>No directory entries yet.</div> : directories.map(d => <Link key={d.id} className="card directory-card" to={`/directory/${d.id}`}><div className="directory-content"><div className="directory-title">{d.title}</div><div className="directory-meta">{(d.tags || []).slice(0,3).join(" • ")}</div></div></Link>))}</div></div>
        </section>
      </div>
    </div>
  );
}