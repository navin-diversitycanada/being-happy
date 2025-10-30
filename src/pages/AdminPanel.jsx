import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Admin panel converted from admin.html
 * - This React component preserves the original behavior using localStorage (same STORAGE_KEY)
 * - Supports categories, subcategories, items CRUD, featured toggles, basic WYSIWYG (contentEditable)
 * - Keep styles from style.css; copy this file to src/pages/AdminPanel.jsx
 *
 * Note: For production you should persist data to Firestore and protect routes with server-side rules.
 */

const STORAGE_KEY = "bh_admin_data_v2";
const seed = {
  categories: ["Meditation", "Video", "Articles", "Directories", "Audio"],
  subcategories: [
    { name: "Breathing", parent: "Meditation" },
    { name: "Guided", parent: "Meditation" },
    { name: "Research", parent: "Articles" }
  ],
  items: [
    { id: 1, title: "Mindful Breathing", type: "Audio", desc: "Guided breathing", categories: ["Meditation", "Audio"], subcategories: ["Breathing"], img: "/images/2.jpg" },
    { id: 2, title: "Joyful Moments", type: "Video", desc: "Joyful video", categories: ["Video"], subcategories: ["Guided"], img: "/images/4.jpg" },
    { id: 3, title: "Building Resilience", type: "Article", desc: "Resilience article", categories: ["Articles"], subcategories: ["Research"], img: "/images/1.jpg" }
  ],
  featured: [1, 2, 3]
};

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(seed));
}
function saveData(d) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
}

