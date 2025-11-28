// src/pages/AdminPanel.jsx
// Admin Panel — updates:
// - Parent selects sorted A–Z for countries and "Country -> Province" options sorted by country then province.
// - Expand/Collapse buttons for locations use purple background.
// - Post title in All Posts listing gets dedicated class so it renders white.

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import ImageUploader from "../components/PostFormFields/ImageUploader";
import Breadcrumbs from "../components/Breadcrumbs";
import { listCategories as apiListCategories, createCategory, updateCategory, deleteCategory } from "../api/categories";
import { createPost, updatePost, getPost, listAllForAdmin, deletePost } from "../api/posts";
import { listLocationsTree, listLocations, createLocation, updateLocation, deleteLocation } from "../api/locations";

// Firestore SDK (modular)
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs } from "firebase/firestore";

// Firebase Auth helper for admin password reset emails
import { sendPasswordResetEmail } from "firebase/auth";
import { auth, firebaseConfig } from "../firebase";

/* Helper to display types in a user-friendly/capitalized way */
function displayType(type) {
  if (!type) return "";
  const t = (type || "").toLowerCase();
  switch (t) {
    case "article": return "Article";
    case "video": return "Video";
    case "audio": return "Meditation";
    case "directory": return "Directory";
    default: return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

const PAGE_SIZE = 10;

function extractYouTubeId(input) {
  if (!input || typeof input !== "string") return null;
  const idOnly = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(idOnly)) return idOnly;
  const m = input.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/* ======= Sanitizer helper (keeps H2/H3 allowed) ======= */
function sanitizeHtml(html) {
  if (!html || typeof html !== "string") return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const allowed = new Set([
      "A", "P", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
      "H2", "H3", "UL", "OL", "LI", "PRE", "CODE", "HR"
    ]);

    const all = Array.from(doc.body.querySelectorAll("*"));
    for (const node of all) {
      const tn = node.tagName.toUpperCase();
      if (!allowed.has(tn)) {
        const parent = node.parentNode;
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
        continue;
      }

      for (const attr of Array.from(node.attributes)) {
        if (tn === "A" && attr.name === "href") {
          try {
            const href = (attr.value || "").trim();
            const lower = href.toLowerCase();
            if (lower.startsWith("javascript:") || lower.startsWith("data:")) {
              node.removeAttribute(attr.name);
            }
          } catch (e) {
            node.removeAttribute(attr.name);
          }
        } else {
          node.removeAttribute(attr.name);
        }
      }

      if (node.style) node.removeAttribute("style");
      node.removeAttribute("class");
    }

    doc.querySelectorAll("font").forEach(font => {
      while (font.firstChild) font.parentNode.insertBefore(font.firstChild, font);
      font.parentNode.removeChild(font);
    });

    return doc.body.innerHTML || "";
  } catch (err) {
    console.warn("Sanitize failed", err);
    return html;
  }
}
/* ======= end sanitizer ======= */

function isValidCategoryName(name) {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 60) return false;
  const re = /^[A-Za-z0-9\s\-\&]+$/;
  return re.test(trimmed);
}

