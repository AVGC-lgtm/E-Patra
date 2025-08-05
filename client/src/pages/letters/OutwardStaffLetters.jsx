import React from 'react';
import BaseLetterComponent from './BaseLetterComponent';
import { useLanguage } from '../../context/LanguageContext';
import translations from '../../translations';
import { useState } from 'react';
import { FiUpload, FiX, FiFile, FiTrash2, FiDownload } from 'react-icons/fi';
import axios from 'axios';
const apiUrl = import.meta.env.VITE_API_URL;
// Helper function to get user role from token
const getUserRole = () => {
  const token = sessionStorage.getItem('token');
  if (!token) return 'outward_staff';
  
  try {
    const tokenData = JSON.parse(atob(token.split('.')[1]));
    const role = tokenData.roleName || 'outward_staff';
    return role;
  } catch (error) {
    console.error('Error parsing token:', error);
    return 'outward_staff';
  }
};

// Helper function to get sign status
const getSignStatus = (letter) => {
  // Check if letter has been sent to head
  if (letter.forwardTo === 'head' || letter.letterStatus === 'sent to head' || letter.letterStatus === 'प्रमुखांकडे पाठवले') {
    // Check if covering letter has been signed
    if (letter.coveringLetter && letter.coveringLetter.isSigned === true) {
      return 'completed';
    } else {
      return 'pending';
    }
  }
  return null; // Not sent to head
};

