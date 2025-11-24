// src/pages/AdminPanel.jsx
// Admin Panel — full file
// Changes in this version:
// - Removed code-block insertion option from the WYSIWYG editor (no code insertion).
// - Reordered toolbar buttons to: Bold, Italic, Underline, Strikethrough (S struck), H2, H3,
//   Pointed List, Numbered List, Line, Link.
// - Adjusted toolbar to be responsive (flex-wrap) so buttons flow to next line on small screens.
// - Kept sanitizeHtml allowing H2/H3/UL/OL/LI/P/BR/PRE/CODE/HR/B/I/U/S/A[href]; already strips attributes.
// - No other behavioral changes.

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import ImageUploader from "../components/PostFormFields/ImageUploader";
import Breadcrumbs from "../components/Breadcrumbs";
import { listCategories as apiListCategories, createCategory, updateCategory, deleteCategory } from "../api/categories";
import { createPost, updatePost, getPost, listAllForAdmin, deletePost } from "../api/posts";

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
/**
 * sanitizeHtml
 * - DOM based sanitizer that:
 *   * allows a conservative whitelist of tags:
 *     p, br, b/strong, i/em, u, s/strike, h2, h3, ul, ol, li, pre, code, hr, a[href]
 *   * strips ALL attributes except href on <a> (and ensures href is not javascript: or data:)
 *   * removes style/class/other attributes
 * - Returns sanitized innerHTML (string).
 */
