import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import MySignature from "@/pages/MySignature";
import BrandAssets from "@/pages/BrandAssets";
import GifComposer from "@/pages/GifComposer";
import Employees from "@/pages/Employees";
import EmailSender from "@/pages/EmailSender";
import Analytics from "@/pages/Analytics";
import M365Deploy from "@/pages/M365Deploy";
import Install from "@/pages/Install";
import SetupWizard from "@/pages/SetupWizard";
import M365Connect from "@/pages/M365Connect";
import SystemMaintenance from "@/pages/SystemMaintenance";
import AssetHosting from "@/pages/AssetHosting";
import { can } from "@/lib/permissions";

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F17]">
      <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  );
}

function Protected({ children, perm }) {
  const { user } = useAuth();
  if (user === null) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (perm && !can(user, perm)) return <Navigate to="/app/signature" replace />;
  return <Layout>{children}</Layout>;
}

function LoginGate() {
  const { user } = useAuth();
  if (user === null) return <Loading />;
  if (user) return <Navigate to="/app/signature" replace />;
  return <Login />;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginGate />} />
            <Route path="/app/signature" element={<Protected><MySignature /></Protected>} />
            <Route path="/app/brand" element={<Protected perm="brand"><BrandAssets /></Protected>} />
            <Route path="/app/gif" element={<Protected perm="gif"><GifComposer /></Protected>} />
            <Route path="/app/employees" element={<Protected perm="employees"><Employees /></Protected>} />
            <Route path="/app/email" element={<Protected perm="email"><EmailSender /></Protected>} />
            <Route path="/app/deploy" element={<Protected perm="deploy"><M365Deploy /></Protected>} />
            <Route path="/app/analytics" element={<Protected perm="analytics"><Analytics /></Protected>} />
            <Route path="/app/install" element={<Protected perm="install"><Install /></Protected>} />
            <Route path="/app/setup" element={<Protected perm="setup"><SetupWizard /></Protected>} />
            <Route path="/app/m365" element={<Protected perm="m365"><M365Connect /></Protected>} />
            <Route path="/app/system" element={<Protected perm="system"><SystemMaintenance /></Protected>} />
            <Route path="/app/hosting" element={<Protected perm="hosting"><AssetHosting /></Protected>} />
            <Route path="*" element={<Navigate to="/app/signature" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
