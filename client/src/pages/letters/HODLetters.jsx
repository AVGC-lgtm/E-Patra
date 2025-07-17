import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEye, FiRefreshCw, FiSearch, FiCheck, FiX, FiFileText } from 'react-icons/fi';
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

  // Status filter options with translations
  const statusOptions = [
    { value: 'All', label: language === 'mr' ? 'सर्व स्थिती' : 'All Status' },
    { value: 'pending', label: language === 'mr' ? 'प्रलंबित' : 'Pending' },
    { value: 'approved', label: language === 'mr' ? 'मंजूर' : 'Approved' },
    { value: 'rejected', label: language === 'mr' ? 'नाकारले' : 'Rejected' }
  ];

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
        timeout: 10000
      });
      
      if (response.data && Array.isArray(response.data)) {
        console.log('Letters received:', response.data);
        setLetters(response.data);
      } else {
        throw new Error('Invalid data format received from server');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 
                         err.message || 
                         'Failed to fetch letters. Please check your connection and try again.';
      setError(errorMessage);
      console.error('Error fetching letters:', err);
      setLetters([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    handleRefresh();
  }, []);

  // Filter letters based on search term and status
  const filteredLetters = letters.filter(letter => {
    const searchableFields = [
      letter.referenceNumber,
      letter.senderNameAndDesignation,
      letter.officeSendingLetter,
      letter.subject
    ].join(' ').toLowerCase();

    const matchesSearch = searchTerm === '' || 
      searchableFields.includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || 
      letter.letterStatus === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
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
      approved: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        label: language === 'mr' ? 'मंजूर' : 'Approved'
      },
      rejected: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        label: language === 'mr' ? 'नाकारले' : 'Rejected'
      }
    };

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
      // API call to approve letter
      console.log('Approving letter:', letterId);
      // await axios.put(`http://localhost:5000/api/patras/${letterId}/approve`);
      alert(language === 'mr' ? 'पत्र मंजूर केले!' : 'Letter approved!');
      handleRefresh();
    } catch (error) {
      console.error('Error approving letter:', error);
      alert(language === 'mr' ? 'पत्र मंजूर करण्यात त्रुटी!' : 'Error approving letter!');
    }
  };

  // Handle reject action
  const handleReject = async (letterId) => {
    try {
      // API call to reject letter
      console.log('Rejecting letter:', letterId);
      // await axios.put(`http://localhost:5000/api/patras/${letterId}/reject`);
      alert(language === 'mr' ? 'पत्र नाकारले!' : 'Letter rejected!');
      handleRefresh();
    } catch (error) {
      console.error('Error rejecting letter:', error);
      alert(language === 'mr' ? 'पत्र नाकारण्यात त्रुटी!' : 'Error rejecting letter!');
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {language === 'mr' ? 'HOD पत्रे' : 'HOD Letters'}
          </h1>
          <p className="text-gray-500">
            {language === 'mr' 
              ? 'सर्व पत्रे पहा आणि व्यवस्थापित करा' 
              : 'View and manage all letters'}
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
                          
                          {letter.letterStatus?.toLowerCase() === 'pending' && (
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
                ? 'कोणतीही पत्रे आढळली नाहीत. कृपया आपली शोध बदला.' 
                : 'No letters found. Please try changing your search.'}
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
            <div className="flex flex-col gap-6">
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {language === 'mr' ? 'संदर्भ क्रमांक' : 'Reference Number'}
                </div>
                <div className="text-lg text-gray-800 font-medium">
                  {selectedLetter.referenceNumber || 'N/A'}
                </div>
              </div>
              <div className="border-b border-blue-100" />
              
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {language === 'mr' ? 'अर्जदाराचे नाव व पदनाम' : 'Applicant Name & Designation'}
                </div>
                <div className="text-lg text-gray-800 font-medium">
                  {selectedLetter.senderNameAndDesignation || 'N/A'}
                </div>
              </div>
              <div className="border-b border-blue-100" />
              
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {language === 'mr' ? 'पत्र पाठविणारे कार्यालय' : 'Sender Office'}
                </div>
                <div className="text-lg text-gray-800 font-medium">
                  {selectedLetter.officeSendingLetter || 'N/A'}
                </div>
              </div>
              <div className="border-b border-blue-100" />
              
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {language === 'mr' ? 'विषय' : 'Subject'}
                </div>
                <div className="text-lg text-gray-800 font-medium">
                  {selectedLetter.subject || 'N/A'}
                </div>
              </div>
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

export default HODLetters;
