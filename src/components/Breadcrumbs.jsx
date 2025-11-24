// src/components/Breadcrumbs.jsx
import React from "react";
import { Link } from "react-router-dom";

/**
 * Breadcrumbs
 * - items: array of { label: string, to?: string }
 * - Renders badges for each crumb using existing .badge styles:
 *   - non-current entries use badge-unpublished
 *   - the current (last) entry uses badge-featured
 * - Renders an arrow separator between items (›)
 *
 * Example:
 * <Breadcrumbs items={[{ label: 'Home', to: '/index' }, { label: 'Articles' }]} />
 */
export default function Breadcrumbs({ items = [] }) {
  if (!items || !items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="bh-breadcrumbs">
      <ol style={{ display: "flex", gap: 8, listStyle: "none", padding: 0, margin: 0, alignItems: "center", flexWrap: "wrap" }}>
        {items.map((it, idx) => {
          const last = idx === items.length - 1;
          return (
            <React.Fragment key={idx}>
              <li style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {it.to && !last ? (
                  <Link to={it.to} className="badge badge-unpublished" style={{ textDecoration: "none" }}>
                    {it.label}
                  </Link>
                ) : last && !it.to ? (
                  <span className="badge badge-featured">{it.label}</span>
                ) : last && it.to ? (
                  // If last item provides a `to`, still mark it as current (featured)
                  <Link to={it.to} className="badge badge-featured" style={{ textDecoration: "none" }}>{it.label}</Link>
                ) : (
                  <span className="badge badge-unpublished">{it.label}</span>
                )}
              </li>

              {/* separator (not rendered after last) */}
              {!last && (
                <li aria-hidden="true" style={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>›</li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}