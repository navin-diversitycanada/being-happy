// src/api/posts.js
// Firestore helpers (modular v9) - added online checks for write operations
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

const postsCol = collection(db, "posts");

export async function createPost(data) {
  if (!navigator.onLine) throw new Error("Online connection required to create posts.");
  const payload = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const ref = await addDoc(postsCol, payload);
  return ref;
}

export async function updatePost(id, patch) {
  if (!navigator.onLine) throw new Error("Online connection required to update posts.");
  const ref = doc(db, "posts", id);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
}

export async function deletePost(id) {
  if (!navigator.onLine) throw new Error("Online connection required to delete posts.");
  const ref = doc(db, "posts", id);
  await deleteDoc(ref);
}

export async function getPost(id) {
  const ref = doc(db, "posts", id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

function timestampToMillis(t) {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (t instanceof Date) return t.getTime();
  try {
    return new Date(t).getTime() || 0;
  } catch {
    return 0;
  }
}

/**
 * listByType
 * - Default for pages: returns published posts of a given type ordered by publishedAt desc.
 * - Tries the indexed query first (efficient). If it fails (missing composite index),
 *   falls back to fetch-by-type then client-side filter/sort.
 *
 * limitN defaults to 12 now (per request).
 */
export async function listByType(type, limitN = 12) {
  if (!type) return [];
  try {
    const q = query(
      postsCol,
      where("type", "==", type),
      where("published", "==", true),
      orderBy("publishedAt", "desc"),
      limit(limitN)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("listByType primary query failed, falling back to client-side filter/sort:", err);
    try {
      const fallbackFetch = Math.max(limitN, 400);
      const q2 = query(postsCol, where("type", "==", type), limit(fallbackFetch));
      const snap2 = await getDocs(q2);
      const items = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = items.filter(it => !!it && !!it.published);
      filtered.sort((a, b) => timestampToMillis(b.publishedAt || b.createdAt) - timestampToMillis(a.publishedAt || a.createdAt));
      return filtered.slice(0, limitN);
    } catch (e2) {
      console.error("listByType fallback also failed:", e2);
      return [];
    }
  }
}

/**
 * listByCategory
 * unchanged
 */
export async function listByCategory(categoryId, type = null, limitN = 200, fetchWindow = 800) {
  if (!categoryId) return [];
  try {
    if (type) {
      const q = query(
        postsCol,
        where("categories", "array-contains", categoryId),
        where("type", "==", type),
        where("published", "==", true),
        orderBy("publishedAt", "desc"),
        limit(limitN)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      const q = query(
        postsCol,
        where("categories", "array-contains", categoryId),
        where("published", "==", true),
        orderBy("publishedAt", "desc"),
        limit(limitN)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn("listByCategory primary query failed, falling back to client-side scan:", err);
    try {
      // Read a window of recent published documents and filter locally
      const q2 = query(postsCol, orderBy("publishedAt", "desc"), limit(fetchWindow));
      const snap2 = await getDocs(q2);
      const items = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = items.filter(it => !!it && !!it.published && (it.categories || []).includes(categoryId) && (type ? it.type === type : true));
      filtered.sort((a, b) => timestampToMillis(b.publishedAt || b.createdAt) - timestampToMillis(a.publishedAt || a.createdAt));
      return filtered.slice(0, limitN);
    } catch (e2) {
      console.error("listByCategory fallback also failed:", e2);
      return [];
    }
  }
}

/**
 * listFeatured: default limit now 12 (per request)
 */
export async function listFeatured(limitN = 12, fetchWindow = 400) {
  try {
    const q = query(postsCol, orderBy("publishedAt", "desc"), limit(fetchWindow));
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const featured = docs.filter(it => !!it && !!it.published && !!it.featured);
    featured.sort((a, b) => timestampToMillis(b.publishedAt || b.createdAt) - timestampToMillis(a.publishedAt || a.createdAt));
    return featured.slice(0, limitN);
  } catch (err) {
    console.warn("listFeatured fallback failed:", err);
    return [];
  }
}

/**
 * Admin helpers unchanged
 */
export async function listByTypeAdmin(type, limitN = 200) {
  try {
    const q = query(postsCol, where("type", "==", type), orderBy("createdAt", "desc"), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("listByTypeAdmin failed:", err);
    return [];
  }
}

export async function listAllForAdmin(limitN = 500) {
  try {
    const q = query(postsCol, orderBy("createdAt", "desc"), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("listAllForAdmin failed:", err);
    return [];
  }
}