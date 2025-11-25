import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { listFavorites } from "../api/favorites";
import Breadcrumbs from "../components/Breadcrumbs";

export default function Account() {
  const auth = useAuth();
  const user = auth?.user || null;
  const uid = user?.uid || null;
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [activeSection, setActiveSection] = useState(null);

  // Saved items state
  const [saved, setSaved] = useState([]);
  const [savedTotal, setSavedTotal] = useState(0);
  const [savedPage, setSavedPage] = useState(1);
  const [savedQuery, setSavedQuery] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(false);
  const PAGE_SIZE = 12; // changed to 12 per request

  // Profile edit form
  const [newName, setNewName] = useState("");
  const [changingName, setChangingName] = useState(false);

  // Reset password messages
  const [resetMsg, setResetMsg] = useState("");

  // New: user-visible messages for profile ops (use salmon color via CSS)
  const [profileMsg, setProfileMsg] = useState("");

  // Ref + minHeight to keep saved items area stable when searching
  const savedGridRef = useRef(null);
  const [savedGridMinHeight, setSavedGridMinHeight] = useState(0);

  useEffect(() => {
    if (user) {
      const cap = (user.displayName || "")
        .split(" ")
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
        .join(" ");
      setName(cap);
      setNewName(cap);
      setEmail(user.email || "");
    } else {
      setName("");
      setEmail("");
    }
  }, [user]);

  useEffect(() => {
    setProfileMsg("");
    setResetMsg("");
  }, [activeSection]);

  useEffect(() => {
    let mounted = true;
    async function loadSaved() {
      if (!uid) {
        setSaved([]);
        setSavedTotal(0);
        return;
      }

      setLoadingSaved(true);
      try {
        const { total, items } = await listFavorites(uid, savedPage, PAGE_SIZE, savedQuery);
        if (!mounted) return;
        setSavedTotal(total || 0);

        // Map favorites to the UI model:
        // - Use directoryplaceholder.png for directory items when no thumbnail is present
        // - Use normal placeholder.png for other types when no thumbnail is present
        const mapped = (items || []).map((it) => {
          const id = it.itemId || it.id;
          const type = (it.type || "article").toString().toLowerCase();
          const thumb = it.thumbnailUrl || it.imageUrl || null;
          const fallback = type === "directory" ? "/images/directoryplaceholder.png" : "/images/placeholder.png";
          return {
            id,
            title: it.title || "Saved item",
            thumbnailUrl: thumb || fallback,
            type: type || "article",
          };
        });
        setSaved(mapped);
      } catch (err) {
        console.error("Failed to load saved items", err);
        if (mounted) {
          setSaved([]);
          setSavedTotal(0);
        }
      } finally {
        if (mounted) setLoadingSaved(false);
      }
    }
    loadSaved();
    return () => {
      mounted = false;
    };
  }, [uid, savedPage, savedQuery]);

  // Compute and lock a minHeight for the saved items container when the full page (no search)
  // renders for the first time. This prevents the container from shrinking when searches
  // reduce the number of visible cards.
  useEffect(() => {
    function computeMinHeight() {
      const container = savedGridRef.current;
      if (!container) return;
      // only compute when we don't yet have a locked minHeight and when we have cards
      if (savedGridMinHeight) return;
      const firstCard = container.querySelector(".card");
      if (!firstCard) return;

      const cardRect = firstCard.getBoundingClientRect();
      const cardHeight = Math.max(0, Math.round(cardRect.height));

      // determine columns used by layout: desktop 3, tablet/mobile 2 (matches CSS)
      const columns = typeof window !== "undefined" && window.innerWidth > 900 ? 3 : 2;
      const rows = Math.ceil(PAGE_SIZE / columns);

      // attempt to read row-gap; fallback to 16px approximate if not available
      const style = window.getComputedStyle(container);
      const gapValue = style.getPropertyValue("row-gap") || style.getPropertyValue("gap") || style.gap || "16px";
      const gap = parseFloat(gapValue) || 16;

      const minH = rows * cardHeight + Math.max(0, rows - 1) * gap;
      if (minH && minH > 0) {
        setSavedGridMinHeight(Math.ceil(minH));
      }
    }

    // Only lock minHeight when there's no active search (we want the "original" size)
    if (!savedQuery) {
      // compute after layout settles
      const t = setTimeout(computeMinHeight, 80);
      window.addEventListener("resize", computeMinHeight);
      return () => {
        clearTimeout(t);
        window.removeEventListener("resize", computeMinHeight);
      };
    }
    // when searching, do nothing (keep previously computed minHeight)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, savedQuery, savedGridMinHeight]);

  async function handleChangeName(e) {
    e?.preventDefault?.();
    setProfileMsg("");
    if (!auth || !auth.updateProfileInfo) {
      setProfileMsg("Profile update not available.");
      return;
    }
    try {
      setChangingName(true);
      await auth.updateProfileInfo({ displayName: newName });
      setName(newName);
      setActiveSection(null);
      setProfileMsg("Name updated.");
    } catch (err) {
      console.error("Failed to update name", err);
      if (auth?.role === "admin") {
        setProfileMsg("Failed to update name: " + (err?.message || err));
      } else {
        setProfileMsg("Error updating profile. Please try again.");
      }
    } finally {
      setChangingName(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setResetMsg("No email available");
      return;
    }
    try {
      const res = await auth.requestPasswordReset(email);
      setResetMsg("Password reset email sent.");
    } catch (err) {
      console.error("Reset email failed", err);
      if (auth?.role === "admin") {
        setResetMsg("Reset email failed: " + (err?.message || err));
      } else {
        setResetMsg("Failed to send reset email. Please try again.");
      }
    }
  }

  return (
    <div>
      <div className="main-content">
        <div className="account-card">
          <div style={{ width: "100%", marginBottom: 16 }}>
            <Breadcrumbs items={[{ label: "Home", to: "/index" }, { label: "Account" }]} />
          </div>

          <div className="account-details">
            <div className="account-name" id="accountName">
              {name || "—"}
            </div>
            <div className="account-categories">
              <span className="account-category-box">
                {auth?.role ? auth.role.charAt(0).toUpperCase() + auth.role.slice(1) : "User"}
              </span>
            </div>
            <div className="account-email" id="accountEmail">
              {email || "—"}
            </div>
          </div>

          <div className="account-actions">
            <button className="account-action-btn" onClick={() => setActiveSection("name")}>
              Change Name
            </button>
            <button className="account-action-btn" onClick={() => setActiveSection("password")}>
              Change Password
            </button>
            <button className="account-action-btn" onClick={() => setActiveSection("saved")}>
              Saved Items
            </button>
          </div>

          {/* Success / info messages */}
          {profileMsg && (
            <div className="account-message" style={{ marginTop: 8 }}>
              {profileMsg}
            </div>
          )}

          {/* Change name */}
          <div className={`account-form-section ${activeSection === "name" ? "active" : ""}`} aria-hidden={activeSection !== "name"}>
            <form onSubmit={handleChangeName}>
              <label className="form-label">Full name</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="account-action-btn" disabled={changingName}>
                  {changingName ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="see-all-link"
                  onClick={() => {
                    setActiveSection(null);
                    setNewName(name);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>

          {/* Reset password */}
          <div className={`account-form-section ${activeSection === "password" ? "active" : ""}`} aria-hidden={activeSection !== "password"}>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="account-action-btn" onClick={handleResetPassword}>
                Send reset email
              </button>
              <button className="see-all-link" onClick={() => setActiveSection(null)}>
                Cancel
              </button>
            </div>
            {resetMsg && (
              <div className="account-message" style={{ marginTop: 20, color: "salmon", marginBottom: 24, textAlign: "left" }}>
                {resetMsg}
              </div>
            )}
          
          </div>

          {/* Saved Items */}
          <div className={`account-form-section ${activeSection === "saved" ? "active" : ""}`} id="savedItemsSection" aria-hidden={activeSection !== "saved"}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: "var(--cream)", fontFamily: "'Bebas Neue', cursive" }}>Saved Items</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>Showing your saved content</div>
            </div>

            {!uid && (
              <div style={{ marginBottom: 12 }}>
                <div className="muted">You must be signed in to view your saved items.</div>
                <div style={{ marginTop: 8 }}>
                  <button className="account-action-btn" onClick={() => navigate("/login")}>
                    Sign in
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <input
                className="text-input"
                placeholder="Search saved items"
                value={savedQuery}
                onChange={(e) => {
                  setSavedQuery(e.target.value);
                  setSavedPage(1);
                }}
              />
            </div>

            {loadingSaved ? (
              <div className="muted">Loading…</div>
            ) : (
              <>
                <div
                  ref={savedGridRef}
                  className="flex-card-grid saved-grid"
                  role="list"
                  style={{ minHeight: savedGridMinHeight ? `${savedGridMinHeight}px` : undefined }}
                >
                  {saved.map((s) => {
                    const dest = `/${s.type === "video" ? "video" : s.type === "audio" ? "audio" : s.type === "directory" ? "directory" : "article"}/${s.id}`;
                    // ensure final fallback here too (defensive)
                    const imgSrc = s.thumbnailUrl || (s.type === "directory" ? "/images/directoryplaceholder.png" : "/images/placeholder.png");
                    return (
                      <Link key={s.id} className="card" to={dest} role="listitem">
                        <img className="card-img" src={imgSrc} alt={s.title} />
                        <div className="card-content">
                          <div className="card-title">{s.title}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                  <button className="see-all-link" onClick={() => setSavedPage((p) => Math.max(1, p - 1))} disabled={savedPage <= 1}>
                    Prev
                  </button>
                  <div style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>
                    {savedPage} • {savedTotal}
                  </div>
                  <button
                    className="see-all-link"
                    onClick={() => setSavedPage((p) => p + 1)}
                    disabled={savedPage * PAGE_SIZE >= savedTotal}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}