export default function AdminPanel() {
  const [data, setData] = useState(() => loadData());
  const nextId = useRef(data.items.reduce((m, i) => Math.max(m, i.id), 0) + 1);

  // form state
  const [activeTab, setActiveTab] = useState("items"); // items | categories | subcategories | featured
  const [editingItem, setEditingItem] = useState(null); // item id or null
  const [itemForm, setItemForm] = useState({
    title: "",
    mainCategory: "",
    categories: [],
    subcategories: [],
    type: "Article",
    descHTML: "",
    imgFile: null,
    imgPreview: ""
  });

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubParent, setNewSubParent] = useState("");
  const [newSubName, setNewSubName] = useState("");

  // featured controls:
  const [featuredMain, setFeaturedMain] = useState("");
  const [featuredSub, setFeaturedSub] = useState("");

  // UI helpers
  useEffect(() => {
    // persist when data changes
    saveData(data);
  }, [data]);

  // helpers to update form chips
  function addCategoryChip(name) {
    if (!name) return;
    setItemForm((f) => {
      if (f.categories.includes(name)) return f;
      return { ...f, categories: [...f.categories, name] };
    });
  }
  function removeCategoryChip(name) {
    setItemForm((f) => ({ ...f, categories: f.categories.filter((c) => c !== name) }));
  }
  function addSubcatChip(name) {
    if (!name) return;
    setItemForm((f) => {
      if (f.subcategories.includes(name)) return f;
      return { ...f, subcategories: [...f.subcategories, name] };
    });
  }
  function removeSubcatChip(name) {
    setItemForm((f) => ({ ...f, subcategories: f.subcategories.filter((s) => s !== name) }));
  }

  function resetItemForm() {
    setEditingItem(null);
    setItemForm({
      title: "",
      mainCategory: "",
      categories: [],
      subcategories: [],
      type: "Article",
      descHTML: "",
      imgFile: null,
      imgPreview: ""
    });
  }

  function handleSaveItem(e) {
    e?.preventDefault?.();
    const { title, mainCategory, categories, subcategories, type, descHTML, imgFile, imgPreview } = itemForm;
    if (!mainCategory || !title || !descHTML) {
      alert("Main category, title and description are required.");
      return;
    }
    function finalize(imgData) {
      if (editingItem) {
        setData((d) => {
          const it = d.items.map((it) => it.id === editingItem ? { ...it, title, type, desc: descHTML, categories: categories.length ? categories : [mainCategory], subcategories, img: imgData || it.img } : it);
          return { ...d, items: it };
        });
      } else {
        const newItem = { id: nextId.current++, title, type, desc: descHTML, categories: categories.length ? categories : [mainCategory], subcategories, img: imgData || "/images/placeholder.png" };
        setData((d) => ({ ...d, items: [...d.items, newItem] }));
      }
      resetItemForm();
    }

    if (imgFile) {
      const reader = new FileReader();
      reader.onload = function (ev) {
        finalize(ev.target.result);
      };
      reader.readAsDataURL(imgFile);
    } else {
      finalize(imgPreview || null);
    }
  }

  function handleEditItem(id) {
    const it = data.items.find((x) => x.id === id);
    if (!it) return;
    setEditingItem(id);
    setItemForm({
      title: it.title,
      mainCategory: (it.categories && it.categories.length) ? it.categories[0] : "",
      categories: it.categories || [],
      subcategories: it.subcategories || [],
      type: it.type,
      descHTML: it.desc || "",
      imgFile: null,
      imgPreview: it.img || ""
    });
    setActiveTab("items");
    // scroll into view not needed in SPA
  }

  function handleDeleteItem(id) {
    if (!window.confirm("Delete item?")) return;
    setData((d) => ({
      ...d,
      items: d.items.filter((it) => it.id !== id),
      featured: d.featured.filter((fid) => fid !== id)
    }));
  }

  function handleAddCategory() {
    const v = newCategoryName.trim();
    if (!v) return alert("Enter category name");
    if (!data.categories.includes(v)) {
      setData((d) => ({ ...d, categories: [...d.categories, v] }));
    }
    setNewCategoryName("");
  }

  function handleDeleteCategory(idx) {
    if (!confirm(`Delete category "${data.categories[idx]}"?`)) return;
    const name = data.categories[idx];
    setData((d) => {
      const cats = [...d.categories];
      cats.splice(idx, 1);
      const items = d.items.map((it) => ({ ...it, categories: (it.categories || []).filter((c) => c !== name) }));
      const subcategories = d.subcategories.filter((s) => s.parent !== name);
      return { ...d, categories: cats, items, subcategories };
    });
  }

  function handleEditCategory(idx) {
    const old = data.categories[idx];
    const nv = prompt("Edit category name", old);
    if (!nv) return;
    const name = nv.trim();
    setData((d) => {
      const cats = d.categories.map((c, i) => i === idx ? name : c);
      const items = d.items.map((it) => ({ ...it, categories: (it.categories || []).map((c) => c === old ? name : c) }));
      const subcategories = d.subcategories.map((s) => s.parent === old ? { ...s, parent: name } : s);
      return { ...d, categories: cats, items, subcategories };
    });
  }

  function handleAddSubcategory() {
    if (!newSubParent || !newSubName.trim()) return alert("Choose parent and enter subcategory name");
    setData((d) => ({ ...d, subcategories: [...d.subcategories, { name: newSubName.trim(), parent: newSubParent }] }));
    setNewSubName("");
  }

  function handleDeleteSub(idx) {
    if (!confirm(`Delete subcategory "${data.subcategories[idx].name}"?`)) return;
    const name = data.subcategories[idx].name;
    setData((d) => {
      const subs = d.subcategories.filter((_, i) => i !== idx);
      const items = d.items.map((it) => ({ ...it, subcategories: (it.subcategories || []).filter((s) => s !== name) }));
      return { ...d, subcategories: subs, items };
    });
  }

  function handleEditSub(idx) {
    const old = data.subcategories[idx].name;
    const nv = prompt("Edit subcategory name", old);
    if (!nv) return;
    const name = nv.trim();
    setData((d) => {
      const subs = d.subcategories.map((s, i) => i === idx ? { ...s, name } : s);
      const items = d.items.map((it) => ({ ...it, subcategories: (it.subcategories || []).map((s) => s === old ? name : s) }));
      return { ...d, subcategories: subs, items };
    });
  }

  // Featured workflow
  function toggleFeatured(id) {
    setData((d) => {
      if (d.featured.includes(id)) {
        return { ...d, featured: d.featured.filter((x) => x !== id) };
      } else {
        return { ...d, featured: [...d.featured, id] };
      }
    });
  }

  // UI computed lists
  const mainCategoryOptions = data.categories;
  const subcatsForMain = (main) => data.subcategories.filter((s) => s.parent === main).map((s) => s.name);
  const filteredItemsForFeatured = useMemo(() => {
    if (!featuredMain || !featuredSub) return [];
    return data.items.filter((it) => (it.categories || []).includes(featuredMain) && (it.subcategories || []).includes(featuredSub));
  }, [data.items, featuredMain, featuredSub]);

  // initialize UI button-like behavior similar to original page
  useEffect(() => {
    // ensure first tab active
    setActiveTab((t) => t || "items");
  }, []);

  return (
    <div className="main-content">
      <div className="admin-panel admin-extra">
        <h2 className="auth-title">Admin Panel</h2>

        <div className="admin-tabs" role="tablist" aria-label="Admin Tabs">
          <button className={`admin-tab-btn ${activeTab === "items" ? "active" : ""}`} onClick={() => setActiveTab("items")}>Manage Items</button>
          <button className={`admin-tab-btn ${activeTab === "categories" ? "active" : ""}`} onClick={() => setActiveTab("categories")}>Manage Categories</button>
          <button className={`admin-tab-btn ${activeTab === "subcategories" ? "active" : ""}`} onClick={() => setActiveTab("subcategories")}>Manage Subcategories</button>
          <button className={`admin-tab-btn ${activeTab === "featured" ? "active" : ""}`} onClick={() => setActiveTab("featured")}>Featured Items</button>
        </div>

        {/* Tab: Items */}
        <div className="admin-tab" id="tab-items" style={{ display: activeTab === "items" ? "block" : "none" }}>
          <h3 className="admin-section-title">Add / Edit Item</h3>

          <form id="itemForm" className="admin-form" onSubmit={(e) => { e.preventDefault(); handleSaveItem(e); }}>
            <input type="hidden" id="itemId" value={editingItem || ""} />

            <label className="form-label" htmlFor="itemTitle">Title</label>
            <input id="itemTitle" type="text" placeholder="Item title" required value={itemForm.title} onChange={(e) => setItemForm((f) => ({ ...f, title: e.target.value }))} />

            <label className="form-label">Main Category</label>
            <select id="mainCategorySelect" required value={itemForm.mainCategory} onChange={(e) => { setItemForm((f) => ({ ...f, mainCategory: e.target.value })); }}>
              <option value="">-- choose --</option>
              {mainCategoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <label className="form-label">Subcategory (pick from this main category)</label>
            <select id="subcatSelect" value="" onChange={(e) => { if (e.target.value) addSubcatChip(e.target.value); e.target.value = ""; }}>
              <option value="">-- select subcategory --</option>
              {(subcatsForMain(itemForm.mainCategory) || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div id="subcatChips" className="subcat-chips" style={{ marginTop: 8 }}>
              {itemForm.subcategories.map((s) => (
                <span key={s} className="chip" data-value={s}>
                  <span className="chip-label">{s}</span>
                  <button type="button" className="chip-x" onClick={() => removeSubcatChip(s)} aria-label="remove subcategory">&times;</button>
                </span>
              ))}
            </div>

            <label className="form-label">Categories (pick one or more)</label>
            <select id="categorySelect" onChange={(e) => { if (e.target.value) { addCategoryChip(e.target.value); e.target.value = ""; } }}>
              <option value="">-- select category to add --</option>
              {data.categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div id="categoryChips" className="category-chips" style={{ marginTop: 8 }}>
              {itemForm.categories.map((c) => (
                <span key={c} className="chip" data-value={c}>
                  <span className="chip-label">{c}</span>
                  <button type="button" className="chip-x" onClick={() => removeCategoryChip(c)} aria-label="remove category">&times;</button>
                </span>
              ))}
            </div>

            <label className="form-label" htmlFor="itemType">Type</label>
            <select id="itemType" value={itemForm.type} onChange={(e) => setItemForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="Article">Article</option>
              <option value="Video">Video</option>
              <option value="Audio">Audio</option>
              <option value="Directory">Directory</option>
            </select>

            <label className="form-label" htmlFor="itemDescEditor">Description (WYSIWYG)</label>
            <div className="wysiwyg-toolbar" id="wysiwygToolbar">
              <button type="button" onClick={() => document.execCommand("bold", false, null)}><b>B</b></button>
              <button type="button" onClick={() => document.execCommand("italic", false, null)}><i>I</i></button>
              <button type="button" onClick={() => document.execCommand("insertUnorderedList", false, null)}>&bull; list</button>
              <button type="button" onClick={() => {
                const url = prompt("Enter URL");
                if (url) document.execCommand("createLink", false, url);
              }}>Link</button>
            </div>
            <div id="itemDescEditor" className="wysiwyg" contentEditable role="textbox" aria-multiline="true"
              onInput={(e) => setItemForm((f) => ({ ...f, descHTML: e.currentTarget.innerHTML }))}
              dangerouslySetInnerHTML={{ __html: itemForm.descHTML }} />

            <label className="form-label">Image (upload) — required for Article/Audio/Video</label>
            <input id="itemImage" type="file" accept="image/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return setItemForm((f) => ({ ...f, imgFile: null }));
              setItemForm((f) => ({ ...f, imgFile: file }));
              const reader = new FileReader();
              reader.onload = function (ev) {
                setItemForm((f) => ({ ...f, imgPreview: ev.target.result }));
              };
              reader.readAsDataURL(file);
            }} />

            <div style={{ marginTop: 12 }}>
              <button id="saveItemBtn" className="account-action-btn" type="submit">{editingItem ? "Save Item" : "Add Item"}</button>
              <button id="resetItemBtn" type="button" className="see-all-link" onClick={resetItemForm}>Reset</button>
            </div>
          </form>

          <h4 style={{ marginTop: 22 }}>Existing Items</h4>
          <div id="itemsList" className="admin-list">
            {data.items.map((item) => (
              <div key={item.id} className="admin-row">
                <div className="admin-row-left">
                  <img src={item.img || "/images/placeholder.png"} alt="" style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 8, marginRight: 12 }} />
                  <div>
                    <strong>{item.title}</strong>
                    <div className="muted">{item.type} • {(item.categories || []).join(", ")}{(item.subcategories || []).length ? " • " + item.subcategories.join(", ") : ""}</div>
                  </div>
                </div>
                <div className="admin-row-actions">
                  <button className="see-all-link" onClick={() => handleEditItem(item.id)}>Edit</button>
                  <button className="account-action-btn" onClick={() => handleDeleteItem(item.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="admin-tab" id="tab-categories" style={{ display: activeTab === "categories" ? "block" : "none" }}>
          <h3 className="admin-section-title">Categories</h3>
          <form id="categoryForm" className="admin-form" onSubmit={(e) => { e.preventDefault(); handleAddCategory(); }}>
            <label className="form-label" htmlFor="newCategory">New Category</label>
            <input id="newCategory" type="text" placeholder="Category name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
            <div style={{ marginTop: 12 }}>
              <button id="addCategoryBtn" className="account-action-btn" type="submit">Add Category</button>
            </div>
          </form>

          <h4 style={{ marginTop: 18 }}>Existing Categories</h4>
          <div id="categoriesList" className="admin-list">
            {data.categories.map((cat, idx) => (
              <div key={cat} className="admin-row">
                <div className="admin-row-left">
                  <span className="chip">{cat} <button data-act="del-cat" data-idx={idx} className="chip-x" aria-label="delete category" onClick={() => handleDeleteCategory(idx)}>&times;</button></span>
                </div>
                <div className="admin-row-actions">
                  <button className="see-all-link" onClick={() => handleEditCategory(idx)}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subcategories */}
        <div className="admin-tab" id="tab-subcategories" style={{ display: activeTab === "subcategories" ? "block" : "none" }}>
          <h3 className="admin-section-title">Subcategories</h3>
          <form id="subcategoryForm" className="admin-form" onSubmit={(e) => { e.preventDefault(); handleAddSubcategory(); }}>
            <label className="form-label">Parent Category</label>
            <select id="parentCategorySelect" value={newSubParent} onChange={(e) => setNewSubParent(e.target.value)}>
              <option value="">-- choose --</option>
              {data.categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <label className="form-label" htmlFor="newSubcategory">Subcategory Name</label>
            <input id="newSubcategory" type="text" placeholder="Subcategory name" value={newSubName} onChange={(e) => setNewSubName(e.target.value)} />

            <div style={{ marginTop: 12 }}>
              <button id="addSubcategoryBtn" className="account-action-btn" type="submit">Add Subcategory</button>
            </div>
          </form>

          <h4 style={{ marginTop: 18 }}>Existing Subcategories</h4>
          <div id="subcategoriesList" className="admin-list">
            {data.subcategories.map((s, idx) => (
              <div key={`${s.parent}-${s.name}-${idx}`} className="admin-row">
                <div className="admin-row-left">
                  <span className="chip">{s.name} <small className="muted">({s.parent})</small> <button data-act="del-sub" data-idx={idx} className="chip-x" aria-label="delete" onClick={() => handleDeleteSub(idx)}>&times;</button></span>
                </div>
                <div className="admin-row-actions">
                  <button className="see-all-link" onClick={() => handleEditSub(idx)}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Featured */}
        <div className="admin-tab" id="tab-featured" style={{ display: activeTab === "featured" ? "block" : "none" }}>
          <h3 className="admin-section-title">Featured Items</h3>

          <label className="form-label">Choose Main Category</label>
          <select id="featuredMainSelect" value={featuredMain} onChange={(e) => { setFeaturedMain(e.target.value); setFeaturedSub(""); }}>
            <option value="">-- choose --</option>
            {data.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <label className="form-label">Choose Subcategory</label>
          <select id="featuredSubSelect" value={featuredSub} onChange={(e) => setFeaturedSub(e.target.value)}>
            <option value="">-- choose --</option>
            {(data.subcategories.filter((s) => s.parent === featuredMain) || []).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>

          <div id="featuredItemsArea" style={{ marginTop: 12 }}>
            {filteredItemsForFeatured.map((it) => (
              <div key={it.id} className="admin-row">
                <div className="admin-row-left">{it.title} <div className="muted">{it.type}</div></div>
                <div className="admin-row-actions">
                  <button className="see-all-link feat-toggle" onClick={() => toggleFeatured(it.id)}>{data.featured.includes(it.id) ? "Remove" : "Add"}</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <button id="saveFeaturedBtn" className="account-action-btn" onClick={() => { saveData(data); alert("Featured saved"); }}>Save Featured</button>
          </div>
        </div>

      </div>
    </div>
  );
}