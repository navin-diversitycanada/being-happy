import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { serverTimestamp } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      if (u) {
        setUser(u);
        try {
          const ref = doc(db, "users", u.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            setRole(snap.data().role || "user");
          } else {
            // create default users/{uid} doc with role user
            await setDoc(ref, { role: "user", createdAt: Date.now() });
            setRole("user");
          }
        } catch (err) {
          console.error("Error getting user role:", err);
          setRole("user");
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function register(email, password, extra = {}) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      role: "user",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      displayName: extra.displayName || "",
      email: cred.user.email || "",
      photoURL: cred.user.photoURL || "",
      uid: cred.user.uid,
      ...extra
    });
    return cred;
  }

  function logout() {
    return signOut(auth);
  }

  const value = { user, role, loading, login, register, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}