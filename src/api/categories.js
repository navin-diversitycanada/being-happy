// src/api/categories.js
// Firestore helpers for categories (modular v9)
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { db } from "../firebase";

const categoriesCol = collection(db, "categories");
const subcategoriesCol = collection(db, "subcategories");

export async function listCategories() {
  const q = query(categoriesCol, orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createCategory(name) {
  return await addDoc(categoriesCol, { name, createdAt: new Date() });
}

export async function updateCategory(id, name) {
  const ref = doc(db, "categories", id);
  await updateDoc(ref, { name, updatedAt: new Date() });
}

export async function deleteCategory(id) {
  const ref = doc(db, "categories", id);
  await deleteDoc(ref);
}

/* Subcategory helpers (kept for compatibility) */
export async function listSubcategories() {
  const q = query(subcategoriesCol, orderBy("parentCategory"), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createSubcategory(name, parentCategory) {
  return await addDoc(subcategoriesCol, { name, parentCategory, createdAt: new Date() });
}

export async function getSubcategoriesForParent(parentName) {
  const q = query(subcategoriesCol, where("parentCategory", "==", parentName), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}