function sanitizeHtml(html) {
  if (!html || typeof html !== "string") return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Allowed tags set (upper-case tagName)
    const allowed = new Set([
      "A", "P", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
      "H2", "H3", "UL", "OL", "LI", "PRE", "CODE", "HR"
    ]);

    // Walk all elements and clean or unwrap
    const all = Array.from(doc.body.querySelectorAll("*"));
    for (const node of all) {
      const tn = node.tagName.toUpperCase();
      if (!allowed.has(tn)) {
        // unwrap node: move children before node, then remove node
        const parent = node.parentNode;
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
        continue;
      }

      // For allowed tags, strip attributes except href on <a>
      for (const attr of Array.from(node.attributes)) {
        if (tn === "A" && attr.name === "href") {
          // keep href but sanitize javascript: and data: URIs
          try {
            const href = (attr.value || "").trim();
            const lower = href.toLowerCase();
            if (lower.startsWith("javascript:") || lower.startsWith("data:")) {
              node.removeAttribute(attr.name);
            } else {
              // keep href
            }
          } catch (e) {
            node.removeAttribute(attr.name);
          }
        } else {
          node.removeAttribute(attr.name);
        }
      }

      // Defensive: ensure style/class removed
      if (node.style) node.removeAttribute("style");
      node.removeAttribute("class");
    }

    // Clean up empty font tags if any slipped through (defensive)
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
  // default upload key for testing/local (will be null in production if not provided)
  const uploadKeyEnv = process.env.REACT_APP_UPLOAD_KEY || null;

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  // categories now store immutable flag
  const [categories, setCategories] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [activeSection, setActiveSection] = useState("posts");
  const [editingPostId, setEditingPostId] = useState(null);
  const [editingCategoryId, setEditingCategoryId] = useState(null);

  const wysiwygRef = useRef(null);
  const listingsTopRef = useRef(null);
  const categoryInputRef = useRef(null);
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
    featured: false
  });

  const [categoryFormName, setCategoryFormName] = useState("");
  const [fieldMessages, setFieldMessages] = useState({ general: "", post: "", category: "", upload: "", youtube: "", users: "" });
  const [saving, setSaving] = useState(false);

  // Listing state: pagination + search + type filter for posts
  const [postPage, setPostPage] = useState(1);
  const [postQuery, setPostQuery] = useState("");
  const [postTypeFilter, setPostTypeFilter] = useState("all"); // all / article / video / audio / directory

  // Featured tab search/filter (separate state so posts list and featured can be independently searched)
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
        // Ensure type categories exist before loading the rest
        await ensureTypeCategories();

        const [allPosts, cats] = await Promise.all([listAllForAdmin(1000), apiListCategories()]);
        if (cancelled) return;
        setPosts(allPosts || []);
        // store immutable flag so we can filter them out in the UI
        setCategories((cats || []).map(c => ({ id: c.id, name: c.name, immutable: !!c.immutable })));
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

  // Clear admin fieldMessages when switching sections so messages don't persist across tabs
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
      featured: false
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
    if (ty.toLowerCase() !== "directory") { // directories don't require title or description? keep title required
      if (!t) return "Title is required.";
      if (!desc) return "Description is required.";
    } else {
      // For directories still require title (keeps behavior consistent)
      if (!t) return "Title is required.";
    }
    // YouTube required for Video and Audio (Meditation)
    if (ty === "Video" || ty === "Audio") {
      if (!postForm.youtubeInput || !extractYouTubeId(postForm.youtubeInput)) return "YouTube URL/ID is required and must be valid for Video/Audio types.";
    }
    // categories required for non-directory posts (keep existing behavior)
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
      publishedAt: postForm.published ? new Date() : null
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
        featured: !!p.featured
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
      // Use only one place to display the deletion message (removed top-level duplicate render)
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
    // Only allow attaching uploaded image when online
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

  /* CATEGORY CRUD */
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
      // update posts to remove category
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
      // Use friendly name/email in feedback
      const usr = usersList.find(u => u.id === uid);
      const who = usr ? (usr.displayName || usr.email || uid) : uid;
      setFieldMessages(p => ({ ...p, users: `Updated role for ${who}` }));
    } catch (err) {
      console.error("Failed to update user role", err);
      // Permission denied likely if rules don't allow — surface a helpful message
      if (err && err.code === "permission-denied") {
        setFieldMessages(p => ({ ...p, users: "Permission denied. Make sure your Firestore rules allow admins to update user roles." }));
      } else {
        setFieldMessages(p => ({ ...p, users: "Failed to update role. Ensure you have permission." }));
      }
    } finally {
      setUpdatingUserId(null);
    }
  }

  // New: disable user by setting users/{uid}.disabled = true
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
      // update local list to reflect flag immediately
      setUsersList(prev => prev.map(u => (u.id === uid ? { ...u, _raw: { ...u._raw, disabled: true }, role: u.role } : u)));
      const usr = usersList.find(u => u.id === uid);
      const who = usr ? (usr.displayName || usr.email || uid) : uid;
      setFieldMessages(p => ({ ...p, users: `User ${who} disabled.` }));
    } catch (err) {
      console.error("Failed to disable user", err);
      if (err && err.code === "permission-denied") {
        setFieldMessages(p => ({ ...p, users: "Permission denied. Make sure your Firestore rules allow admins to update user records." }));
      } else {
        // admin gets full details; others will see friendly message elsewhere
        setFieldMessages(p => ({ ...p, users: `Failed to disable user: ${err?.message || err}` }));
      }
    } finally {
      setUpdatingUserId(null);
    }
  }

  // New: enable user by clearing users/{uid}.disabled (set to false)
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

  // ---- User action stubs (Reset password) ----
  async function handleResetPassword(uid) {
    if (!isAdmin) { setFieldMessages(p => ({ ...p, users: "Only admins can perform this action." })); return; }
    if (!uid) return;
    if (!isOnline) { setFieldMessages(p => ({ ...p, users: "You are offline — cannot send reset emails." })); return; }
    // find user email from usersList
    const userEntry = usersList.find(u => u.id === uid);
    const targetEmail = userEntry?.email;
    if (!targetEmail) {
      setFieldMessages(p => ({ ...p, users: "User does not have an email address on record." }));
      return;
    }
    if (!window.confirm(`Send password reset email to ${targetEmail}?`)) return;

    try {
      setFieldMessages(p => ({ ...p, users: "" }));

      // Use app origin as continue URL (landing to login)
      const continueUrl = (typeof window !== "undefined") ? `${window.location.origin}/login` : "https://being-happy-pwa.web.app/login";

      try {
        // Primary attempt: client SDK
        await sendPasswordResetEmail(auth, targetEmail, { url: continueUrl, handleCodeInApp: true });
        setFieldMessages(p => ({ ...p, users: `Password reset email sent to ${targetEmail}` }));
        return;
      } catch (sdkErr) {
        console.error("sendPasswordResetEmail failed:", sdkErr);

        // Specific fallback: if SDK complains about recaptcha/internal, try REST endpoint using apiKey
        // This fallback uses the Identity Toolkit sendOobCode endpoint.
        const apiKey = (firebaseConfig && firebaseConfig.apiKey) || null;
        if (!apiKey) {
          setFieldMessages(p => ({ ...p, users: "Failed to send reset email (no API key). See console for details." }));
          return;
        }

        // Attempt REST fallback
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

  // ---- Render helpers ----
  function renderPostsList() {
    // apply type filter first
    const filteredByType = postTypeFilter === "all" ? posts : posts.filter(p => (p.type || "").toLowerCase() === postTypeFilter);
    const { total, pages, items } = filterAndPage(filteredByType, postQuery, postPage);

    return (
      <div ref={listingsTopRef}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h3 className="carousel-title">All Posts</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                    <div className="detail-title" style={{ fontSize: 16 }}>{p.title}</div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                      {displayType(p.type)}{(p.categories || []).length ? ` • ${(p.categories || []).map(cid => (categories.find(c => c.id === cid) || {}).name || cid).join(", ")}` : ""}
                    </div>
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

  function renderCategoriesList() {
    // hide immutable/system type categories from the Existing Categories view
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

                    {/* Email column: always show email. If the listed user is an admin, show their uid below the email in cream color */}
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

                      {/* Enable / Disable button */}
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

        {/* Offline banner */}
        {!isOnline && (
          <div style={{ marginBottom: 12 }}>
            <div className="account-message error-text">You are offline — all write operations (create/update/delete/upload) are disabled until you reconnect.</div>
          </div>
        )}

        <div className="admin-tabs" role="tablist" aria-label="Admin Sections">
          <button className={`admin-tab-btn ${activeSection === "posts" ? "active" : ""}`} type="button" onClick={() => setActiveSection("posts")}>Posts</button>
          <button className={`admin-tab-btn ${activeSection === "categories" ? "active" : ""}`} type="button" onClick={() => setActiveSection("categories")}>Categories</button>
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
                {/* exclude immutable/system type categories from the selector */}
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

            {/* WYSIWYG toolbar (responsive: wraps on small screens). Order: Bold, Italic, Underline, Strikethrough, H2, H3, Bulleted List, Numbered List, Line, Link */}
            <div
              className="wysiwyg-toolbar"
              style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}
            >
              <button type="button" className="wys-btn" style={{ minWidth: 44 }} onClick={() => document.execCommand("bold", false, null)}><b>B</b></button>
              <button type="button" className="wys-btn" style={{ minWidth: 44 }} onClick={() => document.execCommand("italic", false, null)}><i>I</i></button>
              <button type="button" className="wys-btn" style={{ minWidth: 44 }} onClick={() => document.execCommand("underline", false, null)}>U</button>
              <button type="button" className="wys-btn" style={{ minWidth: 44 }} onClick={() => document.execCommand("strikeThrough", false, null)} title="Strikethrough"><s>S</s></button>

              {/* Headings */}
              <button type="button" className="wys-btn" style={{ minWidth: 64 }} onClick={() => document.execCommand("formatBlock", false, "h2")}>H2</button>
              <button type="button" className="wys-btn" style={{ minWidth: 64 }} onClick={() => document.execCommand("formatBlock", false, "h3")}>H3</button>

              {/* Lists */}
              <button type="button" className="wys-btn" style={{ minWidth: 64 }} onClick={() => document.execCommand("insertUnorderedList", false, null)}>&bull; List</button>
              <button type="button" className="wys-btn" style={{ minWidth: 110 }} onClick={() => document.execCommand("insertOrderedList", false, null)}>Numbered List</button>

              {/* Horizontal rule */}
              <button type="button" className="wys-btn" style={{ minWidth: 56 }} onClick={() => document.execCommand("insertHorizontalRule", false, null)}>Line</button>

              {/* Link helper */}
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
                // Insert plain text to avoid pasted styles; sanitize on save as well.
                const text = (e.clipboardData || window.clipboardData).getData('text/plain');
                document.execCommand('insertText', false, text);
              }}
              style={{ whiteSpace: "pre-wrap" }}
            />

            { /* Show ImageUploader for all types (optional for Directory) when workerUrl available and online */ }
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
          {renderCategoriesList()}

          <hr style={{ margin: "18px 0", borderColor: "rgba(255,255,255,0.04)" }} />

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
                      {/* Make metadata font-size match Posts listing */}
                      <div className="muted" style={{ fontSize: 13 }}>{displayType(p.type)} • {(p.categories || []).map(cid => (categories.find(c => c.id === cid) || {}).name || cid).join(", ")}</div>
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