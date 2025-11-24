// src/pages/Home.jsx
// Updated:
// - Home directories carousel now uses the exact same .card markup used on the Directories page (class="card")
//   but without an <img>. This makes Home directory cards match the Directories page card layout/spacing
//   (same .card/.card-content structure as featured directory cards) while omitting images.

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { listByType, listFeatured } from "../api/posts";
import { listCategories } from "../api/categories";
import { getVisibleCountForViewport } from "../utils/carouselHelpers";

/**
 * Home — shows Featured and four type sections (Articles, Meditation, Video Library, Directories)
 */

function capitalizeName(raw = "") {
  if (!raw) return "";
  return raw.split(" ").map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : "")).join(" ");
}

function excerptText(content = "", max = 120) {
  if (!content) return "";
  const plain = content.replace(/<\/?[^>]+(>|$)/g, ""); // strip HTML
  if (plain.length <= max) return plain;
  return plain.slice(0, max).trim() + "…";
}

export default function Home() {
  const auth = useAuth();
  const rawName = auth?.user?.displayName || "";
  const displayName = rawName ? capitalizeName(rawName) : "";

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

        // Featured (limit to 12)
        const feats = await listFeatured(12).catch(() => []);
        setFeatured((feats || []).slice(0, 12));

        // Fetch type lists (limit to 12)
        const [arts, vids, auds, dirs] = await Promise.all([
          listByType("article", 12).catch(() => []),
          listByType("video", 12).catch(() => []),
          listByType("audio", 12).catch(() => []),
          listByType("directory", 12).catch(() => [])
        ]);

        if (!mounted) return;
        setArticles(arts || []);
        setVideos(vids || []);
        setAudios(auds || []);
        setDirectories(dirs || []);
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

  function imageForItem(item) {
    if (!item) return "/images/placeholder.png";
    if ((item.type || "").toLowerCase() === "directory") {
      return item.thumbnailUrl || item.imageUrl || "/images/directoryplaceholder.png";
    }
    return item.thumbnailUrl || item.imageUrl || "/images/placeholder.png";
  }

  // Full image card (used in the Featured carousel)
  function renderImageCard(item) {
    const type = (item.type || "").toLowerCase();
    const url = type === "article" ? `/article/${item.id}` : type === "audio" ? `/audio/${item.id}` : type === "video" ? `/video/${item.id}` : `/directory/${item.id}`;
    const img = imageForItem(item);
    return (
      <Link key={item.id} className="card" to={url}>
        <img className="card-img" src={img} alt={item.title} />
        <div className="card-content">
          <div className="card-title">{item.title}</div>
          {/* show categories in salmon if available */}
          { (item.categories || []).length ? (
            <div className="card-categories">{(item.categories || []).map(cid => catsMap[cid] || cid).slice(0,2).join(", ")}</div>
          ) : (
            <div className="card-meta">{type === "article" ? "Article" : type === "audio" ? "Audio" : type === "video" ? "Video" : "Directory"}</div>
          )}
        </div>
      </Link>
    );
  }

  // Home media card: uses .card sizing but no image; shows title (2 lines), categories in salmon, then excerpt (2 lines)
  function renderMediaHomeCard(item) {
    const type = (item.type || "").toLowerCase();
    const url = type === "article" ? `/article/${item.id}` : type === "audio" ? `/audio/${item.id}` : type === "video" ? `/video/${item.id}` : `/directory/${item.id}`;
    const excerpt = excerptText(item.content || item.excerpt || "", 120);
    const cats = (item.categories || []).map(cid => catsMap[cid] || cid).filter(Boolean);
    const catLabel = cats.length ? cats.slice(0, 2).join(", ") : "";
    return (
      <Link key={item.id} className="card" to={url}>
        <div className="card-content">
          <div className="card-title">{item.title}</div>
          {catLabel ? <div className="card-categories">{catLabel}</div> : null}
          <div className="card-excerpt">{excerpt}</div>
        </div>
      </Link>
    );
  }

  // Directory card for Home: use the same .card markup used on the Directories page (no <img> here)
  // This matches the Featured/Directories page card structure but without showing images on Home.
  function renderDirectoryHomeCard(item) {
    const url = `/directory/${item.id}`;
    const cats = (item.categories || []).map(cid => catsMap[cid] || cid).filter(Boolean);
    const meta = cats.length ? cats.slice(0,2).join(", ") : (item.tags || []).slice(0,3).join(" • ");
    return (
      // Use the same "card" class as Directories' featured cards but omit the <img>
      <Link key={item.id} className="card" to={url}>
        <div className="card-content">
          <div className="card-title">{item.title}</div>
          {meta ? <div className="card-categories">{meta}</div> : <div className="card-meta">Directory</div>}
        </div>
      </Link>
    );
  }

  return (
    <div>
      <div className="main-content">
        <div className="promo-box" id="promoBox">
          <span className="promo-text">
            <div className="greeting">{displayName ? `Welcome, ${displayName}` : "Welcome"}</div>
            <div className="promo-description">Explore the latest articles, meditations, videos and recommended resources.</div>
          </span>
        </div>

        {/* Featured (image cards) */}
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
              {!loading && (featured.length === 0 ? <div style={{ padding: 12 }}>No featured items yet.</div> : (featured || []).slice(0,12).map(it => renderImageCard(it)))}
            </div>
          </div>
        </section>

        {/* Articles (home media cards) */}
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
          <div className="carousel-viewport">
            <div className="carousel" data-carousel="home-articles">
              {loading && <div style={{ padding: 12 }}>Loading…</div>}
              {!loading && (articles.length === 0 ? <div style={{ padding: 12 }}>No articles yet.</div> : (articles || []).slice(0,12).map(a => renderMediaHomeCard(a)))}
            </div>
          </div>
        </section>

        {/* Meditation (home media cards) */}
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
          <div className="carousel-viewport">
            <div className="carousel" data-carousel="home-audios">
              {loading && <div style={{ padding: 12 }}>Loading…</div>}
              {!loading && (audios.length === 0 ? <div style={{ padding: 12 }}>No audio items yet.</div> : (audios || []).slice(0,12).map(a => renderMediaHomeCard(a)))}
            </div>
          </div>
        </section>

        {/* Video Library (home media cards) */}
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
          <div className="carousel-viewport">
            <div className="carousel" data-carousel="home-videos">
              {loading && <div style={{ padding: 12 }}>Loading…</div>}
              {!loading && (videos.length === 0 ? <div style={{ padding: 12 }}>No videos yet.</div> : (videos || []).slice(0,12).map(v => renderMediaHomeCard(v)))}
            </div>
          </div>
        </section>

        {/* Directories on Home: reuse the same .card used on Directories page but omit images */}
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
          <div className="carousel-viewport">
            <div className="carousel carousel-directory" data-carousel="home-directories">
              {loading && <div style={{ padding: 12 }}>Loading…</div>}
              {!loading && (directories.length === 0 ? <div style={{ padding: 12 }}>No directory entries yet.</div> : (directories || []).slice(0,12).map(d => renderDirectoryHomeCard(d)))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}