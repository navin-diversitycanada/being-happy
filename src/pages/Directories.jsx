// src/pages/Directories.jsx
// Modified: when searching include featured items in search results and hide featured carousel.
// Also ensure "No directory entries yet" only shown when both featured and directories lists empty.

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listByType, listFeatured } from "../api/posts";
import { listCategories } from "../api/categories";
import { getVisibleCountForViewport } from "../utils/carouselHelpers";

/**
 * Directories page — same grouping logic but uses directory-card design for grid
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

export default function Directories() {
  const [featured, setFeatured] = useState([]);
  const [dirs, setDirs] = useState([]);
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
          listByType("directory", 200).catch(() => [])
        ]);
        if (!mounted) return;
        const catMap = {};
        (cats || []).forEach(c => { catMap[c.id] = c.name; });
        setCatsMap(catMap);
        // featured on directories page only show directories
        const featsDirs = (feats || []).filter(f => (f.type || "").toLowerCase() === "directory");
        const featIds = new Set(featsDirs.map(f => f.id));
        setFeatured(featsDirs.slice(0, 20));
        setDirs((list || []).filter(d => !featIds.has(d.id)));
      } catch (err) {
        console.error("Failed to load directories", err);
        if (!mounted) return;
        setDirs([]);
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

  const combined = [...(featured || []), ...(dirs || [])];
  const searchResults = applySearch(combined);

  const filtered = dirs;
  const categoriesGrouped = groupByCategory(filtered, catsMap).filter(g => g.items.length >= 3)
    .map(g => ({ ...g, items: g.items.slice(0, 20).sort((a, b) => timestampToMillis(b.publishedAt || b.createdAt) - timestampToMillis(a.publishedAt || a.createdAt)) }));

  const usedIds = new Set();
  categoriesGrouped.forEach(g => g.items.forEach(i => usedIds.add(i.id)));
  const remaining = filtered.filter(it => !usedIds.has(it.id));

  function renderDirectoryCard(item) {
    return (
      <Link key={item.id} className="card directory-card" to={`/directory/${item.id}`}>
        <div className="directory-content">
          <div className="directory-title">{item.title}</div>
          <div className="directory-meta">{(item.tags || []).slice(0,3).join(" • ")}</div>
        </div>
      </Link>
    );
  }

  if (searchQ.trim()) {
    return (
      <div className="main-content">
        <div className="promo-box"><div className="greeting">Directories</div><div className="promo-description">Recommended apps, centers and groups</div></div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <input className="text-input" placeholder="Search directories by title or category" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
        </div>

        {loading ? <div style={{ padding: 12 }}>Loading…</div> : (
          <>
            {searchResults.length === 0 ? <div style={{ padding: 12 }}>No results.</div> : (
              <div className="flex-card-grid">
                {searchResults.map(renderDirectoryCard)}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="promo-box"><div className="greeting">Directories</div><div className="promo-description">Recommended apps, centers and groups</div></div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <input className="text-input" placeholder="Search directories by title or category" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
      </div>

      {loading && <div style={{ padding: 12 }}>Loading…</div>}

      {!loading && featured.length > 0 && (
        <section className="carousel-section">
          <div className="carousel-header">
            <span className="carousel-title">Featured</span>
            {featured.length > visibleCount && (
              <div className="carousel-controls">
                <button className="carousel-btn" data-carousel="directories-featured" data-dir="left">&#8592;</button>
                <button className="carousel-btn" data-carousel="directories-featured" data-dir="right">&#8594;</button>
              </div>
            )}
          </div>
          <div className="carousel-viewport">
            <div className="carousel" data-carousel="directories-featured">
              {featured.map(f => renderDirectoryCard(f))}
            </div>
          </div>
        </section>
      )}

      {!loading && categoriesGrouped.map(group => (
        <section key={group.id} className="carousel-section">
          <div className="carousel-header"><span className="carousel-title">{group.name}</span></div>
          <div className="carousel-viewport"><div className="carousel">{group.items.map(renderDirectoryCard)}</div></div>
        </section>
      ))}

      {!loading && remaining.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h3 className="subcategory-title">All Other Directories</h3>
          <div className="flex-card-grid">
            {remaining.map(d => renderDirectoryCard(d))}
          </div>
        </div>
      )}

      {!loading && (combined.length === 0) && <div style={{ padding: 12 }}>No directory entries yet</div>}
    </div>
  );
}