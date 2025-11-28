// src/pages/LocationPosts.jsx
// New page: shows "directory" posts for a specific location (country/province/city).
// - Route: /location/:id
// - Shows breadcrumb header + filters for child locations (only those with items).
// - Pagination: 12 per page, grid uses existing .flex-card-grid.
// - Filtering:
//    - Country page: province filter (and after selecting province, cities filter shows only cities for that province that also have posts).
//    - Province page: city filter (only cities under that province that have posts).
//    - City page: no child filters (scope is the city).
//
// Updates:
// - Cards now display category NAMES (not IDs) by loading listCategories() and mapping ids -> names.

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Breadcrumbs from "../components/Breadcrumbs";
import { listLocations, listLocationsTree } from "../api/locations";
import { listByType } from "../api/posts";
import { listCategories } from "../api/categories";

function timestampToMillis(t) {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (t instanceof Date) return t.getTime();
  try { return new Date(t).getTime() || 0; } catch { return 0; }
}

export default function LocationPosts() {
  const { id } = useParams();
  const [locationMap, setLocationMap] = useState({});
  const [location, setLocation] = useState(null);
  const [allDirs, setAllDirs] = useState([]); // all directory posts fetched (window)
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [provinceFilter, setProvinceFilter] = useState("all"); // province id or 'all'
  const [cityFilter, setCityFilter] = useState("all"); // city id or 'all'

  const PAGE_SIZE = 12;
  const [page, setPage] = useState(1);

  // child options (only show those that actually have items)
  const [provinceOptions, setProvinceOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);

  const [catsMap, setCatsMap] = useState({});

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        // load categories map
        const cats = await listCategories().catch(() => []);
        const cmap = {};
        (cats || []).forEach(c => { cmap[c.id] = c.name; });
        if (!mounted) return;
        setCatsMap(cmap);

        // load locations flat
        const locs = await listLocations();
        const map = {};
        locs.forEach(l => { map[l.id] = l; });
        if (!mounted) return;
        setLocationMap(map);
        const loc = map[id] || null;
        setLocation(loc);

        // load a sizable window of directory posts and filter locally
        const dirs = await listByType("directory", 400).catch(() => []);
        if (!mounted) return;
        setAllDirs(dirs || []);
      } catch (err) {
        console.error("Failed to load location posts", err);
        if (mounted) {
          setAllDirs([]);
          setLocation(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [id]);

  // compute filters/options and filtered list when location or allDirs or filters change
  useEffect(() => {
    if (!location) { setFiltered([]); setProvinceOptions([]); setCityOptions([]); return; }

    // determine which posts belong to this location (country/province/city)
    const locType = (location.type || "").toLowerCase();

    // base matching function
    const matchesBase = (p) => {
      const L = p.location || {};
      if (locType === "country") {
        return (L.countryId === id);
      } else if (locType === "province") {
        return (L.provinceId === id);
      } else if (locType === "city") {
        return (L.cityId === id);
      }
      return false;
    };

    // posts that are in this location's scope
    const inScope = (allDirs || []).filter(p => matchesBase(p));

    // Build province & city options (only those that actually appear in scope)
    // For country page we offer province filter (and city after province selection)
    // For province page we offer city filter only
    const provincesSet = new Map();
    const citiesSet = new Map();

    inScope.forEach(p => {
      const L = p.location || {};
      if (L.provinceId && L.provinceName) provincesSet.set(L.provinceId, L.provinceName);
      if (L.cityId && L.cityName) citiesSet.set(L.cityId, L.cityName);
    });

    const provinceOpts = Array.from(provincesSet.entries()).map(([k, v]) => ({ id: k, name: v })).sort((a,b) => a.name.localeCompare(b.name));
    // cityOpts is all cities present in scope (if no provinceFilter)
    const cityOptsOverall = Array.from(citiesSet.entries()).map(([k, v]) => ({ id: k, name: v })).sort((a,b) => a.name.localeCompare(b.name));

    setProvinceOptions(provinceOpts);

    // If a province is actively selected (and not "all"), the city filter should be restricted
    // to cities that:
    //  - have parentId === selected province,
    //  - and have posts (we derive from allDirs)
    if (provinceFilter && provinceFilter !== "all") {
      // find cities that appear in allDirs and whose parentId equals provinceFilter
      const cityIdsForProvince = new Set();
      (allDirs || []).forEach(p => {
        const L = p.location || {};
        if (L.cityId && L.cityId !== "" && L.provinceId === provinceFilter) {
          cityIdsForProvince.add(L.cityId);
        }
      });

      const cityOptionsArr = Array.from(cityIdsForProvince).map(cid => {
        const loc = locationMap[cid] || {};
        return { id: cid, name: loc.name || (loc.cityName || cid) };
      }).filter(x => x && x.id).sort((a,b) => a.name.localeCompare(b.name));

      setCityOptions(cityOptionsArr);
    } else {
      // no province selected — show cities present in scope (for country view) OR cities present for province view
      if (locType === "country") {
        setCityOptions(cityOptsOverall);
      } else if (locType === "province") {
        // province page: show cities under this province that have posts
        const cityIds = new Set();
        inScope.forEach(p => {
          const L = p.location || {};
          if (L.cityId) cityIds.add(L.cityId);
        });
        const arr = Array.from(cityIds).map(cid => ({ id: cid, name: (locationMap[cid] || {}).name || cid })).sort((a,b) => a.name.localeCompare(b.name));
        setCityOptions(arr);
      } else {
        setCityOptions([]);
      }
    }

    // Apply filters:
    let result = inScope.slice();

    if (provinceFilter && provinceFilter !== "all") {
      result = result.filter(p => (p.location && p.location.provinceId) === provinceFilter);
    }

    if (cityFilter && cityFilter !== "all") {
      result = result.filter(p => (p.location && p.location.cityId) === cityFilter);
    }

    // sort by publishedAt desc
    result.sort((a,b) => timestampToMillis(b.publishedAt || b.createdAt) - timestampToMillis(a.publishedAt || a.createdAt));

    setFiltered(result);
    setPage(1); // reset page when scope or filters change
  }, [location, allDirs, provinceFilter, cityFilter, locationMap]);

  // when location changes, reset filters
  useEffect(() => {
    setProvinceFilter("all");
    setCityFilter("all");
  }, [location]);

  if (loading) return <div className="main-content"><div style={{ padding: 12 }}>Loading…</div></div>;
  if (!location) {
    return (
      <div className="main-content">
        <div className="notfound">
          <div className="nf-card">
            <h2>Location not found</h2>
            <div style={{ marginTop: 12 }}>
              <Link className="see-all-link" to="/directories">Back to Directories</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Breadcrumbs: build hierarchy up to country
  const crumbs = [];
  // ascend parent chain using locationMap
  let cur = location;
  const stack = [];
  while (cur) {
    stack.unshift({ id: cur.id, name: cur.name, type: cur.type });
    if (!cur.parentId) break;
    cur = locationMap[cur.parentId] || null;
  }
  stack.forEach(s => crumbs.push({ label: s.name, to: `/location/${s.id}` }));

  // Pagination
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  function renderCard(item) {
    const img = item.thumbnailUrl || item.imageUrl || "/images/directoryplaceholder.png";
    // use category NAMES (map ids -> names)
    const cats = (item.categories || []).map(cid => catsMap[cid] || cid).slice(0,2).join(", ");
    return (
      <Link key={item.id} className="card" to={`/directory/${item.id}`}>
        <img className="card-img" src={img} alt={item.title} />
        <div className="card-content">
          <div className="card-title">{item.title}</div>
          {cats ? <div className="card-categories">{cats}</div> : <div className="card-meta">Directory</div>}
        </div>
      </Link>
    );
  }

  return (
    <div className="main-content">
      <div className="promo-box">
        <Breadcrumbs items={[{ label: "Home", to: "/index" }, { label: "Directories", to: "/directories" }, { label: location.name }]} />
        <div>
          <div className="greeting">{location.name}</div>
          <div className="promo-description">Directory listings for {location.name}</div>
        </div>
      </div>

      {/* Breadcrumb bubbles */}
      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {stack.map((s, i) => (
            <React.Fragment key={s.id}>
              <Link
                to={`/location/${s.id}`}
                style={{
                  display: "inline-block",
                  background: "var(--cream)",
                  color: "var(--purple)",
                  padding: "5px 10px",
                  borderRadius: 999,
                  fontWeight: 700,
                  textDecoration: "none",
                  fontSize: 14
                }}
              >
                {s.name}
              </Link>
              {i < stack.length - 1 && <span style={{ color: "var(--cream)", opacity: 0.8 }}>›</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {/* Province filter (only show on country pages or when provinces exist in scope) */}
        { (location.type === "country" && provinceOptions.length > 0) && (
          <select className="text-input" value={provinceFilter} onChange={(e) => { setProvinceFilter(e.target.value); setCityFilter("all"); }}>
            <option value="all">All provinces</option>
            {provinceOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}

        {/* City filter: for country pages it's enabled only after a province selected; for province pages it's available immediately */}
        { ( (location.type === "country" && provinceFilter !== "all" && cityOptions.length > 0) || (location.type === "province" && cityOptions.length > 0) ) && (
          <select className="text-input" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
            <option value="all">All cities</option>
            {cityOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        {pageItems.length === 0 ? <div style={{ padding: 12 }}>No directory posts found for this selection.</div> : (
          <>
            <div className="flex-card-grid">
              {pageItems.map(renderCard)}
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
              <button className="see-all-link" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
              <div style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>{page} / {totalPages} ({total})</div>
              <button className="see-all-link" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}