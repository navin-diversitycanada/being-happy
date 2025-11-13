// src/pages/Featured.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listFeatured } from "../api/posts";

/**
 * Featured page — shows featured posts across types (published only)
 * This page uses a grid layout (no carousel arrows). If you want a carousel here,
 * we can change to a carousel and apply the same responsive controls logic.
 */

export default function Featured() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const featured = await listFeatured(200, 1000); // try to collect up to 200 featured
        if (!mounted) return;
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

  return (
    <div className="main-content">
      <div className="promo-box"><div className="greeting">Featured</div></div>
      <div className="carousel-section">
        <div className="carousel-viewport">
          <div className="flex-card-grid" role="list">
            {loading && <div style={{ padding: 12 }}>Loading…</div>}
            {!loading && items.length === 0 && <div style={{ padding: 12 }}>No featured items yet.</div>}
            {!loading && items.map(it => (
              <Link
                key={it.id}
                className="card"
                to={`/${it.type === "article" ? "article" : it.type}/${it.id}`}
                role="listitem"
              >
                <img className="card-img" src={it.thumbnailUrl || it.imageUrl || "/images/placeholder.png"} alt={it.title} />
                <div className="card-content">
                  <div className="card-title">{it.title}</div>
                  <div className="card-meta">{it.type} • Featured</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}