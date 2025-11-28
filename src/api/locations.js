// src/api/locations.js
// Firestore helpers for hierarchical locations (country -> province -> city)
// Updates:
//  - Enforce parent requirements on create (province requires country parent, city requires province parent).
//  - Prevent changing a location's type if it currently has any child locations.
//  - When creating/updating, validate parent exists and has expected type.
//  - Return helpful errors for UI to show.

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  where,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

const locationsCol = collection(db, "locations");
const postsCol = collection(db, "posts");

/**
 * listLocations
 * Returns flat array of all locations ordered by type, then name
 */
export async function listLocations() {
  try {
    const q = query(locationsCol, orderBy("type"), orderBy("name"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("listLocations failed", err);
    return [];
  }
}

/**
 * listLocationsTree
 * Returns hierarchical structure:
 * [ { id, name, type: 'country', children: [ { id, name, type: 'province', children: [ { id, name, type: 'city' } ] } ] } ]
 */
export async function listLocationsTree() {
  try {
    const all = await listLocations();
    const byId = {};
    all.forEach(l => { byId[l.id] = { ...l, children: [] }; });

    const roots = [];
    // attach to parents
    all.forEach(l => {
      if (l.parentId && byId[l.parentId]) {
        byId[l.parentId].children.push(byId[l.id]);
      } else {
        // no parent -> root (countries expected)
        roots.push(byId[l.id]);
      }
    });

    // sort children by name
    function sortTree(nodes = []) {
      nodes.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      nodes.forEach(n => {
        if (n.children && n.children.length) sortTree(n.children);
      });
    }
    sortTree(roots);
    return roots;
  } catch (err) {
    console.error("listLocationsTree failed", err);
    return [];
  }
}

/**
 * createLocation({ name, type, parentId })
 * - type must be one of "country"|"province"|"city"
 * - parentId: optional; for province it must be a country id, for city it must be a province id.
 * - Derives ancestor ids (countryId, provinceId) where possible for faster queries.
 */
export async function createLocation({ name, type, parentId = null }) {
  if (!navigator.onLine) throw new Error("Online connection required to create locations.");
  if (!name || !type) throw new Error("Name and type are required.");
  const t = (type || "").toLowerCase();
  if (!["country", "province", "city"].includes(t)) throw new Error("Invalid type");

  // Enforce parent presence/validity
  let countryId = null;
  let provinceId = null;

  if (t === "province") {
    if (!parentId) throw new Error("A province must have a parent country.");
    // validate parent exists and is a country
    const parentSnap = await getDoc(doc(db, "locations", parentId));
    if (!parentSnap.exists() || (parentSnap.data().type || "").toLowerCase() !== "country") {
      throw new Error("Parent country not found. A province must have a country as parent.");
    }
    countryId = parentId;
  } else if (t === "city") {
    if (!parentId) throw new Error("A city must have a parent province.");
    const parentSnap = await getDoc(doc(db, "locations", parentId));
    if (!parentSnap.exists() || (parentSnap.data().type || "").toLowerCase() !== "province") {
      throw new Error("Parent province not found. A city must have a province as parent.");
    }
    provinceId = parentId;
    countryId = parentSnap.data().countryId || parentSnap.data().parentId || null;
  }

  const payload = {
    name: name.trim(),
    type: t,
    parentId: parentId || null,
    countryId: countryId || null,
    provinceId: provinceId || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(locationsCol, payload);
  return ref;
}

/**
 * updateLocation(id, { name, parentId, type })
 * - If attempting to change type, ensure there are no child locations (prevent type change if children exist).
 * - Ensure parent types are valid (province -> country, city -> province).
 */
export async function updateLocation(id, { name, parentId = undefined, type = undefined }) {
  if (!navigator.onLine) throw new Error("Online connection required to update locations.");
  if (!id) throw new Error("id required");
  const ref = doc(db, "locations", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Location not found");
  const current = snap.data() || {};
  const updatePayload = {};

  // If changing type, validate
  if (type !== undefined) {
    const newType = (type || "").toLowerCase();
    if (!["country", "province", "city"].includes(newType)) {
      throw new Error("Invalid type");
    }
    if (newType !== (current.type || "").toLowerCase()) {
      // check for children - if any exist, prevent changing type
      const childrenQ = query(locationsCol, where("parentId", "==", id), orderBy("name"));
      const childrenSnap = await getDocs(childrenQ);
      if (childrenSnap.size > 0) {
        throw new Error("Cannot change type while location has child locations. Remove or reparent children first.");
      }
      updatePayload.type = newType;
    }
  }

  if (name !== undefined) updatePayload.name = (name || "").trim();

  // Parent change handling (and validation)
  if (parentId !== undefined) {
    // if setting parentId to null and the type requires a parent, prevent it
    const effectiveType = (updatePayload.type || current.type || "").toLowerCase();

    if (effectiveType === "province") {
      if (!parentId) throw new Error("Province requires a parent country.");
      const pSnap = await getDoc(doc(db, "locations", parentId));
      if (!pSnap.exists() || (pSnap.data().type || "").toLowerCase() !== "country") {
        throw new Error("Parent must be a country for a province.");
      }
      updatePayload.parentId = parentId;
      updatePayload.countryId = parentId;
      // clear provinceId for provinces (they don't have province ancestors)
      updatePayload.provinceId = null;
    } else if (effectiveType === "city") {
      if (!parentId) throw new Error("City requires a parent province.");
      const pSnap = await getDoc(doc(db, "locations", parentId));
      if (!pSnap.exists() || (pSnap.data().type || "").toLowerCase() !== "province") {
        throw new Error("Parent must be a province for a city.");
      }
      updatePayload.parentId = parentId;
      updatePayload.provinceId = parentId;
      updatePayload.countryId = pSnap.data().countryId || pSnap.data().parentId || null;
    } else if (effectiveType === "country") {
      // countries must have parentId == null
      updatePayload.parentId = null;
      updatePayload.countryId = null;
      updatePayload.provinceId = null;
    } else {
      updatePayload.parentId = parentId || null;
    }
  }

  updatePayload.updatedAt = serverTimestamp();
  await updateDoc(ref, updatePayload);

  // If we changed parentId, descendant docs (children) may need their ancestor ids updated.
  if (parentId !== undefined) {
    // For simplicity: fetch direct children and update their country/province fields as appropriate.
    const childrenQ = query(locationsCol, where("parentId", "==", id));
    const childrenSnap = await getDocs(childrenQ);
    for (const childDoc of childrenSnap.docs) {
      const child = childDoc.data() || {};
      const childId = childDoc.id;
      const childRef = doc(db, "locations", childId);
      const updates = {};
      // recompute child's countryId/provinceId
      if (child.type === "province") {
        // province's countryId should be parentId (which is country)
        updates.countryId = parentId || null;
      } else if (child.type === "city") {
        // city's provinceId is parentId; derive countryId from updated parent
        updates.provinceId = parentId || null;
        if (parentId) {
          const pSnap = await getDoc(doc(db, "locations", parentId)).catch(() => null);
          updates.countryId = (pSnap && pSnap.exists()) ? (pSnap.data().countryId || pSnap.data().parentId || null) : null;
        } else {
          updates.countryId = null;
        }
      }
      if (Object.keys(updates).length) {
        updates.updatedAt = serverTimestamp();
        try { await updateDoc(childRef, updates); } catch (e) { console.warn("Failed update child location", childId, e); }
      }
    }
  }

  return true;
}

/**
 * deleteLocation(id)
 * - Deletes the location document, deletes all descendant location documents (recursively)
 * - Updates posts:
 *    - if deleting a country: remove location entirely (set location null) for any post referencing countryId
 *    - if deleting a province: remove provinceId and cityId from posts (but keep country)
 *    - if deleting a city: remove cityId from posts (keep province & country)
 */
export async function deleteLocation(id) {
  if (!navigator.onLine) throw new Error("Online connection required to delete locations.");
  if (!id) throw new Error("id required");
  const targetRef = doc(db, "locations", id);
  const targetSnap = await getDoc(targetRef);
  if (!targetSnap.exists()) throw new Error("Location not found");
  const target = targetSnap.data();

  const type = target.type;

  // Update posts affected
  try {
    if (type === "country") {
      // Find posts where location.countryId == id
      const q = query(postsCol, where("location.countryId", "==", id));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const pRef = doc(db, "posts", d.id);
        // remove location entirely
        await updateDoc(pRef, { location: null, updatedAt: serverTimestamp() }).catch(e => console.warn("Failed update post on country delete", d.id, e));
      }
    } else if (type === "province") {
      // posts where location.provinceId == id -> remove provinceId & cityId
      const q = query(postsCol, where("location.provinceId", "==", id));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const pRef = doc(db, "posts", d.id);
        // keep countryId if present; remove provinceId & cityId and corresponding names
        await updateDoc(pRef, {
          "location.provinceId": null,
          "location.provinceName": null,
          "location.cityId": null,
          "location.cityName": null,
          updatedAt: serverTimestamp()
        }).catch(e => console.warn("Failed update post on province delete", d.id, e));
      }
    } else if (type === "city") {
      // posts where location.cityId == id -> remove cityId
      const q = query(postsCol, where("location.cityId", "==", id));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const pRef = doc(db, "posts", d.id);
        await updateDoc(pRef, {
          "location.cityId": null,
          "location.cityName": null,
          updatedAt: serverTimestamp()
        }).catch(e => console.warn("Failed update post on city delete", d.id, e));
      }
    }
  } catch (err) {
    console.warn("Failed to update posts during location delete:", err);
  }

  // Recursively delete descendants (children, grandchildren)
  async function deleteChildren(parentId) {
    const q = query(locationsCol, where("parentId", "==", parentId));
    const snap = await getDocs(q);
    for (const child of snap.docs) {
      const childId = child.id;
      await deleteChildren(childId);
      try {
        await deleteDoc(doc(db, "locations", childId));
      } catch (e) {
        console.warn("Failed to delete child location", childId, e);
      }
    }
  }

  try {
    await deleteChildren(id);
  } catch (err) {
    console.warn("Failed to delete descendant locations", err);
  }

  // Finally delete the target
  try {
    await deleteDoc(targetRef);
  } catch (err) {
    console.error("Failed to delete location", err);
    throw err;
  }

  return true;
}