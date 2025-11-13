// src/pages/Directory.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getPost } from "../api/posts";
import { listCategories } from "../api/categories";
import { useAuth } from "../contexts/AuthContext";
import { addFavorite, removeFavorite, isFavorited } from "../api/favorites";

/**
 * Directory detail page — shows category names (clickable) and supports persisted favorites.
 */

function getLocalFavorites() {
  try { const raw = localStorage.getItem("bh_favorites"); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
}
function setLocalFavorites(arr) { try { localStorage.setItem("bh_favorites", JSON.stringify(arr)); } catch (e) {} }

export default function Directory() {
  const { id } = useParams();
  const auth = useAuth();
  const [dir, setDir] = useState(null);
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
        setDir(p);
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
        await addFavorite(currentUid, { id, title: dir?.title || null, type: dir?.type || "directory" });
        setIsFav(true);
      }
    } catch (err) {
      console.error("Failed to toggle favorite", err);
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

  return (
    <div className="main-content">
      <div className="detail-card">
        <div className="detail-title">{dir.title}</div>

        <div className="detail-categories">
          {(dir.categories || []).map(cid => (
            <Link key={cid} to={`/category/${cid}`} className="detail-category-box">{catsMap[cid] || cid}</Link>
          ))}
        </div>

        <div style={{ marginTop: 12, marginBottom: 14 }}>
          <button className="account-action-btn" onClick={toggleFavorite} aria-pressed={isFav}>{isFav ? "Remove from Favorites" : "Add to Favorites"}</button>
          {visitUrl && <a className="account-action-btn" href={visitUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}>Visit</a>}
        </div>

        <div className="detail-description"><strong>Description:</strong> <div dangerouslySetInnerHTML={{ __html: dir.content || dir.excerpt || dir.desc || "" }} /></div>

        {/* Only render contact section if contact info exists */}
        {(dir.extra && (dir.extra.phone || dir.extra.contact)) && (
          <div className="detail-description"><strong>Contact:</strong> {dir.extra?.phone || dir.extra?.contact}</div>
        )}
      </div>
    </div>
  );
}