// src/pages/CategoryPage.jsx
// - Use .card-categories (salmon, bold) instead of .card-meta for the category line so it matches Articles styling.
// - Remove the "Filter" UI (we keep carousels on this page).
// - Replace promo-description with a clearer page-specific message.

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { listByCategory } from "../api/posts";
import { listCategories } from "../api/categories";
import Breadcrumbs from "../components/Breadcrumbs";

/**
 * CategoryPage — lists up to 12 items per type for the given category.
 * Uses consistent .card design for all types (including directories).
 */

function timestampSortDesc(a, b) {
  const ta = a?.publishedAt ? new Date(a.publishedAt).getTime() : (a?.createdAt ? new Date(a.createdAt).getTime() : 0);
  const tb = b?.publishedAt ? new Date(b.publishedAt).getTime() : (b?.createdAt ? new Date(b.createdAt).getTime() : 0);
  return tb - ta;
}

export default function CategoryPage() {
  const { id } = useParams();
  const [catName, setCatName] = useState("");
  const [articles, setArticles] = useState([]);
  const [videos, setVideos] = useState([]);
  const [audios, setAudios] = useState([]);
  const [dirs, setDirs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter: show all types or a specific type
  const [typeFilter, setTypeFilter] = useState("all"); // all | article | audio | video | directory

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const cats = await listCategories().catch(() => []);
        const found = (cats || []).find(c => c.id === id);
        if (mounted) setCatName(found ? found.name : id);

        // Fetch up to 20 items per type for this category, we'll display up to 12 per section
        const [arts, vids, audsList, dirsList] = await Promise.all([
          listByCategory(id, "article", 20).catch(() => []),
          listByCategory(id, "video", 20).catch(() => []),
          listByCategory(id, "audio", 20).catch(() => []),
          listByCategory(id, "directory", 20).catch(() => [])
        ]);

        if (!mounted) return;

        setArticles((arts || []).slice().sort(timestampSortDesc).slice(0, 12));
        setVideos((vids || []).slice().sort(timestampSortDesc).slice(0, 12));
        setAudios((audsList || []).slice().sort(timestampSortDesc).slice(0, 12));
        setDirs((dirsList || []).slice().sort(timestampSortDesc).slice(0, 12));
      } catch (err) {
        console.error("Failed to load category page", err);
        if (mounted) {
          setArticles([]); setVideos([]); setAudios([]); setDirs([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [id]);

  function renderCardForType(type, item) {
    const url = type === "article" ? `/article/${item.id}` : type === "audio" ? `/audio/${item.id}` : type === "video" ? `/video/${item.id}` : `/directory/${item.id}`;
    const isDirectory = (type === "directory");
    const imgSrc = isDirectory ? (item.thumbnailUrl || item.imageUrl || "/images/directoryplaceholder.png") : (item.thumbnailUrl || item.imageUrl || "/images/placeholder.png");
    return (
      <Link key={item.id} className="card" to={url}>
        <img className="card-img" src={imgSrc} alt={item.title} />
        <div className="card-content">
          <div className="card-title">{item.title}</div>
          {/* Use salmon category label to match Articles page */}
          <div className="card-categories">{catName || "Category"}</div>
        </div>
      </Link>
    );
  }

  // helper to conditionally render a type section based on filter
  function shouldShowType(t) {
    return typeFilter === "all" || typeFilter === t;
  }

  return (
    <div className="main-content">
      <div className="promo-box">
        <Breadcrumbs items={[
          { label: "Home", to: "/index" },
          { label: catName || "Category" }
        ]} />
        <div style={{ marginTop: 8 }}>
          <div className="greeting">{catName || "Category"}</div>
          <div className="promo-description">Browse curated resources and content in this category.</div>
        </div>
      </div>

      {/* Removed the "Filter" control (we display carousels/sections on this page) */}

      {loading && <div style={{ padding: 12 }}>Loading…</div>}

      {/* Articles */}
      {!loading && shouldShowType("article") && articles.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <h3 className="carousel-title">Articles</h3>
            <Link className="see-all-link" to={`/category/${id}/article`}>See All</Link>
          </div>
          <div className="flex-card-grid" style={{ marginTop: 12 }}>
            {articles.map(a => renderCardForType("article", a))}
          </div>
        </>
      )}

      {/* Meditation */}
      {!loading && shouldShowType("audio") && audios.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
            <h3 className="carousel-title">Meditation</h3>
            <Link className="see-all-link" to={`/category/${id}/audio`}>See All</Link>
          </div>
          <div className="flex-card-grid" style={{ marginTop: 12 }}>
            {audios.map(a => renderCardForType("audio", a))}
          </div>
        </>
      )}

      {/* Video Library */}
      {!loading && shouldShowType("video") && videos.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
            <h3 className="carousel-title">Video Library</h3>
            <Link className="see-all-link" to={`/category/${id}/video`}>See All</Link>
          </div>
          <div className="flex-card-grid" style={{ marginTop: 12 }}>
            {videos.map(v => renderCardForType("video", v))}
          </div>
        </>
      )}

      {/* Directories */}
      {!loading && shouldShowType("directory") && dirs.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
            <h3 className="carousel-title">Directories</h3>
            <Link className="see-all-link" to={`/category/${id}/directory`}>See All</Link>
          </div>
          <div className="flex-card-grid" style={{ marginTop: 12 }}>
            {dirs.map(d => renderCardForType("directory", d))}
          </div>
        </>
      )}

      {!loading && (articles.length === 0 && audios.length === 0 && videos.length === 0 && dirs.length === 0) && (
        <div style={{ padding: 12 }}>No items found in this category.</div>
      )}
    </div>
  );
}