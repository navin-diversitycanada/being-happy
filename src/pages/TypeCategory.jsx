// src/pages/TypeCategory.jsx
// - Use .card-categories (salmon, bold) instead of .card-meta so category/type labels match Articles styling.
// - Improve promo-description wording.

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { listByCategory } from "../api/posts";
import { listCategories } from "../api/categories";
import Breadcrumbs from "../components/Breadcrumbs";

/**
 * TypeCategory — lists items for category+type in a grid with search + pagination.
 * Route: /category/:id/:type
 */

export default function TypeCategory() {
  const { id, type } = useParams();
  const [items, setItems] = useState([]);
  const [catName, setCatName] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");

  // Pagination
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const cats = await listCategories().catch(() => []);
        const found = (cats || []).find(c => c.id === id);
        if (mounted) setCatName(found ? found.name : id);

        // Fetch up to a large window for client-side pagination
        const list = await listByCategory(id, type, 1000).catch(() => []);
        if (mounted) setItems((list || []).slice().sort((a, b) => {
          const ta = a?.publishedAt ? new Date(a.publishedAt).getTime() : (a?.createdAt ? new Date(a.createdAt).getTime() : 0);
          const tb = b?.publishedAt ? new Date(b.publishedAt).getTime() : (b?.createdAt ? new Date(b.createdAt).getTime() : 0);
          return tb - ta;
        }));
      } catch (err) {
        console.error("Failed to load type-category page", err);
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [id, type]);

  // Reset page when the search or category/type changes
  useEffect(() => { setPage(1); }, [searchQ, id, type]);

  function applySearch(list) {
    const q = (searchQ || "").trim().toLowerCase();
    if (!q) return list;
    return (list || []).filter(it => {
      if (!it) return false;
      if ((it.title || "").toLowerCase().includes(q)) return true;
      if ((it.excerpt || "").toLowerCase().includes(q)) return true;
      if ((it.content || "").toLowerCase().includes(q)) return true;
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

  function displayTypeName(t) {
    if (!t) return "";
    const tt = (t || "").toLowerCase();
    if (tt === "audio") return "Meditation";
    if (tt === "video") return "Video Library";
    if (tt === "directory") return "Directories";
    return tt.charAt(0).toUpperCase() + tt.slice(1);
  }

  function renderCard(item) {
    const isDirectory = ((type || "").toLowerCase() === "directory");
    const imgSrc = isDirectory ? (item.thumbnailUrl || item.imageUrl || "/images/directoryplaceholder.png") : (item.thumbnailUrl || item.imageUrl || "/images/placeholder.png");
    const url = type === "article" ? `/article/${item.id}` : type === "audio" ? `/audio/${item.id}` : type === "video" ? `/video/${item.id}` : `/directory/${item.id}`;
    return (
      <Link key={item.id} className="card" to={url}>
        <img className="card-img" src={imgSrc} alt={item.title} />
        <div className="card-content">
          <div className="card-title">{item.title}</div>
          {/* Use the salmon category/type label style to match Articles */}
          <div className="card-categories">{type ? (type.charAt(0).toUpperCase() + type.slice(1)) : ""}</div>
        </div>
      </Link>
    );
  }

  const filtered = applySearch(items);
  const uniqueFiltered = uniqueById(filtered);
  const total = uniqueFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = uniqueFiltered.slice(start, start + PAGE_SIZE);

  return (
    <div className="main-content">
      <div className="promo-box">
        <Breadcrumbs items={[
          { label: "Home", to: "/index" },
          { label: catName || "Category", to: `/category/${id}` },
          { label: displayTypeName(type) }
        ]} />
        <div style={{ marginTop: 8 }}>
          <div className="greeting">{catName || "Category"}</div>
          <div className="promo-description">{type ? `Browse ${displayTypeName(type)} in this category` : "Items"}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <input className="text-input" placeholder={`Search ${type || "items"} in ${catName || "category"}`} value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
      </div>

      {loading ? <div style={{ padding: 12 }}>Loading…</div> : (
        <>
          {pageItems.length === 0 ? <div style={{ padding: 12 }}>No items found.</div> : (
            <>
              <div className="flex-card-grid">
                {pageItems.map(renderCard)}
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
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