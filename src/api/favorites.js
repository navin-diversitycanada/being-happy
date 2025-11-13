// src/api/favorites.js
// Firestore helpers for per-user favorites (users/{uid}/favorites subcollection)
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
 * addFavorite(uid, post)
 * - Creates a document users/{uid}/favorites/{postId} with metadata and createdAt timestamp.
 * - post can be object (with id/type/title) or string postId.
 */
export async function addFavorite(uid, post) {
  if (!uid) throw new Error("Missing uid");
  if (!post) throw new Error("Missing post");
  const postId = typeof post === "string" ? post : (post.id || post.postId);
  if (!postId) throw new Error("Invalid post identifier");

  const favRef = doc(db, "users", uid, "favorites", postId);
  // store basic snapshot so listing can be resolved without additional reads
  const payload = {
    itemId: postId,
    createdAt: serverTimestamp(),
    // optional fields if provided
    title: typeof post === "object" ? post.title || null : null,
    type: typeof post === "object" ? post.type || null : null
  };
  await setDoc(favRef, payload);
  return { ok: true };
}

/**
 * removeFavorite(uid, postId)
 */
export async function removeFavorite(uid, postId) {
  if (!uid) throw new Error("Missing uid");
  if (!postId) throw new Error("Missing postId");
  const favRef = doc(db, "users", uid, "favorites", postId);
  await deleteDoc(favRef);
  return { ok: true };
}

/**
 * listFavorites(uid, page = 1, pageSize = 10, search = "")
 * - Paginated listing using simple window (reads page * pageSize when page > 1).
 */
export async function listFavorites(uid, page = 1, pageSize = 10, search = "") {
  if (!uid) return { total: 0, items: [] };
  try {
    const col = collection(db, "users", uid, "favorites");
    if (page > 1) {
      // read a larger window and slice client-side (Firestore offset not used here for compatibility)
      const snapAll = await getDocs(query(col, orderBy("createdAt", "desc"), limit(page * pageSize)));
      const docs = snapAll.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt }));
      const filtered = search ? docs.filter(it => (it.title || "").toLowerCase().includes(search.toLowerCase())) : docs;
      const items = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
      return { total: filtered.length, items };
    } else {
      const snap = await getDocs(query(col, orderBy("createdAt", "desc"), limit(pageSize)));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt }));
      const filtered = search ? docs.filter(it => (it.title || "").toLowerCase().includes(search.toLowerCase())) : docs;
      return { total: filtered.length, items: filtered };
    }
  } catch (err) {
    console.error("listFavorites failed", err);
    return { total: 0, items: [] };
  }
}

/**
 * isFavorited(uid, postId)
 */
export async function isFavorited(uid, postId) {
  if (!uid || !postId) return false;
  const favRef = doc(db, "users", uid, "favorites", postId);
  const snap = await getDoc(favRef);
  return snap.exists();
}