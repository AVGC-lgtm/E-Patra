import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEye, FiRefreshCw, FiSearch, FiCheck, FiX, FiExternalLink, FiFileText, FiSend, FiDownload } from 'react-icons/fi';
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
  
  // Status filter options with translations
  const statusOptions = [
    { value: 'All', label: language === 'mr' ? 'सर्व स्थिती' : 'All Status' },
    { value: 'sending for head sign', label: language === 'mr' ? 'प्रमुख स्वाक्षरीसाठी पाठवत आहे' : 'Sending for Head Sign' }
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

  // Debug API Call function
  const debugAPICall = async (letterId) => {
    const token = localStorage.getItem('token');
    
    console.log('=== API Debug Start ===');
    console.log('Testing letter ID:', letterId);
    
    try {
      // First, try to GET the letter to ensure it exists
      const getResponse = await axios.get(
        `http://localhost:5000/api/patras/${letterId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      console.log('GET Response:', getResponse.data);
    } catch (error) {
      console.error('GET Error:', error.response?.data || error.message);
    }
    
    // Test 2: Try minimal update
    try {
      const minimalUpdate = {
        letterStatus: 'pending'
      };
      
      console.log('Attempting minimal update:', minimalUpdate);
      
      const updateResponse = await axios.put(
        `http://localhost:5000/api/patras/${letterId}`,
        minimalUpdate,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      console.log('Minimal Update Success:', updateResponse.data);
    } catch (error) {
      console.error('Minimal Update Error:', error.response?.data || error.message);
    }
    
    // Test 3: Check what fields the backend accepts
    try {
      const testFields = [
        { letterStatus: 'pending' },
        { letterStatus: 'sent to head' },
        { letterStatus: 'forwarded' },
        { sentTo: { igp: true } },
        { sentAt: new Date().toISOString() },
        { userId: 4 }
      ];
      
      for (const field of testFields) {
        try {
          console.log('Testing field:', field);
          const response = await axios.put(
            `http://localhost:5000/api/patras/${letterId}`,
            field,
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            }
          );
          console.log(`Field ${Object.keys(field)[0]} works:`, response.status);
        } catch (error) {
          console.error(`Field ${Object.keys(field)[0]} failed:`, error.response?.data);
        }
      }
    } catch (error) {
      console.error('Field testing error:', error);
    }
    
    console.log('=== API Debug End ===');
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
      
      // Uncomment to debug API endpoints
      // await debugAPICall(letterId);
      
      // Prepare the update data
      // Try different status values based on what your backend expects
      const possibleStatuses = ['sent to head', 'forwarded', 'pending', 'in review'];
      
      const updateData = {
        letterStatus: 'sent to head', // Change this based on your backend requirements
        sentTo: {
          igp: sendToData.igp || false,
          sp: sendToData.sp || false,
          sdpo: sendToData.sdpo || false,
          policeStation: sendToData.policeStation || false,
          selectedDistrict: sendToData.selectedDistrict || '',
          selectedPoliceStations: sendToData.selectedPoliceStations || []
        },
        sentAt: new Date().toISOString(),
        // Include user information if available
        ...(userData && {
          userId: userData.id,
          updatedBy: userData.id,
          updatedByEmail: userData.email,
          updatedByName: userData.name,
          userRole: userData.role
        })
      };

      // Clean up undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined || updateData[key] === null) {
          delete updateData[key];
        }
      });

      console.log('Sending update request:');
      console.log('URL:', `http://localhost:5000/api/patras/${letterId}`);
      console.log('Data:', JSON.stringify(updateData, null, 2));
      console.log('Token:', token);
      
      // Make the API call
      const response = await axios.put(
        `http://localhost:5000/api/patras/${letterId}`, 
        updateData, 
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log('Response:', response);

      if (response.status === 200 || response.status === 201) {
        // Show success message
        alert(language === 'mr' ? 
          'पत्र HOD ला यशस्वीरित्या पाठवले गेले!' : 
          'Letter sent to HOD successfully!');
        
        // Close modal
        setSendModalOpen(false);
        setSelectedLetterForSend(null);
        
        // Refresh letters
        handleRefresh();
      }
    } catch (error) {
      console.error('Error sending letter to HOD:', error);
      
      if (error.response) {
        console.error('Full error response:', error.response);
        console.error('Error data:', JSON.stringify(error.response.data, null, 2));
        
        const errorMessage = error.response.data?.message || 
                           error.response.data?.error || 
                           error.response.data?.details ||
                           (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data)) ||
                           'Server error';
        
        // For debugging, show the full error
        if (error.response.status === 500) {
          alert(`Server Error (500):\n${errorMessage}\n\nPlease check the server logs for more details.\n\nRequest Details:\n- URL: ${error.config.url}\n- Method: ${error.config.method}\n- Data: ${error.config.data}`);
          
          // Log what we tried to send
          console.error('Failed request details:', {
            url: error.config.url,
            method: error.config.method,
            headers: error.config.headers,
            data: JSON.parse(error.config.data || '{}')
          });
          
          // Suggest checking backend logs
          console.error('💡 Troubleshooting tips:');
          console.error('1. Check if the letter status transition is allowed (sending for head sign → sent to head)');
          console.error('2. Verify all required fields are present in the updateData');
          console.error('3. Check backend logs for the specific error');
          console.error('4. Test the API endpoint with Postman using the same data');
        } else if (error.response.status === 401) {
          alert(language === 'mr' ? 
            'वापरकर्ता सत्यापन अयशस्वी. कृपया पुन्हा लॉगिन करा.' : 
            'User authentication failed. Please login again.');
          
          // Clear stored data
          localStorage.removeItem('token');
          localStorage.removeItem('userInfo');
          localStorage.removeItem('user');
          
          // Redirect to login
          navigate('/login');
        } else {
          alert(language === 'mr' ? 
            `पत्र पाठविण्यात त्रुटी: ${errorMessage}` : 
            `Error sending letter: ${errorMessage}`);
        }
      } else if (error.request) {
        console.error('No response received:', error.request);
        alert(language === 'mr' ? 
          'सर्व्हरशी संपर्क साधू शकत नाही. कृपया पुन्हा प्रयत्न करा.' : 
          'Cannot connect to server. Please try again.');
      } else {
        console.error('Error setting up request:', error.message);
        alert(language === 'mr' ? 
          `त्रुटी: ${error.message}` : 
          `Error: ${error.message}`);
      }
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
      
      if (response.data && Array.isArray(response.data)) {
        console.log('Letters received:', response.data);
        console.log('Letter IDs:', response.data.map(l => ({ 
          ref: l.referenceNumber, 
          id: l._id || l.id,
          status: l.letterStatus,
          hasFile: !!(l.uploadedFile || l.upload || l.letterFiles)
        })));
        setLetters(response.data);
      } else {
        throw new Error('Invalid data format received from server');
      }
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
  // Only show letters with status "sending for head sign" in InwardStaffLetters
  const filteredLetters = letters.filter(letter => {
    // Only show letters with "sending for head sign" status
    const letterStatus = letter.letterStatus || letter.letter_status || letter.status || '';
    if (letterStatus.toLowerCase() !== 'sending for head sign') {
      return false;
    }

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

    return matchesSearch && matchesStatus && matchesDate;
  });

  const totalPages = Math.ceil(filteredLetters.length / recordsPerPage);
  const paginatedLetters = filteredLetters.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

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
                          
                          {/* View File button */}
                          <button
                            onClick={() => hasAttachments(letter) ? viewFileInNewTab(letter) : null}
                            className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded transition-colors shadow-sm ${
                              hasAttachments(letter) 
                                ? 'bg-purple-600 text-white hover:bg-purple-700' 
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                            title={
                              hasAttachments(letter) 
                                ? (language === 'mr' ? 'फाईल पहा' : 'View File') 
                                : (language === 'mr' ? 'कोणतीही फाईल संलग्न नाही' : 'No file attached')
                            }
                            disabled={!hasAttachments(letter)}
                          >
                            <FiExternalLink className="h-4 w-4" />
                            <span className="ml-1">{language === 'mr' ? 'फाईल पहा' : 'View File'}</span>
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
              
              {/* File Attachments */}
              {((selectedLetter.letterFiles && selectedLetter.letterFiles.length > 0) || 
                (selectedLetter.upload && (selectedLetter.upload.fileUrl || selectedLetter.upload.fileName)) ||
                (selectedLetter.uploadedFile && (selectedLetter.uploadedFile.fileUrl || selectedLetter.uploadedFile.fileName))) && (
                <>
                  <div className="border-b border-blue-100" />
                  <div>
      
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
                              
                              {/* File Preview */}
                
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
                              
                              {/* File Preview */}
                              {isViewable ? (
                                <div className="mt-3">
                                  {fileExt === 'pdf' ? (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                      <p className="text-xs text-gray-500 mb-2 text-center">
                                        {language === 'mr' ? 'PDF पूर्वावलोकन' : 'PDF Preview'}
                                      </p>
                                      <iframe
                                        src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                        className="w-full h-96 rounded border border-gray-300"
                                        title="PDF Preview"
                                        sandbox="allow-same-origin allow-scripts"
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          e.target.parentElement.innerHTML = `
                                            <div class="text-center py-8">
                                              <p class="text-gray-600">${language === 'mr' ? 'PDF लोड करताना त्रुटी' : 'Error loading PDF'}</p>
                                              <p class="text-sm text-gray-500 mt-2">${language === 'mr' ? 'कृपया फाईल डाउनलोड करा' : 'Please download the file instead'}</p>
                                            </div>
                                          `;
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                      {imageLoading[fileUrl] && (
                                        <div className="flex justify-center items-center h-48">
                                          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                                        </div>
                                      )}
                                      <img
                                        src={fileUrl}
                                        alt="Document Preview"
                                        className={`max-w-full h-auto rounded border border-gray-300 ${imageLoading[fileUrl] ? 'hidden' : ''}`}
                                        style={{ maxHeight: '400px', objectFit: 'contain' }}
                                        onLoad={() => setImageLoading(prev => ({ ...prev, [fileUrl]: false }))}
                                        onLoadStart={() => setImageLoading(prev => ({ ...prev, [fileUrl]: true }))}
                                        onError={() => setImageLoading(prev => ({ ...prev, [fileUrl]: false }))}
                                      />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-3 bg-gray-50 rounded-lg p-8 text-center">
                                  <div className="flex flex-col items-center">
                                    {getFileTypeIcon(fileName)}
                                    <p className="mt-2 text-sm text-gray-600">
                                      {language === 'mr' ? 'या फाईल प्रकाराचे पूर्वावलोकन उपलब्ध नाही' : 'Preview not available for this file type'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {language === 'mr' ? 'कृपया फाईल डाउनलोड करा' : 'Please download the file to view'}
                                    </p>
                                  </div>
                                </div>
                              )}
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
                              
                              {/* File Preview */}
                              {isViewable ? (
                                <div className="mt-3">
                                  {fileExt === 'pdf' ? (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                      <p className="text-xs text-gray-500 mb-2 text-center">
                                        {language === 'mr' ? 'PDF पूर्वावलोकन' : 'PDF Preview'}
                                      </p>
                                      <iframe
                                        src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                        className="w-full h-96 rounded border border-gray-300"
                                        title={`PDF Preview ${i + 1}`}
                                        sandbox="allow-same-origin allow-scripts"
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          e.target.parentElement.innerHTML = `
                                            <div class="text-center py-8">
                                              <p class="text-gray-600">${language === 'mr' ? 'PDF लोड करताना त्रुटी' : 'Error loading PDF'}</p>
                                              <p class="text-sm text-gray-500 mt-2">${language === 'mr' ? 'कृपया फाईल डाउनलोड करा' : 'Please download the file instead'}</p>
                                            </div>
                                          `;
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                      {imageLoading[fileUrl] && (
                                        <div className="flex justify-center items-center h-48">
                                          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                                        </div>
                                      )}
                                      <img
                                        src={fileUrl}
                                        alt={`Document Preview ${i + 1}`}
                                        className={`max-w-full h-auto rounded border border-gray-300 ${imageLoading[fileUrl] ? 'hidden' : ''}`}
                                        style={{ maxHeight: '400px', objectFit: 'contain' }}
                                        onLoad={() => setImageLoading(prev => ({ ...prev, [fileUrl]: false }))}
                                        onLoadStart={() => setImageLoading(prev => ({ ...prev, [fileUrl]: true }))}
                                        onError={() => setImageLoading(prev => ({ ...prev, [fileUrl]: false }))}
                                      />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-3 bg-gray-50 rounded-lg p-8 text-center">
                                  <div className="flex flex-col items-center">
                                    {getFileTypeIcon(fileName)}
                                    <p className="mt-2 text-sm text-gray-600">
                                      {language === 'mr' ? 'या फाईल प्रकाराचे पूर्वावलोकन उपलब्ध नाही' : 'Preview not available for this file type'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {language === 'mr' ? 'कृपया फाईल डाउनलोड करा' : 'Please download the file to view'}
                                    </p>
                                  </div>
                                </div>
                              )}
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
    </div>
  );
};

export default InwardStaffLetters;