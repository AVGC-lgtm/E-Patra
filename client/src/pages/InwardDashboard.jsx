import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { FiMail, FiFileText, FiClock, FiChevronUp, FiChevronDown, FiRefreshCw } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';

const StatCard = ({ title, value, change, icon, color }) => {
  const colorVariants = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-teal-600',
    amber: 'from-amber-500 to-orange-500',
    indigo: 'from-indigo-500 to-violet-600',
  };

  return (
    <motion.div 
      className={`bg-gradient-to-br ${colorVariants[color]} rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-white/90">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          <div className="flex items-center mt-1 text-sm font-medium text-white/90">
            {change.includes('+') ? (
              <FiChevronUp className="text-green-300 mr-1" />
            ) : change.includes('-') ? (
              <FiChevronDown className="text-red-300 mr-1" />
            ) : null}
            {change}
          </div>
        </div>
        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
          {React.cloneElement(icon, { className: 'w-6 h-6 text-white' })}
        </div>
      </div>
    </motion.div>
  );
};

const InwardDashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [myLetters, setMyLetters] = useState([]);
  const [stats, setStats] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [error, setError] = useState(null);
  const { language } = useLanguage();

  // Colors for different statuses in the pie chart
  const COLORS = ['#6366f1', '#10b981', '#ef4444']; // [pending, approved, rejected]

  const fetchMyLetters = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError(language === 'mr' ? 'कृपया लॉगिन करा' : 'Please login first');
        return;
      }

      // Get user ID from token
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      const userId = tokenData.id || tokenData.userId;

      const response = await axios.get('http://localhost:5000/api/patras', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          userId: userId, // Filter by current user
          _t: new Date().getTime() // Prevent caching
        }
      });
      
      console.log('API Response:', response.data);
      
      // Handle the API response structure
      let lettersData = [];
      if (response.data && response.data.data && Array.isArray(response.data.data.patras)) {
        lettersData = response.data.data.patras;
      } else if (response.data && Array.isArray(response.data.patras)) {
        lettersData = response.data.patras;
      } else if (response.data && Array.isArray(response.data)) {
        lettersData = response.data;
      }
      
      // Filter only letters created by current user
      const userLetters = lettersData.filter(letter => 
        letter.userId === userId || letter.User?.id === userId
      );
      
      // Sort by createdAt in descending order (newest first)
      const sortedData = [...userLetters].sort((a, b) => 
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      
      console.log('User letters:', sortedData);
      setMyLetters(sortedData);
      processLettersData(sortedData);
      setError(null);
    } catch (err) {
      console.error('Error fetching letters:', err);
      setError(language === 'mr' ? 'पत्रे लोड करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.' : 'Failed to load letters. Please try again.');
      setMyLetters([]);
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  const processLettersData = (lettersData) => {
    if (!Array.isArray(lettersData)) {
      console.error('Invalid data format received:', lettersData);
      setError(language === 'mr' ? 'अवैध डेटा प्राप्त झाला' : 'Invalid data format received');
      return;
    }

    // Calculate stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayCount = lettersData.filter(p => {
      if (!p.createdAt) return false;
      const letterDate = new Date(p.createdAt);
      letterDate.setHours(0, 0, 0, 0);
      return letterDate.getTime() === today.getTime();
    }).length;
    
    // Normalize status to handle different cases or formats
    const getNormalizedStatus = (status) => {
      if (!status) return 'unknown';
      const lowerStatus = status.toLowerCase().trim();
      if (lowerStatus.includes('pending') || lowerStatus === 'sending for head sign') return 'pending';
      if (lowerStatus.includes('approv') || lowerStatus === 'processed' || lowerStatus === 'sent to head') return 'approved';
      if (lowerStatus.includes('reject')) return 'rejected';
      return lowerStatus;
    };
    
    // Count letters by status
    const statusCounts = lettersData.reduce((acc, p) => {
      const status = getNormalizedStatus(p.letterStatus);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    const pendingCount = statusCounts['pending'] || 0;
    const approvedCount = statusCounts['approved'] || 0;
    const rejectedCount = statusCounts['rejected'] || 0;
    
    // Update stats with proper change indicators
    setStats([
      {
        title: language === 'mr' ? "आजचे पत्र" : "Today's Letters",
        value: todayCount.toString(),
        change: "100%",
        icon: <FiMail />,
        color: "indigo",
      },
      {
        title: language === 'mr' ? "एकूण पत्रे" : "Total Letters",
        value: lettersData.length.toString(),
        change: "100%",
        icon: <FiFileText />,
        color: "green",
      },
      {
        title: language === 'mr' ? "प्रलंबित मंजुरी" : "Pending Approval",
        value: pendingCount.toString(),
        change: "0%",
        icon: <FiClock />,
        color: "amber",
      },
    ]);

    // Process pie chart data
    const pieChartData = [
      { name: language === 'mr' ? 'प्रलंबित' : 'Pending', value: pendingCount },
      { name: language === 'mr' ? 'मंजूर' : 'Approved', value: approvedCount },
      { name: language === 'mr' ? 'नाकारले' : 'Rejected', value: rejectedCount }
    ].filter(item => item.value > 0);
    
    setPieData(pieChartData.length > 0 ? pieChartData : [{ name: language === 'mr' ? 'डेटा नाही' : 'No Data', value: 1 }]);

    // Process recent activity
    const sortedLetters = [...lettersData]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 4);

    const activity = sortedLetters.map((letter, index) => ({
      id: letter.id || letter._id,
      type: letter.letterStatus === 'pending' ? 'alert' : 'update',
      title: `${letter.letterType || 'Letter'} - ${letter.referenceNumber}`,
      time: new Date(letter.createdAt).toLocaleDateString(),
      user: letter.recipientNameAndDesignation || (language === 'mr' ? 'अज्ञात' : 'Unknown'),
    }));
    setRecentActivity(activity);
  };

  useEffect(() => {
    fetchMyLetters();
  }, [fetchMyLetters]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <motion.div 
        className="mb-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          {language === 'mr' ? 'माझे डॅशबोर्ड' : 'My Dashboard'}
        </h1>
        <p className="text-gray-500 mt-1">
          {language === 'mr' ? 'तुमच्या पत्रांचे विहंगावलोकन' : 'Overview of your letters and submissions'}
        </p>
      </motion.div>
      
      {/* Stats Cards */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, staggerChildren: 0.1 }}
      >
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </motion.div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        
        {/* Pie Chart */}
        <motion.div 
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">
              {language === 'mr' ? 'पत्र स्थिती' : 'Letter Status'}
            </h3>
            <button 
              onClick={fetchMyLetters}
              className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <FiRefreshCw className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    padding: '0.75rem 1rem',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div 
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">
              {language === 'mr' ? 'अलीकडील क्रियाकलाप' : 'Recent Activity'}
            </h3>
          </div>
          <div className="space-y-4">
            {recentActivity.length > 0 ? recentActivity.map((activity, index) => (
              <motion.div 
                key={activity.id}
                className="flex items-start p-3 rounded-lg hover:bg-gray-50 transition-colors"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + (index * 0.05) }}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  activity.type === 'new' ? 'bg-blue-100 text-blue-600' : 
                  activity.type === 'update' ? 'bg-green-100 text-green-600' : 
                  'bg-amber-100 text-amber-600'
                }`}>
                  {activity.type === 'new' ? (
                    <FiMail className="w-5 h-5" />
                  ) : activity.type === 'update' ? (
                    <FiRefreshCw className="w-5 h-5" />
                  ) : (
                    <FiClock className="w-5 h-5" />
                  )}
                </div>
                <div className="ml-4 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">{activity.title}</h4>
                    <span className="text-xs text-gray-500">{activity.time}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{activity.user}</p>
                </div>
              </motion.div>
            )) : (
              <div className="text-center py-8">
                <FiFileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {language === 'mr' ? 'कोणतीही क्रियाकलाप नाही' : 'No Recent Activity'}
                </h3>
                <p className="text-gray-500">
                  {language === 'mr' ? 'तुमचे पहिले पत्र सबमिट करा' : 'Submit your first letter to see activity here'}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div 
        className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {language === 'mr' ? 'द्रुत क्रियाकलाप' : 'Quick Actions'}
          </h3>
          <div className="flex justify-center space-x-4">
            <a
              href="/inward-dashboard/inward-letter"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            >
              <FiFileText className="mr-2 h-5 w-5" />
              {language === 'mr' ? 'नवीन पत्र सबमिट करा' : 'Submit New Letter'}
            </a>
            <a
              href="/inward-dashboard/my-letters"
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
            >
              <FiClock className="mr-2 h-5 w-5" />
              {language === 'mr' ? 'माझी पत्रे पहा' : 'View My Letters'}
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InwardDashboard; 