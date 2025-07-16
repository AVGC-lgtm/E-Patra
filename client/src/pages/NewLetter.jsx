import { useState, useRef, useEffect } from 'react';
import { FiUpload, FiX, FiPaperclip } from 'react-icons/fi';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import translations from '../translations';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, parseISO } from "date-fns";


const NewLetter = () => {
  const [mainFiles, setMainFiles] = useState([]);
  const [additionalFiles, setAdditionalFiles] = useState([]);
  const [mainFileId, setMainFileId] = useState(null);
  
  // ADDED: Get user information from localStorage
  const [userId, setUserId] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  
  // ADDED: Get user information on component mount
  useEffect(() => {
    // Get user ID from localStorage
    const storedUserId = localStorage.getItem('userId');
    
    // Get complete user info object
    const storedUserInfo = localStorage.getItem('userInfo');
    
    if (storedUserId) {
      setUserId(parseInt(storedUserId)); // Convert to number to match backend expectation
      console.log('Found user ID:', storedUserId);
    }
    
    if (storedUserInfo) {
      try {
        const parsedUserInfo = JSON.parse(storedUserInfo);
        setUserInfo(parsedUserInfo);
        console.log('User info loaded:', parsedUserInfo);
      } catch (error) {
        console.error('Error parsing user info:', error);
      }
    }
    
    if (!storedUserId) {
      console.warn('No user ID found. User might not be logged in.');
    }
  }, []);
  
  // Handle main letter file upload
  const handleMainFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    setMainFiles(selectedFiles); // Replace existing files with new selection
    
    // If there are selected files, extract text from the first one
    if (selectedFiles.length > 0) {
      const file = selectedFiles[0];
      console.log('Processing file:', file.name);
      
      // Create a copy of the file for text extraction
      const fileCopy = new File([file], file.name, { type: file.type });
      
      // Start text extraction in the background
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
      
      // Extract reference number (अर्ज क्रमांक)
      const refMatch = text.match(/अर्ज क्रमांक[\s:-]*([^\s\n]+)/);
      if (refMatch && refMatch[1]) {
        result.referenceNumber = refMatch[1].trim();
        console.log('Found reference number:', result.referenceNumber);
      }
      
      // Extract date (दिनांक)
      const dateMatch = text.match(/दिनांक[\s:-]*([0-9/]+)/);
      if (dateMatch && dateMatch[1]) {
        result.letterDate = dateMatch[1].trim();
        console.log('Found date:', result.letterDate);
      }
      
      // Extract subject (विषय)
      const subjectMatch = text.match(/विषय[\s:-]*(.+?)(?=\n|$)/s);
      if (subjectMatch && subjectMatch[1]) {
        result.subject = subjectMatch[1].trim();
        console.log('Found subject:', result.subject);
      }
      
      // Extract office information (उ.वि.पो.अ./पो.नि/स.पो.नि./)
      const officeMatch = text.match(/उ\.वि\.पो\.अ\.\/पो\.नि\/स\.पो\.नि\.\/([^\n]+)/);
      if (officeMatch && officeMatch[1]) {
        result.office = officeMatch[1].trim();
        console.log('Found office:', result.office);
      }
      
     
      // Extract location (अहिल्यानगर)
      const locationMatch = text.match(/पोलीस अधिक्षक कार्यालय[^,]+,\s*([^\n.]+)/);
      if (locationMatch && locationMatch[1]) {
        result.receivedByOffice = locationMatch[1].trim();
        console.log('Found received by office:', result.receivedByOffice);
      }
      
      // Extract application type (अर्ज प्रकार)
      const typeMatch = text.match(/अर्ज प्रकार\s*\|\s*([^\|\n]+)/);
      if (typeMatch && typeMatch[1]) {
        result.letterType = typeMatch[1].trim();
        console.log('Found letter type:', result.letterType);
      }
      
      // If no fields were found, try alternative patterns
      if (Object.keys(result).length === 0) {
        console.warn('No fields matched with primary patterns, trying alternatives');
        
        // Try to find any table data
        const tableMatch = text.match(/\|([^\n]+)\|/g);
        if (tableMatch) {
          console.log('Found table data:', tableMatch);
          // Extract data from the first row after header if it exists
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
    
    // Handle nested extractedData if present
    const extractedData = data.extractedData || data.file?.extractedData || data;
    
    // Map each field from API response to form fields
    if (extractedData.receivedByOffice) {
      formUpdates.receivedByOffice = extractedData.receivedByOffice;
    }
    
 
    // Map only the specific fields from extracted data
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
    
    // Apply field mappings
    Object.entries(fieldMappings).forEach(([apiField, formField]) => {
      if (extractedData[apiField]) {
        formUpdates[formField] = extractedData[apiField];
      }
    });
    
    // If we have the file URL, we can use it for preview
    if (data.file?.url) {
      formUpdates.fileUrl = data.file.url;
    }
    
    console.log('Mapped form updates:', formUpdates);
    
    // Update form data with mapped fields
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
      
      const response = await fetch('http://localhost:5000/api/files/upload', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header, let the browser set it with the correct boundary
      });
      
      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      // Parse the response text as JSON
      let responseData;
      try {
        responseData = JSON.parse(responseText);
        if (responseData.file && responseData.file.id) {
          setMainFileId(responseData.file.id);
          console.log('Uploaded file ID:', responseData.file.id);
          
          // ADDED: Update form data with file ID
          setFormData(prev => ({
            ...prev,
            fileId: responseData.file.id
          }));
        }
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        throw new Error('Invalid response format from server');
      }
      
      // Log the extracted data for debugging
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
          // Handle DD/MM/YYYY format
          if (dateString.includes('/')) {
            const parts = dateString.split('/');
            if (parts.length === 3) {
              const [day, month, year] = parts;
              // Create date in YYYY-MM-DD format
              return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
          }
          
          // If it's already in YYYY-MM-DD format, return as is
          if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateString;
          }
          
          // Try to parse as Date object
          const date = new Date(dateString);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
          
          // Return empty string if parsing fails
          return '';
        } catch (error) {
          console.error('Error converting date:', dateString, error);
          return '';
        }
      };

      // Helper function to normalize classification value to internal key
      const normalizeClassificationToKey = (value) => {
        if (!value) return '';
        
        // If it's already an internal key, return it
        const validKeys = ['senior_mail', 'a_class', 'reference', 'c_class', 'direct_visit', 
                          'legal_and_administrative', 'cyber_technical', 'application', 
                          'license_and_permission', 'portal_application', 'others'];
        
        if (validKeys.includes(value)) {
          return value;
        }
        
        // Try to find the key by matching against display values in both languages
        for (const lang of ['en', 'mr']) {
          const foundKey = Object.keys(letterClassificationMap[lang] || {}).find(
            key => letterClassificationMap[lang][key].toLowerCase() === value.toLowerCase()
          );
          if (foundKey) {
            return foundKey;
          }
        }
        
        // Enhanced fallback map with all possible values
        const fallbackMap = {
          // English to internal keys
          'senior mail': 'senior_mail',
          'a class': 'a_class',
          'reference': 'reference',
          'c class': 'c_class',
          'direct visit': 'direct_visit',
          'legal and administrative': 'legal_and_administrative',
          'cyber technical': 'cyber_technical',
          'application': 'application',
          'license and permission': 'license_and_permission',
          'portal application': 'portal_application',
          'others': 'others',
          
          // Marathi to internal keys
          'वरिष्ठ टपाल': 'senior_mail',
          'अ वर्ग': 'a_class',
          'संदर्भ': 'reference',
          'क वर्ग': 'c_class',
          'व वर्ग': 'direct_visit',
          'कायदेशीर व प्रशासकीय': 'legal_and_administrative',
          'सायबर आणि तांत्रिक': 'cyber_technical',
          'अर्ज': 'application',
          'परवाने आणि परवानग्या': 'license_and_permission',
          'पोर्टल अर्ज': 'portal_application',
          'इतर': 'others'
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
        fileId: responseData.file.id // ADDED: Include file ID in updates
      };
      

      
      // Map letterStatus - convert to match form values
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
      
      // Update the form with the mapped data
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
  const t = translations[currentLanguage] || translations['en']; // Fallback to English
  
  // ADDED: Effect to handle language changes and update display values
  useEffect(() => {
    // When language changes, we need to ensure the form displays the correct values
    if (formData.letterClassification) {
      // Force a re-render by updating the state
      setFormData(prev => ({ ...prev }));
    }
  }, [currentLanguage]); // Re-run when language changes
  
  // FIXED: Letter classification mapping for consistent language support
  const letterClassificationMap = {
    en: {
      'senior_mail': 'senior mail',
      'a_class': 'a class', 
      'reference': 'reference',
      'c_class': 'c class',
      'direct_visit': 'direct visit',
      'legal_and_administrative': 'legal and administrative',
      'cyber_technical': 'cyber technical',
      'application': 'application',
      'license_and_permission': 'license and permission',
      'portal_application': 'portal application',
      'others': 'others'
    },
    mr: {
      'senior_mail': 'वरिष्ठ टपाल',
      'a_class': 'अ वर्ग',
      'reference': 'संदर्भ', 
      'c_class': 'क वर्ग',
      'direct_visit': 'व वर्ग',
      'legal_and_administrative': 'कायदेशीर व प्रशासकीय',
      'cyber_technical': 'सायबर आणि तांत्रिक',
      'application': 'अर्ज',
      'license_and_permission': 'परवाने आणि परवानग्या',
      'portal_application': 'पोर्टल अर्ज',
      'others': 'इतर'
    }
  };

  // FIXED: Updated letterTypeOptionsMap with consistent keys
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
    'a_class': [
      { value: t.category_a_pm, label: t.category_a_pm },
      { value: t.category_a_cm, label: t.category_a_cm },
      { value: t.category_a_deputy_cm, label: t.category_a_deputy_cm },
      { value: t.category_a_home_minister, label: t.category_a_home_minister },
      { value: t.category_a_mos_home, label: t.category_a_mos_home },
      { value: t.category_a_guardian_minister, label: t.category_a_guardian_minister },
      { value: t.category_a_union_minister, label: t.category_a_union_minister },
      { value: t.category_a_mp, label: t.category_a_mp },
      { value: t.category_a_mla, label: t.category_a_mla },
      { value: t.category_a_others, label: t.category_a_others },
    ],
    'reference': [
      { value: t.your_government_reference, label: t.your_government_reference },
      { value: t.mla_reference, label: t.mla_reference },
      { value: t.district_sp_reference, label: t.district_sp_reference },
      { value: t.mp_reference, label: t.mp_reference },
      { value: t.district_collector_reference, label: t.district_collector_reference },
      { value: t.payment_reference, label: t.payment_reference },
      { value: t.judicial_reference, label: t.judicial_reference },
      { value: t.disposed_reference, label: t.disposed_reference },
      { value: t.circular, label: t.circular },
      { value: t.minister_reference, label: t.minister_reference },
      { value: t.mayor_officer_councilor, label: t.mayor_officer_councilor },
      { value: t.human_rights_reference, label: t.human_rights_reference },
      { value: t.lokayukta_reference, label: t.lokayukta_reference },
      { value: t.democracy_day_reference, label: t.democracy_day_reference },
      { value: t.assembly_questions, label: t.assembly_questions },
      { value: t.divisional_commissioner_reference, label: t.divisional_commissioner_reference },
      { value: t.government_order, label: t.government_order },
      { value: t.government_reference, label: t.government_reference },
    ],
    'c_class': [
      { value: t.category_k_police_commissioner, label: t.category_k_police_commissioner },
      { value: t.category_k_divisional_commissioner, label: t.category_k_divisional_commissioner },
      { value: t.category_k_district_collector, label: t.category_k_district_collector },
      { value: t.category_k_sainik_board, label: t.category_k_sainik_board },
      { value: t.category_k_senior_army_officer, label: t.category_k_senior_army_officer },
      { value: t.category_k_democracy_day, label: t.category_k_democracy_day },
      { value: t.category_k_sdpo_nagar_city, label: t.category_k_sdpo_nagar_city },
      { value: t.category_k_sdpo_nagar_taluka, label: t.category_k_sdpo_nagar_taluka },
      { value: t.category_k_sdpo_sangamner, label: t.category_k_sdpo_sangamner },
      { value: t.category_k_sdpo_shrirampur, label: t.category_k_sdpo_shrirampur },
      { value: t.category_k_sdpo_karjat, label: t.category_k_sdpo_karjat },
      { value: t.category_k_sdpo_shirdi, label: t.category_k_sdpo_shirdi },
      { value: t.category_k_sdpo_shevgaon, label: t.category_k_sdpo_shevgaon },
      { value: t.category_k_all_police_stations, label: t.category_k_all_police_stations },
      { value: t.category_k_all_branches, label: t.category_k_all_branches },
    ],
    'direct_visit': [
      { value: t.category_v_sp_ahmednagar, label: t.category_v_sp_ahmednagar },
      { value: t.category_v_addl_sp_ahmednagar, label: t.category_v_addl_sp_ahmednagar },
    ],
    'legal_and_administrative': [
      { value: t.confidential, label: t.confidential },
      { value: t.approval_crime, label: t.approval_crime },
      { value: t.error, label: t.error },
      { value: t.hospital_record, label: t.hospital_record },
      { value: t.earned_leave_case, label: t.earned_leave_case },
      { value: t.parole_leave_case, label: t.parole_leave_case },
      { value: t.weekly_diary, label: t.weekly_diary },
      { value: t.daily_section, label: t.daily_section },
      { value: t.fingerprint, label: t.fingerprint },
      { value: t.medical_bill, label: t.medical_bill },
      { value: t.tenant_verification, label: t.tenant_verification },
      { value: t.leave_approval, label: t.leave_approval },
      { value: t.warrant, label: t.warrant },
      { value: t.disclosure_absentee, label: t.disclosure_absentee },
      { value: t.deceased_summary_approval, label: t.deceased_summary_approval },
      { value: t.visa, label: t.visa },
      { value: t.departmental_inquiry_order, label: t.departmental_inquiry_order },
      { value: t.final_order, label: t.final_order },
      { value: t.district_police_press_release, label: t.district_police_press_release },
      { value: t.annexure, label: t.annexure },
      { value: t.office_inspection, label: t.office_inspection },
      { value: t.vip_visit, label: t.vip_visit },
      { value: t.bandobast, label: t.bandobast },
      { value: t.reward_punishment, label: t.reward_punishment },
      { value: t.in_charge_officer_order, label: t.in_charge_officer_order },
      { value: t.do_order, label: t.do_order },
    ],
    'cyber_technical': [
      { value: t.cyber, label: t.cyber },
      { value: t.cdr, label: t.cdr },
      { value: t.caf, label: t.caf },
      { value: t.sdr, label: t.sdr },
      { value: t.imei, label: t.imei },
      { value: t.dump_data, label: t.dump_data },
      { value: t.it_act, label: t.it_act },
      { value: t.facebook, label: t.facebook },
      { value: t.whatsapp, label: t.whatsapp },
      { value: t.online_fraud, label: t.online_fraud },
      { value: t.cdr_sdr_caf_ime_ipdr_dump, label: t.cdr_sdr_caf_ime_ipdr_dump },
    ],
    'application': [
      { value: t.application_branch_inquiry, label: t.application_branch_inquiry },
      { value: t.appeal, label: t.appeal },
      { value: t.in_service_training, label: t.in_service_training },
      { value: t.building_branch, label: t.building_branch },
      { value: t.pension_reference, label: t.pension_reference },
      { value: t.govt_vehicle_license, label: t.govt_vehicle_license },
      { value: t.bills, label: t.bills },
      { value: t.departmental_inquiry, label: t.departmental_inquiry },
      { value: t.kasuri_case, label: t.kasuri_case },
      { value: t.salary_fixation, label: t.salary_fixation },
      { value: t.transfer, label: t.transfer },
      { value: t.local_application, label: t.local_application },
      { value: t.nivvi_application, label: t.nivvi_application },
      { value: t.district_soldier_application, label: t.district_soldier_application },
      { value: t.loan_application, label: t.loan_application },
      { value: t.democracy_application, label: t.democracy_application },
      { value: t.confidential_application, label: t.confidential_application },
    ],
    'license_and_permission': [
      { value: t.weapon_license, label: t.weapon_license },
      { value: t.character_verification, label: t.character_verification },
      { value: t.loudspeaker_license, label: t.loudspeaker_license },
      { value: t.entertainment_noc, label: t.entertainment_noc },
      { value: t.event_permission, label: t.event_permission },
      { value: t.business_noc, label: t.business_noc },
      { value: t.paid_bandobast, label: t.paid_bandobast },
      { value: t.security_guard_agency, label: t.security_guard_agency },
      { value: t.explosive_license, label: t.explosive_license },
      { value: t.deity_status_k, label: t.deity_status_k },
      { value: t.deity_status_b, label: t.deity_status_b },
      { value: t.other_licenses, label: t.other_licenses },
    ],
    'portal_application': [
      { value: t.portal_pm_pg, label: t.portal_pm_pg },
      { value: t.portal_your_government, label: t.portal_your_government },
      { value: t.portal_home_minister, label: t.portal_home_minister },
    ],
    'others': [
      { value: t.other, label: t.other },
      { value: t.treasury, label: t.treasury },
      { value: t.assessor, label: t.assessor },
      { value: t.principal_ptc, label: t.principal_ptc },
      { value: t.self_immolation, label: t.self_immolation },
      { value: t.civil_rights_protection, label: t.civil_rights_protection },
      { value: t.pcr, label: t.pcr },
      { value: t.steno, label: t.steno },
      { value: t.stenographer, label: t.stenographer },
    ],
  };

  // Function to get branch name in current language
  const getBranchName = (branchKey) => {
    if (currentLanguage === 'mr' && translations.branch_data[branchKey]) {
      return translations.branch_data[branchKey];
    }
    // Default to English name if no translation found
    return branchKey.split('_').map(word => {
      // Special handling for 'ps' to make it uppercase
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
    fileId: '', // ADDED: Initialize fileId
  });
  
  // State to track if we're processing files
  const [isProcessing, setIsProcessing] = useState(false);

  // FIXED: Helper function to get display value for classification
  const getClassificationDisplayValue = (key) => {
    if (!key) return '';
    // If the key exists in the current language mapping, return the translated value
    if (letterClassificationMap[currentLanguage] && letterClassificationMap[currentLanguage][key]) {
      return letterClassificationMap[currentLanguage][key];
    }
    // Fallback to English if available
    if (letterClassificationMap['en'] && letterClassificationMap['en'][key]) {
      return letterClassificationMap['en'][key];
    }
    // If it's already a display value, try to find the corresponding key and return the translated version
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

  // FIXED: Updated handleChange to properly handle classification changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'letterClassification') {
      // Find the key that matches the selected value in current language
      let selectedKey = null;
      
      // First, try to find the key directly in current language mapping
      selectedKey = Object.keys(letterClassificationMap[currentLanguage] || {}).find(
        key => letterClassificationMap[currentLanguage][key] === value
      );
      
      // If not found, try in other language
      if (!selectedKey) {
        const otherLang = currentLanguage === 'mr' ? 'en' : 'mr';
        selectedKey = Object.keys(letterClassificationMap[otherLang] || {}).find(
          key => letterClassificationMap[otherLang][key] === value
        );
      }
      
      // Fallback: direct mapping
      if (!selectedKey) {
        const directMapping = {
          'वरिष्ठ टपाल': 'senior_mail',
          'senior mail': 'senior_mail',
          'अ वर्ग': 'a_class',
          'a class': 'a_class',
          'संदर्भ': 'reference',
          'reference': 'reference',
          'क वर्ग': 'c_class',
          'c class': 'c_class',
          'व वर्ग': 'direct_visit',
          'direct visit': 'direct_visit',
          'कायदेशीर व प्रशासकीय': 'legal_and_administrative',
          'legal and administrative': 'legal_and_administrative',
          'सायबर आणि तांत्रिक': 'cyber_technical',
          'cyber technical': 'cyber_technical',
          'अर्ज': 'application',
          'application': 'application',
          'परवाने आणि परवानग्या': 'license_and_permission',
          'license and permission': 'license_and_permission',
          'पोर्टल अर्ज': 'portal_application',
          'portal application': 'portal_application',
          'इतर': 'others',
          'others': 'others'
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
        [name]: selectedKey || value, // Store the key, not the display value
        letterType: '' // Reset letter type when classification changes
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    try {
      const formDataToSend = new FormData();
      
      // MODIFIED: Check for both mainFileId and formData.fileId
      if (!mainFileId && !formData.fileId) {
        console.error('❌ No fileId found! Did you upload first?');
        toast.error('Please upload a file first');
        return;
      }

      // MODIFIED: Check if user is logged in
      if (!userId || !userInfo) {
        console.error('❌ No user found! User might not be logged in.');
        toast.error('Please log in first');
        return;
      }

      // Helper function to get the display value for submission based on current language
      const getSubmissionValue = (field, value) => {
        if (field === 'letterClassification') {
          // Return the display value in current language
          return getClassificationDisplayValue(value);
        }
        if (field === 'letterMedium') {
          // Return the display value for letter medium
          const mediumMap = {
            'hard_copy': currentLanguage === 'mr' ? 'हार्ड कॉपी' : 'Hard Copy',
            'soft_copy': currentLanguage === 'mr' ? 'सॉफ्ट कॉपी' : 'Soft Copy',
            'soft_copy_and_hard_copy': currentLanguage === 'mr' ? 'सॉफ्ट कॉपी आणि हार्ड कॉपी' : 'Soft Copy and Hard Copy'
          };
          return mediumMap[value] || value;
        }
        return value;
      };

      // Add all form fields to FormData - Use display values for submission
      formDataToSend.append('officeSendingLetter', formData.officeSendingLetter);
      formDataToSend.append('senderNameAndDesignation', formData.senderNameAndDesignation);
      formDataToSend.append('outwardLetterNumber', formData.outwardLetterNumber);
      formDataToSend.append('dateOfReceiptOfLetter', formData.dateOfReceiptOfLetter);
      formDataToSend.append('letterClassification', getSubmissionValue('letterClassification', formData.letterClassification));
      formDataToSend.append('letterMedium', getSubmissionValue('letterMedium', formData.letterMedium));
      formDataToSend.append('letterType', formData.letterType);
      formDataToSend.append('letterDate', formData.letterDate);
      formDataToSend.append('mobileNumber', formData.mobileNumber);
      formDataToSend.append('numberOfCopies', formData.numberOfCopies);
      formDataToSend.append('subject', formData.subject);
      
      // MODIFIED: Use the actual userId from state/localStorage
      formDataToSend.append('userId', userId);
      
      // ADDED: Add the fileId from either source
      const fileIdToUse = formData.fileId || mainFileId;
      formDataToSend.append('fileId', fileIdToUse);
      
      console.log('Submitting with userId:', userId, 'and fileId:', fileIdToUse);
      console.log('Form data being submitted:', {
        letterClassification: getSubmissionValue('letterClassification', formData.letterClassification),
        letterMedium: getSubmissionValue('letterMedium', formData.letterMedium),
        letterType: formData.letterType,
        currentLanguage: currentLanguage
      });
      
      // Append all files (both main and additional) to the 'letterFiles' field
      [...mainFiles, ...additionalFiles].forEach((file) => {
        formDataToSend.append('letterFiles', file);
      });

      const response = await fetch('http://localhost:5000/api/patras', {
        method: 'POST',
        body: formDataToSend,
        // Don't set Content-Type header, let the browser set it with the correct boundary
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}` // If using authentication
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      
      // Handle success
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
        fileId: '', // ADDED: Reset fileId
      });
      setMainFiles([]);
      setAdditionalFiles([]);
      setMainFileId(null); // Reset fileId after successful submission
      
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error(error.message || t.submitError || 'Error submitting form');
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-blue-100/60">
          <div className="flex flex-col items-center gap-6 p-8 bg-white bg-opacity-90 rounded-2xl shadow-2xl border border-blue-200">
            {/* Modern animated spinner */}
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
      {/* Main content below */}
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
                      {/* MODIFIED: Show upload status */}
                      {formData.fileId || mainFileId ? (
                        <span className="ml-2 px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 font-semibold">
                          Uploaded ✓ (ID: {formData.fileId || mainFileId})
                        </span>
                      ) : (
                        <span className="ml-2 px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 font-semibold">
                          {t.fileUploaded}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="ml-4 text-blue-400 hover:text-red-500 bg-blue-50 hover:bg-red-50 rounded-full p-1 transition"
                      onClick={() => {
                        setMainFiles([]);
                        setMainFileId(null);
                        // ADDED: Also clear fileId from formData
                        setFormData(prev => ({ ...prev, fileId: '' }));
                      }}
                      title={t.remove}
                    >
                      <FiX />
                    </button>
                  </div>
                ))}
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
            
            {/* FIXED: Letter Classification Field */}
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
                <option value={letterClassificationMap[currentLanguage]['a_class']}>{t.a_class}</option>
                <option value={letterClassificationMap[currentLanguage]['reference']}>{t.reference}</option>
                <option value={letterClassificationMap[currentLanguage]['c_class']}>{t.c_class}</option>
                <option value={letterClassificationMap[currentLanguage]['direct_visit']}>{t.direct_visit}</option>
                <option value={letterClassificationMap[currentLanguage]['legal_and_administrative']}>{t.legal_and_administrative}</option>
                <option value={letterClassificationMap[currentLanguage]['application']}>{t.application}</option>
                <option value={letterClassificationMap[currentLanguage]['cyber_technical']}>{t.cyber_technical}</option>
                <option value={letterClassificationMap[currentLanguage]['license_and_permission']}>{t.license_and_permission}</option>
                <option value={letterClassificationMap[currentLanguage]['portal_application']}>{t.portal_application}</option>
                <option value={letterClassificationMap[currentLanguage]['others']}>{t.others}</option>
              </select>
            </div>
            
            {/* FIXED: Letter Type Field */}
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
          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="submit" 
              className="px-7 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 shadow transition-colors text-base"
            >
              {currentLanguage === 'mr' ? 'पत्र सबमिट करा' : 'Submit Letter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewLetter;