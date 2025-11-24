// src/pages/Video.jsx
// Updated: title renders as H1 (no inline margin), transformContentHeadings sets letter-spacing + margins.
// Detail image keeps max-width via inline style but spacing is controlled in CSS.

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

export default function Video() {
  const { id } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
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
        setVideo(p);
        const map = {};
        (cats || []).forEach(c => { map[c.id] = c.name; });
        setCatsMap(map);

        const fav = await isFavorited(currentUid || null, id).catch(() => false);
        if (!mounted) return;
        setIsFav(fav);
      } catch (err) {
        console.error("Failed to load video", err);
        if (mounted) setVideo(null);
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
      const imageSrc = video.imageUrl || video.thumbnailUrl || null;
      if (isFav) {
        await removeFavorite(currentUid, id);
        setIsFav(false);
      } else {
        await addFavorite(currentUid, { id, title: video?.title || null, type: video?.type || "video", thumbnailUrl: imageSrc });
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
  if (!video) return (
    <div className="main-content"><div className="notfound"><div className="nf-card"><h2>Video not found</h2><Link to="/video-library" className="see-all-link">Back to Video Library</Link></div></div></div>
  );

  const isAdmin = auth?.role === "admin";
  if (!video.published && !isAdmin) {
    return (
      <div className="main-content">
        <div className="notfound">
          <div className="nf-card">
            <h2>Video not found</h2>
            <p className="nf-msg">The video you're looking for isn't available.</p>
            <div className="nf-actions">
              <Link className="see-all-link" to="/video-library">Back to Video Library</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const imageSrc = video.imageUrl || video.thumbnailUrl || "/images/placeholder.png";
  const contentHtml = transformContentHeadings(video.content || video.excerpt || "");

  return (
    <div className="main-content">
      <div className="detail-card">
        <Breadcrumbs items={[{ label: "Home", to: "/index" }, { label: "Video", to: "/video-library" }, { label: video.title }]} />
        <img className="detail-img" src={imageSrc} alt={video.title} style={{ maxWidth: "600px" }} />
        <h1 className="detail-title">{video.title}</h1>
        <div className="detail-categories">
          {(video.categories || []).map(cid => (
            <Link key={cid} to={`/category/${cid}`} className="detail-category-box" style={{ textDecoration: "none" }}>{catsMap[cid] || cid}</Link>
          ))}
        </div>

        <div style={{ marginTop: 12, marginBottom: 14 }}>
          <button className="account-action-btn" onClick={toggleFavorite} aria-pressed={isFav} disabled={favLoading}>
            {favLoading ? "…" : (isFav ? "Remove from Favorites" : "Add to Favorites")}
          </button>
        </div>

        {favError && <div className="account-message error-text" style={{ marginTop: 8 }}>{favError}</div>}

        <div className="detail-description" dangerouslySetInnerHTML={{ __html: contentHtml }} />

        {video.youtubeId && <div className="detail-youtube"><iframe src={`https://www.youtube.com/embed/${video.youtubeId}`} title={video.title} frameBorder="0" allowFullScreen /></div>}
      </div>
    </div>
  );
}