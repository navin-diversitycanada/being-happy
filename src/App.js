import React, { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./routes/ProtectedRoute";
import AdminRoute from "./routes/AdminRoute";

import Landing from "./pages/Landing";
import Home from "./pages/Home";
import Articles from "./pages/Articles";
import Meditation from "./pages/Meditation";
import VideoLibrary from "./pages/VideoLibrary";
import Directories from "./pages/Directories";
import Account from "./pages/Account";
import AdminPanel from "./pages/AdminPanel";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

function Layout({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
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
        <Layout>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected app routes */}
            <Route path="/index" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/articles" element={<ProtectedRoute><Articles /></ProtectedRoute>} />
            <Route path="/meditation" element={<ProtectedRoute><Meditation /></ProtectedRoute>} />
            <Route path="/video-library" element={<ProtectedRoute><VideoLibrary /></ProtectedRoute>} />
            <Route path="/directories" element={<ProtectedRoute><Directories /></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />

            {/* Admin route */}
            <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}