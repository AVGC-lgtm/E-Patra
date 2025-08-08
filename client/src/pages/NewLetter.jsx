import { useState, useRef, useEffect } from 'react';
import { FiUpload, FiX, FiPaperclip, FiEye, FiDownload } from 'react-icons/fi';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import translations from '../translations';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, parseISO } from "date-fns";
import axios from 'axios';
const apiUrl = import.meta.env.VITE_API_URL;

const NewLetter = () => {
  const [mainFiles, setMainFiles] = useState([]);
  const [additionalFiles, setAdditionalFiles] = useState([]);
  const [mainFileId, setMainFileId] = useState(null);
  
  // Get user information from localStorage
  const [userId, setUserId] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  
  // Get user information on component mount
  useEffect(() => {
    const storedUserId = sessionStorage.getItem('userId');
    const storedUserInfo = sessionStorage.getItem('userInfo');
    
    if (storedUserId) {
      setUserId(parseInt(storedUserId));
      console.log('Found user ID from sessionStorage:', storedUserId);
    }
    
    if (storedUserInfo) {
      try {
        const parsedUserInfo = JSON.parse(storedUserInfo);
        setUserInfo(parsedUserInfo);
        console.log('User info loaded from sessionStorage:', parsedUserInfo);
      } catch (error) {
        console.error('Error parsing user info:', error);
      }
    }
    
    if (!storedUserId) {
      console.warn('No user ID found in sessionStorage. User might not be logged in.');
    }
  }, []);

  // Function to get file URL from file ID
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
      
      return {
        url: fileData.url || `${apiUrl}/${fileData.filePath.replace(/\\/g, '/')}`,
        originalName: fileData.originalName,
        filePath: fileData.filePath
      };
      
    } catch (error) {
      console.error('Error fetching file URL:', error);
      return null;
    }
  };

  // Function to construct file URL directly
  const constructFileUrl = (fileId, fileName = null) => {
    const baseUrl = `${apiUrl}`;
    if (fileName) {
      return `${baseUrl}/uploads/${fileId}/${fileName}`;
    } else {
      return `${baseUrl}/uploads/${fileId}`;
    }
  };

  // Function to preview file using file ID
  const previewFileById = async (fileId) => {
    try {
      const fileInfo = await getFileUrlFromId(fileId);
      if (fileInfo && fileInfo.url) {
        window.open(fileInfo.url, '_blank');
      } else {
        toast.error('File not found or access denied');
      }
    } catch (error) {
      console.error('Error previewing file:', error);
      toast.error('Error accessing file');
    }
  };

  // Function to download file using file ID
  const downloadFileById = async (fileId) => {
    try {
      const fileInfo = await getFileUrlFromId(fileId);
      if (fileInfo && fileInfo.url) {
        const link = document.createElement('a');
        link.href = fileInfo.url;
        link.download = fileInfo.originalName || `file_${fileId}`;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        toast.error('File not found or access denied');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Error downloading file');
    }
  };
  
  // Handle main letter file upload
  const handleMainFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    setMainFiles(selectedFiles);
    
    if (selectedFiles.length > 0) {
      const file = selectedFiles[0];
      console.log('Processing file:', file.name);
      
      const fileCopy = new File([file], file.name, { type: file.type });
      extractTextFromFile(fileCopy).catch(error => {
        console.error('Error in background text extraction:', error);
      });
    }
  };
  
  // Function to parse extracted text and extract form fields
  const parseExtractedText = (text) => {
    const result = {};
    
    try {
      console.log('Parsing text:', text);
      
      const refMatch = text.match(/अर्ज क्रमांक[\s:-]*([^\s\n]+)/);
      if (refMatch && refMatch[1]) {
        result.referenceNumber = refMatch[1].trim();
        console.log('Found reference number:', result.referenceNumber);
      }
      
      const dateMatch = text.match(/दिनांक[\s:-]*([0-9/]+)/);
      if (dateMatch && dateMatch[1]) {
        result.letterDate = dateMatch[1].trim();
        console.log('Found date:', result.letterDate);
      }
      
      const subjectMatch = text.match(/विषय[\s:-]*(.+?)(?=\n|$)/s);
      if (subjectMatch && subjectMatch[1]) {
        result.subject = subjectMatch[1].trim();
        console.log('Found subject:', result.subject);
      }
      
      const officeMatch = text.match(/उ\.वि\.पो\.अ\.\/पो\.नि\/स\.पो\.नि\.\/([^\n]+)/);
      if (officeMatch && officeMatch[1]) {
        result.office = officeMatch[1].trim();
        console.log('Found office:', result.office);
      }
      
      const locationMatch = text.match(/पोलीस अधिक्षक कार्यालय[^,]+,\s*([^\n.]+)/);
      if (locationMatch && locationMatch[1]) {
        result.receivedByOffice = locationMatch[1].trim();
        console.log('Found received by office:', result.receivedByOffice);
      }
      
      const typeMatch = text.match(/अर्ज प्रकार\s*\|\s*([^\|\n]+)/);
      if (typeMatch && typeMatch[1]) {
        result.letterType = typeMatch[1].trim();
        console.log('Found letter type:', result.letterType);
      }
      
      if (Object.keys(result).length === 0) {
        console.warn('No fields matched with primary patterns, trying alternatives');
        
        const tableMatch = text.match(/\|([^\n]+)\|/g);
        if (tableMatch) {
          console.log('Found table data:', tableMatch);
          const rows = text.split('\n').filter(line => line.includes('|'));
          if (rows.length > 1) {
            const cells = rows[1].split('|').map(cell => cell.trim()).filter(Boolean);
            if (cells.length >= 3) {
              result.referenceNumber = cells[0] || '';
              result.letterType = cells[1] || '';
              console.log('Extracted from table row:', { referenceNumber: result.referenceNumber, letterType: result.letterType });
            }
          }
        }
      }
      
      console.log('Final parsed result:', result);
      return result;
      
    } catch (error) {
      console.error('Error parsing extracted text:', error);
      return {};
    }
  };

  // Function to map API response to form fields
  const mapApiResponseToForm = (data) => {
    const formUpdates = {};
    const extractedData = data.extractedData || data.file?.extractedData || data;
    
    if (extractedData.receivedByOffice) {
      formUpdates.receivedByOffice = extractedData.receivedByOffice;
    }
    
    const fieldMappings = {
      dateOfReceiptOfLetter: 'dateOfReceiptOfLetter',
      letterClassification: 'letterClassification',
      letterDate: 'letterDate',
      letterMedium: 'letterMedium',
      letterType: 'letterType',
      mobileNumber: 'mobileNumber',
      numberOfCopies: 'numberOfCopies',
      officeSendingLetter: 'officeSendingLetter',
      outwardLetterNumber: 'outwardLetterNumber',
      senderNameAndDesignation: 'senderNameAndDesignation',
      subject: 'subject'
    };
    
    Object.entries(fieldMappings).forEach(([apiField, formField]) => {
      if (extractedData[apiField]) {
        formUpdates[formField] = extractedData[apiField];
      }
    });
    
    if (data.file?.url) {
      formUpdates.fileUrl = data.file.url;
    }
    
    console.log('Mapped form updates:', formUpdates);
    
    setFormData(prev => ({
      ...prev,
      ...formUpdates
    }));
    
    return formUpdates;
  };

  // Function to extract text from file and auto-fill form fields
  const extractTextFromFile = async (file) => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      console.log('Sending file for text extraction:', file.name, file);
      
      const response = await fetch(`${apiUrl}/api/files/upload`, {
        method: 'POST',
        body: formData,
      });
      
      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
        if (responseData.file && responseData.file.id) {
          setMainFileId(responseData.file.id);
          console.log('Uploaded file ID:', responseData.file.id);
          
          // Get the file URL from the response or construct it
          const fileUrl = responseData.file.url || 
                         responseData.file.filePath || 
                         constructFileUrl(responseData.file.id, responseData.file.originalName);
          
          console.log('File URL:', fileUrl);
          
          // Fetch the actual file URL using the API
          const fileInfo = await getFileUrlFromId(responseData.file.id);
          const actualFileUrl = fileInfo ? fileInfo.url : fileUrl;
          
          setFormData(prev => ({
            ...prev,
            fileId: responseData.file.id,
            fileUrl: actualFileUrl
          }));
        }
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        throw new Error('Invalid response format from server');
      }
      
      const extractedData = responseData.extractedData || responseData.file?.extractedData;
      console.log('Extracted data:', extractedData);
      
      if (!extractedData) {
        console.log('No extracted data found, but file uploaded successfully');
        toast.success('File uploaded successfully');
        return;
      }

      // Helper function to safely convert date string to ISO format
      const convertDateToISO = (dateString) => {
        if (!dateString) return '';
        
        try {
          if (dateString.includes('/')) {
            const parts = dateString.split('/');
            if (parts.length === 3) {
              const [day, month, year] = parts;
              return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
          }
          
          if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateString;
          }
          
          const date = new Date(dateString);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
          
          return '';
        } catch (error) {
          console.error('Error converting date:', dateString, error);
          return '';
        }
      };

      // Helper function to normalize classification value to internal key
      const normalizeClassificationToKey = (value) => {
        if (!value) return '';
        
        const validKeys = [
          'senior_mail',
          'senior_application',
          'reference_letter',
          'other_mail',
          'other_application',
          'portal_application',
          'right_to_public_services_act_2015',
          'right_to_information',
        ];
        
        if (validKeys.includes(value)) {
          return value;
        }
        
        for (const lang of ['en', 'mr']) {
          const foundKey = Object.keys(letterClassificationMap[lang] || {}).find(
            key => letterClassificationMap[lang][key].toLowerCase() === value.toLowerCase()
          );
          if (foundKey) {
            return foundKey;
          }
        }
        
        const fallbackMap = {
          'senior mail': 'senior_mail',
          'senior application': 'senior_application',
          'reference letter': 'reference_letter',
          'other mail': 'other_mail',
          'other application': 'other_application',
          'portal application': 'portal_application',
          'right to public services act 2015': 'right_to_public_services_act_2015',
          'right to information':'right_to_information',
          'वरिष्ठ टपाल': 'senior_mail',
          'वरिष्ठ अर्ज': 'senior_application',
          'संदर्भ पत्र': 'reference_letter',
          'इतर टपाल': 'other_mail',
          'इतर अर्ज': 'other_application',
          'पोर्टल अर्ज': 'portal_application',
          'लोकसेवा हक्क अधिनियम २०१५': 'right_to_public_services_act_2015',
          'माहिती अधिकार':'right_to_information'
        };
        
        const normalizedValue = fallbackMap[value.toLowerCase()] || fallbackMap[value];
        console.log('Normalizing classification:', { input: value, output: normalizedValue });
        return normalizedValue || value;
      };

      // Map only the specific fields from extracted data
      const formUpdates = {
        dateOfReceiptOfLetter: convertDateToISO(extractedData.dateOfReceiptOfLetter),
        letterClassification: normalizeClassificationToKey(extractedData.letterClassification),
        letterDate: convertDateToISO(extractedData.letterDate),
        letterMedium: extractedData.letterMedium || '',
        letterType: extractedData.letterType || '',
        mobileNumber: extractedData.mobileNumber || '',
        numberOfCopies: extractedData.numberOfCopies || '',
        officeSendingLetter: extractedData.officeSendingLetter || '',
        outwardLetterNumber: extractedData.outwardLetterNumber || '',
        senderNameAndDesignation: extractedData.senderNameAndDesignation || '',
        subject: extractedData.subject || '',
        fileId: responseData.file.id
      };
      
      const statusMap = {
        'pending': 'received',
        'in_progress': 'received',
        'completed': 'closed',
        'rejected': 'return',
        'returned': 'return_received',
        'acknowledged': 'acknowledged',
        'forwarded': 'forwarded',
        'recall': 'recall'
      };
      
      formUpdates.letterStatus = statusMap[extractedData.letterStatus?.toLowerCase()] || 'received';
      
      console.log('Mapped form updates:', formUpdates);
      
      setFormData(prev => ({
        ...prev,
        ...formUpdates
      }));
      
      toast.success('Form fields updated from extracted data');
      return;
      
    } catch (error) {
      console.error('Error in extractTextFromFile:', error);
      toast.error(`Error processing file: ${error.message}`);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle additional attachments upload
  const handleAdditionalFilesChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setAdditionalFiles(prevFiles => [...prevFiles, ...selectedFiles]);
  };
  
  // Remove additional file
  const removeAdditionalFile = (index) => {
    setAdditionalFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };
  
  // Get language from context
  const { language: currentLanguage } = useLanguage();
  const t = translations[currentLanguage] || translations['en'];

  // Helper function to get Marathi table names
  const getMarathiTableName = (englishLabel) => {
    const marathiMap = {
      'DG Table': 'डीजी टेबल',
      'IG Table': 'आयजी टेबल', 
      'SP Table': 'एसपी टेबल',
      'Collector Table': 'कलेक्टर टेबल',
      'Home Table': 'होम टेबल',
      'Shanik Table': 'शैक्षणिक टेबल',
    };
    return marathiMap[englishLabel] || englishLabel;
  };
  
  // Effect to handle language changes and update display values
  useEffect(() => {
    if (formData.letterClassification) {
      setFormData(prev => ({ ...prev }));
    }
  }, [currentLanguage]);

  // Fetch forward-to options on component mount
  useEffect(() => {
    const fetchForwardToOptions = async () => {
      try {
        const token = sessionStorage.getItem('token');
        const response = await axios.get(`${apiUrl}/api/patras/forward-to-options`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.data.success) {
          setForwardToOptions(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching forward-to options:', error);
        // Set default options if API fails
        setForwardToOptions([
          { value: 'dg', label: 'DG Table' },
          { value: 'ig', label: 'IG Table' },
          { value: 'sp', label: 'SP Table' },
          { value: 'dm', label: 'DM Table' },
          { value: 'home', label: 'Home Table' },
          { value: 'shanik', label: 'Local Table' }
        ]);
      }
    };

    fetchForwardToOptions();
  }, []);
  
  // Letter classification mapping for consistent language support
  const letterClassificationMap = {
    en: {
      'senior_mail': 'senior_mail',
      'senior_application': 'senior_application',
      'reference_letter': 'reference_letter',
      'other_mail': 'other_mail',
      'other_application': 'other_application',
      'portal_application': 'portal_application',
      'right_to_public_services_act_2015': 'right_to_public_services_act_2015',
      'right_to_information':'right_to_information',
    },
    mr: {
      'senior_mail' :'वरिष्ठ टपाल',
      'senior_application' : 'वरिष्ठ अर्ज',
      'reference_letter': 'संदर्भ पत्र',
      'other_mail': 'इतर टपाल',
      'other_application':'इतर अर्ज',
      'portal_application': 'पोर्टल अर्ज',
      'right_to_public_services_act_2015': 'लोकसेवा हक्क अधिनियम २०१५',
      'right_to_information'  : 'माहिती अधिकार'
    }
  };

  // Updated letterTypeOptionsMap with consistent keys
  const letterTypeOptionsMap = {
    'senior_mail': [
      { value: t.senior_post_dgp, label: t.senior_post_dgp },
      { value: t.senior_post_govt_maharashtra, label: t.senior_post_govt_maharashtra },
      { value: t.senior_post_igp, label: t.senior_post_igp },
      { value: t.senior_post_addl_dgp, label: t.senior_post_addl_dgp },
      { value: t.senior_post_accountant_general, label: t.senior_post_accountant_general },
      { value: t.senior_post_accountant_general_office, label: t.senior_post_accountant_general_office },
      { value: t.senior_post_director_pay_verification, label: t.senior_post_director_pay_verification },
      { value: t.senior_post_police_commissioner, label: t.senior_post_police_commissioner },
      { value: t.senior_post_divisional_commissioner, label: t.senior_post_divisional_commissioner },
      { value: t.senior_post_sp, label: t.senior_post_sp },
      { value: t.senior_post_sdpo, label: t.senior_post_sdpo },
    ],
    'senior_application': [
      { value: t.senior_application_dgp, label: t.senior_application_dgp },
      { value: t.senior_application_govt_maharashtra, label: t.senior_application_govt_maharashtra },
      { value: t.senior_application_igp, label: t.senior_application_igp },
      { value: t.senior_application_addl_dgp, label: t.senior_application_addl_dgp },
      { value: t.senior_application_police_commissioner, label: t.senior_application_police_commissioner },
      { value: t.senior_application_divisional_commissioner, label: t.senior_application_divisional_commissioner },
    ],
    'reference_letter': [
      { value: t.semi_governmental_reference, label: t.semi_governmental_reference },
      { value: t.aaple_sarkar_reference, label: t.aaple_sarkar_reference },
      { value: t.mla_reference, label: t.mla_reference },
      { value: t.dist_police_superintendent_reference, label: t.dist_police_superintendent_reference },
      { value: t.mp_reference, label: t.mp_reference },
      { value: t.district_collector_reference, label: t.district_collector_reference },
      { value: t.complaint, label: t.complaint },
      { value: t.bill_reference, label: t.bill_reference },
      { value: t.judicial_reference, label: t.judicial_reference },
      { value: t.file_reference, label: t.file_reference },
      { value: t.circular, label: t.circular },
      { value: t.minister_reference, label: t.minister_reference },
      { value: t.mayor_official_corporator, label: t.mayor_official_corporator },
      { value: t.human_rights_reference, label: t.human_rights_reference },
      { value: t.lokayukta_uplokayukta_reference, label: t.lokayukta_uplokayukta_reference },
      { value: t.lokshahi_din_reference, label: t.lokshahi_din_reference },
      { value: t.assembly_question_starred_unstarred, label: t.assembly_question_starred_unstarred },
      { value: t.divisional_commissioner_reference, label: t.divisional_commissioner_reference },
      { value: t.government_letter, label: t.government_letter },
      { value: t.government_reference, label: t.government_reference },
    ],
    
  
    'other_mail': [
      // Main Categories
      { value: 'other_mail_confidential', label: t.other_mail_confidential },
      { value: 'other_mail_sanction_offence', label: t.other_mail_sanction_offence },
      { value: 'other_mail_deficiency', label: t.other_mail_deficiency },
      { value: 'other_mail_hospital_record', label: t.other_mail_hospital_record },
      { value: 'other_mail_accumulated_leave', label: t.other_mail_accumulated_leave },
      { value: 'other_mail_parole_leave', label: t.other_mail_parole_leave },
      { value: 'other_mail_weekly_diary', label: t.other_mail_weekly_diary },
      { value: 'other_mail_daily_check', label: t.other_mail_daily_check },
      { value: 'other_mail_fingerprint', label: t.other_mail_fingerprint },
      { value: 'other_mail_medical_bill', label: t.other_mail_medical_bill },
      { value: 'other_mail_tenant_verification', label: t.other_mail_tenant_verification },
      { value: 'other_mail_leave_sanction', label: t.other_mail_leave_sanction },
      { value: 'other_mail_warrant', label: t.other_mail_warrant },
      { value: 'other_mail_explanation_absence', label: t.other_mail_explanation_absence },
      { value: 'other_mail_death_summary_approval', label: t.other_mail_death_summary_approval },
      { value: 'other_mail_viscera', label: t.other_mail_viscera },
      
      // Departmental and Orders
      { value: 'other_mail_departmental_inquiry', label: t.other_mail_departmental_inquiry },
      { value: 'other_mail_final_order', label: t.other_mail_final_order },
      
      // Police and Administration
      { value: 'other_mail_district_police_press_release', label: t.other_mail_district_police_press_release },
      { value: 'other_mail_license', label: t.other_mail_license },
      { value: 'other_mail_office_inspection', label: t.other_mail_office_inspection },
      { value: 'other_mail_vip_visit', label: t.other_mail_vip_visit },
      { value: 'other_mail_settlement', label: t.other_mail_settlement },
      { value: 'other_mail_reward_punishment', label: t.other_mail_reward_punishment },
      { value: 'other_mail_charge_officer_order', label: t.other_mail_charge_officer_order },
      { value: 'other_mail_do', label: t.other_mail_do },
      
      // Cyber and Technical
      { value: 'other_mail_cyber', label: t.other_mail_cyber },
      { value: 'other_mail_cdr', label: t.other_mail_cdr },
      { value: 'other_mail_caf', label: t.other_mail_caf },
      { value: 'other_mail_sdr', label: t.other_mail_sdr },
      { value: 'other_mail_imei', label: t.other_mail_imei },
      { value: 'other_mail_dump_data', label: t.other_mail_dump_data },
      { value: 'other_mail_it_act', label: t.other_mail_it_act },
      { value: 'other_mail_facebook', label: t.other_mail_facebook },
      { value: 'other_mail_online_fraud', label: t.other_mail_online_fraud },
      { value: 'other_mail_self_immolation', label: t.other_mail_self_immolation },
      { value: 'other_mail_human_rights', label: t.other_mail_human_rights },
      { value: 'other_mail_pcr', label: t.other_mail_pcr },
      
      // Typist and Technical
      { value: 'other_mail_steno', label: t.other_mail_steno },
      { value: 'other_mail_typist', label: t.other_mail_typist },
      { value: 'other_mail_cdr_sdr_caf', label: t.other_mail_cdr_sdr_caf },
      
      // Senior Mail
      { value: 'other_mail_senior_sp', label: t.other_mail_senior_sp },
      { value: 'other_mail_senior_sdpo', label: t.other_mail_senior_sdpo },
      
      // A-Class
      { value: 'other_mail_a_class_pm', label: t.other_mail_a_class_pm },
      { value: 'other_mail_a_class_cm', label: t.other_mail_a_class_cm },
      { value: 'other_mail_a_class_deputy_cm', label: t.other_mail_a_class_deputy_cm },
      { value: 'other_mail_a_class_home_minister', label: t.other_mail_a_class_home_minister },
      { value: 'other_mail_a_class_mos_home', label: t.other_mail_a_class_mos_home },
      { value: 'other_mail_a_class_guardian_minister', label: t.other_mail_a_class_guardian_minister },
      { value: 'other_mail_a_class_union_minister', label: t.other_mail_a_class_union_minister },
      { value: 'other_mail_a_class_mp', label: t.other_mail_a_class_mp },
      { value: 'other_mail_a_class_mla', label: t.other_mail_a_class_mla },
      { value: 'other_mail_a_class_other', label: t.other_mail_a_class_other },
      
      // Other Categories
      { value: 'other_mail_general', label: t.other_mail_general },
      { value: 'other_mail_treasury', label: t.other_mail_treasury },
      { value: 'other_mail_commandant', label: t.other_mail_commandant },
      { value: 'other_mail_principal_ptc', label: t.other_mail_principal_ptc },
      { value: 'other_mail_c_class_commissioner', label: t.other_mail_c_class_commissioner },
      { value: 'other_mail_application_report', label: t.other_mail_application_report },
      { value: 'other_mail_appeal', label: t.other_mail_appeal },
      { value: 'other_mail_in_service_training', label: t.other_mail_in_service_training },
      { value: 'other_mail_building_branch', label: t.other_mail_building_branch },
      { value: 'other_mail_pension', label: t.other_mail_pension },
      { value: 'other_mail_vehicle_license', label: t.other_mail_vehicle_license },
      { value: 'other_mail_payments', label: t.other_mail_payments },
      { value: 'other_mail_lapses_case', label: t.other_mail_lapses_case },
      { value: 'other_mail_pay_fixation', label: t.other_mail_pay_fixation },
      { value: 'other_mail_transfer', label: t.other_mail_transfer },
    ],
    
    'other_application': [
      // Main Categories
      { value: t.other_application_general, label: t.other_application_general },
      { value: t.other_application_local, label: t.other_application_local },
      { value: t.other_application_anonymous, label: t.other_application_anonymous },
      { value: t.other_application_district_soldier, label: t.other_application_district_soldier },
      { value: t.other_application_moneylender_reference, label: t.other_application_moneylender_reference },
      { value: t.other_application_lokshahi_reference, label: t.other_application_lokshahi_reference },
      { value: t.other_application_confidential, label: t.other_application_confidential },
      
      // B Class Applications
      { value: t.other_application_b_class_sp_ahmednagar, label: t.other_application_b_class_sp_ahmednagar },
      { value: t.other_application_b_class_upper_sp_ahmednagar, label: t.other_application_b_class_upper_sp_ahmednagar },
      
      // C Class Applications
      { value: t.other_application_c_class_commissioner, label: t.other_application_c_class_commissioner },
      { value: t.other_application_c_class_district_collector, label: t.other_application_c_class_district_collector },
      { value: t.other_application_c_class_sdpo_shrirampur, label: t.other_application_c_class_sdpo_shrirampur },
      { value: t.other_application_c_class_sdpo_karjat, label: t.other_application_c_class_sdpo_karjat },
      { value: t.other_application_c_class_sdpo_shirdi, label: t.other_application_c_class_sdpo_shirdi },
      { value: t.other_application_c_class_sdpo_shevgaon, label: t.other_application_c_class_sdpo_shevgaon },
      { value: t.other_application_c_class_all_police_stations, label: t.other_application_c_class_all_police_stations },
      { value: t.other_application_c_class_all_branches, label: t.other_application_c_class_all_branches },
      { value: t.other_application_c_class_sainik_board, label: t.other_application_c_class_sainik_board },
      { value: t.other_application_c_class_senior_army_officer, label: t.other_application_c_class_senior_army_officer },
      { value: t.other_application_c_class_lokshahi_din, label: t.other_application_c_class_lokshahi_din },
      { value: t.other_application_c_class_sdpo_nagar_city, label: t.other_application_c_class_sdpo_nagar_city },
      { value: t.other_application_c_class_sdpo_nagar_taluka, label: t.other_application_c_class_sdpo_nagar_taluka },
      { value: t.other_application_c_class_sdpo_sangamner, label: t.other_application_c_class_sdpo_sangamner },
    ],


    'right_to_public_services_act_2015': [
      { value: t.right_to_public_services_act_2015_arms_license, label: t.right_to_public_services_act_2015_arms_license },
      { value: t.right_to_public_services_act_2015_character_verification, label: t.right_to_public_services_act_2015_character_verification },
      { value: t.right_to_public_services_act_2015_loudspeaker_license, label: t.right_to_public_services_act_2015_loudspeaker_license },
      { value: t.right_to_public_services_act_2015_entertainment_noc, label: t.right_to_public_services_act_2015_entertainment_noc },
      { value: t.right_to_public_services_act_2015_assembly_procession_permission, label: t.right_to_public_services_act_2015_assembly_procession_permission },
      { value: t.right_to_public_services_act_2015_gas_petrol_hotel_bar_noc, label: t.right_to_public_services_act_2015_gas_petrol_hotel_bar_noc },
      { value: t.right_to_public_services_act_2015_joint_bandobast, label: t.right_to_public_services_act_2015_joint_bandobast },
      { value: t.right_to_public_services_act_2015_security_agency, label: t.right_to_public_services_act_2015_security_agency },
      { value: t.right_to_public_services_act_2015_explosive_license, label: t.right_to_public_services_act_2015_explosive_license },
      { value: t.right_to_public_services_act_2015_devsthan_c_class, label: t.right_to_public_services_act_2015_devsthan_c_class },
      { value: t.right_to_public_services_act_2015_devsthan_b_class, label: t.right_to_public_services_act_2015_devsthan_b_class },
      { value: t.right_to_public_services_act_2015_other_licenses, label: t.right_to_public_services_act_2015_other_licenses },
    ],

    'other_application': [
      // Main Categories
      { value: t.other_application_general, label: t.other_application_general },
      { value: t.other_application_local, label: t.other_application_local },
      { value: t.other_application_anonymous, label: t.other_application_anonymous },
      { value: t.other_application_district_serviceman || t.other_application_district_soldier, label: t.other_application_district_serviceman || t.other_application_district_soldier },
      { value: t.other_application_moneylending_related || t.other_application_moneylender_reference, label: t.other_application_moneylending_related || t.other_application_moneylender_reference },
      { value: t.other_application_lokshahi_related || t.other_application_lokshahi_reference, label: t.other_application_lokshahi_related || t.other_application_lokshahi_reference },
      { value: t.other_application_confidential, label: t.other_application_confidential },
      
      // B Class Applications
      { value: t.other_application_b_class_sp_ahmednagar, label: t.other_application_b_class_sp_ahmednagar },
      { value: t.other_application_b_class_upper_sp_ahmednagar, label: t.other_application_b_class_upper_sp_ahmednagar },
      
      // C Class Applications
      { value: t.other_application_c_class_commissioner, label: t.other_application_c_class_commissioner },
      { value: t.other_application_c_class_district_collector, label: t.other_application_c_class_district_collector },
      { value: t.other_application_c_class_sdpo_shrirampur, label: t.other_application_c_class_sdpo_shrirampur },
      { value: t.other_application_c_class_sdpo_karjat, label: t.other_application_c_class_sdpo_karjat },
      { value: t.other_application_c_class_sdpo_shirdi, label: t.other_application_c_class_sdpo_shirdi },
      { value: t.other_application_c_class_sdpo_shevgaon, label: t.other_application_c_class_sdpo_shevgaon },
      { value: t.other_application_c_class_all_police_stations, label: t.other_application_c_class_all_police_stations },
      { value: t.other_application_c_class_all_branches, label: t.other_application_c_class_all_branches },
      { value: t.other_application_c_class_sainik_board, label: t.other_application_c_class_sainik_board },
      { value: t.other_application_c_class_senior_army_officer, label: t.other_application_c_class_senior_army_officer },
      { value: t.other_application_c_class_lokshahi_din, label: t.other_application_c_class_lokshahi_din },
      { value: t.other_application_c_class_sdpo_nagar_city, label: t.other_application_c_class_sdpo_nagar_city },
      { value: t.other_application_c_class_sdpo_nagar_taluka, label: t.other_application_c_class_sdpo_nagar_taluka },
      { value: t.other_application_c_class_sdpo_sangamner, label: t.other_application_c_class_sdpo_sangamner },
    ],
    'portal_application': [
      { value: t.portal_application_pm_pg, label: t.portal_application_pm_pg },
      { value: t.portal_application_aaple_sarkar, label: t.portal_application_aaple_sarkar },
      { value: t.portal_application_homd, label: t.portal_application_homd },
    ],
    'right_to_information': [
      { value: t.right_to_information, label: t.right_to_information },
    ],
  };


  // Function to get branch name in current language
  const getBranchName = (branchKey) => {
    if (currentLanguage === 'mr' && translations.branch_data[branchKey]) {
      return translations.branch_data[branchKey];
    }
    return branchKey.split('_').map(word => {
      if (word.toLowerCase() === 'ps') return 'PS';
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  };

  const [formData, setFormData] = useState({
    officeSendingLetter: '',
    senderNameAndDesignation: '',
    outwardLetterNumber: '',
    numberOfCopies: '',
    mobileNumber: '',
    letterMedium: '',
    letterClassification: '',
    letterType: '',
    dateOfReceiptOfLetter: '',
    letterDate: '',
    remarks: '',
    subject: '',
    forwardTo: '',
    fileId: '',
    fileUrl: '',
    na: false,
    nar: false
  });
  
  // State to track if we're processing files
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forwardToOptions, setForwardToOptions] = useState([]);

  // Helper function to get display value for classification
  const getClassificationDisplayValue = (key) => {
    if (!key) return '';
    if (letterClassificationMap[currentLanguage] && letterClassificationMap[currentLanguage][key]) {
      return letterClassificationMap[currentLanguage][key];
    }
    if (letterClassificationMap['en'] && letterClassificationMap['en'][key]) {
      return letterClassificationMap['en'][key];
    }
    for (const lang of ['mr', 'en']) {
      const foundKey = Object.keys(letterClassificationMap[lang] || {}).find(
        mapKey => letterClassificationMap[lang][mapKey] === key
      );
      if (foundKey && letterClassificationMap[currentLanguage] && letterClassificationMap[currentLanguage][foundKey]) {
        return letterClassificationMap[currentLanguage][foundKey];
      }
    }
    return key;
  };

  // Updated handleChange to properly handle classification changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
      return;
    }
    
    if (name === 'letterClassification') {
      let selectedKey = null;
      
      selectedKey = Object.keys(letterClassificationMap[currentLanguage] || {}).find(
        key => letterClassificationMap[currentLanguage][key] === value
      );
      
      if (!selectedKey) {
        const otherLang = currentLanguage === 'mr' ? 'en' : 'mr';
        selectedKey = Object.keys(letterClassificationMap[otherLang] || {}).find(
          key => letterClassificationMap[otherLang][key] === value
        );
      }
      
      if (!selectedKey) {
        const directMapping = {
          'वरिष्ठ टपाल': 'senior_mail',
          'senior mail': 'senior_mail',
          'वरिष्ठ अर्ज': 'senior_application',
          'senior application': 'senior_application',
          'संदर्भ पत्र': 'reference_letter',
          'reference letter': 'reference_letter',
          'इतर टपाल': 'other_mail',
          'other_mail': 'other_mail',
          'इतर अर्ज': 'other_application',
          'other application': 'other_application',
          'पोर्टल अर्ज': 'portal_application',
          'portal application': 'portal_application',
          'लोकसेवा हक्क अधिनियम २०१५': 'right_to_public_services_act_2015',
          'right to public services act 2015': 'right_to_public_services_act_2015',
          'माहिती अधिकार':'right_to_information',
          'right_to_information':'right_to_information',
        };
        selectedKey = directMapping[value];
      }
      
      console.log('Classification selection:', { 
        value, 
        selectedKey, 
        currentLanguage,
        mappingCheck: letterClassificationMap[currentLanguage]
      });
      
      setFormData(prev => ({
        ...prev,
        [name]: selectedKey || value,
        letterType: ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // File Preview Component
  const FilePreviewSection = () => {
    if (!formData.fileId && !formData.fileUrl) return null;
    
    return (
      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
        <h4 className="text-sm font-semibold text-green-800 mb-2">
          {currentLanguage === 'mr' ? 'अपलोड केलेली फाइल' : 'Uploaded File'}
        </h4>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <FiPaperclip className="text-green-600" />
            <span className="text-sm text-green-700">
              {currentLanguage === 'mr' ? 'फाइल ID:' : 'File ID:'} {formData.fileId}
            </span>
          </div>
          
          {formData.fileId && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (formData.fileUrl) {
                    window.open(formData.fileUrl, '_blank');
                  } else {
                    previewFileById(formData.fileId);
                  }
                }}
                className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 transition-colors flex items-center gap-1"
              >
                <FiEye className="h-3 w-3" />
                {currentLanguage === 'mr' ? 'पूर्वावलोकन' : 'Preview'}
              </button>
              <button
                type="button"
                onClick={() => downloadFileById(formData.fileId)}
                className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <FiDownload className="h-3 w-3" />
                {currentLanguage === 'mr' ? 'डाउनलोड' : 'Download'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
  
    try {
      if (!mainFileId && !formData.fileId) {
        console.error('❌ No fileId found! Did you upload first?');
        toast.error('Please upload a file first');
        return;
      }

      if (!userId || !userInfo) {
        console.error('❌ No user found! User might not be logged in.');
        toast.error('Please log in first');
        return;
      }

      // Helper function to get the display value for submission based on current language
      const getSubmissionValue = (field, value) => {
        if (field === 'letterClassification') {
          return getClassificationDisplayValue(value);
        }
        if (field === 'letterMedium') {
          const mediumMap = {
            'hard_copy': currentLanguage === 'mr' ? 'हार्ड कॉपी' : 'Hard Copy',
            'soft_copy': currentLanguage === 'mr' ? 'सॉफ्ट कॉपी' : 'Soft Copy',
            'soft_copy_and_hard_copy': currentLanguage === 'mr' ? 'सॉफ्ट कॉपी आणि हार्ड कॉपी' : 'Soft Copy and Hard Copy'
          };
          return mediumMap[value] || value;
        }
        return value;
      };

      const fileIdToUse = formData.fileId || mainFileId;
      
      // Create JSON payload instead of FormData
      const jsonPayload = {
        dateOfReceiptOfLetter: formData.dateOfReceiptOfLetter,
        officeSendingLetter: formData.officeSendingLetter,
        senderNameAndDesignation: formData.senderNameAndDesignation,
        mobileNumber: formData.mobileNumber,
        letterMedium: getSubmissionValue('letterMedium', formData.letterMedium),
        letterClassification: getSubmissionValue('letterClassification', formData.letterClassification),
        letterType: formData.letterType,
        letterDate: formData.letterDate,
        subject: formData.subject,
        outwardLetterNumber: formData.outwardLetterNumber,
        numberOfCopies: parseInt(formData.numberOfCopies) || 0,
        letterStatus: 'sending for head sign',  // Updated status to match expected format
        forwardTo: formData.forwardTo,
        NA: formData.na,
        NAR: formData.nar,
        userId: userId,
        fileId: fileIdToUse
      };
      
      console.log('Submitting with userId:', userId, 'and fileId:', fileIdToUse);
      console.log('JSON payload being submitted:', jsonPayload);

      const response = await fetch(`${apiUrl}/api/patras`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        },
        body: JSON.stringify(jsonPayload)
      });
      
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        console.error('Response text:', responseText);
        throw new Error('Server returned invalid JSON response');
      }
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Something went wrong');
      }
      
      toast.success(t.letterSubmitted || 'Letter submitted successfully');
      console.log('Reference Number:', data.referenceNumber);
      
      // Reset form
      setFormData({
        officeSendingLetter: '',
        senderNameAndDesignation: '',
        outwardLetterNumber: '',
        numberOfCopies: '',
        mobileNumber: '',
        letterMedium: '',
        letterClassification: '',
        letterType: '',
        dateOfReceiptOfLetter: '',
        letterDate: '',
        remarks: '',
        subject: '',
        forwardTo: '',
        fileId: '',
        fileUrl: '',
        na: false,
        nar: false
      });
      setMainFiles([]);
      setAdditionalFiles([]);
      setMainFileId(null);
      
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error(error.message || t.submitError || 'Error submitting form');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-blue-100/60">
          <div className="flex flex-col items-center gap-6 p-8 bg-white bg-opacity-90 rounded-2xl shadow-2xl border border-blue-200">
            <div className="relative flex items-center justify-center">
              <span className="block w-20 h-20 border-4 border-blue-400 border-t-blue-700 border-b-blue-200 rounded-full animate-spin"></span>
              <span className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-500 opacity-80" fill="none" viewBox="0 0 24 24">
                  <path d="M12 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 18v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M4.93 4.93l2.83 2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M16.24 16.24l2.83 2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M2 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M18 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M4.93 19.07l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <span className="text-xl font-semibold text-blue-800 text-center drop-shadow">
              {currentLanguage === 'mr' ? 'फाइल प्रक्रिया व फील्ड मॅपिंग सुरू आहे...' : 'Processing file and mapping fields...'}
            </span>
          </div>
        </div>
      )}
      
      {/* Main content */}
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-blue-100">
        <h2 className="text-3xl font-bold text-blue-700 mb-8 flex items-center gap-2">
          <FiPaperclip className="text-blue-500 text-3xl" /> {t.newLetter}
        </h2>
        {/* File Upload Section */}
        <div className="mb-10">
          <div className="border-2 border-dashed border-blue-300 rounded-2xl p-8 text-center bg-blue-50 hover:border-blue-500 transition-colors">
            <div className="flex flex-col items-center justify-center py-6">
              <FiUpload className="w-14 h-14 text-blue-400 mb-3 animate-bounce" />
              <h3 className="text-xl font-semibold text-blue-700 mb-1">{t.uploadLetter}</h3>
              <p className="text-sm text-blue-500 mb-4">{t.dragAndDrop}</p>
              <label className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors font-semibold shadow">
                {t.selectFiles}
                <input 
                  type="file" 
                  className="hidden" 
                  multiple
                  onChange={handleMainFileChange}
                />
              </label>
            </div>
            
            {mainFiles.length > 0 && (
              <div className="mt-4 flex flex-col gap-3">
                {mainFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-white border border-blue-200 rounded-xl shadow-sm px-4 py-2 transition hover:shadow-md"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FiPaperclip className="text-blue-400 flex-shrink-0" />
                      <span className="text-sm text-blue-900 font-medium truncate max-w-[220px]">{file.name}</span>
                      {(formData.fileId || mainFileId) && (
                        <span className="ml-2 px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 font-semibold">
                          Uploaded ✓ (ID: {formData.fileId || mainFileId})
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="ml-4 text-blue-400 hover:text-red-500 bg-blue-50 hover:bg-red-50 rounded-full p-1 transition"
                      onClick={() => {
                        setMainFiles([]);
                        setMainFileId(null);
                        setFormData(prev => ({ ...prev, fileId: '', fileUrl: '' }));
                      }}
                      title={t.remove}
                    >
                      <FiX />
                    </button>
                  </div>
                ))}
                
                {/* File Preview Section */}
                <FilePreviewSection />
              </div>
            )}
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-blue-900">{t.receivedByOffice || "Office Sending Letter"}</label>
              <input
                type="text"
                name="officeSendingLetter"
                value={formData.officeSendingLetter}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder-gray-400 bg-white hover:border-blue-300"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-blue-900">{t.recipientName || "Sender Name and Designation"}</label>
              <input
                type="text"
                name="senderNameAndDesignation"
                value={formData.senderNameAndDesignation}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder-gray-400 bg-white hover:border-blue-300"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-blue-900">{t.outward_letter_no}</label>
              <input
                type="text"
                name="outwardLetterNumber"
                value={formData.outwardLetterNumber}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder-gray-400 bg-white hover:border-blue-300"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-blue-900">{t.no_of_documents}</label>
              <input
                type="text"
                name="numberOfCopies"
                value={formData.numberOfCopies}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder-gray-400 bg-white hover:border-blue-300"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-blue-900">{t.mobileNumber}</label>
              <input
                type="tel"
                name="mobileNumber"
                value={formData.mobileNumber}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder-gray-400 bg-white hover:border-blue-300"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-blue-900">{t.letterMedium}</label>
              <select
                name="letterMedium"
                value={formData.letterMedium}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white hover:border-blue-300"
              >
                <option value="">{t.selectMedium}</option>
                <option value="hard_copy">{t.hard_copy}</option>
                <option value="soft_copy">{t.soft_copy}</option>
                <option value="soft_copy_and_hard_copy">{t.soft_copy_and_hard_copy}</option>
              </select>
            </div>
            
            {/* Letter Classification Field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-blue-900">{t.letterClassification}</label>
              <select
                name="letterClassification"
                value={formData.letterClassification ? getClassificationDisplayValue(formData.letterClassification) : ''}
                onChange={handleChange}
                className="w-full min-h-[44px] px-4 py-2 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white hover:border-blue-400 appearance-auto text-blue-900"
              >
                <option value="" disabled hidden>{t.select_category || 'Select Category'}</option>
                <option value={letterClassificationMap[currentLanguage]['senior_mail']}>{t.senior_mail}</option>
                <option value={letterClassificationMap[currentLanguage]['senior_application']}>{t.senior_application}</option>
                <option value={letterClassificationMap[currentLanguage]['reference_letter']}>{t.reference_letter}</option>
                <option value={letterClassificationMap[currentLanguage]['other_mail']}>{t.other_mail}</option>
                <option value={letterClassificationMap[currentLanguage]['other_application']}>{t.other_application}</option>
                <option value={letterClassificationMap[currentLanguage]['portal_application']}>{t.portal_application}</option>
                <option value={letterClassificationMap[currentLanguage]['right_to_public_services_act_2015']}>{t.right_to_public_services_act_2015}</option>
                <option value={letterClassificationMap[currentLanguage]['right_to_information']}>{t.right_to_information}</option>
              </select>
            </div>
            
            {/* Letter Type Field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-blue-900">{t.letterType}</label>
              <select
                name="letterType"
                value={formData.letterType}
                onChange={handleChange}
                className="w-full min-h-[44px] px-4 py-2 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white hover:border-blue-400 appearance-auto text-blue-900"
              >
                <option value="" disabled hidden>{t.selectType || 'Select Type'}</option>
                {(letterTypeOptionsMap[formData.letterClassification] || []).map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>


            
            {/* Date Fields */}
            <div className="space-y-2 w-full">
              <label className="block text-sm font-semibold text-blue-900">{t.date_of_receipt_of_the_letter}</label>
              <div className="w-full">
                <DatePicker
                  selected={formData.dateOfReceiptOfLetter ? parseISO(formData.dateOfReceiptOfLetter) : null}
                  onChange={(date) => handleChange({
                    target: {
                      name: "dateOfReceiptOfLetter",
                      value: date ? format(date, "yyyy-MM-dd") : ""
                    }
                  })}
                  dateFormat="MMMM d, yyyy"
                  className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white hover:border-blue-300"
                  showYearDropdown
                  dropdownMode="select"
                  wrapperClassName="w-full"
                />
              </div>
            </div>
            <div className="space-y-2 w-full">
              <label className="block text-sm font-semibold text-blue-900">{t.letterDate}</label>
              <div className="w-full">
                <DatePicker
                  selected={formData.letterDate ? parseISO(formData.letterDate) : null}
                  onChange={(date) => handleChange({
                    target: {
                      name: "letterDate",
                      value: date ? format(date, "yyyy-MM-dd") : ""
                    }
                  })}
                  dateFormat="MMMM d, yyyy"
                  className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white hover:border-blue-300"
                  showYearDropdown
                  dropdownMode="select"
                  wrapperClassName="w-full"
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-blue-900">{t.subject}</label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white hover:border-blue-300"
            />
          </div>

          {/* Na and Nar Checkbox Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="na"
                  name="na"
                  checked={formData.na || false}
                  onChange={handleChange}
                  className="w-5 h-5 text-blue-600 bg-white border-blue-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="na" className="text-sm font-semibold text-blue-900">
                  {currentLanguage === 'mr' ? 'NA' : 'NA'}
                </label>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="nar"
                  name="nar"
                  checked={formData.nar || false}
                  onChange={handleChange}
                  className="w-5 h-5 text-blue-600 bg-white border-blue-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="nar" className="text-sm font-semibold text-blue-900">
                  {currentLanguage === 'mr' ? 'NAR' : 'NAR'}
                </label>
              </div>
            </div>
          </div>

          {/* Forward To Field - Moderately Attractive */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5 shadow-sm">
            <div className="space-y-3">
              <label className="block text-sm font-bold text-blue-800 flex items-center gap-2">
                📋 {currentLanguage === 'mr' ? 'यांना पाठवा' : 'Forward To'}
              </label>
              <select
                name="forwardTo"
                value={formData.forwardTo}
                onChange={handleChange}
                className="w-full min-h-[46px] px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-500 outline-none transition-all bg-white hover:border-blue-400 text-blue-900 font-medium shadow-sm"
              >
                <option value="" disabled hidden>
                  {currentLanguage === 'mr' ? '-- टेबल निवडा --' : '-- Select Table --'}
                </option>
                {forwardToOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {currentLanguage === 'mr' ? getMarathiTableName(option.label) : option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="submit" 
              className="px-7 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 shadow transition-colors text-base flex items-center justify-center"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                  {currentLanguage === 'mr' ? 'कव्हरिंग लेटर तयार करत आहे...' : 'Creating covering letter...'}
                </>
              ) : (
                currentLanguage === 'mr' ? 'पत्र सबमिट करा' : 'Submit Letter'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewLetter;