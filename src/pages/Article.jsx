import React from "react";
import { useParams, Link } from "react-router-dom";
import { findArticle } from "../data/mockData";

/**
 * Article detail page (src/pages/Article.jsx)
 * Route: /article/:id
 * Uses mockData findArticle to render temporary content.
 */

export default function Article() {
  const { id } = useParams();
  const article = findArticle(id);

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

  return (
    <div className="main-content">
      <div className="detail-card">
        <img className="detail-img" src={article.img} alt={article.title} />
        <div className="detail-title">{article.title}</div>
        <div className="detail-categories">
          <span className="detail-category-box">Article</span>
          {(article.categories || []).map(c => <span key={c} className="detail-category-box">{c}</span>)}
        </div>

        <div style={{ marginTop: 12, marginBottom: 14 }}>
          <button className="account-action-btn" aria-pressed="false">Add to Favorites</button>
        </div>

        <div className="article-content" dangerouslySetInnerHTML={{ __html: article.content || `<p>${article.excerpt}</p>` }} />
      </div>
    </div>
  );
}