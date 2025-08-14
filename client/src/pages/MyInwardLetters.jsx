import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiEye, FiDownload, FiSearch, FiRefreshCw, FiFileText } from 'react-icons/fi';
import { useLanguage } from '../context/LanguageContext';
import { toast } from 'react-toastify';
const apiUrl = import.meta.env.VITE_API_URL ;

const MyInwardLetters = () => {
  const [letters, setLetters] = useState([]);
  const [filteredLetters, setFilteredLetters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  
  const { language } = useLanguage();
  const recordsPerPage = 10;



  // Fetch user's letters
  const fetchMyLetters = async () => {
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
      setLetters(sortedData);
      setFilteredLetters(sortedData);
      setError(null);
    } catch (err) {
      console.error('Error fetching letters:', err);
      setError(language === 'mr' ? 'पत्रे लोड करण्यात अयशस्वी' : 'Failed to load letters');
      setLetters([]);
      setFilteredLetters([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter letters based on search
  useEffect(() => {
    let filtered = letters;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(letter =>
        (letter.referenceNumber && letter.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (letter.subject && letter.subject.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (letter.senderNameAndDesignation && letter.senderNameAndDesignation.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredLetters(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [letters, searchTerm]);

  // Load data on component mount
  useEffect(() => {
    fetchMyLetters();
  }, []);



  // Pagination calculations
  const totalPages = Math.ceil(filteredLetters.length / recordsPerPage);
  const paginatedLetters = filteredLetters.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  // Handle file preview
  const handleFilePreview = async (letter) => {
    try {
      let fileUrl = null;
      
      // First check if letter has upload data with fileUrl
      if (letter.upload && letter.upload.fileUrl) {
        fileUrl = letter.upload.fileUrl;
      } else if (letter.fileId) {
        // Get file URL from API
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${apiUrl}/api/files/${letter.fileId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch file');
        }
        
        const fileData = await response.json();
        if (fileData.success && fileData.file) {
          fileUrl = fileData.file.fileUrl || fileData.file.url;
        }
      }
      
      if (fileUrl) {
        window.open(fileUrl, '_blank');
      } else {
        toast.error(language === 'mr' ? 'फाइल उपलब्ध नाही' : 'File not available');
      }
    } catch (error) {
      console.error('Error previewing file:', error);
      toast.error(language === 'mr' ? 'फाइल पहाण्यात त्रुटी!' : 'Error viewing file!');
    }
  };

  // Handle covering letter view
  const handleViewCoveringLetter = (letter) => {
    try {
      const coveringLetter = letter.coveringLetter || letter.directCoveringLetter;
      
      if (!coveringLetter) {
        toast.error(language === 'mr' ? 'कव्हरिंग लेटर उपलब्ध नाही' : 'Covering letter not available');
        return;
      }
      
      // Prefer Word over PDF over HTML
      const url = coveringLetter.wordUrl || 
                  coveringLetter.documentUrls?.word || 
                  coveringLetter.pdfUrl || 
                  coveringLetter.htmlUrl;
      
      if (url) {
        window.open(url, '_blank');
      } else {
        toast.error(language === 'mr' ? 'कव्हरिंग लेटर फाइल उपलब्ध नाही' : 'Covering letter file not available');
      }
    } catch (error) {
      console.error('Error viewing covering letter:', error);
      toast.error(language === 'mr' ? 'कव्हरिंग लेटर पहाण्यात त्रुटी!' : 'Error viewing covering letter!');
    }
  };

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
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {language === 'mr' ? 'माझी पत्रे' : 'My Letters'}
          </h1>
          <p className="text-gray-500">
            {language === 'mr' ? 
              'तुमच्या सबमिट केलेल्या पत्रांची यादी' : 
              'List of your submitted letters'}
          </p>
        </div>
        
        {/* Controls */}
        <div className="mt-4 md:mt-0 flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder={language === 'mr' ? 'शोधा...' : 'Search...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          

          
          {/* Refresh Button */}
          <button
            onClick={fetchMyLetters}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FiRefreshCw className="mr-2 h-4 w-4" />
            {language === 'mr' ? 'रिफ्रेश' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {filteredLetters.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                      {language === 'mr' ? 'अनुक्रमांक' : 'Sr No'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                      {language === 'mr' ? 'संदर्भ क्रमांक' : 'Reference No'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                      {language === 'mr' ? 'विषय' : 'Subject'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                      {language === 'mr' ? 'दिनांक' : 'Date'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                      {language === 'mr' ? 'फॉरवर्ड टू' : 'Forward To'}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-blue-900 uppercase tracking-wider">
                      {language === 'mr' ? 'कव्हरिंग लेटर' : 'Covering Letter'}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-blue-900 uppercase tracking-wider">
                      {language === 'mr' ? 'क्रिया' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedLetters.map((letter, index) => (
                    <tr key={letter._id || letter.id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(currentPage - 1) * recordsPerPage + index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {letter.referenceNumber || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {letter.subject || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {letter.createdAt ? new Date(letter.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {letter.forwardTo ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {letter.forwardTo}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">
                            {language === 'mr' ? 'निर्धारित नाही' : 'Not Assigned'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {letter.coveringLetter || letter.directCoveringLetter ? (
                          <button
                            onClick={() => handleViewCoveringLetter(letter)}
                            className="inline-flex items-center px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
                            title={language === 'mr' ? 'कव्हरिंग लेटर पहा' : 'View Covering Letter'}
                          >
                            <FiEye className="h-3 w-3 mr-1" />
                            {language === 'mr' ? 'पहा' : 'View'}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">
                            {language === 'mr' ? 'उपलब्ध नाही' : 'Not Available'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex justify-center space-x-2">
                          {/* View Details */}
                          <button
                            onClick={() => {
                              setSelectedLetter(letter);
                              setViewModalOpen(true);
                            }}
                            className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                            title={language === 'mr' ? 'तपशील पहा' : 'View Details'}
                          >
                            <FiEye className="h-3 w-3 mr-1" />
                            {language === 'mr' ? 'पहा' : 'View'}
                          </button>
                          
                          {/* Download File */}
                          <button
                            onClick={() => handleFilePreview(letter)}
                            className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                            title={language === 'mr' ? 'फाइल पहा' : 'View File'}
                          >
                            <FiDownload className="h-3 w-3 mr-1" />
                            {language === 'mr' ? 'फाइल' : 'File'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    {language === 'mr' ? 'मागील' : 'Previous'}
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    {language === 'mr' ? 'पुढील' : 'Next'}
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      {language === 'mr' ? 'दाखवत आहे' : 'Showing'}{' '}
                      <span className="font-medium">{(currentPage - 1) * recordsPerPage + 1}</span>
                      {' '}{language === 'mr' ? 'ते' : 'to'}{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * recordsPerPage, filteredLetters.length)}
                      </span>
                      {' '}{language === 'mr' ? 'पैकी' : 'of'}{' '}
                      <span className="font-medium">{filteredLetters.length}</span>
                      {' '}{language === 'mr' ? 'परिणाम' : 'results'}
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {language === 'mr' ? 'मागील' : 'Previous'}
                      </button>
                      <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        {language === 'mr' ? 'पृष्ठ' : 'Page'} {currentPage} {language === 'mr' ? 'पैकी' : 'of'} {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {language === 'mr' ? 'पुढील' : 'Next'}
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <FiFileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {language === 'mr' ? 'कोणतीही पत्रे सापडली नाहीत' : 'No letters found'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {language === 'mr' ? 
                'तुम्ही अजून कोणतीही अर्ज सबमिट केलेली नाहीत.' : 
                'You haven\'t submitted any letters yet.'}
            </p>
          </div>
        )}
      </div>

      {/* View Letter Modal */}
      {viewModalOpen && selectedLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {language === 'mr' ? 'पत्राचे तपशील' : 'Letter Details'}
              </h2>
              <button
                onClick={() => setViewModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(() => {
                // Define only the form fields that users actually fill out
                const formFields = [
                  { key: 'referenceNumber', label: language === 'mr' ? 'संदर्भ क्रमांक' : 'Reference Number' },
                  { key: 'dateOfReceiptOfLetter', label: language === 'mr' ? 'पत्र प्राप्तीची तारीख' : 'Date of Receipt of Letter' },
                  { key: 'officeSendingLetter', label: language === 'mr' ? 'पत्र पाठविणारे कार्यालय' : 'Office Sending Letter' },
                  { key: 'senderNameAndDesignation', label: language === 'mr' ? 'प्रेषकाचे नाव व पदनाम' : 'Sender Name & Designation' },
                  { key: 'mobileNumber', label: language === 'mr' ? 'मोबाईल नंबर' : 'Mobile Number' },
                  { key: 'letterMedium', label: language === 'mr' ? 'पत्र माध्यम' : 'Letter Medium' },
                  { key: 'letterClassification', label: language === 'mr' ? 'पत्र वर्गीकरण' : 'Letter Classification' },
                  { key: 'letterType', label: language === 'mr' ? 'पत्र प्रकार' : 'Letter Type' },
                  { key: 'letterDate', label: language === 'mr' ? 'पत्राची तारीख' : 'Letter Date' },
                  { key: 'subject', label: language === 'mr' ? 'विषय' : 'Subject' },
                  { key: 'outwardLetterNumber', label: language === 'mr' ? 'बाह्य पत्र क्रमांक' : 'Outward Letter Number' },
                  { key: 'numberOfCopies', label: language === 'mr' ? 'प्रतींची संख्या' : 'Number of Copies' },
                  { key: 'forwardTo', label: language === 'mr' ? 'फॉरवर्ड टू' : 'Forward To' }
                ];

                return formFields
                  .filter(field => selectedLetter[field.key] != null && selectedLetter[field.key] !== '')
                  .map(field => (
                    <div key={field.key} className="border-b border-gray-100 pb-3">
                      <dt className="text-sm font-medium text-gray-600 mb-1">
                        {field.label}
                      </dt>
                      <dd className="text-sm text-gray-900">
                        {field.key === 'letterDate' || field.key === 'dateOfReceiptOfLetter' 
                          ? (selectedLetter[field.key] ? new Date(selectedLetter[field.key]).toLocaleDateString() : 'N/A')
                          : (selectedLetter[field.key] || 'N/A')
                        }
                      </dd>
                    </div>
                  ));
              })()}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setViewModalOpen(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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

export default MyInwardLetters; 