const OutwardStaffLetters = () => {
  const { language } = useLanguage();
  const t = translations[language] || translations['en'];
  
  // Get the actual user role from token
  const userRole = getUserRole();
  
  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedLetterForUpload, setSelectedLetterForUpload] = useState(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(new Set()); // Track successful uploads
  const [closingCase, setClosingCase] = useState(false);

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
  };

  // Handle drag and drop
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
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  // Process selected files
  const handleFiles = (files) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif'
    ];

    const validFiles = files.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        alert(`File ${file.name} is not allowed. Only PDF, Word documents, and images are accepted.`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert(`File ${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      return true;
    });

    setUploadFiles(prev => [...prev, ...validFiles]);
  };

  // Remove file from upload list
  const removeFile = (index) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload files
  const handleUpload = async () => {
    if (uploadFiles.length === 0) {
      alert('Please select files to upload');
      return;
    }

    setUploading(true);
    try {
      const token = sessionStorage.getItem('token');
      const formData = new FormData();
      
      // Add all files to form data
      uploadFiles.forEach((file, index) => {
        formData.append('reportFiles', file);
        console.log(`Added file ${index}:`, file.name, file.type, file.size);
      });
      
      formData.append('letterId', selectedLetterForUpload.id);
      formData.append('letterReference', selectedLetterForUpload.referenceNumber);

      console.log('Uploading to:', `${apiUrl}/api/patras/${selectedLetterForUpload.id}/upload-report`);
      console.log('Token:', token ? 'Present' : 'Missing');
      console.log('Files count:', uploadFiles.length);
      console.log('Letter ID:', selectedLetterForUpload.id);

      const response = await axios.post(
        `${apiUrl}/api/patras/${selectedLetterForUpload.id}/upload-report`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        alert('Report files uploaded successfully!');
        setUploadModalOpen(false);
        setUploadFiles([]);
        setSelectedLetterForUpload(null);
        
        // Track successful upload
        setUploadSuccess(prev => new Set([...prev, selectedLetterForUpload.id]));
        
        // Refresh the page or trigger a refresh
        window.location.reload();
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error headers:', error.response?.headers);
      
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
      alert('Failed to upload files: ' + errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // Handle close case
  const handleCloseCase = async (letter) => {
    if (!window.confirm(language === 'mr' ? 'तुम्हाला खरोखर हे केस बंद करायचे आहे?' : 'Are you sure you want to close this case?')) {
      return;
    }

    setClosingCase(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.put(
        `${apiUrl}/api/patras/${letter.id}/close-case`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        alert(language === 'mr' ? 'केस यशस्वीरित्या बंद झाले!' : 'Case closed successfully!');
        // Refresh the page to show updated status
        window.location.reload();
      } else {
        throw new Error(response.data.message || 'Failed to close case');
      }
    } catch (error) {
      console.error('Close case error:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
      alert((language === 'mr' ? 'केस बंद करताना त्रुटी: ' : 'Failed to close case: ') + errorMessage);
    } finally {
      setClosingCase(false);
    }
  };

  // Handle upload button click
  const handleUploadReportClick = (letter) => {
    setSelectedLetterForUpload(letter);
    setUploadModalOpen(true);
    setUploadFiles([]);
  };
  
  // Additional columns specific to outward staff
  const additionalColumns = [
    {
      key: 'uploadReport',
      header: language === 'mr' ? 'रिपोर्ट अपलोड' : 'Upload Report',
      render: (letter) => {
        const signStatus = getSignStatus(letter);
        
        // Check if case is already closed
        if (letter.inwardPatraClose || letter.letterStatus === 'case close') {
          return (
            <span className="inline-flex items-center px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded">
              <span className="ml-1">{language === 'mr' ? 'केस बंद' : 'Case Closed'}</span>
            </span>
          );
        }
        
        // Check if reports are uploaded (check if reportFiles exists and is not empty)
        const hasReportFiles = letter.reportFiles && 
                               letter.reportFiles !== '[]' && 
                               letter.reportFiles !== 'null' && 
                               letter.reportFiles !== null;
        
        if (signStatus === 'completed') {
          // If reports are uploaded, show Close button
          if (hasReportFiles || uploadSuccess.has(letter.id)) {
            return (
              <button
                onClick={() => handleCloseCase(letter)}
                disabled={closingCase}
                className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                title={language === 'mr' ? 'केस बंद करा' : 'Close Case'}
              >
                <span className="ml-1">
                  {closingCase 
                    ? (language === 'mr' ? 'बंद करत आहे...' : 'Closing...') 
                    : (language === 'mr' ? 'केस बंद करा' : 'Close Case')
                  }
                </span>
              </button>
            );
          } else {
            // If no reports uploaded, show Upload button
            return (
              <button
                onClick={() => handleUploadReportClick(letter)}
                className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors shadow-sm"
                title={language === 'mr' ? 'रिपोर्ट अपलोड करा' : 'Upload Report'}
              >
                <FiUpload className="h-4 w-4" />
                <span className="ml-1">{language === 'mr' ? 'अपलोड' : 'Upload'}</span>
              </button>
            );
          }
        }
        
        return (
          <span className="text-xs text-gray-400">
            {language === 'mr' ? 'स्वाक्षरी प्रतीक्षा' : 'Awaiting Sign'}
          </span>
        );
      }
    },
    {
      key: 'downloadReport',
      header: language === 'mr' ? 'रिपोर्ट डाउनलोड' : 'Download Report',
      render: (letter) => {
        // Only show download option if case is closed AND report files exist
        const isCaseClosed = letter.inwardPatraClose || letter.letterStatus === 'case close';
        const hasReportFiles = letter.reportFiles && 
                               letter.reportFiles !== '[]' && 
                               letter.reportFiles !== 'null' && 
                               letter.reportFiles !== null;

        if (isCaseClosed && hasReportFiles) {
          try {
            const reportFiles = JSON.parse(letter.reportFiles);
            
            // If only one file, show single download button
            if (reportFiles.length === 1) {
              return (
                <button
                  onClick={() => window.open(reportFiles[0].s3Url, '_blank')}
                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors shadow-sm"
                  title={`${language === 'mr' ? 'डाउनलोड' : 'Download'}: ${reportFiles[0].originalName}`}
                >
                  <FiDownload className="h-4 w-4" />
                  <span className="ml-1">{language === 'mr' ? 'डाउनलोड' : 'Download'}</span>
                </button>
              );
            }
            
            // If multiple files, show dropdown button
            return (
              <div className="relative inline-block text-left">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    const dropdown = e.currentTarget.nextElementSibling;
                    dropdown.classList.toggle('hidden');
                  }}
                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors shadow-sm"
                  title={language === 'mr' ? `${reportFiles.length} फाईल्स डाउनलोड करा` : `Download ${reportFiles.length} files`}
                >
                  <FiDownload className="h-4 w-4" />
                  <span className="ml-1">{language === 'mr' ? `डाउनलोड (${reportFiles.length})` : `Download (${reportFiles.length})`}</span>
                </button>
                <div className="hidden absolute right-0 z-10 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                  <div className="py-1">
                    {reportFiles.map((file, index) => (
                      <button
                        key={index}
                        onClick={() => window.open(file.s3Url, '_blank')}
                        className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-100"
                      >
                        <div className="truncate font-medium">{file.originalName}</div>
                        <div className="text-gray-500">{file.size ? `${Math.round(file.size / 1024)} KB` : 'N/A'}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          } catch (error) {
            console.error('Error parsing report files:', error);
            return (
              <span className="text-xs text-red-500">
                {language === 'mr' ? 'त्रुटी' : 'Error'}
              </span>
            );
          }
        }

        return (
          <span className="text-xs text-gray-400">
            {language === 'mr' ? 'उपलब्ध नाही' : 'N/A'}
          </span>
        );
      }
    }
  ];

  return (
    <>
    <BaseLetterComponent
      role={userRole}
      apiEndpoint={`${apiUrl}/api/patras`}
      additionalColumns={additionalColumns}
    />

      {/* Upload Report Modal */}
      {uploadModalOpen && selectedLetterForUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 bg-gray-100 rounded-full p-1 shadow"
              onClick={() => setUploadModalOpen(false)}
            >
              <FiX className="h-6 w-6" />
            </button>
            
            <h2 className="text-2xl font-bold mb-6 text-green-700 text-center">
              {language === 'mr' ? 'रिपोर्ट अपलोड करा' : 'Upload Report'}
            </h2>
            
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>{language === 'mr' ? 'पत्र संदर्भ:' : 'Letter Reference:'}</strong> {selectedLetterForUpload.referenceNumber}
              </p>
            </div>

            {/* File Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive 
                  ? 'border-green-400 bg-green-50' 
                  : 'border-gray-300 hover:border-green-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <FiUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                {language === 'mr' ? 'फाइल्स अपलोड करा' : 'Upload Files'}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {language === 'mr' 
                  ? 'PDF, Word दस्तऐवज आणि इमेज फाइल्स स्वीकारल्या जातात' 
                  : 'PDF, Word documents, and image files are accepted'}
              </p>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
              />
              <label
                htmlFor="file-upload"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 cursor-pointer transition-colors"
              >
                <FiFile className="mr-2 h-4 w-4" />
                {language === 'mr' ? 'फाइल्स निवडा' : 'Select Files'}
              </label>
              <p className="text-xs text-gray-400 mt-2">
                {language === 'mr' ? 'किंवा फाइल्स येथे ड्रॅग करा' : 'Or drag files here'}
              </p>
            </div>

            {/* Selected Files List */}
            {uploadFiles.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-700 mb-3">
                  {language === 'mr' ? 'निवडलेल्या फाइल्स' : 'Selected Files'}
                </h3>
                <div className="space-y-2">
                  {uploadFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <FiFile className="h-5 w-5 text-blue-500 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title={language === 'mr' ? 'फाइल काढा' : 'Remove file'}
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Button */}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setUploadModalOpen(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {language === 'mr' ? 'रद्द करा' : 'Cancel'}
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || uploadFiles.length === 0}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading 
                  ? (language === 'mr' ? 'अपलोड होत आहे...' : 'Uploading...') 
                  : (language === 'mr' ? 'अपलोड करा' : 'Upload')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OutwardStaffLetters;
