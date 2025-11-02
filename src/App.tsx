import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import Navbar from "./components/ui/navbar";
import EventsList from "./pages/events/EventsAdmin";
import NewsAdmin from "./pages/news/NewsAdmin";
import HistoryAdmin from "./pages/history/HistoryAdmin";
import TeamsAdmin from "./pages/teams/TeamsAdmin";
import TournamentsAdmin from "./pages/tournaments/TournamentsAdmin";
import { Toaster } from "./components/ui/toaster";
import { Calendar, Newspaper, History, Users, Trophy } from "lucide-react";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const { isAuthChecked } = useAuth();
  if (!isAuthChecked) return null;

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const Dashboard = () => {
  const { username } = useAuth();
  
  const managementPages = [
    {
      title: 'Ereignisse',
      description: 'Verwalten Sie alle Ereignisse und Termine',
      icon: Calendar,
      path: '/events',
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100'
    },
    {
      title: 'Nachrichten',
      description: 'Verwalten Sie Nachrichten und Ankündigungen',
      icon: Newspaper,
      path: '/news',
      color: 'bg-green-50 border-green-200 hover:bg-green-100'
    },
    {
      title: 'Geschichte',
      description: 'Verwalten Sie die Vereinsgeschichte',
      icon: History,
      path: '/history',
      color: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
    },
    {
      title: 'Mannschaften',
      description: 'Verwalten Sie Mannschaften und Spieler',
      icon: Users,
      path: '/teams',
      color: 'bg-purple-50 border-purple-200 hover:bg-purple-100'
    },
    {
      title: 'Turniere',
      description: 'Verwalten Sie Turnierergebnisse',
      icon: Trophy,
      path: '/tournaments',
      color: 'bg-orange-50 border-orange-200 hover:bg-orange-100'
    }
  ];
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              Willkommen, {username}!
            </h1>
            <p className="text-gray-600">
              Wählen Sie einen Bereich aus, um mit der Verwaltung zu beginnen.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {managementPages.map((page) => {
              const Icon = page.icon;
              return (
                <Link key={page.path} to={page.path}>
                  <div className={`${page.color} border-2 rounded-lg p-6 transition-all hover:shadow-md cursor-pointer h-full`}>
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <Icon className="w-8 h-8 text-gray-700" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {page.title}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {page.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
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
        <Route path="/news" element={<ProtectedRoute><NewsAdmin /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><HistoryAdmin /></ProtectedRoute>} />
        <Route path="/teams" element={<ProtectedRoute><TeamsAdmin /></ProtectedRoute>} />
        <Route path="/tournaments" element={<ProtectedRoute><TournamentsAdmin /></ProtectedRoute>} />
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
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;