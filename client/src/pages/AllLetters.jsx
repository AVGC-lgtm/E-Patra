import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEye, FiDownload, FiRefreshCw, FiSearch, FiCheck, FiX, FiExternalLink } from 'react-icons/fi';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import translations from '../translations';
const apiUrl = import.meta.env.VITE_API_URL ;

const AllLetters = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = translations[language] || translations['en'];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
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

  // Fetch letters from API
  const handleRefresh = async () => {
    setLoading(true);
    setError('');
    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        setError('Please login first');
        navigate('/login');
        return;
      }

      const response = await axios.get(`${apiUrl}/api/patras`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setLetters(response.data);
      
      // Load acknowledged status from localStorage
      const savedAcknowledged = localStorage.getItem('acknowledgedLetters');
      if (savedAcknowledged) {
        setAcknowledgedLetters(new Set(JSON.parse(savedAcknowledged)));
      }
    } catch (err) {
      console.error('Error fetching letters:', err);
      
      // Handle authentication errors
      if (err.response?.status === 401) {
        setError('Authentication failed. Please login again.');
        sessionStorage.removeItem('token');
        navigate('/login');
        return;
      }
      
      setError('Failed to fetch letters. Please try again.');
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
      // Save to localStorage
      localStorage.setItem('acknowledgedLetters', JSON.stringify(Array.from(newAcknowledged)));
      return newAcknowledged;
    });
  };

  const handleDownload = async (filePath, originalName) => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        setError('Please login first');
        navigate('/login');
        return;
      }

      const response = await axios({
        url: `${apiUrl}/${filePath.replace(/\\/g, '/')}`,
        method: 'GET',
        responseType: 'blob',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', originalName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);
      
      // Handle authentication errors
      if (error.response?.status === 401) {
        setError('Authentication failed. Please login again.');
        sessionStorage.removeItem('token');
        navigate('/login');
        return;
      }
      
      setError('Failed to download file. Please try again.');
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
      letter.letterType,
      letter.receivedByOffice,
      letter.recipientNameAndDesignation,
      letter.office,
      letter.letterStatus,
      letter.subjectAndDetails
    ].join(' ').toLowerCase();
    
    const matchesSearch = searchTerm === '' || 
      searchableFields.includes(searchTerm.toLowerCase());
      
    const matchesStatus = statusFilter === 'All' || 
      (letter.letterStatus && 
       letter.letterStatus.toLowerCase() === statusFilter.toLowerCase());
      
    return matchesSearch && matchesStatus;
  });

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) {
      return dateString; // Return as is if date parsing fails
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">
          {language === 'mr' ? 'सर्व अर्ज' : 'All Letters'}
        </h1>
        <button 
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors text-sm sm:text-base"
          disabled={loading}
        >
          {loading ? (
            <>
              <FiRefreshCw className="animate-spin" /> {language === 'mr' ? 'लोड होत आहे...' : 'Loading...'}
            </>
          ) : (
            <>
              <FiRefreshCw /> {language === 'mr' ? 'रिफ्रेश करा' : 'Refresh'}
            </>
          )}
        </button>
      </div>
      
      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="relative w-full md:w-1/3">
          <input
            type="text"
            placeholder={language === 'mr' ? 'अर्ज शोधा...' : 'Search letters...'}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <FiSearch className="absolute left-3 top-3 text-gray-400" />
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <select
            className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
          <p>{error}</p>
        </div>
      )}

      {/* Letters Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center items-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'संदर्भ क्रमांक' : 'Reference No'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'तारीख' : 'Date'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'प्राप्तकर्ता' : 'Received By'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'प्राप्तकर्त्याचे नाव' : 'Recipient'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'कार्यालय' : 'Office'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'विषय' : 'Subject'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'स्थिती' : 'Status'}
                  </th>
                  
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'क्रिया' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLetters.length > 0 ? (
                  filteredLetters.map((letter) => (
                    <tr key={letter._id || letter.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-800">
                        <button 
                          onClick={() => navigate(`/dashboard/track-application/${letter.referenceNumber}`)}
                          className="flex items-center hover:underline"
                          title={language === 'mr' ? 'अर्ज ट्रॅक करा' : 'Track Application'}
                        >
                          {letter.referenceNumber || 'N/A'}
                          <FiExternalLink className="ml-1 h-4 w-4" />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(letter.letterDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {letter.receivedByOffice?.trim() || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {letter.recipientNameAndDesignation?.split(' - ')[0] || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {letter.office || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {letter.subjectAndDetails?.split(':')[0] || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          letter.letterStatus?.toLowerCase() === 'approved' ? 'bg-green-100 text-green-800' :
                          letter.letterStatus?.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          letter.letterStatus?.toLowerCase() === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {letter.letterStatus ? 
                            letter.letterStatus.charAt(0).toUpperCase() + letter.letterStatus.slice(1) : 
                            'N/A'}
                        </span>
                      </td>
              
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-3">
                          <button 
                            className="text-blue-500 hover:text-blue-700"
                            title={language === 'mr' ? 'तपशील पहा' : 'View Details'}
                          >
                            <FiEye size={18} />
                          </button>
                          {letter.letterFiles?.length > 0 ? (
                            <button 
                              className="text-gray-500 hover:text-gray-700"
                              title={language === 'mr' ? 'डाउनलोड करा' : 'Download'}
                              onClick={() => handleDownload(
                                letter.letterFiles[0].filePath, 
                                letter.letterFiles[0].originalName
                              )}
                            >
                              <FiDownload size={18} />
                            </button>
                          ) : (
                            <span 
                              className="text-gray-300 cursor-not-allowed" 
                              title={language === 'mr' ? 'फाइल उपलब्ध नाही' : 'No file available'}
                            >
                              <FiDownload size={18} />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                      {searchTerm || statusFilter !== 'All' 
                        ? (language === 'mr' 
                            ? 'जुळणारी पत्रे सापडली नाहीत' 
                            : 'No matching letters found')
                        : (language === 'mr'
                            ? 'कोणतीही पत्रे उपलब्ध नाहीत. डेटा लोड करण्यासाठी "रिफ्रेश" वर क्लिक करा.'
                            : 'No letters available. Click "Refresh" to load data.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllLetters;
