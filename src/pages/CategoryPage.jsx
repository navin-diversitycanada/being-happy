// src/pages/CategoryPage.jsx
// Fixed: ensure featured directory items use the same directory-card design as directory listings.
// - Directory featured items now render with className="card directory-card" so CSS .card.directory-card applies.
// - Non-directory featured items continue to render with className="card".

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { listByCategory, listFeatured } from "../api/posts";
import { listCategories } from "../api/categories";
import { getVisibleCountForViewport } from "../utils/carouselHelpers";

/**
 * CategoryPage — shows items for a single category across types (article, video, audio, directory)
 * - Uses listByCategory for reliable per-category fetching.
 * - Shows featured items that belong to this category in a featured carousel at the top.
 */

function timestampSortDesc(a, b) {
  const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
  const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
  return tb - ta;
}

export default function CategoryPage() {
  const { id } = useParams(); // category id
  const [catName, setCatName] = useState("");
  const [featured, setFeatured] = useState([]); // featured items for this category
  const [articles, setArticles] = useState([]);
  const [videos, setVideos] = useState([]);
  const [audios, setAudios] = useState([]);
  const [dirs, setDirs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const cats = await listCategories().catch(() => []);
        const found = (cats || []).find(c => c.id === id);
        if (mounted) setCatName(found ? found.name : id);

        // Fetch featured across the site and then pick those that include this category id
        const feats = await listFeatured(400).catch(() => []);
        const featsForCat = (feats || []).filter(f => Array.isArray(f.categories) && f.categories.includes(id))
          .sort(timestampSortDesc);

        // Use listByCategory to fetch per-type content for this category
        const [arts, vids, audsList, dirsList] = await Promise.all([
          listByCategory(id, "article", 1000).catch(() => []),
          listByCategory(id, "video", 1000).catch(() => []),
          listByCategory(id, "audio", 1000).catch(() => []),
          listByCategory(id, "directory", 1000).catch(() => [])
        ]);

        // Build a set of featured IDs for this category so we can exclude them from the per-type lists
        const featIds = new Set((featsForCat || []).map(f => f.id));

        const filterNonFeatured = (arr) => (arr || []).filter(item => !featIds.has(item.id)).sort(timestampSortDesc);

        if (mounted) {
          setFeatured(featsForCat);
          setArticles(filterNonFeatured(arts));
          setVideos(filterNonFeatured(vids));
          setAudios(filterNonFeatured(audsList));
          setDirs(filterNonFeatured(dirsList));
        }
      } catch (err) {
        console.error("Failed to load category page", err);
        if (mounted) {
          setFeatured([]); setArticles([]); setVideos([]); setAudios([]); setDirs([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [id]);

  function applySearch(items) {
    const q = (searchQ || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => {
      if (!it) return false;
      if ((it.title || "").toLowerCase().includes(q)) return true;
      if ((it.excerpt || "").toLowerCase().includes(q)) return true;
      if ((it.content || "").toLowerCase().includes(q)) return true;
      return false;
    });
  }

  function renderCardForType(type, item) {
    const url = type === "article" ? `/article/${item.id}` : type === "audio" ? `/audio/${item.id}` : type === "video" ? `/video/${item.id}` : `/directory/${item.id}`;
    if (type === "directory") {
      return (
        <Link key={item.id} className="card directory-card" to={url}>
          <div className="directory-content">
            <div className="directory-title">{item.title}</div>
            <div className="directory-meta">{(item.tags || []).slice(0,3).join(" • ")}</div>
          </div>
        </Link>
      );
    }
    return (
      <Link key={item.id} className="card" to={url}>
        <img className="card-img" src={item.thumbnailUrl || item.imageUrl || "/images/placeholder.png"} alt={item.title} />
        <div className="card-content">
          <div className="card-title">{item.title}</div>
          <div className="card-meta">{type.charAt(0).toUpperCase() + type.slice(1)}</div>
        </div>
      </Link>
    );
  }

  function renderTypeSection(title, items, type, carouselKey) {
    const filtered = applySearch(items);
    if (!filtered || filtered.length === 0) return null;
    const visibleCount = getVisibleCountForViewport();
    const showArrows = filtered.length > visibleCount;
    const carouselItems = filtered.slice(0, 20);
    const remaining = filtered.slice(20);

    return (
      <section key={type} className="carousel-section">
        <div className="carousel-header">
          <span className="carousel-title">{title}</span>
          <div className="carousel-controls">
            {showArrows && (
              <>
                <button className="carousel-btn" data-carousel={carouselKey} data-dir="left">&#8592;</button>
                <button className="carousel-btn" data-carousel={carouselKey} data-dir="right">&#8594;</button>
              </>
            )}
            {filtered.length > 20 && <Link className="see-all-link" to={`/${type === 'directory' ? 'directories' : (type === 'article' ? 'articles' : type === 'audio' ? 'meditation' : 'video-library')}`}>See All</Link>}
          </div>
        </div>

        <div className="carousel-viewport">
          <div className="carousel" data-carousel={carouselKey}>
            {carouselItems.map(item => renderCardForType(type, item))}
          </div>
        </div>

        {remaining.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <h3 className="subcategory-title">All Other {title}</h3>
            <div className="flex-card-grid">
              {remaining.map(item => renderCardForType(type, item))}
            </div>
          </div>
        )}
      </section>
    );
  }

  // Combined items (featured for this category + per-type non-featured lists)
  const allItemsCombined = [
    ...featured,
    ...articles,
    ...audios,
    ...videos,
    ...dirs
  ].filter(Boolean);

  // If searching: show unified results grid (includes featured + non-featured)
  if (searchQ.trim()) {
    const searchResults = applySearch(allItemsCombined);

    return (
      <div className="main-content">
        <div className="promo-box"><div className="greeting">{catName || "Category"}</div><div className="promo-description">Category — showing items by type</div></div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <input className="text-input" placeholder={`Search ${catName || "category"} items`} value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
        </div>

        {loading && <div style={{ padding: 12 }}>Loading…</div>}

        {!loading && searchResults.length === 0 && <div style={{ padding: 12 }}>No results.</div>}
        {!loading && searchResults.length > 0 && (
          <div className="flex-card-grid">
            {searchResults.map(item => {
              const type = (item.type || "article");
              return renderCardForType(type, item);
            })}
          </div>
        )}
      </div>
    );
  }

  // Non-search view: show featured (for this category) followed by type sections
  return (
    <div className="main-content">
      <div className="promo-box"><div className="greeting">{catName || "Category"}</div><div className="promo-description">Category — showing items by type</div></div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <input className="text-input" placeholder={`Search ${catName || "category"} items`} value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
      </div>

      {loading && <div style={{ padding: 12 }}>Loading…</div>}

      {/* Featured carousel for this category (shows only items that include this category) */}
      {!loading && featured && featured.length > 0 && (
        <section className="carousel-section">
          <div className="carousel-header">
            <span className="carousel-title">Featured in {catName || "this category"}</span>
            <div className="carousel-controls">
              {featured.length > getVisibleCountForViewport() && (
                <>
                  <button className="carousel-btn" data-carousel={`category-featured-${id}`} data-dir="left">&#8592;</button>
                  <button className="carousel-btn" data-carousel={`category-featured-${id}`} data-dir="right">&#8594;</button>
                </>
              )}
            </div>
          </div>
          <div className="carousel-viewport">
            <div className="carousel" data-carousel={`category-featured-${id}`}>
              {featured.map(item => {
                // Use directory-card class for directory items so CSS matches other directory lists
                if ((item.type || "").toLowerCase() === "directory") {
                  return (
                    <Link key={item.id} className="card directory-card" to={`/directory/${item.id}`}>
                      <div className="directory-content">
                        <div className="directory-title">{item.title}</div>
                        <div className="directory-meta">{(item.tags || []).slice(0,3).join(" • ")}</div>
                      </div>
                    </Link>
                  );
                }

                // Non-directory featured item
                return (
                  <Link key={item.id} className="card" to={`/${item.type === "article" ? "article" : item.type === "audio" ? "audio" : "video"}/${item.id}`}>
                    <img className="card-img" src={item.thumbnailUrl || item.imageUrl || "/images/placeholder.png"} alt={item.title} />
                    <div className="card-content">
                      <div className="card-title">{item.title}</div>
                      <div className="card-meta">{(item.categories || []).join(", ")}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Type sections (articles, audios, videos, directories) */}
      {!loading && renderTypeSection("Articles", articles, "article", `category-article-${id}`)}
      {!loading && renderTypeSection("Meditation", audios, "audio", `category-audio-${id}`)}
      {!loading && renderTypeSection("Video Library", videos, "video", `category-video-${id}`)}
      {!loading && renderTypeSection("Directories", dirs, "directory", `category-dir-${id}`)}

      {!loading && allItemsCombined.length === 0 && <div style={{ padding: 12 }}>No items found in this category.</div>}
    </div>
  );
}