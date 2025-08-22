import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { FiMail, FiFileText, FiClock, FiChevronUp, FiChevronDown, FiRefreshCw, FiTrendingUp, FiDownload } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { getAuthToken } from '../utils/auth';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
const apiUrl = import.meta.env.VITE_API_URL ;

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
  const [monthlyData, setMonthlyData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [error, setError] = useState(null);
  const [timeFilter, setTimeFilter] = useState('monthly'); // daily, monthly
  const [isMobile, setIsMobile] = useState(false);
  const [downloadingLetters, setDownloadingLetters] = useState(new Set());
  const { language } = useLanguage();

  // Colors for different tables in the pie chart
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

  const fetchMyLetters = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        setError(language === 'mr' ? 'कृपया लॉगिन करा' : 'Please login first');
        return;
      }

      // Get user ID from token
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      const userId = tokenData.id || tokenData.userId;

      const response = await axios.get(`${apiUrl}/api/patras/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
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
      
      // Sort by createdAt in descending order (newest first)
      const sortedData = [...lettersData].sort((a, b) => 
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      
      console.log('User letters:', sortedData);
      setMyLetters(sortedData);
      processLettersData(sortedData);
      setError(null);
    } catch (err) {
      console.error('Error fetching letters:', err);
      setError(language === 'mr' ? 'अर्ज लोड करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.' : 'Failed to load letters. Please try again.');
      setMyLetters([]);
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  // Helper function to get source table name - simplified to only return Inward Table
  const getSourceTableName = (letter) => {
    // All letters are now inward letters
    return language === 'mr' ? 'इनवर्ड टेबल' : 'Inward Table';
  };

  // Calculate monthly data for bar chart
  const getMonthlyData = (lettersData) => {
    const monthCounts = {};
    const monthNames = language === 'mr' 
      ? ['जाने', 'फेब्रु', 'मार्च', 'एप्रि', 'मे', 'जून', 'जुलै', 'ऑग', 'सप्टें', 'ऑक्टो', 'नोव्हें', 'डिसें']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Initialize all months with 0
    monthNames.forEach((month, index) => {
      monthCounts[month] = 0;
    });
    
    // Count letters by month
    lettersData.forEach(letter => {
      if (letter.createdAt) {
        const letterDate = new Date(letter.createdAt);
        const monthIndex = letterDate.getMonth();
        const monthName = monthNames[monthIndex];
        monthCounts[monthName]++;
      }
    });
    
    return Object.entries(monthCounts).map(([month, count]) => ({
      month,
      count
    }));
  };

  // Calculate table distribution for pie chart
  const calculateTableDistribution = (lettersData) => {
    const tableCounts = {};
    const now = new Date();
    
    console.log('=== TABLE DISTRIBUTION DEBUG ===');
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
    console.log('=== END DEBUG ===');
    
    return Object.entries(tableCounts).map(([table, count], index) => ({
      name: table,
      value: count,
      color: COLORS[index % COLORS.length]
    }));
  };

  // Function to download both covering letter and uploaded file together
  const downloadLetterWithAttachments = async (letter) => {
    if (downloadingLetters.has(letter.id)) return;
    
    setDownloadingLetters(prev => new Set(prev).add(letter.id));
    
    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        toast.error(language === 'mr' ? 'कृपया लॉगिन करा' : 'Please login first');
        return;
      }

      // Get covering letter data
      let coveringLetterUrl = null;
      let uploadedFileUrl = null;

      // Get covering letter URL
      if (letter.coveringLetter) {
        if (letter.coveringLetter.wordUrl) {
          coveringLetterUrl = letter.coveringLetter.wordUrl;
        } else if (letter.coveringLetter.pdfUrl) {
          coveringLetterUrl = letter.coveringLetter.pdfUrl;
        }
      }

      // Get uploaded file URL
      if (letter.uploadedFile) {
        uploadedFileUrl = letter.uploadedFile.fileUrl;
      }

      // Download both files separately
      if (coveringLetterUrl && uploadedFileUrl) {
        // Download covering letter first
        const coveringLetterResponse = await fetch(`${apiUrl}/api/files/proxy-download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            fileUrl: coveringLetterUrl,
            fileName: `CoveringLetter_${letter.referenceNumber}`
          })
        });

        if (!coveringLetterResponse.ok) {
          throw new Error('Failed to download covering letter');
        }

        // Download uploaded file second
        const uploadedFileResponse = await fetch(`${apiUrl}/api/files/proxy-download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            fileUrl: uploadedFileUrl,
            fileName: letter.uploadedFile?.originalName || `UploadedFile_${letter.referenceNumber}`
          })
        });

        if (!uploadedFileResponse.ok) {
          throw new Error('Failed to download uploaded file');
        }

        // Download both files separately
        const coveringLetterBlob = await coveringLetterResponse.blob();
        const uploadedFileBlob = await uploadedFileResponse.blob();

        // Download covering letter
        const coveringLetterExt = coveringLetterUrl.includes('.docx') ? '.docx' : '.pdf';
        const coveringLetterUrl2 = URL.createObjectURL(coveringLetterBlob);
        const coveringLetterLink = document.createElement('a');
        coveringLetterLink.href = coveringLetterUrl2;
        coveringLetterLink.download = `CoveringLetter_${letter.referenceNumber}${coveringLetterExt}`;
        document.body.appendChild(coveringLetterLink);
        coveringLetterLink.click();
        document.body.removeChild(coveringLetterLink);
        URL.revokeObjectURL(coveringLetterUrl2);

        // Download uploaded file
        const uploadedFileUrl2 = URL.createObjectURL(uploadedFileBlob);
        const uploadedFileLink = document.createElement('a');
        uploadedFileLink.href = uploadedFileUrl2;
        uploadedFileLink.download = letter.uploadedFile?.originalName || `UploadedFile_${letter.referenceNumber}`;
        document.body.appendChild(uploadedFileLink);
        uploadedFileLink.click();
        document.body.removeChild(uploadedFileLink);
        URL.revokeObjectURL(uploadedFileUrl2);

        toast.success(language === 'mr' ? 'दोन्ही फाईल्स वेगळ्या वेगळ्या डाउनलोड झाल्या' : 'Both files downloaded separately');
      } else if (coveringLetterUrl) {
        // Only covering letter available
        const response = await fetch(`${apiUrl}/api/files/proxy-download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            fileUrl: coveringLetterUrl,
            fileName: `CoveringLetter_${letter.referenceNumber}`
          })
        });

        if (!response.ok) {
          throw new Error('Failed to download covering letter');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `CoveringLetter_${letter.referenceNumber}${coveringLetterUrl.includes('.docx') ? '.docx' : '.pdf'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast.success(language === 'mr' ? 'कव्हरिंग लेटर डाउनलोड झाले' : 'Covering letter downloaded successfully');
      } else if (uploadedFileUrl) {
        // Only uploaded file available
        const response = await fetch(`${apiUrl}/api/files/proxy-download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            fileUrl: uploadedFileUrl,
            fileName: letter.uploadedFile?.originalName || `UploadedFile_${letter.referenceNumber}`
          })
        });

        if (!response.ok) {
          throw new Error('Failed to download uploaded file');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = letter.uploadedFile?.originalName || `UploadedFile_${letter.referenceNumber}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast.success(language === 'mr' ? 'अपलोड केलेली फाईल डाउनलोड झाली' : 'Uploaded file downloaded successfully');
      } else {
        toast.warning(language === 'mr' ? 'कोणतीही फाईल उपलब्ध नाही' : 'No files available for download');
      }
    } catch (error) {
      console.error('Error downloading files:', error);
      toast.error(language === 'mr' ? 'फाईल्स डाउनलोड करण्यात अयशस्वी' : 'Failed to download files');
    } finally {
      setDownloadingLetters(prev => {
        const newSet = new Set(prev);
        newSet.delete(letter.id);
        return newSet;
      });
    }
  };

  // Process recent activity with download functionality
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
    
    // Calculate average letters per day
    let averagePerDay = 0;
    if (lettersData.length > 0) {
      // Get date range from first to last letter
      const dates = lettersData
        .filter(p => p.createdAt)
        .map(p => new Date(p.createdAt))
        .sort((a, b) => a - b);
      
      if (dates.length > 0) {
        const firstDate = dates[0];
        const lastDate = dates[dates.length - 1];
        const daysDifference = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1);
        averagePerDay = Math.round((lettersData.length / daysDifference) * 10) / 10; // Round to 1 decimal
      }
    }
    
    // Update stats with proper change indicators
    setStats([
      {
        title: language === 'mr' ? "आजचे अर्ज" : "Today's Letters",
        value: todayCount.toString(),
        change: "100%",
        icon: <FiMail />,
        color: "indigo",
      },
      {
        title: language === 'mr' ? "एकूण अर्ज" : "Total Letters",
        value: lettersData.length.toString(),
        change: "100%",
        icon: <FiFileText />,
        color: "green",
      },
      {
        title: language === 'mr' ? "दैनिक सरासरी अर्ज " : "Average Letters by Day",
        value: averagePerDay.toString(),
        change: averagePerDay > 0 ? `${averagePerDay}/day` : "No data",
        icon: <FiTrendingUp />,
        color: "amber",
      },
    ]);

    // Process pie chart data - Table Distribution
    const tableDistribution = calculateTableDistribution(lettersData);
    setPieData(tableDistribution.length > 0 ? tableDistribution : [{ name: language === 'mr' ? 'डेटा नाही' : 'No Data', value: 1 }]);

    // Process recent activity with download info
    const sortedLetters = [...lettersData]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 4);

    const activity = sortedLetters.map((letter, index) => ({
      id: letter.id || letter._id,
      type: letter.letterStatus === 'pending' ? 'alert' : 'update',
      title: `${letter.letterType || 'Letter'} - ${letter.referenceNumber}`,
      time: new Date(letter.createdAt).toLocaleDateString(),
      user: letter.recipientNameAndDesignation || (language === 'mr' ? 'अज्ञात' : 'Unknown'),
      letter: letter, // Store the full letter object for download
      hasFiles: !!(letter.coveringLetter || letter.uploadedFile)
    }));
    setRecentActivity(activity);
    
    // Process monthly data for bar chart
    const monthlyChartData = getMonthlyData(lettersData);
    setMonthlyData(monthlyChartData);
  };

  useEffect(() => {
    fetchMyLetters();
  }, [fetchMyLetters]);

  // Detect mobile screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Re-process pie chart data when timeFilter changes
  useEffect(() => {
    if (myLetters.length > 0) {
      const tableDistribution = calculateTableDistribution(myLetters);
      setPieData(tableDistribution.length > 0 ? tableDistribution : [{ name: language === 'mr' ? 'डेटा नाही' : 'No Data', value: 1 }]);
    }
  }, [timeFilter, myLetters, language]);

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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
        <motion.div 
          className="mb-8 sm:mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center space-x-6 mb-6">
            <div className="relative">
              <img 
                src="/web icon (1).png" 
                alt="ई-अर्ज Logo" 
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shadow-xl border-4 border-blue-100 hover:scale-110 transition-all duration-300 hover:shadow-2xl"
              />
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">✓</span>
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              ई-अर्ज
            </h1>
          </div>
          <p className="text-gray-500 mt-2 text-sm sm:text-base">
            {language === 'mr' ? 'तुमच्या अर्जांचे विश्लेषण' : 'Overview of your letters and submissions'}
          </p>
        </motion.div>
        
        {/* Stats Cards */}
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12"
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
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-12">
        
          {/* Pie Chart */}
          <motion.div 
            className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3 sm:gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                {language === 'mr' ? 'टेबल वितरण' : 'Table Distribution'}
              </h3>
          </div>
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
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
          
            {/* Table Distribution Details */}
            <div className="mt-4 sm:mt-6">
              <h4 className="text-sm sm:text-md font-semibold text-gray-700 mb-3 sm:mb-4">
                {language === 'mr' ? 'तक्ता वितरण तपशील' : 'Table Distribution Details'}
              </h4>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 border-b border-gray-200">
                          {language === 'mr' ? 'टेबल' : 'Table'}
                        </th>
                        <th className="text-center py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 border-b border-gray-200">
                          {language === 'mr' ? 'संख्या' : 'Count'}
                        </th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 border-b border-gray-200">
                          {language === 'mr' ? 'टक्केवारी' : 'Percentage'}
                        </th>
                      </tr>
                    </thead>
                <tbody>
                  {pieData.length > 0 && pieData[0].name !== (language === 'mr' ? 'डेटा नाही' : 'No Data') ? (
                    (() => {
                      const totalCount = pieData.reduce((sum, item) => sum + item.value, 0);
                      return pieData.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50 transition-colors">
                            <td className="py-2 sm:py-3 px-2 sm:px-4 border-b border-gray-100">
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div 
                                  className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }}
                                ></div>
                                <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">{item.name}</span>
                              </div>
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-center border-b border-gray-100">
                              <span className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 text-blue-800 rounded-full text-xs sm:text-sm font-semibold">
                                {item.value}
                              </span>
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-right border-b border-gray-100">
                            <div className="flex items-center justify-end gap-2">
                              <div className="flex-1 max-w-[80px] bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="h-full rounded-full transition-all duration-300" 
                                  style={{ 
                                    backgroundColor: item.color || COLORS[index % COLORS.length],
                                    width: `${((item.value / totalCount) * 100).toFixed(1)}%`
                                  }}
                                ></div>
                              </div>
                              <span className="font-semibold text-gray-700 min-w-[45px]">
                                {((item.value / totalCount) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ));
                    })()
                  ) : (
                    <tr>
                      <td colSpan="3" className="py-8 text-center text-gray-500">
                        {language === 'mr' ? 'कोणताही डेटा उपलब्ध नाही' : 'No data available'}
                      </td>
                    </tr>
                  )}
                </tbody>
                {pieData.length > 0 && pieData[0].name !== (language === 'mr' ? 'डेटा नाही' : 'No Data') && (
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td className="py-3 px-4 font-semibold text-gray-800">
                        {language === 'mr' ? 'एकूण अर्ज:' : 'Total Letters:'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-green-100 text-green-800 rounded-full text-sm font-bold">
                          {pieData.reduce((sum, item) => sum + item.value, 0)}
                        </span>
                      </td>
                    
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </motion.div>

          {/* Monthly Bar Chart */}
          <motion.div 
            className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 pb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                {language === 'mr' ? 'मासिक अर्ज संख्या' : 'Monthly Letter Count'}
              </h3>
            </div>
            
            <div className="h-72 sm:h-80">
            {monthlyData.length > 0 ? (
              <div className="h-full relative">
                  {/* Chart area - fixed height for bars */}
                  <div className="h-52 sm:h-64 flex items-end justify-between gap-1 sm:gap-2 px-2 sm:px-4 relative">
                    {monthlyData.map((item, index) => {
                      const maxCount = Math.max(...monthlyData.map(d => d.count));
                      const heightPercent = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                      const chartHeight = isMobile ? 200 : 240; // Updated for new container height
                      const barHeight = Math.max((heightPercent / 100) * chartHeight, item.count > 0 ? 4 : 0);
                    
                    return (
                        <div key={index} className="flex flex-col items-center flex-1 group">
                          {/* Bar container with fixed positioning */}
                          <div className="relative flex items-end justify-center w-full max-w-[24px] sm:max-w-[40px]">
                            <div 
                              className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-sm sm:rounded-t-lg transition-all duration-300 hover:shadow-lg hover:scale-105 relative group-hover:from-blue-600 group-hover:to-blue-500"
                              style={{ 
                                height: `${barHeight}px`,
                                minHeight: item.count > 0 ? '4px' : '0px'
                              }}
                            >
                              {/* Count label on top of bar */}
                              {item.count > 0 && (
                                <div className="absolute -top-5 sm:-top-6 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  {item.count}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                    );
                  })}
                </div>
                
                  {/* Month labels - separate row */}
                  <div className="flex items-end justify-between gap-1 sm:gap-2 px-2 sm:px-4 mt-6 mb-2 h-8">
                    {monthlyData.map((item, index) => (
                      <div key={index} className="flex-1 flex justify-center items-end">
                        <div className="text-xs font-medium text-gray-600 text-center transform -rotate-45 origin-bottom truncate whitespace-nowrap">
                          {item.month}
                        </div>
                      </div>
                    ))}
                  </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                {language === 'mr' ? 'कोणताही डेटा उपलब्ध नाही' : 'No data available'}
              </div>
            )}
          </div>
          
          {/* Y-axis labels */}
          <div className="flex justify-between items-center mt-4 px-4 text-xs text-gray-500">
            <span>0</span>
            {monthlyData.length > 0 && (
              <span>{Math.max(...monthlyData.map(d => d.count))}</span>
            )}
          </div>
          
            {/* Chart summary */}
            {monthlyData.length > 0 && (
              <div className="mt-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
                <div className="text-center">
                  <div className="font-semibold text-gray-800">
                    {monthlyData.reduce((sum, item) => sum + item.count, 0)}
                  </div>
                  <div className="text-gray-600">
                    {language === 'mr' ? 'एकूण अर्ज' : 'Total Letters'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-blue-600">
                    {Math.max(...monthlyData.map(d => d.count))}
                  </div>
                  <div className="text-gray-600">
                    {language === 'mr' ? 'सर्वाधिक' : 'Peak Month'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-green-600">
                    {Math.round(monthlyData.reduce((sum, item) => sum + item.count, 0) / 12 * 10) / 10}
                  </div>
                  <div className="text-gray-600">
                    {language === 'mr' ? 'सरासरी' : 'Average'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-purple-600">
                    {monthlyData.filter(d => d.count > 0).length}
                  </div>
                  <div className="text-gray-600">
                    {language === 'mr' ? 'सक्रिय महिने' : 'Active Months'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>

          {/* Recent Activity */}
          <motion.div 
            className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 xl:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                {language === 'mr' ? 'अलीकडील अर्ज' : 'Recent Activity'}
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
                  <div className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${
                    activity.type === 'new' ? 'bg-blue-100 text-blue-600' : 
                    activity.type === 'update' ? 'bg-green-100 text-green-600' : 
                    'bg-amber-100 text-amber-600'
                  }`}>
                    {activity.type === 'new' ? (
                      <FiMail className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : activity.type === 'update' ? (
                      <FiRefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <FiClock className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <h4 className="text-xs sm:text-sm font-medium text-gray-900 truncate">{activity.title}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 flex-shrink-0">{activity.time}</span>
                        {activity.hasFiles && (
                          <button
                            onClick={() => downloadLetterWithAttachments(activity.letter)}
                            disabled={downloadingLetters.has(activity.letter.id)}
                            className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={language === 'mr' ? 'कव्हरिंग लेटर आणि फाईल डाउनलोड करा' : 'Download covering letter and file'}
                          >
                            {downloadingLetters.has(activity.letter.id) ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                            ) : (
                              <FiDownload className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">{activity.user}</p>
                  </div>
                </motion.div>
            )) : (
              <div className="text-center py-8">
                <FiFileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {language === 'mr' ? 'कोणतीही क्रियाकलाप नाही' : 'No Recent Activity'}
                </h3>
                <p className="text-gray-500">
                  {language === 'mr' ? 'तुमचे पहिले अर्ज सबमिट करा' : 'Submit your first letter to see activity here'}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
      </div> 
      <ToastContainer />
    </div>
  );
};

export default InwardDashboard; 