// src/pages/Meditation.jsx
// Changes:
// - Deduplicate search results when combining featured + audios.

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listByType, listFeatured } from "../api/posts";
import { listCategories } from "../api/categories";
import { getVisibleCountForViewport } from "../utils/carouselHelpers";
import Breadcrumbs from "../components/Breadcrumbs";

/**
 * Meditation page — featured carousel (audio) + paginated grid (20 per page) for others.
 */

export default function Meditation() {
  const [featured, setFeatured] = useState([]);
  const [audios, setAudios] = useState([]);
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
          listByType("audio", 12).catch(() => [])
        ]);
        if (!mounted) return;
        const catMap = {};
        (cats || []).forEach(c => { catMap[c.id] = c.name; });
        setCatsMap(catMap);
        const featsAudio = (feats || []).filter(f => (f.type || "").toLowerCase() === "audio");
        setFeatured(featsAudio.slice(0,12));
        // Keep the full list (include featured)
        setAudios(list || []);
      } catch (err) {
        console.error("Failed to load audios", err);
        if (!mounted) return;
        setAudios([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => { setPage(1); }, [searchQ]);

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

  // dedupe helper
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

  const combined = [...(featured || []), ...(audios || [])];
  const searchResultsRaw = applySearch(combined);
  const searchResults = uniqueById(searchResultsRaw);

  const gridSource = searchQ.trim() ? searchResults : audios;
  const total = gridSource.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = gridSource.slice(start, start + PAGE_SIZE);

  function renderCard(item) {
    const catsLabel = (item.categories || []).map(cid => catsMap[cid] || cid).join(", ");
    return (
      <Link key={item.id} className="card" to={`/audio/${item.id}`}>
        <img className="card-img" src={item.thumbnailUrl || item.imageUrl || "/images/placeholder.png"} alt={item.title} />
        <div className="card-content">
          <div className="card-title">{item.title}</div>
          {catsLabel ? <div className="card-categories">{catsLabel}</div> : <div className="card-meta">Audio</div>}
        </div>
      </Link>
    );
  }

  if (searchQ.trim()) {
    return (
      <div className="main-content">
        <div className="promo-box">
          <Breadcrumbs items={[{ label: "Home", to: "/index" }, { label: "Meditation" }]} />
          <div><div className="greeting">Meditation</div>
             <div className="promo-description">Short guided meditations to help you relax, focus, and sleep — pick a session and start feeling calmer in minutes.</div></div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <input className="text-input" placeholder="Search meditations by title or category" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
        </div>

        {loading ? <div style={{ padding: 12 }}>Loading…</div> : (
          <>
            {pageItems.length === 0 ? <div style={{ padding: 12 }}>No results.</div> : (
              <>
                <div className="flex-card-grid">
                  {pageItems.map(renderCard)}
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                  <button className="see-all-link" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
                  <div style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>{page} / {totalPages} ({total})</div>
                  <button className="see-all-link" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="promo-box">
        <Breadcrumbs items={[{ label: "Home", to: "/index" }, { label: "Meditation" }]} />
        <div><div className="greeting">Meditation</div>
          <div className="promo-description">Short guided meditations to help you relax, focus, and sleep — pick a session and start feeling calmer in minutes.</div>
        </div>
        
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <input className="text-input" placeholder="Search meditations by title or category" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
      </div>

      {loading && <div style={{ padding: 12 }}>Loading…</div>}

      {!loading && featured.length > 0 && (
        <section className="carousel-section">
          <div className="carousel-header">
            <span className="carousel-title">Featured</span>
            <div className="carousel-controls">
              {featured.length > visibleCount && (
                <>
                  <button className="carousel-btn" data-carousel="meditation-featured" data-dir="left">&#8592;</button>
                  <button className="carousel-btn" data-carousel="meditation-featured" data-dir="right">&#8594;</button>
                </>
              )}
            </div>
          </div>
          <div className="carousel-viewport">
            <div className="carousel" data-carousel="meditation-featured">{(featured || []).slice(0,12).map(f => renderCard(f))}</div>
          </div>
        </section>
      )}

      {!loading && pageItems.length > 0 && (
        <>
          <div style={{ marginTop: 18 }}>
            <h3 className="subcategory-title">All Meditations</h3>
            <div className="flex-card-grid">
              {pageItems.map(renderCard)}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
            <button className="see-all-link" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
            <div style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>{page} / {totalPages} ({total})</div>
            <button className="see-all-link" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
          </div>
        </>
      )}

      {!loading && (combined.length === 0) && <div style={{ padding: 12 }}>No audio items yet.</div>}
    </div>
  );
}