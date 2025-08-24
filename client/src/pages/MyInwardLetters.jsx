import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiEye, FiDownload, FiSearch, FiRefreshCw, FiUpload, FiFile, FiFileText } from 'react-icons/fi';
import { useLanguage } from '../context/LanguageContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
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
  const [downloadingLetters, setDownloadingLetters] = useState(new Set());
  const [uploadingReports, setUploadingReports] = useState(new Set());
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedLetterForUpload, setSelectedLetterForUpload] = useState(null);
  const [reportFilter, setReportFilter] = useState('all'); // 'all', 'with_reports', 'without_reports'
  const [dragActive, setDragActive] = useState(false);
  
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

  // Filter letters based on search and report filter
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

    // Apply report filter
    if (reportFilter !== 'all') {
      filtered = filtered.filter(letter => {
        const hasReports = letter.uploadedReports && letter.uploadedReports.length > 0;
        if (reportFilter === 'with_reports') {
          return hasReports;
        } else if (reportFilter === 'without_reports') {
          return !hasReports;
        }
        return true;
      });
    }

    setFilteredLetters(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [letters, searchTerm, reportFilter]);

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

  

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragOut = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        uploadReport(selectedLetterForUpload, file);
      } else {
        toast.error(language === 'mr' ? 'केवळ PDF फाईल्स स्वीकारल्या जातात' : 'Only PDF files are accepted');
      }
    }
  };

  // Function to upload report for a specific letter
  const uploadReport = async (letter, file) => {
    if (uploadingReports.has(letter.id)) return;
    
    setUploadingReports(prev => new Set(prev).add(letter.id));
    
    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        toast.error(language === 'mr' ? 'कृपया लॉगिन करा' : 'Please login first');
        return;
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(language === 'mr' ? 'फाईल आकार 10MB पेक्षा जास्त असू शकत नाही' : 'File size cannot exceed 10MB');
        return;
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('reportFiles', file); // Changed to match backend expectation
      formData.append('letterId', letter.id || letter._id);
      formData.append('fileName', file.name);
      formData.append('fileType', file.type);

      const response = await axios.post(`${apiUrl}/api/patras/${letter.id || letter._id}/upload-report`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        toast.success(language === 'mr' ? 'अहवाल यशस्वीरित्या अपलोड झाला' : 'Report uploaded successfully');
        // Refresh the letters data to show the new report
        fetchMyLetters();
        
        // Auto-close modal after successful upload
        setTimeout(() => {
          setUploadModalOpen(false);
          setSelectedLetterForUpload(null);
        }, 1500);
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading report:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        // Show more specific error message
        const errorMessage = error.response.data?.error || error.response.data?.message || 'Upload failed';
        toast.error(language === 'mr' ? `अहवाल अपलोड करण्यात अयशस्वी: ${errorMessage}` : `Failed to upload report: ${errorMessage}`);
      } else {
        toast.error(language === 'mr' ? 'अहवाल अपलोड करण्यात अयशस्वी' : 'Failed to upload report');
      }
    } finally {
      setUploadingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(letter.id);
        return newSet;
      });
    }
  };

  // Function to download merged PDF (covering letter + uploaded report)
  const downloadMergedPDF = async (letter) => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        toast.error(language === 'mr' ? 'कृपया लॉगिन करा' : 'Please login first');
        return;
      }

      // Call the backend endpoint to get merged PDF
      const response = await fetch(`${apiUrl}/api/patras/${letter.id}/download-merged`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download merged PDF');
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `merged-report-${letter.referenceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(language === 'mr' ? 'एकत्रित PDF यशस्वीरित्या डाउनलोड झाला' : 'Merged PDF downloaded successfully');
      
    } catch (error) {
      console.error('Error downloading merged PDF:', error);
      toast.error(language === 'mr' ? `एकत्रित PDF डाउनलोड करण्यात अयशस्वी: ${error.message}` : `Failed to download merged PDF: ${error.message}`);
    }
  };

  // Function to download merged PDF (covering letter + uploaded file for extraction)
  const downloadMergedFile = async (letter) => {
    if (downloadingLetters.has(letter.id)) return;
    
    setDownloadingLetters(prev => new Set(prev).add(letter.id));
    
    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        toast.error(language === 'mr' ? 'कृपया लॉगिन करा' : 'Please login first');
        return;
      }

      // Check if letter has both covering letter and uploaded file
      if (!letter.coveringLetter && !letter.fileId) {
        toast.warning(language === 'mr' ? 'कव्हरिंग लेटर किंवा अपलोड केलेली फाईल उपलब्ध नाही' : 'No covering letter or uploaded file available');
        return;
      }

      // Call the backend endpoint to get merged PDF
      const response = await fetch(`${apiUrl}/api/patras/${letter.id}/download-merged-file`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download merged PDF');
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `merged-file-${letter.referenceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(language === 'mr' ? 'एकत्रित PDF यशस्वीरित्या डाउनलोड झाला' : 'Merged PDF downloaded successfully');
      
    } catch (error) {
      console.error('Error downloading merged PDF:', error);
      toast.error(language === 'mr' ? `एकत्रित PDF डाउनलोड करण्यात अयशस्वी: ${error.message}` : `Failed to download merged PDF: ${error.message}`);
    } finally {
      setDownloadingLetters(prev => {
        const newSet = new Set(prev);
        newSet.delete(letter.id);
        return newSet;
      });
    }
  };

  // Function to download both covering letter and uploaded file together
  const downloadLetterWithAttachments = async (letter) => {
    if (downloadingLetters.has(letter.id)) return;
    
    setDownloadingLetters(prev => new Set(prev).add(letter.id));
    
    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        toast.error(language === 'mr' ? 'कृपया लॉगिन करा' : 'Please login first');
        return;
      }

      // Get covering letter data
      let coveringLetterUrl = null;
      let uploadedFileUrl = null;

      // Get covering letter URL - use backend proxy instead of direct S3
      if (letter.coveringLetter || letter.directCoveringLetter) {
        const coveringLetter = letter.coveringLetter || letter.directCoveringLetter;
        if (coveringLetter.wordUrl) {
          coveringLetterUrl = coveringLetter.wordUrl;
        } else if (coveringLetter.pdfUrl) {
          coveringLetterUrl = coveringLetter.pdfUrl;
        } else if (coveringLetter.htmlUrl) {
          coveringLetterUrl = coveringLetter.htmlUrl;
        }
      }

      // Get uploaded file URL - use backend proxy instead of direct S3
      if (letter.uploadedFile) {
        uploadedFileUrl = letter.uploadedFile.fileUrl;
      }

      // Download both files separately
      if (coveringLetterUrl && uploadedFileUrl) {
        // Download covering letter first
        const coveringLetterResponse = await fetch(`${apiUrl}/api/files/proxy-download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            fileUrl: coveringLetterUrl,
            fileName: `CoveringLetter_${letter.referenceNumber}`
          })
        });

        if (!coveringLetterResponse.ok) {
          throw new Error('Failed to download covering letter');
        }

        // Download uploaded file second
        const uploadedFileResponse = await fetch(`${apiUrl}/api/files/proxy-download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            fileUrl: uploadedFileUrl,
            fileName: letter.uploadedFile?.originalName || `UploadedFile_${letter.referenceNumber}`
          })
        });

        if (!uploadedFileResponse.ok) {
          throw new Error('Failed to download uploaded file');
        }

        // Download both files separately
        const coveringLetterBlob = await coveringLetterResponse.blob();
        const uploadedFileBlob = await uploadedFileResponse.blob();

        // Download covering letter
        const coveringLetterExt = coveringLetterUrl.includes('.docx') ? '.docx' : 
                                 coveringLetterUrl.includes('.pdf') ? '.pdf' : '.html';
        const coveringLetterUrl2 = URL.createObjectURL(coveringLetterBlob);
        const coveringLetterLink = document.createElement('a');
        coveringLetterLink.href = coveringLetterUrl2;
        coveringLetterLink.download = `CoveringLetter_${letter.referenceNumber}${coveringLetterExt}`;
        document.body.appendChild(coveringLetterLink);
        coveringLetterLink.click();
        document.body.removeChild(coveringLetterLink);
        URL.revokeObjectURL(coveringLetterUrl2);

        // Download uploaded file
        const uploadedFileUrl2 = URL.createObjectURL(uploadedFileBlob);
        const uploadedFileLink = document.createElement('a');
        uploadedFileLink.href = uploadedFileUrl2;
        uploadedFileLink.download = letter.uploadedFile?.originalName || `UploadedFile_${letter.referenceNumber}`;
        document.body.appendChild(uploadedFileLink);
        uploadedFileLink.click();
        document.body.removeChild(uploadedFileLink);
        URL.revokeObjectURL(uploadedFileUrl2);

        toast.success(language === 'mr' ? 'दोन्ही फाईल्स वेगळ्या वेगळ्या डाउनलोड झाल्या' : 'Both files downloaded separately');
      } else if (coveringLetterUrl) {
        // Only covering letter available - download through backend
        const response = await fetch(`${apiUrl}/api/files/proxy-download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            fileUrl: coveringLetterUrl,
            fileName: `CoveringLetter_${letter.referenceNumber}`
          })
        });

        if (!response.ok) {
          throw new Error('Failed to download covering letter');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `CoveringLetter_${letter.referenceNumber}${coveringLetterUrl.includes('.docx') ? '.docx' : 
                         coveringLetterUrl.includes('.pdf') ? '.pdf' : '.html'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast.success(language === 'mr' ? 'कव्हरिंग लेटर डाउनलोड झाले' : 'Covering letter downloaded successfully');
      } else if (uploadedFileUrl) {
        // Only uploaded file available - download through backend
        const response = await fetch(`${apiUrl}/api/files/proxy-download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            fileUrl: uploadedFileUrl,
            fileName: letter.uploadedFile?.originalName || `UploadedFile_${letter.referenceNumber}`
          })
        });

        if (!response.ok) {
          throw new Error('Failed to download uploaded file');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = letter.uploadedFile?.originalName || `UploadedFile_${letter.referenceNumber}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast.success(language === 'mr' ? 'अपलोड केलेली फाईल डाउनलोड झाली' : 'Uploaded file downloaded successfully');
      } else {
        toast.warning(language === 'mr' ? 'कोणतीही फाईल उपलब्ध नाही' : 'No files available for download');
      }
    } catch (error) {
      console.error('Error downloading files:', error);
      toast.error(language === 'mr' ? 'फाईल्स डाउनलोड करण्यात अयशस्वी' : 'Failed to download files');
    } finally {
      setDownloadingLetters(prev => {
        const newSet = new Set(prev);
        newSet.delete(letter.id);
        return newSet;
      });
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
            {language === 'mr' ? 'एकूण अर्ज' : 'My Letters'}
          </h1>
          <p className="text-gray-500">
            {language === 'mr' ? 
              'तुमच्या सबमिट केलेल्या अर्जांची यादी' : 
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

          {/* Report Filter Dropdown */}
          <div className="relative">
            <select
              value={reportFilter}
              onChange={(e) => setReportFilter(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="all">
                {language === 'mr' ? 'सर्व अर्ज' : 'All Letters'}
              </option>
              <option value="with_reports">
                {language === 'mr' ? 'अहवाल असलेले अर्ज' : 'With Reports'}
              </option>
              <option value="without_reports">
                {language === 'mr' ? 'अहवाल नसलेले अर्ज' : 'Without Reports'}
              </option>
            </select>
          </div>
          
          {/* Clear Filters Button */}
          {(searchTerm || reportFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setReportFilter('all');
              }}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              title={language === 'mr' ? 'सर्व फिल्टर साफ करा' : 'Clear all filters'}
            >
              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {language === 'mr' ? 'साफ करा' : 'Clear'}
            </button>
          )}

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

      {/* Filter Status */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          <span>
            {language === 'mr' ? 'फिल्टर:' : 'Filter:'} 
            <span className="font-medium ml-1">
              {reportFilter === 'all' ? (language === 'mr' ? 'सर्व अर्ज' : 'All Letters') :
               reportFilter === 'with_reports' ? (language === 'mr' ? 'अहवाल असलेले अर्ज' : 'With Reports') :
               (language === 'mr' ? 'अहवाल नसलेले अर्ज' : 'Without Reports')}
            </span>
          </span>
          {searchTerm && (
            <span>
              {language === 'mr' ? 'शोध:' : 'Search:'} 
              <span className="font-medium ml-1">"{searchTerm}"</span>
            </span>
          )}
        </div>
        <div className="mt-2 sm:mt-0">
          {language === 'mr' ? 'दाखवत आहे' : 'Showing'} {filteredLetters.length} {language === 'mr' ? 'पैकी' : 'of'} {letters.length} {language === 'mr' ? 'अर्ज' : 'letters'}
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

                    <th className="px-6 py-3 text-center text-xs font-medium text-blue-900 uppercase tracking-wider">
                      {language === 'mr' ? 'एकत्रित PDF' : 'Merged PDF'}
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

                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <button
                          onClick={() => downloadMergedFile(letter)}
                          disabled={downloadingLetters.has(letter.id) || !(letter.coveringLetter || letter.fileId)}
                          className={`inline-flex items-center px-3 py-1 text-xs rounded transition-colors ${
                            (letter.coveringLetter || letter.fileId) 
                              ? 'bg-purple-600 text-white hover:bg-purple-700' 
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                          title={
                            (letter.coveringLetter || letter.fileId)
                              ? (language === 'mr' ? 'कव्हरिंग लेटर आणि अपलोड केलेली फाईल एकत्रित PDF मध्ये डाउनलोड करा' : 'Download covering letter and uploaded file as merged PDF') 
                              : (language === 'mr' ? 'कोणतीही फाईल उपलब्ध नाही' : 'No files available')
                          }
                        >
                          {downloadingLetters.has(letter.id) ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                          ) : (
                            <FiDownload className="h-3 w-3 mr-1" />
                          )}
                          <span>{language === 'mr' ? 'एकत्रित PDF' : 'Merged PDF'}</span>
                        </button>
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
                          
                          {/* Conditional Upload/View Report Button */}
                          {letter.uploadedReports && letter.uploadedReports.length > 0 ? (
                            // Show View Report button if reports exist
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  setSelectedLetter(letter);
                                  setViewModalOpen(true);
                                }}
                                className="inline-flex items-center px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
                                title={language === 'mr' ? 'अहवाल पहा' : 'View Report'}
                              >
                                <FiFile className="h-3 w-3 mr-1" />
                                {language === 'mr' ? 'पहा' : 'View'}
                              </button>
                              {/* Report count badge */}
                              <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                {letter.uploadedReports.length}
                              </span>
                            </div>
                          ) : (
                            // Show Upload Report button if no reports exist
                            <button
                              onClick={() => {
                                setSelectedLetterForUpload(letter);
                                setUploadModalOpen(true);
                              }}
                              className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                              title={language === 'mr' ? 'अहवाल अपलोड करा' : 'Upload Report'}
                            >
                              <FiUpload className="h-3 w-3 mr-1" />
                              {language === 'mr' ? 'अहवाल' : 'Report'}
                            </button>
                          )}
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

            {/* Uploaded Reports Section */}
            {selectedLetter.uploadedReports && selectedLetter.uploadedReports.length > 0 && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {language === 'mr' ? 'अपलोड केलेले अहवाल' : 'Uploaded Reports'}
                </h3>
                <div className="space-y-3">
                  {selectedLetter.uploadedReports.map((report, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FiFile className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{report.originalName}</p>
                          <p className="text-xs text-gray-500">
                            {language === 'mr' ? 'आकार:' : 'Size:'} {Math.round(report.size / 1024)} KB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">
                          {new Date(report.uploadedAt).toLocaleDateString()}
                        </span>
                        {report.s3Url && (
                          <a
                            href={report.s3Url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200 transition-colors"
                            title={language === 'mr' ? 'अहवाल पहा' : 'View Report'}
                          >
                            <FiEye className="h-3 w-3 mr-1" />
                            {language === 'mr' ? 'पहा' : 'View'}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
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

      {/* Enhanced Upload Report Modal */}
      {uploadModalOpen && selectedLetterForUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
            {/* Header with gradient background */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <FiUpload className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    {language === 'mr' ? 'अहवाल अपलोड करा' : 'Upload Report'}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setUploadModalOpen(false);
                    setSelectedLetterForUpload(null);
                  }}
                  className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Letter Information Card */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FiFile className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      {language === 'mr' ? 'पत्र माहिती' : 'Letter Information'}
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">
                          {language === 'mr' ? 'संदर्भ क्रमांक:' : 'Reference Number:'}
                        </span>
                        <span className="text-sm font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          {selectedLetterForUpload.referenceNumber || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-start justify-between">
                        <span className="text-xs text-gray-600">
                          {language === 'mr' ? 'विषय:' : 'Subject:'}
                        </span>
                        <span className="text-sm text-gray-900 text-right max-w-xs leading-relaxed">
                          {selectedLetterForUpload.subject || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Upload Section */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  {language === 'mr' ? 'PDF फाईल निवडा' : 'Select PDF File'}
                </label>
                
                {/* Enhanced File Input with Drag & Drop */}
                <div 
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-50 scale-105' 
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                  onDragEnter={handleDragIn}
                  onDragLeave={handleDragOut}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="space-y-3">
                    <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                      dragActive ? 'bg-blue-200' : 'bg-blue-100'
                    }`}>
                      <FiFile className={`w-6 h-6 transition-colors ${
                        dragActive ? 'text-blue-700' : 'text-blue-600'
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {dragActive 
                          ? (language === 'mr' ? 'फाईल ड्रॉप करा' : 'Drop file here')
                          : (language === 'mr' ? 'फाईल निवडा किंवा ड्रॅग करा' : 'Choose file or drag and drop')
                        }
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {language === 'mr' ? 'केवळ PDF फाईल्स (कमाल 10MB)' : 'PDF files only (max 10MB)'}
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          uploadReport(selectedLetterForUpload, file);
                        }
                      }}
                      className="hidden"
                      id="file-upload"
                    />
                    {uploadingReports.has(selectedLetterForUpload.id) ? (
                      <div className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {language === 'mr' ? 'अपलोड होत आहे...' : 'Uploading...'}
                      </div>
                    ) : (
                      <label
                        htmlFor="file-upload"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer transition-colors"
                      >
                        <FiUpload className="w-4 h-4 mr-2" />
                        {language === 'mr' ? 'फाईल निवडा' : 'Choose File'}
                      </label>
                    )}
                  </div>
                </div>

                {/* File Requirements */}
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start space-x-2">
                    <div className="p-1 bg-blue-100 rounded">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-xs text-blue-800">
                      <p className="font-medium mb-1">
                        {language === 'mr' ? 'फाईल आवश्यकता:' : 'File Requirements:'}
                      </p>
                      <ul className="space-y-1 text-blue-700">
                        <li>• {language === 'mr' ? 'केवळ PDF फाईल्स' : 'PDF files only'}</li>
                        <li>• {language === 'mr' ? 'कमाल आकार: 10MB' : 'Maximum size: 10MB'}</li>
                        <li>• {language === 'mr' ? 'सुरक्षित अपलोड' : 'Secure upload'}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setUploadModalOpen(false);
                    setSelectedLetterForUpload(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                >
                  {language === 'mr' ? 'रद्द करा' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <ToastContainer />
    </div>
  );
};

export default MyInwardLetters; 