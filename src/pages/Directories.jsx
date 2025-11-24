// src/pages/Directories.jsx
// Changes:
// - Deduplicate search results by id to avoid duplicated items in search results (featured+dirs merge).
// - Use deduped results for rendering.

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listByType, listFeatured } from "../api/posts";
import { listCategories } from "../api/categories";
import { getVisibleCountForViewport } from "../utils/carouselHelpers";
import Breadcrumbs from "../components/Breadcrumbs";

/**
 * Directories page — featured carousel (images) + paginated grid (20 per page) for all directories.
 * Grid: now uses image cards (same design as featured); if image missing use directoryplaceholder.png.
 * When searching: featured carousel hidden; results shown in the grid (images included).
 */

export default function Directories() {
  const [featured, setFeatured] = useState([]);
  const [dirs, setDirs] = useState([]);
  const [catsMap, setCatsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [feats, cats, list] = await Promise.all([
          listFeatured(12).catch(() => []),
          listCategories().catch(() => []),
          listByType("directory", 200).catch(() => [])
        ]);
        if (!mounted) return;
        const catMap = {};
        (cats || []).forEach(c => { catMap[c.id] = c.name; });
        setCatsMap(catMap);
        const featsDirs = (feats || []).filter(f => (f.type || "").toLowerCase() === "directory");
        setFeatured(featsDirs.slice(0, 12));
        setDirs(list || []);
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

  // Reset page to 1 when search changes
  useEffect(() => { setPage(1); }, [searchQ]);

  function applySearch(items) {
    const q = (searchQ || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => {
      if ((it.title || "").toLowerCase().includes(q)) return true;
      const cats = (it.categories || []).map(cid => (catsMap[cid] || "").toLowerCase());
      if (cats.some(cn => cn.includes(q))) return true;
      if ((it.excerpt || "").toLowerCase().includes(q) || (it.content || "").toLowerCase().includes(q)) return true;
      if ((it.tags || []).join(" ").toLowerCase().includes(q)) return true;
      return false;
    });
  }

  // helper to dedupe by id preserving order
  function uniqueById(arr = []) {
    const seen = new Set();
    const out = [];
    for (const it of arr || []) {
      if (!it || !it.id) continue;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
    }
    return out;
  }

  const visibleCount = getVisibleCountForViewport();

  const combined = [...(featured || []), ...(dirs || [])];
  const searchResultsRaw = applySearch(combined);
  const searchResults = uniqueById(searchResultsRaw);

  const gridSource = searchQ.trim() ? searchResults : dirs;
  const total = gridSource.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = gridSource.slice(start, start + PAGE_SIZE);

  // Featured carousel item uses the same markup/style as Articles featured carousel:
  function renderFeaturedCarouselItem(f) {
    const img = f.thumbnailUrl || f.imageUrl || "/images/directoryplaceholder.png";
    const cats = (f.categories || []).map(cid => catsMap[cid] || cid).filter(Boolean);
    const meta = cats.length ? cats.slice(0,2).join(", ") : (f.tags || []).slice(0,3).join(" • ");
    return (
      <Link key={f.id} className="card" to={`/directory/${f.id}`}>
        <img className="card-img" src={img} alt={f.title} />
        <div className="card-content">
          <div className="card-title">{f.title}</div>
          {meta ? <div className="card-categories">{meta}</div> : <div className="card-meta">Directory</div>}
        </div>
      </Link>
    );
  }

  // Grid items: show image (or placeholder) + title + categories
  function renderGridDirectoryCard(item) {
    const img = item.thumbnailUrl || item.imageUrl || "/images/directoryplaceholder.png";
    const cats = (item.categories || []).map(cid => catsMap[cid] || cid).filter(Boolean);
    const meta = cats.length ? cats.slice(0,2).join(", ") : (item.tags || []).slice(0,3).join(" • ");
    return (
      <Link key={item.id} className="card" to={`/directory/${item.id}`}>
        <img className="card-img" src={img} alt={item.title} />
        <div className="card-content">
          <div className="card-title">{item.title}</div>
          {meta ? <div className="card-categories">{meta}</div> : <div className="card-meta">Directory</div>}
        </div>
      </Link>
    );
  }

  return (
    <div className="main-content">
      <div className="promo-box">
        <Breadcrumbs items={[{ label: "Home", to: "/index" }, { label: "Directories" }]} />
        <div style={{ marginTop: 8 }}><div className="greeting">Directories</div><div className="promo-description">Recommended apps, centers and groups</div></div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <input
          className="text-input"
          placeholder="Search directories by title, tag or category"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          aria-label="Search directories"
        />
      </div>

      {loading && <div style={{ padding: 12 }}>Loading…</div>}

      {/* Featured carousel: show only when not searching */}
      {!loading && featured.length > 0 && !searchQ.trim() && (
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
            <div className="carousel carousel-directory" data-carousel="directories-featured">
              {(featured || []).slice(0,12).map(renderFeaturedCarouselItem)}
            </div>
          </div>
        </section>
      )}

      {/* All Directories */}
      <div style={{ marginTop: 18 }}>
        <h3 className="subcategory-title">All Directories</h3>

        {searchQ.trim() ? (
          <>
            {searchResults.length === 0 ? (
              <div style={{ padding: 12 }}>No results.</div>
            ) : (
              <div className="flex-card-grid">
                {searchResults.slice(0, 200).map(renderGridDirectoryCard)}
              </div>
            )}
          </>
        ) : (
          <>
            {pageItems.length === 0 && !loading ? <div style={{ padding: 12 }}>No directory entries yet</div> : (
              <div className="flex-card-grid">
                {pageItems.map(renderGridDirectoryCard)}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
              <button className="see-all-link" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
              <div style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>{page} / {totalPages} ({total})</div>
              <button className="see-all-link" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}