import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEye, FiRefreshCw, FiSearch, FiFileText, FiEdit, FiMail, FiX, FiRotateCcw, FiUpload, FiDownload, FiCheck } from 'react-icons/fi';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import translations from '../../translations';

const HODLetters = () => {

  const apiUrl = import.meta.env.VITE_API_URL ;

  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = translations[language] || translations['en'];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [signStatusFilter, setSignStatusFilter] = useState('All');
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [coveringLetterModalOpen, setCoveringLetterModalOpen] = useState(false);
  const [selectedLetterForCovering, setSelectedLetterForCovering] = useState(null);
  const [signaturesModalOpen, setSignaturesModalOpen] = useState(false);
  const [userSignatures, setUserSignatures] = useState([]);
  const [loadingSignatures, setLoadingSignatures] = useState(false);

  const [resendingLetters, setResendingLetters] = useState(new Set()); // Track which letters are being resent
  const [signingLetters, setSigningLetters] = useState(new Set()); // Track which letters are being signed
  const [signedLetters, setSignedLetters] = useState(new Set()); // Track which letters have been signed

  // Status filter options with translations - ADDED "sent to head"
  const statusOptions = [
    { value: 'All', label: language === 'mr' ? 'सर्व स्थिती' : 'All Status' },
    { value: 'sent to head', label: language === 'mr' ? 'प्रमुखांकडे पाठवले' : 'Sent to Head' },
    { value: 'pending', label: language === 'mr' ? 'प्रलंबित' : 'Pending' },
    { value: 'approved', label: language === 'mr' ? 'मंजूर' : 'Approved' },
    { value: 'rejected', label: language === 'mr' ? 'नाकारले' : 'Rejected' },
    { value: 'case close', label: language === 'mr' ? 'केस बंद' : 'Case Closed' }
  ];

  // Sign Status filter options
  const signStatusOptions = [
    { value: 'All', label: language === 'mr' ? 'सर्व स्वाक्षरी स्थिती' : 'All Sign Status' },
    { value: 'signed', label: language === 'mr' ? 'स्वाक्षरी पूर्ण' : 'Signed' },
    { value: 'unsigned', label: language === 'mr' ? 'स्वाक्षरी प्रलंबित' : 'Unsigned' }
  ];

  // Field labels for the view modal
  const fieldLabels = {
    dateOfReceiptOfLetter: { en: 'Date of Receipt', mr: 'प्राप्तीची तारीख' },
    officeSendingLetter: { en: 'Sender Office', mr: 'पत्र पाठविणारे कार्यालय' },
    senderNameAndDesignation: { en: 'Sender Name & Designation', mr: 'प्रेषकाचे नाव व पदनाम' },
    mobileNumber: { en: 'Mobile Number', mr: 'मोबाईल नंबर' },
    letterMedium: { en: 'Letter Medium', mr: 'पत्र माध्यम' },
    letterClassification: { en: 'Classification', mr: 'वर्गीकरण' },
    letterType: { en: 'Letter Type', mr: 'पत्र प्रकार' },
    letterDate: { en: 'Letter Date', mr: 'पत्राची तारीख' },
    subject: { en: 'Subject', mr: 'विषय' },
    outwardLetterNumber: { en: 'Outward Letter Number', mr: 'बाह्य पत्र क्रमांक' },
    numberOfCopies: { en: 'Number of Copies', mr: 'प्रतींची संख्या' },
    letterStatus: { en: 'Status', mr: 'स्थिती' },
    NA: { en: 'NA', mr: 'NA' },
    NAR: { en: 'NAR', mr: 'NAR' },
    userId: { en: 'User ID', mr: 'वापरकर्ता आयडी' },
    fileId: { en: 'File ID', mr: 'फाइल आयडी' },
    referenceNumber: { en: 'Reference Number', mr: 'संदर्भ क्रमांक' },
    sentTo: { en: 'Sent To', mr: 'पाठवले' }
  };

  // Fields to exclude from the view modal
  const excludedFields = [
    '_id', '__v', 'id', 'createdAt', 'updatedAt', 
    'fileId', 'userId', 'upload', 'extractedData', 'upload',
    'forwardTo', 'sentTo', 'previousStatus', 'resendAt', 'resendByRole', 'User',
    'reportFiles', 'inwardPatraClose', 'caseClosedAt', 'caseClosedBy', 
    'reportUploadedAt', 'reportUploadedBy', 'reportUploadedByEmail', 'caseClosedByEmail'
  ];

  // Helper function to determine sign status
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

  // Helper function to check if a letter has been signed
  const isLetterSigned = (letter) => {
    return letter.coveringLetter && letter.coveringLetter.isSigned === true;
  };

  // Helper function to get user data
  const getUserData = () => {
    const token = sessionStorage.getItem('token');
    const userInfo = sessionStorage.getItem('userInfo') || sessionStorage.getItem('user');
    
    let userData = null;
    
    // Try to parse user info from localStorage
    if (userInfo) {
      try {
        userData = JSON.parse(userInfo);
      } catch (e) {
        console.error('Error parsing user info:', e);
      }
    }
    
    // If no user data in localStorage, decode from JWT token
    if (!userData && token) {
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          userData = {
            id: payload.id || payload.userId || payload.sub,
            email: payload.email,
            name: payload.name || payload.username,
            role: payload.role || payload.roleId
          };
        }
      } catch (e) {
        console.error('Error decoding token:', e);
      }
    }
    
    return userData;
  };

  // Helper function to safely render values
  const renderFieldValue = (key, value) => {
    // Handle null, undefined, or empty values
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }

    // Handle sentTo object specially
    if (key === 'sentTo' && typeof value === 'object') {
      const sentToList = [];
      if (value.igp) sentToList.push('IGP');
      if (value.sp) sentToList.push('SP');
      if (value.sdpo) sentToList.push('SDPO');
      if (value.policeStation && value.selectedDistrict) {
        sentToList.push(`Police Station (${value.selectedDistrict})`);
      }
      return sentToList.length > 0 ? sentToList.join(', ') : 'N/A';
    }

    // Handle objects - exclude technical objects
    if (typeof value === 'object') {
      // If it's an array, join the elements
      if (Array.isArray(value)) {
        return value.length > 0 ? value.join(', ') : 'N/A';
      }
      
      // If it's an object, try to extract meaningful information
      if (value.id && value.email) {
        return `${value.email} (ID: ${value.id})`;
      }
      
      if (value.name) {
        return value.name;
      }
      
      // For upload objects, show only file name if available
      if (key === 'upload' && value.originalName) {
        return value.originalName;
      }
      
      // For other objects, don't display them as they're usually technical data
      return 'N/A';
    }

    // Handle boolean values
    if (typeof value === 'boolean') {
      return value ? (language === 'mr' ? 'होय' : 'Yes') : (language === 'mr' ? 'नाही' : 'No');
    }

    // For dates
    if (key.includes('Date') || key.includes('date') || key === 'sentAt') {
      return formatDate(value);
    }

    // For regular strings/numbers
    return String(value);
  };

  // Function to get file URL from API
  const getFileUrlFromId = async (fileId) => {
    try {
      console.log('Fetching file URL for ID:', fileId);
      
      const response = await fetch(`${apiUrl}/api/files/${fileId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`
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
  const previewFile = async (letter) => {
    try {
      let fileUrl = null;
      
      // First check if letter has upload data with fileUrl
      if (letter.upload && letter.upload.fileUrl) {
        fileUrl = letter.upload.fileUrl;
      } else if (letter.fileId) {
        // Get file URL from API
        const fileInfo = await getFileUrlFromId(letter.fileId);
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

  // Function to check if letter has covering letter
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
    
    if (url) {
      window.open(url, '_blank');
    } else {
      alert(language === 'mr' ? 'कव्हरिंग लेटर उपलब्ध नाही' : 'Covering letter not available');
    }
  };

  // Function to handle covering letter button click
  const handleCoveringLetterClick = (letter) => {
    setSelectedLetterForCovering(letter);
    setCoveringLetterModalOpen(true);
  };

  // Function to fetch user signatures
  const fetchUserSignatures = async () => {
    try {
      setLoadingSignatures(true);
      const user = getUserData();
      
      if (!user || !user.id) {
        setError(language === 'mr' ? 'वापरकर्ता माहिती आढळली नाही' : 'User information not found');
        return;
      }

      console.log('Fetching signatures for user:', user.id);

      // Call the new Head signature API
      const response = await axios.get(`${apiUrl}/api/head/head-signature/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        }
      });
      
      if (response.data.success && response.data.data.hasSignature) {
        // Create signature object for display
        const signature = {
          id: Date.now(),
          fileName: 'Head Signature',
          fileSize: 0,
          uploadDate: new Date().toISOString(),
          previewUrl: response.data.data.sign,
          signUrl: response.data.data.sign,
          isActive: true
        };
        
        setUserSignatures([signature]);
        console.log('Loaded signature from API:', signature);
      } else {
        setUserSignatures([]);
        console.log('No signature found for user');
      }
    } catch (error) {
      console.error('Error fetching signatures:', error);
      setUserSignatures([]);
    } finally {
      setLoadingSignatures(false);
    }
  };

  // Function to attach signature to covering letter
  const handleAttachSignatureToCovering = (letterId) => {
    try {
      console.log('Attaching signature to covering letter for letter:', letterId);
      // Set the selected letter for covering
      const letter = letters.find(letter => (letter.id || letter._id) === letterId);
      setSelectedLetterForCovering(letter);
      // Fetch signatures and show modal
      fetchUserSignatures();
      setSignaturesModalOpen(true);
    } catch (error) {
      console.error('Error attaching signature:', error);
      alert(language === 'mr' ? 'स्वाक्षरी जोडण्यात त्रुटी!' : 'Error attaching signature!');
    }
  };

  // Function to handle resend letter back to original source table
  const handleResendLetter = async (letter) => {
    const letterId = letter.id || letter._id;
    
    // Check if already resending
    if (resendingLetters.has(letterId)) {
      return;
    }
    
    // Get the original source table
    const sourceTable = getSourceTableForRevert(letter);
    const sourceTableName = getSourceTableName(letter);
    
    try {
      // Show confirmation dialog with source table info
      const confirmResend = window.confirm(
        language === 'mr' 
          ? `तुम्हाला खरोखर हे पत्र परत ${sourceTableName} मध्ये पाठवायचे आहे का?\n\nसंदर्भ क्रमांक: ${letter.referenceNumber}\nस्रोत टेबल: ${sourceTableName}`
          : `Are you sure you want to resend this letter back to ${sourceTableName}?\n\nReference No: ${letter.referenceNumber}\nSource Table: ${sourceTableName}`
      );
      
      if (!confirmResend) {
        return;
      }
      
      // Set loading state for this specific letter
      setResendingLetters(prev => new Set(prev).add(letterId));
      
      const token = sessionStorage.getItem('token');
      
      if (!token) {
        alert(language === 'mr' ? 
          'कृपया पुन्हा लॉगिन करा!' : 
          'Please login again!');
        navigate('/login');
        return;
      }

      console.log('Resending letter:', {
        letterId: letterId,
        referenceNumber: letter.referenceNumber,
        sourceTable: sourceTable,
        sourceTableName: sourceTableName
      });

      // Update letter status and forwardTo to send it back to the original table
      const response = await axios.put(
        `${apiUrl}/api/patras/${letterId}/resend`,
        {
          newStatus: 'pending', // Set to pending so it appears in the original table
          forwardTo: sourceTable, // Set forwardTo to the original source table
          reason: `Resent by HOD back to ${sourceTableName}`
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.status === 200) {
        const successMessage = language === 'mr' ? 
          `पत्र यशस्वीरित्या ${sourceTableName} मध्ये परत पाठवले गेले!\n\nसंदर्भ क्रमांक: ${letter.referenceNumber}` : 
          `Letter successfully resent to ${sourceTableName}!\n\nReference No: ${letter.referenceNumber}`;
        
        alert(successMessage);
        
        // Refresh letters to remove it from HOD list
        handleRefresh();
      }
    } catch (error) {
      console.error('Error resending letter:', error);
      
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          'Failed to resend letter';
      
      alert(language === 'mr' ? 
        `पत्र परत पाठवण्यात त्रुटी: ${errorMessage}` : 
        `Error resending letter: ${errorMessage}`);
    } finally {
      // Clear loading state for this letter
      setResendingLetters(prev => {
        const newSet = new Set(prev);
        newSet.delete(letterId);
        return newSet;
      });
    }
  };

  // Fetch letters from API
  const handleRefresh = async () => {
    setLoading(true);
    setError('');
    try {
      const token = sessionStorage.getItem('token');
      
      // Use the specific Head letters endpoint
      const response = await axios.get(`${apiUrl}/api/patras/head`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        timeout: 10000
      });
      
      console.log('HOD Letters - Full API Response:', response.data);
      
      // Handle different response structures
      let lettersData = [];
      
      if (response.data && response.data.patras && Array.isArray(response.data.patras)) {
        // New API structure: { message, count, patras: [...] }
        lettersData = response.data.patras;
        console.log('HOD Letters - Using patras array from response');
      } else if (response.data && Array.isArray(response.data)) {
        // Direct array response: [...]
        lettersData = response.data;
        console.log('HOD Letters - Using direct array response');
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        // Alternative structure: { data: [...] }
        lettersData = response.data.data;
        console.log('HOD Letters - Using data array from response');
      } else if (response.data && response.data.success && Array.isArray(response.data.data)) {
        // Handle { success, message, data: [...] } structure
        lettersData = response.data.data;
        console.log('HOD Letters - Using data array from { success, message, data } response');
      } else if (
        response.data &&
        response.data.data &&
        response.data.data.patras &&
        Array.isArray(response.data.data.patras)
      ) {
        // Handle { success, message, data: { patras: [...] } } structure
        lettersData = response.data.data.patras;
        console.log('HOD Letters - Using patras array from response.data.data.patras');
      } else {
        console.error('HOD Letters - Unexpected response structure:', response.data);
        throw new Error('Invalid data format received from server');
      }
      
      console.log('HOD Letters - All letters received:', lettersData.length);
      console.log('HOD Letters - Letter statuses:', lettersData.map(l => ({ 
        id: l.referenceNumber, 
        status: l.letterStatus 
      })));
      
      setLetters(lettersData);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 
                         err.response?.data?.error ||
                         err.message || 
                         'Failed to fetch letters. Please check your connection and try again.';
      
      // Handle authentication errors
      if (err.response?.status === 401 || err.response?.data?.error === 'User not found') {
        console.error('Authentication error:', err);
        alert(language === 'mr' ? 
          'आपली सत्र संपली आहे. कृपया पुन्हा लॉगिन करा.' : 
          'Your session has expired. Please login again.');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('userInfo');
        sessionStorage.removeItem('user');
        navigate('/login');
        return;
      }
      
      setError(errorMessage);
      console.error('Error fetching letters:', err);
      setLetters([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    // Check if user is authenticated
    const token = sessionStorage.getItem('token');
    if (!token) {
      alert(language === 'mr' ? 
        'कृपया प्रथम लॉगिन करा!' : 
        'Please login first!');
      navigate('/login');
      return;
    }
    
    handleRefresh();
  }, [navigate, language]);

  // Helper function to check if status is "sending for head sign" in any language
  const isSendingForHeadSign = (status) => {
    if (!status) return false;
    const statusLower = status.toLowerCase();
    const sendingForHeadSignVariations = [
      'sending for head sign',
      'प्रमुख स्वाक्षरीसाठी पाठवत आहे',
      'प्रमुख स्वाक्षरीसाठी'
    ];
    
    return sendingForHeadSignVariations.some(variation => 
      statusLower === variation.toLowerCase() || status === variation
    );
  };

  // Filter letters based on search term and status
  // Only show letters that have been sent to HOD (sent to head, pending, approved, rejected)
  const filteredLetters = letters.filter(letter => {
    const letterStatus = letter.letterStatus || letter.letter_status || letter.status || '';
    
    // Debug logging
    console.log('HOD Filter - Letter:', letter.referenceNumber, 'Status:', letterStatus);
    
    // Exclude letters with "sending for head sign" status
    if (isSendingForHeadSign(letterStatus)) {
      console.log('HOD Filter - Excluding letter:', letter.referenceNumber, 'Status is sending for head sign');
      return false;
    }
    
    // FIXED: Include letters with sent to head, pending, approved, or rejected status
    const statusLower = letterStatus.toLowerCase();
    const allowedStatuses = [
      'sent to head',        // ✅ When staff sends to HOD
      'pending',             // ✅ When HOD needs to review
      'approved',            // ✅ When HOD approves
      'rejected',            // ✅ When HOD rejects
      'case close',          // ✅ When case is closed after report upload
      'प्रमुखांकडे पाठवले',    // ✅ Marathi for "sent to head"
      'प्रलंबित',            // ✅ Marathi for "pending"
      'मंजूर',               // ✅ Marathi for "approved"
      'नाकारले',             // ✅ Marathi for "rejected"
      'केस बंद'              // ✅ Marathi for "case close"
    ];
    
    const hasAllowedStatus = allowedStatuses.some(s => 
      statusLower === s.toLowerCase() || letterStatus === s
    );
    
    if (!hasAllowedStatus && letterStatus !== '') {
      console.log('HOD Filter - Excluding letter:', letter.referenceNumber, 'Status not allowed:', letterStatus);
      return false;
    }

    const searchableFields = [
      letter.referenceNumber,
      letter.senderNameAndDesignation,
      letter.officeSendingLetter,
      letter.subject
    ].join(' ').toLowerCase();

    const matchesSearch = searchTerm === '' || 
      searchableFields.includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || 
      statusLower === statusFilter.toLowerCase() ||
      (statusFilter === 'sent to head' && (statusLower === 'sent to head' || letterStatus === 'प्रमुखांकडे पाठवले')) ||
      (statusFilter === 'pending' && (statusLower === 'pending' || letterStatus === 'प्रलंबित')) ||
      (statusFilter === 'approved' && (statusLower === 'approved' || letterStatus === 'मंजूर')) ||
      (statusFilter === 'rejected' && (statusLower === 'rejected' || letterStatus === 'नाकारले')) ||
      (statusFilter === 'case close' && (statusLower === 'case close' || letterStatus === 'केस बंद'));

    // Sign status filtering
    const signStatus = getSignStatus(letter);
    const matchesSignStatus = signStatusFilter === 'All' || 
      (signStatusFilter === 'signed' && signStatus === 'completed') ||
      (signStatusFilter === 'unsigned' && (signStatus === 'pending' || signStatus === null));

    const shouldInclude = matchesSearch && matchesStatus && matchesSignStatus && hasAllowedStatus;
    if (shouldInclude) {
      console.log('HOD Filter - Including letter:', letter.referenceNumber, 'Status:', letterStatus);
    }
    
    return shouldInclude;
  });

  const totalPages = Math.ceil(filteredLetters.length / recordsPerPage);
  const paginatedLetters = filteredLetters.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

  // Helper function to get source table name
  const getSourceTableName = (letter) => {
    console.log('Getting source table for letter:', letter.referenceNumber);
    console.log('Letter sentTo:', letter.sentTo);
    console.log('Letter forwardTo:', letter.forwardTo);
    
    // Determine source table based on letter data
    // This can be determined from various fields like forwardTo, sentTo, or other metadata
    
    // Check if there's a sentTo field with recipient information
    if (letter.sentTo) {
      try {
        const sentToData = JSON.parse(letter.sentTo);
        console.log('Parsed sentToData:', sentToData);
        
        // First check if sourceTable is directly stored
        if (sentToData.sourceTable) {
          console.log('Found sourceTable in sentToData:', sentToData.sourceTable);
          return sentToData.sourceTable;
        }
        
        if (sentToData.sendToData) {
          // Check which table was selected in sendToData
          const sendToDataObj = sentToData.sendToData;
          console.log('sendToData object:', sendToDataObj);
          if (sendToDataObj.sp) return language === 'mr' ? 'एसपी टेबल' : 'SP Table';
          if (sendToDataObj.collector) return language === 'mr' ? 'कलेक्टर टेबल' : 'Collector Table';
          if (sendToDataObj.home) return language === 'mr' ? 'होम टेबल' : 'Home Table';
          if (sendToDataObj.ig) return language === 'mr' ? 'आयजी टेबल' : 'IG Table';
          if (sendToDataObj.shanik) return language === 'mr' ? 'शाणिक टेबल' : 'Shanik Table';
          if (sendToDataObj.dg) return language === 'mr' ? 'डीजी टेबल' : 'DG Table';
        }
      } catch (e) {
        console.log('Error parsing sentTo data:', e);
      }
    }
    
    // Check forwardTo field
    if (letter.forwardTo) {
      const forwardTo = letter.forwardTo.toLowerCase();
      switch (forwardTo) {
        case 'sp':
          return language === 'mr' ? 'एसपी टेबल' : 'SP Table';
        case 'collector':
          return language === 'mr' ? 'कलेक्टर टेबल' : 'Collector Table';
        case 'home':
          return language === 'mr' ? 'होम टेबल' : 'Home Table';
        case 'ig':
        case 'ig_nashik':
          return language === 'mr' ? 'आयजी टेबल' : 'IG Table';
        case 'shanik':
        case 'shanik_local':
          return language === 'mr' ? 'शाणिक टेबल' : 'Shanik Table';
        case 'dg':
        case 'dg_other':
          return language === 'mr' ? 'डीजी टेबल' : 'DG Table';
        case 'inward':
        case 'inward_user':
          return language === 'mr' ? 'इनवर्ड टेबल' : 'Inward Table';
        default:
          return language === 'mr' ? 'अज्ञात टेबल' : 'Unknown Table';
      }
    }
    
    // If no specific source found, try to determine from other fields
    if (letter.officeSendingLetter) {
      const office = letter.officeSendingLetter.toLowerCase();
      if (office.includes('police') || office.includes('पोलीस')) {
        return language === 'mr' ? 'पोलीस टेबल' : 'Police Table';
      }
      if (office.includes('collector') || office.includes('कलेक्टर')) {
        return language === 'mr' ? 'कलेक्टर टेबल' : 'Collector Table';
      }
      if (office.includes('home') || office.includes('गृह')) {
        return language === 'mr' ? 'होम टेबल' : 'Home Table';
      }
    }
    
    // Default fallback
    return language === 'mr' ? 'इनवर्ड टेबल' : 'Inward Table';
  };

  // Helper function to get source table for revert (returns table identifier)
  const getSourceTableForRevert = (letter) => {
    console.log('Getting source table for revert for letter:', letter.referenceNumber);
    console.log('Letter sentTo:', letter.sentTo);
    console.log('Letter forwardTo:', letter.forwardTo);
    
    // Check if there's a sentTo field with recipient information
    if (letter.sentTo) {
      try {
        const sentToData = JSON.parse(letter.sentTo);
        console.log('Parsed sentToData for revert:', sentToData);
        
        // First check if sourceTable is directly stored
        if (sentToData.sourceTable) {
          const sourceTable = sentToData.sourceTable;
          console.log('Found sourceTable in sentToData for revert:', sourceTable);
          // Map table names back to identifiers
          if (sourceTable.includes('SP')) return 'sp';
          if (sourceTable.includes('Collector')) return 'collector';
          if (sourceTable.includes('Home')) return 'home';
          if (sourceTable.includes('IG')) return 'ig_nashik_other';
          if (sourceTable.includes('Shanik')) return 'shanik_local';
          if (sourceTable.includes('DG')) return 'dg_other';
          if (sourceTable.includes('Inward')) return 'inward_user';
          if (sourceTable.includes('Outward')) return 'outward_user';
        }
        
        if (sentToData.sendToData) {
          // Check which table was selected in sendToData
          const sendToDataObj = sentToData.sendToData;
          console.log('sendToData object for revert:', sendToDataObj);
          if (sendToDataObj.sp) return 'sp';
          if (sendToDataObj.collector) return 'collector';
          if (sendToDataObj.home) return 'home';
          if (sendToDataObj.ig) return 'ig_nashik_other';
          if (sendToDataObj.shanik) return 'shanik_local';
          if (sendToDataObj.dg) return 'dg_other';
        }
      } catch (e) {
        console.log('Error parsing sentTo data for revert:', e);
      }
    }
    
    // Check forwardTo field
    if (letter.forwardTo) {
      const forwardTo = letter.forwardTo.toLowerCase();
      console.log('Using forwardTo for revert:', forwardTo);
      switch (forwardTo) {
        case 'sp': return 'sp';
        case 'collector': return 'collector';
        case 'home': return 'home';
        case 'ig':
        case 'ig_nashik':
        case 'ig_nashik_other': return 'ig_nashik_other';
        case 'shanik':
        case 'shanik_local': return 'shanik_local';
        case 'dg':
        case 'dg_other': return 'dg_other';
        case 'inward':
        case 'inward_user': return 'inward_user';
        case 'outward':
        case 'outward_user': return 'outward_user';
        default: return 'inward_user';
      }
    }
    
    // Default fallback
    console.log('Using default fallback for revert: inward_user');
    return 'inward_user';
  };

  // Helper function to get status badge styling
  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase() || 'pending';
    
    const statusConfig = {
      'sent to head': {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        label: language === 'mr' ? 'प्रमुखांकडे पाठवले' : 'Sent to Head'
      },
      'प्रमुखांकडे पाठवले': {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        label: language === 'mr' ? 'प्रमुखांकडे पाठवले' : 'Sent to Head'
      },
      pending: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        label: language === 'mr' ? 'प्रलंबित' : 'Pending'
      },
      'प्रलंबित': {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        label: language === 'mr' ? 'प्रलंबित' : 'Pending'
      },
      approved: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        label: language === 'mr' ? 'मंजूर' : 'Approved'
      },
      'मंजूर': {
        bg: 'bg-green-100',
        text: 'text-green-800',
        label: language === 'mr' ? 'मंजूर' : 'Approved'
      },
      rejected: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        label: language === 'mr' ? 'नाकारले' : 'Rejected'
      },
      'नाकारले': {
        bg: 'bg-red-100',
        text: 'text-red-800',
        label: language === 'mr' ? 'नाकारले' : 'Rejected' 
      },
      'sending for head sign': {
        bg: 'bg-orange-100',
        text: 'text-orange-800',
        label: language === 'mr' ? 'प्रमुख स्वाक्षरीसाठी' : 'For Head Sign'
      },
      'प्रमुख स्वाक्षरीसाठी': {
        bg: 'bg-orange-100',
        text: 'text-orange-800',
        label: language === 'mr' ? 'प्रमुख स्वाक्षरीसाठी' : 'For Head Sign'
      },
      'case close': {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        label: language === 'mr' ? 'केस बंद' : 'Case Closed'
      },
      'केस बंद': {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        label: language === 'mr' ? 'केस बंद' : 'Case Closed'
      }
    };

    // Check for exact match first
    if (statusConfig[status]) {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[status].bg} ${statusConfig[status].text}`}>
          {statusConfig[status].label}
        </span>
      );
    }

    // Then check lowercase
    const config = statusConfig[statusLower] || statusConfig.pending;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  // Handle attach sign action
  const handleAttachSign = async (letterId) => {
    try {
      console.log('Attaching sign to letter:', letterId);
      // Navigate to upload sign page with letter ID
      navigate(`/dashboard/upload-sign/${letterId}`);
    } catch (error) {
      console.error('Error attaching sign:', error);
      alert(language === 'mr' ? 'स्वाक्षरी जोडण्यात त्रुटी!' : 'Error attaching sign!');
    }
  };

  // Function to handle signature selection and attachment
  const handleSignatureSelection = async (signature) => {
    const letterId = selectedLetterForCovering.id || selectedLetterForCovering._id;
    
    // Check if already signing
    if (signingLetters.has(letterId)) {
      return;
    }

    try {
      if (!selectedLetterForCovering) {
        alert(language === 'mr' ? 'पत्र निवडले नाही' : 'No letter selected');
        return;
      }

      // Get user data from token
      const token = sessionStorage.getItem('token');
      if (!token) {
        alert(language === 'mr' ? 'कृपया पुन्हा लॉगिन करा!' : 'Please login again!');
        return;
      }

      const tokenData = JSON.parse(atob(token.split('.')[1]));
      const userId = tokenData.id || tokenData.userId;

      console.log('Attaching signature to covering letter:', {
        coveringLetterId: selectedLetterForCovering.id,
        userId: userId,
        signature: signature
      });

      // Set loading state for this specific letter
      setSigningLetters(prev => new Set(prev).add(letterId));

      // Call the new Head signature API
      const response = await axios.post(
        `${apiUrl}/api/head/upload-signature/${selectedLetterForCovering.id}`,
        {
          userId: userId,
          signaturePosition: 'top-right', // Default position
          remarks: 'Signed by HOD',
          signerName: 'अर्ज शाखा प्रभारी अधिकारी' // Default Marathi name
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        // Mark letter as signed
        setSignedLetters(prev => new Set(prev).add(letterId));
        
        alert(language === 'mr' ? 'स्वाक्षरी यशस्वीरित्या जोडली गेली!' : 'Signature attached successfully!');
        setSignaturesModalOpen(false);
        setCoveringLetterModalOpen(false);
        
        // Trigger event to update all letter tables
        window.dispatchEvent(new CustomEvent('signature-completed'));
        
        // Refresh the letters list
        handleRefresh();
      } else {
        alert(language === 'mr' ? 'स्वाक्षरी जोडण्यात त्रुटी!' : 'Error attaching signature!');
      }
    } catch (error) {
      console.error('Error attaching signature to letter:', error);
      
      // Handle specific error cases
      if (error.response?.data?.error) {
        if (error.response.data.error.includes('No signature found')) {
          alert(language === 'mr' ? 
            'तुमच्याकडे कोणतीही स्वाक्षरी अपलोड केलेली नाही. कृपया प्रथम स्वाक्षरी अपलोड करा.' : 
            'You have no signature uploaded. Please upload a signature first.');
        } else {
          alert(language === 'mr' ? 
            `स्वाक्षरी जोडण्यात त्रुटी: ${error.response.data.error}` : 
            `Error attaching signature: ${error.response.data.error}`);
        }
      } else {
        alert(language === 'mr' ? 'स्वाक्षरी जोडण्यात त्रुटी!' : 'Error attaching signature!');
      }
    } finally {
      // Clear loading state for this letter
      setSigningLetters(prev => {
        const newSet = new Set(prev);
        newSet.delete(letterId);
        return newSet;
      });
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString(language === 'mr' ? 'mr-IN' : 'en-US');
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {language === 'mr' ? 'HOD मंजुरीसाठी पत्रे' : 'Letters for HOD Approval'}
          </h1>
          <p className="text-gray-500">
            {language === 'mr' 
              ? 'मंजुरी किंवा नाकारण्यासाठी पत्रे पहा' 
              : 'View letters for approval or rejection'}
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
            <select
              value={signStatusFilter}
              onChange={(e) => setSignStatusFilter(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              {signStatusOptions.map((option) => (
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
                    <th scope="col" className="px-8 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                      {language === 'mr' ? 'स्थिती' : 'Status'}
                    </th>
                    <th scope="col" className="px-8 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                      {language === 'mr' ? 'बाह्य संदर्भ क्रमांक' : 'Outward Reference No'}
                    </th>
                    <th scope="col" className="px-8 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                      {language === 'mr' ? 'मूळ टेबल' : 'From Table'}
                    </th>
                    <th scope="col" className="px-8 py-4 text-center text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                      {language === 'mr' ? 'परत पाठवा' : 'Resend'}
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
                          onClick={() => navigate(`/head-dashboard/track-application/${letter.referenceNumber}`)}
                          className="hover:text-blue-800 hover:underline focus:outline-none"
                          title={language === 'mr' ? 'अर्जाचा मागोवा पहा' : 'Track application'}
                        >
                          {letter.referenceNumber || 'N/A'}
                        </button>
                      </td>
                      <td className="px-8 py-4 whitespace-nowrap text-sm">
                        {getStatusBadge(letter.letterStatus)}
                      </td>
                      <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900">
                        {letter.owReferenceNumber || 'N/A'}
                      </td>

                      <td className="px-8 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getSourceTableName(letter)}
                      </td>

                      <td className="px-8 py-4 whitespace-nowrap text-center text-sm font-medium">
                        {/* Resend Button - Show for letters that are not approved and not signed */}
                        {letter.letterStatus !== 'approved' && letter.letterStatus !== 'मंजूर' && !isLetterSigned(letter) ? (
                          <button
                            onClick={() => handleResendLetter(letter)}
                            disabled={resendingLetters.has(letter.id || letter._id)}
                            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                              resendingLetters.has(letter.id || letter._id)
                                ? 'bg-gray-400 text-white cursor-not-allowed'
                                : 'bg-orange-600 text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500'
                            }`}
                            title={language === 'mr' ? 'पत्र परत मूळ टेबलमध्ये पाठवा' : 'Resend letter back to original table'}
                          >
                            {resendingLetters.has(letter.id || letter._id) ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                {language === 'mr' ? 'पाठवत आहे...' : 'Resending...'}
                              </>
                            ) : (
                              <>
                                <FiRotateCcw className="mr-2 h-4 w-4" />
                                {language === 'mr' ? 'परत पाठवा' : 'Resend'}
                              </>
                            )}
                          </button>
                        ) : isLetterSigned(letter) ? (
                          <span className="text-green-600 text-xs font-medium">
                            {language === 'mr' ? 'स्वाक्षरी पूर्ण' : 'Signed'}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">
                            {language === 'mr' ? 'मंजूर' : 'Approved'}
                          </span>
                        )}
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

                          <button
                            onClick={async () => await previewFile(letter)}
                            className="text-indigo-600 hover:text-indigo-900 p-1 rounded-md hover:bg-indigo-100 transition-colors"
                            title={language === 'mr' ? 'फाइल पहा' : 'View File'}
                          >
                            <FiFileText className="h-5 w-5" />
                          </button>
                          
                          <button
                            onClick={() => handleCoveringLetterClick(letter)}
                            className="text-green-600 hover:text-green-900 p-1 rounded-md hover:bg-green-100 transition-colors"
                            title={language === 'mr' ? 'कव्हरिंग लेटर पहा' : 'View Covering Letter'}
                          >
                            <FiMail className="h-5 w-5" />
                          </button>

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
                ? 'HOD मंजुरीसाठी कोणतीही पत्रे आढळली नाहीत.' 
                : 'No letters found for HOD approval.'}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Dynamically render all fields with safe rendering, excluding technical fields */}
              {Object.entries(selectedLetter)
                .filter(([key]) => {
                  // Convert key to lowercase for case-insensitive comparison
                  const keyLower = key.toLowerCase();
                  
                  // Check if key is in excluded fields (case-insensitive)
                  const isExcluded = excludedFields.some(excludedField => 
                    excludedField.toLowerCase() === keyLower
                  );
                  
                  // Additional patterns to exclude
                  const containsFileId = keyLower.includes('file') && keyLower.includes('id');
                  const containsUserId = keyLower.includes('user') && keyLower.includes('id');
                  const containsUpload = keyLower.includes('upload');
                  const containsExtracted = keyLower.includes('extracted');
                  const containsTechnical = ['__v', '_id', 'id', 'createdat', 'updatedat'].includes(keyLower);
                  const containsCoveringLetter = keyLower.includes('covering') && keyLower.includes('letter');
                  
                  return !isExcluded && !containsFileId && !containsUserId && !containsUpload && !containsExtracted && !containsTechnical && !containsCoveringLetter;
                })
                .map(([key, value]) => {
                // Get the label for this field
                const label = fieldLabels[key] 
                  ? fieldLabels[key][language === 'mr' ? 'mr' : 'en']
                  : key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
                
                // Special formatting for status
                if (key === 'letterStatus') {
                  return (
                    <div key={key} className="col-span-1">
                      <div className="text-base font-bold text-blue-900 mb-1">
                        {label}
                      </div>
                      <div className="text-lg text-gray-800 font-medium">
                        {getStatusBadge(value)}
                      </div>
                    </div>
                  );
                }
                
                // Use the safe render function for all other fields
                const displayValue = renderFieldValue(key, value);
                
                return (
                  <div key={key} className="col-span-1">
                    <div className="text-base font-bold text-blue-900 mb-1">
                      {label}
                    </div>
                    <div className="text-lg text-gray-800 font-medium">
                      {displayValue}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* File Preview Section */}
            {(selectedLetter.upload && selectedLetter.upload.fileUrl) || selectedLetter.fileId ? (
              <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <h3 className="text-lg font-bold text-blue-800 mb-4">
                  {language === 'mr' ? 'अपलोड केलेली फाइल' : 'Uploaded File'}
                </h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiFileText className="text-blue-600 h-5 w-5" />
                 
                  </div>
                  <button
                    onClick={async () => await previewFile(selectedLetter)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <FiEye className="h-4 w-4" />
                    {language === 'mr' ? 'फाइल पहा' : 'View File'}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Download Report Section */}
            {selectedLetter.reportFiles && selectedLetter.reportFiles !== '[]' && selectedLetter.reportFiles !== 'null' ? (
              <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-xl">
                <h3 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2">
                  <FiFileText className="h-5 w-5" />
                  {language === 'mr' ? 'अपलोड केलेले रिपोर्ट' : 'Uploaded Reports'}
                </h3>
                <div className="space-y-3">
                  {(() => {
                    try {
                      const reportFiles = JSON.parse(selectedLetter.reportFiles);
                      return reportFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white border border-green-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                              <FiFileText className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {file.originalName || `Report_${index + 1}.pdf`}
                              </p>
                              <p className="text-xs text-gray-500">
                                {file.size ? `${Math.round(file.size / 1024)} KB` : 'N/A'} • 
                                {file.mimetype || 'PDF'}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => window.open(file.s3Url, '_blank')}
                            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5"
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
                <div className="mt-4 pt-3 border-t border-green-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-green-700">
                      <FiCheck className="h-4 w-4" />
                      {language === 'mr' ? 'रिपोर्ट अपलोड पूर्ण' : 'Report Upload Complete'}
                    </span>
                    {selectedLetter.letterStatus === 'case close' && (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-800 text-sm font-semibold rounded-full border border-red-200 shadow-sm">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          {language === 'mr' ? 'केस बंद' : 'CASE CLOSED'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

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

      {/* Covering Letter Modal */}
      {coveringLetterModalOpen && selectedLetterForCovering && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative border border-green-100">
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 bg-gray-100 rounded-full p-1 shadow"
              onClick={() => setCoveringLetterModalOpen(false)}
            >
              <FiX className="h-6 w-6" />
            </button>
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <FiMail className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {language === 'mr' ? 'कव्हरिंग लेटर क्रिया' : 'Covering Letter Actions'}
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                {language === 'mr' 
                  ? 'कव्हरिंग लेटरसाठी क्रिया निवडा' 
                  : 'Choose an action for the covering letter'}
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    viewCoveringLetter(selectedLetterForCovering);
                    setCoveringLetterModalOpen(false);
                  }}
                  className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <FiEye className="mr-2 h-4 w-4" />
                  {language === 'mr' ? 'कव्हरिंग लेटर पहा' : 'View Covering Letter'}
                </button>
                
                {(() => {
                  const letterId = selectedLetterForCovering?.id || selectedLetterForCovering?._id;
                  const isSigning = signingLetters.has(letterId);
                  const isSigned = isLetterSigned(selectedLetterForCovering) || signedLetters.has(letterId);
                  
                  if (isSigning) {
                    return (
                      <button
                        disabled
                        className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-purple-400 cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                      >
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        {language === 'mr' ? 'स्वाक्षरी जोडत आहे...' : 'Attaching Signature...'}
                      </button>
                    );
                  } else if (isSigned) {
                    return (
                      <button
                        disabled
                        className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                      >
                        <FiEdit className="mr-2 h-4 w-4" />
                        {language === 'mr' ? 'स्वाक्षरी जोडली गेली' : 'Signature Attached'}
                      </button>
                    );
                  } else {
                    return (
                      <button
                        onClick={() => {
                          handleAttachSignatureToCovering(selectedLetterForCovering.id || selectedLetterForCovering._id);
                          setCoveringLetterModalOpen(false);
                        }}
                        className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                      >
                        <FiEdit className="mr-2 h-4 w-4" />
                        {language === 'mr' ? 'स्वाक्षरी जोडा' : 'Attach Signature'}
                      </button>
                    );
                  }
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signatures Selection Modal */}
      {signaturesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8 relative max-h-[90vh] overflow-y-auto border border-purple-100">
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 bg-gray-100 rounded-full p-1 shadow"
              onClick={() => setSignaturesModalOpen(false)}
            >
              <FiX className="h-6 w-6" />
            </button>
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-purple-100 mb-4">
                <FiEdit className="h-6 w-6 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {language === 'mr' ? 'स्वाक्षरी निवडा' : 'Select Signature'}
              </h2>
              <p className="text-sm text-gray-600">
                {language === 'mr' 
                  ? 'कव्हरिंग लेटरसाठी स्वाक्षरी निवडा' 
                  : 'Choose a signature for the covering letter'}
              </p>
            </div>

            {loadingSignatures ? (
              <div className="flex justify-center items-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
              </div>
            ) : userSignatures.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userSignatures.map((signature) => (
                  <div
                    key={signature.id}
                    className={`border rounded-lg p-4 transition-all cursor-pointer hover:shadow-md ${
                      signature.isActive 
                        ? 'border-purple-500 bg-purple-50' 
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                    onClick={() => handleSignatureSelection(signature)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        signature.isActive 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {signature.isActive 
                          ? (language === 'mr' ? 'सक्रिय' : 'Active')
                          : (language === 'mr' ? 'निष्क्रिय' : 'Inactive')
                        }
                      </span>
                    </div>
                    
                    <div className="mb-3 flex justify-center">
                      <img
                        src={signature.previewUrl || signature.signUrl}
                        alt="Signature"
                        className="h-16 w-auto border border-gray-300 rounded bg-white p-2"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className="h-16 w-16 border border-gray-300 rounded bg-white p-2 flex items-center justify-center hidden">
                        <FiFileText className="h-8 w-8 text-gray-400" />
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-3">
                      <p className="font-medium truncate">{signature.fileName}</p>
                      <p>{formatDate(signature.uploadDate)}</p>
                    </div>
                    
                    <div className="flex justify-center">
                      {(() => {
                        const letterId = selectedLetterForCovering?.id || selectedLetterForCovering?._id;
                        const isSigning = signingLetters.has(letterId);
                        const isSigned = signedLetters.has(letterId);
                        
                        if (isSigning) {
                          return (
                            <button
                              disabled
                              className="px-4 py-2 bg-purple-400 text-white rounded-md cursor-not-allowed transition-colors text-sm flex items-center"
                            >
                              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                              {language === 'mr' ? 'स्वाक्षरी जोडत आहे...' : 'Attaching...'}
                            </button>
                          );
                        } else if (isSigned) {
                          return (
                            <button
                              disabled
                              className="px-4 py-2 bg-green-600 text-white rounded-md cursor-not-allowed transition-colors text-sm flex items-center"
                            >
                              <FiEdit className="mr-2 h-4 w-4" />
                              {language === 'mr' ? 'स्वाक्षरी जोडली गेली' : 'Signed'}
                            </button>
                          );
                        } else {
                          return (
                            <button
                              onClick={() => handleSignatureSelection(signature)}
                              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
                            >
                              {language === 'mr' ? 'निवडा' : 'Select'}
                            </button>
                          );
                        }
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FiEdit className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {language === 'mr' ? 'कोणत्याही स्वाक्षऱ्या आढळल्या नाहीत' : 'No signatures found'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {language === 'mr' 
                    ? 'कृपया प्रथम स्वाक्षरी अपलोड करा' 
                    : 'Please upload a signature first'}
                </p>
                <button
                  onClick={() => {
                    setSignaturesModalOpen(false);
                    navigate('/head-dashboard/upload-sign');
                  }}
                  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  <FiUpload className="mr-2 h-4 w-4" />
                  {language === 'mr' ? 'स्वाक्षरी अपलोड करा' : 'Upload Signature'}
                </button>
              </div>
            )}

            <div className="flex justify-center mt-6">
              <button
                className="px-6 py-2 bg-gray-600 text-white rounded-lg font-semibold shadow hover:bg-gray-700 transition-colors"
                onClick={() => setSignaturesModalOpen(false)}
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