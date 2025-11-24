// src/pages/Article.jsx
// Updated: title renders as H1 (no inline margin) so CSS can control spacing.
// transformContentHeadings now also sets letter-spacing and larger margins for H2/H3.

import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getPost } from "../api/posts";
import { listCategories } from "../api/categories";
import { useAuth } from "../contexts/AuthContext";
import { addFavorite, removeFavorite, isFavorited } from "../api/favorites";
import Breadcrumbs from "../components/Breadcrumbs";

/**
 * Helper: transform headings in HTML to apply title-like styling (keeps font family/weight/color)
 * but with smaller font sizes for H2/H3 and increased letter-spacing + margins.
 * Returns transformed HTML string.
 */
function transformContentHeadings(html) {
  if (!html) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const applyStyle = (el, size) => {
      // inline styles so we don't rely on global CSS when content is injected
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

    // ensure hr elements inside content have suitable spacing
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

export default function Article() {
  const { id } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
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
        const cats = await listCategories().catch(() => []);
        const map = {};
        (cats || []).forEach(c => { map[c.id] = c.name; });
        if (!mounted) return;
        setCatsMap(map);

        const p = await getPost(id);
        if (!mounted) return;
        setArticle(p);

        const fav = await isFavorited(currentUid || null, id).catch(() => false);
        if (!mounted) return;
        setIsFav(fav);
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
    setFavError("");
    if (!currentUid) {
      if (window.confirm("You must be signed in to save favorites. Sign in now?")) {
        navigate("/login");
      }
      return;
    }
    if (!navigator.onLine) {
      setFavError("You must be online to save favorites.");
      return;
    }
    setFavLoading(true);
    try {
      const imageSrc = article.imageUrl || article.thumbnailUrl || null;
      if (isFav) {
        await removeFavorite(currentUid, id);
        setIsFav(false);
      } else {
        await addFavorite(currentUid, { id, title: article?.title || null, type: article?.type || "article", thumbnailUrl: imageSrc });
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
  const contentHtml = transformContentHeadings(article.content || article.excerpt || "");

  return (
    <div className="main-content">
      <div className="detail-card">
        <Breadcrumbs items={[{ label: "Home", to: "/index" }, { label: "Article", to: "/articles" }, { label: article.title }]} />
        <img className="detail-img" src={imageSrc} alt={article.title} style={{ maxWidth: "600px" }} />
        <h1 className="detail-title">{article.title}</h1>
        <div className="detail-categories">
          <Link to={`/category/article`} className="detail-category-box" style={{ textDecoration: "none" }}>Article</Link>
          {(article.categories || []).map(cid => {
            const name = catsMap[cid] || cid;
            return <Link key={cid} to={`/category/${cid}`} className="detail-category-box" style={{ textDecoration: "none" }}>{name}</Link>;
          })}
        </div>

        <div style={{ marginTop: 12, marginBottom: 14 }}>
          <button className="account-action-btn" onClick={toggleFavorite} aria-pressed={isFav} disabled={favLoading}>
            {favLoading ? "…" : (isFav ? "Remove from Favorites" : "Add to Favorites")}
          </button>
        </div>

        {favError && <div className="account-message error-text" style={{ marginTop: 8 }}>{favError}</div>}

        <div className="article-content" dangerouslySetInnerHTML={{ __html: contentHtml }} />
      </div>
    </div>
  );
}