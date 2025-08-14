import React, { useState, useEffect, useCallback } from 'react';
import { FiTrendingUp, FiTrendingDown, FiFileText, FiCheckCircle, FiXCircle, FiClock, FiSend, FiUsers, FiCheckCircle as FiSigned } from 'react-icons/fi';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import translations from '../translations';
const apiUrl = import.meta.env.VITE_API_URL ;

// Stat Card Component matching the SP dashboard design
const StatCard = ({ title, value, subtitle, icon, color }) => {
  const { language } = useLanguage();
  
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-full ${color} shadow-md`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const HeadDashboard = () => {
  const { language } = useLanguage();
  const t = translations[language] || translations['en'];
  

  const [patras, setPatras] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('thisMonth');
  const [timeFilter, setTimeFilter] = useState('daily'); // 'daily' or 'monthly'
  const [tableDistribution, setTableDistribution] = useState([]);
  
  // Colors for different statuses in the pie chart
  const COLORS = ['#6366f1', '#10b981', '#ef4444']; // [pending, approved, rejected]

  // Helper function to get source table name
  const getSourceTableName = (letter) => {
    if (letter.sentTo) {
      try {
        const sentToData = JSON.parse(letter.sentTo);
        if (sentToData.sourceTable) {
          return sentToData.sourceTable;
        }
        if (sentToData.sendToData) {
          const sendToDataObj = sentToData.sendToData;
          if (sendToDataObj.sp) return language === 'mr' ? 'एसपी टेबल' : 'SP Table';
          if (sendToDataObj.collector) return language === 'mr' ? 'कलेक्टर टेबल' : 'Collector Table';
          if (sendToDataObj.home) return language === 'mr' ? 'होम टेबल' : 'Home Table';
          if (sendToDataObj.ig) return language === 'mr' ? 'आयजी टेबल' : 'IG Table';
          if (sendToDataObj.shanik) return language === 'mr' ? 'शाणिक टेबल' : 'Shanik Table';
          if (sendToDataObj.dg) return language === 'mr' ? 'डीजी टेबल' : 'DG Table';
        }
      } catch (e) {
        console.log('Error parsing sentTo data:', e);
      }
    }
    
    if (letter.forwardTo) {
      const forwardTo = letter.forwardTo.toLowerCase();
      switch (forwardTo) {
        case 'sp': return language === 'mr' ? 'एसपी टेबल' : 'SP Table';
        case 'dm': return language === 'mr' ? 'डीएम टेबल' : 'DM Table';
        case 'collector': return language === 'mr' ? 'डीएम टेबल' : 'DM Table';  // Map collector to DM
        case 'home': return language === 'mr' ? 'होम टेबल' : 'Home Table';
        case 'ig': case 'ig_nashik': return language === 'mr' ? 'आयजी टेबल' : 'IG Table';
        case 'shanik': case 'shanik_local': return language === 'mr' ? 'शाणिक टेबल' : 'Shanik Table';
        case 'dg': case 'dg_other': return language === 'mr' ? 'डीजी टेबल' : 'DG Table';
        case 'inward': case 'inward_user': return language === 'mr' ? 'इनवर्ड टेबल' : 'Inward Table';
        default: return language === 'mr' ? 'अज्ञात टेबल' : 'Unknown Table';
      }
    }
    
    return language === 'mr' ? 'अज्ञात टेबल' : 'Unknown Table';
  };

  // Calculate table distribution for pie chart
  const calculateTableDistribution = (lettersData) => {
    const tableCounts = {};
    const now = new Date();
    
    console.log('=== HEAD DASHBOARD TABLE DISTRIBUTION DEBUG ===');
    console.log('Total letters received:', lettersData.length);
    console.log('Current time filter:', timeFilter);
    console.log('Current date:', now.toISOString());
    
    // TEMPORARILY DISABLE TIME FILTERING TO SEE ALL LETTERS
    const filteredLetters = lettersData; // Show all letters for now
    
    console.log('Filtered letters (all letters):', filteredLetters.length);
    console.log('Sample letters:', filteredLetters.slice(0, 3).map(l => ({
      id: l.id,
      forwardTo: l.forwardTo,
      createdAt: l.createdAt,
      letterStatus: l.letterStatus
    })));
    
    filteredLetters.forEach(letter => {
      console.log('Processing letter:', {
        id: letter.id,
        forwardTo: letter.forwardTo,
        sentTo: letter.sentTo,
        letterStatus: letter.letterStatus,
        createdAt: letter.createdAt
      });
      
      const tableName = getSourceTableName(letter);
      console.log('Table name for letter:', tableName);
      
      if (tableName) {
        tableCounts[tableName] = (tableCounts[tableName] || 0) + 1;
      }
    });
    
    console.log('Final table counts:', tableCounts);
    console.log('=== END HEAD DASHBOARD DEBUG ===');
    
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
      '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'
    ];
    
    return Object.entries(tableCounts).map(([table, count], index) => ({
      name: table,
      value: count,
      color: colors[index % colors.length]
    }));
  };

  const fetchPatras = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const config = token ? {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          _t: new Date().getTime() // Prevent caching
        }
      } : {
        params: {
          _t: new Date().getTime() // Prevent caching
        }
      };
      
      // Use the specific Head letters endpoint for accurate data
      const response = await axios.get(`${apiUrl}/api/patras/head`, config);
      
      console.log('Head Dashboard - API Response:', response.data);
      
      // Handle the new API response structure: {message, count, patras: [...], ...}
      let patrasData = [];
      if (
        response.data &&
        response.data.data &&
        Array.isArray(response.data.data.patras)
      ) {
        patrasData = response.data.data.patras;
        console.log('Head Dashboard - Using patras array from response.data.data:', patrasData);
      } else if (response.data && Array.isArray(response.data.patras)) {
        patrasData = response.data.patras;
        console.log('Head Dashboard - Using patras array from response.data:', patrasData);
      } else if (response.data && Array.isArray(response.data)) {
        patrasData = response.data;
        console.log('Head Dashboard - Using direct array response:', patrasData);
      } else {
        // Try to extract from nested data (for paginated or wrapped responses)
        if (response.data && typeof response.data === 'object') {
          // Try to find the first array property
          const arrayProp = Object.values(response.data).find(v => Array.isArray(v));
          if (arrayProp) {
            patrasData = arrayProp;
            console.log('Head Dashboard - Using first array property from response:', patrasData);
          } else {
            console.error('Head Dashboard - Unexpected data format:', response.data);
            setError('Unexpected data format received from server');
            setPatras([]);
            return;
          }
        } else {
          console.error('Head Dashboard - Unexpected data format:', response.data);
          setError('Unexpected data format received from server');
          setPatras([]);
          return;
        }
      }
      
      // Sort by createdAt in descending order (newest first)
      const sortedData = [...patrasData].sort((a, b) => 
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      
      console.log('Head Dashboard - Sorted data:', sortedData);
      setPatras(sortedData);
      setError(null);
      
      // Calculate table distribution
      setTableDistribution(calculateTableDistribution(sortedData));
    } catch (err) {
      console.error('Head Dashboard - Error fetching patras:', err);
      
      // Handle authentication errors
      if (err.response?.status === 401) {
        setError('Authentication failed. Please login again.');
        sessionStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }
      
      setError('Failed to load patras data. Please try again later.');
      setPatras([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Recalculate table distribution when time filter changes
  useEffect(() => {
    if (patras.length > 0) {
      setTableDistribution(calculateTableDistribution(patras));
    }
  }, [timeFilter, patras]);

  useEffect(() => {
    fetchPatras();
    
    // Set up auto-refresh every 30 seconds to keep counts updated
    const interval = setInterval(() => {
      fetchPatras();
    }, 30000); // 30 seconds
    
    // Listen for custom events when letters are sent to Head
    const handleLetterSentToHead = () => {
      console.log('Head Dashboard: Letter sent to Head detected, refreshing data...');
      fetchPatras();
    };
    
    // Add event listener for letter sent to Head
    window.addEventListener('letter-sent-to-head', handleLetterSentToHead);
    
    // Cleanup interval and event listener on component unmount
    return () => {
      clearInterval(interval);
      window.removeEventListener('letter-sent-to-head', handleLetterSentToHead);
    };
  }, [fetchPatras]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {language === 'mr' ? 'त्रुटी आढळली' : 'Error Occurred'}
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchPatras}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {language === 'mr' ? 'पुन्हा प्रयत्न करा' : 'Try Again'}
          </button>
        </div>
      </div>
    );
  }

  // Calculate stats for display
  const getNormalizedStatus = (status) => {
    if (!status) return 'unknown';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('pending') || statusLower.includes('प्रलंबित')) return 'pending';
    if (statusLower.includes('approved') || statusLower.includes('मंजूर')) return 'approved';
    if (statusLower.includes('rejected') || statusLower.includes('नाकारले')) return 'rejected';
    if (statusLower.includes('sent to head') || statusLower.includes('प्रमुखांकडे पाठवले')) return 'sent_to_head';
    if (statusLower.includes('case close') || statusLower.includes('केस बंद') || statusLower.includes('closed')) return 'closed';
    return 'other';
  };

  const headRelevantLetters = patras.filter(p => {
    const status = getNormalizedStatus(p.letterStatus);
    return ['sent_to_head', 'pending', 'approved', 'rejected', 'closed'].includes(status);
  });

  const pendingCount = headRelevantLetters.filter(p => 
    getNormalizedStatus(p.letterStatus) === 'pending'
  ).length;

  const approvedCount = headRelevantLetters.filter(p => 
    getNormalizedStatus(p.letterStatus) === 'approved'
  ).length;

  const rejectedCount = headRelevantLetters.filter(p => 
    getNormalizedStatus(p.letterStatus) === 'rejected'
  ).length;

  const sentToHeadCount = headRelevantLetters.filter(p => 
    getNormalizedStatus(p.letterStatus) === 'sent_to_head'
  ).length;

  // Calculate closed cases count
  const closedCasesCount = headRelevantLetters.filter(p => 
    getNormalizedStatus(p.letterStatus) === 'closed'
  ).length;

  // Calculate signed letters count
  const signedLettersCount = headRelevantLetters.filter(p => {
    return p.coveringLetter && p.coveringLetter.isSigned === true;
  }).length;

  // Calculate today's letters
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = headRelevantLetters.filter(p => {
    if (!p.createdAt) return false;
    const letterDate = new Date(p.createdAt);
    letterDate.setHours(0, 0, 0, 0);
    return letterDate.getTime() === today.getTime();
  }).length;

  // Simple Pie Chart Component
  const SimplePieChart = ({ data, title }) => {
    if (!data || data.length === 0) {
      return (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
          <div className="flex items-center justify-center h-48 text-gray-500">
            <div className="text-center">
              <FiFileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">{language === 'mr' ? 'डेटा उपलब्ध नाही' : 'No data available'}</p>
            </div>
          </div>
        </div>
      );
    }

    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center mb-8">
          <div className="relative w-72 h-72 transform hover:scale-105 transition-transform duration-300">
            <div
              className="w-full h-full rounded-full shadow-lg"
              style={{
                background: `conic-gradient(${data.map((item, index) => {
                  const startPercentage = data.slice(0, index).reduce((sum, d) => sum + (d.value / total) * 100, 0);
                  const endPercentage = startPercentage + (item.value / total) * 100;
                  return `${item.color} ${startPercentage}% ${endPercentage}%`;
                }).join(', ')})`,
                filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1))'
              }}
            />
            <div className="absolute inset-8 bg-white rounded-full flex items-center justify-center shadow-inner">
              <div className="text-center">
                <span className="text-4xl font-bold text-gray-800 block">{total}</span>
                <span className="text-sm text-gray-500 mt-1">{language === 'mr' ? 'एकूण अर्ज' : 'Total Letters'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200">
            <h4 className="text-sm font-semibold text-gray-800">
              {language === 'mr' ? 'तक्ता वितरण तपशील' : 'Table Distribution Details'}
            </h4>
          </div>
          <div className="bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'तक्ता' : 'Table'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'संख्या' : 'Count'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'टक्केवारी' : 'Percentage'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((item, index) => {
                  const total = data.reduce((sum, d) => sum + d.value, 0);
                  const percentage = ((item.value / total) * 100).toFixed(1);
                  return (
                    <tr key={index} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div 
                            className="w-4 h-4 rounded-full mr-3 shadow-sm"
                            style={{ backgroundColor: item.color }}
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-500">
                              {language === 'mr' ? 'जावक अर्ज' : 'Outward Letters'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {item.value}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="h-2 rounded-full transition-all duration-500"
                              style={{ 
                                backgroundColor: item.color, 
                                width: `${percentage}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900">{percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {language === 'mr' ? 'एकूण तक्ते:' : 'Total Tables:'} <span className="font-medium">{data.length}</span>
              </span>
              <span className="text-gray-600">
                {language === 'mr' ? 'एकूण अर्ज:' : 'Total Letters:'} <span className="font-medium">{data.reduce((sum, item) => sum + item.value, 0)}</span>
              </span>
            </div>
          </div>
        </div>
        
        {/* Month-wise Bar Chart */}
        <div className="mt-8">
          <MonthlyBarChart data={data} />
        </div>
      </div>
    );
  };

  // Monthly Vertical Bar Chart Component
  const MonthlyBarChart = ({ data }) => {
    // Generate month-wise data from the patras
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

      // Count letters by month from patras data
      patras.forEach(letter => {
        if (letter.createdAt) {
          const date = new Date(letter.createdAt);
          const monthIndex = date.getMonth();
          const monthName = months[monthIndex];
          monthCounts[monthName]++;
        }
      });

      // Convert to array format with colors
      const colors = [
        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
        '#8B5CF6', '#06B6D4', '#84CC16', '#F97316',
        '#EC4899', '#6366F1', '#14B8A6', '#F43F5E'
      ];

      return months.map((month, index) => ({
        month: language === 'mr' ? monthsMarathi[index] : month,
        count: monthCounts[month],
        color: colors[index]
      }));
    };

    const monthlyData = getMonthlyData();
    const maxCount = Math.max(...monthlyData.map(item => item.count)) || 10; // Default to 10 for scale
    
    // Generate Y-axis scale marks
    const getYAxisMarks = () => {
      const marks = [];
      const step = Math.ceil(maxCount / 5); // 5 marks
      for (let i = 0; i <= maxCount + step; i += step) {
        marks.push(i);
      }
      return marks.reverse();
    };

    const yAxisMarks = getYAxisMarks();

    return (
      <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 w-full">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              {language === 'mr' ? 'मासिक पत्र वितरण' : 'Monthly Letter Distribution'}
            </h3>
            <p className="text-base text-gray-600 mt-2">
              {language === 'mr' ? 'वर्ष 2025 - संपूर्ण वार्षिक विश्लेषण' : 'Year 2025 - Complete Annual Analysis'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">
              {monthlyData.reduce((sum, item) => sum + item.count, 0)}
            </div>
            <div className="text-base text-gray-500">
              {language === 'mr' ? 'एकूण अर्ज' : 'Total Letters'}
            </div>
          </div>
        </div>
        
        {/* Chart Container - Full Width */}
        <div className="relative w-full">
          {/* Y-axis and Grid */}
          <div className="flex w-full">
            {/* Y-axis labels */}
            <div className="flex flex-col justify-between h-[500px] w-16 mr-6">
              {yAxisMarks.map((mark, index) => (
                <div key={index} className="text-sm text-gray-500 text-right font-medium">
                  {mark}
                </div>
              ))}
            </div>
            
            {/* Chart area - Takes remaining full width */}
            <div className="flex-1 relative">
              {/* Horizontal grid lines */}
              <div className="absolute inset-0">
                {yAxisMarks.map((mark, index) => (
                  <div 
                    key={index}
                    className="absolute w-full border-t border-gray-200 border-dashed"
                    style={{ top: `${(index / (yAxisMarks.length - 1)) * 100}%` }}
                  />
                ))}
              </div>
              
              {/* Bars container - Full width with fixed heights */}
              <div className="relative h-[500px] flex items-end justify-between gap-2 px-1">
                {monthlyData.map((item, index) => {
                  const heightPercentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  const barHeight = Math.max((heightPercentage / 100) * 480, item.count > 0 ? 12 : 0); // 480px = 500px - padding for label
                  
                  return (
                    <div key={index} className="flex flex-col items-center group flex-1">
                      {/* Bar container with fixed positioning */}
                      <div className="relative flex items-end justify-center w-full h-full">
                        {/* Value label on top */}
                        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                          <div className="bg-gray-800 text-white text-sm px-3 py-1 rounded-lg shadow-lg whitespace-nowrap">
                            {item.count}
                          </div>
                        </div>
                        
                        {/* Bar - Fixed pixel height */}
                        <div 
                          className="w-full rounded-t-xl transition-all duration-1000 ease-out group-hover:brightness-110 group-hover:scale-105 relative cursor-pointer"
                          style={{ 
                            height: `${barHeight}px`,
                            background: `linear-gradient(to top, ${item.color} 0%, ${item.color}DD 50%, ${item.color}AA 100%)`,
                            boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                            minHeight: item.count > 0 ? '12px' : '0px'
                          }}
                        >
                          {/* Gloss effect */}
                          <div 
                            className="absolute top-0 left-0 w-full h-1/3 rounded-t-xl opacity-20"
                            style={{ background: 'linear-gradient(to bottom, white 0%, transparent 100%)' }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Month labels - separate row */}
              <div className="flex items-center justify-between gap-2 px-1 mt-4">
                {monthlyData.map((item, index) => (
                  <div key={index} className="flex-1 flex justify-center">
                    <div className="text-base font-semibold text-gray-700 text-center">
                      {item.month}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* X-axis line */}
          <div className="ml-22 mt-3 border-t-2 border-gray-300"></div>
        </div>
        
        {/* Chart Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {monthlyData.reduce((sum, item) => sum + item.count, 0)}
              </div>
              <div className="text-sm text-gray-600">
                {language === 'mr' ? 'एकूण अर्ज' : 'Total Letters'}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {maxCount}
              </div>
              <div className="text-sm text-gray-600">
                {language === 'mr' ? 'सर्वाधिक (मासिक)' : 'Peak (Monthly)'}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {(monthlyData.reduce((sum, item) => sum + item.count, 0) / 12).toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">
                {language === 'mr' ? 'सरासरी (मासिक)' : 'Average (Monthly)'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <div className="flex items-center space-x-6 mb-6">
            <div className="relative">
              <img 
                src="/web icon (1).png" 
                alt="ई-पत्र Logo" 
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shadow-xl border-4 border-blue-100 hover:scale-110 transition-all duration-300 hover:shadow-2xl"
              />
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">✓</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-blue-600 mb-2">
              {language === 'mr' ? 'प्रमुख डॅशबोर्ड' : 'Head Dashboard'}
            </h1>
          </div>
          <p className="text-gray-600">
            {language === 'mr' 
              ? 'प्रमुख टेबलला पाठवलेली अर्ज' 
              : 'Letters sent to Head table'}
          </p>
          <div className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-2">
            {language === 'mr' ? 'टेबल: प्रमुख' : 'Table: Head'}
          </div>
        </div>
        
        {/* Manual Refresh Button */}
        <button
          onClick={fetchPatras}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors text-sm"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
              {language === 'mr' ? 'लोड होत आहे...' : 'Loading...'}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {language === 'mr' ? 'रिफ्रेश करा' : 'Refresh'}
            </>
          )}
        </button>
      </div>

      {/* Stats Cards - Matching SP dashboard design with gradients */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <StatCard
          title={language === 'mr' ? 'आजची अर्ज' : 'Today\'s Letters'}
          value={todayCount}
          subtitle="Today"
          icon={<FiClock className="w-6 h-6 text-white" />}
          color="bg-gradient-to-br from-purple-400 to-purple-600"
        />
        <StatCard
          title={language === 'mr' ? 'एकूण अर्ज' : 'Total Letters'}
          value={headRelevantLetters.length}
          subtitle={`${headRelevantLetters.length} total`}
          icon={<FiFileText className="w-6 h-6 text-white" />}
          color="bg-gradient-to-br from-green-400 to-green-600"
        />
        <StatCard
          title={language === 'mr' ? 'पाठवले' : 'Sent'}
          value={sentToHeadCount}
          subtitle={`${sentToHeadCount}%`}
          icon={<FiSend className="w-6 h-6 text-white" />}
          color="bg-gradient-to-br from-blue-400 to-blue-600"
        />
        <StatCard
          title={language === 'mr' ? 'स्वाक्षरी पूर्ण' : 'Signed'}
          value={signedLettersCount}
          subtitle={`${signedLettersCount}%`}
          icon={<FiSigned className="w-6 h-6 text-white" />}
          color="bg-gradient-to-br from-emerald-400 to-emerald-600"
        />
        <StatCard
          title={language === 'mr' ? 'केस बंद' : 'Closed Cases'}
          value={closedCasesCount}
          subtitle={`${closedCasesCount} cases`}
          icon={<FiXCircle className="w-6 h-6 text-white" />}
          color="bg-gradient-to-br from-red-400 to-red-600"
        />
      </div>

    

      {/* Two Column Layout - Matching SP dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Section: Table Distribution Chart */}
        <SimplePieChart 
          data={tableDistribution}
          title={language === 'mr' ? 'टेबल वितरण' : 'Table Distribution'}
        />

        {/* Right Section: Recent Letters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {language === 'mr' ? 'अलीकडील अर्ज' : 'Recent Letters'}
          </h2>
          
          {headRelevantLetters.length > 0 ? (
            <div className="space-y-3">
              {headRelevantLetters.slice(0, 5).map((letter, index) => (
                <div key={letter._id || letter.id || index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <p className="font-medium text-gray-900 text-lg">
                      {letter.referenceNumber || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {letter.senderNameAndDesignation || letter.officeSendingLetter || 'No recipient'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {letter.createdAt ? new Date(letter.createdAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      getNormalizedStatus(letter.letterStatus) === 'pending' ? 'bg-gray-100 text-gray-800' :
                      getNormalizedStatus(letter.letterStatus) === 'approved' ? 'bg-green-100 text-green-800' :
                      getNormalizedStatus(letter.letterStatus) === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {letter.letterStatus ? 
                        letter.letterStatus.charAt(0).toUpperCase() + letter.letterStatus.slice(1) : 
                        'N/A'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FiFileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">
                {language === 'mr' 
                  ? 'कोणतीही अर्ज आढळली नाहीत' 
                  : 'No letters found'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HeadDashboard; 