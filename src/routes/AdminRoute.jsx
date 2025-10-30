import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * AdminRoute
 * - If auth is loading: show a loading placeholder.
 * - If not authenticated: redirect to /login and preserve attempted location in state.
 * - If authenticated but not admin: redirect to /index (app home).
 * - If authenticated and admin: render children.
 */
export default function AdminRoute({ children }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ padding: 24, textAlign: "center" }}>Loading...</div>;
  }

  if (!user) {
    // send unauthenticated users to login and preserve where they came from
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (role !== "admin") {
    // authenticated but not an admin — send to app home or another safe page
    return <Navigate to="/index" replace />;
  }

  return children;
}