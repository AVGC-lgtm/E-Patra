import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiEye, FiDownload, FiRefreshCw, FiSearch, FiCheck, FiX, FiExternalLink, FiFileText, FiUpload, FiTrash2, FiSend } from 'react-icons/fi';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import translations from '../../translations';
import { toast } from 'react-toastify';
const apiUrl = import.meta.env.VITE_API_URL ;

const BaseLetterComponent = ({ role, apiEndpoint, additionalColumns = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const t = translations[language] || translations['en'];

  // Determine the correct dashboard path based on current location
  const getDashboardPath = () => {
    if (location.pathname.includes('/outward-dashboard/')) {
      return '/outward-dashboard';
    } else if (location.pathname.includes('/head-dashboard/')) {
      return '/head-dashboard';
    } else if (location.pathname.includes('/inward-dashboard/')) {
      return '/inward-dashboard';
    } else {
      return '/dashboard';
    }
  };
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [signStatusFilter, setSignStatusFilter] = useState('All');
  const [caseStatusFilter, setCaseStatusFilter] = useState('All');
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acknowledgedLetters, setAcknowledgedLetters] = useState(new Set());
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [coveringLetterModalOpen, setCoveringLetterModalOpen] = useState(false);
  const [selectedLetterForCovering, setSelectedLetterForCovering] = useState(null);
  const [uploadingCoveringLetter, setUploadingCoveringLetter] = useState(false);
  const [generatingCoveringLetter, setGeneratingCoveringLetter] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Status filter options with translations
  const statusOptions = [
    { value: 'All', label: language === 'mr' ? 'सर्व स्थिती' : 'All Status' },
    { value: 'pending', label: language === 'mr' ? 'प्रलंबित' : 'Pending' },
    { value: 'approved', label: language === 'mr' ? 'मंजूर' : 'Approved' },
    { value: 'rejected', label: language === 'mr' ? 'नाकारले' : 'Rejected' },
    { value: 'case close', label: language === 'mr' ? 'फाईल केलेले' : 'Case Closed' }
  ];

  // Sign Status filter options
  const signStatusOptions = [
    { value: 'All', label: language === 'mr' ? 'सर्व स्वाक्षरी स्थिती' : 'All Sign Status' },
    { value: 'pending', label: language === 'mr' ? 'स्वाक्षरी प्रलंबित' : 'Sign Pending' },
    { value: 'completed', label: language === 'mr' ? 'स्वाक्षरी पूर्ण' : 'Sign Completed' }
  ];

  // Case Status filter options
  const caseStatusOptions = [
    { value: 'All', label: language === 'mr' ? 'सर्व अर्ज' : 'All Cases' },
    { value: 'open', label: language === 'mr' ? 'फाईल न केलेले' : 'Open Cases' },
    { value: 'closed', label: language === 'mr' ? 'फाईल केलेले' : 'Closed Cases' }
  ];

  // Add event listener for signature completion
  useEffect(() => {
    const handleSignatureCompleted = () => {
      console.log('Signature completed event received, refreshing letters...');
      handleRefresh();
    };

    window.addEventListener('signature-completed', handleSignatureCompleted);
    
    // Also refresh periodically to catch any updates
    const interval = setInterval(() => {
      handleRefresh();
    }, 30000); // Refresh every 30 seconds
    
    return () => {
      window.removeEventListener('signature-completed', handleSignatureCompleted);
      clearInterval(interval);
    };
  }, []);

  // Fetch letters from API
  const handleRefresh = async () => {
    setLoading(true);
    setError('');
    try {
      const token = sessionStorage.getItem('token');
      const config = token ? {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      } : {};
      
      const response = await axios.get(apiEndpoint, config);
      
      // Handle the API response structure (same as other components)
      let lettersData = [];
      if (response.data && response.data.data && Array.isArray(response.data.data.patras)) {
        lettersData = response.data.data.patras;
      } else if (response.data && Array.isArray(response.data.patras)) {
        lettersData = response.data.patras;
      } else if (response.data && Array.isArray(response.data)) {
        lettersData = response.data;
      }
      
      setLetters(lettersData);
      
      // Log for debugging
      console.log('Fetched letters:', lettersData);
      
      // Load acknowledged status from localStorage
      const savedAcknowledged = localStorage.getItem(`acknowledgedLetters_${role}`);
      if (savedAcknowledged) {
        try {
          setAcknowledgedLetters(new Set(JSON.parse(savedAcknowledged)));
        } catch (e) {
          console.error('Error parsing acknowledged letters:', e);
          setAcknowledgedLetters(new Set());
        }
      }
    } catch (err) {
      console.error('Error fetching letters:', err);
      setError(t.errors?.fetchError || 'Failed to fetch letters. Please try again.');
      setLetters([]); // Ensure we have an empty array on error
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
      localStorage.setItem(`acknowledgedLetters_${role}`, JSON.stringify(Array.from(newAcknowledged)));
      return newAcknowledged;
    });
  };

  const handleDownload = async (filePath, originalName) => {
    try {
      const response = await axios({
        url: `${apiUrl}/${filePath.replace(/\\/g, '/')}`,
        method: 'GET',
        responseType: 'blob',
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
      setError(t.errors.downloadError || 'Failed to download file. Please try again.');
    }
  };

  // Helper function to determine sign status
  const getSignStatus = (letter) => {
    console.log('getSignStatus for letter:', {
      id: letter.id || letter._id,
      referenceNumber: letter.referenceNumber,
      forwardTo: letter.forwardTo,
      letterStatus: letter.letterStatus,
      coveringLetter: letter.coveringLetter,
      isSigned: letter.coveringLetter?.isSigned
    });
    
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

  // Helper function to get sign status display text
  const getSignStatusDisplay = (letter) => {
    const status = getSignStatus(letter);
    if (status === 'completed') {
      return language === 'mr' ? 'स्वाक्षरी पूर्ण' : 'Sign Completed';
    } else if (status === 'pending') {
      return language === 'mr' ? 'स्वाक्षरी प्रलंबित' : 'Sign Pending';
    }
    return language === 'mr' ? 'स्वाक्षरी प्रलंबित' : 'Sign Pending';
  };

  // Helper function to check if letter has covering letter
  const hasCoveringLetter = (letter) => {
    const coveringLetter = letter.coveringLetter || letter.directCoveringLetter;
    if (!coveringLetter) return false;
    
    // Check for either id or _id (to handle both Sequelize and MongoDB)
    const hasId = coveringLetter.id || coveringLetter._id;
    // Check for URL availability - prefer Word over PDF over HTML
    const hasUrl = coveringLetter.wordUrl || 
                   coveringLetter.documentUrls?.word || 
                   coveringLetter.pdfUrl || 
                   coveringLetter.htmlUrl;
    
    return !!(hasId && hasUrl);
  };

  // Function to view covering letter
  const viewCoveringLetter = (letter) => {
    // Prefer Word over PDF over HTML
    const url = letter.coveringLetter?.wordUrl || 
                letter.coveringLetter?.documentUrls?.word || 
                letter.coveringLetter?.pdfUrl || 
                letter.coveringLetter?.htmlUrl;
    
    if (!url) {
      toast.error(language === 'mr' ? 'कव्हरिंग लेटर URL उपलब्ध नाही!' : 'Covering letter URL not available!');
      return;
    }
    window.open(url, '_blank');
  };

  // Handle covering letter click
  const handleCoveringLetterClick = (letter) => {
    setSelectedLetterForCovering(letter);
    setCoveringLetterModalOpen(true);
  };

  // Handle send to SP
  const handleSendToSP = async (letter) => {
    try {
      const confirmSend = window.confirm(
        language === 'mr' 
          ? `तुम्हाला खरोखर हे पत्र SP ला पाठवायचे आहे का?\n\nसंदर्भ क्रमांक: ${letter.referenceNumber}` 
          : `Are you sure you want to send this letter to SP?\n\nReference No: ${letter.referenceNumber}`
      );
      
      if (!confirmSend) return;
      
      const token = sessionStorage.getItem('token');
      
      const response = await axios.post(
        `${apiUrl}/api/patras/${letter._id || letter.id}/send-to-sp`,
        {
          forwardTo: 'sp',
          sendToData: {
            sp: true,
            igp: false,
            sdpo: false,
            policeStation: false
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 200) {
        toast.success(language === 'mr' 
          ? 'पत्र यशस्वीरित्या SP ला पाठवले गेले!' 
          : 'Letter sent to SP successfully!');
        
        // Refresh letters to show updated status
        handleRefresh();
      }
    } catch (error) {
      console.error('Error sending to SP:', error);
      
      if (error.response) {
        const errorMessage = error.response.data?.error || error.response.data?.message || 'Server error';
        toast.error(language === 'mr' 
          ? `SP ला पाठवण्यात त्रुटी: ${errorMessage}` 
          : `Error sending to SP: ${errorMessage}`);
      } else {
        toast.error(language === 'mr' 
          ? 'नेटवर्क त्रुटी! कृपया पुन्हा प्रयत्न करा.' 
          : 'Network error! Please try again.');
      }
    }
  };

  // Handle send to Head
  const handleSendToHead = async (letter) => {
    try {
      const confirmSend = window.confirm(
        language === 'mr' 
          ? `तुम्हाला खरोखर हे पत्र प्रमुख ला पाठवायचे आहे का?\n\nसंदर्भ क्रमांक: ${letter.referenceNumber}` 
          : `Are you sure you want to send this letter to Head?\n\nReference No: ${letter.referenceNumber}`
      );
      
      if (!confirmSend) return;
      
      const token = sessionStorage.getItem('token');
      
      console.log('BaseLetterComponent - Sending to Head with role:', role);
      console.log('BaseLetterComponent - Source table name:', getSourceTableName(role));
      
      // Update the letter status to "sent to head" so it appears in HODLetters table
      const response = await axios.put(
        `${apiUrl}/api/patras/${letter._id || letter.id}/send-to-hod`,
        {
          letterStatus: language === 'mr' ? 'प्रमुखांकडे पाठवले' : 'sent to head',
          forwardTo: 'head',
          sendToData: {
            head: true,
            sp: false,
            igp: false,
            sdpo: false,
            policeStation: false
          },
          sourceTable: getSourceTableName(role) // Add source table information
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 200) {
        toast.success(language === 'mr' 
          ? 'पत्र यशस्वीरित्या प्रमुख ला पाठवले गेले! हे पत्र आता या टेबलमध्ये राहील आणि स्वाक्षरी स्थिती दिसेल.' 
          : 'Letter sent to Head successfully! This letter will remain in this table and show sign status.');
        
        // Update the letter in the current table to reflect the new status
        setLetters(prevLetters => 
          prevLetters.map(l => 
            (l._id || l.id) === (letter._id || letter.id) 
              ? { ...l, forwardTo: 'head', letterStatus: 'sent to head' }
              : l
          )
        );
        
        // Trigger event to update Head Dashboard in real-time
        window.dispatchEvent(new CustomEvent('letter-sent-to-head'));
      }
    } catch (error) {
      console.error('Error sending to Head:', error);
      
      if (error.response) {
        const errorMessage = error.response.data?.error || error.response.data?.message || 'Server error';
        toast.error(language === 'mr' 
          ? `प्रमुख ला पाठवण्यात त्रुटी: ${errorMessage}` 
          : `Error sending to Head: ${errorMessage}`);
      } else {
        toast.error(language === 'mr' 
          ? 'नेटवर्क त्रुटी! कृपया पुन्हा प्रयत्न करा.' 
          : 'Network error! Please try again.');
      }
    }
  };

  // Handler to delete covering letter
  const handleDeleteCoveringLetter = async (coveringLetterId) => {
    try {
      if (!coveringLetterId) {
        toast.error(language === 'mr' 
          ? 'कव्हरिंग लेटर ID सापडला नाही!' 
          : 'Covering letter ID not found!');
        return;
      }
      
      const confirmDelete = window.confirm(
        language === 'mr' 
          ? 'तुम्हाला खरोखर हे कव्हरिंग लेटर हटवायचे आहे का? हे S3 वरून देखील हटवले जाईल.' 
          : 'Are you sure you want to delete this covering letter? It will also be deleted from S3.'
      );
      
      if (!confirmDelete) return;
      
      const token = sessionStorage.getItem('token');
      
      const response = await axios.delete(
        `${apiUrl}/api/letters/${coveringLetterId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 200 && response.data.success) {
        toast.success(language === 'mr' 
          ? 'कव्हरिंग लेटर यशस्वीरित्या हटवले गेले!' 
          : 'Covering letter deleted successfully!');
        
        // Update the selected letter to remove covering letter reference
        setSelectedLetterForCovering(prev => ({
          ...prev,
          coveringLetter: null
        }));
        
        // Update the letter in the main list
        const letterId = selectedLetterForCovering._id || selectedLetterForCovering.id;
        setLetters(prevLetters => 
          prevLetters.map(l => 
            (l._id || l.id) === letterId 
              ? { ...l, coveringLetter: null }
              : l
          )
        );
        
        // Refresh to get updated data
        handleRefresh();
        
        // Keep modal open to show upload option
        console.log('Covering letter deleted, modal remains open for upload option');
      }
    } catch (error) {
      console.error('Error deleting covering letter:', error);
      
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || 'Server error';
        toast.error(language === 'mr' 
          ? `कव्हरिंग लेटर हटवताना त्रुटी: ${errorMessage}` 
          : `Error deleting covering letter: ${errorMessage}`);
      } else {
        toast.error(language === 'mr' 
          ? 'कव्हरिंग लेटर हटवताना त्रुटी!' 
          : 'Error deleting covering letter!');
      }
    }
  };

  // Handle drag events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle drop event
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      handleUploadCoveringLetter(selectedLetterForCovering, file);
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      handleUploadCoveringLetter(selectedLetterForCovering, file);
    }
  };

  // Get file size in readable format
  const getFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file icon based on type
  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) {
      return '📄';
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return '📝';
    }
    return '📎';
  };

  // Handler to upload covering letter file
  const handleUploadCoveringLetter = async (letter, file) => {
    try {
      if (!file) {
        toast.error(language === 'mr' ? 'कृपया फाईल निवडा!' : 'Please select a file!');
        return;
      }
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        toast.error(language === 'mr' 
          ? 'कृपया फक्त PDF किंवा Word फाईल निवडा!' 
          : 'Please select only PDF or Word files!');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(language === 'mr' 
          ? 'फाईल साइझ 10MB पेक्षा कमी असावा!' 
          : 'File size should be less than 10MB!');
        return;
      }
      
      // Show loading state
      setUploadingCoveringLetter(true);
      
      const token = sessionStorage.getItem('token');
      const formData = new FormData();
      
      formData.append('coveringLetterFile', file);
      formData.append('patraId', letter._id || letter.id);
      formData.append('letterNumber', letter.referenceNumber || `CL/${Date.now()}`);
      formData.append('letterDate', new Date().toISOString().split('T')[0]);
      formData.append('recipientOffice', letter.officeSendingLetter || 'कार्यालय');
      formData.append('recipientDesignation', letter.senderNameAndDesignation || 'अधिकारी');
      formData.append('status', 'DRAFT');
      
      const response = await axios.post(
        `${apiUrl}/api/letters/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`Upload progress: ${percentCompleted}%`);
          }
        }
      );
      
      if (response.status === 201 && response.data.success) {
        toast.success(language === 'mr' 
          ? 'कव्हरिंग लेटर यशस्वीरित्या S3 वर अपलोड केले गेले!' 
          : 'Covering letter uploaded successfully to S3!');
        
        // Use the updated patra data from the response
        const updatedPatra = response.data.updatedPatra;
        const updatedCoveringLetter = response.data.coveringLetter;
        
        // Update the selected letter with complete updated data
        setSelectedLetterForCovering(prev => ({
          ...prev,
          ...updatedPatra,
          coveringLetter: updatedCoveringLetter
        }));
        
        // Update the letter in the main list with complete updated data
        setLetters(prevLetters => 
          prevLetters.map(l => 
            (l._id || l.id) === (letter._id || letter.id) 
              ? { ...l, ...updatedPatra, coveringLetter: updatedCoveringLetter }
              : l
          )
        );
        
        // Refresh to get updated data
        handleRefresh();
        
        // Close the modal after successful upload
        setCoveringLetterModalOpen(false);
        setSelectedFile(null);
      }
    } catch (error) {
      console.error('Error uploading covering letter:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
      
      // Show more specific error message if it's about existing covering letter
      if (errorMessage.includes('already exists')) {
        toast.error(language === 'mr' 
          ? 'कव्हरिंग लेटर आधीच उपलब्ध आहे. कृपया आधी ते हटवा.' 
          : 'Covering letter already exists. Please delete it first.');
      } else {
        toast.error(language === 'mr' 
          ? `कव्हरिंग लेटर अपलोड करताना त्रुटी: ${errorMessage}` 
          : `Error uploading covering letter: ${errorMessage}`);
      }
    } finally {
      setUploadingCoveringLetter(false);
      setSelectedFile(null);
    }
  };

  // Handle file download with better error handling
  const handleFileDownload = async (letter, fileIndex = 0) => {
    try {
      let allFiles = [];

      // Gather all files from different possible locations
      // Check for uploadedFile structure (new structure from your API)
      if (letter.uploadedFile && letter.uploadedFile.fileUrl) {
        allFiles.push({
          url: letter.uploadedFile.fileUrl,
          name: letter.uploadedFile.originalName || 'document'
        });
      } else if (letter.uploadedFile && letter.uploadedFile.fileName) {
        allFiles.push({
          url: `${apiUrl}/${letter.uploadedFile.fileName.replace(/\\/g, '/')}`,
          name: letter.uploadedFile.originalName || letter.uploadedFile.fileName.split('/').pop()
        });
      }
      
      // Check for upload structure (legacy)
      if (letter.upload && letter.upload.fileUrl) {
        allFiles.push({
          url: letter.upload.fileUrl,
          name: letter.upload.originalName || 'document'
        });
      } else if (letter.upload && letter.upload.fileName) {
        allFiles.push({
          url: `${apiUrl}/${letter.upload.fileName.replace(/\\/g, '/')}`,
          name: letter.upload.originalName || letter.upload.fileName.split('/').pop()
        });
      }
      
      // Check for letterFiles array
      if (letter.letterFiles && letter.letterFiles.length > 0) {
        letter.letterFiles.forEach(file => {
          allFiles.push({
            url: `${apiUrl}/${file.filePath.replace(/\\/g, '/')}`,
            name: file.originalName || file.filePath.split('/').pop()
          });
        });
      }

      if (allFiles.length === 0) {
        console.error('No files found in letter:', letter);
        toast.error(language === 'mr' ? 'फाईल सापडली नाही!' : 'File not found!');
        return;
      }

      // If multiple files exist and no specific index is provided, ask user
      if (allFiles.length > 1 && fileIndex === 0) {
        const downloadAll = window.confirm(
          language === 'mr' 
            ? `${allFiles.length} फाईल्स सापडल्या. सर्व डाउनलोड करायच्या का?` 
            : `Found ${allFiles.length} files. Download all?`
        );
        
        if (downloadAll) {
          // Download all files with a small delay between each
          for (let i = 0; i < allFiles.length; i++) {
            setTimeout(() => {
              downloadSingleFile(allFiles[i].url, allFiles[i].name);
            }, i * 500); // 500ms delay between downloads
          }
          return;
        }
      }

      // Download single file
      const fileToDownload = allFiles[Math.min(fileIndex, allFiles.length - 1)];
      await downloadSingleFile(fileToDownload.url, fileToDownload.name);
      
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error(language === 'mr' ? 'फाईल डाउनलोड करताना त्रुटी!' : 'Error downloading file!');
    }
  };

  // Helper function to download a single file
  const downloadSingleFile = async (fileUrl, fileName) => {
    try {
      // For better cross-browser compatibility, use fetch
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('File download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (fetchError) {
      // Fallback to simple link click
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Check if letter has attachments
  const hasAttachments = (letter) => {
    const hasUpload = letter.upload && (letter.upload.fileUrl || letter.upload.fileName);
    const hasLetterFiles = letter.letterFiles && letter.letterFiles.length > 0;
    const hasUploadedFile = letter.uploadedFile && (letter.uploadedFile.fileUrl || letter.uploadedFile.fileName);
    
    return !!(hasUpload || hasLetterFiles || hasUploadedFile);
  };

  // Helper function to get source table name - simplified to only return Inward Table
  const getSourceTableName = (role) => {
    // All letters are now inward letters
    return 'Inward Table';
  };

  // Helper function to get user-friendly field labels
  const getFieldLabel = (key) => {
    const labelMap = {
      referenceNumber: language === 'mr' ? 'संदर्भ क्रमांक' : 'Reference Number',
      owReferenceNumber: language === 'mr' ? 'OW संदर्भ क्रमांक' : 'OW Reference Number',
      dateOfReceiptOfLetter: language === 'mr' ? 'पत्र प्राप्ती दिनांक' : 'Letter Receipt Date',
      officeSendingLetter: language === 'mr' ? 'पत्र पाठवणारे कार्यालय' : 'Office Sending Letter',
      senderNameAndDesignation: language === 'mr' ? 'पाठवणाऱ्याचे नाव व पदनाम' : 'Sender Name & Designation',
      mobileNumber: language === 'mr' ? 'मोबाईल नंबर' : 'Mobile Number',
      letterMedium: language === 'mr' ? 'पत्र माध्यम' : 'Letter Medium',
      letterClassification: language === 'mr' ? 'पत्र वर्गीकरण' : 'Letter Classification',
      letterType: language === 'mr' ? 'पत्राचा प्रकार' : 'Letter Type',
      letterDate: language === 'mr' ? 'पत्र दिनांक' : 'Letter Date',
      subject: language === 'mr' ? 'विषय' : 'Subject',
      outwardLetterNumber: language === 'mr' ? 'जावक पत्र क्रमांक' : 'Outward Letter Number',
      letterStatus: language === 'mr' ? 'पत्र स्थिती' : 'Letter Status',
      forwardTo: language === 'mr' ? 'यांना पाठवा' : 'Forward To'
    };
    return labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
  };

  // Helper function to format field values
  const formatFieldValue = (key, value) => {
    if (!value) return 'N/A';
    
    // Format dates
    if (key.includes('Date') || key === 'letterDate') {
      return formatDate(value);
    }
    
    // Format status
    if (key === 'letterStatus') {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }
    
    // Format forward to
    if (key === 'forwardTo') {
      return value.toUpperCase();
    }
    
    return String(value);
  };

  // Fetch data on component mount
  useEffect(() => {
    handleRefresh();
  }, []);

  // Filter letters based on search term and status
  const filteredLetters = Array.isArray(letters) 
    ? letters.filter(letter => {
        const searchableFields = [
          letter.referenceNumber,
          letter.owReferenceNumber,
          letter.letterType,
          letter.officeSendingLetter,
          letter.senderNameAndDesignation,
          letter.letterStatus,
          letter.subject,
          letter.forwardTo,
          // Add any additional searchable fields from props
          ...(additionalColumns.map(col => letter[col.key] || ''))
        ].join(' ').toLowerCase();
        
        const matchesSearch = searchTerm === '' || 
          searchableFields.includes(searchTerm.toLowerCase());
          
        const matchesStatus = statusFilter === 'All' || 
          (letter.letterStatus && 
           letter.letterStatus.toLowerCase() === statusFilter.toLowerCase());
          
        const matchesSignStatus = signStatusFilter === 'All' || 
          (signStatusFilter === 'pending' && (getSignStatus(letter) === 'pending' || getSignStatus(letter) === null)) ||
          (signStatusFilter === 'completed' && getSignStatus(letter) === 'completed');
          
        // Case status filtering logic
        const isCaseClosed = letter.inwardPatraClose === true || 
                           (letter.letterStatus && 
                            (letter.letterStatus.toLowerCase().includes('case close') ||
                             letter.letterStatus.toLowerCase().includes('केस बंद') ||
                             letter.letterStatus.toLowerCase().includes('closed')));
        
        const matchesCaseStatus = caseStatusFilter === 'All' ||
          (caseStatusFilter === 'closed' && isCaseClosed) ||
          (caseStatusFilter === 'open' && !isCaseClosed);
          
        return matchesSearch && matchesStatus && matchesSignStatus && matchesCaseStatus;
      })
    : [];

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

  // Render additional columns based on role
  const renderAdditionalColumns = (letter) => {
    return additionalColumns.map(col => (
      <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {col.render ? col.render(letter) : (letter[col.key] || 'N/A')}
      </td>
    ));
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
            placeholder={language === 'mr' ? 'पत्रे शोधा...' : 'Search letters...'}
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
          
          <select
            className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            value={signStatusFilter}
            onChange={(e) => setSignStatusFilter(e.target.value)}
          >
            {signStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            value={caseStatusFilter}
            onChange={(e) => setCaseStatusFilter(e.target.value)}
          >
            {caseStatusOptions.map((option) => (
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
                    {language === 'mr' ? 'आउटवर्ड संदर्भ क्रमांक' : 'Outward Reference No'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'तारीख' : 'Date'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'स्थिती' : 'Status'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'यांना पाठवा' : 'Forward To'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {language === 'mr' ? 'स्वाक्षरी स्थिती' : 'Sign Status'}
                  </th>
                  {/* Additional columns headers */}
                  {additionalColumns.map(col => (
                    <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {col.header}
                    </th>
                  ))}
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
                          onClick={() => navigate(`${getDashboardPath()}/track-application/${letter.referenceNumber}`)}
                          className="flex items-center hover:underline"
                          title={language === 'mr' ? 'अर्ज ट्रॅक करा' : 'Track Application'}
                        >
                          {letter.referenceNumber || 'N/A'}
                          <FiExternalLink className="ml-1 h-4 w-4" />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {letter.owReferenceNumber || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(letter.letterDate)}
                      </td>
                     
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          letter.letterStatus?.toLowerCase() === 'approved' ? 'bg-green-100 text-green-800' :
                          letter.letterStatus?.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          letter.letterStatus?.toLowerCase() === 'rejected' ? 'bg-red-100 text-red-800' :
                          letter.letterStatus?.toLowerCase() === 'case close' ? 'bg-gray-100 text-gray-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {letter.letterStatus ? 
                            letter.letterStatus.charAt(0).toUpperCase() + letter.letterStatus.slice(1) : 
                            'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          letter.forwardTo ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {letter.forwardTo ? letter.forwardTo.toUpperCase() : 'Not Set'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          getSignStatus(letter) === 'completed' ? 'bg-green-100 text-green-800' :
                          getSignStatus(letter) === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {getSignStatusDisplay(letter)}
                          {getSignStatus(letter) === 'completed' && (
                            <span className="ml-1 text-xs">✓</span>
                          )}
                        </span>
                      </td>
                      
                      {/* Additional columns */}
                      {renderAdditionalColumns(letter)}
                   
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button 
                            onClick={() => {
                              setSelectedLetter(letter);
                              setViewModalOpen(true);
                            }}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors shadow-sm"
                            title={language === 'mr' ? 'तपशील पहा' : 'View Details'}
                          >
                            <FiEye className="h-4 w-4" />
                            <span className="ml-1">{language === 'mr' ? 'तपशील' : 'Details'}</span>
                          </button>
                          
                          <button
                            onClick={() => handleCoveringLetterClick(letter)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded transition-colors shadow-sm bg-indigo-600 text-white hover:bg-indigo-700"
                            title={language === 'mr' ? 'कव्हरिंग लेटर व्यवस्थापित करा' : 'Manage Covering Letter'}
                          >
                            <FiFileText className="h-4 w-4" />
                            <span className="ml-1">{language === 'mr' ? 'कव्हर लेटर' : 'Cover Letter'}</span>
                          </button>

                          {(() => {
                            const signStatus = getSignStatus(letter);
                            const isSignCompleted = signStatus === 'completed';
                            
                            if (isSignCompleted) {
                              return (
                                <button
                                  disabled
                                  className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded cursor-not-allowed transition-colors shadow-sm"
                                  title={language === 'mr' ? 'स्वाक्षरी पूर्ण - पाठवणे शक्य नाही' : 'Sign Completed - Cannot Send'}
                                >
                                  <FiSend className="h-4 w-4" />
                                  <span className="ml-1">{language === 'mr' ? 'स्वाक्षरी पूर्ण' : 'Sign Completed'}</span>
                                </button>
                              );
                            } else {
                              return (
                                <button
                                  onClick={() => handleSendToHead(letter)}
                                  className="inline-flex items-center px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 transition-colors shadow-sm"
                                  title={language === 'mr' ? 'प्रमुख ला पाठवा' : 'Send to Head'}
                                >
                                  <FiSend className="h-4 w-4" />
                                  <span className="ml-1">{language === 'mr' ? 'प्रमुख ला पाठवा' : 'Send to Head'}</span>
                                </button>
                              );
                            }
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7 + additionalColumns.length} className="px-6 py-8 text-center text-gray-500">
                      {searchTerm || statusFilter !== 'All' || signStatusFilter !== 'All'
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

      {/* View Letter Details Modal */}
      {viewModalOpen && selectedLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 bg-gray-100 rounded-full p-1 shadow"
              onClick={() => setViewModalOpen(false)}
            >
              <FiX className="h-6 w-6" />
            </button>
            
            <h2 className="text-2xl font-bold mb-6 text-blue-700 text-center">
              {language === 'mr' ? 'पत्र तपशील' : 'Letter Details'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(selectedLetter)
                .filter(([key, value]) => {
                  // Only show relevant user-facing fields
                  const allowedFields = [
                    'referenceNumber', 'owReferenceNumber', 'dateOfReceiptOfLetter', 
                    'officeSendingLetter', 'senderNameAndDesignation', 'mobileNumber',
                    'letterMedium', 'letterClassification', 'letterType', 'letterDate',
                    'subject', 'outwardLetterNumber', 'letterStatus', 'forwardTo'
                  ];
                  return allowedFields.includes(key) && value !== null && value !== '';
                })
                .map(([key, value]) => (
                  <div key={key} className="col-span-1">
                    <div className="text-sm font-semibold text-blue-900 mb-1">
                      {getFieldLabel(key)}
                    </div>
                    <div className="text-base text-gray-800 p-2 bg-gray-50 rounded border">
                      {formatFieldValue(key, value)}
                    </div>
                  </div>
                ))}
            </div>

            {/* File Download Section */}
            {hasAttachments(selectedLetter) && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-800 mb-3">
                  {language === 'mr' ? 'संलग्न फाईल्स' : 'Attached Files'}
                </h3>
                <button
                  onClick={() => handleFileDownload(selectedLetter)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FiDownload className="mr-2 h-4 w-4" />
                  {language === 'mr' ? 'फाईल डाउनलोड करा' : 'Download File'}
                </button>
              </div>
            )}

            {/* View Reports Section */}
            {(() => {
              const hasReportFiles = selectedLetter.reportFiles && 
                                     selectedLetter.reportFiles !== '[]' && 
                                     selectedLetter.reportFiles !== 'null' && 
                                     selectedLetter.reportFiles !== null;
              
              if (hasReportFiles) {
                try {
                  const reportFiles = JSON.parse(selectedLetter.reportFiles);
                  return (
                    <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <h3 className="text-lg font-semibold text-purple-800 mb-3">
                        {language === 'mr' ? 'अपलोड केलेले रिपोर्ट्स' : 'Uploaded Reports'}
                      </h3>
                      <div className="space-y-3">
                        {reportFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200">
                            <div className="flex items-center flex-1">
                              <FiFileText className="h-5 w-5 text-purple-500 mr-3" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{file.originalName}</p>
                                <p className="text-xs text-gray-500">
                                  {file.size ? `${Math.round(file.size / 1024)} KB` : 'N/A'} • {file.mimetype || 'Unknown'}
                                </p>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => window.open(file.s3Url, '_blank')}
                                className="inline-flex items-center px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 transition-colors"
                                title={language === 'mr' ? 'रिपोर्ट पहा' : 'View Report'}
                              >
                                <FiEye className="h-3 w-3 mr-1" />
                                {language === 'mr' ? 'पहा' : 'View'}
                              </button>
                              <button
                                onClick={() => window.open(file.s3Url, '_blank')}
                                className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                                title={language === 'mr' ? 'रिपोर्ट डाउनलोड करा' : 'Download Report'}
                              >
                                <FiDownload className="h-3 w-3 mr-1" />
                                {language === 'mr' ? 'डाउनलोड' : 'Download'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                } catch (error) {
                  console.error('Error parsing report files:', error);
                  return (
                    <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
                      <h3 className="text-lg font-semibold text-red-800 mb-3">
                        {language === 'mr' ? 'रिपोर्ट्स' : 'Reports'}
                      </h3>
                      <p className="text-red-600">
                        {language === 'mr' ? 'रिपोर्ट फाइल्स पार्स करताना त्रुटी' : 'Error parsing report files'}
                      </p>
                    </div>
                  );
                }
              }
              return null;
            })()}
            
            <div className="flex justify-center mt-6">
              <button
                className="px-6 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                onClick={() => setViewModalOpen(false)}
              >
                {language === 'mr' ? 'बंद करा' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Covering Letter Management Modal */}
      {coveringLetterModalOpen && selectedLetterForCovering && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 p-6 relative">
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 bg-gray-100 rounded-full p-1 shadow"
              onClick={() => {
                setCoveringLetterModalOpen(false);
                setSelectedFile(null);
                setDragActive(false);
              }}
            >
              <FiX className="h-6 w-6" />
            </button>
            
            <h2 className="text-2xl font-bold mb-6 text-blue-700 text-center">
              {language === 'mr' ? 'कव्हरिंग लेटर व्यवस्थापन' : 'Covering Letter Management'}
            </h2>
            
            {/* Letter Info */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {language === 'mr' ? 'पत्र माहिती' : 'Letter Information'}
              </h3>
              <p className="text-sm text-gray-600">
                <span className="font-medium">{language === 'mr' ? 'संदर्भ क्रमांक:' : 'Reference No:'}</span> {selectedLetterForCovering.referenceNumber}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">{language === 'mr' ? 'कार्यालय:' : 'Office:'}</span> {selectedLetterForCovering.officeSendingLetter || 'N/A'}
              </p>
            </div>

            {/* Covering Letter Options */}
            <div className="space-y-4">
              {hasCoveringLetter(selectedLetterForCovering) ? (
                <>
                  {/* View Covering Letter Option */}
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-green-800 mb-1">
                          {language === 'mr' ? 'कव्हरिंग लेटर उपलब्ध आहे' : 'Covering Letter Available'}
                        </h3>
                        <p className="text-sm text-green-600">
                          {language === 'mr' ? 'कव्हरिंग लेटर यशस्वीरित्या अपलोड केले गेले आहे' : 'Covering letter has been successfully uploaded'}
                        </p>
                      </div>
                      <button
                        onClick={() => viewCoveringLetter(selectedLetterForCovering)}
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <FiEye className="mr-2 h-4 w-4" />
                        {language === 'mr' ? 'कव्हरिंग लेटर पहा' : 'View Covering Letter'}
                      </button>
                    </div>
                  </div>

                  {/* Delete and Upload New Option */}
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-3">
                      {language === 'mr' ? 'नवीन कव्हरिंग लेटर अपलोड करा' : 'Upload New Covering Letter'}
                    </h3>
                    <p className="text-sm text-yellow-600 mb-4">
                      {language === 'mr' 
                        ? 'नवीन कव्हरिंग लेटर अपलोड करण्यासाठी आधी सध्याचे हटवा' 
                        : 'Delete the current covering letter first to upload a new one'}
                    </p>
                    {(() => {
                      const signStatus = getSignStatus(selectedLetterForCovering);
                      const isSignCompleted = signStatus === 'completed';
                      
                      if (isSignCompleted) {
                        return (
                          <button
                            disabled
                            className="inline-flex items-center px-4 py-2 bg-gray-400 text-white text-sm font-medium rounded-lg cursor-not-allowed transition-colors"
                          >
                            <FiTrash2 className="mr-2 h-4 w-4" />
                            {language === 'mr' ? 'स्वाक्षरी पूर्ण - हटवणे शक्य नाही' : 'Sign Completed - Cannot Delete'}
                          </button>
                        );
                      } else {
                        return (
                          <button
                            onClick={() => handleDeleteCoveringLetter(
                              selectedLetterForCovering.coveringLetter?.id || selectedLetterForCovering.coveringLetter?._id
                            )}
                            className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                          >
                            <FiTrash2 className="mr-2 h-4 w-4" />
                            {language === 'mr' ? 'सध्याचे कव्हरिंग लेटर हटवा' : 'Delete Current Covering Letter'}
                          </button>
                        );
                      }
                    })()}
                  </div>
                </>
              ) : (
                                  <>
                    {/* No Covering Letter - Show Enhanced Upload Option */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-dashed border-blue-300 hover:border-blue-400 transition-all duration-300">
                      <div className="text-center">
                        <div className="mb-4">
                          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors">
                            <FiUpload className="w-8 h-8 text-blue-600" />
                          </div>
                          <h3 className="text-xl font-bold text-blue-800 mb-2">
                            {language === 'mr' ? 'कव्हरिंग लेटर अपलोड करा' : 'Upload Covering Letter'}
                          </h3>
                          <p className="text-sm text-blue-600 mb-4">
                            {language === 'mr' 
                              ? 'या पत्रासाठी कव्हरिंग लेटर अपलोड केले गेले नाही' 
                              : 'No covering letter has been uploaded for this letter'}
                          </p>
                        </div>

                        {/* Drag and Drop Upload Area */}
                        <div 
                          className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 cursor-pointer group ${
                            dragActive 
                              ? 'border-blue-500 bg-blue-100 scale-105' 
                              : 'border-blue-300 hover:border-blue-400 hover:bg-blue-25'
                          }`}
                          onDragEnter={handleDrag}
                          onDragLeave={handleDrag}
                          onDragOver={handleDrag}
                          onDrop={handleDrop}
                          onClick={() => document.getElementById('coveringLetterFileInput').click()}
                        >
                          <input
                            id="coveringLetterFileInput"
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                          
                          <div className="text-center">
                            <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-all duration-300 ${
                              dragActive ? 'bg-blue-200' : 'bg-blue-100 group-hover:bg-blue-200'
                            }`}>
                              <FiFileText className={`w-6 h-6 transition-colors duration-300 ${
                                dragActive ? 'text-blue-700' : 'text-blue-600'
                              }`} />
                            </div>
                            
                            <div className="space-y-2">
                              <p className={`text-lg font-semibold transition-colors duration-300 ${
                                dragActive ? 'text-blue-700' : 'text-blue-600'
                              }`}>
                                {dragActive 
                                  ? (language === 'mr' ? 'फाईल सोडा' : 'Drop file here')
                                  : (language === 'mr' ? 'फाईल निवडा किंवा येथे ड्रॅग करा' : 'Choose file or drag here')
                                }
                              </p>
                              
                              <div className="flex items-center justify-center space-x-2 text-sm text-blue-500">
                                <span>📄 PDF</span>
                                <span>•</span>
                                <span>📝 DOC</span>
                                <span>•</span>
                                <span>📝 DOCX</span>
                              </div>
                              
                              <p className="text-xs text-blue-500 mt-2">
                                {language === 'mr' 
                                  ? 'कमाल फाईल साइझ: 10MB' 
                                  : 'Maximum file size: 10MB'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Selected File Preview */}
                        {selectedFile && (
                          <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <span className="text-2xl">{getFileIcon(selectedFile.type)}</span>
                                <div className="text-left">
                                  <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                                    {selectedFile.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {getFileSize(selectedFile.size)}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedFile(null);
                                }}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <FiX className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Upload Button */}
                        <div className="mt-6">
                          <button
                            onClick={() => document.getElementById('coveringLetterFileInput').click()}
                            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                          >
                            <FiUpload className="mr-2 h-5 w-5" />
                            {language === 'mr' ? 'फाईल निवडा' : 'Choose File'}
                          </button>
                        </div>

                        {/* Help Text */}
                        <div className="mt-4 text-xs text-blue-600 bg-blue-25 p-3 rounded-lg">
                          <div className="flex items-start space-x-2">
                            <span className="text-blue-500 mt-0.5">💡</span>
                            <div className="text-left">
                              <p className="font-medium mb-1">
                                {language === 'mr' ? 'टिप:' : 'Tip:'}
                              </p>
                              <p>
                                {language === 'mr' 
                                  ? 'तुमी फाईल वर क्लिक करून निवडू शकता किंवा त्यास बॉक्समध्ये ड्रॅग करू शकता' 
                                  : 'You can click to select a file or drag it into the box'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
            </div>
            
            <div className="flex justify-center mt-6">
              <button
                className="px-6 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                onClick={() => {
                  setCoveringLetterModalOpen(false);
                  setSelectedFile(null);
                  setDragActive(false);
                }}
              >
                {language === 'mr' ? 'बंद करा' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Loading overlay for covering letter upload */}
      {uploadingCoveringLetter && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 shadow-2xl border border-blue-100 max-w-md mx-4">
            <div className="flex flex-col items-center text-center">
              {/* Enhanced Loading Animation */}
              <div className="relative mb-6">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-100"></div>
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent absolute top-0"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <FiUpload className="w-6 h-6 text-blue-600 animate-pulse" />
                </div>
              </div>
              
              {/* Upload Status */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-800">
                  {language === 'mr' ? 'अपलोड होत आहे...' : 'Uploading...'}
                </h3>
                <p className="text-sm text-gray-600">
                  {language === 'mr' 
                    ? 'कृपया थांबा, तुमचे कव्हरिंग लेटर S3 वर अपलोड होत आहे' 
                    : 'Please wait while your covering letter is being uploaded to S3'}
                </p>
              </div>
              
              {/* Progress Bar Animation */}
              <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
              </div>
              
              {/* Selected File Info */}
              {selectedFile && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 w-full">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{getFileIcon(selectedFile.type)}</span>
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {getFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BaseLetterComponent;
