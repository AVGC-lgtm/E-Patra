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
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState(null);
  
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

  const totalPages = Math.ceil(filteredLetters.length / recordsPerPage);
  const paginatedLetters = filteredLetters.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

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
                    {language === 'mr' ? 'पत्र पाठविणारे कार्यालय' : 'Sender Office'}
                  </th>
                  <th scope="col" className="px-8 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                    {language === 'mr' ? 'मोबाईल नंबर' : 'Mobile'}
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
                        {letter.officeSendingLetter || 'N/A'}
                      </div>
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900">
                      {letter.mobileNumber || 'N/A'}
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
                            className="text-blue-600 hover:text-blue-900 p-1 rounded-md hover:bg-blue-100 transition-colors"
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
              ? 'कोणतीही पत्रे आढळली नाहीत. कृपया आपली शोधशोध बदला किंवा नवीन पत्र जोडा.' 
              : 'No letters found. Please try changing your search or add a new letter.'}
          </p>
        </div>
      )}
    </div>
    {/* Modal for viewing letter details */}
    {viewModalOpen && selectedLetter && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8 relative max-h-[90vh] overflow-y-auto border border-blue-100">
          <button
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 bg-gray-100 rounded-full p-1 shadow"
            onClick={() => setViewModalOpen(false)}
          >
            <FiX className="h-6 w-6" />
          </button>
          <h2 className="text-2xl font-extrabold mb-8 text-blue-700 text-center tracking-wide drop-shadow">{language === 'mr' ? 'पत्र तपशील' : 'Letter Details'}</h2>
          <div className="flex flex-col gap-6">
            {/* 1. पत्र पाठविणारे कार्यालय / Sender Office */}
            <div>
              <div className="text-base font-bold text-blue-900 mb-1">{t.officeSendingLetter || (language === 'mr' ? 'पत्र पाठविणारे कार्यालय' : 'Sender Office')}</div>
              <div className="text-lg text-gray-800 font-medium whitespace-pre-line">{selectedLetter.officeSendingLetter || 'N/A'}</div>
            </div>
            <div className="border-b border-blue-100" />
            {/* 2. पाठविणाऱ्याचे नाव व पदनाम / Sender Name & Designation */}
            <div>
              <div className="text-base font-bold text-blue-900 mb-1">{t.senderNameAndDesignation || (language === 'mr' ? 'पाठविणाऱ्याचे नाव व पदनाम' : 'Sender Name & Designation')}</div>
              <div className="text-lg text-gray-800 font-medium whitespace-pre-line">{selectedLetter.senderNameAndDesignation || 'N/A'}</div>
            </div>
            <div className="border-b border-blue-100" />
            {/* 3. प्राप्त पत्राचा जावक क्रमांक / Outward Letter Number */}
            <div>
              <div className="text-base font-bold text-blue-900 mb-1">{t.outward_letter_no || (language === 'mr' ? 'प्राप्त पत्राचा जावक क्रमांक' : 'Outward Letter Number')}</div>
              <div className="text-lg text-gray-800 font-medium whitespace-pre-line">{selectedLetter.outwardLetterNumber || 'N/A'}</div>
            </div>
            <div className="border-b border-blue-100" />
            {/* 4. सह कागद पत्रांची संख्या / Number of Copies */}
            <div>
              <div className="text-base font-bold text-blue-900 mb-1">{t.no_of_documents || (language === 'mr' ? 'सह कागद पत्रांची संख्या' : 'Number of Copies')}</div>
              <div className="text-lg text-gray-800 font-medium whitespace-pre-line">{selectedLetter.numberOfCopies || 'N/A'}</div>
            </div>
            <div className="border-b border-blue-100" />
            {/* 5. मोबाईल नंबर / टेलीफोन नंबर / Mobile Number */}
            <div>
              <div className="text-base font-bold text-blue-900 mb-1">{t.mobileNumber || (language === 'mr' ? 'मोबाईल नंबर / टेलीफोन नंबर' : 'Mobile Number')}</div>
              <div className="text-lg text-gray-800 font-medium whitespace-pre-line">{selectedLetter.mobileNumber || 'N/A'}</div>
            </div>
            <div className="border-b border-blue-100" />
            {/* 6. पत्राचे माध्यम / Letter Medium */}
            <div>
              <div className="text-base font-bold text-blue-900 mb-1">{t.letterMedium || (language === 'mr' ? 'पत्राचे माध्यम' : 'Letter Medium')}</div>
              <div className="text-lg text-gray-800 font-medium whitespace-pre-line">{t[selectedLetter.letterMedium] || selectedLetter.letterMedium || 'N/A'}</div>
            </div>
            <div className="border-b border-blue-100" />
            {/* 7. पत्र वर्गीकरण / Letter Category */}
            <div>
              <div className="text-base font-bold text-blue-900 mb-1">{t.letterCategory || (language === 'mr' ? 'पत्र वर्गीकरण' : 'Letter Category')}</div>
              <div className="text-lg text-gray-800 font-medium whitespace-pre-line">{t[selectedLetter.letterCategory] || selectedLetter.letterCategory || 'N/A'}</div>
            </div>
            <div className="border-b border-blue-100" />
            {/* 8. पत्राचा प्रकार / Letter Type */}
            <div>
              <div className="text-base font-bold text-blue-900 mb-1">{t.letterType || (language === 'mr' ? 'पत्राचा प्रकार' : 'Letter Type')}</div>
              <div className="text-lg text-gray-800 font-medium whitespace-pre-line">{t[selectedLetter.letterType] || selectedLetter.letterType || 'N/A'}</div>
            </div>
            <div className="border-b border-blue-100" />
            {/* 9. पत्राचे वर्गीकरण / Letter Classification */}
            <div>
              <div className="text-base font-bold text-blue-900 mb-1">{t.letterClassification || (language === 'mr' ? 'पत्राचे वर्गीकरण' : 'Letter Classification')}</div>
              <div className="text-lg text-gray-800 font-medium whitespace-pre-line">{selectedLetter.letterClassification || 'N/A'}</div>
            </div>
            <div className="border-b border-blue-100" />
            {/* 10. पत्र मिळाल्याचा दिनांक / Date of Receipt of Letter */}
            <div>
              <div className="text-base font-bold text-blue-900 mb-1">{t.date_of_receipt_of_the_letter || (language === 'mr' ? 'पत्र मिळाल्याचा दिनांक' : 'Date of Receipt of Letter')}</div>
              <div className="text-lg text-gray-800 font-medium whitespace-pre-line">{selectedLetter.dateOfReceiptOfLetter || selectedLetter.date_of_receipt_of_the_letter || 'N/A'}</div>
            </div>
            <div className="border-b border-blue-100" />
            {/* 11. विषय / Subject */}
            <div>
              <div className="text-base font-bold text-blue-900 mb-1">{t.subject || (language === 'mr' ? 'विषय' : 'Subject')}</div>
              <div className="text-lg text-gray-800 font-medium whitespace-pre-line">{selectedLetter.subject || 'N/A'}</div>
            </div>
            {/* Attachments */}
            {selectedLetter.letterFiles && selectedLetter.letterFiles.length > 0 && (
              <>
                <div className="border-b border-blue-100" />
                <div>
                  <div className="text-base font-bold text-blue-900 mb-1">{language === 'mr' ? 'संलग्न फाईल्स' : 'Attachments'}</div>
                  <ul className="list-disc ml-5">
                    {selectedLetter.letterFiles.map((file, i) => (
                      <li key={i}>
                        <a href={`http://localhost:5000/${file.filePath.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {file.originalName || file.filePath.split('/').pop()}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
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

export default InwardStaffLetters;