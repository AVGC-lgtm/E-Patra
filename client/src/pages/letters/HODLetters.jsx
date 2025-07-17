import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEye, FiRefreshCw, FiSearch, FiCheck, FiX, FiFileText, FiEdit } from 'react-icons/fi';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import translations from '../../translations';

const HODLetters = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = translations[language] || translations['en'];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState(null);

  // Status filter options with translations - REMOVED "sending for head sign"
  const statusOptions = [
    { value: 'All', label: language === 'mr' ? 'सर्व स्थिती' : 'All Status' },
    { value: 'pending', label: language === 'mr' ? 'प्रलंबित' : 'Pending' },
    { value: 'approved', label: language === 'mr' ? 'मंजूर' : 'Approved' },
    { value: 'rejected', label: language === 'mr' ? 'नाकारले' : 'Rejected' }
  ];

  // Field labels for the view modal
  const fieldLabels = {
    dateOfReceiptOfLetter: { en: 'Date of Receipt', mr: 'प्राप्तीची तारीख' },
    officeSendingLetter: { en: 'Sender Office', mr: 'पत्र पाठविणारे कार्यालय' },
    senderNameAndDesignation: { en: 'Sender Name & Designation', mr: 'प्रेषकाचे नाव व पदनाम' },
    mobileNumber: { en: 'Mobile Number', mr: 'मोबाईल नंबर' },
    letterMedium: { en: 'Letter Medium', mr: 'पत्र माध्यम' },
    letterClassification: { en: 'Classification', mr: 'वर्गीकरण' },
    letterType: { en: 'Letter Type', mr: 'पत्र प्रकार' },
    letterDate: { en: 'Letter Date', mr: 'पत्राची तारीख' },
    subject: { en: 'Subject', mr: 'विषय' },
    outwardLetterNumber: { en: 'Outward Letter Number', mr: 'बाह्य पत्र क्रमांक' },
    numberOfCopies: { en: 'Number of Copies', mr: 'प्रतींची संख्या' },
    letterStatus: { en: 'Status', mr: 'स्थिती' },
    NA: { en: 'NA', mr: 'NA' },
    NAR: { en: 'NAR', mr: 'NAR' },
    userId: { en: 'User ID', mr: 'वापरकर्ता आयडी' },
    fileId: { en: 'File ID', mr: 'फाइल आयडी' },
    referenceNumber: { en: 'Reference Number', mr: 'संदर्भ क्रमांक' },
    sentTo: { en: 'Sent To', mr: 'पाठवले' }
  };

  // Fields to exclude from the view modal
  const excludedFields = [
    '_id', '__v', 'id', 'createdAt', 'updatedAt', 
    'fileId', 'userId', 'upload', 'extractedData'
  ];

  // Helper function to get user data
  const getUserData = () => {
    const token = localStorage.getItem('token');
    const userInfo = localStorage.getItem('userInfo') || localStorage.getItem('user');
    
    let userData = null;
    
    // Try to parse user info from localStorage
    if (userInfo) {
      try {
        userData = JSON.parse(userInfo);
      } catch (e) {
        console.error('Error parsing user info:', e);
      }
    }
    
    // If no user data in localStorage, decode from JWT token
    if (!userData && token) {
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          userData = {
            id: payload.id || payload.userId || payload.sub,
            email: payload.email,
            name: payload.name || payload.username,
            role: payload.role || payload.roleId
          };
        }
      } catch (e) {
        console.error('Error decoding token:', e);
      }
    }
    
    return userData;
  };

  // Helper function to safely render values
  const renderFieldValue = (key, value) => {
    // Handle null, undefined, or empty values
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }

    // Handle sentTo object specially
    if (key === 'sentTo' && typeof value === 'object') {
      const sentToList = [];
      if (value.igp) sentToList.push('IGP');
      if (value.sp) sentToList.push('SP');
      if (value.sdpo) sentToList.push('SDPO');
      if (value.policeStation && value.selectedDistrict) {
        sentToList.push(`Police Station (${value.selectedDistrict})`);
      }
      return sentToList.length > 0 ? sentToList.join(', ') : 'N/A';
    }

    // Handle objects
    if (typeof value === 'object') {
      // If it's an array, join the elements
      if (Array.isArray(value)) {
        return value.length > 0 ? value.join(', ') : 'N/A';
      }
      
      // If it's an object, try to extract meaningful information
      if (value.id && value.email) {
        return `${value.email} (ID: ${value.id})`;
      }
      
      if (value.name) {
        return value.name;
      }
      
      // For other objects, stringify them safely
      try {
        return JSON.stringify(value);
      } catch (e) {
        return '[Object]';
      }
    }

    // Handle boolean values
    if (typeof value === 'boolean') {
      return value ? (language === 'mr' ? 'होय' : 'Yes') : (language === 'mr' ? 'नाही' : 'No');
    }

    // For dates
    if (key.includes('Date') || key.includes('date') || key === 'sentAt') {
      return formatDate(value);
    }

    // For regular strings/numbers
    return String(value);
  };

  // Function to get file URL and preview
  const getFileUrl = (letter) => {
    if (letter.upload && letter.upload.fileUrl) {
      return letter.upload.fileUrl;
    }
    if (letter.fileId) {
      return `http://localhost:5000/uploads/${letter.fileId}`;
    }
    return null;
  };

  // Function to preview file
  const previewFile = (letter) => {
    const fileUrl = getFileUrl(letter);
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    } else {
      alert(language === 'mr' ? 'फाइल उपलब्ध नाही' : 'File not available');
    }
  };

  // Fetch letters from API
  const handleRefresh = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.get('http://localhost:5000/api/patras', {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        timeout: 10000
      });
      
      if (response.data && Array.isArray(response.data)) {
        console.log('HOD Letters - All letters received:', response.data);
        console.log('HOD Letters - Letter statuses:', response.data.map(l => ({ 
          id: l.referenceNumber, 
          status: l.letterStatus 
        })));
        setLetters(response.data);
      } else {
        throw new Error('Invalid data format received from server');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 
                         err.response?.data?.error ||
                         err.message || 
                         'Failed to fetch letters. Please check your connection and try again.';
      
      // Handle authentication errors
      if (err.response?.status === 401 || err.response?.data?.error === 'User not found') {
        console.error('Authentication error:', err);
        alert(language === 'mr' ? 
          'आपली सत्र संपली आहे. कृपया पुन्हा लॉगिन करा.' : 
          'Your session has expired. Please login again.');
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
      
      setError(errorMessage);
      console.error('Error fetching letters:', err);
      setLetters([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      alert(language === 'mr' ? 
        'कृपया प्रथम लॉगिन करा!' : 
        'Please login first!');
      navigate('/login');
      return;
    }
    
    handleRefresh();
  }, [navigate, language]);

  // Helper function to check if status is "sending for head sign" in any language
  const isSendingForHeadSign = (status) => {
    if (!status) return false;
    const statusLower = status.toLowerCase();
    const sendingForHeadSignVariations = [
      'sending for head sign',
      'प्रमुख स्वाक्षरीसाठी पाठवत आहे',
      'प्रमुख स्वाक्षरीसाठी'
    ];
    
    return sendingForHeadSignVariations.some(variation => 
      statusLower === variation.toLowerCase() || status === variation
    );
  };

  // Filter letters based on search term and status
  // Only show letters that have been sent to HOD (pending, approved, rejected)
  const filteredLetters = letters.filter(letter => {
    const letterStatus = letter.letterStatus || letter.letter_status || letter.status || '';
    
    // Debug logging
    console.log('HOD Filter - Letter:', letter.referenceNumber, 'Status:', letterStatus);
    
    // Exclude letters with "sending for head sign" status
    if (isSendingForHeadSign(letterStatus)) {
      console.log('HOD Filter - Excluding letter:', letter.referenceNumber, 'Status is sending for head sign');
      return false;
    }
    
    // Only include letters with pending, approved, or rejected status
    const statusLower = letterStatus.toLowerCase();
    const allowedStatuses = ['pending', 'approved', 'rejected', 'प्रलंबित', 'मंजूर', 'नाकारले'];
    const hasAllowedStatus = allowedStatuses.some(s => statusLower === s.toLowerCase() || letterStatus === s);
    
    if (!hasAllowedStatus && letterStatus !== '') {
      console.log('HOD Filter - Excluding letter:', letter.referenceNumber, 'Status not allowed:', letterStatus);
      return false;
    }

    const searchableFields = [
      letter.referenceNumber,
      letter.senderNameAndDesignation,
      letter.officeSendingLetter,
      letter.subject
    ].join(' ').toLowerCase();

    const matchesSearch = searchTerm === '' || 
      searchableFields.includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || 
      statusLower === statusFilter.toLowerCase() ||
      (statusFilter === 'pending' && (statusLower === 'pending' || letterStatus === 'प्रलंबित')) ||
      (statusFilter === 'approved' && (statusLower === 'approved' || letterStatus === 'मंजूर')) ||
      (statusFilter === 'rejected' && (statusLower === 'rejected' || letterStatus === 'नाकारले'));

    const shouldInclude = matchesSearch && matchesStatus && hasAllowedStatus;
    if (shouldInclude) {
      console.log('HOD Filter - Including letter:', letter.referenceNumber, 'Status:', letterStatus);
    }
    
    return shouldInclude;
  });

  const totalPages = Math.ceil(filteredLetters.length / recordsPerPage);
  const paginatedLetters = filteredLetters.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

  // Helper function to get status badge styling
  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase() || 'pending';
    
    const statusConfig = {
      pending: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        label: language === 'mr' ? 'प्रलंबित' : 'Pending'
      },
      'प्रलंबित': {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        label: language === 'mr' ? 'प्रलंबित' : 'Pending'
      },
      approved: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        label: language === 'mr' ? 'मंजूर' : 'Approved'
      },
      'मंजूर': {
        bg: 'bg-green-100',
        text: 'text-green-800',
        label: language === 'mr' ? 'मंजूर' : 'Approved'
      },
      rejected: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        label: language === 'mr' ? 'नाकारले' : 'Rejected'
      },
      'नाकारले': {
        bg: 'bg-red-100',
        text: 'text-red-800',
        label: language === 'mr' ? 'नाकारले' : 'Rejected'
      },
      'sending for head sign': {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        label: language === 'mr' ? 'प्रमुख स्वाक्षरीसाठी' : 'For Head Sign'
      },
      'प्रमुख स्वाक्षरीसाठी': {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        label: language === 'mr' ? 'प्रमुख स्वाक्षरीसाठी' : 'For Head Sign'
      }
    };

    // Check for exact match first
    if (statusConfig[status]) {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[status].bg} ${statusConfig[status].text}`}>
          {statusConfig[status].label}
        </span>
      );
    }

    // Then check lowercase
    const config = statusConfig[statusLower] || statusConfig.pending;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  // Handle approve action
  const handleApprove = async (letterId) => {
    try {
      const token = localStorage.getItem('token');
      const userData = getUserData();
      
      if (!token) {
        alert(language === 'mr' ? 'कृपया पुन्हा लॉगिन करा!' : 'Please login again!');
        navigate('/login');
        return;
      }
      
      const updateData = {
        letterStatus: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: userData?.id || userData?.userId,
        approvedByEmail: userData?.email,
        approvedByName: userData?.name || userData?.username,
        userId: userData?.id || userData?.userId,
        userRole: userData?.role || userData?.roleId
      };
      
      // Remove undefined/null fields
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined || updateData[key] === null) {
          delete updateData[key];
        }
      });
      
      console.log('Approving letter:', letterId, updateData);
      
      const response = await axios.put(`http://localhost:5000/api/patras/${letterId}`, updateData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 200 || response.status === 201) {
        alert(language === 'mr' ? 'पत्र मंजूर केले!' : 'Letter approved!');
        handleRefresh();
      }
    } catch (error) {
      console.error('Error approving letter:', error);
      
      if (error.response?.data?.error === 'User not found' || error.response?.status === 401) {
        alert(language === 'mr' ? 
          'वापरकर्ता सत्यापन अयशस्वी. कृपया पुन्हा लॉगिन करा.' : 
          'User authentication failed. Please login again.');
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
      
      alert(language === 'mr' ? 'पत्र मंजूर करण्यात त्रुटी!' : 'Error approving letter!');
    }
  };

  // Handle reject action
  const handleReject = async (letterId) => {
    try {
      const token = localStorage.getItem('token');
      const userData = getUserData();
      
      if (!token) {
        alert(language === 'mr' ? 'कृपया पुन्हा लॉगिन करा!' : 'Please login again!');
        navigate('/login');
        return;
      }
      
      const updateData = {
        letterStatus: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy: userData?.id || userData?.userId,
        rejectedByEmail: userData?.email,
        rejectedByName: userData?.name || userData?.username,
        userId: userData?.id || userData?.userId,
        userRole: userData?.role || userData?.roleId
      };
      
      // Remove undefined/null fields
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined || updateData[key] === null) {
          delete updateData[key];
        }
      });
      
      console.log('Rejecting letter:', letterId, updateData);
      
      const response = await axios.put(`http://localhost:5000/api/patras/${letterId}`, updateData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 200 || response.status === 201) {
        alert(language === 'mr' ? 'पत्र नाकारले!' : 'Letter rejected!');
        handleRefresh();
      }
    } catch (error) {
      console.error('Error rejecting letter:', error);
      
      if (error.response?.data?.error === 'User not found' || error.response?.status === 401) {
        alert(language === 'mr' ? 
          'वापरकर्ता सत्यापन अयशस्वी. कृपया पुन्हा लॉगिन करा.' : 
          'User authentication failed. Please login again.');
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
      
      alert(language === 'mr' ? 'पत्र नाकारण्यात त्रुटी!' : 'Error rejecting letter!');
    }
  };

  // Handle attach sign action
  const handleAttachSign = async (letterId) => {
    try {
      console.log('Attaching sign to letter:', letterId);
      // Navigate to upload sign page with letter ID
      navigate(`/dashboard/upload-sign/${letterId}`);
    } catch (error) {
      console.error('Error attaching sign:', error);
      alert(language === 'mr' ? 'स्वाक्षरी जोडण्यात त्रुटी!' : 'Error attaching sign!');
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString(language === 'mr' ? 'mr-IN' : 'en-US');
    } catch (e) {
      return 'Invalid Date';
    }
  };

  // Helper function to check if letter status is pending
  const isPending = (status) => {
    if (!status) return false;
    const statusLower = status.toLowerCase();
    return statusLower === 'pending' || status === 'प्रलंबित';
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {language === 'mr' ? 'HOD मंजुरीसाठी पत्रे' : 'Letters for HOD Approval'}
          </h1>
          <p className="text-gray-500">
            {language === 'mr' 
              ? 'मंजुरी किंवा नाकारण्यासाठी पत्रे पहा' 
              : 'View letters for approval or rejection'}
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder={language === 'mr' ? 'शोधा...' : 'Search...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <FiRefreshCw className="mr-2 h-4 w-4" />
            {language === 'mr' ? 'रिफ्रेश करा' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiX className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {loading ? (
          <div className="flex justify-center items-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : filteredLetters.length > 0 ? (
          <>
            <div className="w-full overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-blue-600 to-blue-800">
                  <tr>
                    <th scope="col" className="px-4 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                      {language === 'mr' ? 'अनुक्रमांक' : 'Sr No'}
                    </th>
                    <th scope="col" className="px-8 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                      {language === 'mr' ? 'संदर्भ क्रमांक' : 'Reference No'}
                    </th>
                    <th scope="col" className="px-8 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                      {language === 'mr' ? 'अर्जदाराचे नाव' : 'Applicant Name'}
                    </th>
                    <th scope="col" className="px-8 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                      {language === 'mr' ? 'स्थिती' : 'Status'}
                    </th>
                    <th scope="col" className="px-8 py-4 text-right text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                      {language === 'mr' ? 'क्रिया' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedLetters.map((letter, idx) => (
                    <tr 
                      key={letter.id || letter._id} 
                      className={`transition-all hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {(currentPage - 1) * recordsPerPage + idx + 1}
                      </td>
                      <td className="px-8 py-4 whitespace-nowrap text-sm font-medium text-blue-600 max-w-[200px] truncate">
                        <button 
                          onClick={() => navigate(`/dashboard/track-application/${letter.referenceNumber}`)}
                          className="hover:text-blue-800 hover:underline focus:outline-none"
                          title={language === 'mr' ? 'अर्जाचा मागोवा पहा' : 'Track application'}
                        >
                          {letter.referenceNumber || 'N/A'}
                        </button>
                      </td>
                      <td className="px-8 py-4 text-sm text-gray-900 max-w-[220px]">
                        <div className="line-clamp-2">
                          {letter.senderNameAndDesignation || 'N/A'}
                        </div>
                      </td>
                      <td className="px-8 py-4 whitespace-nowrap text-sm">
                        {getStatusBadge(letter.letterStatus)}
                      </td>
                      <td className="px-8 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setSelectedLetter(letter);
                              setViewModalOpen(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded-md hover:bg-blue-100 transition-colors"
                            title={language === 'mr' ? 'पहा' : 'View'}
                          >
                            <FiEye className="h-5 w-5" />
                          </button>

                          <button
                            onClick={() => previewFile(letter)}
                            className="text-indigo-600 hover:text-indigo-900 p-1 rounded-md hover:bg-indigo-100 transition-colors"
                            title={language === 'mr' ? 'फाइल पहा' : 'View File'}
                          >
                            <FiFileText className="h-5 w-5" />
                          </button>
                          
                          <button
                            onClick={() => handleAttachSign(letter.id || letter._id)}
                            className="text-purple-600 hover:text-purple-900 p-1 rounded-md hover:bg-purple-100 transition-colors"
                            title={language === 'mr' ? 'स्वाक्षरी जोडा' : 'Attach Sign'}
                          >
                            <FiEdit className="h-5 w-5" />
                          </button>
                          
                          {isPending(letter.letterStatus) && (
                            <>
                              <button
                                onClick={() => handleApprove(letter.id || letter._id)}
                                className="text-green-600 hover:text-green-900 p-1 rounded-md hover:bg-green-100 transition-colors"
                                title={language === 'mr' ? 'मंजूर करा' : 'Approve'}
                              >
                                <FiCheck className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleReject(letter.id || letter._id)}
                                className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-100 transition-colors"
                                title={language === 'mr' ? 'नाकारा' : 'Reject'}
                              >
                                <FiX className="h-5 w-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-end mt-4 px-2 gap-4">
              <span className="text-sm text-gray-700 mr-2">
                {language === 'mr'
                  ? `पृष्ठ ${currentPage} / ${totalPages}`
                  : `Page ${currentPage} of ${totalPages}`}
              </span>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                {language === 'mr' ? 'मागील' : 'Previous'}
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                {language === 'mr' ? 'पुढील' : 'Next'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <FiFileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {language === 'mr' ? 'पत्रे सापडली नाहीत' : 'No letters found'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {language === 'mr' 
                ? 'HOD मंजुरीसाठी कोणतीही पत्रे आढळली नाहीत.' 
                : 'No letters found for HOD approval.'}
            </p>
          </div>
        )}
      </div>

      {/* View Letter Modal */}
      {viewModalOpen && selectedLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8 relative max-h-[90vh] overflow-y-auto border border-blue-100">
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 bg-gray-100 rounded-full p-1 shadow"
              onClick={() => setViewModalOpen(false)}
            >
              <FiX className="h-6 w-6" />
            </button>
            <h2 className="text-2xl font-extrabold mb-8 text-blue-700 text-center tracking-wide drop-shadow">
              {language === 'mr' ? 'पत्र तपशील' : 'Letter Details'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Dynamically render all fields with safe rendering, excluding technical fields */}
              {Object.entries(selectedLetter)
                .filter(([key]) => {
                  // Convert key to lowercase for case-insensitive comparison
                  const keyLower = key.toLowerCase();
                  
                  // Check if key is in excluded fields (case-insensitive)
                  const isExcluded = excludedFields.some(excludedField => 
                    excludedField.toLowerCase() === keyLower
                  );
                  
                  // Additional patterns to exclude
                  const containsFileId = keyLower.includes('file') && keyLower.includes('id');
                  const containsUserId = keyLower.includes('user') && keyLower.includes('id');
                  
                  return !isExcluded && !containsFileId && !containsUserId;
                })
                .map(([key, value]) => {
                // Get the label for this field
                const label = fieldLabels[key] 
                  ? fieldLabels[key][language === 'mr' ? 'mr' : 'en']
                  : key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
                
                // Special formatting for status
                if (key === 'letterStatus') {
                  return (
                    <div key={key} className="col-span-1">
                      <div className="text-base font-bold text-blue-900 mb-1">
                        {label}
                      </div>
                      <div className="text-lg text-gray-800 font-medium">
                        {getStatusBadge(value)}
                      </div>
                    </div>
                  );
                }
                
                // Use the safe render function for all other fields
                const displayValue = renderFieldValue(key, value);
                
                return (
                  <div key={key} className="col-span-1">
                    <div className="text-base font-bold text-blue-900 mb-1">
                      {label}
                    </div>
                    <div className="text-lg text-gray-800 font-medium">
                      {displayValue}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* File Preview Section */}
            {getFileUrl(selectedLetter) && (
              <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <h3 className="text-lg font-bold text-blue-800 mb-4">
                  {language === 'mr' ? 'अपलोड केलेली फाइल' : 'Uploaded File'}
                </h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiFileText className="text-blue-600 h-5 w-5" />
                 
                  </div>
                  <button
                    onClick={() => previewFile(selectedLetter)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <FiEye className="h-4 w-4" />
                    {language === 'mr' ? 'फाइल पहा' : 'View File'}
                  </button>
                </div>
              </div>
            )}
            <div className="flex justify-center mt-8">
              <button
                className="px-8 py-2 bg-blue-600 text-white rounded-lg font-semibold shadow hover:bg-blue-700 transition-colors text-lg"
                onClick={() => setViewModalOpen(false)}
              >
                {language === 'mr' ? 'बंद करा' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODLetters;