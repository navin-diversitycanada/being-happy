// src/utils/carouselHelpers.js
// Helper utilities for carousel behavior and breakpoints.

export function getViewportCategory() {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w <= 600) return "mobile";
  if (w <= 900) return "tablet";
  return "desktop";
}

// Visible count mapping used to compute how many items fit in a carousel viewport.
// This mirrors the CSS layout in style.css: desktop ~4, tablet ~3, mobile ~2.
export function getVisibleCountForViewport() {
  const cat = getViewportCategory();
  if (cat === "mobile") return 2;
  if (cat === "tablet") return 3;
  return 4;
}

// Helper to decide whether arrows should be shown for a carousel row.
// Show arrows when items.length > visibleCount.
// This implements:
// - mobile: show if more than 2 items
// - tablet: show if more than 3 items
// - desktop: show if more than 4 items
export function shouldShowCarouselArrows(itemsLength) {
  const visible = getVisibleCountForViewport();
  return itemsLength > visible;
}