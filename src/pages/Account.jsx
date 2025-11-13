// src/pages/Account.jsx
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import { listFavorites, removeFavorite as apiRemoveFavorite } from "../api/favorites";

/**
 * Account page — now reads saved items from Firestore users/{uid}/favorites
 * - Pagination (page size 10) and search.
 * - Existing saved-items UI replaced with live content when logged in.
 */

function localFavs() {
  try { const raw = localStorage.getItem("bh_favorites"); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
}

export default function Account() {
  const auth = useAuth();
  const user = auth?.user || null;
  const uid = user?.uid || null;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [activeSection, setActiveSection] = useState(null);
  const [profileSrc, setProfileSrc] = useState("/images/profile.jpg");

  // Saved items state
  const [saved, setSaved] = useState([]);
  const [savedTotal, setSavedTotal] = useState(0);
  const [savedPage, setSavedPage] = useState(1);
  const [savedQuery, setSavedQuery] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(false);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (user) {
      const cap = (user.displayName || "").split(" ").map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : "").join(" ");
      setName(cap);
      setEmail(user.email || "");
      if (user.photoURL) setProfileSrc(user.photoURL);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    async function loadSaved() {
      if (!uid) {
        // show localStorage favorites when not logged in
        const ids = localFavs();
        setSaved(ids.map(id => ({ id, title: "Saved (offline)", thumbnailUrl: "/images/placeholder.png" })));
        setSavedTotal(ids.length);
        return;
      }

      setLoadingSaved(true);
      try {
        const { total, items } = await listFavorites(uid, savedPage, PAGE_SIZE, savedQuery);
        if (!mounted) return;
        setSavedTotal(total || 0);

        // Map simple entries to display shape (we keep itemId => id)
        const mapped = (items || []).map(it => ({
          id: it.itemId || it.id,
          title: it.title || "Saved item",
          thumbnailUrl: "/images/placeholder.png"
        }));
        setSaved(mapped);
      } catch (err) {
        console.error("Failed to load saved items", err);
        if (mounted) setSaved([]);
      } finally {
        if (mounted) setLoadingSaved(false);
      }
    }
    loadSaved();
    return () => { mounted = false; };
  }, [uid, savedPage, savedQuery]);

  async function handleRemoveSaved(itemId) {
    if (!uid) {
      // offline local remove
      const arr = localFavs().filter(x => x !== itemId);
      try { localStorage.setItem("bh_favorites", JSON.stringify(arr)); } catch (e) {}
      setSaved(saved.filter(s => s.id !== itemId));
      setSavedTotal(prev => Math.max(0, prev - 1));
      return;
    }
    try {
      await apiRemoveFavorite(uid, itemId);
      // refresh list
      setSavedPage(1);
      const { total, items } = await listFavorites(uid, 1, PAGE_SIZE, savedQuery);
      setSavedTotal(total || 0);
      const mapped = (items || []).map(it => ({ id: it.itemId || it.id, title: it.title || "Saved item", thumbnailUrl: "/images/placeholder.png" }));
      setSaved(mapped);
    } catch (err) {
      console.error("Failed to remove favorite", err);
    }
  }

  return (
    <div>
      <div className="main-content">
        <div className="account-card">
          <img src={profileSrc} className="account-profile-pic" alt="Profile Picture" />
          <div className="account-details">
            <div className="account-name" id="accountName">{name || "—"}</div>
            <div className="account-categories">
              <span className="account-category-box">{auth?.role ? auth.role : "User"}</span>
            </div>
            <div className="account-email" id="accountEmail">{email || "—"}</div>
          </div>

          <div className="account-actions">
            <button className="account-action-btn" onClick={() => setActiveSection("name")}>Change Name</button>
            <button className="account-action-btn" onClick={() => setActiveSection("password")}>Change Password</button>
            <button className="account-action-btn" onClick={() => setActiveSection("pic")}>Change Profile Pic</button>
            <button className="account-action-btn" onClick={() => setActiveSection("saved")}>Saved Items</button>
          </div>

          {/* Saved Items */}
          <div className={`account-form-section ${activeSection === "saved" ? "active" : ""}`} id="savedItemsSection" aria-hidden={activeSection !== "saved"}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: "var(--cream)", fontFamily: "'Bebas Neue', cursive" }}>Saved Items</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>Showing your saved content</div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <input className="text-input" placeholder="Search saved items" value={savedQuery} onChange={(e) => { setSavedQuery(e.target.value); setSavedPage(1); }} />
            </div>

            {loadingSaved ? <div className="muted">Loading…</div> : (
              <>
                <div className="flex-card-grid" role="list">
                  {saved.map(s => (
                    <div key={s.id} style={{ maxWidth: 340 }}>
                      <Link className="card" to={`/${s.type === "video" ? "video" : s.type === "audio" ? "audio" : s.type === "directory" ? "directory" : "article"}/${s.id}`} role="listitem">
                        <img className="card-img" src={s.thumbnailUrl || "/images/placeholder.png"} alt={s.title} />
                        <div className="card-content">
                          <div className="card-title">{s.title}</div>
                        </div>
                      </Link>
                      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <button className="see-all-link" onClick={() => handleRemoveSaved(s.id)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                  <button className="see-all-link" onClick={() => setSavedPage(p => Math.max(1, p - 1))} disabled={savedPage <= 1}>Prev</button>
                  <div style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>{savedPage} • {savedTotal}</div>
                  <button className="see-all-link" onClick={() => setSavedPage(p => p + 1)} disabled={(savedPage * PAGE_SIZE) >= savedTotal}>Next</button>
                </div>
              </>
            )}
          </div>

          {/* other account sections (name/password/pic) are unchanged and omitted here for brevity */}
        </div>
      </div>
    </div>
  );
}