export default function AdminPanel() {
  const auth = useAuth();
  const currentUser = auth?.user || null;
  const isAdmin = auth?.role === "admin";

  const hasFirestore = true;
  const workerUrl = process.env.REACT_APP_UPLOAD_WORKER_URL || null;

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [activeSection, setActiveSection] = useState("posts");
  const [editingPostId, setEditingPostId] = useState(null);
  const [editingCategoryId, setEditingCategoryId] = useState(null);

  // Locations state
  const [locationsTree, setLocationsTree] = useState([]);
  const [locationsFlat, setLocationsFlat] = useState([]);
  const [editingLocationId, setEditingLocationId] = useState(null);
  const [editingLocationHasChildren, setEditingLocationHasChildren] = useState(false);
  const [locationFormName, setLocationFormName] = useState("");
  const [locationFormType, setLocationFormType] = useState("country");
  const [locationFormParent, setLocationFormParent] = useState("");

  // Expand/collapse state (only one expanded country/province at a time)
  const [expandedCountryId, setExpandedCountryId] = useState(null);
  const [expandedProvinceId, setExpandedProvinceId] = useState(null);

  const wysiwygRef = useRef(null);
  const listingsTopRef = useRef(null);
  const categoryInputRef = useRef(null);
  const locationFormRef = useRef(null);
  const postFormRef = useRef(null);

  const [postForm, setPostForm] = useState({
    title: "",
    type: "Article",
    categories: [],
    descHTML: "",
    imageUrl: "",
    thumbnailUrl: "",
    youtubeInput: "",
    published: false,
    featured: false,
    // location ids for directory
    locationCountryId: null,
    locationProvinceId: null,
    locationCityId: null
  });

  const [categoryFormName, setCategoryFormName] = useState("");
  const [fieldMessages, setFieldMessages] = useState({ general: "", post: "", category: "", upload: "", youtube: "", users: "" });
  const [saving, setSaving] = useState(false);

  // Listing state
  const [postPage, setPostPage] = useState(1);
  const [postQuery, setPostQuery] = useState("");
  const [postTypeFilter, setPostTypeFilter] = useState("all");

  const [featuredQuery, setFeaturedQuery] = useState("");
  const [featuredTypeFilter, setFeaturedTypeFilter] = useState("all");

  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userQuery, setUserQuery] = useState("");

  const [uploaderKey, setUploaderKey] = useState(Date.now());
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);

  const db = getFirestore();

  // Online state for UI disabling of write actions
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    function onOnline() { setIsOnline(true); }
    function onOffline() { setIsOnline(false); }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Ensure type categories exist and are immutable
  async function ensureTypeCategories() {
    try {
      const types = [
        { id: "type_article", name: "Article", immutable: true },
        { id: "type_video", name: "Video", immutable: true },
        { id: "type_audio", name: "Meditation", immutable: true },
        { id: "type_directory", name: "Directory", immutable: true }
      ];
      for (const t of types) {
        const ref = doc(db, "categories", t.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, { name: t.name, createdAt: new Date(), immutable: !!t.immutable });
        } else {
          const data = snap.data() || {};
          if (!data.immutable) {
            try { await updateDoc(ref, { immutable: true }); } catch (e) { /* ignore */ }
          }
        }
      }
    } catch (err) {
      console.warn("ensureTypeCategories failed:", err);
    }
  }

  useEffect(() => {
    if (!hasFirestore) { setLoading(false); return; }
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      try {
        await ensureTypeCategories();

        const [allPosts, cats, locTree, locFlat] = await Promise.all([
          listAllForAdmin(1000),
          apiListCategories(),
          listLocationsTree().catch(() => []),
          listLocations().catch(() => [])
        ]);
        if (cancelled) return;
        setPosts(allPosts || []);
        setCategories((cats || []).map(c => ({ id: c.id, name: c.name, immutable: !!c.immutable })));
        setLocationsTree(locTree || []);
        setLocationsFlat(locFlat || []);
      } catch (err) {
        console.error("Admin load error", err);
        setFieldMessages((p) => ({ ...p, general: "Failed to load admin data" }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAll();
    return () => { cancelled = true; };
  }, [hasFirestore]);

  useEffect(() => {
    if (activeSection !== "users") return;
    if (!isAdmin) return;
    let cancelled = false;
    async function loadUsers() {
      setLoadingUsers(true);
      setFieldMessages(p => ({ ...p, users: "" }));
      try {
        const col = collection(db, "users");
        const snap = await getDocs(col);
        if (cancelled) return;
        const docs = snap.docs.map(d => {
          const data = d.data() || {};
          return {
            id: d.id,
            email: data.email || "",
            displayName: data.displayName || "",
            role: (data.role || "user"),
            _raw: data
          };
        });
        setUsersList(docs);
      } catch (err) {
        console.error("Failed to load users", err);
        setFieldMessages(p => ({ ...p, users: "Failed to load users. Make sure you are an admin and Firestore rules allow reads." }));
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    }
    loadUsers();
    return () => { cancelled = true; };
  }, [activeSection, isAdmin, db]);

  useEffect(() => {
    setFieldMessages({ general: "", post: "", category: "", upload: "", youtube: "", users: "" });
  }, [activeSection]);

  useEffect(() => {
    if (!wysiwygRef.current) return;
    const dom = wysiwygRef.current;
    const target = postForm.descHTML || "";
    if (dom.innerHTML !== target) dom.innerHTML = target;
  }, [postForm.descHTML]);

  function updatePostForm(partial) {
    setPostForm(p => ({ ...p, ...partial }));
  }

  function resetPostForm() {
    setEditingPostId(null);
    setPostForm({
      title: "",
      type: "Article",
      categories: [],
      descHTML: "",
      imageUrl: "",
      thumbnailUrl: "",
      youtubeInput: "",
      published: false,
      featured: false,
      locationCountryId: null,
      locationProvinceId: null,
      locationCityId: null
    });
    setCategoryFormName("");
    setEditingCategoryId(null);
    setFieldMessages({ general: "", post: "", category: "", upload: "", youtube: "", users: "" });
    if (wysiwygRef.current) wysiwygRef.current.innerHTML = "";
    setUploaderKey(Date.now());
    setTimeout(() => {
      const listings = document.querySelector(".admin-list");
      if (listings) listings.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
  }

  function validatePostForm() {
    const t = (postForm.title || "").trim();
    const ty = (postForm.type || "").trim();
    const cats = postForm.categories || [];
    const desc = (postForm.descHTML || "").trim();
    if (!ty) return "Type is required.";
    if (ty.toLowerCase() !== "directory") {
      if (!t) return "Title is required.";
      if (!desc) return "Description is required.";
    } else {
      if (!t) return "Title is required.";
    }
    if (ty === "Video" || ty === "Audio") {
      if (!postForm.youtubeInput || !extractYouTubeId(postForm.youtubeInput)) return "YouTube URL/ID is required and must be valid for Video/Audio types.";
    }
    if (ty.toLowerCase() !== "directory" && (!cats || !cats.length)) return "At least one category is required.";
    return null;
  }

  async function handleSavePost(e) {
    e?.preventDefault?.();
    setFieldMessages({ general: "", post: "", category: "", upload: "", youtube: "", users: "" });
    if (!isAdmin) { setFieldMessages(p => ({ ...p, post: "Only admins can save posts." })); return; }
    if (!isOnline) { setFieldMessages(p => ({ ...p, post: "You are offline — must be online to save posts." })); return; }

    try {
      const html = wysiwygRef.current ? wysiwygRef.current.innerHTML : postForm.descHTML;
      const sanitized = sanitizeHtml(html);
      updatePostForm({ descHTML: sanitized });
    } catch (err) {
      console.warn("WYSIWYG read error", err);
    }

    const validationError = validatePostForm();
    if (validationError) {
      setFieldMessages(p => ({ ...p, post: validationError }));
      return;
    }

    const slug = postForm.title.trim().toLowerCase().replace(/[^\w-]+/g, "-");
    const existsSameSlug = posts.some(p => p.slug === slug && p.id !== editingPostId);
    if (existsSameSlug) {
      setFieldMessages(p => ({ ...p, post: "A post with a similar title/slug already exists." }));
      return;
    }

    const uniqueCats = Array.from(new Set(postForm.categories || []));
    const youtubeId = (postForm.type === "Video" || postForm.type === "Audio") ? extractYouTubeId(postForm.youtubeInput || "") : (postForm.youtubeInput ? extractYouTubeId(postForm.youtubeInput || "") : null);

    let locationPayload = null;
    if ((postForm.type || "").toLowerCase() === "directory") {
      const countryId = postForm.locationCountryId || null;
      const provinceId = postForm.locationProvinceId || null;
      const cityId = postForm.locationCityId || null;
      const findName = (lid) => {
        const found = (locationsFlat || []).find(x => x.id === lid);
        return found ? found.name : null;
      };

      if (countryId || provinceId || cityId) {
        locationPayload = {
          countryId: countryId || null,
          countryName: findName(countryId) || null,
          provinceId: provinceId || null,
          provinceName: findName(provinceId) || null,
          cityId: cityId || null,
          cityName: findName(cityId) || null
        };
      } else {
        locationPayload = null;
      }
    }

    const payload = {
      title: postForm.title.trim(),
      type: postForm.type.toLowerCase(),
      slug,
      excerpt: (postForm.descHTML || "").slice(0, 220),
      content: postForm.descHTML,
      imageUrl: postForm.imageUrl || null,
      thumbnailUrl: postForm.thumbnailUrl || null,
      youtubeId: youtubeId || null,
      categories: uniqueCats,
      published: !!postForm.published,
      featured: !!postForm.featured,
      createdBy: currentUser ? currentUser.uid : null,
      publishedAt: postForm.published ? new Date() : null,
      location: locationPayload
    };

    try {
      setSaving(true);
      if (editingPostId) {
        await updatePost(editingPostId, payload);
        setFieldMessages(p => ({ ...p, general: "Post updated." }));
      } else {
        await createPost(payload);
        setFieldMessages(p => ({ ...p, general: "Post created." }));
      }
      const refreshed = await listAllForAdmin(1000);
      setPosts(refreshed || []);
      resetPostForm();
      setTimeout(() => {
        const top = document.querySelector(".admin-panel .admin-list");
        if (top) top.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    } catch (err) {
      console.error("Save post failed", err);
      setFieldMessages(p => ({ ...p, post: err.message || "Save failed" }));
    } finally {
      setSaving(false);
    }
  }

  async function handleEditPost(id) {
    try {
      setLoading(true);
      const p = await getPost(id);
      if (!p) { setFieldMessages(p => ({ ...p, post: "Post not found" })); return; }
      setEditingPostId(id);
      setPostForm({
        title: p.title || "",
        type: p.type ? p.type.charAt(0).toUpperCase() + p.type.slice(1) : "Article",
        categories: p.categories || [],
        descHTML: p.content || p.excerpt || "",
        imageUrl: p.imageUrl || "",
        thumbnailUrl: p.thumbnailUrl || "",
        youtubeInput: p.youtubeId || "",
        published: !!p.published,
        featured: !!p.featured,
        locationCountryId: (p.location && p.location.countryId) || null,
        locationProvinceId: (p.location && p.location.provinceId) || null,
        locationCityId: (p.location && p.location.cityId) || null
      });
      setActiveSection("posts");
      setFieldMessages(m => ({ ...m, post: "" }));
      setTimeout(() => {
        const form = document.querySelector(".admin-panel .admin-form");
        if (form) {
          form.scrollIntoView({ behavior: "smooth", block: "start" });
          const titleInput = form.querySelector('input[placeholder="Post title"]');
          if (titleInput) titleInput.focus();
        }
      }, 240);
    } catch (err) {
      console.error("Edit load failed", err);
      setFieldMessages(m => ({ ...m, post: "Failed to load post for editing." }));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePost(id) {
    if (!window.confirm("Delete post? This cannot be undone.")) return;
    if (!isOnline) { setFieldMessages(p => ({ ...p, general: "You are offline — cannot delete posts." })); return; }
    try {
      await deletePost(id);
      const refreshed = await listAllForAdmin(1000);
      setPosts(refreshed || []);
      setFieldMessages(m => ({ ...m, general: "Post deleted." }));
      if (editingPostId === id) resetPostForm();
    } catch (err) {
      console.error("Delete failed", err);
      setFieldMessages(p => ({ ...p, general: err.message || "Delete failed" }));
    }
  }

  async function togglePostField(id, field) {
    if (!isOnline) { setFieldMessages(p => ({ ...p, general: "You are offline — cannot change post status." })); return; }
    try {
      const p = await getPost(id);
      if (!p) return;
      const newVal = !p[field];
      await updatePost(id, { [field]: newVal, updatedAt: new Date(), ...(field === "published" && newVal ? { publishedAt: new Date() } : {}) });
      const refreshed = await listAllForAdmin(1000);
      setPosts(refreshed || []);
    } catch (err) {
      console.error("Toggle failed", err);
      setFieldMessages(p => ({ ...p, general: "Failed to toggle post field." }));
    }
  }

  async function handleUploaded(result) {
    if (!isOnline) {
      setFieldMessages(p => ({ ...p, upload: "You are offline — cannot attach uploaded image." }));
      return;
    }

    updatePostForm({
      imageUrl: result.imageUrl || "",
      thumbnailUrl: result.thumbnailUrl || result.imageUrl || ""
    });
    setFieldMessages(p => ({ ...p, upload: "Image uploaded." }));

    if (editingPostId) {
      try {
        await updatePost(editingPostId, {
          imageUrl: result.imageUrl || "",
          thumbnailUrl: result.thumbnailUrl || result.imageUrl || ""
        });
        const refreshed = await listAllForAdmin(1000);
        setPosts(refreshed || []);
        setFieldMessages(p => ({ ...p, general: "Image saved to post." }));
      } catch (err) {
        console.error("Failed to save uploaded image to post", err);
        setFieldMessages(p => ({ ...p, upload: "Uploaded but failed to attach to post." }));
      }
    }
  }

  /* CATEGORY CRUD (unchanged) */
  async function handleAddCategory(e) {
    e?.preventDefault?.();
    if (!isOnline) { setFieldMessages(p => ({ ...p, category: "You are offline — cannot create categories." })); return; }
    const name = (categoryFormName || "").trim();
    if (!name) { setFieldMessages(p => ({ ...p, category: "Enter category name" })); return; }
    if (!isValidCategoryName(name)) { setFieldMessages(p => ({ ...p, category: "Invalid name; allowed: letters, numbers, spaces, - and &" })); return; }
    const exists = categories.some(c => c.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) { setFieldMessages(p => ({ ...p, category: "Category already exists." })); return; }
    try {
      await createCategory(name);
      const cats = await apiListCategories();
      setCategories(cats.map(c => ({ id: c.id, name: c.name, immutable: !!c.immutable })));
      setCategoryFormName("");
      setFieldMessages(p => ({ ...p, category: "Category created." }));
      setUploaderKey(Date.now());
    } catch (err) {
      console.error("Create category failed", err);
      setFieldMessages(p => ({ ...p, category: err.message || "Create failed" }));
    }
  }

  function startEditCategory(cat) {
    setEditingCategoryId(cat.id);
    setCategoryFormName(cat.name);
    setActiveSection("categories");
    setTimeout(() => {
      const el = document.querySelector('.admin-panel input[placeholder="Category name"]');
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 200);
  }

  async function saveEditCategory() {
    if (!editingCategoryId) return;
    if (!isOnline) { setFieldMessages(p => ({ ...p, category: "You are offline — cannot update categories." })); return; }
    const nv = (categoryFormName || "").trim();
    if (!nv) { setFieldMessages(p => ({ ...p, category: "Enter category name" })); return; }
    if (!isValidCategoryName(nv)) { setFieldMessages(p => ({ ...p, category: "Invalid name; allowed chars" })); return; }
    const exists = categories.some(c => c.name.trim().toLowerCase() === nv.toLowerCase() && c.id !== editingCategoryId);
    if (exists) { setFieldMessages(p => ({ ...p, category: "Another category with that name exists." })); return; }
    try {
      await updateCategory(editingCategoryId, nv);
      const cats = await apiListCategories();
      setCategories(cats.map(c => ({ id: c.id, name: c.name, immutable: !!c.immutable })));
      setEditingCategoryId(null);
      setCategoryFormName("");
      setFieldMessages(p => ({ ...p, category: "Category updated." }));
    } catch (err) {
      console.error("Update category failed", err);
      setFieldMessages(p => ({ ...p, category: err.message || "Update failed" }));
    }
  }

  async function removeCategory(id) {
    if (!window.confirm("Delete category? This will remove it from posts' category lists.")) return;
    if (!isOnline) { setFieldMessages(p => ({ ...p, category: "You are offline — cannot delete categories." })); return; }
    try {
      const c = categories.find(x => x.id === id);
      if (c && c.immutable) {
        setFieldMessages(p => ({ ...p, category: "Cannot delete system-managed category." }));
        return;
      }
      await deleteCategory(id);
      const affected = posts.filter(p => (p.categories || []).includes(id));
      await Promise.all(affected.map(async (p) => {
        const filtered = (p.categories || []).filter(cid => cid !== id);
        try {
          await updatePost(p.id, { categories: filtered });
        } catch (err) {
          console.error(`Failed to update post ${p.id} while removing category ${id}`, err);
        }
      }));
      const cats = await apiListCategories();
      setCategories(cats.map(c => ({ id: c.id, name: c.name, immutable: !!c.immutable })));
      const refreshed = await listAllForAdmin(1000);
      setPosts(refreshed || []);
      setFieldMessages(p => ({ ...p, category: "Category deleted and removed from posts." }));
    } catch (err) {
      console.error("Delete category failed", err);
      setFieldMessages(p => ({ ...p, category: err.message || "Delete failed" }));
    }
  }

  function addCategoryToPost(id) {
    if (!id) return;
    if ((postForm.categories || []).includes(id)) return;
    updatePostForm({ categories: [...(postForm.categories || []), id] });
  }
  function removeCategoryFromPost(id) {
    updatePostForm({ categories: (postForm.categories || []).filter(c => c !== id) });
  }

  function viewPost(id, type) {
    const slugType = (type === "article" ? "article" : type === "audio" ? "audio" : type === "video" ? "video" : "directory");
    window.open(`/${slugType}/${id}`, "_blank");
  }

  async function setUserRole(uid, newRole) {
    if (!isAdmin) {
      setFieldMessages(p => ({ ...p, users: "Only admins can change roles." }));
      return;
    }
    if (!uid) return;
    if (!isOnline) { setFieldMessages(p => ({ ...p, users: "You are offline — cannot change roles." })); return; }
    try {
      setUpdatingUserId(uid);
      const ref = doc(db, "users", uid);
      await updateDoc(ref, { role: newRole, updatedAt: new Date() });
      setUsersList(prev => prev.map(u => (u.id === uid ? { ...u, role: newRole } : u)));
      const usr = usersList.find(u => u.id === uid);
      const who = usr ? (usr.displayName || usr.email || uid) : uid;
      setFieldMessages(p => ({ ...p, users: `Updated role for ${who}` }));
    } catch (err) {
      console.error("Failed to update user role", err);
      if (err && err.code === "permission-denied") {
        setFieldMessages(p => ({ ...p, users: "Permission denied. Make sure your Firestore rules allow admins to update user roles." }));
      } else {
        setFieldMessages(p => ({ ...p, users: "Failed to update role. Ensure you have permission." }));
      }
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function handleDisableUser(uid) {
    if (!isAdmin) {
      setFieldMessages(p => ({ ...p, users: "Only admins can perform this action." }));
      return;
    }
    if (!isOnline) { setFieldMessages(p => ({ ...p, users: "You are offline — cannot disable users." })); return; }
    if (!uid) return;
    if (!window.confirm("Disable user? This will set the user's account as disabled (they will not be able to perform write operations). Proceed?")) return;
    try {
      setFieldMessages(p => ({ ...p, users: "" }));
      setUpdatingUserId(uid);
      const ref = doc(db, "users", uid);
      await updateDoc(ref, { disabled: true, updatedAt: new Date() });
      setUsersList(prev => prev.map(u => (u.id === uid ? { ...u, _raw: { ...u._raw, disabled: true }, role: u.role } : u)));
      const usr = usersList.find(u => u.id === uid);
      const who = usr ? (usr.displayName || usr.email || uid) : uid;
      setFieldMessages(p => ({ ...p, users: `User ${who} disabled.` }));
    } catch (err) {
      console.error("Failed to disable user", err);
      if (err && err.code === "permission-denied") {
        setFieldMessages(p => ({ ...p, users: "Permission denied. Make sure your Firestore rules allow admins to update user records." }));
      } else {
        setFieldMessages(p => ({ ...p, users: `Failed to disable user: ${err?.message || err}` }));
      }
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function handleEnableUser(uid) {
    if (!isAdmin) {
      setFieldMessages(p => ({ ...p, users: "Only admins can perform this action." }));
      return;
    }
    if (!isOnline) { setFieldMessages(p => ({ ...p, users: "You are offline — cannot enable users." })); return; }
    if (!uid) return;
    if (!window.confirm("Enable user? This will clear the disabled flag and allow the user to perform actions again. Proceed?")) return;
    try {
      setFieldMessages(p => ({ ...p, users: "" }));
      setUpdatingUserId(uid);
      const ref = doc(db, "users", uid);
      await updateDoc(ref, { disabled: false, updatedAt: new Date() });
      setUsersList(prev => prev.map(u => (u.id === uid ? { ...u, _raw: { ...u._raw, disabled: false }, role: u.role } : u)));
      const usr = usersList.find(u => u.id === uid);
      const who = usr ? (usr.displayName || usr.email || uid) : uid;
      setFieldMessages(p => ({ ...p, users: `User ${who} enabled.` }));
    } catch (err) {
      console.error("Failed to enable user", err);
      if (err && err.code === "permission-denied") {
        setFieldMessages(p => ({ ...p, users: "Permission denied. Make sure your Firestore rules allow admins to update user records." }));
      } else {
        setFieldMessages(p => ({ ...p, users: `Failed to enable user: ${err?.message || err}` }));
      }
    } finally {
      setUpdatingUserId(null);
    }
  }

  function filterAndPage(array, query, page) {
    const q = (query || "").trim().toLowerCase();
    const filtered = q ? array.filter(item => {
      if (item.title) {
        return (item.title || "").toLowerCase().includes(q) || (item.slug || "").toLowerCase().includes(q);
      }
      if (item.name) {
        return (item.name || "").toLowerCase().includes(q);
      }
      if (item.displayName || item.email) {
        return ((item.displayName || "").toLowerCase().includes(q) || (item.email || "").toLowerCase().includes(q));
      }
      return false;
    }) : array.slice();

    const start = (page - 1) * PAGE_SIZE;
    return {
      total: filtered.length,
      pages: Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
      items: filtered.slice(start, start + PAGE_SIZE)
    };
  }

  async function handleResetPassword(uid) {
    if (!isAdmin) { setFieldMessages(p => ({ ...p, users: "Only admins can perform this action." })); return; }
    if (!uid) return;
    if (!isOnline) { setFieldMessages(p => ({ ...p, users: "You are offline — cannot send reset emails." })); return; }
    const userEntry = usersList.find(u => u.id === uid);
    const targetEmail = userEntry?.email;
    if (!targetEmail) {
      setFieldMessages(p => ({ ...p, users: "User does not have an email address on record." }));
      return;
    }
    if (!window.confirm(`Send password reset email to ${targetEmail}?`)) return;

    try {
      setFieldMessages(p => ({ ...p, users: "" }));
      const continueUrl = (typeof window !== "undefined") ? `${window.location.origin}/login` : "https://beinghappy.goldenvoices.com/login";

      try {
        await sendPasswordResetEmail(auth, targetEmail, { url: continueUrl, handleCodeInApp: true });
        setFieldMessages(p => ({ ...p, users: `Password reset email sent to ${targetEmail}` }));
        return;
      } catch (sdkErr) {
        console.error("sendPasswordResetEmail failed:", sdkErr);
        const apiKey = (firebaseConfig && firebaseConfig.apiKey) || null;
        if (!apiKey) {
          setFieldMessages(p => ({ ...p, users: "Failed to send reset email (no API key). See console for details." }));
          return;
        }

        try {
          const restUrl = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`;
          const body = {
            requestType: "PASSWORD_RESET",
            email: targetEmail,
            continueUrl,
            canHandleCodeInApp: true
          };
          const resp = await fetch(restUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          });
          if (!resp.ok) {
            const json = await resp.json().catch(() => null);
            const msg = (json && (json.error || json.error?.message)) ? (json.error?.message || JSON.stringify(json)) : `HTTP ${resp.status}`;
            console.error("REST sendOobCode failed", msg, json);
            setFieldMessages(p => ({ ...p, users: `Failed to send reset email: ${msg}` }));
            return;
          }
          setFieldMessages(p => ({ ...p, users: `Password reset email sent to ${targetEmail}` }));
          return;
        } catch (restErr) {
          console.error("REST fallback for sendOobCode failed:", restErr);
          setFieldMessages(p => ({ ...p, users: "Failed to send reset email. See console for details." }));
          return;
        }
      }
    } catch (err) {
      console.error("Failed to send reset email", err);
      setFieldMessages(p => ({ ...p, users: "Failed to send reset email. See console for details." }));
    }
  }

  // ---- Locations CRUD + helpers ----
  async function loadLocations() {
    try {
      const tree = await listLocationsTree().catch(() => []);
      const flat = await listLocations().catch(() => []);
      setLocationsTree(tree || []);
      setLocationsFlat(flat || []);
    } catch (err) {
      console.error("Failed to load locations", err);
      setLocationsTree([]);
      setLocationsFlat([]);
    }
  }

  useEffect(() => {
    loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called when clicking "Edit" in locations list — now scrolls to the Add/Edit Location area
  function startEditLocation(loc) {
    setEditingLocationId(loc.id);
    setLocationFormName(loc.name || "");
    setLocationFormType(loc.type || "country");
    setLocationFormParent(loc.parentId || "");
    // compute whether this location has children
    const hasChildren = (locationsFlat || []).some(l => l.parentId === loc.id);
    setEditingLocationHasChildren(!!hasChildren);

    // Switch to the Locations tab and scroll to the location form
    setActiveSection("locations");
    setTimeout(() => {
      const el = locationFormRef.current || document.querySelector('.admin-panel input[placeholder="Location name"]');
      if (el) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
    }, 180);
  }

  async function handleAddOrUpdateLocation(e) {
    e?.preventDefault?.();
    if (!isAdmin) return setFieldMessages(p => ({ ...p, general: "Only admins can manage locations." }));
    if (!isOnline) return setFieldMessages(p => ({ ...p, general: "You are offline — cannot change locations." }));
    const name = (locationFormName || "").trim();
    const type = (locationFormType || "country").toLowerCase();
    const parentId = locationFormParent || null;
    if (!name) return setFieldMessages(p => ({ ...p, general: "Enter location name." }));

    // Client-side validation: parent requirements
    if (type === "province" && !parentId) {
      return setFieldMessages(p => ({ ...p, general: "A province must have a parent country." }));
    }
    if (type === "city" && !parentId) {
      return setFieldMessages(p => ({ ...p, general: "A city must have a parent province." }));
    }

    // uniqueness: name + parent must be unique (allow same name under different parents)
    const nameLower = name.toLowerCase();
    const duplicate = (locationsFlat || []).find(l => {
      const sameName = (l.name || "").trim().toLowerCase() === nameLower;
      const sameParent = ((l.parentId || "") === (parentId || ""));
      if (!editingLocationId) {
        return sameName && sameParent;
      } else {
        return sameName && sameParent && l.id !== editingLocationId;
      }
    });
    if (duplicate) {
      return setFieldMessages(p => ({ ...p, general: "A location with this name already exists under the selected parent." }));
    }

    // When editing: prevent changing type if this location has children.
    if (editingLocationId) {
      const current = (locationsFlat || []).find(l => l.id === editingLocationId) || {};
      const currentType = (current.type || "").toLowerCase();
      const requestedType = type;
      if (currentType !== requestedType) {
        const hasChildren = (locationsFlat || []).some(l => l.parentId === editingLocationId);
        if (hasChildren) {
          return setFieldMessages(p => ({ ...p, general: "Cannot change type while this location has child locations. Reparent or remove children first." }));
        }
      }
    }

    try {
      if (editingLocationId) {
        await updateLocation(editingLocationId, { name, parentId, type });
        setFieldMessages(p => ({ ...p, general: "Location updated." }));
      } else {
        await createLocation({ name, type, parentId });
        setFieldMessages(p => ({ ...p, general: "Location created." }));
      }
      await loadLocations();
      setEditingLocationId(null);
      setEditingLocationHasChildren(false);
      setLocationFormName("");
      setLocationFormParent("");
      setLocationFormType("country");
    } catch (err) {
      console.error("Location save failed", err);
      // Show helpful message from server if available
      setFieldMessages(p => ({ ...p, general: err.message || "Failed to save location" }));
    }
  }

  async function handleDeleteLocation(id) {
    if (!window.confirm("Delete location? This will remove the location and adjust any posts that reference it.")) return;
    if (!isOnline) { setFieldMessages(p => ({ ...p, general: "You are offline — cannot delete locations." })); return; }
    try {
      await deleteLocation(id);
      setFieldMessages(p => ({ ...p, general: "Location deleted." }));
      await loadLocations();
      const refreshed = await listAllForAdmin(1000);
      setPosts(refreshed || []);
    } catch (err) {
      console.error("Failed to delete location", err);
      setFieldMessages(p => ({ ...p, general: err.message || "Delete failed" }));
    }
  }

  // Helper: check whether any posts reference the provided location id (country/province/city)
  function hasPostsForLocation(locationId) {
    if (!locationId || !posts || !posts.length) return false;
    return posts.some(p => {
      const L = p.location || {};
      return L.countryId === locationId || L.provinceId === locationId || L.cityId === locationId;
    });
  }

  // Expand / collapse handlers
  function toggleCountryExpand(countryId) {
    if (expandedCountryId === countryId) {
      setExpandedCountryId(null);
      setExpandedProvinceId(null);
    } else {
      setExpandedCountryId(countryId);
      setExpandedProvinceId(null);
    }
  }

  function toggleProvinceExpand(provinceId, parentCountryId) {
    // if parent country isn't expanded, expand it
    if (expandedCountryId !== parentCountryId) {
      setExpandedCountryId(parentCountryId);
    }
    if (expandedProvinceId === provinceId) {
      setExpandedProvinceId(null);
    } else {
      setExpandedProvinceId(provinceId);
    }
  }

  function renderPostsList() {
    const filteredByType = postTypeFilter === "all" ? posts : posts.filter(p => (p.type || "").toLowerCase() === postTypeFilter);
    const { total, pages, items } = filterAndPage(filteredByType, postQuery, postPage);

    return (
      <div ref={listingsTopRef}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h3 className="carousel-title">All Posts</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <select className="text-input" value={postTypeFilter} onChange={(e) => { setPostTypeFilter(e.target.value); setPostPage(1); }}>
              <option value="all">All types</option>
              <option value="article">Article</option>
              <option value="video">Video</option>
              <option value="audio">Meditation</option>
              <option value="directory">Directory</option>
            </select>
            <input className="text-input" placeholder="Search posts (title/slug)" value={postQuery} onChange={(e) => { setPostQuery(e.target.value); setPostPage(1); }} />
          </div>
        </div>

        {fieldMessages.general && <div className="account-message success-text" style={{ marginTop: 12 }}>{fieldMessages.general}</div>}

        <div className="admin-list mt-12">
          {loading ? <div className="muted">Loading…</div> : (
            items.map(p => (
              <div key={p.id} className="admin-row" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div className="admin-row-left" style={{ minWidth: 0 }}>
                  <img src={p.thumbnailUrl || p.imageUrl || "/images/placeholder.png"} alt="" className="item-thumb" />
                  <div style={{ minWidth: 0 }}>
                    <div className="detail-title admin-list-post-title" style={{ fontSize: 16 }}>{p.title}</div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                      {displayType(p.type)}{(p.categories || []).length ? ` • ${(p.categories || []).map(cid => (categories.find(c => c.id === cid) || {}).name || cid).join(", ")}` : ""}
                    </div>

                    {/* Locations line for posts (cream color, same font family/size as muted) */}
                    {p.location && (
                      <div style={{ color: "var(--cream)", fontSize: 13, marginTop: 6 }}>
                        { [p.location.countryName, p.location.provinceName, p.location.cityName].filter(Boolean).join(", ") }
                      </div>
                    )}

                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginRight: 6 }}>
                    {!p.published && <span className="badge badge-unpublished">Unpublished</span>}
                    {p.featured && <span className="badge badge-featured">Featured</span>}
                  </div>

                  <div className="admin-row-actions" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button className="see-all-link" onClick={() => viewPost(p.id, p.type)}>View</button>
                    <button className="see-all-link" onClick={() => handleEditPost(p.id)}>Edit</button>
                    <button className="account-action-btn" onClick={() => handleDeletePost(p.id)} disabled={!isOnline || !isAdmin}>Delete</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 12, gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="see-all-link" onClick={() => setPostPage(p => Math.max(1, p - 1))} disabled={postPage <= 1}>Prev</button>
          <div style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>{postPage} / {pages} ({total})</div>
          <button className="see-all-link" onClick={() => setPostPage(p => Math.min(pages, p + 1))} disabled={postPage >= pages}>Next</button>
        </div>
      </div>
    );
  }

  // --- Categories tab (listing first, add/edit later)
  function renderCategoriesTab() {
    const visibleCats = (categories || []).filter(c => !c.immutable);
    const { total, pages, items } = filterAndPage(visibleCats, categoryQuery, categoryPage);

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h3 className="carousel-title">Existing Categories</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="text-input" placeholder="Search categories" value={categoryQuery} onChange={(e) => { setCategoryQuery(e.target.value); setCategoryPage(1); }} />
          </div>
        </div>

        <div className="admin-list mt-12">
          {items.length === 0 && <div className="muted">No categories found.</div>}
          {items.map(cat => (
            <div key={cat.id} className="admin-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div className="admin-row-left">
                <div style={{ color: "var(--white)", fontSize: 16, fontWeight: 700 }}>{cat.name}</div>
              </div>
              <div className="admin-row-actions">
                <button className="see-all-link" onClick={() => startEditCategory(cat)}>Edit</button>
                {!cat.immutable ? <button className="account-action-btn" onClick={() => removeCategory(cat.id)} disabled={!isOnline || !isAdmin}>Delete</button> : null}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 12, gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="see-all-link" onClick={() => setCategoryPage(p => Math.max(1, p - 1))} disabled={categoryPage <= 1}>Prev</button>
          <div style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>{categoryPage} / {pages} ({total})</div>
          <button className="see-all-link" onClick={() => setCategoryPage(p => Math.min(pages, p + 1))} disabled={categoryPage >= pages}>Next</button>
        </div>

        <hr style={{ margin: "18px 0", borderColor: "rgba(255,255,255,0.04)" }} />

        {/* Add / Edit Category (comes after listing in this tab) */}
        <h3 className="carousel-title">{editingCategoryId ? "Edit Category" : "Add Category"}</h3>

        <div className="mt-12">
          <input ref={categoryInputRef} className="text-input" placeholder="Category name" value={categoryFormName} onChange={(e) => { setCategoryFormName(e.target.value); setFieldMessages((p) => ({ ...p, category: "" })); }} />
          <div style={{ marginTop: 8 }}>
            {editingCategoryId ? (
              <>
                <button className="account-action-btn" onClick={saveEditCategory} disabled={!isOnline || !isAdmin}>Save</button>
                <button className="see-all-link" onClick={() => { setEditingCategoryId(null); setCategoryFormName(""); }}>Cancel</button>
              </>
            ) : (
              <button className="account-action-btn" onClick={handleAddCategory} disabled={!isOnline || !isAdmin}>Add Category</button>
            )}
          </div>
        </div>

        {fieldMessages.category && <div className={`account-message ${fieldMessages.category.includes("created") || fieldMessages.category.includes("updated") ? "success-text" : "error-text"} mt-12`}>{fieldMessages.category}</div>}
      </div>
    );
  }

  // --- Locations tab (Add/Edit first, listing after)
  function renderLocationsTab() {
    // Helper: render parent select label for cities (Country -> Province)
    // Build provinces array with country name and province name then sort by country then province
    const provinceDisplayOptions = (locationsFlat || [])
      .filter(l => l.type === "province")
      .map(p => {
        const country = (locationsFlat || []).find(c => c.id === p.parentId);
        const countryName = country ? country.name : "(no country)";
        return { id: p.id, countryName, provinceName: p.name, label: `${countryName} -> ${p.name}` };
      })
      .sort((a, b) => {
        const c = a.countryName.localeCompare(b.countryName);
        if (c !== 0) return c;
        return a.provinceName.localeCompare(b.provinceName);
      });

    // Countries sorted A–Z
    const countryOptions = (locationsFlat || [])
      .filter(l => l.type === "country")
      .map(c => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const provinceOptionsForParent = (locationsFlat || []).filter(l => l.type === "province").map(p => ({ id: p.id, name: p.name, parentId: p.parentId }));

    return (
      <div>
        {/* Add / Edit Location section — placed at the top of Locations tab */}
        <div style={{ marginTop: 6 }}>
          <h3 className="carousel-title">{editingLocationId ? "Edit Location" : "Add Location"}</h3>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
            <select className="text-input" value={locationFormType} onChange={(e) => { setLocationFormType(e.target.value); setLocationFormParent(""); }}>
              <option value="country">Country</option>
              <option value="province">Province</option>
              <option value="city">City</option>
            </select>

            <input
              ref={locationFormRef}
              className="text-input"
              placeholder="Location name"
              value={locationFormName}
              onChange={(e) => setLocationFormName(e.target.value)}
            />

            <select className="text-input" value={locationFormParent || ""} onChange={(e) => setLocationFormParent(e.target.value)}>
              <option value="">Parent (None)</option>

              {/* If adding a province, show countries as parents (sorted) */}
              {locationFormType === "province" && countryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}

              {/* If adding a city, show provinces labeled "Country -> Province" (sorted by country then province) */}
              {locationFormType === "city" && provinceDisplayOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>

            <button className="account-action-btn" onClick={handleAddOrUpdateLocation} disabled={!isOnline || !isAdmin}>
              {editingLocationId ? "Save Location" : "Add Location"}
            </button>

            {editingLocationId && <button className="see-all-link" onClick={() => {
              setEditingLocationId(null);
              setEditingLocationHasChildren(false);
              setLocationFormName("");
              setLocationFormParent("");
              setLocationFormType("country");
            }}>Cancel</button>}
          </div>

          {/* Inline notes / validation hints */}
          <div style={{ marginTop: 8 }}>
           
            {editingLocationId && editingLocationHasChildren && (
              <div className="account-message error-text" style={{ marginTop: 8 }}>
                
              </div>
            )}
          </div>
        </div>

        <hr style={{ margin: "18px 0", borderColor: "rgba(255,255,255,0.04)" }} />

        {/* Existing Locations list */}
        <div style={{ marginTop: 6 }}>
          <h3 className="carousel-title">Existing Locations</h3>
          {fieldMessages.general && <div className="account-message success-text" style={{ marginTop: 12 }}>{fieldMessages.general}</div>}

          <div className="admin-list mt-12">
            {loading ? <div className="muted">Loading…</div> : (
              <>
                {locationsTree.length === 0 && <div className="muted">No locations defined.</div>}
                {locationsTree.map(country => {
                  const countryHasChildren = country.children && country.children.length > 0;
                  const countryExpanded = expandedCountryId === country.id;
                  return (
                    <div key={country.id} style={{ marginBottom: 12 }}>
                      <div className="admin-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                        <div className="admin-row-left" style={{ gap: 12 }}>
                          {/* Expand/Collapse button if country has children */}
                          {countryHasChildren ? (
                            <button
                              aria-expanded={countryExpanded}
                              aria-controls={`country-${country.id}-children`}
                              onClick={() => toggleCountryExpand(country.id)}
                              style={{
                                background: "var(--purple)",
                                color: "var(--cream)",
                                border: "none",
                                borderRadius: 6,
                                padding: "4px 8px",
                                fontWeight: 700,
                                cursor: "pointer",
                                marginRight: 6
                              }}
                              title={countryExpanded ? "Collapse" : "Expand"}
                            >
                              {countryExpanded ? "−" : "+"}
                            </button>
                          ) : <span style={{ width: 28 }} />}

                          <div style={{ fontWeight: 700 }}>{country.name} <span style={{ fontSize: 13, color: "#f5e9de", marginLeft: 8, textTransform:"capitalize"  }}>({country.type})</span></div>
                        </div>
                        <div className="admin-row-actions">
                         
                          {/* Show View Posts only when posts reference this location */}
                          {hasPostsForLocation(country.id) && (
                            <button className="see-all-link" onClick={() => window.open(`/location/${country.id}`, "_blank")}>View posts</button>
                          )}
                           <button className="see-all-link" onClick={() => startEditLocation(country)}>Edit</button>
                          <button className="account-action-btn" onClick={() => handleDeleteLocation(country.id)} disabled={!isOnline || !isAdmin}>Delete</button>
                        </div>
                      </div>

                      {/* provinces: only show when country expanded */}
                      {countryExpanded && country.children && country.children.length > 0 && (
                        <div id={`country-${country.id}-children`} style={{ marginLeft: 22, marginTop: 8 }}>
                          {country.children.map(prov => {
                            const provHasChildren = prov.children && prov.children.length > 0;
                            const provExpanded = expandedProvinceId === prov.id;
                            return (
                              <div key={prov.id} style={{ marginBottom: 8 }}>
                                <div className="admin-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                                  <div className="admin-row-left" style={{ gap: 12 }}>
                                    {provHasChildren ? (
                                      <button
                                        aria-expanded={provExpanded}
                                        aria-controls={`prov-${prov.id}-children`}
                                        onClick={() => toggleProvinceExpand(prov.id, country.id)}
                                        style={{
                                          background: "var(--purple)",
                                          color: "var(--cream)",
                                          border: "none",
                                          borderRadius: 6,
                                          padding: "4px 8px",
                                          fontWeight: 700,
                                          cursor: "pointer",
                                          marginRight: 6
                                        }}
                                        title={provExpanded ? "Collapse" : "Expand"}
                                      >
                                        {provExpanded ? "−" : "+"}
                                      </button>
                                    ) : <span style={{ width: 28 }} />}

                                    <div style={{ fontWeight: 700 }}>{prov.name} <span style={{ fontSize: 13, color: "#f5e9de", marginLeft: 8,textTransform:"capitalize"  }}>({prov.type})</span></div>
                                  </div>
                                  <div className="admin-row-actions">
                                  
                                    {hasPostsForLocation(prov.id) && (
                                      <button className="see-all-link" onClick={() => window.open(`/location/${prov.id}`, "_blank")}>View posts</button>
                                    )}
                                      <button className="see-all-link" onClick={() => startEditLocation(prov)}>Edit</button>
                                    <button className="account-action-btn" onClick={() => handleDeleteLocation(prov.id)} disabled={!isOnline || !isAdmin}>Delete</button>
                                  </div>
                                </div>

                                {/* cities: only show when province expanded */}
                                {provExpanded && prov.children && prov.children.length > 0 && (
                                  <div id={`prov-${prov.id}-children`} style={{ marginLeft: 22, marginTop: 6 }}>
                                    {prov.children.map(city => (
                                      <div key={city.id} className="admin-row" style={{ alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                                        <div className="admin-row-left">
                                          <div style={{ fontWeight: 700 }}>{city.name} <span style={{ fontSize: 13, color: "#f5e9de", marginLeft: 8, textTransform:"capitalize" }}>({city.type})</span></div>
                                        </div>
                                        <div className="admin-row-actions">
                                       
                                          {hasPostsForLocation(city.id) && (
                                            <button className="see-all-link" onClick={() => window.open(`/location/${city.id}`, "_blank")}>View posts</button>
                                          )}
                                             <button className="see-all-link" onClick={() => startEditLocation(city)}>Edit</button>
                                          <button className="account-action-btn" onClick={() => handleDeleteLocation(city.id)} disabled={!isOnline || !isAdmin}>Delete</button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderUsersList() {
    const { total, pages, items } = filterAndPage(usersList, userQuery, userPage);
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h3 className="carousel-title">Users</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="text-input" placeholder="Search name or email" value={userQuery} onChange={(e) => { setUserQuery(e.target.value); setUserPage(1); }} />
          </div>
        </div>

        <div className="admin-list mt-12 users-grid">
          {loadingUsers ? <div className="muted">Loading users…</div> : (
            <>
              {items.length === 0 && <div className="muted">No users found.</div>}
              {items.map(u => {
                const disabled = !!(u._raw && u._raw.disabled);
                return (
                <div key={u.id} className="admin-row user-row" style={{ alignItems: "center", justifyContent: "space-between", padding: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px auto", gap: 12, alignItems: "center", width: "100%" }}>
                    <div style={{ fontWeight: 700 }}>{u.displayName || "—"}</div>

                    <div>
                      <div className="muted" style={{ fontSize: 13 }}>{u.email || "—"}</div>
                      { (u.role && u.role.toLowerCase() === "admin") && (
                        <div style={{ fontSize: 13, color: "var(--cream)", marginTop: 4 }}>{u.id}</div>
                      )}
                    </div>

                    <div style={{ textTransform: "capitalize", fontWeight: 700, color: (u.role && u.role.toLowerCase() === "admin") ? "salmon" : "var(--cream)", fontSize: 13 }}>
                      {(u.role || "user").toLowerCase()}
                      {disabled ? " • disabled" : ""}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      {u.id === (currentUser && currentUser.uid) ? (
                        <button className="see-all-link" title="This is you" disabled>Current user</button>
                      ) : null}

                      {u.role !== "admin" ? (
                        <button className="account-action-btn" disabled={updatingUserId === u.id || !isOnline || !isAdmin} onClick={() => setUserRole(u.id, "admin")}>
                          {updatingUserId === u.id ? "Updating…" : "Make Admin"}
                        </button>
                      ) : (
                        u.id === (currentUser && currentUser.uid) ? null : (
                          <button
                            className="see-all-link"
                            disabled={updatingUserId === u.id || !isOnline || !isAdmin}
                            onClick={() => setUserRole(u.id, "user")}
                            title="Demote to user"
                          >
                            {updatingUserId === u.id ? "Updating…" : "Remove Admin"}
                          </button>
                        )
                      )}

                      <button className="see-all-link" onClick={() => handleResetPassword(u.id)} disabled={!isOnline || !isAdmin}>Reset Password</button>

                      {disabled ? (
                        <button className="account-action-btn" disabled={updatingUserId === u.id || !isOnline || !isAdmin} onClick={() => handleEnableUser(u.id)}>
                          {updatingUserId === u.id ? "Updating…" : "Enable User"}
                        </button>
                      ) : (
                        <button className="account-action-btn" disabled={updatingUserId === u.id || !isOnline || !isAdmin} onClick={() => handleDisableUser(u.id)}>
                          {updatingUserId === u.id ? "Updating…" : "Disable User"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )})}
            </>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 12, gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="see-all-link" onClick={() => setUserPage(p => Math.max(1, p - 1))} disabled={userPage <= 1}>Prev</button>
          <div style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>{userPage} / {pages} ({total})</div>
          <button className="see-all-link" onClick={() => setUserPage(p => Math.min(pages, p + 1))} disabled={userPage >= pages}>Next</button>
        </div>
      </div>
    );
  }

  if (!hasFirestore) {
    return (
      <div className="main-content">
        <div className="admin-panel admin-extra">
          <h2 className="carousel-title">Admin Panel</h2>
          <div className="muted">Admin UI requires Firestore backend (postsApi & categoriesApi).</div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="admin-panel admin-extra">
        <div className="promo-box">
          <Breadcrumbs items={[{ label: "Home", to: "/index" }, { label: "Admin" }]} />
          <div style={{ marginTop: 8 }}><div className="greeting">Admin Panel</div></div>
        </div>

        {!isOnline && (
          <div style={{ marginBottom: 12 }}>
            <div className="account-message error-text">You are offline — all write operations (create/update/delete/upload) are disabled until you reconnect.</div>
          </div>
        )}

        <div className="admin-tabs" role="tablist" aria-label="Admin Sections">
          <button className={`admin-tab-btn ${activeSection === "posts" ? "active" : ""}`} type="button" onClick={() => setActiveSection("posts")}>Posts</button>
          <button className={`admin-tab-btn ${activeSection === "categories" ? "active" : ""}`} type="button" onClick={() => setActiveSection("categories")}>Categories</button>
          <button className={`admin-tab-btn ${activeSection === "locations" ? "active" : ""}`} type="button" onClick={() => setActiveSection("locations")}>Locations</button>
          <button className={`admin-tab-btn ${activeSection === "featured" ? "active" : ""}`} type="button" onClick={() => setActiveSection("featured")}>Featured</button>
          {isAdmin && (
            <button className={`admin-tab-btn ${activeSection === "users" ? "active" : ""}`} type="button" onClick={() => setActiveSection("users")}>Users</button>
          )}
        </div>

        <div className={activeSection === "posts" ? "admin-tab active" : "admin-tab"}>
          {renderPostsList()}

          <hr style={{ margin: "18px 0", borderColor: "rgba(255,255,255,0.04)" }} />

          <h3 className="carousel-title">{editingPostId ? "Edit Post" : "Add Post"}</h3>
          <form className="admin-form" ref={postFormRef} onSubmit={handleSavePost}>

            <label className="form-label">Type</label>
            <select className="text-input" value={postForm.type} onChange={(e) => updatePostForm({ type: e.target.value })} disabled={!!editingPostId}>
              <option>Article</option>
              <option>Video</option>
              <option>Audio</option>
              <option>Directory</option>
            </select>

            <label className="form-label">Title</label>
            <input className="text-input" placeholder="Post title" value={postForm.title} onChange={(e) => updatePostForm({ title: e.target.value })} required />

            <label className="form-label">Categories (pick one or more)</label>
            <div className="row gap-8">
              <select
                className="text-input"
                onChange={(e) => { if (e.target.value) { addCategoryToPost(e.target.value); e.target.value = ""; } }}
              >
                <option value="">Add Category</option>
                {categories.filter(c => !c.immutable).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="category-chips mt-8 mb-8 ">
              {(postForm.categories || []).map(cid => {
                const name = (categories.find(x => x.id === cid) || {}).name || cid;
                return (
                  <span key={cid} className="chip">
                    <span className="chip-label">{name}</span>
                    <button type="button" className="chip-x" onClick={() => removeCategoryFromPost(cid)} aria-label={`remove ${name}`}>&times;</button>
                  </span>
                );
              })}
            </div>

            <label className="form-label">Description (WYSIWYG)</label>

            <div
              className="wysiwyg-toolbar"
              style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}
            >
              <button type="button" className="wys-btn" style={{ minWidth: 44 }} onClick={() => document.execCommand("bold", false, null)}><b>B</b></button>
              <button type="button" className="wys-btn" style={{ minWidth: 44 }} onClick={() => document.execCommand("italic", false, null)}><i>I</i></button>
              <button type="button" className="wys-btn" style={{ minWidth: 44 }} onClick={() => document.execCommand("underline", false, null)}>U</button>
              <button type="button" className="wys-btn" style={{ minWidth: 44 }} onClick={() => document.execCommand("strikeThrough", false, null)} title="Strikethrough"><s>S</s></button>
              <button type="button" className="wys-btn" style={{ minWidth: 64 }} onClick={() => document.execCommand("formatBlock", false, "h2")}>H2</button>
              <button type="button" className="wys-btn" style={{ minWidth: 64 }} onClick={() => document.execCommand("formatBlock", false, "h3")}>H3</button>
              <button type="button" className="wys-btn" style={{ minWidth: 64 }} onClick={() => document.execCommand("insertUnorderedList", false, null)}>&bull; List</button>
              <button type="button" className="wys-btn" style={{ minWidth: 110 }} onClick={() => document.execCommand("insertOrderedList", false, null)}>Numbered List</button>
              <button type="button" className="wys-btn" style={{ minWidth: 56 }} onClick={() => document.execCommand("insertHorizontalRule", false, null)}>Line</button>
              <button type="button" className="wys-btn" style={{ minWidth: 56 }} onClick={() => {
                const url = window.prompt("Enter URL");
                if (url && wysiwygRef.current) document.execCommand("createLink", false, url);
              }}>Link</button>
            </div>

            <div
              ref={wysiwygRef}
              className="wysiwyg"
              contentEditable
              onInput={() => {
                try {
                  const html = wysiwygRef.current ? wysiwygRef.current.innerHTML : "";
                  updatePostForm({ descHTML: html });
                } catch (err) {
                  setFieldMessages((p) => ({ ...p, post: "Editor not available" }));
                }
              }}
              onPaste={(e) => {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData('text/plain');
                document.execCommand('insertText', false, text);
              }}
              style={{ whiteSpace: "pre-wrap" }}
            />

            { ImageUploader && workerUrl && isOnline ? (
              <ImageUploader
                key={`${uploaderKey}-${editingPostId || "new"}`}
                workerUrl={workerUrl}
                postId={editingPostId || "temp"}
                onUploaded={handleUploaded}
              />
            ) : (!isOnline ? (
              <div className="muted" style={{ marginTop: 8 }}>Offline — image uploads disabled until you're online.</div>
            ) : null) }

            {fieldMessages.upload && <div className="account-message">{fieldMessages.upload}</div>}

            {postForm.type !== "Directory" && (
              <>
                <label className="form-label">YouTube URL or ID { (postForm.type === "Video" || postForm.type === "Audio") ? "(required for Video/Audio)" : "(optional for Article)" }</label>
                <input className="text-input" value={postForm.youtubeInput} onChange={(e) => updatePostForm({ youtubeInput: e.target.value })} placeholder="https://youtu.be/xxxx or ID" />
                {fieldMessages.youtube && <div className="account-message error-text">{fieldMessages.youtube}</div>}
              </>
            )}

            { (postForm.type || "").toLowerCase() === "directory" && (
              <div style={{ marginTop: 12 }}>
                <label className="form-label">Location (optional — only for Directory)</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <select className="text-input" value={postForm.locationCountryId || ""} onChange={(e) => {
                    const val = e.target.value || null;
                    updatePostForm({ locationCountryId: val, locationProvinceId: null, locationCityId: null });
                  }}>
                    <option value="">None (country)</option>
                    {(locationsFlat || []).filter(l => l.type === "country").sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>

                  <select className="text-input" value={postForm.locationProvinceId || ""} onChange={(e) => {
                    const val = e.target.value || null;
                    updatePostForm({ locationProvinceId: val, locationCityId: null });
                  }} disabled={!postForm.locationCountryId}>
                    <option value="">None (province)</option>
                    {(locationsFlat || []).filter(l => l.type === "province" && (!postForm.locationCountryId || l.parentId === postForm.locationCountryId)).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>

                  <select className="text-input" value={postForm.locationCityId || ""} onChange={(e) => {
                    const val = e.target.value || null;
                    updatePostForm({ locationCityId: val });
                  }} disabled={!postForm.locationProvinceId}>
                    <option value="">None (city)</option>
                    {(locationsFlat || []).filter(l => l.type === "city" && (!postForm.locationProvinceId || l.parentId === postForm.locationProvinceId)).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="inline-checkbox-row" style={{ marginTop: 12 }}>
              <label style={{ marginBottom: 0, display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                <input type="checkbox" checked={postForm.published} onChange={(e) => updatePostForm({ published: e.target.checked })} /> <span style={{ marginLeft: 6 }}>Published</span>
              </label>
              <label style={{ marginBottom: 0, display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                <input type="checkbox" checked={postForm.featured} onChange={(e) => updatePostForm({ featured: e.target.checked })} /> <span style={{ marginLeft: 6 }}>Featured</span>
              </label>
            </div>

            <div className="row gap-12 mt-12">
              <button className="account-action-btn" type="submit" disabled={saving || !isOnline || !isAdmin}>{saving ? "Saving…" : (editingPostId ? "Save Post" : "Add Post")}</button>
              <button type="button" className="see-all-link" onClick={resetPostForm}>Reset</button>
            </div>

            {fieldMessages.post && <div className="account-message error-text mt-12">{fieldMessages.post}</div>}
          </form>
        </div>

        <div className={activeSection === "categories" ? "admin-tab active" : "admin-tab"}>
          {renderCategoriesTab()}
        </div>

        <div className={activeSection === "locations" ? "admin-tab active" : "admin-tab"}>
          {renderLocationsTab()}
        </div>

        <div className={activeSection === "featured" ? "admin-tab active" : "admin-tab"}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 className="carousel-title">Featured Posts</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select className="text-input" value={featuredTypeFilter} onChange={(e) => { setFeaturedTypeFilter(e.target.value); }}>
                <option value="all">All types</option>
                <option value="article">Article</option>
                <option value="video">Video</option>
                <option value="audio">Meditation</option>
                <option value="directory">Directory</option>
              </select>
              <input className="text-input" placeholder="Search featured posts" value={featuredQuery} onChange={(e) => setFeaturedQuery(e.target.value)} />
            </div>
          </div>

          <div className="admin-list mt-12">
            {posts
              .filter(p => p.featured)
              .filter(p => (featuredTypeFilter === "all" ? true : (p.type || "").toLowerCase() === featuredTypeFilter))
              .filter(p => {
                const q = (featuredQuery || "").trim().toLowerCase();
                if (!q) return true;
                return ((p.title || "").toLowerCase().includes(q) || (p.slug || "").toLowerCase().includes(q) || (p.content || "").toLowerCase().includes(q));
              })
              .map(p => (
                <div key={p.id} className="admin-row">
                  <div className="admin-row-left">
                    <img src={p.thumbnailUrl || p.imageUrl || "/images/placeholder.png"} alt="" className="item-thumb" />
                    <div>
                      <div className="detail-title" style={{ fontSize: 16 }}>{p.title}</div>
                      <div className="muted" style={{ fontSize: 13 }}>{displayType(p.type)} • {(p.categories || []).map(cid => (categories.find(c => c.id === cid) || {}).name || cid).join(", ")}</div>
                      {p.location && <div style={{ color: "var(--cream)", fontSize: 13, marginTop: 6 }}>{[p.location.countryName, p.location.provinceName, p.location.cityName].filter(Boolean).join(", ")}</div>}
                    </div>
                  </div>
                  <div className="admin-row-actions">
                    <button className="see-all-link" onClick={() => viewPost(p.id, p.type)}>View</button>
                    <button className="see-all-link" onClick={() => handleEditPost(p.id)}>Edit</button>
                  </div>
                </div>
              ))
            }
            {posts.filter(p => p.featured).length === 0 && <div className="muted">No featured posts yet.</div>}
          </div>
        </div>

        {isAdmin && (
          <div className={activeSection === "users" ? "admin-tab active" : "admin-tab"}>
            {renderUsersList()}
            {fieldMessages.users && <div style={{ marginTop: 12 }} className={`account-message ${fieldMessages.users.includes("Failed") || fieldMessages.users.includes("Permission") ? "error-text" : "success-text"}`}>{fieldMessages.users}</div>}
          </div>
        )}
      </div>
    </div>
  );
}