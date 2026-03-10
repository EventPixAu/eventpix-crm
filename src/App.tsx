import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { RoleGuard, AdminGuard, SalesGuard, OpsGuard, CrewGuard } from "@/components/RoleGuard";
import { useEffect } from "react";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    // Also catch late-rendering content
    const t = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 50);
    return () => clearTimeout(t);
  }, [pathname]);
  return null;
}

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import PhotographerDashboard from "./pages/PhotographerDashboard";
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
import WorkflowsAdmin from "./pages/admin/WorkflowsAdmin";
import EventSeriesList from "./pages/admin/EventSeriesList";
import EventSeriesDetail from "./pages/admin/EventSeriesDetail";
import InvoiceSync from "./pages/admin/InvoiceSync";
import MarginReport from "./pages/admin/MarginReport";
import AdminLookups from "./pages/admin/AdminLookups";
import Delivery from "./pages/Delivery";
import GalleryPublic from "./pages/GalleryPublic";
import JobIntakeList from "./pages/JobIntakeList";
import JobIntakeDetail from "./pages/JobIntakeDetail";
import KnowledgeBase from "./pages/KnowledgeBase";
import CrewOnboardingGuide from "./pages/CrewOnboardingGuide";
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
import PackageList from "./pages/sales/PackageList";
import PipelineView from "./pages/sales/PipelineView";
import PublicAcceptQuote from "./pages/sales/PublicAcceptQuote";
import PublicAcceptContract from "./pages/sales/PublicAcceptContract";
import ContractList from "./pages/sales/ContractList";
import ContractDetail from "./pages/sales/ContractDetail";
import QuoteTemplates from "./pages/sales/QuoteTemplates";
import SalesWorkflowTemplates from "./pages/sales/SalesWorkflowTemplates";
import LeadDetail from "./pages/sales/LeadDetail";
import LeadPortalPreview from "./pages/sales/LeadPortalPreview";
import ContractTemplates from "./pages/admin/ContractTemplates";
import EmailTemplates from "./pages/admin/EmailTemplates";
import DayLoadView from "./pages/admin/DayLoadView";
import DeliveryMetrics from "./pages/admin/DeliveryMetrics";
import PhotographerTrends from "./pages/admin/PhotographerTrends";
import UserManagement from "./pages/admin/UserManagement";
import CompanyInsurance from "./pages/admin/CompanyInsurance";
import { CompanyList, ContactList, CrmEmails, PromotionsDashboard } from "./pages/crm";
import ContactDetail from "./pages/crm/ContactDetail";
import ResetPassword from "./pages/ResetPassword";
import SalesDashboard from "./pages/sales/SalesDashboard";
import PublicEnquiry from "./pages/PublicEnquiry";
import EnquiryEmbed from "./pages/EnquiryEmbed";
import ClientPortal from "./pages/ClientPortal";

import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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

/**
 * Role-based dashboard routing
 * - Admin/Operations: Full operations dashboard
 * - Sales: Sales dashboard
 * - Crew: Photographer-focused mobile dashboard
 */
