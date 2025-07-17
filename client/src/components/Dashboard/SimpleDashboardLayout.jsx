import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import translations from '../../translations';
import LanguageSelector from '../LanguageSelector';

// Helper function to get user data from token
const getUserFromToken = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  
  try {
    const tokenData = JSON.parse(atob(token.split('.')[1]));
    return {
      name: tokenData.name || 'User',
      email: tokenData.email || '',
      role: tokenData.roleName || 'user',
      // Add any other user properties you need
    };
  } catch (error) {
    console.error('Error parsing token:', error);
    return null;
  }
};

const SimpleDashboardLayout = ({ basePath = '', onLogout, children }) => {
  const location = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [user, setUser] = useState(null);

  const { language, changeLanguage } = useLanguage();
  const t = translations[language] || translations.en;

  useEffect(() => {
    // Get user data when component mounts
    const userData = getUserFromToken();
    setUser(userData);
  }, []);

  // Get user initials for avatar
  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const profileButton = document.getElementById('simple-profile-button');
      const profileDropdown = document.getElementById('simple-profile-dropdown');
      
      if (profileButton && !profileButton.contains(event.target) && 
          profileDropdown && !profileDropdown.contains(event.target)) {
        setIsProfileDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Navigation items configuration
  const navItems = [
    { path: '.', icon: '📊', label: t.dashboard || 'Dashboard', key: 'dashboard' },
    { path: 'letters', icon: '📑', label: t.receivedLetters || 'Received Letters', key: 'letters' },
  ];

  // Determine active tab based on current route
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.endsWith('/letters') || path.endsWith('/letters/')) return 'letters';
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getActiveTab());

  useEffect(() => {
    setActiveTab(getActiveTab());
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobileView(mobile);
      if (!mobile && !isDesktopSidebarOpen) {
        setIsDesktopSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isDesktopSidebarOpen]);

  const handleLogoutClick = (e) => {
    e.preventDefault();
    if (onLogout) {
      onLogout();
    } else {
      window.location.href = '/login';
    }
  };

  const toggleSidebar = () => {
    if (isMobileView) {
      setIsMobileSidebarOpen(!isMobileSidebarOpen);
    } else {
      setIsDesktopSidebarOpen(!isDesktopSidebarOpen);
    }
  };

  // Helper to build links relative to base path
  const rel = (subPath) => {
    // Remove any leading slashes to prevent double slashes
    const cleanSubPath = subPath.startsWith('/') ? subPath.substring(1) : subPath;
    return `${basePath}${basePath.endsWith('/') ? '' : '/'}${cleanSubPath}`;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div
        className={`${isDesktopSidebarOpen ? 'w-64' : 'w-20'} 
                    hidden md:block fixed inset-y-0 left-0 z-40 bg-gradient-to-b from-blue-800 to-blue-900 text-white 
                    transition-all duration-300 ease-in-out h-full shadow-xl`}
      >
        <div className="p-4 relative h-full flex flex-col">
          <div className="flex items-center justify-center mb-8">
            {isDesktopSidebarOpen ? (
              <h1 className="text-xl font-bold text-white">Letter System</h1>
            ) : (
              <h1 className="text-xl font-bold text-white">LS</h1>
            )}
          </div>

          <nav className="flex-1">
            {navItems.map((item) => (
              <Link
                key={item.key}
                to={item.path}
                className={`flex items-center p-4 my-1 rounded-lg transition-all duration-200 ${
                  activeTab === item.key
                    ? 'bg-blue-700 shadow-md'
                    : 'hover:bg-blue-700 hover:bg-opacity-50'
                }`}
                onClick={() => setActiveTab(item.key)}
              >
                <span className={`${isDesktopSidebarOpen ? 'mr-3' : 'mx-auto'} text-xl`}>
                  {item.icon}
                </span>
                {isDesktopSidebarOpen && (
                  <span className="font-medium">{item.label}</span>
                )}
              </Link>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div className="mt-auto pb-4">
            <div className="border-t border-blue-700 pt-4">
              <button
                onClick={handleLogoutClick}
                className="flex items-center w-full p-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span className={`${isDesktopSidebarOpen ? 'mr-3' : 'mx-auto'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </span>
                {isDesktopSidebarOpen && <span>Logout</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
                    md:hidden fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-blue-800 to-blue-900 text-white 
                    transition-transform duration-300 ease-in-out h-full shadow-xl`}
      >
        <div className="p-4 relative h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-xl font-bold">Letter System</h1>
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="p-2 text-white hover:bg-blue-700 rounded-full transition-colors"
              aria-label="Close menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1">
            {navItems.map((item) => (
              <Link
                key={item.key}
                to={rel(item.path)}
                className={`flex items-center p-4 my-1 rounded-lg transition-all duration-200 ${
                  activeTab === item.key
                    ? 'bg-blue-700 shadow-md'
                    : 'hover:bg-blue-700 hover:bg-opacity-50'
                }`}
                onClick={() => {
                  setActiveTab(item.key);
                  setIsMobileSidebarOpen(false);
                }}
              >
                <span className="mr-3 text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Mobile sidebar footer */}
          <div className="mt-auto pb-4">
            <div className="border-t border-blue-700 pt-4">
              <button
                onClick={handleLogoutClick}
                className="flex items-center w-full p-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>{t.logout}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col ${isMobileView ? 'ml-0' : (isDesktopSidebarOpen ? 'md:ml-64' : 'md:ml-20')} transition-all duration-300`}>
        {/* Top Navigation */}
        <header className="bg-white shadow-sm z-10 sticky top-0">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center">
              {/* Mobile Menu Button - Only visible on mobile */}
              <button
                onClick={toggleSidebar}
                className="md:hidden mr-4 p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label={t.toggleSidebar}
                title={t.toggleSidebar}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              <h2 className="text-xl font-semibold text-gray-800">
                {navItems.find(item => item.key === activeTab)?.label || t.dashboard}
              </h2>
            </div>
            
            {/* User Profile/Logout */}
            <div className="flex items-center space-x-4">
              <LanguageSelector />
              <div className="relative">
                <button
                  id="simple-profile-button"
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center space-x-2 focus:outline-none"
                >
                  <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                    {user ? getUserInitials(user.name) : 'U'}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-gray-700">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-500 capitalize">{user?.role?.toLowerCase().replace('_', ' ') || 'User'}</p>
                  </div>
                  <svg 
                    className={`w-4 h-4 text-gray-500 transition-transform ${isProfileDropdownOpen ? 'transform rotate-180' : ''}`}
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Profile Dropdown */}
                {isProfileDropdownOpen && (
                  <div 
                    id="simple-profile-dropdown"
                    className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-50"
                  >
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
                      <p className="text-xs text-gray-500">{user?.email || ''}</p>
                    </div>
                    <div className="px-4 py-2 text-xs text-gray-700 capitalize">
                      Role: {user?.role?.toLowerCase().replace('_', ' ') || 'user'}
                    </div>
                    <div className="border-t border-gray-100"></div>
                    <button
                      onClick={handleLogoutClick}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      {t.logout}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="max-w-8xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm p-6">
              {children || <Outlet />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SimpleDashboardLayout;  