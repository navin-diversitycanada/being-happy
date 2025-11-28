// src/pages/Featured.jsx
// Changes:
// - Use listFeatured to fetch ALL featured posts excluding directories, then paginate the grid (12 per page).
// - Removed the previous simplistic slice/filter; added proper pagination controls.

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listFeatured } from "../api/posts";
import { listCategories } from "../api/categories";
import { getVisibleCountForViewport } from "../utils/carouselHelpers";
import Breadcrumbs from "../components/Breadcrumbs";

export default function Featured() {
  const [items, setItems] = useState([]);
  const [catsMap, setCatsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const visibleCount = getVisibleCountForViewport();

  // Pagination
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(1);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [cats, featured] = await Promise.all([
          listCategories().catch(() => []),
          // Load a larger number of non-directory featured items so we can paginate on the client
          listFeatured(1000, null, "directory").catch(() => [])
        ]);
        if (!mounted) return;
        const map = {};
        (cats || []).forEach(c => { map[c.id] = c.name; });
        setCatsMap(map);

        setItems(featured || []);
      } catch (err) {
        console.error("Failed to load featured items", err);
        if (!mounted) return;
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  function renderCard(it) {
    const type = (it.type || "").toLowerCase();
    const path = type === "article" ? "article" : type === "audio" ? "audio" : type === "video" ? "video" : "directory";
    const img = (type === "directory" ? (it.thumbnailUrl || it.imageUrl || "/images/directoryplaceholder.png") : (it.thumbnailUrl || it.imageUrl || "/images/placeholder.png"));
    const cats = (it.categories || []).map(cid => catsMap[cid] || cid).filter(Boolean).slice(0,2).join(", ");
    return (
      <Link
        key={it.id}
        className="card"
        to={`/${path}/${it.id}`}
        role="listitem"
      >
        <img className="card-img" src={img} alt={it.title} />
        <div className="card-content">
          <div className="card-title">{it.title}</div>
          {cats ? <div className="card-categories">{cats}</div> : <div className="card-meta">{(it.type || "").charAt(0).toUpperCase() + (it.type || "").slice(1)} • Featured</div>}
        </div>
      </Link>
    );
  }

  // Pagination helpers
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    // if items change reset page if out of range
    if (page > totalPages) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  return (
    <div className="main-content">
      <div className="promo-box">
        <Breadcrumbs items={[{ label: "Home", to: "/index" }, { label: "Featured" }]} />
        <div><div className="greeting">Featured</div>
        <div className="promo-description">Discover hand-picked featured content — editor's picks of articles, meditations, videos and resources to help you feel better today.</div>
        </div>
        
      </div>

      <div className="carousel-section">
        <div className="carousel-viewport">
          <div className="flex-card-grid" role="list">
            {loading && <div style={{ padding: 12 }}>Loading…</div>}
            {!loading && (!items || items.length === 0) && <div style={{ padding: 12 }}>No featured items yet.</div>}
            {!loading && pageItems.map(renderCard)}
          </div>
        </div>
      </div>

      {/* Pagination controls */}
      {!loading && items.length > PAGE_SIZE && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
          <button className="see-all-link" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
          <div style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>{page} / {totalPages} ({total})</div>
          <button className="see-all-link" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
        </div>
      )}
    </div>
  );
}