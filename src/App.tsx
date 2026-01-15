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
import CalendarView from "./pages/CalendarView";
import CalendarDayView from "./pages/CalendarDayView";
import MyCalendar from "./pages/MyCalendar";
import Workflows from "./pages/Workflows";
import WorkflowsList from "./pages/admin/WorkflowsList";
import WorkflowDetail from "./pages/admin/WorkflowDetail";
import EventTypeDefaults from "./pages/admin/EventTypeDefaults";
import EventSeriesList from "./pages/admin/EventSeriesList";
import EventSeriesDetail from "./pages/admin/EventSeriesDetail";
import Delivery from "./pages/Delivery";
import GalleryPublic from "./pages/GalleryPublic";
import JobIntakeList from "./pages/JobIntakeList";
import JobIntakeDetail from "./pages/JobIntakeDetail";
import KnowledgeBase from "./pages/KnowledgeBase";
import MyAvailability from "./pages/MyAvailability";
import Equipment from "./pages/Equipment";
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
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
      <Route path="/events/new" element={<ProtectedRoute><EventForm /></ProtectedRoute>} />
      <Route path="/events/:id" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
      <Route path="/events/:id/edit" element={<ProtectedRoute><EventForm /></ProtectedRoute>} />
      <Route path="/events/:id/worksheets" element={<ProtectedRoute><EventWorksheets /></ProtectedRoute>} />
      <Route path="/events/:id/day-of" element={<ProtectedRoute><EventDayOf /></ProtectedRoute>} />
      <Route path="/events/:id/run-sheet" element={<ProtectedRoute><EventRunSheet /></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarView /></ProtectedRoute>} />
      <Route path="/calendar/day" element={<ProtectedRoute><CalendarDayView /></ProtectedRoute>} />
      <Route path="/my-calendar" element={<ProtectedRoute><MyCalendar /></ProtectedRoute>} />
      <Route path="/workflows" element={<ProtectedRoute><Workflows /></ProtectedRoute>} />
      <Route path="/admin/workflows" element={<ProtectedRoute><WorkflowsList /></ProtectedRoute>} />
      <Route path="/admin/workflows/:id" element={<ProtectedRoute><WorkflowDetail /></ProtectedRoute>} />
      <Route path="/admin/event-types" element={<ProtectedRoute><EventTypeDefaults /></ProtectedRoute>} />
      <Route path="/admin/series" element={<ProtectedRoute><EventSeriesList /></ProtectedRoute>} />
      <Route path="/admin/series/:id" element={<ProtectedRoute><EventSeriesDetail /></ProtectedRoute>} />
      <Route path="/delivery" element={<ProtectedRoute><Delivery /></ProtectedRoute>} />
      <Route path="/job-intake" element={<ProtectedRoute><JobIntakeList /></ProtectedRoute>} />
      <Route path="/job-intake/:id" element={<ProtectedRoute><JobIntakeDetail /></ProtectedRoute>} />
      <Route path="/knowledge-base" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
      <Route path="/my-availability" element={<ProtectedRoute><MyAvailability /></ProtectedRoute>} />
      <Route path="/equipment" element={<ProtectedRoute><Equipment /></ProtectedRoute>} />
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
