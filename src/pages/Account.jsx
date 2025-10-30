import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";

/**
 * Account page (updated)
 * - Calls useAuth() unconditionally (fixes the ESLint hooks rule).
 * - Sets name/email/profile state via useEffect when user becomes available.
 * - Capitalizes first letter of the name for display (and input).
 * - Uses refs for password inputs to avoid document.getElementById.
 *
 * Paste this file to src/pages/Account.jsx (overwrite existing).
 */

function capitalizeName(raw = "") {
  if (!raw) return "";
  return raw
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

export default function Account() {
  // Call the hook unconditionally (required by rules-of-hooks)
  const auth = useAuth();
  const user = auth?.user || null;

  // Controlled UI state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [activeSection, setActiveSection] = useState(null); // "name" | "password" | "pic" | "saved" | null

  const [nameMsg, setNameMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [picMsg, setPicMsg] = useState("");

  const [profileSrc, setProfileSrc] = useState("/images/profile.jpg");
  const newPicRef = useRef(null);
  const newPasswordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  // When auth user changes, populate fields (store capitalized name)
  useEffect(() => {
    if (user) {
      const cap = capitalizeName(user.displayName || "");
      setName(cap);
      setEmail(user.email || "");
      if (user.photoURL) setProfileSrc(user.photoURL);
    }
  }, [user]);

  function hideSections() {
    setActiveSection(null);
    setNameMsg("");
    setPasswordMsg("");
    setPicMsg("");
  }

  function handleSaveName() {
    if (!name.trim()) {
      setNameMsg("Name cannot be empty.");
      return;
    }
    setNameMsg("Name updated!");
    // TODO: if using Firebase Auth, call updateProfile(auth.user, { displayName: name })
  }

  function handleSavePassword() {
    const pass = newPasswordRef.current?.value || "";
    const conf = confirmPasswordRef.current?.value || "";
    if (!pass || !conf) {
      setPasswordMsg("Both fields required.");
      return;
    }
    if (pass !== conf) {
      setPasswordMsg("Passwords do not match.");
      return;
    }
    setPasswordMsg("Password changed!");
    // Clear inputs
    if (newPasswordRef.current) newPasswordRef.current.value = "";
    if (confirmPasswordRef.current) confirmPasswordRef.current.value = "";
    // TODO: implement actual password update via Firebase Auth (reauth required)
  }

  function handleSavePic() {
    const file = newPicRef.current?.files?.[0];
    if (!file) {
      setPicMsg("Please select an image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      setProfileSrc(e.target.result);
      setPicMsg("Profile picture updated!");
      if (newPicRef.current) newPicRef.current.value = "";
      // TODO: upload to Storage and update user.profile.photoURL in production
    };
    reader.readAsDataURL(file);
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
            <button className="account-action-btn" id="changeNameBtn" onClick={() => { hideSections(); setActiveSection("name"); }}>Change Name</button>
            <button className="account-action-btn" id="changePasswordBtn" onClick={() => { hideSections(); setActiveSection("password"); }}>Change Password</button>
            <button className="account-action-btn" id="changePicBtn" onClick={() => { hideSections(); setActiveSection("pic"); }}>Change Profile Pic</button>
            <button className="account-action-btn" id="savedItemsBtn" onClick={() => { hideSections(); setActiveSection("saved"); }}>Saved Items</button>
          </div>

          {/* Change Name */}
          <div className={`account-form-section ${activeSection === "name" ? "active" : ""}`} id="changeNameSection">
            <label className="form-label" htmlFor="newName">New Name</label>
            <input type="text" id="newName" placeholder="Enter new name" value={name} onChange={(e) => setName(e.target.value)} />
            <button id="saveNameBtn" onClick={handleSaveName}>Save Name</button>
            <div className="account-message" id="nameMsg">{nameMsg}</div>
          </div>

          {/* Change Password */}
          <div className={`account-form-section ${activeSection === "password" ? "active" : ""}`} id="changePasswordSection">
            <label className="form-label" htmlFor="newPassword">New Password</label>
            <input type="password" id="newPassword" placeholder="Enter new password" ref={newPasswordRef} />
            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
            <input type="password" id="confirmPassword" placeholder="Confirm new password" ref={confirmPasswordRef} />
            <button id="savePasswordBtn" onClick={handleSavePassword}>Save Password</button>
            <div className="account-message" id="passwordMsg">{passwordMsg}</div>
          </div>

          {/* Change Pic */}
          <div className={`account-form-section ${activeSection === "pic" ? "active" : ""}`} id="changePicSection">
            <label className="form-label" htmlFor="newPic">Upload New Profile Pic</label>
            <input type="file" id="newPic" accept="image/*" ref={newPicRef} />
            <button id="savePicBtn" onClick={handleSavePic}>Save Profile Pic</button>
            <div className="account-message" id="picMsg">{picMsg}</div>
          </div>

          {/* Saved Items */}
          <div className={`account-form-section ${activeSection === "saved" ? "active" : ""}`} id="savedItemsSection" aria-hidden={activeSection !== "saved"}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: "var(--cream)", fontFamily: "'Bebas Neue', cursive" }}>Saved Items</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>Showing your saved content</div>
            </div>
            <div className="flex-card-grid saved-grid" role="list">
              <Link className="card" to="/articles" role="listitem">
                <img className="card-img" src="/images/4.jpg" alt="Benefits of Meditation" />
                <div className="card-content">
                  <div className="card-title">Benefits of Meditation</div>
                  <div className="card-meta">Article</div>
                </div>
              </Link>

              <Link className="card" to="/meditation" role="listitem">
                <img className="card-img" src="/images/2.jpg" alt="Mindful Breathing" />
                <div className="card-content">
                  <div className="card-title">Mindful Breathing</div>
                  <div className="card-meta">Audio</div>
                </div>
              </Link>

              <Link className="card" to="/video-library" role="listitem">
                <img className="card-img" src="/images/4.jpg" alt="Joyful Moments" />
                <div className="card-content">
                  <div className="card-title">Joyful Moments</div>
                  <div className="card-meta">Video</div>
                </div>
              </Link>

              <Link className="card" to="/articles" role="listitem">
                <img className="card-img" src="/images/1.jpg" alt="Building Resilience" />
                <div className="card-content">
                  <div className="card-title">Building Resilience</div>
                  <div className="card-meta">Article</div>
                </div>
              </Link>

              <Link className="card" to="/meditation" role="listitem">
                <img className="card-img" src="/images/6.jpg" alt="Stress Relief" />
                <div className="card-content">
                  <div className="card-title">Stress Relief</div>
                  <div className="card-meta">Audio</div>
                </div>
              </Link>

              <Link className="card" to="/video-library" role="listitem">
                <img className="card-img" src="/images/5.jpg" alt="Intro to Mindfulness" />
                <div className="card-content">
                  <div className="card-title">Intro to Mindfulness</div>
                  <div className="card-meta">Video</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}