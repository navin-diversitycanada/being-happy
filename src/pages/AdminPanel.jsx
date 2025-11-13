// src/pages/AdminPanel.jsx
// Modified: removed duplicate top-level general message, added featured section filter + search,
// adjusted categories add layout to put button on next row and make input full-width,
// ensured featured tab has type filter and search similar to Posts list.

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import ImageUploader from "../components/PostFormFields/ImageUploader";
import { listCategories as apiListCategories, createCategory, updateCategory, deleteCategory } from "../api/categories";
import { createPost, updatePost, getPost, listAllForAdmin, deletePost } from "../api/posts";

// Firestore SDK (modular) for type-category ensures and user management
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs } from "firebase/firestore";
import { listFavorites } from "../api/favorites";

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

function sanitizeHtml(html) {
  if (!html || typeof html !== "string") return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const all = doc.querySelectorAll("*");
    all.forEach(node => {
      node.removeAttribute("style");
      node.removeAttribute("class");
      node.removeAttribute("face");
      node.removeAttribute("color");
      node.removeAttribute("size");
    });
    doc.querySelectorAll("font").forEach(font => {
      while (font.firstChild) font.parentNode.insertBefore(font.firstChild, font);
      font.parentNode.removeChild(font);
    });
    return doc.body.innerHTML;
  } catch (err) {
    console.warn("Sanitize failed", err);
    return html;
  }
}

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
    try {
      const p = await getPost(id);
      if (!p) return;
      const newVal = !p[field];
      await updatePost(id, { [field]: newVal, updatedAt: new Date(), ...(field === "published" && newVal ? { publishedAt: new Date() } : {}) });
      const refreshed = await listAllForAdmin(1000);
      setPosts(refreshed || []);
    } catch (err) {
      console.error("Toggle failed", err);
    }
  }

  async function handleUploaded(result) {
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
    try {
      setUpdatingUserId(uid);
      const ref = doc(db, "users", uid);
      await updateDoc(ref, { role: newRole, updatedAt: new Date() });
      setUsersList(prev => prev.map(u => (u.id === uid ? { ...u, role: newRole } : u)));
      setFieldMessages(p => ({ ...p, users: `Updated role for ${uid}` }));
    } catch (err) {
      console.error("Failed to update user role", err);
      setFieldMessages(p => ({ ...p, users: "Failed to update role. Ensure you have permission." }));
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

  // ---- User action stubs (Reset password / Disable user) ----
  async function handleResetPassword(uid) {
    if (!isAdmin) { setFieldMessages(p => ({ ...p, users: "Only admins can perform this action." })); return; }
    if (!window.confirm("Reset password for this user? This requires a server-side implementation to actually reset (this is a UI stub).")) return;
    // TODO: call Cloud Function or server endpoint that performs privileged reset.
    setFieldMessages(p => ({ ...p, users: "Reset password requested — implement server-side function to perform this action." }));
  }

  async function handleDisableUser(uid) {
    if (!isAdmin) { setFieldMessages(p => ({ ...p, users: "Only admins can perform this action." })); return; }
    if (!window.confirm("Disable user? This requires a server-side implementation to disable the account (this is a UI stub).")) return;
    // TODO: call Cloud Function to disable user or update a flag in Firestore and enforce in security rules.
    setFieldMessages(p => ({ ...p, users: "Disable user requested — implement server-side function to perform this action." }));
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
                      {/* Show capitalized type first (consistent with Featured page) */}
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
                    <button className="account-action-btn" onClick={() => handleDeletePost(p.id)}>Delete</button>
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
    const { total, pages, items } = filterAndPage(categories, categoryQuery, categoryPage);
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
                {!cat.immutable ? <button className="account-action-btn" onClick={() => removeCategory(cat.id)}>Delete</button> : null}
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
              {items.map(u => (
                <div key={u.id} className="admin-row user-row" style={{ alignItems: "center", justifyContent: "space-between", padding: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px auto", gap: 12, alignItems: "center", width: "100%" }}>
                    <div style={{ fontWeight: 700 }}>{u.displayName || "—"}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{u.email || "—"}</div>
                    <div style={{ textTransform: "capitalize", fontWeight: 700, color: (u.role && u.role.toLowerCase() === "admin") ? "salmon" : "var(--cream)" }}>{(u.role || "user").toLowerCase()}</div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      {/* If this is the current logged-in user, show an inert "Current user" button */}
                      {u.id === (currentUser && currentUser.uid) ? (
                        <button className="see-all-link" title="This is you" disabled>Current user</button>
                      ) : null}

                      {/* Role actions */}
                      {u.role !== "admin" ? (
                        <button className="account-action-btn" disabled={updatingUserId === u.id} onClick={() => setUserRole(u.id, "admin")}>
                          {updatingUserId === u.id ? "Updating…" : "Make Admin"}
                        </button>
                      ) : (
                        u.id === (currentUser && currentUser.uid) ? null : (
                          <button
                            className="see-all-link"
                            disabled={updatingUserId === u.id}
                            onClick={() => setUserRole(u.id, "user")}
                            title="Demote to user"
                          >
                            {updatingUserId === u.id ? "Updating…" : "Remove Admin"}
                          </button>
                        )
                      )}

                      {/* Additional user actions (UI stubs) */}
                      <button className="see-all-link" onClick={() => handleResetPassword(u.id)}>Reset Password</button>
                      <button className="account-action-btn" onClick={() => handleDisableUser(u.id)}>Disable User</button>
                    </div>
                  </div>
                </div>
              ))}
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
        <h2 className="carousel-title">Admin Panel</h2>

        <div className="admin-tabs" role="tablist" aria-label="Admin Sections">
          <button className={`admin-tab-btn ${activeSection === "posts" ? "active" : ""}`} type="button" onClick={() => setActiveSection("posts")}>Posts</button>
          <button className={`admin-tab-btn ${activeSection === "categories" ? "active" : ""}`} type="button" onClick={() => setActiveSection("categories")}>Categories</button>
          <button className={`admin-tab-btn ${activeSection === "featured" ? "active" : ""}`} type="button" onClick={() => setActiveSection("featured")}>Featured</button>
          {isAdmin && (
            <button className={`admin-tab-btn ${activeSection === "users" ? "active" : ""}`} type="button" onClick={() => setActiveSection("users")}>Users</button>
          )}
        </div>

        {/* Removed duplicate top-level general message (so messages appear once in the context they refer to) */}

        {/* POSTS SECTION */}
        <div className={activeSection === "posts" ? "admin-tab active" : "admin-tab"}>
          {renderPostsList()}

          <hr style={{ margin: "18px 0", borderColor: "rgba(255,255,255,0.04)" }} />

          <h3 className="carousel-title">{editingPostId ? "Edit Post" : "Add Post"}</h3>
          <form className="admin-form" ref={postFormRef} onSubmit={handleSavePost}>

            {/* Type moved above Title as requested */}
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
              <select className="text-input" onChange={(e) => { if (e.target.value) { addCategoryToPost(e.target.value); e.target.value = ""; } }}>
                <option value="">Add Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
            <div className="wysiwyg-toolbar">
              <button type="button" className="wys-btn" onClick={() => document.execCommand("bold", false, null)}><b>B</b></button>
              <button type="button" className="wys-btn" onClick={() => document.execCommand("italic", false, null)}><i>I</i></button>
              <button type="button" className="wys-btn" onClick={() => document.execCommand("insertUnorderedList", false, null)}>&bull; list</button>
              <button type="button" className="wys-btn" onClick={() => {
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

            {/* Image upload: hide for Directory type (directories don't need images) */}
            {postForm.type !== "Directory" && ImageUploader && workerUrl ? (
              <ImageUploader key={`${uploaderKey}-${editingPostId || "new"}`} workerUrl={workerUrl} postId={editingPostId || "temp"} onUploaded={handleUploaded} />
            ) : (postForm.type !== "Directory" ? (
              <input className="text-input" type="file" accept="image/*" onChange={() => setFieldMessages((p) => ({ ...p, upload: "Use ImageUploader for uploads." }))} />
            ) : null)}
            {fieldMessages.upload && <div className="account-message">{fieldMessages.upload}</div>}

            {/* YouTube field: shown for Article (optional), Video and Audio (required for validation) — hide on Directory */}
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
              <button className="account-action-btn" type="submit" disabled={saving}>{saving ? "Saving…" : (editingPostId ? "Save Post" : "Add Post")}</button>
              <button type="button" className="see-all-link" onClick={resetPostForm}>Reset</button>
            </div>

            {fieldMessages.post && <div className="account-message error-text mt-12">{fieldMessages.post}</div>}
          </form>
        </div>

        {/* CATEGORIES SECTION */}
        <div className={activeSection === "categories" ? "admin-tab active" : "admin-tab"}>
          {renderCategoriesList()}

          <hr style={{ margin: "18px 0", borderColor: "rgba(255,255,255,0.04)" }} />

          <h3 className="carousel-title">{editingCategoryId ? "Edit Category" : "Add Category"}</h3>

          {/* Input full width on its own row, button on the row below */}
          <div className="mt-12">
            <input ref={categoryInputRef} className="text-input" placeholder="Category name" value={categoryFormName} onChange={(e) => { setCategoryFormName(e.target.value); setFieldMessages((p) => ({ ...p, category: "" })); }} />
            <div style={{ marginTop: 8 }}>
              {editingCategoryId ? (
                <>
                  <button className="account-action-btn" onClick={saveEditCategory}>Save</button>
                  <button className="see-all-link" onClick={() => { setEditingCategoryId(null); setCategoryFormName(""); }}>Cancel</button>
                </>
              ) : (
                <button className="account-action-btn" onClick={handleAddCategory}>Add Category</button>
              )}
            </div>
          </div>

          {fieldMessages.category && <div className={`account-message ${fieldMessages.category.includes("created") || fieldMessages.category.includes("updated") ? "success-text" : "error-text"} mt-12`}>{fieldMessages.category}</div>}
        </div>

        {/* FEATURED SECTION */}
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
                      <div className="muted">{displayType(p.type)} • {(p.categories || []).map(cid => (categories.find(c => c.id === cid) || {}).name || cid).join(", ")}</div>
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

        {/* USERS SECTION */}
        {isAdmin && (
          <div className={activeSection === "users" ? "admin-tab active" : "admin-tab"}>
            {renderUsersList()}
          </div>
        )}

      </div>
    </div>
  );
}