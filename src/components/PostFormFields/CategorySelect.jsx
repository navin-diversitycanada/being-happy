import React, { useEffect, useState } from "react";
import { listCategories, createCategory } from "../../../api/categories";

/**
 * CategorySelect — uses category ids
 * - valueCategories: array of category ids
 * - onChangeCategories: called with array of ids
 * - prevents duplicate selection
 */

export default function CategorySelect({
  valueCategories = [],
  onChangeCategories = () => {}
}) {
  const [allCategories, setAllCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const cats = await listCategories().catch(() => []);
        if (!mounted) return;
        setAllCategories(cats.map(c => ({ id: c.id, name: c.name })));
      } catch (err) {
        console.error("CategorySelect load error", err);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  function isValidCategoryName(name) {
    if (!name || typeof name !== "string") return false;
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 60) return false;
    const re = /^[A-Za-z0-9\s\-\&]+$/;
    return re.test(trimmed);
  }

  async function addCategory() {
    const name = (newCategory || "").trim();
    if (!name) { setMessage("Enter a category name."); return; }
    if (!isValidCategoryName(name)) { setMessage("Invalid category. Use letters, numbers, spaces, - and & only."); return; }
    // prevent duplicates locally
    const exists = allCategories.some(c => c.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      // find id and add it if not already selected
      const cat = allCategories.find(c => c.name.trim().toLowerCase() === name.toLowerCase());
      if (cat && !valueCategories.includes(cat.id)) onChangeCategories([...valueCategories, cat.id]);
      setNewCategory("");
      setMessage("Category already existed and added.");
      return;
    }
    try {
      const ref = await createCategory(name);
      const cats = await listCategories();
      setAllCategories(cats.map(c => ({ id: c.id, name: c.name })));
      const added = cats.find(c => c.name === name);
      if (added && !valueCategories.includes(added.id)) onChangeCategories([...valueCategories, added.id]);
      setNewCategory("");
      setMessage("Category added.");
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Failed to add category.");
    }
  }

  return (
    <div className="category-select">
      <label className="form-label">Categories</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <select onChange={(e) => { const v = e.target.value; if (v && !valueCategories.includes(v)) onChangeCategories([...valueCategories, v]); e.target.value = ""; }}>
          <option value="">-- select category to add --</option>
          {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input placeholder="New category" value={newCategory} onChange={(e) => { setNewCategory(e.target.value); setMessage(""); }} />
        <button type="button" className="account-action-btn" onClick={addCategory}>Add Category</button>
      </div>
      {message && <div className="account-message">{message}</div>}

      <div style={{ marginTop: 12 }}>
        {(valueCategories || []).map(cid => {
          const cat = allCategories.find(c => c.id === cid);
          const label = cat ? cat.name : cid;
          return (
            <span key={cid} className="chip" style={{ marginRight: 6 }}>
              <span className="chip-label">{label}</span>
              <button type="button" className="chip-x" onClick={() => onChangeCategories(valueCategories.filter(x => x !== cid))}>&times;</button>
            </span>
          );
        })}
      </div>
    </div>
  );
}