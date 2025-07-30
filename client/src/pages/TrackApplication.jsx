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
  FiFileText,
  FiEye,
  FiDownload,
  FiClock,
  FiUser,
  FiMail,
  FiPhone,
  FiCalendar,
  FiFolder,
  FiCheckCircle
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
      // Use the specific route for getting patra by reference number
      const response = await axios.get(`http://localhost:5000/api/patras/reference/${ref}`);
      console.log('Full API response:', response.data);
      
      // Handle the API response structure
      let applicationData = null;
      if (response.data && response.data.patra) {
        // Single patra response from getPatraByReferenceNumber
        applicationData = response.data.patra;
        console.log('Using single patra from response:', applicationData);
      } else if (response.data && response.data.patras && Array.isArray(response.data.patras)) {
        // Multiple patras response (fallback)
        applicationData = response.data.patras[0];
        console.log('Using first patra from array:', applicationData);
      } else if (response.data && typeof response.data === 'object' && response.data.id) {
        // Direct patra object response (fallback)
        applicationData = response.data;
        console.log('Using direct patra object:', applicationData);
      } else if (response.data && response.data.data && typeof response.data.data === 'object' && response.data.data.id) {
        // Handle { success, message, data: { ...patra } } structure
        applicationData = response.data.data;
        console.log('Using patra from response.data.data:', applicationData);
      } else {
        console.error('Unexpected response structure:', response.data);
        throw new Error('Invalid data format received from server');
      }
      
      if (applicationData) {
        console.log('Application data received:', applicationData);
        setApplication(applicationData);
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

  // Get status step based on actual letterStatus from API
  const getStatusStep = (status, forwardTo, sentTo) => {
    const statusLower = status?.toLowerCase() || '';
    
    // Check if case is closed (highest priority)
    if (statusLower.includes('case close') || statusLower.includes('केस बंद')) {
      return 5; // New final step for case closure
    }
    
    // Check if letter is sent to head for signing
    if (statusLower.includes('head sign') || forwardTo === 'head') {
      return 3;
    }
    
    // Check if letter is forwarded to any table
    if (forwardTo && forwardTo !== 'head') {
      return 2;
    }
    
    // Check if letter has been processed and signed
    if (statusLower.includes('approved') || statusLower.includes('completed') || statusLower.includes('signed')) {
      return 4;
    }
    
    const statusMap = {
      'received': 1,
      'pending': 1,
      'in_review': 2,
      'forwarded': 2,
      'processing': 2,
      'sending for head sign': 3,
      'sent to head': 3,
      'प्रमुखांकडे पाठवले': 3,
      'approved': 4,
      'completed': 4,
      'signed': 4,
      'case close': 5,
      'केस बंद': 5,
      'rejected': 0,
      'return': 0,
      'return_received': 0
    };
    return statusMap[statusLower] || 1;
  };

  // Get status badge styling
  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase() || 'pending';
    
    const statusConfig = {
      'received': { bg: 'bg-blue-100', text: 'text-blue-800', label: language === 'mr' ? 'प्राप्त' : 'Received' },
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: language === 'mr' ? 'प्रलंबित' : 'Pending' },
      'in_review': { bg: 'bg-purple-100', text: 'text-purple-800', label: language === 'mr' ? 'पुनरावलोकनात' : 'In Review' },
      'forwarded': { bg: 'bg-cyan-100', text: 'text-cyan-800', label: language === 'mr' ? 'पुढे पाठवले' : 'Forwarded' },
      'processing': { bg: 'bg-orange-100', text: 'text-orange-800', label: language === 'mr' ? 'प्रक्रियेत' : 'Processing' },
      'sending for head sign': { bg: 'bg-pink-100', text: 'text-pink-800', label: language === 'mr' ? 'प्रमुख स्वाक्षरीसाठी' : 'For Head Sign' },
      'sent to head': { bg: 'bg-pink-100', text: 'text-pink-800', label: language === 'mr' ? 'प्रमुखांकडे पाठवले' : 'Sent to Head' },
      'प्रमुखांकडे पाठवले': { bg: 'bg-pink-100', text: 'text-pink-800', label: language === 'mr' ? 'प्रमुखांकडे पाठवले' : 'Sent to Head' },
      'approved': { bg: 'bg-green-100', text: 'text-green-800', label: language === 'mr' ? 'मंजूर' : 'Approved' },
      'completed': { bg: 'bg-green-100', text: 'text-green-800', label: language === 'mr' ? 'पूर्ण' : 'Completed' },
      'case close': { bg: 'bg-gray-100', text: 'text-gray-800', label: language === 'mr' ? 'केस बंद' : 'Case Closed' },
      'केस बंद': { bg: 'bg-gray-100', text: 'text-gray-800', label: language === 'mr' ? 'केस बंद' : 'Case Closed' },
      'rejected': { bg: 'bg-red-100', text: 'text-red-800', label: language === 'mr' ? 'नाकारले' : 'Rejected' },
      'return': { bg: 'bg-red-100', text: 'text-red-800', label: language === 'mr' ? 'परतावा' : 'Returned' },
      'return_received': { bg: 'bg-gray-100', text: 'text-gray-800', label: language === 'mr' ? 'परतावा प्राप्त' : 'Return Received' }
    };

    const config = statusConfig[statusLower] || statusConfig.pending;
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  // Dynamic status steps based on actual letter journey
  const getStatusSteps = (application) => {
    const steps = [
      { 
        id: 'received', 
        label: language === 'mr' ? 'अर्ज प्राप्त' : 'Application Received',
        date: application?.dateOfReceiptOfLetter || application?.createdAt,
        description: language === 'mr' ? 'पत्र प्राप्त झाले आणि सिस्टममध्ये नोंदवले' : 'Letter received and registered in system'
      }
    ];

    // Add forwarding step if letter was forwarded
    if (application?.forwardTo && application.forwardTo !== 'head') {
      steps.push({
        id: 'forwarded',
        label: language === 'mr' ? 'पुढे पाठवले' : 'Forwarded',
        date: application?.updatedAt,
        description: language === 'mr' ? `${application.forwardTo} टेबलला पाठवले` : `Forwarded to ${application.forwardTo} table`
      });
    }

    // Add head signing step if letter was sent to head
    if (application?.forwardTo === 'head' || application?.letterStatus?.toLowerCase().includes('head sign')) {
      steps.push({
        id: 'head_sign',
        label: language === 'mr' ? 'प्रमुख स्वाक्षरीसाठी' : 'Sent for Head Signature',
        date: application?.updatedAt,
        description: language === 'mr' ? 'प्रमुखांकडे स्वाक्षरीसाठी पाठवले' : 'Sent to head for signature'
      });
    }

    // Check if case is closed
    const isCaseClosed = application?.letterStatus?.toLowerCase().includes('case close') || 
                         application?.letterStatus?.toLowerCase().includes('केस बंद') ||
                         application?.inwardPatraClose === true;

    if (isCaseClosed) {
      // Add completion step (signature completed)
      steps.push({
        id: 'completed',
        label: language === 'mr' ? 'स्वाक्षरी पूर्ण' : 'Signature Completed',
        date: application?.coveringLetter?.generatedAt || application?.updatedAt,
        description: language === 'mr' ? 'स्वाक्षरी पूर्ण झाली' : 'Process completed with signature'
      });

      // Add case closure step
      steps.push({
        id: 'case_closed',
        label: language === 'mr' ? 'केस बंद' : 'Case Closed',
        date: application?.caseClosedAt || application?.updatedAt,
        description: language === 'mr' ? 'रिपोर्ट अपलोड केल्यानंतर केस बंद केली' : 'Case closed after report upload'
      });
    } else {
      // Add completion step (regular completion logic)
      const isCompleted = application?.letterStatus?.toLowerCase().includes('approved') || 
                         application?.letterStatus?.toLowerCase().includes('completed') ||
                         application?.coveringLetter?.isSigned;
      
      steps.push({
        id: 'completed',
        label: language === 'mr' ? 'पूर्ण' : 'Completed',
        date: isCompleted ? (application?.coveringLetter?.generatedAt || application?.updatedAt) : null,
        description: isCompleted ? 
          (language === 'mr' ? 'स्वाक्षरी पूर्ण' : 'Process completed with signature') :
          (language === 'mr' ? 'प्रक्रिया सुरू आहे' : 'Process in progress')
      });
    }

    return steps;
  };

  const statusSteps = getStatusSteps(application);

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(language === 'mr' ? 'mr-IN' : 'en-US');
    } catch (e) {
      return 'Invalid Date';
    }
  };

  // Function to get file URL from API
  const getFileUrlFromId = async (fileId) => {
    try {
      console.log('Fetching file URL for ID:', fileId);
      
      const response = await fetch(`http://localhost:5000/api/files/${fileId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }
      
      const fileData = await response.json();
      console.log('File data received:', fileData);
      
      if (fileData.success && fileData.file) {
        return {
          url: fileData.file.fileUrl || fileData.file.url,
          originalName: fileData.file.originalName
        };
      }
      
      return null;
      
    } catch (error) {
      console.error('Error fetching file URL:', error);
      return null;
    }
  };

  // Function to preview file
  const previewFile = async (application) => {
    try {
      let fileUrl = null;
      
      // First check if application has upload data with fileUrl
      if (application.upload && application.upload.fileUrl) {
        fileUrl = application.upload.fileUrl;
      } else if (application.fileId) {
        // Get file URL from API
        const fileInfo = await getFileUrlFromId(application.fileId);
        if (fileInfo && fileInfo.url) {
          fileUrl = fileInfo.url;
        }
      }
      
      if (fileUrl) {
        window.open(fileUrl, '_blank');
      } else {
        alert(language === 'mr' ? 'फाइल उपलब्ध नाही' : 'File not available');
      }
    } catch (error) {
      console.error('Error previewing file:', error);
      alert(language === 'mr' ? 'फाइल पहाण्यात त्रुटी!' : 'Error viewing file!');
    }
  };

  return (
    <div className="p-6 max-w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          {language === 'mr' ? 'अर्ज ट्रॅक करा' : 'Track Application'}
        </h1>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiRefreshCw className="h-4 w-4" />
          {language === 'mr' ? 'रिफ्रेश' : 'Refresh'}
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FiFileText className="h-5 w-5 text-blue-600" />
            {language === 'mr' ? 'तुमच्या अर्जाची स्थिती तपासा' : 'Track Your Application Status'}
          </h2>
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={referenceNumber || ''}
                onChange={(e) => setReferenceNumber(e.target.value)}
                readOnly={!!refNumber}
                placeholder={language === 'mr' ? 'अर्ज/संदर्भ क्रमांक प्रविष्ट करा' : 'Enter Application/Reference Number'}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
              <FiFileText className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
            </div>
            <button 
              type="submit"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              disabled={loading}
            >
              {loading 
                ? (language === 'mr' ? 'तपासत आहे...' : 'Checking...') 
                : (language === 'mr' ? 'तपासा' : 'Track')}
            </button>
          </form>
        </div>
        
        {loading ? (
          <div className="flex flex-col justify-center items-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-600">
              {language === 'mr' ? 'माहिती लोड होत आहे...' : 'Loading information...'}
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-lg">
            <div className="flex items-center">
              <FiX className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        ) : application ? (
          <div className="space-y-6">
            {/* Application Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-blue-900 mb-2">
                    {language === 'mr' ? 'अर्ज क्रमांक' : 'Application'} #{application.referenceNumber}
                  </h3>
                  <p className="text-blue-700 font-medium">
                    {application.subject || 'N/A'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {getStatusBadge(application.letterStatus)}
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <FiCalendar className="h-4 w-4" />
                    {formatDate(application.dateOfReceiptOfLetter)}
                  </div>
                </div>
              </div>
            </div>

            {/* Application Details */}
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FiFolder className="h-5 w-5 text-blue-600" />
                {language === 'mr' ? 'अर्जाची माहिती' : 'Application Details'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <FiFileText className="h-4 w-4" />
                    {language === 'mr' ? 'संदर्भ क्रमांक' : 'Reference Number'}
                  </div>
                  <p className="font-medium text-gray-900">{application.referenceNumber || 'N/A'}</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <FiCalendar className="h-4 w-4" />
                    {language === 'mr' ? 'पत्राची तारीख' : 'Letter Date'}
                  </div>
                  <p className="font-medium text-gray-900">
                    {formatDate(application.letterDate)}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <FiCalendar className="h-4 w-4" />
                    {language === 'mr' ? 'प्राप्तीची तारीख' : 'Date of Receipt'}
                  </div>
                  <p className="font-medium text-gray-900">
                    {formatDate(application.dateOfReceiptOfLetter)}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <FiUser className="h-4 w-4" />
                    {language === 'mr' ? 'पाठविणाऱ्याचे नाव' : 'Sender Name'}
                  </div>
                  <p className="font-medium text-gray-900">
                    {application.senderNameAndDesignation || 'N/A'}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <FiMail className="h-4 w-4" />
                    {language === 'mr' ? 'पत्र पाठविणारे कार्यालय' : 'Sender Office'}
                  </div>
                  <p className="font-medium text-gray-900">
                    {application.officeSendingLetter || 'N/A'}
                  </p>
                </div>
                
                {application.mobileNumber && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <FiPhone className="h-4 w-4" />
                      {language === 'mr' ? 'मोबाईल नंबर' : 'Mobile Number'}
                    </div>
                    <p className="font-medium text-gray-900">
                      {application.mobileNumber}
                    </p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <FiFileText className="h-4 w-4" />
                    {language === 'mr' ? 'पत्राचे वर्गीकरण' : 'Letter Classification'}
                  </div>
                  <p className="font-medium text-gray-900">
                    {application.letterClassification || 'N/A'}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <FiFileText className="h-4 w-4" />
                    {language === 'mr' ? 'पत्राचा प्रकार' : 'Letter Type'}
                  </div>
                  <p className="font-medium text-gray-900">
                    {application.letterType || 'N/A'}
                  </p>
                </div>
                
                {application.letterMedium && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <FiMail className="h-4 w-4" />
                      {language === 'mr' ? 'पत्राचे माध्यम' : 'Letter Medium'}
                    </div>
                    <p className="font-medium text-gray-900">
                      {application.letterMedium}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* File Attachments */}
            {(application.upload && application.upload.fileUrl) || application.fileId ? (
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FiPaperclip className="h-5 w-5 text-blue-600" />
                  {language === 'mr' ? 'संलग्न फाइल' : 'Attached File'}
                </h3>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FiFileText className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {application.upload?.originalName || `Application_${application.referenceNumber}.pdf`}
                      </p>
                      <p className="text-sm text-gray-500">
                        {language === 'mr' ? 'अपलोड केली गेली' : 'Uploaded'}: {formatDate(application.createdAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => await previewFile(application)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FiEye className="h-4 w-4" />
                    {language === 'mr' ? 'पहा' : 'View'}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Covering Letter Section */}
            {application.coveringLetter && application.coveringLetter.id ? (
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FiMail className="h-5 w-5 text-green-600" />
                  {language === 'mr' ? 'कव्हरिंग लेटर' : 'Covering Letter'}
                </h3>
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FiFileText className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {application.coveringLetter.letterContent ? 
                          (language === 'mr' ? 'कव्हरिंग लेटर सामग्री' : 'Covering Letter Content') :
                          `Covering_Letter_${application.referenceNumber}.pdf`
                        }
                      </p>
                      <p className="text-sm text-gray-500">
                        {language === 'mr' ? 'तयार केली गेली' : 'Generated'}: {formatDate(application.coveringLetter.generatedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {application.coveringLetter.pdfUrl && (
                      <button
                        onClick={() => window.open(application.coveringLetter.pdfUrl, '_blank')}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <FiEye className="h-4 w-4" />
                        {language === 'mr' ? 'पीडीएफ पहा' : 'View PDF'}
                      </button>
                    )}
                    {application.coveringLetter.letterContent && (
                      <button
                        onClick={() => {
                          // Create a modal or alert to show the letter content
                          const content = application.coveringLetter.letterContent;
                          alert(language === 'mr' ? 
                            'कव्हरिंग लेटर सामग्री:\n\n' + content :
                            'Covering Letter Content:\n\n' + content
                          );
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <FiFileText className="h-4 w-4" />
                        {language === 'mr' ? 'सामग्री पहा' : 'View Content'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Report Downloads Section */}
            {(application.letterStatus?.toLowerCase().includes('case close') || 
              application.letterStatus?.toLowerCase().includes('केस बंद') ||
              application.inwardPatraClose) && 
             application.reportFiles && 
             application.reportFiles !== '[]' && 
             application.reportFiles !== 'null' ? (
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FiDownload className="h-5 w-5 text-purple-600" />
                  {language === 'mr' ? 'अपलोड केलेले रिपोर्ट्स' : 'Uploaded Reports'}
                </h3>
                <div className="space-y-3">
                  {(() => {
                    try {
                      const reportFiles = JSON.parse(application.reportFiles);
                      return reportFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                              <FiFileText className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {file.originalName || `Report_${index + 1}.pdf`}
                              </p>
                              <p className="text-sm text-gray-500">
                                {file.size ? `${Math.round(file.size / 1024)} KB` : 'N/A'} • 
                                {file.mimetype || 'PDF'} • 
                                {language === 'mr' ? 'अपलोड केली गेली' : 'Uploaded'}: {formatDate(file.uploadedAt || application.reportUploadedAt)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => window.open(file.s3Url, '_blank')}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                          >
                            <FiDownload className="h-4 w-4" />
                            {language === 'mr' ? 'डाउनलोड' : 'Download'}
                          </button>
                        </div>
                      ));
                    } catch (error) {
                      console.error('Error parsing report files:', error);
                      return (
                        <div className="text-center py-4 text-gray-500">
                          <p>{language === 'mr' ? 'रिपोर्ट फाइल्स लोड करण्यात त्रुटी' : 'Error loading report files'}</p>
                        </div>
                      );
                    }
                  })()}
                </div>
                
                {/* Case Closure Information */}
                <div className="mt-4 pt-4 border-t border-purple-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-purple-700">
                      <FiCheckCircle className="h-4 w-4" />
                      <span className="font-medium">
                        {language === 'mr' ? 'केस स्थिती' : 'Case Status'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-semibold text-red-800 bg-red-100 px-2 py-1 rounded-full">
                        {language === 'mr' ? 'केस बंद' : 'CASE CLOSED'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {language === 'mr' 
                      ? 'रिपोर्ट अपलोड केल्यानंतर हे केस बंद केले गेले आहे.'
                      : 'This case has been closed after report upload.'}
                  </p>
                  {application.caseClosedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      {language === 'mr' ? 'बंद केली गेली' : 'Closed on'}: {formatDate(application.caseClosedAt)}
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {/* Status Timeline */}
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <FiClock className="h-5 w-5 text-blue-600" />
                {language === 'mr' ? 'अर्जाची प्रगती' : 'Application Progress'}
              </h3>
              <div className="space-y-6">
                {statusSteps.map((step, index) => {
                  const currentStep = getStatusStep(application.letterStatus, application.forwardTo, application.sentTo);
                  const isCompleted = index < currentStep;
                  const isCurrent = index === currentStep - 1;
                  
                  return (
                    <div key={step.id} className="flex items-start">
                      <div className={`h-12 w-12 flex-shrink-0 rounded-full flex items-center justify-center mr-4 ${
                        isCompleted 
                          ? 'bg-green-100 text-green-600 border-2 border-green-200' 
                          : isCurrent 
                            ? 'bg-blue-100 text-blue-600 border-2 border-blue-200' 
                            : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                      }`}>
                        {isCompleted ? (
                          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <span className="font-medium">{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-base font-semibold ${
                          isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'
                        }`}>
                          {step.label}
                        </p>
                        
                        {/* Show description for each step */}
                        <p className={`text-sm mt-1 ${
                          isCompleted || isCurrent ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          {step.description || step.label}
                        </p>
                        
                        {/* Show date/time for completed or current steps */}
                        {(isCompleted || isCurrent) && step.date && (
                          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                            <FiCalendar className="h-3 w-3" />
                            {formatDate(step.date)}
                          </p>
                        )}
                        
                        {/* Show current status indicator */}
                        {isCurrent && (
                          <div className="mt-2">
                            <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <div className="w-2 h-2 bg-blue-600 rounded-full mr-2 animate-pulse"></div>
                              {language === 'mr' ? 'सध्या प्रक्रियेत' : 'In Progress'}
                            </div>
                          </div>
                        )}
                        
                        {/* Show completion indicator */}
                        {isCompleted && (
                          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                            <FiCheckCircle className="h-3 w-3" />
                            {language === 'mr' ? 'पूर्ण झाले' : 'Completed'}
                          </p>
                        )}
                        
                        {/* Show real-time status information */}
                        {isCurrent && application.forwardTo && (
                          <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                            <p className="text-xs text-blue-700">
                              {language === 'mr' 
                                ? `सध्या ${application.forwardTo} येथे आहे`
                                : `Currently at ${application.forwardTo} table`}
                            </p>
                          </div>
                        )}
                      </div>
                      {index < statusSteps.length - 1 && (
                        <div className={`w-px h-16 ml-6 ${
                          isCompleted ? 'bg-green-300' : 'bg-gray-200'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current Status Display - Enhanced Real-time */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
                    {language === 'mr' ? 'सध्याची स्थिती' : 'Current Status'}
                  </h3>
                  
                  {/* Real-time status message */}
                  <div className="space-y-2">
                    <p className="text-blue-700 font-medium">
                      {application.letterStatus?.toLowerCase().includes('case close') || application.letterStatus?.toLowerCase().includes('केस बंद') || application.inwardPatraClose
                        ? (language === 'mr' ? 'तुमचा अर्ज पूर्ण झाला आहे आणि केस बंद केली आहे' : 'Your application has been completed and case has been closed')
                        : application.forwardTo === 'head' || application.letterStatus?.toLowerCase().includes('head sign')
                        ? (language === 'mr' ? 'तुमचा अर्ज प्रमुख स्वाक्षरीसाठी पाठवला गेला आहे' : 'Your application has been sent for head signature')
                        : application.forwardTo && application.forwardTo !== 'head'
                        ? (language === 'mr' ? `तुमचा अर्ज ${application.forwardTo} टेबलवर आहे` : `Your application is at ${application.forwardTo} table`)
                        : application.letterStatus?.toLowerCase().includes('completed') || application.coveringLetter?.isSigned
                        ? (language === 'mr' ? 'तुमचा अर्ज पूर्ण झाला आहे' : 'Your application has been completed')
                        : (language === 'mr' ? 'तुमचा अर्ज प्रक्रियेत आहे' : 'Your application is being processed')
                      }
                    </p>
                    
                    {/* Show additional context */}
                    {application.sentTo && (
                      <p className="text-sm text-blue-600">
                        {language === 'mr' ? 'विभाग: ' : 'Department: '}
                        {JSON.parse(application.sentTo).sourceTable || 'Processing'}
                      </p>
                    )}
                    
                    {/* Show signature status */}
                    {application.coveringLetter && (
                      <div className="flex items-center gap-2 mt-3">
                        <div className={`w-2 h-2 rounded-full ${application.coveringLetter.isSigned ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        <span className="text-sm">
                          {application.coveringLetter.isSigned 
                            ? (language === 'mr' ? 'स्वाक्षरी पूर्ण' : 'Signature Completed')
                            : (language === 'mr' ? 'स्वाक्षरी प्रलंबित' : 'Signature Pending')
                          }
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  {getStatusBadge(application.letterStatus)}
                  <p className="text-sm text-gray-600 mt-2">
                    {language === 'mr' ? 'शेवटच्या अपडेटची तारीख' : 'Last updated'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(application.updatedAt || application.createdAt)}
                  </p>
                  
                  {/* Show processing time */}
                  <div className="mt-2 text-xs text-gray-500">
                    {language === 'mr' ? 'एकूण वेळ: ' : 'Total time: '}
                    {(() => {
                      const created = new Date(application.createdAt);
                      const now = new Date();
                      const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
                      return diffDays === 0 ? 
                        (language === 'mr' ? 'आज' : 'Today') : 
                        `${diffDays} ${language === 'mr' ? 'दिवस' : 'days'}`;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 p-8 rounded-xl text-center">
            <FiFileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              {language === 'mr' 
                ? 'तुमचा अर्ज/संदर्भ क्रमांक वरून तपासणी करण्यासाठी वर इनपुट करा.' 
                : 'Enter your application/reference number above to check status.'}
            </p>
            <p className="text-sm text-gray-500">
              {language === 'mr' 
                ? 'संदर्भ क्रमांक सामान्यतः "REF-XXXX-YYYY" फॉर्मेटमध्ये असतो' 
                : 'Reference number is usually in "REF-XXXX-YYYY" format'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackApplication;