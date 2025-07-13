import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEye, FiDownload, FiRefreshCw, FiSearch, FiCheck, FiX, FiExternalLink, FiFileText } from 'react-icons/fi';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import translations from '../../translations';

const InwardStaffLetters = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = translations[language] || translations['en'];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('all');
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acknowledgedLetters, setAcknowledgedLetters] = useState(new Set());
  
  // Status filter options with translations
  const statusOptions = [
    { value: 'All', label: language === 'mr' ? 'सर्व स्थिती' : 'All Status' },
    { value: 'pending', label: language === 'mr' ? 'प्रलंबित' : 'Pending' },
    { value: 'approved', label: language === 'mr' ? 'मंजूर' : 'Approved' },
    { value: 'rejected', label: language === 'mr' ? 'नाकारले' : 'Rejected' }
  ];

  // Date filter options
  const dateOptions = [
    { value: 'all', label: language === 'mr' ? 'सर्व पत्रे' : 'All Letters' },
    { value: 'today', label: language === 'mr' ? 'आजची पत्रे' : "Today's Letters" }
  ];

  // Check if a date is today
  const isToday = (someDate) => {
    if (!someDate) return false;
    const today = new Date();
    const date = new Date(someDate);
    return date.toDateString() === today.toDateString();
  };

  // Fetch letters from API
  const handleRefresh = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('http://localhost:5000/api/patras', {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data && Array.isArray(response.data)) {
        setLetters(response.data);
        
        // Load acknowledged status from localStorage with role-specific key
        const savedAcknowledged = localStorage.getItem('acknowledgedLetters_inward_staff');
        if (savedAcknowledged) {
          try {
            setAcknowledgedLetters(new Set(JSON.parse(savedAcknowledged)));
          } catch (e) {
            console.error('Error parsing acknowledged letters:', e);
            localStorage.removeItem('acknowledgedLetters_inward_staff');
          }
        }
      } else {
        throw new Error('Invalid data format received from server');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 
                         err.message || 
                         'Failed to fetch letters. Please check your connection and try again.';
      setError(errorMessage);
      console.error('Error fetching letters:', err);
      
      // Set empty array if there's an error to prevent rendering issues
      setLetters([]);
    } finally {
      setLoading(false);
    }
  };
  
  const toggleAcknowledge = (letterId) => {
    setAcknowledgedLetters(prev => {
      const newAcknowledged = new Set(prev);
      if (newAcknowledged.has(letterId)) {
        newAcknowledged.delete(letterId);
      } else {
        newAcknowledged.add(letterId);
      }
      // Save to localStorage with role-specific key
      localStorage.setItem('acknowledgedLetters_inward_staff', JSON.stringify(Array.from(newAcknowledged)));
      return newAcknowledged;
    });
  };

  const handleDownload = async (fileInfo) => {
    try {
      // If fileInfo is a string (legacy format), convert it to an object
      const fileData = typeof fileInfo === 'string' 
        ? { filePath: fileInfo, originalName: 'document.pdf' }
        : fileInfo;
      
      if (!fileData || !fileData.filePath) {
        throw new Error('No file path provided');
      }

      // Clean up the file path
      const cleanPath = fileData.filePath.replace(/\\/g, '/').replace(/^\/+/, '');
      const fullUrl = `http://localhost:5000/${cleanPath}`;
      
      console.log('Attempting to download from:', fullUrl);
      
      const response = await axios({
        url: fullUrl,
        method: 'GET',
        responseType: 'blob',
      });

      // Get the content type from the response
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      
      // Create a blob with the correct content type
      const blob = new Blob([response.data], { type: contentType });
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      
      // Set the download attribute with the original filename
      const filename = fileData.originalName || fileData.filePath.split('/').pop() || 'document.pdf';
      link.setAttribute('download', filename);
      
      // Append to body, trigger download, and clean up
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
      
    } catch (error) {
      console.error('Error downloading file:', error);
      setError(t.errors?.downloadError || 'Failed to download file. Please try again.');
      
      // Log more detailed error information
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    handleRefresh();
  }, []);

  // Filter letters based on search term, status, and date
  const filteredLetters = letters.filter(letter => {
    const searchableFields = [
      letter.referenceNumber,
      letter.letterType,
      letter.receivedByOffice,
      letter.recipientNameAndDesignation,
      letter.office,
      letter.letterStatus,
      letter.subjectAndDetails,
      letter.sender
    ].join(' ').toLowerCase();

    const matchesSearch = searchTerm === '' || 
      searchableFields.includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || 
      letter.letterStatus === statusFilter.toLowerCase();

    const matchesDate = dateFilter === 'all' || 
      (dateFilter === 'today' && isToday(letter.createdAt));

    return matchesSearch && matchesStatus && matchesDate;
  });

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {language === 'mr' ? 'सर्व आंतर-शासकीय पत्रे' : 'All Inward Letters'}
          </h1>
          <p className="text-gray-500">
            {language === 'mr' 
              ? 'सर्व आंतर-शासकीय पत्रे पहा आणि व्यवस्थापित करा' 
              : 'View and manage all inward letters'}
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <div className="relative">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              {dateOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'संदर्भ क्रमांक' : 'Reference No'}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'पत्र पाठविणारे कार्यालय' : 'Sender'}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'विषय' : 'Subject'}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'पत्र मिळाल्याचा दिनांक' : 'Received Date'}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'स्थिती' : 'Status'}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'पावती' : 'Acknowledge'}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'क्रिया' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLetters.map((letter) => (
                  <tr key={letter._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button 
                        onClick={() => navigate(`/dashboard/track-application/${letter.referenceNumber}`)}
                        className="text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
                        title={language === 'mr' ? 'अर्जाचा मागोवा पहा' : 'Track application'}
                      >
                        {letter.referenceNumber || 'N/A'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {letter.sender || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="line-clamp-2">
                        {letter.subjectAndDetails || 'No Subject'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {letter.receivedDate ? new Date(letter.receivedDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        letter.letterStatus === 'approved' ? 'bg-green-100 text-green-800' :
                        letter.letterStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {letter.letterStatus || 'pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => toggleAcknowledge(letter._id)}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          acknowledgedLetters.has(letter._id)
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {acknowledgedLetters.has(letter._id) ? (
                          <>
                            <FiCheck className="mr-1 h-3 w-3" />
                            {language === 'mr' ? 'स्वीकारले' : 'Acknowledged'}
                          </>
                        ) : (
                          <>
                            <FiCheck className="mr-1 h-3 w-3" />
                            {language === 'mr' ? 'स्वीकारा' : 'Acknowledge'}
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end">
                        {letter.letterFiles && letter.letterFiles.length > 0 ? (
                          <div className="relative group">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Get the first file from letterFiles array
                                const fileToDownload = letter.letterFiles[0];
                                handleDownload({
                                  filePath: fileToDownload.filePath,
                                  originalName: fileToDownload.originalName
                                });
                              }}
                              className="p-2 -m-2 rounded-full text-indigo-600 hover:text-indigo-900 hover:bg-indigo-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                              title={language === 'mr' ? 'डाउनलोड करा' : 'Download'}
                            >
                              <FiDownload className="h-5 w-5" />
                            </button>
                            <div className="absolute z-10 left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                              {language === 'mr' ? 'डाउनलोड करा' : 'Download'}
                              <div className="absolute left-1/2 -top-1 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                            </div>
                          </div>
                        ) : (
                          <div className="relative group">
                            <span 
                              className="p-2 -m-2 inline-flex items-center justify-center text-gray-400 cursor-not-allowed" 
                              title={language === 'mr' ? 'फाइल उपलब्ध नाही' : 'File not available'}
                            >
                              <FiDownload className="h-5 w-5" />
                            </span>
                            <div className="absolute z-10 left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                              {language === 'mr' ? 'फाइल उपलब्ध नाही' : 'File not available'}
                              <div className="absolute left-1/2 -top-1 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <FiFileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {language === 'mr' ? 'पत्रे सापडली नाहीत' : 'No letters found'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {language === 'mr' 
                ? 'कोणतीही पत्रे आढळली नाहीत. कृपया आपली शोधशोध बदला किंवा नवीन पत्र जोडा.' 
                : 'No letters found. Please try changing your search or add a new letter.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InwardStaffLetters;