function RoleBasedDashboard() {
  const { role, isAdmin } = useAuth();
  
  // Admin and Operations default to CRM Emails inbox
  if (isAdmin || role === 'operations') {
    return <Navigate to="/crm/emails" replace />;
  }
  
  // Sales users get sales dashboard
  if (role === 'sales') {
    return <Navigate to="/sales/dashboard" replace />;
  }
  
  // Crew (photographers) get the mobile-first photographer dashboard
  return <PhotographerDashboard />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes - no auth required */}
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/g/:qrToken" element={<GalleryPublic />} />
      <Route path="/accept/:token" element={<PublicAcceptQuote />} />
      <Route path="/contract/sign/:token" element={<PublicAcceptContract />} />
      <Route path="/enquiry" element={<PublicEnquiry />} />
      <Route path="/enquiry/embed" element={<EnquiryEmbed />} />
      <Route path="/event/:token" element={<ClientPortal />} />
      
      
      {/* Dashboard - role-based: Admin gets full dashboard, Crew gets photographer dashboard */}
      <Route path="/" element={<ProtectedRoute><RoleBasedDashboard /></ProtectedRoute>} />
      <Route path="/operations" element={<ProtectedRoute><OpsGuard><Dashboard /></OpsGuard></ProtectedRoute>} />
      
      {/* Operations routes - Admin + Operations */}
      <Route path="/events" element={<ProtectedRoute><OpsGuard><Events /></OpsGuard></ProtectedRoute>} />
      <Route path="/events/new" element={<ProtectedRoute><OpsGuard><EventForm /></OpsGuard></ProtectedRoute>} />
      <Route path="/events/:id" element={<ProtectedRoute><OpsGuard><EventDetail /></OpsGuard></ProtectedRoute>} />
      <Route path="/events/:id/edit" element={<ProtectedRoute><OpsGuard><EventForm /></OpsGuard></ProtectedRoute>} />
      <Route path="/events/:id/worksheets" element={<ProtectedRoute><OpsGuard><EventWorksheets /></OpsGuard></ProtectedRoute>} />
      {/* Day-of view accessible to assigned crew */}
       <Route
         path="/events/:id/day-of"
         element={
           <ProtectedRoute>
             <CrewGuard>
               <ErrorBoundary title="Unable to open Day-Of view" backTo="/">
                 <EventDayOf />
               </ErrorBoundary>
             </CrewGuard>
           </ProtectedRoute>
         }
       />
      <Route path="/events/:id/run-sheet" element={<ProtectedRoute><CrewGuard><EventRunSheet /></CrewGuard></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute><OpsGuard><Staff /></OpsGuard></ProtectedRoute>} />
      <Route path="/staff/:id" element={<ProtectedRoute><OpsGuard><StaffDetail /></OpsGuard></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><OpsGuard><CalendarView /></OpsGuard></ProtectedRoute>} />
      <Route path="/calendar/day" element={<ProtectedRoute><OpsGuard><CalendarDayView /></OpsGuard></ProtectedRoute>} />
      <Route path="/workflows" element={<ProtectedRoute><AdminGuard><WorkflowsAdmin /></AdminGuard></ProtectedRoute>} />
      <Route path="/admin/workflows" element={<ProtectedRoute><AdminGuard><WorkflowsAdmin /></AdminGuard></ProtectedRoute>} />
      <Route path="/admin/event-types" element={<ProtectedRoute><AdminGuard><WorkflowsAdmin /></AdminGuard></ProtectedRoute>} />
      <Route path="/admin/series" element={<ProtectedRoute><OpsGuard><EventSeriesList /></OpsGuard></ProtectedRoute>} />
      <Route path="/admin/series/:id" element={<ProtectedRoute><OpsGuard><EventSeriesDetail /></OpsGuard></ProtectedRoute>} />
      <Route path="/admin/invoices" element={<ProtectedRoute><AdminGuard><InvoiceSync /></AdminGuard></ProtectedRoute>} />
      <Route path="/admin/margins" element={<ProtectedRoute><AdminGuard><MarginReport /></AdminGuard></ProtectedRoute>} />
      <Route path="/admin/lookups" element={<ProtectedRoute><AdminGuard><AdminLookups /></AdminGuard></ProtectedRoute>} />
      <Route path="/admin/day-load" element={<ProtectedRoute><OpsGuard><DayLoadView /></OpsGuard></ProtectedRoute>} />
      <Route path="/admin/delivery-metrics" element={<ProtectedRoute><OpsGuard><DeliveryMetrics /></OpsGuard></ProtectedRoute>} />
      <Route path="/admin/photographer-trends" element={<ProtectedRoute><AdminGuard><PhotographerTrends /></AdminGuard></ProtectedRoute>} />
      <Route path="/delivery" element={<ProtectedRoute><OpsGuard><Delivery /></OpsGuard></ProtectedRoute>} />
      <Route path="/job-intake" element={<ProtectedRoute><OpsGuard><JobIntakeList /></OpsGuard></ProtectedRoute>} />
      <Route path="/job-intake/:id" element={<ProtectedRoute><OpsGuard><JobIntakeDetail /></OpsGuard></ProtectedRoute>} />
      <Route path="/equipment" element={<ProtectedRoute><OpsGuard><Equipment /></OpsGuard></ProtectedRoute>} />
      <Route path="/admin/contract-templates" element={<ProtectedRoute><AdminGuard><ContractTemplates /></AdminGuard></ProtectedRoute>} />
      <Route path="/admin/email-templates" element={<ProtectedRoute><AdminGuard><EmailTemplates /></AdminGuard></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><AdminGuard><UserManagement /></AdminGuard></ProtectedRoute>} />
      <Route path="/admin/insurance" element={<ProtectedRoute><AdminGuard><CompanyInsurance /></AdminGuard></ProtectedRoute>} />
      
      {/* CRM routes - admin + sales */}
      <Route path="/crm/promotions" element={<ProtectedRoute><SalesGuard><PromotionsDashboard /></SalesGuard></ProtectedRoute>} />
      <Route path="/crm/companies" element={<ProtectedRoute><SalesGuard><CompanyList /></SalesGuard></ProtectedRoute>} />
      <Route path="/crm/companies/new" element={<ProtectedRoute><SalesGuard><ClientDetail /></SalesGuard></ProtectedRoute>} />
      <Route path="/crm/companies/:id" element={<ProtectedRoute><SalesGuard><ClientDetail /></SalesGuard></ProtectedRoute>} />
      <Route path="/crm/contacts" element={<ProtectedRoute><SalesGuard><ContactList /></SalesGuard></ProtectedRoute>} />
      <Route path="/crm/contacts/new" element={<ProtectedRoute><SalesGuard><ContactDetail /></SalesGuard></ProtectedRoute>} />
      <Route path="/crm/contacts/:id" element={<ProtectedRoute><SalesGuard><ContactDetail /></SalesGuard></ProtectedRoute>} />
      <Route path="/crm/emails" element={<ProtectedRoute><SalesGuard><CrmEmails /></SalesGuard></ProtectedRoute>} />
      
      {/* Sales routes - admin + sales */}
      <Route path="/sales/dashboard" element={<ProtectedRoute><SalesGuard><SalesDashboard /></SalesGuard></ProtectedRoute>} />
      {/* Clients moved to CRM > Companies */}
      <Route path="/sales/leads" element={<ProtectedRoute><SalesGuard><LeadList /></SalesGuard></ProtectedRoute>} />
      <Route path="/sales/leads/:id" element={<ProtectedRoute><SalesGuard><LeadDetail /></SalesGuard></ProtectedRoute>} />
      <Route path="/sales/leads/:id/portal-preview" element={<ProtectedRoute><SalesGuard><LeadPortalPreview /></SalesGuard></ProtectedRoute>} />
      <Route path="/sales/quotes" element={<ProtectedRoute><SalesGuard><QuoteList /></SalesGuard></ProtectedRoute>} />
      <Route path="/sales/quotes/:id" element={<ProtectedRoute><SalesGuard><QuoteDetail /></SalesGuard></ProtectedRoute>} />
      <Route path="/sales/products" element={<ProtectedRoute><SalesGuard><ProductList /></SalesGuard></ProtectedRoute>} />
      <Route path="/sales/packages" element={<ProtectedRoute><SalesGuard><PackageList /></SalesGuard></ProtectedRoute>} />
      <Route path="/sales/pipeline" element={<ProtectedRoute><SalesGuard><PipelineView /></SalesGuard></ProtectedRoute>} />
      <Route path="/sales/contracts" element={<ProtectedRoute><SalesGuard><ContractList /></SalesGuard></ProtectedRoute>} />
      <Route path="/sales/contracts/:id" element={<ProtectedRoute><SalesGuard><ContractDetail /></SalesGuard></ProtectedRoute>} />
      <Route path="/sales/templates" element={<ProtectedRoute><SalesGuard><QuoteTemplates /></SalesGuard></ProtectedRoute>} />
      <Route path="/sales/workflow-templates" element={<ProtectedRoute><SalesGuard><SalesWorkflowTemplates /></SalesGuard></ProtectedRoute>} />
      <Route path="/quote/:id/proposal" element={<ProtectedRoute><SalesGuard><ProposalView /></SalesGuard></ProtectedRoute>} />
      
      {/* Crew routes - admin + operations + crew */}
      <Route path="/my-calendar" element={<ProtectedRoute><CrewGuard><MyCalendar /></CrewGuard></ProtectedRoute>} />
      <Route path="/my-availability" element={<ProtectedRoute><CrewGuard><MyAvailability /></CrewGuard></ProtectedRoute>} />
      <Route path="/my-documents" element={<ProtectedRoute><CrewGuard><MyDocuments /></CrewGuard></ProtectedRoute>} />
      <Route path="/my-job-sheets" element={<ProtectedRoute><CrewGuard><MyJobSheets /></CrewGuard></ProtectedRoute>} />
      
      {/* Common routes - all authenticated users */}
      <Route path="/knowledge-base" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
      <Route path="/staff/me" element={<ProtectedRoute><StaffMe /></ProtectedRoute>} />
      
      {/* Public onboarding guide - no auth required */}
      <Route path="/onboarding" element={<CrewOnboardingGuide />} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <ErrorBoundary title="App error" backTo="/auth">
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
