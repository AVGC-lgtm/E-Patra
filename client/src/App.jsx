import React, { useState, useEffect } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import Login from "./components/Login/Login";
import ForgotPassword from "./components/Login/ForgotPassword";
import DashboardLayout from './components/Dashboard/DashboardLayout';
import SimpleDashboardLayout from './components/Dashboard/SimpleDashboardLayout';
import Dashboard from './pages/Dashboard';
import InwardDashboard from './pages/InwardDashboard';
import MyInwardLetters from './pages/MyInwardLetters';
import OutwardDashboard from './pages/OutwardDashboard';

// Import role-specific letter components
import InwardStaffLetters from './pages/letters/InwardStaffLetters';
import OutwardStaffLetters from './pages/letters/OutwardStaffLetters';
import AdminLetters from './pages/letters/AdminLetters';
import SPLetters from './pages/letters/SPLetters';
import HODLetters from './pages/letters/HODLetters';
import PoliceLetters from './pages/letters/PoliceLetters';
import NewLetter from './pages/NewLetter';
import TrackApplication from './pages/TrackApplication';
import InboxLetter from './pages/InboxLetter';
import UploadSign from './pages/UploadSign';
// Create a wrapper component that will use the useNavigate hook
// Helper function to normalize role names
const normalizeRole = (role) => {
  if (!role) return 'user';
  
  const roleStr = role.toString().toLowerCase().trim();
  
  // Handle different variations of role names
  const roleMap = {
    'head': 'head',
    'hod': 'head',
    'sp': 'sp',
    'superintendent': 'sp',
    'inward_user': 'inward_user',
    'inward': 'inward_user',
    'outward_user': 'outward_user',
    'outward': 'outward_user',
    'outside_police_station': 'outside_police_station',
    'police_station': 'outside_police_station',
    'admin': 'admin',
    // New roles from your system
    'collector': 'collector',
    'dg_other': 'dg_other',
    'home': 'home',
    'ig_nashik_other': 'ig_nashik_other',
    'shanik_local': 'shanik_local'
  };
  
  const normalizedRole = roleMap[roleStr] || roleStr;
  
  return normalizedRole;
};

const AppContent = () => {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token on initial load
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const tokenData = JSON.parse(atob(token.split('.')[1]));
          const currentTime = Date.now() / 1000;
          
          if (tokenData.exp > currentTime) {
            setIsLoggedIn(true);
            
            const rawRole = tokenData.roleName || 'user';
            const normalizedRole = normalizeRole(rawRole);
            setUserRole(normalizedRole);
          } else {
            // Token expired
            localStorage.removeItem('token');

          }
        } catch (error) {
          console.error('Error parsing token:', error);
          localStorage.removeItem('token');
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const handleLogin = (token) => {
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      localStorage.setItem('token', token);
      setIsLoggedIn(true);
      
      const rawRole = tokenData.roleName || 'user';
      const normalizedRole = normalizeRole(rawRole);
      setUserRole(normalizedRole);
    } catch (error) {
      console.error('Error processing login:', error);
      alert('Error processing your login. Please try again.');
    }
  };

  const handleLogout = () => {
    // Clear local storage and state
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setUserRole('user');
    // Navigate to login page
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Get the appropriate layout based on user role
  const getLayout = (children) => {
    // All users use the same SimpleDashboardLayout design
    if ([
      'inward_user', 'outward_user', 'sp', 'head', 'outside_police_station',
      'collector', 'dg_other', 'home', 'ig_nashik_other', 'shanik_local'
    ].includes(userRole)) {
      return (
        <SimpleDashboardLayout 
          onLogout={handleLogout}
        >
          {children}
        </SimpleDashboardLayout>
      );
    }
    
    return (
      <DashboardLayout 
        onLogout={handleLogout}
      >
        {children}
      </DashboardLayout>
    );
  };

  // Protected route wrapper
  const ProtectedRoute = ({ children, roles = [] }) => {
    if (!isLoggedIn) {
      return <Navigate to="/login" replace />;
    }
    
    if (roles.length && !roles.includes(userRole)) {
      return <Navigate to="/dashboard" replace />;
    }
    
    return getLayout(children);
  };

  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/forgot-password" element={
          isLoggedIn ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <div className="min-h-screen flex items-center justify-center p-4">
              <ForgotPassword />
            </div>
          )
        } />
        <Route path="/login" element={
          isLoggedIn ? (
            <Navigate to={
              userRole === 'inward_user' ? '/inward-dashboard' :
              userRole === 'outward_user' ? '/outward-dashboard' :
              '/outward-dashboard'  // All other roles use outward-dashboard design
            } 
            replace />
          ) : (
            <div className="min-h-screen flex items-center justify-center p-4">
              <Login onLogin={handleLogin} />
            </div>
          )
        } />

        {/* Inward Dashboard Routes - Separate dashboard for inward users */}
        <Route 
          path="/inward-dashboard" 
          element={
            <ProtectedRoute roles={['inward_user']}>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route index element={<InwardDashboard />} />
          <Route path="inward-letter" element={<NewLetter />} />
          <Route path="my-letters" element={<MyInwardLetters />} />
        </Route>

        {/* Outward Dashboard Routes - Dashboard for all non-inward users */}
        <Route 
          path="/outward-dashboard" 
          element={
            <ProtectedRoute roles={[
              'outward_user', 'head', 'sp', 'collector', 'dg_other', 
              'home', 'ig_nashik_other', 'shanik_local', 'outside_police_station'
            ]}>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route index element={<OutwardDashboard />} />
          <Route path="outward-letters" element={<OutwardStaffLetters />} />
          <Route path="track-application" element={<TrackApplication />}>
            <Route path=":referenceNumber" element={<TrackApplication />} />
          </Route>
        </Route>

        {/* Main Dashboard Route */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          
          {/* Routes for different user roles - Keep existing routes for backward compatibility */}
          {userRole === 'inward_user' && (
            <>
              <Route path="new-letter" element={<NewLetter />} />
              <Route path="all-letters" element={<InwardStaffLetters />} />
              <Route path="track-application" element={<TrackApplication />}>
                <Route path=":referenceNumber" element={<TrackApplication />} />
              </Route>
              <Route path="inbox" element={<InboxLetter />} />
            </>
          )}
          
          {userRole === 'outward_user' && (
            <Route path="all-letters" element={<OutwardStaffLetters />} />
          )}
          
          {userRole === 'admin' && (
            <Route path="all-letters" element={<AdminLetters />} />
          )}
          
          {/* Role-specific letter routes */}
          {userRole === 'sp' && (
            <>
              <Route path="letters" element={<SPLetters />} />
              <Route path="upload-sign" element={<UploadSign />} />
            </>
          )}
          
          {userRole === 'head' && (
            <>
              <Route path="letters" element={<HODLetters />} />
              <Route path="upload-sign" element={<UploadSign />} />
            </>
          )}
          
          {userRole === 'outside_police_station' && (
            <>
              <Route path="letters" element={<PoliceLetters />} />
              <Route path="upload-sign" element={<UploadSign />} />
            </>
          )}
        </Route>

        {/* Root Route - Redirect based on auth */}
        <Route 
          path="/" 
          element={
            <Navigate to={isLoggedIn ? 
              (userRole === 'inward_user' ? '/inward-dashboard' : 
               '/outward-dashboard') : 
              '/login'} 
            replace />
          } 
        />

        {/* Catch-all Route */}
        <Route 
          path="*" 
          element={<Navigate to="/" replace />} 
        />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <LanguageProvider>
      <Router>
        <AppContent />
      </Router>
    </LanguageProvider>
  );
}

export default App;
