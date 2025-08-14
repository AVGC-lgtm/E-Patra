import React, { useState, useEffect } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getAuthToken, setAuthToken, clearAuthTokens, isSessionActive } from './utils/auth';
import Login from "./components/Login/Login";
import ForgotPassword from "./components/Login/ForgotPassword";
import DashboardLayout from './components/Dashboard/DashboardLayout';
import SimpleDashboardLayout from './components/Dashboard/SimpleDashboardLayout';
import Dashboard from './pages/Dashboard';
import InwardDashboard from './pages/InwardDashboard';
import MyInwardLetters from './pages/MyInwardLetters';
import OutwardDashboard from './pages/OutwardDashboard';
import HeadDashboard from './pages/HeadDashboard';

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
const apiUrl = import.meta.env.VITE_API_URL;
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
    'dm': 'dm',
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
  // Removed global loading state - individual components handle their own loading

  // Check for existing token on initial load with improved session management
  useEffect(() => {
    const checkAuth = async () => {
      // Check if this is a fresh page load (new tab/window)
      if (!isSessionActive()) {
        // If it's a new session, clear any existing tokens to force fresh login
        clearAuthTokens();
        return;
      }

      // Get token using utility function
      const token = getAuthToken();
      
      if (token) {
        try {
          // Validate token by making an API call to ensure it's still valid
          const response = await fetch(`${apiUrl}/api/auth/verify`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const tokenData = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Date.now() / 1000;
            
            if (tokenData.exp > currentTime) {
              // Ensure token is in sessionStorage for this session
              setAuthToken(token);
              setIsLoggedIn(true);
              
              const rawRole = tokenData.roleName || 'user';
              const normalizedRole = normalizeRole(rawRole);
              setUserRole(normalizedRole);
            } else {
              // Token expired
              clearAuthTokens();
              setIsLoggedIn(false);
              setUserRole('user');
            }
          } else {
            // Token invalid on server
            clearAuthTokens();
            setIsLoggedIn(false);
            setUserRole('user');
          }
        } catch (error) {
          console.error('Error validating token:', error);
          clearAuthTokens();
          setIsLoggedIn(false);
          setUserRole('user');
        }
      }
    };

    checkAuth();
  }, []);

  const handleLogin = (token) => {
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      
      // Use utility function to set token
      setAuthToken(token);
      
      setIsLoggedIn(true);
      
      const rawRole = tokenData.roleName || 'user';
      const normalizedRole = normalizeRole(rawRole);
      setUserRole(normalizedRole);
    } catch (error) {
      console.error('Error processing login:', error);
      toast.error('Error processing your login. Please try again.');
    }
  };

  const handleLogout = () => {
    // Clear all storage and state using utility function
    clearAuthTokens();
    setIsLoggedIn(false);
    setUserRole('user');
    // Navigate to login page
    navigate('/login');
  };

  // Remove global loading screen - let individual components handle their own loading states

  // Get the appropriate layout based on user role
  const getLayout = (children) => {
    // All users use the same SimpleDashboardLayout design
    return (
      <SimpleDashboardLayout 
        onLogout={handleLogout}
      >
        {children}
      </SimpleDashboardLayout>
    );
  };

  // Protected route wrapper with enhanced security
  const ProtectedRoute = ({ children, roles = [] }) => {
    // First check if user is logged in
    if (!isLoggedIn) {
      return <Navigate to="/login" replace />;
    }
    
    // Verify token is still valid and get fresh user data
    const token = getAuthToken();
    if (!token) {
      setIsLoggedIn(false);
      setUserRole('user');
      return <Navigate to="/login" replace />;
    }
    
    // Additional security: verify token structure and user role
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      // Check if token is expired
      if (tokenData.exp <= currentTime) {
        clearAuthTokens();
        setIsLoggedIn(false);
        setUserRole('user');
        return <Navigate to="/login" replace />;
      }
      
      // Verify the role from token matches the current userRole state
      const tokenRole = normalizeRole(tokenData.roleName || 'user');
      if (tokenRole !== userRole) {
        // Role mismatch - update state and redirect appropriately
        setUserRole(tokenRole);
        const correctPath = 
          tokenRole === 'inward_user' ? '/inward-dashboard' :
          tokenRole === 'head' ? '/head-dashboard' :
          '/outward-dashboard';
        return <Navigate to={correctPath} replace />;
      }
    } catch (error) {
      console.error('Invalid token structure:', error);
      clearAuthTokens();
      setIsLoggedIn(false);
      setUserRole('user');
      return <Navigate to="/login" replace />;
    }
    
    // Check role-based access
    if (roles.length && !roles.includes(userRole)) {
      console.warn(`Access denied: User role '${userRole}' not in allowed roles [${roles.join(', ')}]`);
      
      // Redirect to appropriate dashboard based on actual user role
      const redirectPath = 
        userRole === 'inward_user' ? '/inward-dashboard' :
        userRole === 'head' ? '/head-dashboard' :
        '/outward-dashboard';
      return <Navigate to={redirectPath} replace />;
    }
    
    return children;
  };

  // Route guard component to validate access on every navigation (without loading screen)
  const RouteGuard = ({ children }) => {
    useEffect(() => {
      const validateAccess = async () => {
        const token = getAuthToken();
        
        if (!token) {
          setIsLoggedIn(false);
          setUserRole('user');
          return;
        }
        
        try {
          // Validate token with server
          const response = await fetch(`${apiUrl}/api/auth/verify`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            const tokenData = JSON.parse(atob(token.split('.')[1]));
            const currentRole = normalizeRole(tokenData.roleName || 'user');
            
            // Ensure role consistency
            if (currentRole !== userRole) {
              setUserRole(currentRole);
            }
            
            setIsLoggedIn(true);
          } else {
            // Token invalid
            clearAuthTokens();
            setIsLoggedIn(false);
            setUserRole('user');
          }
        } catch (error) {
          console.error('Route validation error:', error);
          clearAuthTokens();
          setIsLoggedIn(false);
          setUserRole('user');
        }
      };
      
      validateAccess();
    }, [window.location.pathname]); // Re-validate on route change
    
    // No loading screen - show children immediately while validation happens in background
    return children;
  };

  return (
    <div className="min-h-screen">
      <RouteGuard>
        <Routes>
        <Route path="/forgot-password" element={
          isLoggedIn ? (
            <Navigate to={
              userRole === 'inward_user' ? '/inward-dashboard' :
              userRole === 'head' ? '/head-dashboard' :
              '/outward-dashboard'
            } 
            replace />
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
              userRole === 'head' ? '/head-dashboard' :
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
              <SimpleDashboardLayout onLogout={handleLogout}>
                <Outlet />
              </SimpleDashboardLayout>
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
              'outward_user', 'sp', 'dm', 'dg_other', 
              'home', 'ig_nashik_other', 'shanik_local', 'outside_police_station'
            ]}>
              <SimpleDashboardLayout onLogout={handleLogout}>
                <Outlet />
              </SimpleDashboardLayout>
            </ProtectedRoute>
          }
        >
          <Route index element={<OutwardDashboard />} />
          <Route path="outward-letters" element={<OutwardStaffLetters />} />
          <Route path="track-application" element={<TrackApplication />}>
            <Route path=":referenceNumber" element={<TrackApplication />} />
          </Route>
        </Route>

        {/* Head Dashboard Routes - Separate dashboard for Head users */}
        <Route 
          path="/head-dashboard" 
          element={
            <ProtectedRoute roles={['head']}>
              <SimpleDashboardLayout onLogout={handleLogout}>
                <Outlet />
              </SimpleDashboardLayout>
            </ProtectedRoute>
          }
        >
          <Route index element={<HeadDashboard />} />
          <Route path="letters" element={<HODLetters />} />
          <Route path="upload-sign" element={<UploadSign />} />
        </Route>

        {/* Main Dashboard Route - Redirect Head users to their dedicated dashboard */}
        <Route 
          path="/dashboard" 
          element={
            userRole === 'head' ? (
              <Navigate to="/head-dashboard" replace />
            ) : (
              <ProtectedRoute>
                <Outlet />
              </ProtectedRoute>
            )
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
               userRole === 'head' ? '/head-dashboard' :
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
      </RouteGuard>
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
