import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import translations from '../translations';
import { 
  FiUpload, 
  FiPaperclip, 
  FiX, 
  FiPlus, 
  FiRefreshCw, 
  FiFileText 
} from 'react-icons/fi';

// Format file size helper function
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const TrackApplication = () => {
  const { referenceNumber: refNumber } = useParams();
  const navigate = useNavigate();
  const [referenceNumber, setReferenceNumber] = useState(refNumber || '');
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(!!refNumber);
  const [error, setError] = useState('');
  const { language } = useLanguage();
  const t = translations[language] || translations['en'];
  const [mainFiles, setMainFiles] = useState([]);

  const handleMainFileChange = (e) => {
    setMainFiles(Array.from(e.target.files));
  };

  const extractTextFromFile = async (file) => {
    // Implement your file text extraction logic here
    console.log('Extracting text from:', file.name);
  };

  useEffect(() => {
    if (refNumber) {
      setReferenceNumber(refNumber);
      fetchApplication(refNumber);
    } else {
      setApplication(null);
      setLoading(false);
    }
  }, [refNumber]);

  const fetchApplication = async (ref) => {
    if (!ref) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get(`http://localhost:5000/api/patras?referenceNumber=${ref}`);
      if (response.data && response.data.length > 0) {
        setApplication(response.data[0]);
      } else {
        setError(language === 'mr' ? 'कोणतेही अर्ज सापडले नाहीत' : 'No applications found');
        setApplication(null);
      }
    } catch (err) {
      console.error('Error fetching application:', err);
      setError(language === 'mr' 
        ? 'अर्ज लोड करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.' 
        : 'Error loading application. Please try again.'
      );
      setApplication(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (referenceNumber.trim()) {
      navigate(`/dashboard/track-application/${referenceNumber}`);
    }
  };

  const getStatusStep = (status) => {
    const statusMap = {
      'pending': 1,
      'in_review': 2,
      'processing': 3,
      'completed': 4
    };
    return statusMap[status?.toLowerCase()] || 0;
  };

  const statusSteps = [
    { id: 'received', label: language === 'mr' ? 'अर्ज प्राप्त' : 'Application Received' },
    { id: 'in_review', label: language === 'mr' ? 'पुनरावलोकनात' : 'In Review' },
    { id: 'processing', label: language === 'mr' ? 'प्रक्रियेत' : 'Processing' },
    { id: 'completed', label: language === 'mr' ? 'पूर्ण' : 'Completed' }
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        {language === 'mr' ? 'अर्ज ट्रॅक करा' : 'Track Application'}
      </h1>
      
 

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {language === 'mr' ? 'तुमच्या अर्जाची स्थिती तपासा' : 'Track Your Application Status'}
          </h2>
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              value={referenceNumber || ''}
              onChange={(e) => setReferenceNumber(e.target.value)}
              readOnly={!!refNumber}
              placeholder={language === 'mr' ? 'अर्ज/संदर्भ क्रमांक प्रविष्ट करा' : 'Enter Application/Reference Number'}
              className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
            />
            <button 
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
              disabled={loading}
            >
              {loading 
                ? (language === 'mr' ? 'तपासत आहे...' : 'Checking...') 
                : (language === 'mr' ? 'तपासा' : 'Track')}
            </button>
          </form>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        ) : application ? (
          <div className="space-y-6">
            {/* Application Details */}
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-semibold mb-3">
                {language === 'mr' ? 'अर्जाची माहिती' : 'Application Details'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">
                    {language === 'mr' ? 'संदर्भ क्रमांक' : 'Reference Number'}
                  </p>
                  <p className="font-medium">{application.referenceNumber || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    {language === 'mr' ? 'अर्जाची तारीख' : 'Application Date'}
                  </p>
                  <p className="font-medium">
                    {new Date(application.letterDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    {language === 'mr' ? 'विषय' : 'Subject'}
                  </p>
                  <p className="font-medium">
                    {application.subject?.split(':')[0] || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    {language === 'mr' ? 'पत्र पाठविण्याऱ्याचे नाव व पदनाम' : 'Name and designation of the sender'}
                  </p>
                  <p className="font-medium capitalize">
                    {application.senderNameAndDesignation?.toLowerCase() || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-semibold mb-4">
                {language === 'mr' ? 'अर्जाची प्रगती' : 'Application Progress'}
              </h3>
              <div className="space-y-4">
                {statusSteps.map((step, index) => {
                  const currentStep = getStatusStep(application.letterStatus);
                  const isCompleted = index < currentStep;
                  const isCurrent = index === currentStep - 1;
                  
                  return (
                    <div key={step.id} className="flex items-center">
                      <div className={`h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center mr-3 ${
                        isCompleted 
                          ? 'bg-green-100 text-green-600' 
                          : isCurrent 
                            ? 'bg-blue-100 text-blue-600' 
                            : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isCompleted ? (
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <span className="font-medium">{index + 1}</span>
                        )}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${
                          isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'
                        }`}>
                          {step.label}
                        </p>
                        {isCurrent && (
                          <p className="text-xs text-blue-600 mt-1">
                            {language === 'mr' 
                              ? 'सध्या प्रक्रियेत आहे' 
                              : 'Currently in progress'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 p-6 rounded-lg">
            <p className="text-gray-600">
              {language === 'mr' 
                ? 'तुमचा अर्ज/संदर्भ क्रमांक वरून तपासणी करण्यासाठी वर इनपुट करा.' 
                : 'Enter your application/reference number above to check status.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackApplication;