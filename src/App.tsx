import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import EventForm from "./pages/EventForm";
import EventWorksheets from "./pages/EventWorksheets";
import EventDayOf from "./pages/EventDayOf";
import EventRunSheet from "./pages/EventRunSheet";
import Staff from "./pages/Staff";
import StaffDetail from "./pages/StaffDetail";
import CalendarView from "./pages/CalendarView";
import CalendarDayView from "./pages/CalendarDayView";
import MyCalendar from "./pages/MyCalendar";
import Workflows from "./pages/Workflows";
import WorkflowsList from "./pages/admin/WorkflowsList";
import WorkflowDetail from "./pages/admin/WorkflowDetail";
import EventTypeDefaults from "./pages/admin/EventTypeDefaults";
import EventSeriesList from "./pages/admin/EventSeriesList";
import EventSeriesDetail from "./pages/admin/EventSeriesDetail";
import ExecutiveDashboard from "./pages/admin/ExecutiveDashboard";
import InvoiceSync from "./pages/admin/InvoiceSync";
import MarginReport from "./pages/admin/MarginReport";
import AdminLookups from "./pages/admin/AdminLookups";
import Delivery from "./pages/Delivery";
import GalleryPublic from "./pages/GalleryPublic";
import JobIntakeList from "./pages/JobIntakeList";
import JobIntakeDetail from "./pages/JobIntakeDetail";
import KnowledgeBase from "./pages/KnowledgeBase";
import MyAvailability from "./pages/MyAvailability";
import MyDocuments from "./pages/MyDocuments";
import Equipment from "./pages/Equipment";
import StaffMe from "./pages/StaffMe";
import MyJobSheets from "./pages/MyJobSheets";
import ClientList from "./pages/sales/ClientList";
import ClientDetail from "./pages/sales/ClientDetail";
import LeadList from "./pages/sales/LeadList";
import QuoteList from "./pages/sales/QuoteList";
import QuoteDetail from "./pages/sales/QuoteDetail";
import ProposalView from "./pages/sales/ProposalView";
import ProductList from "./pages/sales/ProductList";
import PipelineView from "./pages/sales/PipelineView";
import PublicAcceptQuote from "./pages/sales/PublicAcceptQuote";
import PublicAcceptContract from "./pages/sales/PublicAcceptContract";
import ContractList from "./pages/sales/ContractList";
import ContractDetail from "./pages/sales/ContractDetail";
import QuoteTemplates from "./pages/sales/QuoteTemplates";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/g/:qrToken" element={<GalleryPublic />} />
      <Route path="/accept/:token" element={<PublicAcceptQuote />} />
      <Route path="/contract/sign/:token" element={<PublicAcceptContract />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
      <Route path="/events/new" element={<ProtectedRoute><EventForm /></ProtectedRoute>} />
      <Route path="/events/:id" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
      <Route path="/events/:id/edit" element={<ProtectedRoute><EventForm /></ProtectedRoute>} />
      <Route path="/events/:id/worksheets" element={<ProtectedRoute><EventWorksheets /></ProtectedRoute>} />
      <Route path="/events/:id/day-of" element={<ProtectedRoute><EventDayOf /></ProtectedRoute>} />
      <Route path="/events/:id/run-sheet" element={<ProtectedRoute><EventRunSheet /></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />
      <Route path="/staff/:id" element={<ProtectedRoute><StaffDetail /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarView /></ProtectedRoute>} />
      <Route path="/calendar/day" element={<ProtectedRoute><CalendarDayView /></ProtectedRoute>} />
      <Route path="/my-calendar" element={<ProtectedRoute><MyCalendar /></ProtectedRoute>} />
      <Route path="/workflows" element={<ProtectedRoute><Workflows /></ProtectedRoute>} />
      <Route path="/admin/workflows" element={<ProtectedRoute><WorkflowsList /></ProtectedRoute>} />
      <Route path="/admin/workflows/:id" element={<ProtectedRoute><WorkflowDetail /></ProtectedRoute>} />
      <Route path="/admin/event-types" element={<ProtectedRoute><EventTypeDefaults /></ProtectedRoute>} />
      <Route path="/admin/series" element={<ProtectedRoute><EventSeriesList /></ProtectedRoute>} />
      <Route path="/admin/series/:id" element={<ProtectedRoute><EventSeriesDetail /></ProtectedRoute>} />
      <Route path="/admin/executive" element={<ProtectedRoute><ExecutiveDashboard /></ProtectedRoute>} />
      <Route path="/admin/invoices" element={<ProtectedRoute><InvoiceSync /></ProtectedRoute>} />
      <Route path="/admin/margins" element={<ProtectedRoute><MarginReport /></ProtectedRoute>} />
      <Route path="/admin/lookups" element={<ProtectedRoute><AdminLookups /></ProtectedRoute>} />
      <Route path="/delivery" element={<ProtectedRoute><Delivery /></ProtectedRoute>} />
      <Route path="/job-intake" element={<ProtectedRoute><JobIntakeList /></ProtectedRoute>} />
      <Route path="/job-intake/:id" element={<ProtectedRoute><JobIntakeDetail /></ProtectedRoute>} />
      <Route path="/knowledge-base" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
      <Route path="/my-availability" element={<ProtectedRoute><MyAvailability /></ProtectedRoute>} />
      <Route path="/my-documents" element={<ProtectedRoute><MyDocuments /></ProtectedRoute>} />
      <Route path="/my-job-sheets" element={<ProtectedRoute><MyJobSheets /></ProtectedRoute>} />
      <Route path="/staff/me" element={<ProtectedRoute><StaffMe /></ProtectedRoute>} />
      <Route path="/equipment" element={<ProtectedRoute><Equipment /></ProtectedRoute>} />
      {/* Sales Routes */}
      <Route path="/sales/clients" element={<ProtectedRoute><ClientList /></ProtectedRoute>} />
      <Route path="/sales/clients/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
      <Route path="/sales/leads" element={<ProtectedRoute><LeadList /></ProtectedRoute>} />
      <Route path="/sales/quotes" element={<ProtectedRoute><QuoteList /></ProtectedRoute>} />
      <Route path="/sales/quotes/:id" element={<ProtectedRoute><QuoteDetail /></ProtectedRoute>} />
      <Route path="/sales/products" element={<ProtectedRoute><ProductList /></ProtectedRoute>} />
      <Route path="/sales/pipeline" element={<ProtectedRoute><PipelineView /></ProtectedRoute>} />
      <Route path="/sales/contracts" element={<ProtectedRoute><ContractList /></ProtectedRoute>} />
      <Route path="/sales/contracts/:id" element={<ProtectedRoute><ContractDetail /></ProtectedRoute>} />
      <Route path="/sales/templates" element={<ProtectedRoute><QuoteTemplates /></ProtectedRoute>} />
      <Route path="/quote/:id/proposal" element={<ProtectedRoute><ProposalView /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
