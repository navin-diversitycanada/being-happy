// src/pages/Article.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getPost } from "../api/posts";
import { listCategories } from "../api/categories";
import { useAuth } from "../contexts/AuthContext";
import { addFavorite, removeFavorite, isFavorited } from "../api/favorites";

/**
 * Article detail page — Firestore-backed.
 * - Category names link to the category page (/category/:id)
 * - Favorites are persisted to users/{uid}/favorites subcollection
 */
function getLocalFavorites() {
  try {
    const raw = localStorage.getItem("bh_favorites");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function setLocalFavorites(arr) {
  try { localStorage.setItem("bh_favorites", JSON.stringify(arr)); } catch (e) {}
}

export default function Article() {
  const { id } = useParams();
  const auth = useAuth();
  const [article, setArticle] = useState(null);
  const [catsMap, setCatsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const currentUid = auth?.user?.uid || null;

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const cats = await listCategories().catch(() => []);
        const map = {};
        (cats || []).forEach(c => { map[c.id] = c.name; });
        if (!mounted) return;
        setCatsMap(map);

        const p = await getPost(id);
        if (!mounted) return;
        setArticle(p);

        if (currentUid) {
          const fav = await isFavorited(currentUid, id).catch(() => false);
          if (!mounted) return;
          setIsFav(fav);
        } else {
          setIsFav(getLocalFavorites().includes(id));
        }
      } catch (err) {
        console.error("Failed to load article", err);
        if (mounted) setArticle(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [id, currentUid]);

  async function toggleFavorite() {
    if (!currentUid) {
      // fallback to localStorage for unauthenticated user
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
        // include minimal metadata if present
        await addFavorite(currentUid, { id, title: article?.title || null, type: article?.type || "article" });
        setIsFav(true);
      }
    } catch (err) {
      console.error("Failed to toggle favorite", err);
    }
  }

  if (loading) return <div className="main-content"><div style={{ padding: 12 }}>Loading…</div></div>;
  if (!article) {
    return (
      <div className="main-content">
        <div className="notfound">
          <div className="nf-card">
            <h2>Article not found</h2>
            <Link to="/articles" className="see-all-link">Back to Articles</Link>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = auth?.role === "admin";
  if (!article.published && !isAdmin) {
    return (
      <div className="main-content">
        <div className="notfound">
          <div className="nf-card">
            <h2>Article not found</h2>
            <p className="nf-msg">The article you're looking for isn't available.</p>
            <div className="nf-actions">
              <Link className="see-all-link" to="/articles">Back to Articles</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const imageSrc = article.imageUrl || article.thumbnailUrl || "/images/placeholder.png";

  return (
    <div className="main-content">
      <div className="detail-card">
        <img className="detail-img" src={imageSrc} alt={article.title} />
        <div className="detail-title">{article.title}</div>
        <div className="detail-categories">
          <Link to={`/category/article`} className="detail-category-box">Article</Link>
          {(article.categories || []).map(cid => {
            const name = catsMap[cid] || cid;
            return <Link key={cid} to={`/category/${cid}`} className="detail-category-box">{name}</Link>;
          })}
        </div>

        <div style={{ marginTop: 12, marginBottom: 14 }}>
          <button className="account-action-btn" onClick={toggleFavorite} aria-pressed={isFav}>{isFav ? "Remove from Favorites" : "Add to Favorites"}</button>
        </div>

        <div className="article-content" dangerouslySetInnerHTML={{ __html: article.content || article.excerpt || "" }} />
      </div>
    </div>
  );
}