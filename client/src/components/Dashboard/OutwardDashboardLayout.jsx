import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiMenu, FiX, FiLogOut, FiUser, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { useLanguage } from '../../context/LanguageContext';
import translations from '../../translations';
import LanguageSwitcher from '../common/LanguageSwitcher';

const OutwardDashboardLayout = ({ children, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  // Simplified sidebar navigation items for outward users
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  const navItems = [
    { path: '/outward-dashboard', icon: '📊', label: language === 'mr' ? 'डॅशबोर्ड' : 'Dashboard', key: 'dashboard' },
    { path: '/outward-dashboard/outward-letters', icon: '📤', label: language === 'mr' ? 'जावक पत्रे' : 'Outward Letters', key: 'outward-letters' },
    { path: '/outward-dashboard/track-application', icon: '🔍', label: language === 'mr' ? 'अर्ज ट्रॅक करा' : 'Track Application', key: 'track-application' }
  ];

  // Get user info from localStorage
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

  // Toggle mobile sidebar
  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  // Toggle desktop sidebar
  const toggleDesktopSidebar = () => {
    setIsDesktopSidebarOpen(!isDesktopSidebarOpen);
  };

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isProfileDropdownOpen && !event.target.closest('.profile-dropdown')) {
        setIsProfileDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileDropdownOpen]);

  // Handle navigation
  const handleNavigation = (path) => {
    navigate(path);
  };

  // Handle logout
  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    navigate('/login');
  };

  // Determine active tab based on current route
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('outward-letters')) return 'outward-letters';
    if (path.includes('track-application')) return 'track-application';
    return 'dashboard';
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile sidebar overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <div 
        className={`${isDesktopSidebarOpen ? 'w-64' : 'w-20'} 
                    hidden md:block fixed inset-y-0 left-0 z-40 bg-gradient-to-b from-blue-800 to-blue-900 text-white 
                    transition-all duration-300 ease-in-out h-full shadow-xl`}
      >
        <div className="p-4 relative h-full flex flex-col">
          {/* Logo and Toggle */}
          <div className="flex items-center justify-between mb-8">
            <div className={`transition-opacity duration-300 ${isDesktopSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
              {isDesktopSidebarOpen && (
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-lg">📤</span>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">E-Patra</h1>
                    <p className="text-xs text-blue-200">{language === 'mr' ? 'जावक' : 'Outward'}</p>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={toggleDesktopSidebar}
              className="p-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiMenu className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const isActive = getActiveTab() === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleNavigation(item.path)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-700 text-white shadow-lg'
                      : 'text-blue-100 hover:bg-blue-700 hover:text-white'
                  }`}
                  title={item.label}
                >
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <span className={`font-medium truncate transition-opacity duration-300 ${
                    isDesktopSidebarOpen ? 'opacity-100' : 'opacity-0'
                  }`}>
                    {isDesktopSidebarOpen && item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* User Profile Section */}
          <div className="border-t border-blue-700 pt-4">
            <div className="relative profile-dropdown">
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <FiUser className="h-4 w-4" />
                </div>
                {isDesktopSidebarOpen && (
                  <>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {userInfo.name || 'User'}
                      </p>
                      <p className="text-xs text-blue-200 truncate">
                        {language === 'mr' ? 'जावक वापरकर्ता' : 'Outward User'}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {isProfileDropdownOpen ? (
                        <FiChevronUp className="h-4 w-4" />
                      ) : (
                        <FiChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </>
                )}
              </button>

              {/* Profile Dropdown */}
              {isProfileDropdownOpen && isDesktopSidebarOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{userInfo.name || 'User'}</p>
                    <p className="text-xs text-gray-500">{userInfo.email || ''}</p>
                  </div>
                  <LanguageSwitcher />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <FiLogOut className="h-4 w-4" />
                    <span>{language === 'mr' ? 'लॉगआउट' : 'Logout'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div 
        className={`${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
                    md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-blue-800 to-blue-900 text-white 
                    transform transition-transform duration-300 ease-in-out h-full shadow-xl`}
      >
        <div className="p-4 h-full flex flex-col">
          {/* Mobile Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <span className="text-blue-600 font-bold text-lg">📤</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">E-Patra</h1>
                <p className="text-xs text-blue-200">{language === 'mr' ? 'जावक' : 'Outward'}</p>
              </div>
            </div>
            <button
              onClick={toggleMobileSidebar}
              className="p-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>

          {/* Mobile Navigation */}
          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const isActive = getActiveTab() === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleNavigation(item.path)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-700 text-white shadow-lg'
                      : 'text-blue-100 hover:bg-blue-700 hover:text-white'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Mobile User Profile */}
          <div className="border-t border-blue-700 pt-4">
            <div className="px-4 py-2 mb-2">
              <p className="text-sm font-medium text-white">{userInfo.name || 'User'}</p>
              <p className="text-xs text-blue-200">{language === 'mr' ? 'जावक वापरकर्ता' : 'Outward User'}</p>
            </div>
            <LanguageSwitcher />
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-2 px-4 py-3 text-red-200 hover:bg-blue-700 hover:text-red-100 rounded-lg transition-colors"
            >
              <FiLogOut className="h-4 w-4" />
              <span>{language === 'mr' ? 'लॉगआउट' : 'Logout'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
        isDesktopSidebarOpen ? 'md:ml-64' : 'md:ml-20'
      }`}>
        {/* Top Header Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center">
            {/* Mobile menu button */}
            <button
              onClick={toggleMobileSidebar}
              className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <FiMenu className="h-6 w-6" />
            </button>
            
            {/* Page title */}
            <div className="ml-4 md:ml-0">
              <h1 className="text-xl font-semibold text-gray-900">
                {navItems.find(item => item.key === getActiveTab())?.label || 'Dashboard'}
              </h1>
            </div>
          </div>

          {/* Right side of header */}
          <div className="flex items-center space-x-4">
            {/* Language switcher for mobile */}
            <div className="md:hidden">
              <LanguageSwitcher />
            </div>
            
            {/* User info for mobile */}
            <div className="md:hidden flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <FiUser className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">{userInfo.name || 'User'}</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default OutwardDashboardLayout; 