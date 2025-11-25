// src/App.js
// Change: make /index (Home) public (no ProtectedRoute wrapper) so Home is visible to non logged-in users.
// Other routes remain protected as before.

import React from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./routes/ProtectedRoute";
import AdminRoute from "./routes/AdminRoute";

import Landing from "./pages/Landing";
import Home from "./pages/Home";
import Articles from "./pages/Articles";
import Article from "./pages/Article";
import Meditation from "./pages/Meditation";
import Audio from "./pages/Audio";
import VideoLibrary from "./pages/VideoLibrary";
import Video from "./pages/Video";
import Directories from "./pages/Directories";
import Directory from "./pages/Directory";
import CategoryPage from "./pages/CategoryPage";
import TypeCategory from "./pages/TypeCategory";
import Account from "./pages/Account";
import AdminPanel from "./pages/AdminPanel";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import Featured from "./pages/Featured";
import ResetPassword from "./pages/ResetPassword";
import AddToHomeScreen from "./components/AddToHomeScreen";


/**
 * RedirectOnAction
 * - If incoming URL contains mode=resetPassword and oobCode
 *   redirect to /reset-password with the same query string so ResetPassword component
 *   can pick up the oobCode and complete the flow.
 */
function RedirectOnAction() {
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    try {
      const qs = new URLSearchParams(location.search);
      const mode = qs.get("mode");
      const oobCode = qs.get("oobCode");
      if (mode === "resetPassword" && oobCode) {
        // preserve entire query string and navigate to /reset-password
        navigate(`/reset-password${location.search}`, { replace: true });
      }
    } catch (err) {
      // ignore parsing errors
      console.warn("RedirectOnAction parse error", err);
    }
  }, [location, navigate]);

  return null;
}

function Layout({ children }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
        <AddToHomeScreen />
      <Header onMenuClick={() => setOpen(true)} />
      <Sidebar open={open} onClose={() => setOpen(false)} />
        
      <main>{children}</main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RedirectOnAction />
        <Layout>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Home is now public */}
            <Route path="/index" element={<Home />} />

            {/* Lists */}
            <Route path="/articles" element={<ProtectedRoute><Articles /></ProtectedRoute>} />
            <Route path="/meditation" element={<ProtectedRoute><Meditation /></ProtectedRoute>} />
            <Route path="/video-library" element={<ProtectedRoute><VideoLibrary /></ProtectedRoute>} />
            <Route path="/directories" element={<ProtectedRoute><Directories /></ProtectedRoute>} />
            <Route path="/featured" element={<ProtectedRoute><Featured /></ProtectedRoute>} />

            {/* Detail pages */}
            <Route path="/article/:id" element={<ProtectedRoute><Article /></ProtectedRoute>} />
            <Route path="/audio/:id" element={<ProtectedRoute><Audio /></ProtectedRoute>} />
            <Route path="/video/:id" element={<ProtectedRoute><Video /></ProtectedRoute>} />
            <Route path="/directory/:id" element={<ProtectedRoute><Directory /></ProtectedRoute>} />

            {/* Category pages */}
            <Route path="/category/:id" element={<ProtectedRoute><CategoryPage /></ProtectedRoute>} />
            <Route path="/category/:id/:type" element={<ProtectedRoute><TypeCategory /></ProtectedRoute>} />

            {/* Account/Admin */}
            <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}