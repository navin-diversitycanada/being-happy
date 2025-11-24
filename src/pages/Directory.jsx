// src/pages/Directory.jsx
// Updated: title renders as H1 (no inline margin) and transformContentHeadings adds letter-spacing + margins.

import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getPost } from "../api/posts";
import { listCategories } from "../api/categories";
import { useAuth } from "../contexts/AuthContext";
import { addFavorite, removeFavorite, isFavorited } from "../api/favorites";
import Breadcrumbs from "../components/Breadcrumbs";

function transformContentHeadings(html) {
  if (!html) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const applyStyle = (el, size) => {
      el.style.fontFamily = "'Lora', serif";
      el.style.fontWeight = "900";
      el.style.color = "var(--cream)";
      el.style.marginTop = "18px";
      el.style.marginBottom = "12px";
      el.style.lineHeight = "1.1";
      el.style.fontSize = size;
      el.style.letterSpacing = "0.6px";
    };

    doc.querySelectorAll("h2").forEach(h => applyStyle(h, "28px"));
    doc.querySelectorAll("h3").forEach(h => applyStyle(h, "24px"));
    doc.querySelectorAll("hr").forEach(hr => {
      hr.style.marginTop = "18px";
      hr.style.marginBottom = "18px";
      hr.style.border = "none";
      hr.style.borderTop = "1px solid rgba(255,255,255,0.06)";
    });

    return doc.body.innerHTML || "";
  } catch (e) {
    console.warn("transformContentHeadings failed", e);
    return html;
  }
}

export default function Directory() {
  const { id } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const [dir, setDir] = useState(null);
  const [catsMap, setCatsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [favError, setFavError] = useState("");
  const currentUid = auth?.user?.uid || null;

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [p, cats] = await Promise.all([getPost(id), listCategories()]);
        if (!mounted) return;
        setDir(p);
        const map = {};
        (cats || []).forEach(c => { map[c.id] = c.name; });
        setCatsMap(map);

        const fav = await isFavorited(currentUid || null, id).catch(() => false);
        if (!mounted) return;
        setIsFav(fav);
      } catch (err) {
        console.error("Failed to load directory item", err);
        if (mounted) setDir(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [id, currentUid]);

  async function toggleFavorite() {
    setFavError("");
    if (!currentUid) {
      if (window.confirm("You must be signed in to save favorites. Sign in now?")) navigate("/login");
      return;
    }
    if (!navigator.onLine) {
      setFavError("You must be online to save favorites.");
      return;
    }
    setFavLoading(true);
    try {
      const imageSrc = dir.imageUrl || dir.thumbnailUrl || null;
      if (isFav) {
        await removeFavorite(currentUid, id);
        setIsFav(false);
      } else {
        await addFavorite(currentUid, { id, title: dir?.title || null, type: dir?.type || "directory", thumbnailUrl: imageSrc });
        setIsFav(true);
      }
    } catch (err) {
      console.error("Failed to toggle favorite", err);
      if (auth?.role === "admin") {
        setFavError(`Failed to toggle favorite: ${err?.message || err}`);
      } else {
        setFavError("Error saving your favorites. Please try again.");
      }
    } finally {
      setFavLoading(false);
    }
  }

  if (loading) return <div className="main-content"><div style={{ padding: 12 }}>Loading…</div></div>;
  if (!dir) return (
    <div className="main-content"><div className="notfound"><div className="nf-card"><h2>Directory item not found</h2><Link to="/directories" className="see-all-link">Back to Directories</Link></div></div></div>
  );

  const isAdmin = auth?.role === "admin";
  if (!dir.published && !isAdmin) {
    return (
      <div className="main-content">
        <div className="notfound">
          <div className="nf-card">
            <h2>Directory item not found</h2>
            <p className="nf-msg">The directory entry you're looking for isn't available.</p>
            <div className="nf-actions">
              <Link className="see-all-link" to="/directories">Back to Directories</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const visitUrl = (dir.extra && (dir.extra.directoryLink || dir.extra.link)) || dir.link || null;
  const imageSrc = dir.imageUrl || dir.thumbnailUrl || "/images/directoryplaceholder.png";
  const contentHtml = transformContentHeadings(dir.content || dir.excerpt || dir.desc || "");

  return (
    <div className="main-content">
      <div className="detail-card">
        <Breadcrumbs items={[{ label: "Home", to: "/index" }, { label: "Directories", to: "/directories" }, { label: dir.title }]} />
        <img className="detail-img" style={{ maxWidth: 300 }} src={imageSrc} alt={dir.title} />
        <h1 className="detail-title">{dir.title}</h1>

        <div className="detail-categories">
          {(dir.categories || []).map(cid => (
            <Link key={cid} to={`/category/${cid}`} className="detail-category-box" style={{ textDecoration: "none" }}>{catsMap[cid] || cid}</Link>
          ))}
        </div>

        <div style={{ marginTop: 12, marginBottom: 14 }}>
          <button className="account-action-btn" onClick={toggleFavorite} aria-pressed={isFav} disabled={favLoading}>
            {favLoading ? "…" : (isFav ? "Remove from Favorites" : "Add to Favorites")}
          </button>
          {visitUrl && <a className="account-action-btn" href={visitUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}>Visit</a>}
        </div>

        {favError && <div className="account-message" style={{ marginTop: 8 }}>{favError}</div>}

        <div className="detail-description"><strong>Description:</strong> <div dangerouslySetInnerHTML={{ __html: contentHtml }} /></div>

        {(dir.extra && (dir.extra.phone || dir.extra.contact)) && (
          <div className="detail-description"><strong>Contact:</strong> {dir.extra?.phone || dir.extra?.contact}</div>
        )}
      </div>
    </div>
  );
}