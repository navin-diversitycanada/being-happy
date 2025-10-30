import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * ProtectedRoute
 * - Shows a loading placeholder while auth state is resolving.
 * - If unauthenticated, redirects to /login and stores the attempted location in state.
 * - If authenticated, renders children.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    // Save the originally requested location so login can redirect back
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}