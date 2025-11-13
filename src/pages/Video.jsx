// src/pages/Video.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getPost } from "../api/posts";
import { listCategories } from "../api/categories";
import { useAuth } from "../contexts/AuthContext";
import { addFavorite, removeFavorite, isFavorited } from "../api/favorites";

function getLocalFavorites() {
  try { const raw = localStorage.getItem("bh_favorites"); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
}
function setLocalFavorites(arr) { try { localStorage.setItem("bh_favorites", JSON.stringify(arr)); } catch (e) {} }

export default function Video() {
  const { id } = useParams();
  const auth = useAuth();
  const [video, setVideo] = useState(null);
  const [catsMap, setCatsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);
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

        if (currentUid) {
          const fav = await isFavorited(currentUid, id).catch(() => false);
          if (!mounted) return;
          setIsFav(fav);
        } else {
          setIsFav(getLocalFavorites().includes(id));
        }
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
    if (!currentUid) {
      const favs = getLocalFavorites();
      if (favs.includes(id)) {
        const next = favs.filter(x => x !== id);
        setLocalFavorites(next);
        setIsFav(false);
      } else {
        const next = [...favs, id];
        setLocalFavorites(next);
        setIsFav(true);
      }
      return;
    }

    try {
      if (isFav) {
        await removeFavorite(currentUid, id);
        setIsFav(false);
      } else {
        await addFavorite(currentUid, { id, title: video?.title || null, type: video?.type || "video" });
        setIsFav(true);
      }
    } catch (err) {
      console.error("Failed to toggle favorite", err);
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

  return (
    <div className="main-content">
      <div className="detail-card">
        <img className="detail-img" src={imageSrc} alt={video.title} />
        <div className="detail-title">{video.title}</div>
        <div className="detail-categories">{(video.categories || []).map(cid => <span key={cid} className="detail-category-box">{catsMap[cid] || cid}</span>)}</div>

        <div style={{ marginTop: 12, marginBottom: 14 }}>
          <button className="account-action-btn" onClick={toggleFavorite} aria-pressed={isFav}>{isFav ? "Remove from Favorites" : "Add to Favorites"}</button>
        </div>

        <div className="detail-description" dangerouslySetInnerHTML={{ __html: video.content || video.excerpt || "" }} />

        {video.youtubeId && <div className="detail-youtube"><iframe src={`https://www.youtube.com/embed/${video.youtubeId}`} title={video.title} frameBorder="0" allowFullScreen /></div>}
      </div>
    </div>
  );
}