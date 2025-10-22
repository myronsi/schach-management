import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useRef, useState } from "react";
import Login from "./pages/Login";
import Navbar from "./components/ui/navbar";
import EventsList from "./pages/events/EventsList";
import EventsListEmbedded from "./pages/events/EventsListEmbedded";
import type { EventsListRef } from "./pages/events/EventsListEmbedded";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import CreateEventDialog from "./components/events/CreateEventDialog";
import EditEventDialog from "./components/events/EditEventDialog";
import DeleteEventDialog from "./components/events/DeleteEventDialog";

const queryClient = new QueryClient();

// Protected Route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Dashboard component (Platzhalter)
const Dashboard = () => {
  const { username } = useAuth();
  const eventsListRef = useRef<EventsListRef>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const handleEventSuccess = () => {
    eventsListRef.current?.refresh();
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
              Willkommen, {username}!
            </h1>
            <div className="text-gray-600">
              <p className="text-sm sm:text-base">Sie sind erfolgreich in der Anwendung angemeldet.</p>
              <div className="mt-4 sm:mt-6">
                <h3 className="text-base sm:text-lg font-medium mb-2">Ereignisse verwalten</h3>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-green-600 text-white hover:bg-green-700 w-full sm:w-auto">
                        Neues Ereignis
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-md sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Neues Ereignis erstellen</DialogTitle>
                      </DialogHeader>
                      <CreateEventDialog 
                        onSuccess={handleEventSuccess} 
                        onClose={() => setCreateDialogOpen(false)}
                      />
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-yellow-600 text-white hover:bg-yellow-700 w-full sm:w-auto">
                        Ereignisse bearbeiten
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-md sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Ereignisse bearbeiten</DialogTitle>
                      </DialogHeader>
                      <EditEventDialog 
                        onSuccess={handleEventSuccess}
                        onClose={() => setEditDialogOpen(false)}
                      />
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-red-600 text-white hover:bg-red-700 w-full sm:w-auto">
                        Ereignisse löschen
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-md sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Ereignisse löschen</DialogTitle>
                      </DialogHeader>
                      <DeleteEventDialog 
                        onSuccess={handleEventSuccess}
                        onClose={() => setDeleteDialogOpen(false)}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </div>
          <EventsListEmbedded ref={eventsListRef} />
        </div>
      </div>
    </div>
  );
};

const AppContent = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/events" element={<ProtectedRoute><EventsList /></ProtectedRoute>} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;