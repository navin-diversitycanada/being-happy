// src/pages/Articles.jsx
// Modified: when searching, include featured items in search results and hide the Featured carousel.
// Also ensure "No articles available." only shows if there are truly no items (featured OR non-featured).

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listByType, listFeatured } from "../api/posts";
import { listCategories } from "../api/categories";
import { getVisibleCountForViewport } from "../utils/carouselHelpers";

/**
 * Articles page:
 * - Featured carousel on top (only article-type featured)
 * - Category carousels: for each category that has >= 3 non-featured articles we create a carousel (max 20)
 * - Remaining articles show under "All Other Articles" in grid
 * - Search bar filters the page's items; when searching we hide the featured carousel and show matching items (featured + non-featured)
 */

function groupByCategory(items, catsMap) {
  const map = {};
  items.forEach(it => {
    (it.categories || []).forEach(cid => {
      const name = catsMap[cid] || cid;
      map[cid] = map[cid] || { id: cid, name, items: [] };
      map[cid].items.push(it);
    });
    if (!it.categories || it.categories.length === 0) {
      map["__uncat"] = map["__uncat"] || { id: "__uncat", name: "Uncategorized", items: [] };
      map["__uncat"].items.push(it);
    }
  });
  return Object.values(map);
}

function timestampToMillis(t) {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (t instanceof Date) return t.getTime();
  try { return new Date(t).getTime() || 0; } catch { return 0; }
}

export default function Articles() {
  const [featured, setFeatured] = useState([]);
  const [articles, setArticles] = useState([]);
  const [catsMap, setCatsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [feats, cats, list] = await Promise.all([
          listFeatured(50).catch(() => []),
          listCategories().catch(() => []),
          listByType("article", 200).catch(() => [])
        ]);
        if (!mounted) return;
        const catMap = {};
        (cats || []).forEach(c => { catMap[c.id] = c.name; });
        setCatsMap(catMap);

        // featured only articles here
        const featsArticles = (feats || []).filter(f => (f.type || "").toLowerCase() === "article");
        const featIds = new Set((featsArticles || []).map(f => f.id));
        const nonFeat = (list || []).filter(a => !featIds.has(a.id));

        setFeatured(featsArticles.slice(0, 20));
        setArticles(nonFeat);
      } catch (err) {
        console.error("Failed to load articles", err);
        if (!mounted) setArticles([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  function applySearch(items) {
    const q = (searchQ || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => {
      if ((it.title || "").toLowerCase().includes(q)) return true;
      const cats = (it.categories || []).map(cid => (catsMap[cid] || "").toLowerCase());
      if (cats.some(cn => cn.includes(q))) return true;
      if ((it.excerpt || "").toLowerCase().includes(q) || (it.content || "").toLowerCase().includes(q)) return true;
      return false;
    });
  }

  const visibleCount = getVisibleCountForViewport();

  // When searching, include featured items in the search pool and hide the Featured carousel.
  const combinedAll = [...(featured || []), ...(articles || [])];
  const searchResults = applySearch(combinedAll);

  // Grouping (only applied for non-search view)
  const filteredArticles = articles;
  const categoriesGrouped = groupByCategory(filteredArticles, catsMap)
    .filter(g => g.items.length >= 3)
    .map(g => ({ ...g, items: g.items.slice(0, 20).sort((a, b) => timestampToMillis(b.publishedAt || b.createdAt) - timestampToMillis(a.publishedAt || a.createdAt)) }));

  const usedIds = new Set();
  categoriesGrouped.forEach(g => g.items.forEach(i => usedIds.add(i.id)));
  const remaining = filteredArticles.filter(it => !usedIds.has(it.id));

  function renderCard(item) {
    return (
      <Link key={item.id} className="card" to={`/article/${item.id}`}>
        <img className="card-img" src={item.thumbnailUrl || item.imageUrl || "/images/placeholder.png"} alt={item.title} />
        <div className="card-content">
          <div className="card-title">{item.title}</div>
          <div className="card-meta">{(item.categories || []).map(cid => catsMap[cid] || cid).join(", ") || "Article"}</div>
        </div>
      </Link>
    );
  }

  // If searching, show unified results grid and hide category carousels + featured.
  if (searchQ.trim()) {
    return (
      <div className="main-content">
        <div className="promo-box"><div className="greeting">Articles</div></div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <input className="text-input" placeholder="Search articles by title or category" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
        </div>

        {loading ? <div style={{ padding: 12 }}>Loading…</div> : (
          <>
            {searchResults.length === 0 ? <div style={{ padding: 12 }}>No results.</div> : (
              <div className="flex-card-grid">
                {searchResults.map(renderCard)}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Non-search view: normal featured + grouped carousels + remaining grid.
  return (
    <div className="main-content">
      <div className="promo-box"><div className="greeting">Articles</div></div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <input className="text-input" placeholder="Search articles by title or category" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
        <div style={{ marginLeft: 'auto' }} />
      </div>

      {loading && <div style={{ padding: 12 }}>Loading…</div>}

      {/* Featured */}
      {!loading && featured.length > 0 && (
        <section className="carousel-section">
          <div className="carousel-header">
            <span className="carousel-title">Featured</span>
            <div className="carousel-controls">
              {featured.length > visibleCount && (
                <>
                  <button className="carousel-btn" data-carousel="articles-featured" data-dir="left">&#8592;</button>
                  <button className="carousel-btn" data-carousel="articles-featured" data-dir="right">&#8594;</button>
                </>
              )}
            </div>
          </div>
          <div className="carousel-viewport">
            <div className="carousel" data-carousel="articles-featured">
              {featured.map(f => renderCard(f))}
            </div>
          </div>
        </section>
      )}

      {/* Category carousels */}
      {!loading && categoriesGrouped.map(group => (
        <section key={group.id} className="carousel-section">
          <div className="carousel-header">
            <span className="carousel-title">{group.name}</span>
            <div className="carousel-controls">
              {group.items.length > visibleCount && (
                <>
                  <button className="carousel-btn" data-carousel={`articles-${group.id}`} data-dir="left">&#8592;</button>
                  <button className="carousel-btn" data-carousel={`articles-${group.id}`} data-dir="right">&#8594;</button>
                </>
              )}
            </div>
          </div>
          <div className="carousel-viewport">
            <div className="carousel" data-carousel={`articles-${group.id}`}>
              {group.items.map(renderCard)}
            </div>
          </div>
        </section>
      ))}

      {/* Remaining grid */}
      {!loading && remaining.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h3 className="subcategory-title">All Other Articles</h3>
          <div className="flex-card-grid">
            {remaining.map(a => renderCard(a))}
          </div>
        </div>
      )}

      {/* Only show "No articles available" if combined (featured + articles) is empty */}
      {!loading && (combinedAll.length === 0) && <div style={{ padding: 12 }}>No articles available.</div>}
    </div>
  );
}