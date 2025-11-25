// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  confirmPasswordReset as fbConfirmPassword,
  updateProfile as fbUpdateProfile,
  GoogleAuthProvider,
  FacebookAuthProvider
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { auth, db, firebaseConfig, googleProvider, facebookProvider } from "../firebase";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * AuthProvider
 *
 * Notes:
 * - register() now explicitly sets the Firebase Auth profile.displayName using
 *   updateProfile before signing the user out. This ensures the auth user has
 *   displayName populated so subsequent sign-ins will surface the name.
 *
 * - Social sign-in helpers (Google/Facebook) now prefer any existing users/{uid}.displayName
 *   value and will NOT overwrite a stored name. If a Firestore user doc has a displayName
 *   it will be applied to the Firebase Auth profile for the signed in user so the
 *   displayName remains stable across provider logins.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disabledMessage, setDisabledMessage] = useState("");

  const suppressAutoSignoutRef = useRef(false);

  useEffect(() => {
    let unsubUserDoc = null;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      if (unsubUserDoc) {
        try { unsubUserDoc(); } catch (e) {}
        unsubUserDoc = null;
      }
      setDisabledMessage("");

      if (u) {
        try {
          const hasPasswordProvider = Array.isArray(u.providerData) && u.providerData.some(p => p && p.providerId === "password");
          if (hasPasswordProvider && !u.emailVerified) {
            // Only auto sign-out if not suppressed by register flow
            if (!suppressAutoSignoutRef.current) {
              setDisabledMessage("Please verify your email address. A verification link was sent when you registered.");
              try { await signOut(auth); } catch (e) { /* ignore signOut errors */ }
              setUser(null);
              setRole(null);
              setLoading(false);
              return;
            } else {
              // suppressed -> allow the register flow to finish
            }
          }
        } catch (err) {
          console.warn("Email verification check failed (continuing):", err);
        }

        try {
          if (u && typeof u.getIdToken === "function") {
            await u.getIdToken(true);
          }
        } catch (err) {
          console.warn("Token refresh prior to user-doc read failed (continuing):", err);
        }

        setUser(u);

        try {
          const ref = doc(db, "users", u.uid);

          // Best-effort read to detect disabled flag
          try {
            const snap = await getDoc(ref);
            if (snap.exists()) {
              const data = snap.data() || {};
              if (data.disabled === true) {
                setDisabledMessage("Your account is disabled");
                try { await signOut(auth); } catch (e) { console.warn("SignOut after disabled check failed", e); }
                setUser(null);
                setRole(null);
                setLoading(false);
                return;
              }
            }
          } catch (err) {
            console.warn("Preliminary users/{uid} read failed:", err);
          }

          // Attach snapshot listener
          unsubUserDoc = onSnapshot(ref, async (snap) => {
            if (snap.exists()) {
              const data = snap.data() || {};
              setRole(data.role || "user");
              if (data.disabled === true) {
                setDisabledMessage("Your account is disabled");
                try { await signOut(auth); } catch (e) { console.warn("SignOut after remote disable failed", e); }
                setUser(null);
                setRole(null);
              }
            } else {
              // create a default user doc if missing
              try {
                await setDoc(ref, { role: "user", createdAt: serverTimestamp(), email: u.email || "", displayName: u.displayName || "" }, { merge: true });
                setRole("user");
              } catch (err) {
                console.error("Failed to create users/{uid} doc:", err);
                setRole("user");
              }
            }
          }, (err) => {
            console.warn("users/{uid} onSnapshot error:", err);
            setRole("user");
          });
        } catch (err) {
          console.error("Error handling auth state change:", err);
          setRole("user");
        }
      } else {
        setUser(null);
        setRole(null);
      }

      setLoading(false);
    });

    return () => {
      try { unsubAuth(); } catch (e) {}
      try { if (unsubUserDoc) unsubUserDoc(); } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  /**
   * register(email, password, extra)
   * - creates the Auth user, updates the Auth profile displayName (if provided),
   *   writes users/{uid} doc, sends verification email, then explicitly signs the user out.
   */
  async function register(email, password, extra = {}) {
    if (!navigator.onLine) throw new Error("Online connection required to register.");

    // Suppress automatic sign-out while we complete the registration writes
    suppressAutoSignoutRef.current = true;

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // If caller provided a displayName, set it on the Firebase Auth user profile so it's persisted
      // on the Auth user record (this ensures subsequent sign-ins surface the name).
      try {
        const desiredName = extra.displayName || "";
        if (desiredName && cred.user) {
          await fbUpdateProfile(cred.user, { displayName: desiredName });
        }
      } catch (updateErr) {
        console.warn("updateProfile (displayName) during register failed:", updateErr);
        // proceed — we'll still write displayName to Firestore below
      }

      // Best-effort: create Firestore user doc (merge)
      try {
        await setDoc(doc(db, "users", cred.user.uid), {
          role: "user",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          displayName: extra.displayName || (cred.user && cred.user.displayName) || "",
          email: cred.user.email || "",
          photoURL: cred.user.photoURL || "",
          uid: cred.user.uid,
          ...extra
        }, { merge: true });
      } catch (fireErr) {
        console.error("Failed to write users/{uid} doc after createUser:", fireErr);
      }

      // Send verification email (best-effort)
      try {
        const defaultContinue = (typeof window !== "undefined") ? `${window.location.origin}/login` : "https://being-happy-pwa.web.app/login";
        const actionCodeSettings = { url: defaultContinue, handleCodeInApp: true };
        await sendEmailVerification(cred.user, actionCodeSettings);
      } catch (sendErr) {
        console.error("sendEmailVerification failed for new user:", sendErr);
      }

      // Explicitly sign the newly-created user out so they are not left signed in.
      // This ensures the UI goes back to the login screen where we can show "verify" messaging.
      try {
        await signOut(auth);
      } catch (signOutErr) {
        console.warn("Failed to sign out after registration:", signOutErr);
      }

      return cred;
    } catch (err) {
      console.error("register() failed:", err);

      const code = err && err.code ? String(err.code) : null;
      let friendly = (err && err.message) ? err.message : "Registration failed. Please try again.";

      if (code === "auth/email-already-in-use") {
        friendly = "Email already in use — already have an account? Please sign in or reset your password.";
      } else if (code === "auth/weak-password") {
        friendly = "Password is too weak. Choose a stronger password with at least 6 characters.";
      } else if (code === "auth/invalid-email") {
        friendly = "Invalid email address. Please check and try again.";
      } else if (code === "auth/operation-not-allowed") {
        friendly = "Email/password sign-in is disabled for this project. Enable it in Firebase Console → Authentication → Sign-in method.";
      } else if (code === "auth/invalid-api-key" || code === "auth/argument-error") {
        friendly = "Configuration error: API key invalid. Check firebaseConfig in src/firebase.js.";
      } else if (code === "auth/network-request-failed") {
        friendly = "Network error — check your connection and try again.";
      } else if (code && code.startsWith("auth/")) {
        friendly = err.message || `Authentication error: ${code}`;
      }

      throw new Error(friendly);
    } finally {
      // Clear suppression after a brief delay to avoid races with onAuthStateChanged handlers.
      // The suppression is kept while we perform the setDoc/sendEmail operations and explicit signOut.
      setTimeout(() => {
        suppressAutoSignoutRef.current = false;
      }, 400);
    }
  }

  function logout() {
    return signOut(auth);
  }

  // Social sign-in helpers enhanced:
  // - Prefer name stored in users/{uid}.displayName (do not overwrite it).
  // - If Firestore doc is missing displayName and provider supplies one, write it to Firestore.
  // - If Firestore doc already has displayName, ensure the Firebase Auth profile uses that displayName
  //   so the auth.user.displayName remains stable across provider logins.
  async function signInWithGoogle() {
    const provider = googleProvider || new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const u = cred.user;
    if (u) {
      const ref = doc(db, "users", u.uid);
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() || {};
          if (data.disabled === true) {
            try { await signOut(auth); } catch (e) {}
            setDisabledMessage("Your account is disabled");
            throw new Error("Your account is disabled");
          }

          // If Firestore has a displayName, prefer it and apply to Auth profile (do not overwrite Firestore)
          if (data.displayName && data.displayName !== (u.displayName || "")) {
            try {
              await fbUpdateProfile(u, { displayName: data.displayName });
            } catch (err) {
              console.warn("Failed to apply stored displayName to auth profile after Google signin:", err);
            }
          } else if (!data.displayName && u.displayName) {
            // Firestore missing displayName, but provider gave one -> store it
            const mergePayload = { displayName: u.displayName };
            // preserve photo rules (photoLocked) - only write photoURL if allowed
            if (!data.photoLocked && u.photoURL) mergePayload.photoURL = u.photoURL;
            try {
              await setDoc(ref, { ...mergePayload, updatedAt: serverTimestamp() }, { merge: true });
            } catch (err) {
              console.warn("Failed to merge provider info into users/{uid} after Google sign-in:", err);
            }
          }
        } else {
          // No user doc -> create one using provider's displayName (if any)
          try {
            await setDoc(ref, {
              role: "user",
              displayName: u.displayName || "",
              email: u.email || "",
              photoURL: u.photoURL || "",
              createdAt: serverTimestamp(),
              uid: u.uid
            }, { merge: true });
          } catch (err) {
            console.warn("ensure user doc failed for google signin (skipping):", err);
          }
        }
      } catch (err) {
        console.warn("error checking/creating users doc after google signin:", err);
      }
    }
    return cred;
  }

  async function signInWithFacebook() {
    const provider = facebookProvider || new FacebookAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const u = cred.user;
    if (u) {
      const ref = doc(db, "users", u.uid);
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() || {};
          if (data.disabled === true) {
            try { await signOut(auth); } catch (e) {}
            setDisabledMessage("Your account is disabled");
            throw new Error("Your account is disabled");
          }

          // If Firestore has a displayName, prefer it and apply to Auth profile
          if (data.displayName && data.displayName !== (u.displayName || "")) {
            try {
              await fbUpdateProfile(u, { displayName: data.displayName });
            } catch (err) {
              console.warn("Failed to apply stored displayName to auth profile after Facebook signin:", err);
            }
          } else if (!data.displayName && u.displayName) {
            // Firestore missing displayName, provider gave one -> store it
            const mergePayload = { displayName: u.displayName };
            if (!data.photoLocked && u.photoURL) mergePayload.photoURL = u.photoURL;
            try {
              await setDoc(ref, { ...mergePayload, updatedAt: serverTimestamp() }, { merge: true });
            } catch (err) {
              console.warn("Failed to merge provider info into users/{uid} after Facebook sign-in:", err);
            }
          }
        } else {
          try {
            await setDoc(ref, {
              role: "user",
              displayName: u.displayName || "",
              email: u.email || "",
              photoURL: u.photoURL || "",
              createdAt: serverTimestamp(),
              uid: u.uid
            }, { merge: true });
          } catch (err) {
            console.warn("ensure user doc failed for facebook signin (skipping):", err);
          }
        }
      } catch (err) {
        console.warn("error checking/creating users doc after facebook signin:", err);
      }
    }
    return cred;
  }

  async function requestPasswordReset(email) {
    if (!navigator.onLine) throw new Error("Online connection required to reset password.");
    if (!email) throw new Error("Enter an email address.");

    const defaultContinue = (typeof window !== "undefined") ? `${window.location.origin}/login` : "https://being-happy-pwa.web.app/login";
    const actionCodeSettings = { url: defaultContinue, handleCodeInApp: true };

    try {
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      return { ok: true };
    } catch (sdkErr) {
      console.error("sendPasswordResetEmail failed (client SDK):", sdkErr);

      const apiKey = (firebaseConfig && firebaseConfig.apiKey) || null;
      if (!apiKey) {
        throw new Error("Failed to send reset email (no API key).");
      }

      try {
        const restUrl = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`;
        const body = { requestType: "PASSWORD_RESET", email, continueUrl: defaultContinue, canHandleCodeInApp: true };
        const resp = await fetch(restUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!resp.ok) {
          const json = await resp.json().catch(() => null);
          const msg = (json && (json.error || json.error?.message)) ? (json.error?.message || JSON.stringify(json)) : `HTTP ${resp.status}`;
          console.error("REST sendOobCode failed", msg, json);
          throw new Error(`Failed to send reset email: ${msg}`);
        }
        return { ok: true };
      } catch (restErr) {
        console.error("REST fallback for sendOobCode failed:", restErr);
        throw restErr;
      }
    }
  }

  async function confirmPasswordReset(oobCode, newPassword) {
    if (!navigator.onLine) throw new Error("Online connection required to set new password.");
    return fbConfirmPassword(auth, oobCode, newPassword);
  }

  async function updateProfileInfo({ displayName, photoURL }) {
    if (!auth.currentUser) throw new Error("No authenticated user");
    if (!navigator.onLine) throw new Error("Online connection required to update profile.");

    try {
      await fbUpdateProfile(auth.currentUser, { displayName, photoURL });
    } catch (err) {
      console.error("fbUpdateProfile failed:", err);
      throw err;
    }

    try {
      if (auth.currentUser && typeof auth.currentUser.getIdToken === "function") {
        await auth.currentUser.getIdToken(true);
      }
      if (auth.currentUser && typeof auth.currentUser.reload === "function") {
        await auth.currentUser.reload();
      }
    } catch (err) {
      console.warn("Token refresh/reload failed (continuing):", err);
    }

    const uid = auth.currentUser.uid;
    const ref = doc(db, "users", uid);
    const payload = {
      ...(displayName !== undefined ? { displayName } : {}),
      ...(photoURL !== undefined ? { photoURL, photoLocked: true } : {}),
      email: auth.currentUser.email || null,
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(ref, payload, { merge: true });
    } catch (err) {
      console.error("Failed to update users/{uid} doc:", { code: err?.code, message: err?.message, uidAttempted: uid, payload });
      try {
        const snap = await getDoc(ref);
        const docData = snap.exists() ? snap.data() : null;
        const wroteDisplayName = (displayName === undefined) || (docData && docData.displayName === displayName);
        const wrotePhoto = (photoURL === undefined) || (docData && docData.photoURL === photoURL);
        if (wroteDisplayName && wrotePhoto) {
          setUser({ ...auth.currentUser });
          return;
        }
      } catch (readErr) {
        console.warn("getDoc after failed setDoc also failed:", readErr);
      }
      try {
        await new Promise(r => setTimeout(r, 600));
        await setDoc(ref, payload, { merge: true });
      } catch (retryErr) {
        console.error("Retry failed for users/{uid} setDoc:", retryErr);
        throw err;
      }
    }

    setUser({ ...auth.currentUser });
  }

  const value = {
    user,
    role,
    loading,
    disabledMessage,
    login,
    register,
    logout,
    signInWithGoogle,
    signInWithFacebook,
    requestPasswordReset,
    confirmPasswordReset,
    updateProfileInfo
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}