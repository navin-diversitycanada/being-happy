import React, { useEffect, useState } from "react";

/**
 * AddToHomeScreen.jsx
 * - Android: listens for beforeinstallprompt and triggers deferredPrompt.prompt()
 * - iOS: shows manual instructions modal (Share -> Add to Home Screen)
 * - Shows on mobile + tablet (hidden only on wide desktop via CSS)
 * - Persists dismiss in localStorage
 *
 * Layout: title -> content paragraph(s) -> stacked buttons (Add then Dismiss)
 * Ensure this component is rendered BEFORE the Header so banner sits above header in DOM flow.
 */

const DISMISS_KEY = "bh_ath_dismissed";

function isIOS() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua);
}

function isInStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (window.navigator && window.navigator.standalone);
}

export default function AddToHomeScreen() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return; // already installed
    if (localStorage.getItem(DISMISS_KEY) === "1") return; // dismissed by user

    // Capture beforeinstallprompt for Android/Chrome
    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // If running on iOS Safari show modal fallback
    if (!("onbeforeinstallprompt" in window) && isIOS()) {
      setTimeout(() => {
        if (localStorage.getItem(DISMISS_KEY) !== "1" && !isInStandaloneMode()) {
          setShowIosModal(true);
          setVisible(true);
        }
      }, 600);
    }

    // Fallback for Android devices that won't fire event
    const maybeAndroid = /android/i.test(navigator.userAgent || "");
    if (maybeAndroid && !("onbeforeinstallprompt" in window)) {
      setTimeout(() => {
        if (!deferredPrompt && localStorage.getItem(DISMISS_KEY) !== "1" && !isInStandaloneMode()) {
          setVisible(true);
        }
      }, 1800);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismissAll() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
    setShowIosModal(false);
  }

  async function handleAddClick() {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        // hide banner whether accepted or dismissed
        localStorage.setItem(DISMISS_KEY, "1");
        setVisible(false);
      } catch (err) {
        console.warn("Install prompt failed", err);
        setVisible(false);
      } finally {
        setDeferredPrompt(null);
      }
    } else {
      // No prompt available — show instructions modal (works for iOS & Android manual)
      setShowIosModal(true);
    }
  }

  if (!visible) return null;

  return (
    <>
      <div className="bh-ath-banner" role="region" aria-label="Add to home screen">
        <div className="bh-ath-content">
          <div className="bh-ath-text">
            <strong>Install Being Happy</strong>
            <p className="bh-ath-sub">Tap to add this app to your home screen</p>
          </div>

          <div className="bh-ath-actions" aria-hidden={false}>
            <button
              className="bh-ath-btn bh-ath-add"
              onClick={handleAddClick}
              aria-label="Add to Home Screen"
              type="button"
            >
              Add
            </button>

            <button
              className="bh-ath-btn bh-ath-dismiss"
              onClick={dismissAll}
              aria-label="Dismiss install banner"
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {showIosModal && (
        <div className="bh-ath-modal" role="dialog" aria-modal="true">
          <div className="bh-ath-modal-inner">
            <h3>Add to Home Screen</h3>
            <p>To install this app on your device:</p>
            <ol>
              <li>Open the browser menu (Share icon on iOS / three dots on Android).</li>
              <li>Tap <strong>Add to Home Screen</strong> (or <em>Install</em> on Android).</li>
              <li>Tap <strong>Add</strong>.</li>
            </ol>
            <p className="bh-ath-note">On iPhone/iPad: use the Share button → Add to Home Screen. On Android Chrome: you may also see a prompt in the address bar.</p>
            <div className="bh-ath-modal-actions" style={{ marginTop: 12 }}>
              <button
                className="bh-ath-btn"
                onClick={() => { localStorage.setItem(DISMISS_KEY, "1"); setShowIosModal(false); setVisible(false); }}
                type="button"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}