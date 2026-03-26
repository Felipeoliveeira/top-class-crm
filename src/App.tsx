import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { AdminRoute } from "@/components/AdminRoute";
import LoginPage from "./pages/Login";
import RecoverPasswordPage from "./pages/RecoverPassword";
import SetPasswordPage from "./pages/SetPassword";
import DashboardPage from "./pages/Dashboard";
import PipelinePage from "./pages/Pipeline";
import LeadsPage from "./pages/Leads";
import LeadDetailPage from "./pages/LeadDetail";
import UsersPage from "./pages/Users";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/recuperar-senha" element={<RecoverPasswordPage />} />
          <Route path="/definir-senha" element={<SetPasswordPage />} />

          {/* Authenticated routes */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/pipeline" element={<PipelinePage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/leads/:id" element={<LeadDetailPage />} />

            {/* Admin only */}
            <Route element={<AdminRoute />}>
              <Route path="/admin/usuarios" element={<UsersPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
