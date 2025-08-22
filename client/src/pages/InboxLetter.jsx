import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEye, FiDownload, FiRefreshCw, FiSearch, FiCheck, FiX, FiExternalLink, FiFileText, FiSend } from 'react-icons/fi';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import translations from '../translations/index';
import { toast } from 'react-toastify';
const apiUrl = import.meta.env.VITE_API_URL ;


const InboxLetter = () => {
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
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedLetterForSend, setSelectedLetterForSend] = useState(null);
  const [sendToData, setSendToData] = useState({
    igp: false,
    sp: false,
    sdpo: false,
    policeStation: false,
    selectedDistrict: '',
    selectedPoliceStation: '',
    remarks: ''
  });
  
  // Status filter options with translations
  const statusOptions = [
    { value: 'All', label: language === 'mr' ? 'सर्व स्थिती' : 'All Status' },
    { value: 'pending', label: language === 'mr' ? 'प्रलंबित' : 'Pending' },
    { value: 'approved', label: language === 'mr' ? 'मंजूर' : 'Approved' },
    { value: 'rejected', label: language === 'mr' ? 'नाकारले' : 'Rejected' }
  ];

  // Date filter options
  const dateOptions = [
    { value: 'all', label: language === 'mr' ? 'सर्व अर्ज' : 'All Letters' },
    { value: 'today', label: language === 'mr' ? 'आजचे अर्ज' : "Today's Letters" }
  ];

  // Department options
  const departmentOptions = [
    { value: 'admin', label: language === 'mr' ? 'प्रशासन' : 'Administration' },
    { value: 'accounts', label: language === 'mr' ? 'लेखा' : 'Accounts' },
    { value: 'legal', label: language === 'mr' ? 'कायदेशीर' : 'Legal' },
    { value: 'hr', label: language === 'mr' ? 'मानव संसाधन' : 'Human Resources' },
    { value: 'it', label: language === 'mr' ? 'आयटी' : 'IT' },
    { value: 'security', label: language === 'mr' ? 'सुरक्षा' : 'Security' }
  ];

  // Priority options
  const priorityOptions = [
    { value: 'low', label: language === 'mr' ? 'कमी' : 'Low' },
    { value: 'normal', label: language === 'mr' ? 'सामान्य' : 'Normal' },
    { value: 'high', label: language === 'mr' ? 'उच्च' : 'High' },
    { value: 'urgent', label: language === 'mr' ? 'तातडीचे' : 'Urgent' }
  ];

  // Check if a date is today
  const isToday = (someDate) => {
    if (!someDate) return false;
    const today = new Date();
    const date = new Date(someDate);
    return date.toDateString() === today.toDateString();
  };

  // Handle send modal open
  const handleSendClick = (letter) => {
    setSelectedLetterForSend(letter);
    setSendToData({
      igp: false,
      sp: false,
      sdpo: false,
      policeStation: false,
      selectedDistrict: '',
      selectedPoliceStation: '',
      remarks: ''
    });
    setSendModalOpen(true);
  };

  // Handle send form submission
  const handleSendSubmit = async (e) => {
    e.preventDefault();
    try {
      // Here you would typically send the data to your API
      console.log('Sending letter:', selectedLetterForSend.referenceNumber, 'to:', sendToData);
      
      // Example API call:
      // await axios.post(`http://localhost:5000/api/letters/${selectedLetterForSend._id}/send`, sendToData);
      
      // Show success message
      toast.success(language === 'mr' ? 'पत्र यशस्वीरित्या पाठवले गेले!' : 'Letter sent successfully!');
      
      // Close modal
      setSendModalOpen(false);
      setSelectedLetterForSend(null);
      
      // Refresh letters
      handleRefresh();
    } catch (error) {
      console.error('Error sending letter:', error);
      toast.error(language === 'mr' ? 'पत्र पाठविण्यात त्रुटी!' : 'Error sending letter!');
    }
  };

  // Fetch letters from API
  const handleRefresh = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${apiUrl}/api/outward-letters`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`

        },
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data && Array.isArray(response.data)) {
        setLetters(response.data);
        
        // Load acknowledged status from localStorage with role-specific key
        const savedAcknowledged = localStorage.getItem('acknowledgedLetters_outward_staff');
        if (savedAcknowledged) {
          try {
            setAcknowledgedLetters(new Set(JSON.parse(savedAcknowledged)));
          } catch (e) {
            console.error('Error parsing acknowledged letters:', e);
            localStorage.removeItem('acknowledgedLetters_outward_staff');
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
      localStorage.setItem('acknowledgedLetters_outward_staff', JSON.stringify(Array.from(newAcknowledged)));
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
      const fullUrl = `${apiUrl}/${cleanPath}`;
      
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

  const totalPages = Math.ceil(filteredLetters.length / recordsPerPage);
  const paginatedLetters = filteredLetters.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

  return (
    <div className="p-6">
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {language === 'mr' ? 'सर्व जावक पत्रे' : 'All Outward Letters'}
        </h1>
        <p className="text-gray-500">
          {language === 'mr' 
            ? 'सर्व जावक पत्रे पहा आणि व्यवस्थापित करा' 
            : 'View and manage all outward letters'}
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
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
        </div>
      ) : filteredLetters.length > 0 ? (
        <>
          <div className="w-full overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-orange-600 to-red-800">
                <tr>
                  <th scope="col" className="px-4 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                    {language === 'mr' ? 'अनुक्रमांक' : 'Sr No'}
                  </th>
                  <th scope="col" className="px-8 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                    {language === 'mr' ? 'संदर्भ क्रमांक' : 'Reference No'}
                  </th>
                  <th scope="col" className="px-8 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                    {language === 'mr' ? 'पत्र प्राप्त करणारे कार्यालय' : 'Recipient Office'}
                  </th>
                  <th scope="col" className="px-8 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap min-w-[180px]">
                    {language === 'mr' ? 'पाठवा' : 'Send To'}
                  </th>
                  <th scope="col" className="px-8 py-4 text-right text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                    {language === 'mr' ? 'क्रिया' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedLetters.map((letter, idx) => (
                  <tr 
                    key={letter._id} 
                    className={`transition-all hover:bg-orange-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {(currentPage - 1) * recordsPerPage + idx + 1}
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap text-sm font-medium text-orange-600 max-w-[200px] truncate">
                      <button 
                        onClick={() => navigate(`/dashboard/track-application/${letter.referenceNumber}`)}
                        className="hover:text-orange-800 hover:underline focus:outline-none"
                        title={language === 'mr' ? 'अर्जाचा मागोवा पहा' : 'Track application'}
                      >
                        {letter.referenceNumber || 'N/A'}
                      </button>
                    </td>
                    <td className="px-8 py-4 text-sm text-gray-900 max-w-[220px]">
                      <div className="line-clamp-2">
                        {letter.recipientOffice || letter.receivedByOffice || 'N/A'}
                      </div>
                    </td>
                    <td className="px-8 py-4 text-sm text-gray-900">
                      <button
                        onClick={() => handleSendClick(letter)}
                        className="inline-flex items-center px-3 py-1 bg-orange-600 text-white text-xs font-medium rounded-md hover:bg-orange-700 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
                        title={language === 'mr' ? 'पत्र पाठवा' : 'Send Letter'}
                      >
                        <FiSend className="mr-1 h-3 w-3" />
                        {language === 'mr' ? 'पाठवा' : 'Send'}
                      </button>
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => {
                            setSelectedLetter(letter);
                            setViewModalOpen(true);
                          }}
                          className="text-orange-600 hover:text-orange-900 p-1 rounded-md hover:bg-orange-100 transition-colors"
                          title={language === 'mr' ? 'पहा' : 'View'}
                        >
                          <FiEye className="h-5 w-5" />
                        </button>
                        {letter.letterFiles && letter.letterFiles.length > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const fileToDownload = letter.letterFiles[0];
                              handleDownload({
                                filePath: fileToDownload.filePath,
                                originalName: fileToDownload.originalName
                              });
                            }}
                            className="text-orange-600 hover:text-orange-900 p-1 rounded-md hover:bg-orange-100 transition-colors"
                            title={language === 'mr' ? 'डाउनलोड करा' : 'Download'}
                          >
                            <FiDownload className="h-5 w-5" />
                          </button>
                        ) : (
                          <span 
                            className="text-gray-400 p-1 cursor-not-allowed" 
                            title={language === 'mr' ? 'फाइल उपलब्ध नाही' : 'File not available'}
                          >
                            <FiDownload className="h-5 w-5" />
                          </span>
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
              className="px-4 py-2 bg-orange-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-700 transition"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              {language === 'mr' ? 'मागील' : 'Previous'}
            </button>
            <button
              className="px-4 py-2 bg-orange-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-700 transition"
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
              ? 'कोणतीही पत्रे आढळली नाहीत. कृपया आपली शोधशोध बदला किंवा नवीन पत्र जोडा.' 
              : 'No letters found. Please try changing your search or add a new letter.'}
          </p>
        </div>
      )}
    </div>

    {/* Send Letter Modal - Same enhanced modal as before */}
    {sendModalOpen && selectedLetterForSend && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
        {/* Enhanced Send Modal Content Here - Same as previous design */}
      </div>
    )}

    {/* View Modal - Same as before but with orange theme */}
    {viewModalOpen && selectedLetter && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8 relative max-h-[90vh] overflow-y-auto border border-orange-100">
          {/* View Modal Content Here - Same structure with orange theme */}
        </div>
      </div>
    )}
  </div>
  );
};

export default InboxLetter;