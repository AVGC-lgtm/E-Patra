import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEye, FiRefreshCw, FiSearch, FiCheck, FiX, FiExternalLink, FiFileText, FiSend, FiDownload, FiTrash2, FiPlus, FiUpload } from 'react-icons/fi';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import translations from '../../translations';

const InwardStaffLetters = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = translations[language] || translations['en'];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('all');
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acknowledgedLetters, setAcknowledgedLetters] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedLetterForSend, setSelectedLetterForSend] = useState(null);
  const [sendToData, setSendToData] = useState({
    igp: false,
    sp: false,
    sdpo: false,
    policeStation: false,
    selectedDistrict: '',
    selectedPoliceStations: []
  });
  const [imageLoading, setImageLoading] = useState({});
  const [uploadingCoveringLetter, setUploadingCoveringLetter] = useState(false);
  const [generatingCoveringLetter, setGeneratingCoveringLetter] = useState(false);
  
  // Status filter options with translations
  const statusOptions = [
    { value: 'All', label: language === 'mr' ? 'सर्व स्थिती' : 'All Status' },
    { value: 'sending for head sign', label: language === 'mr' ? 'प्रमुख स्वाक्षरीसाठी पाठवत आहे' : 'Sending for Head Sign' },
    { value: 'sent to head', label: language === 'mr' ? 'प्रमुखांकडे पाठवले' : 'Sent to Head' },
    { value: 'pending', label: language === 'mr' ? 'प्रलंबित' : 'Pending' },
    { value: 'approved', label: language === 'mr' ? 'मंजूर' : 'Approved' },
    { value: 'rejected', label: language === 'mr' ? 'नाकारले' : 'Rejected' }
  ];

  // Date filter options
  const dateOptions = [
    { value: 'all', label: language === 'mr' ? 'सर्व पत्रे' : 'All Letters' },
    { value: 'today', label: language === 'mr' ? 'आजची पत्रे' : "Today's Letters" }
  ];

  // Helper function to get letter status
  const getLetterStatus = (letter) => {
    const status = letter.letterStatus || letter.letter_status || letter.status || 'received';
    return status;
  };

  // Helper function to get status badge styling
  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase() || 'na';
    
    const statusConfig = {
      'sending for head sign': {
        bg: 'bg-orange-100',
        text: 'text-orange-800',
        label: language === 'mr' ? 'प्रमुख स्वाक्षरीसाठी' : 'Sending for Head Sign'
      },
      received: {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        label: language === 'mr' ? 'प्राप्त' : 'Received'
      },
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
      },
      forwarded: {
        bg: 'bg-purple-100',
        text: 'text-purple-800',
        label: language === 'mr' ? 'पुढे पाठवले' : 'Forwarded'
      },
      acknowledged: {
        bg: 'bg-indigo-100',
        text: 'text-indigo-800',
        label: language === 'mr' ? 'पोचपावती' : 'Acknowledged'
      },
      'sent to head': {
        bg: 'bg-teal-100',
        text: 'text-teal-800',
        label: language === 'mr' ? 'प्रमुखांकडे पाठवले' : 'Sent to Head'
      },
      'na': {
        bg: 'bg-gray-100',
        text: 'text-gray-600',
        label: 'NA'
      }
    };

    const config = statusConfig[statusLower] || statusConfig.na;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  // Check if a date is today
  const isToday = (someDate) => {
    if (!someDate) return false;
    const today = new Date();
    const date = new Date(someDate);
    return date.toDateString() === today.toDateString();
  };

  // Function to get police stations for a district
  const getPoliceStationsForDistrict = (district) => {
    const stationsMap = {
      'ahmednagar': [
        { value: 'nagar_po_ahmednagar', label: 'जि. पो. अ. अहमदनगर' },
        { value: 'nevasa', label: 'पो.स्टे. नेवासा→पो.स्टे.नेवासा आवक शाखा' },
        { value: 'sonai', label: 'पो.स्टे. सोनाई→पो.स्टे. सोनाई आवक शाखा' },
        { value: 'rajur', label: 'पो.स्टे. राजूर→पो.स्टे.राजूर आवक शाखा' },
        { value: 'parner', label: 'पो.स्टे. पारनेर→पो.स्टे. पारनेर आवक शाखा' },
        { value: 'shevgaon', label: 'पो.स्टे. शेवगाव→पो.स्टे. शेवगाव आवक शाखा' },
        { value: 'kotwali', label: 'पो.स्टे. कोतवली→पो.स्टे. कोतवली आवक शाखा' },
        { value: 'tofkhana', label: 'पो.स्टे. तोफखाना→पो.स्टे. तोफखाना आवक शाखा' },
        { value: 'shrigonda', label: 'पो.स्टे. श्रीगोंंदा→पो.स्टे. श्रीगोंंदा आवक शाखा' },
        { value: 'ghargaon', label: 'पो.स्टे. घारगाव→पो.स्टे. घारगाव आवक शाखा' },
        { value: 'belwandi', label: 'पो.स्टे. बेलवंडी→पो.स्टे. बेलवंडी आवक शाखा' },
        { value: 'midc', label: 'पो.स्टे. एमआयडीसी→पो.स्टे. एमआयडीसी आवक शाखा' },
        { value: 'nagar_taluka', label: 'पो.स्टे. नगर तालुका→पो.स्टे. नगर तालुका आवक शाखा' },
        { value: 'jamkhed', label: 'पो.स्टे. जामखेड→पो.स्टे. जामखेड आवक शाखा' },
        { value: 'supa', label: 'पो.स्टे. सुपा→पो.स्टे. सुपा आवक शाखा' },
        { value: 'karjat', label: 'पो.स्टे.कर्जत→पो.स्टे.कर्जत आवक शाखा' },
        { value: 'bhingar_camp', label: 'पो.स्टे. भिंगार कॅम्प→पो.स्टे. भिंगार कॅम्प आवक शाखा' },
        { value: 'akole', label: 'पो.स्टे.अकोले→पो.स्टे.अकोले आवक शाखा' },
        { value: 'pathardi', label: 'पो.स्टे. पाथर्डी→पो.स्टे. पाथर्डी आवक शाखा' },
        { value: 'ashwi', label: 'पो.स्टे. अश्वि→पो.स्टे. अश्वि आवक शाखा' },
        { value: 'shirdi', label: 'पो.स्टे. शिर्डी→पो.स्टे. शिर्डी आवक शाखा' },
        { value: 'sangamner_taluka', label: 'पो.स्टे. संगमनेर तालुका→पो.स्टे. संगमनेर तालुका आवक शाखा' },
        { value: 'shani_shingnapur', label: 'पो.स्टे.शनि शिंगणापूर→पो.स्टे.शनि शिंगणापूर आवक शाखा' },
        { value: 'sangamner_city', label: 'पो.स्टे. संगमनेर सिटी→पो.स्टे. संगमनेर सिटी आवक शाखा' },
        { value: 'shrirampur_city', label: 'पो.स्टे. श्रीरामपूर सिटी→पो.स्टे. श्रीरामपूर सिटी आवक शाखा' },
        { value: 'shrirampur_taluka', label: 'पो.स्टे. श्रीरामपूर तालुका→पो.स्टे. श्रीरामपूर तालुका आवक शाखा' },
        { value: 'rahuri', label: 'पो.स्टे. राहुरी→पो.स्टे. राहुरी आवक शाखा' },
        { value: 'kopargaon_taluka', label: 'पो.स्टे.कोपरगाव तालुका→पो.स्टे कोपरगाव तालुका आवक शाखा' },
        { value: 'kopargaon_city', label: 'पो.स्टे. कोपरगाव सिटी→पो.स्टे. कोपरगाव सिटी आवक शाखा' },
        { value: 'loni', label: 'पो.स्टे.लोनी→पो.स्टे. लोनी आवक शाखा' },
        { value: 'rahata', label: 'पो.स्टे. राहाता→पो.स्टे. राहाता आवक शाखा' },
        { value: 'sai_mandir_security', label: 'साई मंदिर सुरक्षा शिर्डी(पोलीस)→साई मंदिर सुरक्षा शिर्डी(पोलीस) आवक शाखा' },
        { value: 'shirdi_vibhag_bdds', label: 'शिर्डी विभाग बी.डी.डी.एस.→शिर्डी विभाग बी.डी.डी.एस. आवक प्रमुख' },
        { value: 'city_traffic_shirdi', label: 'शहर वाहतुक शाखा-शिर्डी→शहर वाहतुक शाखा-शिर्डी आवक प्रमुख' },
        { value: 'kharda', label: 'खर्डा पोलीस स्टेशन→पो.स्टे.खर्डा आवक शाखा' },
        { value: 'mirajgaon', label: 'मिरजगाव पोलीस स्टेशन→पो.स्टे.मिरजगाव आवक शाखा' }
      ],
      'dhule': [
        { value: 'dhule_po_dhule', label: 'जि. पो. अ. धुळे' },
        { value: 'dhule_city', label: 'पो.स्टे.धुळे शहर→ पो.स्टे.धुळे शहर आवक शाखा' },
        { value: 'devpur', label: 'पो.स्टे. देवपूर →पो.स्टे.देवपूर आवक शाखा' },
        { value: 'west_devpur', label: 'पो.स्टे. पश्चिम देवपूर→पो.स्टे. पश्चिम देवपूर-आवक शाखा' },
        { value: 'mohadi', label: 'पो.स्टे. मोहाडी →पो.स्टे. मोहाडी-आवक प्रमुख' },
        { value: 'azadnagar', label: 'पो.स्टे. आझादनगर→पो.स्टे. आझादनगर-आवक प्रमुख' },
        { value: 'chalisgaon_road', label: 'पो.स्टे चाळीसगाव रोड→पो.स्टे चाळीसगाव रोड-आवक प्रमुख' },
        { value: 'dhule_taluka', label: 'पो.स्टे. धुळे तालुका →पो.स्टे. धुळे तालुका-आवक प्रमुख' },
        { value: 'sakri', label: 'पो.स्टे साक्री→पो.स्टे साक्री-आवक प्रमुख' },
        { value: 'pimpalner', label: 'पो.स्टे पिंपळनेर→पो.स्टे पिंपळनेर-आवक प्रमुख' },
        { value: 'nizampur', label: 'पो.स्टे निजामपूर →पो.स्टे निजामपूर-आवक प्रमुख' },
        { value: 'songir', label: 'पो.स्टे सोनगीर →पो.स्टे सोनगीर-आवक प्रमुख' },
        { value: 'shirpur', label: 'पो.स्टे शिरपूर→पो.स्टे शिरपूर-जावक प्रमुख' },
        { value: 'shirpur_gramin', label: 'पो.स्टे.शिरपूर ग्रामीण→पो.स्टे.शिरपूर ग्रामीण-आवक प्रमुख' },
        { value: 'thalner', label: 'पो.स्टे.थाळनेर→पो.स्टे.थाळनेर-आवक प्रमुख' },
        { value: 'nardana', label: 'पो.स्टे.नरडाणा→पो.स्टे.नरडाणा-आवक प्रमुख' },
        { value: 'dondaicha', label: 'पो.स्टे. दोंडाईचा→पो.स्टे. दोंडाईचा-आवक प्रमुख' },
        { value: 'sindkheda', label: 'पो.स्टे. शिंदखेडा→पो.स्टे. शिंदखेडा-आवक प्रमुख' }
      ]
    };
    
    return stationsMap[district] || [];
  };

  // Get file type icon
  const getFileTypeIcon = (filename) => {
    const ext = getFileExtension(filename);
    const iconClass = "h-12 w-12 text-gray-400";
    
    if (['pdf'].includes(ext)) {
      return <FiFileText className={iconClass} />;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
      return <FiFileText className={iconClass} />;
    } else if (['doc', 'docx'].includes(ext)) {
      return <FiFileText className={iconClass} />;
    } else if (['xls', 'xlsx'].includes(ext)) {
      return <FiFileText className={iconClass} />;
    } else {
      return <FiFileText className={iconClass} />;
    }
  };

  // Handle file download with better error handling
  const handleFileDownload = async (letter, fileIndex = 0) => {
    try {
      let fileUrl = null;
      let fileName = 'document';
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
          url: `http://localhost:5000/${letter.uploadedFile.fileName.replace(/\\/g, '/')}`,
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
          url: `http://localhost:5000/${letter.upload.fileName.replace(/\\/g, '/')}`,
          name: letter.upload.originalName || letter.upload.fileName.split('/').pop()
        });
      }
      
      // Check for letterFiles array
      if (letter.letterFiles && letter.letterFiles.length > 0) {
        letter.letterFiles.forEach(file => {
          allFiles.push({
            url: `http://localhost:5000/${file.filePath.replace(/\\/g, '/')}`,
            name: file.originalName || file.filePath.split('/').pop()
          });
        });
      }

      if (allFiles.length === 0) {
        console.error('No files found in letter:', letter);
        alert(language === 'mr' ? 'फाईल सापडली नाही!' : 'File not found!');
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
      alert(language === 'mr' ? 'फाईल डाउनलोड करताना त्रुटी!' : 'Error downloading file!');
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
    
    const result = !!(hasUpload || hasLetterFiles || hasUploadedFile);
    
    // Debug log
    if (!result && letter.referenceNumber) {
      console.log(`Letter ${letter.referenceNumber} has no attachments:`, {
        upload: letter.upload,
        letterFiles: letter.letterFiles,
        uploadedFile: letter.uploadedFile
      });
    }
    
    return result;
  };

  // Get file extension
  const getFileExtension = (filename) => {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts[parts.length - 1].toLowerCase();
  };

  // Check if file is viewable in browser
  const isViewableFile = (filename) => {
    const viewableExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    const extension = getFileExtension(filename);
    return viewableExtensions.includes(extension);
  };

  // Handle send modal open
  const handleSendClick = (letter) => {
    console.log('Selected letter for send:', letter);
    console.log('Letter ID:', letter._id || letter.id);
    console.log('Letter object keys:', Object.keys(letter));
    
    setSelectedLetterForSend(letter);
    setSendToData({
      igp: false,
      sp: false,
      sdpo: false,
      policeStation: false,
      selectedDistrict: '',
      selectedPoliceStations: []
    });
    setSendModalOpen(true);
  };

  // Function to send letter to HOD for approval
  const sendToHODForApproval = async (letterId) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert(language === 'mr' ? 
          'कृपया पुन्हा लॉगिन करा!' : 
          'Please login again!');
        navigate('/login');
        return;
      }

      // Prepare recipients data for HOD approval
      const recipients = [];
      if (sendToData.igp) recipients.push('igp');
      if (sendToData.sp) recipients.push('sp');
      if (sendToData.sdpo) recipients.push('sdpo');
      if (sendToData.policeStation && sendToData.selectedPoliceStations.length > 0) {
        recipients.push('policeStation');
      }

      console.log('Sending to HOD:', {
        letterId: letterId,
        recipients: recipients,
        sendToData: sendToData,
        includeCoveringLetter: selectedLetterForSend.coveringLetter ? true : false
      });

      // Update letter status to "sent to head" and store recipient information
      const response = await axios.put(
        `http://localhost:5000/api/patras/${letterId}/send-to-hod`,
        {
          recipients: recipients,
          sendToData: sendToData,
          includeCoveringLetter: selectedLetterForSend.coveringLetter ? true : false
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
          `पत्र HOD मंजुरीसाठी पाठवले गेले!\n\nप्राप्तकर्ते:\n${recipients.join(', ')}` : 
          `Letter sent to HOD for approval!\n\nRecipients:\n${recipients.join(', ')}`;
        
        alert(successMessage);
        
        // Close modal
        setSendModalOpen(false);
        setSelectedLetterForSend(null);
        
        // Refresh letters
        handleRefresh();
      }
    } catch (error) {
      console.error('Error sending to HOD:', error);
      
      if (error.response) {
        console.error('Error response:', error.response.data);
        const errorMessage = error.response.data?.error || 
                            error.response.data?.message || 
                            'Failed to send to HOD';
        
        alert(language === 'mr' ? 
          `HOD ला पाठवण्यात त्रुटी: ${errorMessage}` : 
          `Error sending to HOD: ${errorMessage}`);
      } else {
        alert(language === 'mr' ? 
          'नेटवर्क त्रुटी! कृपया पुन्हा प्रयत्न करा.' : 
          'Network error! Please try again.');
      }
    }
  };

  // Function to send email directly (for SDPO only)
  const sendEmailDirectly = async (letterId) => {
    try {
      // Get authentication token
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert(language === 'mr' ? 
          'कृपया पुन्हा लॉगिन करा!' : 
          'Please login again!');
        navigate('/login');
        return;
      }
      
      // Get user info from localStorage or token
      const userInfo = localStorage.getItem('userInfo') || localStorage.getItem('user');
      let userData = null;
      
      if (userInfo) {
        try {
          userData = JSON.parse(userInfo);
          console.log('User data from localStorage:', userData);
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
            console.log('Decoded token payload:', payload);
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

      // Prepare recipients array for email (only SDPO)
      const recipients = ['sdpo'];

      // Prepare email data
      const emailData = {
        letterId: letterId,
        senderEmail: userData?.email || 'staff@police.gov.in',
        recipients: recipients,
        customMessage: '',
        includeCoveringLetter: selectedLetterForSend.coveringLetter ? true : false
      };

      console.log('Sending email directly to SDPO:', emailData);
      
      // Make the email API call
      const response = await axios.post(
        `http://localhost:5000/api/dynamic-email/send-inward-letter`, 
        emailData, 
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.status === 200 || response.status === 201) {
        const result = response.data;
        
        const successMessage = language === 'mr' ? 
          `पत्र यशस्वीरित्या SDPO ला पाठवले गेले!\n\nईमेल तपशील:\n- पाठवले: ${result.data.successful}\n- अयशस्वी: ${result.data.failed}\n- संलग्नक: ${result.data.attachments}` : 
          `Letter sent successfully to SDPO!\n\nEmail Details:\n- Sent: ${result.data.successful}\n- Failed: ${result.data.failed}\n- Attachments: ${result.data.attachments}`;
        
        alert(successMessage);
        
        // Close modal
        setSendModalOpen(false);
        setSelectedLetterForSend(null);
        
        // Refresh letters
        handleRefresh();
      }
    } catch (error) {
      console.error('Error sending email directly:', error);
      
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          'Failed to send email';
      
      alert(language === 'mr' ? 
        `ईमेल पाठवण्यात त्रुटी: ${errorMessage}` : 
        `Error sending email: ${errorMessage}`);
    }
  };

  // Handle send form submission
  const handleSendSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Get the correct letter ID
      const letterId = selectedLetterForSend._id || 
                      selectedLetterForSend.id || 
                      selectedLetterForSend.letterID;
      
      console.log('Letter object:', selectedLetterForSend);
      console.log('Using letter ID:', letterId);
      
      // Validate letter ID
      if (!letterId) {
        throw new Error('Letter ID not found. Please refresh and try again.');
      }
      
      // Check if at least one recipient is selected
      const hasRecipient = sendToData.igp || sendToData.sp || sendToData.sdpo || 
                          (sendToData.policeStation && sendToData.selectedPoliceStations.length > 0);
      
      if (!hasRecipient) {
        alert(language === 'mr' ? 
          'कृपया किमान एक प्राप्तकर्ता निवडा!' : 
          'Please select at least one recipient!');
        return;
      }

      // Check if any high-level recipients are selected (IGP, SP, Police Stations)
      const hasHighLevelRecipients = sendToData.igp || sendToData.sp || 
                                   (sendToData.policeStation && sendToData.selectedPoliceStations.length > 0);
      
      // If high-level recipients are selected, send to HOD for approval
      if (hasHighLevelRecipients) {
        await sendToHODForApproval(letterId);
        return;
      }
      
      // For SDPO only, send email directly (no HOD approval needed)
      if (sendToData.sdpo) {
        await sendEmailDirectly(letterId);
        return;
      }
      
      // If we reach here, no valid recipients were selected
      alert(language === 'mr' ? 
        'कृपया वैध प्राप्तकर्ता निवडा!' : 
        'Please select valid recipients!');
    } catch (error) {
      console.error('Error in handleSendSubmit:', error);
      alert(language === 'mr' ? 
        'त्रुटी आली! कृपया पुन्हा प्रयत्न करा.' : 
        'An error occurred! Please try again.');
    }
  };

  // Helper function to view file in new tab
  const viewFileInNewTab = (letter) => {
    let fileUrl = null;
    
    // Check for uploadedFile structure (new API structure)
    if (letter.uploadedFile && letter.uploadedFile.fileUrl) {
      fileUrl = letter.uploadedFile.fileUrl;
    } else if (letter.uploadedFile && letter.uploadedFile.fileName) {
      fileUrl = `http://localhost:5000/${letter.uploadedFile.fileName.replace(/\\/g, '/')}`;
    } else if (letter.upload && letter.upload.fileUrl) {
      fileUrl = letter.upload.fileUrl;
    } else if (letter.upload && letter.upload.fileName) {
      fileUrl = `http://localhost:5000/${letter.upload.fileName.replace(/\\/g, '/')}`;
    } else if (letter.letterFiles && letter.letterFiles.length > 0) {
      const file = letter.letterFiles[0];
      fileUrl = `http://localhost:5000/${file.filePath.replace(/\\/g, '/')}`;
    }
    
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    } else {
      alert(language === 'mr' ? 'फाईल सापडली नाही!' : 'File not found!');
    }
  };

  // Covering Letter Handler Functions
  
  // Handler to delete covering letter
  const handleDeleteCoveringLetter = async (coveringLetterId) => {
    try {
      if (!coveringLetterId) {
        alert(language === 'mr' 
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
      
      const token = localStorage.getItem('token');
      
      const response = await axios.delete(
        `http://localhost:5000/api/letters/${coveringLetterId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 200 && response.data.success) {
        alert(language === 'mr' 
          ? 'कव्हरिंग लेटर यशस्वीरित्या हटवले गेले!' 
          : 'Covering letter deleted successfully!');
        
        // Update the selected letter to remove covering letter reference
        setSelectedLetter(prev => ({
          ...prev,
          coveringLetter: null
        }));
        
        // Update the letter in the main list
        const letterId = selectedLetter._id || selectedLetter.id;
        setLetters(prevLetters => 
          prevLetters.map(l => 
            (l._id || l.id) === letterId 
              ? { ...l, coveringLetter: null }
              : l
          )
        );
      }
    } catch (error) {
      console.error('Error deleting covering letter:', error);
      
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || 'Server error';
        alert(language === 'mr' 
          ? `कव्हरिंग लेटर हटवताना त्रुटी: ${errorMessage}` 
          : `Error deleting covering letter: ${errorMessage}`);
      } else {
        alert(language === 'mr' 
          ? 'कव्हरिंग लेटर हटवताना त्रुटी!' 
          : 'Error deleting covering letter!');
      }
    }
  };

  // Handler to generate new covering letter
  const handleGenerateCoveringLetter = async (letter) => {
    try {
      setGeneratingCoveringLetter(true);
      const token = localStorage.getItem('token');
      
      const generateData = {
        patraId: letter._id || letter.id,
        letterType: 'ACKNOWLEDGMENT', // Default type
        fileId: letter.fileId || null
      };
      
      const response = await axios.post(
        'http://localhost:5000/api/letters/generate',
        generateData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 201) {
        alert(language === 'mr' 
          ? 'कव्हरिंग लेटर यशस्वीरित्या तयार केले गेले!' 
          : 'Covering letter generated successfully!');
        
        // Update the selected letter with new covering letter
        setSelectedLetter(prev => ({
          ...prev,
          coveringLetter: response.data.coveringLetter
        }));
        
        // Update the letter in the main list
        setLetters(prevLetters => 
          prevLetters.map(l => 
            (l._id || l.id) === (letter._id || letter.id) 
              ? { ...l, coveringLetter: response.data.coveringLetter }
              : l
          )
        );
      }
    } catch (error) {
      console.error('Error generating covering letter:', error);
      const errorMessage = error.response?.data?.details || error.response?.data?.error || error.message;
      alert(language === 'mr' 
        ? `कव्हरिंग लेटर तयार करताना त्रुटी: ${errorMessage}` 
        : `Error generating covering letter: ${errorMessage}`);
    } finally {
      setGeneratingCoveringLetter(false);
    }
  };

  // Handler to upload covering letter file
  const handleUploadCoveringLetter = async (letter, file) => {
    try {
      if (!file) {
        alert(language === 'mr' ? 'कृपया फाईल निवडा!' : 'Please select a file!');
        return;
      }
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        alert(language === 'mr' 
          ? 'कृपया फक्त PDF किंवा Word फाईल निवडा!' 
          : 'Please select only PDF or Word files!');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(language === 'mr' 
          ? 'फाईल साइझ 10MB पेक्षा कमी असावा!' 
          : 'File size should be less than 10MB!');
        return;
      }
      
      // Show loading state
      setUploadingCoveringLetter(true);
      
      const token = localStorage.getItem('token');
      const formData = new FormData();
      
      formData.append('coveringLetterFile', file);
      formData.append('patraId', letter._id || letter.id);
      formData.append('letterNumber', letter.referenceNumber || `CL/${Date.now()}`);
      formData.append('letterDate', new Date().toISOString().split('T')[0]);
      formData.append('recipientOffice', letter.officeSendingLetter || 'कार्यालय');
      formData.append('recipientDesignation', letter.senderNameAndDesignation || 'अधिकारी');
      formData.append('status', 'DRAFT');
      
      const response = await axios.post(
        'http://localhost:5000/api/letters/upload',
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
        alert(language === 'mr' 
          ? 'कव्हरिंग लेटर यशस्वीरित्या S3 वर अपलोड केले गेले!' 
          : 'Covering letter uploaded successfully to S3!');
        
        // Use the updated patra data from the response
        const updatedPatra = response.data.updatedPatra;
        const updatedCoveringLetter = response.data.coveringLetter;
        
        // Update the selected letter with complete updated data
        setSelectedLetter(prev => ({
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
      }
    } catch (error) {
      console.error('Error uploading covering letter:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
      
      // Show more specific error message if it's about existing covering letter
      if (errorMessage.includes('already exists')) {
        alert(language === 'mr' 
          ? 'कव्हरिंग लेटर आधीच उपलब्ध आहे. कृपया आधी ते हटवा.' 
          : 'Covering letter already exists. Please delete it first.');
      } else {
        alert(language === 'mr' 
          ? `कव्हरिंग लेटर अपलोड करताना त्रुटी: ${errorMessage}` 
          : `Error uploading covering letter: ${errorMessage}`);
      }
    } finally {
      setUploadingCoveringLetter(false);
    }
  };

  // Fetch letters from API
  const handleRefresh = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.get('http://localhost:5000/api/patras', {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        timeout: 10000
      });
      
      console.log('Full API Response:', response.data);
      
      // Handle different response structures
      let lettersData = [];
      
      if (
        response.data &&
        response.data.data &&
        Array.isArray(response.data.data.patras)
      ) {
        // New API structure: { success, message, data: { patras: [...] } }
        lettersData = response.data.data.patras;
        console.log('Using patras array from response.data.data:', lettersData);
      } else if (response.data && Array.isArray(response.data.patras)) {
        // { patras: [...] }
        lettersData = response.data.patras;
        console.log('Using patras array from response.data:', lettersData);
      } else if (response.data && Array.isArray(response.data)) {
        // Direct array response: [...]
        lettersData = response.data;
        console.log('Using direct array response:', lettersData);
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        // { data: [...] }
        lettersData = response.data.data;
        console.log('Using data array from response.data:', lettersData);
      } else {
        console.error('Unexpected response structure:', response.data);
        throw new Error('Invalid data format received from server');
      }
      
      console.log('Letters received:', lettersData.length);
      console.log('Letter IDs:', lettersData.map(l => ({ 
        ref: l.referenceNumber, 
        id: l._id || l.id,
        status: l.letterStatus,
        hasFile: !!(l.uploadedFile || l.upload || l.letterFiles)
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
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
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
    
  const toggleAcknowledge = (letterId) => {
    setAcknowledgedLetters(prev => {
      const newAcknowledged = new Set(prev);
      if (newAcknowledged.has(letterId)) {
        newAcknowledged.delete(letterId);
      } else {
        newAcknowledged.add(letterId);
      }
      // Save to localStorage with role-specific key
      localStorage.setItem('acknowledgedLetters_inward_staff', JSON.stringify(Array.from(newAcknowledged)));
      return newAcknowledged;
    });
  };

  // Fetch data on component mount
  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      alert(language === 'mr' ? 
        'कृपया प्रथम लॉगिन करा!' : 
        'Please login first!');
      navigate('/login');
      return;
    }
    
    handleRefresh();
  }, [navigate, language]);

  // Filter letters based on search term, status, and date
  const filteredLetters = letters.filter(letter => {
    const letterStatus = letter.letterStatus || letter.letter_status || letter.status || '';
    
    // Debug log all letters
    console.log('InwardStaff Filter - Letter:', letter.referenceNumber, 'Status:', letterStatus);

    const searchableFields = [
      letter.referenceNumber,
      letter.letterType,
      letter.receivedByOffice,
      letter.recipientNameAndDesignation,
      letter.office,
      letter.subjectAndDetails,
      letter.sender,
      letter.officeSendingLetter,
      letter.senderNameAndDesignation,
      letter.subject
    ].join(' ').toLowerCase();

    const matchesSearch = searchTerm === '' || 
      searchableFields.includes(searchTerm.toLowerCase());

    const displayStatus = getLetterStatus(letter);
    const matchesStatus = statusFilter === 'All' || 
      displayStatus.toLowerCase() === statusFilter.toLowerCase();

    const matchesDate = dateFilter === 'all' || 
      (dateFilter === 'today' && isToday(letter.createdAt || letter.dateOfReceiptOfLetter));

    const shouldInclude = matchesSearch && matchesStatus && matchesDate;
    
    if (shouldInclude) {
      console.log('InwardStaff Filter - Including letter:', letter.referenceNumber, 'Status:', letterStatus);
    }

    return shouldInclude;
  });

  const totalPages = Math.ceil(filteredLetters.length / recordsPerPage);
  const paginatedLetters = filteredLetters.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

  const hasCoveringLetter = (letter) => {
    // Debug: Log the letter data structure
    console.log('Checking covering letter for:', letter.referenceNumber);
    const coveringLetter = letter.coveringLetter || letter.directCoveringLetter;
    console.log('Letter covering letter data:', coveringLetter);
    if (!coveringLetter) {
      console.log('No covering letter object found');
      return false;
    }
    // Check for either id or _id (to handle both Sequelize and MongoDB)
    const hasId = coveringLetter.id || coveringLetter._id;
    // Check for URL availability
    const hasUrl = coveringLetter.pdfUrl || coveringLetter.htmlUrl;
    console.log('Covering letter ID:', hasId);
    console.log('Covering letter URLs:', { pdfUrl: coveringLetter.pdfUrl, htmlUrl: coveringLetter.htmlUrl });
    return !!(hasId && hasUrl);
  };
  
  // Helper function to view covering letter
  const viewCoveringLetter = (letter) => {
    const coveringLetter = letter.coveringLetter || letter.directCoveringLetter;
    if (!coveringLetter) {
      alert(language === 'mr' ? 'कव्हरिंग लेटर उपलब्ध नाही!' : 'Covering letter not available!');
      return;
    }
    // Prefer PDF over HTML
    const url = coveringLetter.pdfUrl || coveringLetter.htmlUrl;
    if (!url) {
      alert(language === 'mr' ? 'कव्हरिंग लेटर URL उपलब्ध नाही!' : 'Covering letter URL not available!');
      return;
    }
    window.open(url, '_blank');
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {language === 'mr' ? 'नवीन आवक पत्रे' : 'New Inward Letters'}
          </h1>
          <p className="text-gray-500">
            {language === 'mr' 
              ? 'नवीन पत्रे पहा आणि HOD ला पाठवा' 
              : 'View new letters and send to HOD'}
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <div className="relative">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              {dateOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
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
                      {language === 'mr' ? 'पत्र पाठविणारे कार्यालय' : 'Sender Office'}
                    </th>
                    <th scope="col" className="px-8 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                      {language === 'mr' ? 'स्थिती' : 'Status'}
                    </th>
                    <th scope="col" className="px-8 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap min-w-[180px]">
                      {language === 'mr' ? 'पाठवा' : 'Send To'}
                    </th>
                    <th scope="col" className="px-8 py-4 text-right text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                      {language === 'mr' ? 'क्रिया' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedLetters.map((letter, idx) => (
                    <tr 
                      key={letter._id || letter.id || idx} 
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
                          {letter.officeSendingLetter || 'N/A'}
                        </div>
                      </td>
                      <td className="px-8 py-4 whitespace-nowrap text-sm">
                        {getStatusBadge(getLetterStatus(letter))}
                      </td>
                      <td className="px-8 py-4 text-sm text-gray-900">
                        {letter.letterStatus?.toLowerCase() === 'sending for head sign' ? (
                          <button
                            onClick={() => handleSendClick(letter)}
                            className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                            title={language === 'mr' ? 'पत्र पाठवा' : 'Send Letter'}
                          >
                            <FiSend className="mr-1 h-3 w-3" />
                            {language === 'mr' ? 'पाठवा' : 'Send'}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">
                            {language === 'mr' ? 'पाठवले' : 'Sent'}
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end items-center space-x-2">
                          {/* Details button */}
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
                          
                          {/* View Covering Letter button */}
                          <button
                            onClick={() => hasCoveringLetter(letter) ? viewCoveringLetter(letter) : null}
                            className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded transition-colors shadow-sm ${
                              hasCoveringLetter(letter) 
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                            title={
                              hasCoveringLetter(letter) 
                                ? (language === 'mr' ? 'कव्हरिंग लेटर पहा' : 'View Covering Letter') 
                                : (language === 'mr' ? 'कव्हरिंग लेटर उपलब्ध नाही' : 'No covering letter available')
                            }
                            disabled={!hasCoveringLetter(letter)}
                          >
                            <FiFileText className="h-4 w-4" />
                            <span className="ml-1">{language === 'mr' ? 'कव्हर लेटर' : 'Cover Letter'}</span>
                          </button>
                          
                          {/* Download button */}
                          <button
                            onClick={() => hasAttachments(letter) ? handleFileDownload(letter) : null}
                            className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded transition-colors shadow-sm relative ${
                              hasAttachments(letter) 
                                ? 'bg-green-600 text-white hover:bg-green-700' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                            title={
                              hasAttachments(letter) 
                                ? (language === 'mr' ? 'फाईल डाउनलोड करा' : 'Download File') 
                                : (language === 'mr' ? 'कोणतीही फाईल संलग्न नाही' : 'No file attached')
                            }
                            disabled={!hasAttachments(letter)}
                          >
                            <FiDownload className="h-4 w-4" />
                            <span className="ml-1">{language === 'mr' ? 'डाउनलोड' : 'Download'}</span>
                            
                            {/* Show badge if multiple files */}
                            {letter.letterFiles && letter.letterFiles.length > 1 && (
                              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
                                {letter.letterFiles.length}
                              </span>
                            )}
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
                ? 'कोणतीही पत्रे आढळली नाहीत. कृपया आपली शोध बदला किंवा नवीन पत्र जोडा.' 
                : 'No letters found. Please try changing your search or add a new letter.'}
            </p>
          </div>
        )}
      </div>

      {/* Send Letter Modal */}
      {sendModalOpen && selectedLetterForSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 bg-gray-100 rounded-full p-1 shadow"
              onClick={() => setSendModalOpen(false)}
            >
              <FiX className="h-6 w-6" />
            </button>
            
            <h2 className="text-2xl font-bold mb-6 text-blue-700 text-center">
              {language === 'mr' ? 'पत्र पाठवा' : 'Send Letter'}
            </h2>
            
            {/* Letter Details */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {language === 'mr' ? 'पत्र विवरण' : 'Letter Details'}
              </h3>
              <p className="text-sm text-gray-600">
                <span className="font-medium">{language === 'mr' ? 'संदर्भ क्रमांक:' : 'Reference No:'}</span> {selectedLetterForSend.referenceNumber}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">{language === 'mr' ? 'कार्यालय:' : 'Office:'}</span> {selectedLetterForSend.officeSendingLetter}
              </p>
            </div>
            
            <form onSubmit={handleSendSubmit} className="space-y-6">
              {/* Authority Selection Section */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h3 className="text-lg font-bold text-green-800 mb-4">
                  {language === 'mr' ? 'पत्र पाठविण्यासाठी अधिकारी निवडा' : 'Select Authorities to Send Letter'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* IGP Checkbox */}
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="send_igp"
                      name="igp"
                      checked={sendToData.igp || false}
                      onChange={(e) => setSendToData(prev => ({...prev, igp: e.target.checked}))}
                      className="w-5 h-5 text-green-600 bg-white border-green-300 rounded focus:ring-green-500 focus:ring-2"
                    />
                    <label htmlFor="send_igp" className="text-base font-semibold text-green-800">
                      {language === 'mr' ? 'आयजीपी (IGP)' : 'IGP (Inspector General of Police)'}
                    </label>
                  </div>

                  {/* SP Checkbox */}
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="send_sp"
                      name="sp"
                      checked={sendToData.sp || false}
                      onChange={(e) => setSendToData(prev => ({...prev, sp: e.target.checked}))}
                      className="w-5 h-5 text-green-600 bg-white border-green-300 rounded focus:ring-green-500 focus:ring-2"
                    />
                    <label htmlFor="send_sp" className="text-base font-semibold text-green-800">
                      {language === 'mr' ? 'एसपी (SP)' : 'SP (Superintendent of Police)'}
                    </label>
                  </div>

                  {/* SDPO Checkbox */}
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="send_sdpo"
                      name="sdpo"
                      checked={sendToData.sdpo || false}
                      onChange={(e) => setSendToData(prev => ({...prev, sdpo: e.target.checked}))}
                      className="w-5 h-5 text-green-600 bg-white border-green-300 rounded focus:ring-green-500 focus:ring-2"
                    />
                    <label htmlFor="send_sdpo" className="text-base font-semibold text-green-800">
                      {language === 'mr' ? 'एसडीपीओ (SDPO)' : 'SDPO (Sub Divisional Police Officer)'}
                    </label>
                  </div>

                  {/* Police Station Checkbox */}
                  <div className="col-span-1 md:col-span-2">
                    <div className="flex items-center space-x-3 mb-3">
                      <input
                        type="checkbox"
                        id="send_police_station"
                        name="policeStation"
                        checked={sendToData.policeStation || false}
                        onChange={(e) => setSendToData(prev => ({
                          ...prev, 
                          policeStation: e.target.checked,
                          selectedDistrict: e.target.checked ? prev.selectedDistrict : '',
                          selectedPoliceStations: e.target.checked ? (prev.selectedPoliceStations || []) : []
                        }))}
                        className="w-5 h-5 text-green-600 bg-white border-green-300 rounded focus:ring-green-500 focus:ring-2"
                      />
                      <label htmlFor="send_police_station" className="text-base font-semibold text-green-800">
                        {language === 'mr' ? 'पोलीस स्टेशन' : 'Police Station'}
                      </label>
                    </div>
                    
                    {/* District Selection - shown only when Police Station is checked */}
                    {sendToData.policeStation && (
                      <div className="ml-8 mt-2 space-y-3">
                        <div>
                          <label className="block text-sm font-semibold text-green-700 mb-2">
                            {language === 'mr' ? 'जिल्हा निवडा' : 'Select District'}
                          </label>
                          <select
                            value={sendToData.selectedDistrict || ''}
                            onChange={(e) => setSendToData(prev => ({
                              ...prev, 
                              selectedDistrict: e.target.value,
                              selectedPoliceStations: []
                            }))}
                            className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                            required={sendToData.policeStation}
                          >
                            <option value="">{language === 'mr' ? 'जिल्हा निवडा' : 'Select District'}</option>
                            <option value="ahmednagar">{language === 'mr' ? 'अहमदनगर' : 'Ahmednagar'}</option>
                            <option value="dhule">{language === 'mr' ? 'धुळे' : 'Dhule'}</option>
                            <option value="jalgaon">{language === 'mr' ? 'जळगाव' : 'Jalgaon'}</option>
                            <option value="nandurbar">{language === 'mr' ? 'नंदुरबार' : 'Nandurbar'}</option>
                            <option value="nashik_gramin">{language === 'mr' ? 'नाशिक ग्रामीण' : 'Nashik Gramin'}</option>
                          </select>
                        </div>

                        {/* Police Station Selection - shown only when district is selected */}
                        {sendToData.selectedDistrict && (
                          <div>
                            <label className="block text-sm font-semibold text-green-700 mb-2">
                              {language === 'mr' ? 'पोलीस स्टेशन निवडा (अनेक निवडू शकता)' : 'Select Police Stations (Multiple Selection Allowed)'}
                            </label>
                            
                            {/* Select All / Deselect All buttons */}
                            <div className="mb-3 flex space-x-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const allStations = getPoliceStationsForDistrict(sendToData.selectedDistrict);
                                  setSendToData(prev => ({
                                    ...prev, 
                                    selectedPoliceStations: allStations.map(station => station.value)
                                  }));
                                }}
                                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                              >
                                {language === 'mr' ? 'सर्व निवडा' : 'Select All'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSendToData(prev => ({...prev, selectedPoliceStations: []}))}
                                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                              >
                                {language === 'mr' ? 'सर्व काढा' : 'Deselect All'}
                              </button>
                            </div>

                            <div className="max-h-48 overflow-y-auto border border-green-200 rounded-md p-3 bg-white">
                              <div className="grid grid-cols-1 gap-2">
                                {getPoliceStationsForDistrict(sendToData.selectedDistrict).map(station => (
                                  <div key={station.value} className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id={`station_${station.value}`}
                                      checked={(sendToData.selectedPoliceStations || []).includes(station.value)}
                                      onChange={(e) => {
                                        const currentStations = sendToData.selectedPoliceStations || [];
                                        if (e.target.checked) {
                                          setSendToData(prev => ({
                                            ...prev,
                                            selectedPoliceStations: [...currentStations, station.value]
                                          }));
                                        } else {
                                          setSendToData(prev => ({
                                            ...prev,
                                            selectedPoliceStations: currentStations.filter(s => s !== station.value)
                                          }));
                                        }
                                      }}
                                      className="w-4 h-4 text-green-600 bg-white border-green-300 rounded focus:ring-green-500 focus:ring-2"
                                    />
                                    <label htmlFor={`station_${station.value}`} className="text-sm text-gray-700 cursor-pointer">
                                      {station.label}
                                    </label>
                                  </div>
                                ))}

                                {/* Show coming soon message for districts without stations */}
                                {sendToData.selectedDistrict === 'jalgaon' && (
                                  <div className="text-gray-500 text-center py-4">
                                    जळगाव - लवकरच येत आहे
                                  </div>
                                )}
                                
                                {sendToData.selectedDistrict === 'nandurbar' && (
                                  <div className="text-gray-500 text-center py-4">
                                    नंदुरबार - लवकरच येत आहे
                                  </div>
                                )}
                                
                                {sendToData.selectedDistrict === 'nashik_gramin' && (
                                  <div className="text-gray-500 text-center py-4">
                                    नाशिक ग्रामीण - लवकरच येत आहे
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Show selected count */}
                            {sendToData.selectedPoliceStations && sendToData.selectedPoliceStations.length > 0 && (
                              <div className="mt-2 text-sm text-green-700 font-medium">
                                {language === 'mr' ? 
                                  `निवडलेले पोलीस स्टेशन: ${sendToData.selectedPoliceStations.length}` : 
                                  `Selected Police Stations: ${sendToData.selectedPoliceStations.length}`
                                }
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Attachment Information Section */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="text-lg font-bold text-blue-800 mb-3">
                  {language === 'mr' ? 'ईमेलमध्ये समाविष्ट केलेली फाईल्स' : 'Files to be Included in Email'}
                </h3>
                
                <div className="space-y-3">
                  {/* Main Letter File */}
                  {selectedLetterForSend.uploadedFile && (
                    <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-blue-200">
                      <div className="flex-shrink-0">
                        <FiFileText className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">
                          {language === 'mr' ? 'मुख्य पत्र फाईल' : 'Main Letter File'}
                        </p>
                        <p className="text-xs text-blue-700">
                          {selectedLetterForSend.uploadedFile.originalName || 'Document'}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {language === 'mr' ? 'समाविष्ट' : 'Included'}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Covering Letter File */}
                  {selectedLetterForSend.coveringLetter && selectedLetterForSend.coveringLetter.attachedFile && (
                    <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-blue-200">
                      <div className="flex-shrink-0">
                        <FiFileText className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-900">
                          {language === 'mr' ? 'कव्हरिंग लेटर फाईल' : 'Covering Letter File'}
                        </p>
                        <p className="text-xs text-green-700">
                          {selectedLetterForSend.coveringLetter.attachedFile.originalName || 'Covering Letter'}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {language === 'mr' ? 'समाविष्ट' : 'Included'}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* No Files Warning */}
                  {(!selectedLetterForSend.uploadedFile && (!selectedLetterForSend.coveringLetter || !selectedLetterForSend.coveringLetter.attachedFile)) && (
                    <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="flex-shrink-0">
                        <FiFileText className="h-6 w-6 text-yellow-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-900">
                          {language === 'mr' ? 'कोणत्याही फाईल्स नाहीत' : 'No Files Available'}
                        </p>
                        <p className="text-xs text-yellow-700">
                          {language === 'mr' 
                            ? 'या पत्रासाठी कोणत्याही फाईल्स नाहीत. एक टेस्ट फाईल समाविष्ट केली जाईल.' 
                            : 'No files available for this letter. A test file will be included.'}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          {language === 'mr' ? 'टेस्ट फाईल' : 'Test File'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Total Attachment Count */}
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">
                      {language === 'mr' ? 'एकूण संलग्नक:' : 'Total Attachments:'}
                    </span>
                    {' '}
                    {(() => {
                      let count = 0;
                      if (selectedLetterForSend.uploadedFile) count++;
                      if (selectedLetterForSend.coveringLetter && selectedLetterForSend.coveringLetter.attachedFile) count++;
                      if (count === 0) count = 1; // Test file
                      return count;
                    })()}
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setSendModalOpen(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  {language === 'mr' ? 'रद्द करा' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center"
                >
                  <FiSend className="mr-2 h-4 w-4" />
                  {language === 'mr' ? 'पाठवा' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Letter Modal */}
      {viewModalOpen && selectedLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8 relative max-h-[90vh] overflow-y-auto border border-blue-100">
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 bg-gray-100 rounded-full p-1 shadow"
              onClick={() => {
                setViewModalOpen(false);
                setImageLoading({});
              }}
            >
              <FiX className="h-6 w-6" />
            </button>
            <h2 className="text-2xl font-extrabold mb-8 text-blue-700 text-center tracking-wide drop-shadow">
              {language === 'mr' ? 'पत्र तपशील' : 'Letter Details'}
            </h2>
            
            {/* Download and View buttons at the top of modal */}
            {hasAttachments(selectedLetter) && (
              <div className="flex justify-center mb-6 space-x-3">
                <button
                  onClick={() => viewFileInNewTab(selectedLetter)}
                  className="inline-flex items-center px-6 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-md"
                >
                  <FiExternalLink className="mr-2 h-5 w-5" />
                  {language === 'mr' ? 'फाईल पहा' : 'View File'}
                </button>
                <button
                  onClick={() => handleFileDownload(selectedLetter)}
                  className="inline-flex items-center px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-md"
                >
                  <FiDownload className="mr-2 h-5 w-5" />
                  {language === 'mr' ? 'फाईल्स डाउनलोड करा' : 'Download Files'}
                  {selectedLetter.letterFiles && selectedLetter.letterFiles.length > 1 && (
                    <span className="ml-2 bg-green-700 px-2 py-0.5 rounded-full text-xs">
                      {selectedLetter.letterFiles.length} {language === 'mr' ? 'फाईल्स' : 'files'}
                    </span>
                  )}
                </button>
              </div>
            )}
            
            <div className="flex flex-col gap-6">
              {/* Reference Number */}
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {language === 'mr' ? 'संदर्भ क्रमांक' : 'Reference Number'}
                </div>
                <div className="text-lg text-gray-800 font-medium whitespace-pre-line">
                  {selectedLetter.referenceNumber || 'N/A'}
                </div>
              </div>
              <div className="border-b border-blue-100" />
              
              {/* Letter Status */}
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {language === 'mr' ? 'पत्र स्थिती' : 'Letter Status'}
                </div>
                <div className="text-lg text-gray-800 font-medium whitespace-pre-line">
                  {getStatusBadge(getLetterStatus(selectedLetter))}
                </div>
              </div>
              <div className="border-b border-blue-100" />
              
              {/* Sender Office */}
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {t.officeSendingLetter || (language === 'mr' ? 'पत्र पाठविणारे कार्यालय' : 'Sender Office')}
                </div>
                <div className="text-lg text-gray-800 font-medium whitespace-pre-line">
                  {selectedLetter.officeSendingLetter || 'N/A'}
                </div>
              </div>
              <div className="border-b border-blue-100" />
              
              {/* Sender Name & Designation */}
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {t.senderNameAndDesignation || (language === 'mr' ? 'पाठविणाऱ्याचे नाव व पदनाम' : 'Sender Name & Designation')}
                </div>
                <div className="text-lg text-gray-800 font-medium whitespace-pre-line">
                  {selectedLetter.senderNameAndDesignation || 'N/A'}
                </div>
              </div>
              <div className="border-b border-blue-100" />
              
              {/* Outward Letter Number */}
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {t.outward_letter_no || (language === 'mr' ? 'प्राप्त पत्राचा जावक क्रमांक' : 'Outward Letter Number')}
                </div>
                <div className="text-lg text-gray-800 font-medium whitespace-pre-line">
                  {selectedLetter.outwardLetterNumber || 'N/A'}
                </div>
              </div>
              <div className="border-b border-blue-100" />
              
              {/* Number of Copies */}
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {t.no_of_documents || (language === 'mr' ? 'सह कागद पत्रांची संख्या' : 'Number of Copies')}
                </div>
                <div className="text-lg text-gray-800 font-medium whitespace-pre-line">
                  {selectedLetter.numberOfCopies || 'N/A'}
                </div>
              </div>
              <div className="border-b border-blue-100" />
              
              {/* Mobile Number */}
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {t.mobileNumber || (language === 'mr' ? 'मोबाईल नंबर / टेलीफोन नंबर' : 'Mobile Number')}
                </div>
                <div className="text-lg text-gray-800 font-medium whitespace-pre-line">
                  {selectedLetter.mobileNumber || 'N/A'}
                </div>
              </div>
              <div className="border-b border-blue-100" />
              
              {/* Letter Medium */}
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {t.letterMedium || (language === 'mr' ? 'पत्राचे माध्यम' : 'Letter Medium')}
                </div>
                <div className="text-lg text-gray-800 font-medium whitespace-pre-line">
                  {t[selectedLetter.letterMedium] || selectedLetter.letterMedium || 'N/A'}
                </div>
              </div>
              <div className="border-b border-blue-100" />
              
              {/* Letter Classification */}
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {t.letterClassification || (language === 'mr' ? 'पत्राचे वर्गीकरण' : 'Letter Classification')}
                </div>
                <div className="text-lg text-gray-800 font-medium whitespace-pre-line">
                  {selectedLetter.letterClassification || 'N/A'}
                </div>
              </div>
              <div className="border-b border-blue-100" />
              
              {/* Letter Type */}
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {t.letterType || (language === 'mr' ? 'पत्राचा प्रकार' : 'Letter Type')}
                </div>
                <div className="text-lg text-gray-800 font-medium whitespace-pre-line">
                  {t[selectedLetter.letterType] || selectedLetter.letterType || 'N/A'}
                </div>
              </div>
              <div className="border-b border-blue-100" />
              
              {/* Date of Receipt */}
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {t.date_of_receipt_of_the_letter || (language === 'mr' ? 'पत्र मिळाल्याचा दिनांक' : 'Date of Receipt of Letter')}
                </div>
                <div className="text-lg text-gray-800 font-medium whitespace-pre-line">
                  {selectedLetter.dateOfReceiptOfLetter || selectedLetter.date_of_receipt_of_the_letter || 'N/A'}
                </div>
              </div>
              <div className="border-b border-blue-100" />
              
              {/* Letter Date */}
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {t.letterDate || (language === 'mr' ? 'पत्राची तारीख' : 'Letter Date')}
                </div>
                <div className="text-lg text-gray-800 font-medium whitespace-pre-line">
                  {selectedLetter.letterDate || 'N/A'}
                </div>
              </div>
              <div className="border-b border-blue-100" />
              
              {/* Subject */}
              <div>
                <div className="text-base font-bold text-blue-900 mb-1">
                  {t.subject || (language === 'mr' ? 'विषय' : 'Subject')}
                </div>
                <div className="text-lg text-gray-800 font-medium whitespace-pre-line">
                  {selectedLetter.subject || 'N/A'}
                </div>
              </div>

              {/* Covering Letter Section - Updated */}
              {selectedLetter && (
                <>
                  <div className="border-b border-blue-100" />
                  <div>
                    <div className="text-base font-bold text-blue-900 mb-3">
                      {language === 'mr' ? 'कव्हरिंग लेटर' : 'Covering Letter'}
                    </div>
                    
                    {hasCoveringLetter(selectedLetter) ? (
                      // Show existing covering letter
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="text-lg font-semibold text-indigo-800">
                              {selectedLetter.coveringLetter?.letterType === 'UPLOADED' 
                                ? (language === 'mr' ? 'अपलोड केलेले कव्हरिंग लेटर' : 'Uploaded Covering Letter')
                                : (language === 'mr' ? 'ऑटो-जेनेरेटेड कव्हरिंग लेटर' : 'Auto-Generated Covering Letter')
                              }
                            </h4>
                            <p className="text-sm text-indigo-600">
                              {language === 'mr' ? 'संदर्भ क्रमांक:' : 'Letter Number:'} {selectedLetter.coveringLetter?.letterNumber}
                            </p>
                            <p className="text-sm text-indigo-600">
                              {language === 'mr' ? 'दिनांक:' : 'Date:'} {selectedLetter.coveringLetter?.letterDate}
                            </p>
                            <p className="text-sm text-indigo-600">
                              {language === 'mr' ? 'स्थिती:' : 'Status:'} 
                              <span className={`ml-1 px-2 py-1 rounded text-xs font-medium ${
                                selectedLetter.coveringLetter?.status === 'DRAFT' 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : selectedLetter.coveringLetter?.status === 'UPLOADED'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {selectedLetter.coveringLetter?.status}
                              </span>
                            </p>
                          </div>
                          
                          <div className="flex flex-col space-y-2">
                            {/* View and Action Buttons */}
                            <div className="flex space-x-2">
                              {/* View PDF Button */}
                              {selectedLetter.coveringLetter?.pdfUrl && (
                                <button
                                  onClick={() => window.open(selectedLetter.coveringLetter?.pdfUrl, '_blank')}
                                  className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors shadow-md"
                                >
                                  <FiFileText className="mr-1 h-3 w-3" />
                                  {language === 'mr' ? 'PDF पहा' : 'View PDF'}
                                </button>
                              )}
                              
                              {/* View HTML Button - only for generated letters */}
                              {selectedLetter.coveringLetter?.htmlUrl && (
                                <button
                                  onClick={() => window.open(selectedLetter.coveringLetter?.htmlUrl, '_blank')}
                                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                                >
                                  <FiExternalLink className="mr-1 h-3 w-3" />
                                  {language === 'mr' ? 'HTML पहा' : 'View HTML'}
                                </button>
                              )}
                            </div>
                            
                            <div className="flex space-x-2">
                              {/* Delete Button - for all covering letters */}
                              <button
                                onClick={() => {
                                  const coveringLetter = selectedLetter && (selectedLetter.coveringLetter || selectedLetter.coveringLetter);
                                  coveringLetter && handleDeleteCoveringLetter(coveringLetter.id || coveringLetter._id);
                                }}
                                className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors shadow-md"
                                title={language === 'mr' ? 'कव्हरिंग लेटर हटवा' : 'Delete covering letter'}
                              >
                                <FiTrash2 className="mr-1 h-3 w-3" />
                                {language === 'mr' ? 'हटवा' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Recipient Information */}
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-indigo-700">
                              {language === 'mr' ? 'प्राप्तकर्ता कार्यालय:' : 'Recipient Office:'}
                            </span>
                            <p className="text-gray-600">{selectedLetter.coveringLetter?.recipientOffice || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="font-medium text-indigo-700">
                              {language === 'mr' ? 'प्राप्तकर्ता पदनाम:' : 'Recipient Designation:'}
                            </span>
                            <p className="text-gray-600">{selectedLetter.coveringLetter?.recipientDesignation || 'N/A'}</p>
                          </div>
                        </div>
                        
                        {/* Show file info for uploaded files */}
                        {selectedLetter.coveringLetter?.uploadedFile && (
                          <div className="mt-3 pt-3 border-t border-indigo-200">
                            <p className="text-xs text-indigo-700">
                              {language === 'mr' ? 'फाईल:' : 'File:'} {selectedLetter.coveringLetter?.uploadedFile.originalName}
                            </p>
                            <p className="text-xs text-indigo-600">
                              {language === 'mr' ? 'साईज:' : 'Size:'} {(selectedLetter.coveringLetter?.uploadedFile.fileSize / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      // No covering letter - show upload/generate options
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                        <div className="text-center">
                          <FiFileText className="mx-auto h-12 w-12 text-yellow-400 mb-3" />
                          <h4 className="text-lg font-semibold text-yellow-800 mb-2">
                            {language === 'mr' ? 'कव्हरिंग लेटर उपलब्ध नाही' : 'No Covering Letter Available'}
                          </h4>
                          <p className="text-sm text-yellow-700 mb-4">
                            {language === 'mr' 
                              ? 'या पत्रासाठी कव्हरिंग लेटर तयार करा किंवा अपलोड करा' 
                              : 'Generate or upload a covering letter for this document'}
                          </p>
                          
                          <div className="flex justify-center space-x-3">
                    
                            
                            {/* Upload Existing Covering Letter */}
                            <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-md cursor-pointer">
                              <FiUpload className="mr-2 h-4 w-4" />
                              {language === 'mr' ? 'फाईल अपलोड करा' : 'Upload File'}
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx"
                                onChange={(e) => {
                                  if (e.target.files[0]) {
                                    handleUploadCoveringLetter(selectedLetter, e.target.files[0]);
                                  }
                                }}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {/* File Attachments */}
              {((selectedLetter.letterFiles && selectedLetter.letterFiles.length > 0) || 
                (selectedLetter.upload && (selectedLetter.upload.fileUrl || selectedLetter.upload.fileName)) ||
                (selectedLetter.uploadedFile && (selectedLetter.uploadedFile.fileUrl || selectedLetter.uploadedFile.fileName))) && (
                <>
                  <div className="border-b border-blue-100" />
                  <div>
                    <div className="text-base font-bold text-blue-900 mb-3">
                      {language === 'mr' ? 'संलग्न फाईल्स' : 'File Attachments'}
                    </div>
      
                    {/* Handle uploadedFile structure (new API structure) */}
                    {selectedLetter.uploadedFile && (selectedLetter.uploadedFile.fileUrl || selectedLetter.uploadedFile.fileName) && (
                      <div className="space-y-4">
                        {(() => {
                          const fileUrl = selectedLetter.uploadedFile.fileUrl || `http://localhost:5000/${selectedLetter.uploadedFile.fileName.replace(/\\/g, '/')}`;
                          const fileName = selectedLetter.uploadedFile.originalName || selectedLetter.uploadedFile.fileName?.split('/').pop() || 'Document';
                          const isViewable = isViewableFile(fileName);
                          const fileExt = getFileExtension(fileName);
                          
                          return (
                            <div className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">{fileName}</span>
                                <div className="flex space-x-2">
                                  <a 
                                    href={fileUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-md hover:bg-blue-200 transition-colors"
                                  >
                                    <FiEye className="mr-1 h-4 w-4" />
                                    {language === 'mr' ? 'पहा' : 'View'}
                                  </a>
                                  <button
                                    onClick={() => downloadSingleFile(fileUrl, fileName)}
                                    className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 text-sm rounded-md hover:bg-green-200 transition-colors"
                                  >
                                    <FiDownload className="mr-1 h-4 w-4" />
                                    {language === 'mr' ? 'डाउनलोड' : 'Download'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    
                    {/* Handle new upload structure */}
                    {selectedLetter.upload && (selectedLetter.upload.fileUrl || selectedLetter.upload.fileName) && !selectedLetter.uploadedFile && (
                      <div className="space-y-4">
                        {(() => {
                          const fileUrl = selectedLetter.upload.fileUrl || `http://localhost:5000/${selectedLetter.upload.fileName.replace(/\\/g, '/')}`;
                          const fileName = selectedLetter.upload.originalName || selectedLetter.upload.fileName?.split('/').pop() || 'Document';
                          const isViewable = isViewableFile(fileName);
                          const fileExt = getFileExtension(fileName);
                          
                          return (
                            <div className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">{fileName}</span>
                                <div className="flex space-x-2">
                                  {isViewable && (
                                    <a 
                                      href={fileUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-md hover:bg-blue-200 transition-colors"
                                    >
                                      <FiEye className="mr-1 h-4 w-4" />
                                      {language === 'mr' ? 'नवीन टॅबमध्ये उघडा' : 'Open in New Tab'}
                                    </a>
                                  )}
                                  <button
                                    onClick={() => handleFileDownload(selectedLetter)}
                                    className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 text-sm rounded-md hover:bg-green-200 transition-colors"
                                  >
                                    <FiDownload className="mr-1 h-4 w-4" />
                                    {language === 'mr' ? 'डाउनलोड' : 'Download'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    
                    {/* Handle legacy letterFiles structure */}
                    {selectedLetter.letterFiles && selectedLetter.letterFiles.length > 0 && (
                      <div className="space-y-4">
                        {selectedLetter.letterFiles.map((file, i) => {
                          const fileUrl = `http://localhost:5000/${file.filePath.replace(/\\/g, '/')}`;
                          const fileName = file.originalName || file.filePath.split('/').pop();
                          const isViewable = isViewableFile(fileName);
                          const fileExt = getFileExtension(fileName);
                          
                          return (
                            <div key={i} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">{fileName}</span>
                                <div className="flex space-x-2">
                                  {isViewable && (
                                    <a 
                                      href={fileUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-md hover:bg-blue-200 transition-colors"
                                    >
                                      <FiExternalLink className="mr-1 h-4 w-4" />
                                      {language === 'mr' ? 'नवीन टॅबमध्ये उघडा' : 'Open in New Tab'}
                                    </a>
                                  )}
                                  <button
                                    onClick={() => {
                                      const fileUrl = `http://localhost:5000/${file.filePath.replace(/\\/g, '/')}`;
                                      const fileName = file.originalName || file.filePath.split('/').pop();
                                      downloadSingleFile(fileUrl, fileName);
                                    }}
                                    className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 text-sm rounded-md hover:bg-green-200 transition-colors"
                                  >
                                    <FiDownload className="mr-1 h-4 w-4" />
                                    {language === 'mr' ? 'डाउनलोड' : 'Download'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-center mt-8">
              <button
                className="px-8 py-2 bg-blue-600 text-white rounded-lg font-semibold shadow hover:bg-blue-700 transition-colors text-lg"
                onClick={() => {
                  setViewModalOpen(false);
                  setImageLoading({});
                }}
              >
                {language === 'mr' ? 'बंद करा' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay for covering letter upload */}
      {uploadingCoveringLetter && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-700">
                {language === 'mr' ? 'कव्हरिंग लेटर S3 वर अपलोड होत आहे...' : 'Uploading covering letter to S3...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay for covering letter generation */}
      {generatingCoveringLetter && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mb-4"></div>
              <p className="text-gray-700">
                {language === 'mr' ? 'कव्हरिंग लेटर तयार होत आहे...' : 'Generating covering letter...'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InwardStaffLetters;