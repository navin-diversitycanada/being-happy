// src/pages/Featured.jsx
// Changes:
// - Load categories and map category IDs to names so Featured cards show category NAMES (not IDs).
// - Keep featured list capped at 12.

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

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [cats, featured] = await Promise.all([
          listCategories().catch(() => []),
          listFeatured(12).catch(() => [])
        ]);
        if (!mounted) return;
        const map = {};
        (cats || []).forEach(c => { map[c.id] = c.name; });
        setCatsMap(map);
        setItems((featured || []).slice(0, 12));
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
            {!loading && (items || []).slice(0,12).map(renderCard)}
          </div>
        </div>
      </div>
    </div>
  );
}