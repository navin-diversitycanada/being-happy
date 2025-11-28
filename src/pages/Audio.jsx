// src/pages/Audio.jsx
// Updated: ensure anchors in audio content open in new tab and H2/H3 styling applied.

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

    // Ensure links open in new tab
    doc.querySelectorAll("a").forEach(a => {
      try {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      } catch (e) { /* ignore */ }
    });

    return doc.body.innerHTML || "";
  } catch (e) {
    console.warn("transformContentHeadings failed", e);
    return html;
  }
}

export default function Audio() {
  const { id } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const [audio, setAudio] = useState(null);
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
        setAudio(p);
        const map = {};
        (cats || []).forEach(c => { map[c.id] = c.name; });
        setCatsMap(map);

        const fav = await isFavorited(currentUid || null, id).catch(() => false);
        if (!mounted) return;
        setIsFav(fav);
      } catch (err) {
        console.error("Failed to load audio", err);
        if (mounted) setAudio(null);
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
      const imageSrc = audio.imageUrl || audio.thumbnailUrl || null;
      if (isFav) {
        await removeFavorite(currentUid, id);
        setIsFav(false);
      } else {
        await addFavorite(currentUid, { id, title: audio?.title || null, type: audio?.type || "audio", thumbnailUrl: imageSrc });
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
  if (!audio) return (
    <div className="main-content"><div className="notfound"><div className="nf-card"><h2>Audio not found</h2><Link to="/meditation" className="see-all-link">Back</Link></div></div></div>
  );

  const isAdmin = auth?.role === "admin";
  if (!audio.published && !isAdmin) {
    return (
      <div className="main-content">
        <div className="notfound">
          <div className="nf-card">
            <h2>Audio not found</h2>
            <p className="nf-msg">The audio you're looking for isn't available.</p>
            <div className="nf-actions">
              <Link className="see-all-link" to="/meditation">Back to Meditation</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const imageSrc = audio.imageUrl || audio.thumbnailUrl || "/images/placeholder.png";
  const contentHtml = transformContentHeadings(audio.content || audio.excerpt || "");

  return (
    <div className="main-content">
      <div className="detail-card">
        <Breadcrumbs items={[{ label: "Home", to: "/index" }, { label: "Meditations", to: "/meditation" }, { label: audio.title }]} />
        <img className="detail-img" src={imageSrc} alt={audio.title} style={{ maxWidth: "600px" }} />
        <h1 className="detail-title">{audio.title}</h1>
        <div className="detail-categories">
          {(audio.categories || []).map(cid => (
            <Link key={cid} to={`/category/${cid}`} className="detail-category-box" style={{ textDecoration: "none" }}>{catsMap[cid] || cid}</Link>
          ))}
        </div>

        <div style={{ marginTop: 0, marginBottom: 0 }}>
          <button className="account-action-btn" onClick={toggleFavorite} aria-pressed={isFav} disabled={favLoading}>
            {favLoading ? "…" : (isFav ? "Remove from Favorites" : "Add to Favorites")}
          </button>
        </div>

        {favError && <div className="account-message error-text" style={{ marginTop: 8 }}>{favError}</div>}

        <div className="detail-description" dangerouslySetInnerHTML={{ __html: contentHtml }} />

        {audio.youtubeId && (
          <div className="detail-youtube">
            <iframe src={`https://www.youtube.com/embed/${audio.youtubeId}`} title={audio.title} frameBorder="0" allowFullScreen />
          </div>
        )}
      </div>
    </div>
  );
}