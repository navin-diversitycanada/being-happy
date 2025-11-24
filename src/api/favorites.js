// src/api/favorites.js
// Firestore helpers for per-user favorites (users/{uid}/favorites subcollection)
// No localStorage write fallbacks — favorites writes require online and go to Firestore.
// A read-only cache (localStorage) is updated after successful Firestore reads for offline reads only.

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit,
  getDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Read-only cache helper (used only for offline reads).
 * Keys are bh_favorites_cache_{uid}
 */
function cacheKey(uid) {
  return `bh_favorites_cache_${uid}`;
}
function writeCache(uid, items) {
  try {
    if (!window || !window.localStorage) return;
    const safe = JSON.stringify(items || []);
    localStorage.setItem(cacheKey(uid), safe);
  } catch (e) {
    // ignore cache write errors
    console.warn("writeCache failed", e);
  }
}
function readCache(uid) {
  try {
    if (!window || !window.localStorage) return [];
    const raw = localStorage.getItem(cacheKey(uid));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("readCache failed", e);
    return [];
  }
}

/**
 * addFavorite(uid, post)
 * - Requires uid (authenticated user) and an online connection.
 * - Writes to Firestore users/{uid}/favorites/{postId}
 * - Throws if offline or if Firestore write fails.
 *
 * post may be a string id or object { id, title, type, thumbnailUrl }
 */
export async function addFavorite(uid, post) {
  if (!uid) throw new Error("Authentication required to add favorites.");
  if (!navigator.onLine) throw new Error("Online connection required to add favorites.");

  const postId = typeof post === "string" ? post : (post.id || post.postId);
  if (!postId) throw new Error("Invalid post identifier");

  const favRef = doc(db, "users", uid, "favorites", postId);
  const payload = {
    itemId: postId,
    createdAt: serverTimestamp(),
    title: typeof post === "object" ? post.title || null : null,
    type: typeof post === "object" ? post.type || null : null,
    thumbnailUrl: typeof post === "object" ? post.thumbnailUrl || post.imageUrl || null : null
  };

  try {
    console.debug("addFavorite: attempting setDoc", { path: `users/${uid}/favorites/${postId}`, payload });
    await setDoc(favRef, payload);
    return { ok: true };
  } catch (err) {
    console.error("addFavorite Firestore failed:", err);
    throw err;
  }
}

/**
 * removeFavorite(uid, postId)
 * - Requires uid (authenticated user) and online connection.
 */
export async function removeFavorite(uid, postId) {
  if (!uid) throw new Error("Authentication required to remove favorites.");
  if (!navigator.onLine) throw new Error("Online connection required to remove favorites.");
  if (!postId) throw new Error("Invalid post identifier");

  const favRef = doc(db, "users", uid, "favorites", postId);
  try {
    await deleteDoc(favRef);
    return { ok: true };
  } catch (err) {
    console.error("removeFavorite Firestore failed:", err);
    throw err;
  }
}

/**
 * listFavorites(uid, page = 1, pageSize = 10, search = "")
 * - If uid is falsy, returns an empty list.
 * - On Firestore read success, update read-only cache for offline use.
 * - On Firestore read failure (network / permission), try to return cached items instead of failing silently.
 */
export async function listFavorites(uid, page = 1, pageSize = 10, search = "") {
  if (!uid) {
    return { total: 0, items: [] };
  }

  try {
    const col = collection(db, "users", uid, "favorites");
    if (page > 1) {
      const snapAll = await getDocs(query(col, orderBy("createdAt", "desc"), limit(page * pageSize)));
      const docs = snapAll.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt }));
      const filtered = search ? docs.filter(it => (it.title || "").toLowerCase().includes(search.toLowerCase()) || (it.id || "").toLowerCase().includes(search.toLowerCase())) : docs;
      const items = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

      // update read cache for offline reads
      writeCache(uid, docs);

      return { total: filtered.length, items };
    } else {
      const snap = await getDocs(query(col, orderBy("createdAt", "desc"), limit(pageSize)));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt }));
      const filtered = search ? docs.filter(it => (it.title || "").toLowerCase().includes(search.toLowerCase()) || (it.id || "").toLowerCase().includes(search.toLowerCase())) : docs;

      // update read cache for offline reads
      writeCache(uid, docs);

      return { total: filtered.length, items: filtered };
    }
  } catch (err) {
    console.warn("listFavorites Firestore failed; attempting cached read:", err);
    const cached = readCache(uid);
    if (cached && cached.length) {
      const filtered = search ? cached.filter(it => (it.title || "").toLowerCase().includes(search.toLowerCase()) || (it.id || "").toLowerCase().includes(search.toLowerCase())) : cached;
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);
      return { total: filtered.length, items };
    }
    // No cache available — rethrow so UI can surface problem.
    throw err;
  }
}

/**
 * isFavorited(uid, postId)
 * - Returns boolean. If uid is falsy, returns false.
 * - On Firestore read failure, will try cached read and return boolean accordingly.
 */
export async function isFavorited(uid, postId) {
  if (!uid || !postId) return false;
  try {
    const favRef = doc(db, "users", uid, "favorites", postId);
    const snap = await getDoc(favRef);
    return snap.exists();
  } catch (err) {
    console.warn("isFavorited Firestore read failed, attempting cached read:", err);
    const cached = readCache(uid);
    return (cached || []).some(it => (it.id === postId || it.itemId === postId));
  }
}