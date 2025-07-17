import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEye, FiRefreshCw, FiSearch, FiCheck, FiX, FiExternalLink, FiFileText, FiSend } from 'react-icons/fi';
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
  
  // Status filter options with translations
  const statusOptions = [
    { value: 'All', label: language === 'mr' ? 'सर्व स्थिती' : 'All Status' },
    { value: 'NA', label: 'NA' },
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
    
    // If status is not "sending for head sign", return "NA"
    if (status.toLowerCase() !== 'sending for head sign') {
      return 'NA';
    }
    
    return status;
  };

  // Helper function to get status badge styling
  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase() || 'na';
    
    const statusConfig = {
      'na': {
        bg: 'bg-gray-100',
        text: 'text-gray-600',
        label: 'NA'
      },
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

  // Handle send modal open
  const handleSendClick = (letter) => {
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
      const letterId = selectedLetterForSend._id || selectedLetterForSend.id;
      
      // Prepare the data to send
      const updateData = {
        letterStatus: 'pending', // Update status to pending when sent to HOD
        sentTo: {
          igp: sendToData.igp,
          sp: sendToData.sp,
          sdpo: sendToData.sdpo,
          policeStation: sendToData.policeStation,
          selectedDistrict: sendToData.selectedDistrict,
          selectedPoliceStations: sendToData.selectedPoliceStations
        },
        sentAt: new Date().toISOString()
      };

      console.log('Sending letter to HOD:', letterId, updateData);
      
      // Update the letter status
      const response = await axios.put(`http://localhost:5000/api/patras/${letterId}`, updateData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.status === 200) {
        // Show success message
        alert(language === 'mr' ? 'पत्र HOD ला यशस्वीरित्या पाठवले गेले!' : 'Letter sent to HOD successfully!');
        
        // Close modal
        setSendModalOpen(false);
        setSelectedLetterForSend(null);
        
        // Refresh letters
        handleRefresh();
      }
    } catch (error) {
      console.error('Error sending letter to HOD:', error);
      alert(language === 'mr' ? 'पत्र पाठविण्यात त्रुटी!' : 'Error sending letter!');
    }
  };

  // Fetch letters from API
  const handleRefresh = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('http://localhost:5000/api/patras', {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });
      
      if (response.data && Array.isArray(response.data)) {
        console.log('Letters received:', response.data);
        setLetters(response.data);
      } else {
        throw new Error('Invalid data format received from server');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 
                         err.message || 
                         'Failed to fetch letters. Please check your connection and try again.';
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
    handleRefresh();
  }, []);

  // Filter letters based on search term, status, and date
  const filteredLetters = letters.filter(letter => {
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
    
    const letterStatus = getLetterStatus(letter);
    const matchesStatus = statusFilter === 'All' || 
      letterStatus.toLowerCase() === statusFilter.toLowerCase() ||
      (statusFilter === 'sending for head sign' && letterStatus === 'sending for head sign') ||
      (statusFilter === 'NA' && letterStatus === 'NA');

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
            {language === 'mr' ? 'सर्व आंतर-शासकीय पत्रे' : 'All Inward Letters'}
          </h1>
          <p className="text-gray-500">
            {language === 'mr' 
              ? 'सर्व आंतर-शासकीय पत्रे पहा आणि व्यवस्थापित करा' 
              : 'View and manage all inward letters'}
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
                      key={letter.id || letter._id} 
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
                        <button
                          onClick={() => handleSendClick(letter)}
                          className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                          title={language === 'mr' ? 'पत्र पाठवा' : 'Send Letter'}
                        >
                          <FiSend className="mr-1 h-3 w-3" />
                          {language === 'mr' ? 'पाठवा' : 'Send'}
                        </button>
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
              onClick={() => setViewModalOpen(false)}
            >
              <FiX className="h-6 w-6" />
            </button>
            <h2 className="text-2xl font-extrabold mb-8 text-blue-700 text-center tracking-wide drop-shadow">
              {language === 'mr' ? 'पत्र तपशील' : 'Letter Details'}
            </h2>
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
                (selectedLetter.upload && (selectedLetter.upload.fileUrl || selectedLetter.upload.fileName))) && (
                <>
                  <div className="border-b border-blue-100" />
                  <div>
                    <div className="text-base font-bold text-blue-900 mb-1">
                      {language === 'mr' ? 'संलग्न फाईल्स' : 'Attachments'}
                    </div>
                    
                    {/* Handle new upload structure */}
                    {selectedLetter.upload && (selectedLetter.upload.fileUrl || selectedLetter.upload.fileName) && (
                      <ul className="list-disc ml-5">
                        <li>
                          <a 
                            href={selectedLetter.upload.fileUrl || `http://localhost:5000/${selectedLetter.upload.fileName.replace(/\\/g, '/')}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-600 hover:underline"
                          >
                            {selectedLetter.upload.originalName || selectedLetter.upload.fileName?.split('/').pop() || 'Document'}
                          </a>
                        </li>
                      </ul>
                    )}
                    
                    {/* Handle legacy letterFiles structure */}
                    {selectedLetter.letterFiles && selectedLetter.letterFiles.length > 0 && (
                      <ul className="list-disc ml-5">
                        {selectedLetter.letterFiles.map((file, i) => (
                          <li key={i}>
                            <a 
                              href={`http://localhost:5000/${file.filePath.replace(/\\/g, '/')}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-blue-600 hover:underline"
                            >
                              {file.originalName || file.filePath.split('/').pop()}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
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
    </div>
  );
};

export default InwardStaffLetters;