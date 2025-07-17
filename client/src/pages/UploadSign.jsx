import React, { useState, useEffect } from 'react';
import { FiUpload, FiTrash2, FiEye, FiCheck, FiX, FiDownload } from 'react-icons/fi';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import translations from '../translations';

const UploadSign = () => {
  const { language } = useLanguage();
  const t = translations[language] || translations['en'];
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedSignatures, setUploadedSignatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Get user data from token
  const getUserFromToken = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      return {
        name: tokenData.name || 'User',
        email: tokenData.email || '',
        role: tokenData.roleName || 'user',
        userId: tokenData.userId || tokenData.id
      };
    } catch (error) {
      console.error('Error parsing token:', error);
      return null;
    }
  };

  const user = getUserFromToken();

  // Load existing signatures on component mount
  useEffect(() => {
    loadSignatures();
  }, []);

  const loadSignatures = async () => {
    try {
      setLoading(true);
      // This would be replaced with actual API call to fetch user's signatures
      // const response = await axios.get(`http://localhost:5000/api/signatures/${user?.userId}`);
      // setUploadedSignatures(response.data);
      
      // For now, using localStorage as mock data
      const savedSignatures = localStorage.getItem(`signatures_${user?.userId}`);
      if (savedSignatures) {
        setUploadedSignatures(JSON.parse(savedSignatures));
      }
    } catch (err) {
      console.error('Error loading signatures:', err);
      setError(language === 'mr' ? 'स्वाक्षरी लोड करण्यात त्रुटी' : 'Error loading signatures');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file) => {
    if (!file) return;

    // Validate file type - match backend requirements
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError(language === 'mr' ? 'कृपया फक्त PDF, PNG किंवा JPEG फाइल अपलोड करा' : 'Please upload only PDF, PNG, or JPEG files');
      return;
    }

    // Validate file size (max 10MB to match backend)
    if (file.size > 10 * 1024 * 1024) {
      setError(language === 'mr' ? 'फाइल साइज 10MB पेक्षा कमी असावा' : 'File size should be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError('');
    
    // Create preview URL (only for images, not PDF)
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(''); // No preview for PDF
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError(language === 'mr' ? 'कृपया फाइल निवडा' : 'Please select a file');
      return;
    }

    // Check if user already has a signature uploaded
    if (uploadedSignatures.length > 0) {
      setError(language === 'mr' ? 'तुम्ही आधीच एक स्वाक्षरी अपलोड केली आहे. नवीन स्वाक्षरी अपलोड करण्यापूर्वी कृपया विद्यमान स्वाक्षरी हटवा.' : 'You already have a signature uploaded. Please delete the existing signature before uploading a new one.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('sign', selectedFile); // Backend expects 'sign' field name
      formData.append('userId', user?.userId || user?.id);

      // Call the backend API
      const response = await axios.put('http://localhost:5000/api/auth/update-sign', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        // Create signature object for local display
        const newSignature = {
          id: Date.now(),
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          uploadDate: new Date().toISOString(),
          previewUrl: response.data.sign, // Use the S3 URL from backend
          signUrl: response.data.sign,
          isActive: true // New signature becomes active
        };

        // Update local state
        const updatedSignatures = uploadedSignatures.map(sig => ({ ...sig, isActive: false }));
        updatedSignatures.push(newSignature);
        setUploadedSignatures(updatedSignatures);
        
        // Save to localStorage for persistence
        localStorage.setItem(`signatures_${user?.userId || user?.id}`, JSON.stringify(updatedSignatures));

        setSuccess(language === 'mr' ? 'स्वाक्षरी यशस्वीरित्या अपलोड झाली!' : 'Signature uploaded successfully!');
        setSelectedFile(null);
        setPreviewUrl('');
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error uploading signature:', err);
      const errorMessage = err.response?.data?.error || err.message || 
        (language === 'mr' ? 'स्वाक्षरी अपलोड करण्यात त्रुटी' : 'Error uploading signature');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (signatureId) => {
    if (!window.confirm(language === 'mr' ? 'तुम्हाला खात्री आहे की तुम्ही ही स्वाक्षरी हटवू इच्छिता?' : 'Are you sure you want to delete this signature?')) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Call the backend API to delete the signature
      const response = await axios.delete('http://localhost:5000/api/auth/delete-sign', {
        data: {
          userId: user?.userId || user?.id
        },
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success || response.status === 200) {
        // Update local state after successful API call
        const updatedSignatures = uploadedSignatures.filter(sig => sig.id !== signatureId);
        setUploadedSignatures(updatedSignatures);
        
        // Update localStorage for persistence
        localStorage.setItem(`signatures_${user?.userId || user?.id}`, JSON.stringify(updatedSignatures));
        
        setSuccess(language === 'mr' ? 'स्वाक्षरी हटवली गेली!' : 'Signature deleted successfully!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error deleting signature:', err);
      
      // Handle specific error cases
      if (err.code === 'ERR_NETWORK' || err.code === 'ERR_CONNECTION_REFUSED') {
        setError(language === 'mr' ? 'सर्व्हर कनेक्शन त्रुटी. कृपया सर्व्हर चालू असल्याची खात्री करा.' : 'Server connection error. Please ensure the server is running on port 5000.');
      } else if (err.response?.status === 404) {
        // Check if it's an HTML 404 page (server not handling the route) or JSON error
        if (err.response.headers['content-type']?.includes('text/html')) {
          setError(language === 'mr' ? 'API एंडपॉइंट आढळला नाही. कृपया सर्व्हर कॉन्फिगरेशन तपासा.' : 'API endpoint not found. Please check server configuration.');
        } else {
          setError(err.response.data?.error || (language === 'mr' ? 'वापरकर्ता आढळला नाही' : 'User not found'));
        }
      } else if (err.response?.status === 400) {
        setError(err.response.data?.error || (language === 'mr' ? 'स्वाक्षरी हटवण्यात त्रुटी' : 'Error deleting signature'));
      } else {
        setError(language === 'mr' ? 'स्वाक्षरी हटवण्यात त्रुटी. कृपया पुन्हा प्रयत्न करा.' : 'Error deleting signature. Please try again.');
      }
      
      // Clear error message after 5 seconds
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = async (signatureId) => {
    try {
      const updatedSignatures = uploadedSignatures.map(sig => ({
        ...sig,
        isActive: sig.id === signatureId
      }));
      
      setUploadedSignatures(updatedSignatures);
      localStorage.setItem(`signatures_${user?.userId}`, JSON.stringify(updatedSignatures));
      
      setSuccess(language === 'mr' ? 'सक्रिय स्वाक्षरी अपडेट झाली!' : 'Active signature updated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error setting active signature:', err);
      setError(language === 'mr' ? 'सक्रिय स्वाक्षरी सेट करण्यात त्रुटी' : 'Error setting active signature');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(language === 'mr' ? 'mr-IN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {language === 'mr' ? 'स्वाक्षरी अपलोड करा' : 'Upload Signature'}
        </h1>
        <p className="text-gray-600">
          {language === 'mr' 
            ? 'आपली डिजिटल स्वाक्षरी अपलोड करा आणि व्यवस्थापित करा' 
            : 'Upload and manage your digital signatures'}
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
          <div className="flex">
            <FiX className="h-5 w-5 mr-2 mt-0.5" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-400 text-green-700">
          <div className="flex">
            <FiCheck className="h-5 w-5 mr-2 mt-0.5" />
            <p>{success}</p>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {language === 'mr' ? 'नवीन स्वाक्षरी अपलोड करा' : 'Upload New Signature'}
        </h2>
        
        {/* File Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            uploadedSignatures.length > 0
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : dragActive 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={uploadedSignatures.length === 0 ? handleDrag : undefined}
          onDragLeave={uploadedSignatures.length === 0 ? handleDrag : undefined}
          onDragOver={uploadedSignatures.length === 0 ? handleDrag : undefined}
          onDrop={uploadedSignatures.length === 0 ? handleDrop : undefined}
        >
          <FiUpload className={`mx-auto h-12 w-12 ${uploadedSignatures.length > 0 ? 'text-gray-300' : 'text-gray-400'} mb-4`} />
          {uploadedSignatures.length > 0 ? (
            <>
              <p className="text-lg font-medium text-gray-600 mb-2">
                {language === 'mr' ? 'तुम्ही आधीच एक स्वाक्षरी अपलोड केली आहे' : 'You already have a signature uploaded'}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {language === 'mr' ? 'नवीन स्वाक्षरी अपलोड करण्यापूर्वी कृपया विद्यमान स्वाक्षरी हटवा' : 'Please delete the existing signature before uploading a new one'}
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-gray-900 mb-2">
                {language === 'mr' ? 'फाइल ड्रॅग करा किंवा क्लिक करा' : 'Drag files here or click to browse'}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {language === 'mr' ? 'PDF, PNG, JPEG (कमाल 10MB)' : 'PDF, PNG, JPEG (Max 10MB)'}
              </p>
            </>
          )}
          
          <input
            type="file"
            accept=".pdf,.png,.jpeg,.jpg"
            onChange={handleFileChange}
            className="hidden"
            id="signature-upload"
            disabled={uploadedSignatures.length > 0}
          />
          <label
            htmlFor="signature-upload"
            className={`inline-flex items-center px-4 py-2 rounded-md transition-colors ${
              uploadedSignatures.length > 0
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
            }`}
          >
            <FiUpload className="mr-2 h-4 w-4" />
            {language === 'mr' ? 'फाइल निवडा' : 'Choose File'}
          </label>
        </div>

        {/* Preview Section */}
        {selectedFile && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              {language === 'mr' ? 'पूर्वावलोकन' : 'Preview'}
            </h3>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Signature preview"
                    className="h-24 w-auto border border-gray-300 rounded bg-white p-2"
                  />
                ) : (
                  <div className="h-24 w-24 border border-gray-300 rounded bg-white p-2 flex items-center justify-center">
                    <FiUpload className="h-8 w-8 text-gray-400" />
                    <span className="text-xs text-gray-500 ml-1">PDF</span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                <p className="text-sm text-gray-500">
                  {selectedFile.type === 'application/pdf' 
                    ? (language === 'mr' ? 'PDF फाइल' : 'PDF File')
                    : (language === 'mr' ? 'इमेज फाइल' : 'Image File')
                  }
                </p>
                <div className="mt-3 flex space-x-3">
                  <button
                    onClick={handleUpload}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        {language === 'mr' ? 'अपलोड होत आहे...' : 'Uploading...'}
                      </>
                    ) : (
                      <>
                        <FiUpload className="mr-2 h-4 w-4" />
                        {language === 'mr' ? 'अपलोड करा' : 'Upload'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl('');
                      setError('');
                    }}
                    className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    <FiX className="mr-2 h-4 w-4" />
                    {language === 'mr' ? 'रद्द करा' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Uploaded Signatures Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {language === 'mr' ? 'अपलोड केलेल्या स्वाक्षऱ्या' : 'Uploaded Signatures'}
        </h2>

        {loading ? (
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : uploadedSignatures.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {uploadedSignatures.map((signature) => (
              <div
                key={signature.id}
                className={`border rounded-lg p-4 transition-all ${
                  signature.isActive 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    signature.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {signature.isActive 
                      ? (language === 'mr' ? 'सक्रिय' : 'Active')
                      : (language === 'mr' ? 'निष्क्रिय' : 'Inactive')
                    }
                  </span>
                </div>
                
                <div className="mb-3">
                  <img
                    src={signature.previewUrl}
                    alt="Signature"
                    className="h-16 w-auto border border-gray-300 rounded bg-white p-2 mx-auto"
                  />
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  <p className="font-medium truncate">{signature.fileName}</p>
                  <p>{formatFileSize(signature.fileSize)}</p>
                  <p>{formatDate(signature.uploadDate)}</p>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => window.open(signature.previewUrl, '_blank')}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                      title={language === 'mr' ? 'पहा' : 'View'}
                    >
                      <FiEye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(signature.id)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                      title={language === 'mr' ? 'हटवा' : 'Delete'}
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {!signature.isActive && (
                    <button
                      onClick={() => handleSetActive(signature.id)}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      {language === 'mr' ? 'सक्रिय करा' : 'Set Active'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FiUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {language === 'mr' ? 'कोणत्याही स्वाक्षऱ्या अपलोड केल्या नाहीत' : 'No signatures uploaded'}
            </h3>
            <p className="text-gray-500">
              {language === 'mr' 
                ? 'आपली पहिली डिजिटल स्वाक्षरी अपलोड करण्यासाठी वरील विभाग वापरा' 
                : 'Use the section above to upload your first digital signature'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadSign;
