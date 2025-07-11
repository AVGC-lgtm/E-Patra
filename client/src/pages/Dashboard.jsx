import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { FiMail, FiFileText, FiClock, FiChevronUp, FiChevronDown, FiRefreshCw } from 'react-icons/fi';
import { motion } from 'framer-motion';

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

const Dashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [patras, setPatras] = useState([]);
  const [stats, setStats] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [letterData, setLetterData] = useState([]);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('thisMonth');
  // Colors for different statuses in the pie chart
  const COLORS = ['#6366f1', '#10b981', '#ef4444']; // [pending, approved, rejected]

  const fetchPatras = useCallback(async () => {
    setIsLoading(true);
    try {
      // Add timestamp to prevent caching
      const response = await axios.get('http://localhost:5000/api/patras', {
        params: {
          _t: new Date().getTime() // Prevent caching
        }
      });
      
      console.log('API Response:', response.data); // Debug log
      
      if (response.data && Array.isArray(response.data)) {
        // Sort by createdAt in descending order (newest first)
        const sortedData = [...response.data].sort((a, b) => 
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        
        console.log('Sorted data:', sortedData); // Debug log
        setPatras(sortedData);
        processPatrasData(sortedData);
        setError(null);
      } else {
        console.error('Unexpected data format:', response.data);
        setError('Unexpected data format received from server');
      }
    } catch (err) {
      console.error('Error fetching patras:', err);
      setError('Failed to load patras data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const processPatrasData = (patrasData) => {
    if (!Array.isArray(patrasData)) {
      console.error('Invalid data format received:', patrasData);
      setError('Invalid data format received from server');
      return;
    }

    // Calculate stats
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day
    
    // Debug: Log today's date
    console.log('Today (start of day):', today.toISOString());
    
    const todayCount = patrasData.filter(p => {
      if (!p.createdAt) return false;
      
      const letterDate = new Date(p.createdAt);
      letterDate.setHours(0, 0, 0, 0); // Set to start of day for comparison
      
      // Debug: Log each letter's date
      console.log('Letter date:', letterDate.toISOString(), 'Created at:', p.createdAt);
      
      return letterDate.getTime() === today.getTime();
    }).length;
    
    // Debug: Log all unique statuses in the data
    const allStatuses = [...new Set(patrasData.map(p => p.letterStatus))];
    console.log('All letter statuses in data:', allStatuses);
    
    // Normalize status to handle different cases or formats
    const getNormalizedStatus = (status) => {
      if (!status) return 'unknown';
      const lowerStatus = status.toLowerCase().trim();
      if (lowerStatus.includes('pending')) return 'pending';
      if (lowerStatus.includes('approv') || lowerStatus === 'processed') return 'approved';
      if (lowerStatus.includes('reject')) return 'rejected';
      return lowerStatus;
    };
    
    // Count letters by status
    const statusCounts = patrasData.reduce((acc, p) => {
      const status = getNormalizedStatus(p.letterStatus);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('Status counts:', statusCounts);
    
    const pendingCount = statusCounts['pending'] || 0;
    const approvedCount = statusCounts['approved'] || 0;
    const rejectedCount = statusCounts['rejected'] || 0;
    
    // Update stats
    setStats([
      {
        title: "Today's Letters",
        value: todayCount.toString(),
        change: "",
        icon: <FiMail />,
        color: "indigo",
      },
      {
        title: "Total Letters",
        value: patrasData.length.toString(),
        change: "",
        icon: <FiFileText />,
        color: "green",
      },
      {
        title: "Pending Approval",
        value: pendingCount.toString(),
        change: "",
        icon: <FiClock />,
        color: "amber",
      },
    ]);

    // Process pie chart data
    const pieChartData = [
      { name: 'Pending', value: pendingCount },
      { name: 'Approved', value: approvedCount },
      { name: 'Rejected', value: rejectedCount }
    ].filter(item => item.value > 0); // Only show slices with values > 0
    
    console.log('Pie chart data:', {
      rawData: { pendingCount, approvedCount, rejectedCount },
      filteredData: [...pieChartData]
    });
    
    setPieData(pieChartData.length > 0 ? pieChartData : [{ name: 'No Data', value: 1 }]);

    // Process recent activity
    const sortedPatras = [...patrasData]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 4);

    const activity = sortedPatras.map((patra, index) => ({
      id: patra.id,
      type: patra.letterStatus === 'pending' ? 'alert' : 'update',
      title: `${patra.letterType} - ${patra.referenceNumber}`,
      time: new Date(patra.createdAt).toLocaleDateString(),
      user: patra.recipientNameAndDesignation || 'Unknown',
    }));
    setRecentActivity(activity);
    
    // Process data for bar chart (last 6 months)
    const lastSixMonths = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentDate = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(currentDate.getMonth() - i);
      const month = date.getMonth();
      const year = date.getFullYear();
      
      const monthCount = patrasData.filter(p => {
        const patraDate = new Date(p.createdAt);
        return patraDate.getMonth() === month && patraDate.getFullYear() === year;
      }).length;
      
      lastSixMonths.push({
        name: monthNames[month],
        letters: monthCount,
        trend: i > 0 && lastSixMonths[lastSixMonths.length - 1]?.letters < monthCount ? 'up' : 'down'
      });
    }
    
    setLetterData(lastSixMonths);
  };

  useEffect(() => {
    fetchPatras();
  }, [fetchPatras]);

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
              <p className="text-sm text-red-700">
                {error}
              </p>
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
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
          Dashboard Overview
        </h1>
        <p className="text-gray-500 mt-1">Welcome back! Here's what's happening with your letters.</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Pie Chart */}
        <motion.div 
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Letter Status</h3>
            <select 
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="thisYear">This Year</option>
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={pieData.length > 1 ? 5 : 0}
                  dataKey="value"
                  label={({ name, value, percent }) => {
                    const total = pieData.reduce((sum, item) => sum + item.value, 0);
                    const displayPercent = total > 0 ? (value / total) * 100 : 0;
                    return total > 0 ? `${Math.round(displayPercent)}%` : '';
                  }}
                  labelLine={false}
                  isAnimationActive={false}

                >
                  {pieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name, props) => {
                    const total = pieData.reduce((sum, item) => sum + item.value, 0);
                    const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return [`${value} ${name} (${percent}%)`, ''];
                  }}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    padding: '0.75rem 1rem',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                />
                <Legend 
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{
                    paddingTop: '1.5rem',
                    fontSize: '0.75rem',
                    fontWeight: '500'
                  }}
                  formatter={(value, entry, index) => (
                    <span className="text-gray-600">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Bar Chart */}
        <motion.div 
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Letters Overview</h3>
            <div className="flex space-x-2">
              <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                <option>Last 6 Months</option>
                <option>This Year</option>
                <option>Last Year</option>
              </select>
              <button className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <FiRefreshCw className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={letterData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 0,
                  bottom: 5,
                }}
              >
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                  tickMargin={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                  width={30}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    padding: '0.75rem 1rem',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                  labelStyle={{ 
                    color: '#111827',
                    fontWeight: '600',
                    marginBottom: '0.25rem'
                  }}
                  formatter={(value) => [`${value} letters`, 'Count']}
                  separator=": "
                />
                <Bar 
                  dataKey="letters" 
                  radius={[4, 4, 0, 0]}
                  barSize={28}
                >
                  {letterData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.trend === 'up' ? 'url(#barGradient)' : '#e0e7ff'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div 
        className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-800">Recent Activity</h3>
          <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View All</button>
        </div>
        <div className="space-y-4">
          {recentActivity.map((activity, index) => (
            <motion.div 
              key={activity.id}
              className="flex items-start p-3 rounded-lg hover:bg-gray-50 transition-colors"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + (index * 0.05) }}
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
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;