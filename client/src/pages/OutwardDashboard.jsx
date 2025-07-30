import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../utils/auth';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { FiFileText, FiSend, FiClock, FiCheckCircle, FiXCircle, FiRefreshCw, FiPlus, FiEye, FiChevronUp, FiChevronDown, FiExternalLink } from 'react-icons/fi';
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

const OutwardDashboard = () => {
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const { language } = useLanguage();
  const navigate = useNavigate();

  // Fetch letters forwarded to this user's table
  const fetchOutwardLetters = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      if (!token) {
        setError(language === 'mr' ? 'कृपया लॉगिन करा' : 'Please login first');
        return;
      }

      // Get user role from token to understand what table they belong to
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      const userRole = tokenData.roleName;
      const userTable = tokenData.table;
      
      // Set user info for display
      setUserInfo({
        role: userRole,
        table: userTable,
        email: tokenData.email
      });
      
      console.log('User Role:', userRole, 'User Table:', userTable);

      const response = await axios.get('http://localhost:5000/api/patras', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          _t: new Date().getTime() // Prevent caching
        }
      });
      
      console.log('Outward API Response:', response.data);
      
      // Handle the API response structure
      let lettersData = [];
      if (response.data && response.data.data && Array.isArray(response.data.data.patras)) {
        lettersData = response.data.data.patras;
      } else if (response.data && Array.isArray(response.data.patras)) {
        lettersData = response.data.patras;
      } else if (response.data && Array.isArray(response.data)) {
        lettersData = response.data;
      }
      
      // Sort by createdAt in descending order (newest first)
      const sortedData = [...lettersData].sort((a, b) => 
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      
      console.log(`Letters forwarded to ${userTable} table:`, sortedData);
      setLetters(sortedData);
      setError(null);
    } catch (err) {
      console.error('Error fetching letters:', err);
      setError(language === 'mr' ? 'पत्रे लोड करण्यात अयशस्वी' : 'Failed to load letters');
      setLetters([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutwardLetters();
  }, [language]);

  // Calculate statistics with change indicators
  const stats = [
    {
      title: language === 'mr' ? 'आजची पत्रे' : "Today's Letters",
      value: letters.filter(letter => {
        const today = new Date();
        const letterDate = new Date(letter.createdAt);
        return letterDate.toDateString() === today.toDateString();
      }).length,
      change: 'Today',
      icon: <FiClock />,
      color: 'indigo'
    },
    {
      title: language === 'mr' ? 'एकूण पत्रे' : 'Total Letters',
      value: letters.length,
      change: `${letters.length} total`,
      icon: <FiFileText />,
      color: 'green'
    },
    {
      title: language === 'mr' ? 'प्रमुखांकडे पाठवणे' : 'Sending to Head',
      value: letters.filter(letter => 
        letter.letterStatus && (
          letter.letterStatus.toLowerCase().includes('sent to head') ||
          letter.letterStatus.toLowerCase().includes('प्रमुखांकडे पाठवले') ||
          letter.forwardTo === 'head'
        )
      ).length,
      change: 'To Head',
      icon: <FiSend />,
      color: 'blue'
    },
    {
      title: language === 'mr' ? 'स्वाक्षरी कागदपत्रे' : 'Signed Documents',
      value: letters.filter(letter => 
        letter.coveringLetter && letter.coveringLetter.isSigned === true
      ).length,
      change: 'Signed',
      icon: <FiCheckCircle />,
      color: 'amber'
    }
  ];

  // Prepare month-wise chart data
  const getMonthlyData = () => {
    const monthCounts = {};
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const monthsMarathi = [
      'जाने', 'फेब्रु', 'मार्च', 'एप्रि', 'मे', 'जून',
      'जुलै', 'ऑग', 'सप्टें', 'ऑक्टो', 'नोव्हें', 'डिसें'
    ];

    // Initialize all months with 0
    months.forEach(month => {
      monthCounts[month] = 0;
    });

    // Count letters by month
    letters.forEach(letter => {
      if (letter.createdAt) {
        const date = new Date(letter.createdAt);
        const monthIndex = date.getMonth();
        const monthName = months[monthIndex];
        monthCounts[monthName]++;
      }
    });

    return months.map((month, index) => ({
      month: language === 'mr' ? monthsMarathi[index] : month,
      count: monthCounts[month]
    }));
  };

  const chartData = getMonthlyData();

  // Get recent letters (last 5)
  const recentLetters = letters.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 border-solid mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {language === 'mr' ? 'डेटा लोड होत आहे...' : 'Loading data...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <FiXCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 text-lg">{error}</p>
          <button
            onClick={fetchOutwardLetters}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <FiRefreshCw className="inline mr-2" />
            {language === 'mr' ? 'पुन्हा प्रयत्न करा' : 'Try Again'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          {userInfo?.table ? 
            (language === 'mr' ? `${userInfo.table.toUpperCase()} डॅशबोर्ड` : `${userInfo.table.toUpperCase()} Dashboard`) :
            (language === 'mr' ? 'जावक डॅशबोर्ड' : 'Outward Dashboard')
          }
        </h1>
        <p className="text-gray-500 mt-1">
          {userInfo?.table ? 
            (language === 'mr' ? `${userInfo.table} टेबलला पाठवलेली पत्रे` : `Letters forwarded to ${userInfo.table} table`) :
            (language === 'mr' ? 'जावक पत्रांचे व्यवस्थापन आणि ट्रैकिंग' : 'Manage and track your outward letters')
          }
        </p>
        {userInfo && (
          <div className="mt-3 inline-block bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
            <span className="text-sm text-blue-700 font-medium">
              {language === 'mr' ? 'टेबल: ' : 'Table: '}
              <span className="font-bold">{userInfo.table?.toUpperCase()}</span>
            </span>
          </div>
        )}
      </motion.div>

      {/* Stats Cards */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8"
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

      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* Monthly Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-xl shadow-lg p-6 border border-gray-100"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {language === 'mr' ? 'मासिक पत्र संख्या' : 'Monthly Letter Count'}
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  stroke="#666"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#666"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  labelStyle={{ color: '#374151' }}
                  formatter={(value) => [value, language === 'mr' ? 'पत्रे' : 'Letters']}
                />
                <Bar 
                  dataKey="count" 
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                  name={language === 'mr' ? 'पत्रे' : 'Letters'}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <FiFileText className="h-12 w-12 mx-auto mb-2" />
                <p>{language === 'mr' ? 'डेटा उपलब्ध नाही' : 'No data available'}</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-white rounded-xl shadow-lg p-6 border border-gray-100"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {language === 'mr' ? 'अलीकडील पत्रे' : 'Recent Letters'}
          </h3>
          {recentLetters.length > 0 ? (
            <div className="space-y-4">
              {recentLetters.map((letter, index) => (
                <div
                  key={letter._id || letter.id || index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <button 
                      onClick={() => navigate(`/outward-dashboard/track-application/${letter.referenceNumber}`)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate flex items-center gap-1"
                      title={language === 'mr' ? 'अर्जाचा मागोवा पहा' : 'Track application'}
                    >
                      {letter.referenceNumber || 'No Reference'}
                      <FiExternalLink className="h-3 w-3 flex-shrink-0" />
                    </button>
                    <p className="text-xs text-gray-500 truncate">
                      {letter.recipientDepartment || letter.recipientNameAndDesignation || 'No recipient'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {letter.createdAt ? new Date(letter.createdAt).toLocaleDateString() : ''}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Status badge */}
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      letter.letterStatus?.toLowerCase().includes('dispatched')
                        ? 'bg-green-100 text-green-800'
                        : letter.letterStatus?.toLowerCase().includes('pending')
                        ? 'bg-orange-100 text-orange-800'
                        : letter.letterStatus?.toLowerCase().includes('approved')
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {letter.letterStatus || 'Unknown'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-500">
              <div className="text-center">
                <FiFileText className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">
                  {language === 'mr' ? 'अलीकडील पत्रे नाहीत' : 'No recent letters'}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mt-8 border border-blue-100"
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {language === 'mr' ? 'द्रुत क्रियाकलाप' : 'Quick Actions'}
        </h3>
        <div className="flex justify-center space-x-4">
          <a
            href="/outward-dashboard/outward-letters"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            <FiFileText className="mr-2 h-5 w-5" />
            {language === 'mr' ? 'जावक पत्रे पहा' : 'View Outward Letters'}
          </a>
          <a
            href="/outward-dashboard/track-application"
            className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
          >
            <FiEye className="mr-2 h-5 w-5" />
            {language === 'mr' ? 'अर्ज ट्रॅक करा' : 'Track Application'}
          </a>
        </div>
      </motion.div>
    </div>
  );
};

export default OutwardDashboard; 