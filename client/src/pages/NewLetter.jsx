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
    
    // Special handling for office type to match dropdown options
    if (extractedData.officeType) {
      const officeTypeMap = {
        'SP (एसपी)': 'senior_post_sp',
        'DGP': 'senior_post_dgp',
        'IGP': 'senior_post_igp',
        'Additional DGP': 'senior_post_addl_dgp'
        // Add more mappings as needed
      };
      
      const mappedType = officeTypeMap[extractedData.officeType];
      if (mappedType) {
        formUpdates.officeType = mappedType;
      }
    }
    
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
      
      const response = await fetch('https://3d3c5ca3759e.ngrok-free.app/api/files/upload', {
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
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        throw new Error('Invalid response format from server');
      }
      
      // Log the extracted data for debugging
      const extractedData = responseData.extractedData || responseData.file?.extractedData;
      console.log('Extracted data:', extractedData);
      
      if (!extractedData) {
        throw new Error('No extracted data found in response');
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

      // Map only the specific fields from extracted data
      const formUpdates = {
        dateOfReceiptOfLetter: convertDateToISO(extractedData.dateOfReceiptOfLetter),
        letterClassification: extractedData.letterClassification || '',
        letterDate: convertDateToISO(extractedData.letterDate),
        letterMedium: extractedData.letterMedium || '',
        letterType: extractedData.letterType || '',
        mobileNumber: extractedData.mobileNumber || '',
        numberOfCopies: extractedData.numberOfCopies || '',
        officeSendingLetter: extractedData.officeSendingLetter || '',
        outwardLetterNumber: extractedData.outwardLetterNumber || '',
        senderNameAndDesignation: extractedData.senderNameAndDesignation || '',
        subject: extractedData.subject || ''
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
      
      // Map officeType - convert to match form values
      const officeTypeMap = {
        'sp (एसपी)': 'SP',
        'dgp': 'IGP',
        'igp': 'IGP',
        'additional dgp': 'IGP',
        'police commissioner': 'SP',
        'divisional commissioner': 'SDPO',
        'sdpo': 'SDPO',
        'police station': 'Police Station'
      };
      
      if (extractedData.officeType) {
        const lowerOfficeType = extractedData.officeType.toLowerCase();
        formUpdates.officeType = officeTypeMap[lowerOfficeType] || '';
      }
      
      // Map office - try to extract from officeName or use default
      if (extractedData.officeName) {
        const officeName = extractedData.officeName.toLowerCase();
        
        // Check for Marathi office names first
        if (officeName.includes('अहमदनगर') || officeName.includes('ahmednagar')) {
          formUpdates.office = 'District Police Officer Ahmednagar';
        } else if (officeName.includes('पुणे') || officeName.includes('pune')) {
          formUpdates.office = 'District Police Officer Pune Rural';
        } else if (officeName.includes('जळगाव') || officeName.includes('jalgaon')) {
          formUpdates.office = 'District Police Officer Jalgaon';
        } else if (officeName.includes('नंदुरबार') || officeName.includes('nandurbar')) {
          formUpdates.office = 'District Police Officer Nandurbar';
        } else if (officeName.includes('नाशिक') || officeName.includes('nashik')) {
          formUpdates.office = 'District Police Officer Nashik Rural';
        } 
        // Try to extract from receivedByOffice if officeName is not specific enough
        else if (extractedData.receivedByOffice) {
          const receivedBy = extractedData.receivedByOffice.toLowerCase();
          if (receivedBy.includes('अहमदनगर') || receivedBy.includes('ahmednagar')) {
            formUpdates.office = 'District Police Officer Ahmednagar';
          } else if (receivedBy.includes('पुणे') || receivedBy.includes('pune')) {
            formUpdates.office = 'District Police Officer Pune Rural';
          } else if (receivedBy.includes('जळगाव') || receivedBy.includes('jalgaon')) {
            formUpdates.office = 'District Police Officer Jalgaon';
          } else if (receivedBy.includes('नंदुरबार') || receivedBy.includes('nandurbar')) {
            formUpdates.office = 'District Police Officer Nandurbar';
          } else if (receivedBy.includes('नाशिक') || receivedBy.includes('nashik')) {
            formUpdates.office = 'District Police Officer Nashik Rural';
          }
        }
        
        // If still not found, try to find any district name in the office name
        if (!formUpdates.office) {
          const districts = [
            { en: 'ahmednagar', mr: 'अहमदनगर', value: 'District Police Officer Ahmednagar' },
            { en: 'pune', mr: 'पुणे', value: 'District Police Officer Pune Rural' },
            { en: 'jalgaon', mr: 'जळगाव', value: 'District Police Officer Jalgaon' },
            { en: 'nandurbar', mr: 'नंदुरबार', value: 'District Police Officer Nandurbar' },
            { en: 'nashik', mr: 'नाशिक', value: 'District Police Officer Nashik Rural' }
          ];
          
          for (const district of districts) {
            if (officeName.includes(district.en) || officeName.includes(district.mr)) {
              formUpdates.office = district.value;
              break;
            }
          }
        }
      }
      
      // Map actionType
      const actionTypeMap = {
        'चौकशी': 'proceeding',
        'proceeding': 'proceeding',
        'answer': 'answer',
        'reply': 'answer',
        'जबाब': 'answer'
      };
      
      if (extractedData.actionType) {
        const lowerActionType = extractedData.actionType.toLowerCase();
        formUpdates.actionType = actionTypeMap[lowerActionType] || 'proceeding';
      } else {
        formUpdates.actionType = 'proceeding'; // Default value
      }
      
      // Map letterType - use the exact value from the form options
      if (extractedData.letterType) {
        // First try to match with translation keys
        const letterTypeMap = {
          'तक्रारी अर्ज': t.complaint_letter,
          'अर्ज': t.application,
          'विनंती पत्र': t.request_letter,
          'कळ': t.report,
          'अहवाल': t.report,
          'परिपत्रक': t.circular,
          'आदेश': t.order,
          'सूचना': t.notice,
          'वरिष्ठ टपाल': t.senior_post,
          'वरिष्ठ टपाल - पोलिस महासंचालक': t.senior_post_dgp,
          'complaint': t.complaint_letter,
          'application': t.application,
          'request': t.request_letter,
          'report': t.report,
          'circular': t.circular,
          'order': t.order,
          'notice': t.notice,
          'senior post': t.senior_post,
          'senior post - police commissioner': t.senior_post_dgp
        };
        
        // First try exact match, then try partial match
        let mappedLetterType = letterTypeMap[extractedData.letterType];
        
        if (!mappedLetterType) {
          // Try partial match
          const partialMatch = Object.entries(letterTypeMap).find(([key]) => 
            extractedData.letterType.toLowerCase().includes(key.toLowerCase())
          );
          mappedLetterType = partialMatch?.[1];
        }
        
        // If still no match, use the original value or default to 'other'
        formUpdates.letterType = mappedLetterType || extractedData.letterType || t.other;
      }
      
      console.log('Mapped form updates:', formUpdates);
      
      // Update the form with the mapped data
      setFormData(prev => ({
        ...prev,
        ...formUpdates
      }));
      
      toast.success('Form fields updated from extracted data');
      return;
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        toast.error('Invalid response from server');
        return null;
      }
      
      if (!response.ok) {
        console.error('Error extracting text. Status:', response.status, 'Response:', data);
        toast.error(data.error || `Failed to extract text (${response.status})`);
        return null;
      }
      
      console.log('Full response data:', data);
      
      if (!data.text) {
        console.warn('No text field in response:', data);
        toast.warning('No text was extracted from the file');
        return null;
      }
      
      console.log('Raw extracted text:', data.text);
      
      // First try to parse as JSON (in case it's an API response)
      try {
        const apiResponse = JSON.parse(data.text);
        if (apiResponse && typeof apiResponse === 'object') {
          console.log('API Response detected:', apiResponse);
          const mappedData = mapApiResponseToForm(apiResponse);
          if (Object.keys(mappedData).length > 0) {
            toast.success('Form fields updated from API response');
            return;
          }
        }
      } catch (e) {
        // Not a JSON response, try text parsing
        console.log('Not a JSON response, trying text parsing');
      }
      
      // Fall back to text parsing if not an API response
      const extracted = parseExtractedText(data.text);
      console.log('Parsed data:', extracted);
      
      if (Object.keys(extracted).length === 0) {
        console.warn('No data could be extracted from the text');
        toast.warning('Could not extract form data from the document');
        return null;
      }
      setFormData(prev => ({
        ...prev,
        receivedByOffice: extracted.receivedByOffice || prev.receivedByOffice,
        recipientName: extracted.recipientName || prev.recipientName,
        letterCategory: extracted.letterCategory || prev.letterCategory,
        letterType: extracted.letterType || prev.letterType,
        letterDate: extracted.letterDate || prev.letterDate,
        officeType: extracted.officeType || prev.officeType,
        office: extracted.office || prev.office,
        mobileNumber: extracted.mobileNumber || prev.mobileNumber,
        remarks: extracted.remarks || prev.remarks,
        subject: extracted.subject || prev.subject,
        details: extracted.details || prev.details,
        // For branch name, you might need additional logic to match with your branch data
        officeBranchName: extracted.officeBranchName || prev.officeBranchName,
        actionType: extracted.actionType || prev.actionType
      }));
      
      toast.success('Form fields auto-filled from document');
      return data;
      
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
  
  // Add this mapping at the top of the component, after translations and t are defined
  const letterTypeOptionsMap = {
    'senior mail': [
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
    'a class': [
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
    'c class': [
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
    'direct visit': [
      { value: t.category_v_sp_ahmednagar, label: t.category_v_sp_ahmednagar },
      { value: t.category_v_addl_sp_ahmednagar, label: t.category_v_addl_sp_ahmednagar },
    ],
    'legal and administrative': [
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
    'cyber technical': [
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
    'license and permission': [
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
    'portal application': [
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

  // Branch data with translations

  // Function to get branch name in current language
  const getBranchName = (branchKey) => {
    if (currentLanguage === 'mr' && branch_data[branchKey]) {
      return branch_data[branchKey];
    }
    // Default to English name if no translation found
    return branchKey.split('_').map(word => {
      // Special handling for 'ps' to make it uppercase
      if (word.toLowerCase() === 'ps') return 'PS';
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  };


  const [formData, setFormData] = useState({
    receivedByOffice: '',
    recipientName: '',
    letterCategory: '',
    letterMedium: '',
    letterType: '',
    letterStatus: '',
    letterDate: '',
    dateOfReceiptOfLetter: '',
    officeType: '',
    office: '',
    mobileNumber: '',
    remarks: '',
    officeBranchName: '',
    actionType: '',
    subject: '',
    details: '',
    numberOfCopies: '',
    outwardLetterNumber: '',
    senderNameAndDesignation: '',
    letterClassification: '',
    officeSendingLetter: ''
  });
  
  // State to track if we're processing files
  const [isProcessing, setIsProcessing] = useState(false);

  const [availableBranches, setAvailableBranches] = useState([]);

  // Update available branches when officeType or office changes
  useEffect(() => {
    if (formData.officeType && formData.office) {
      const branchData = getBranchData();
      const branches = branchData[formData.officeType]?.[formData.office] || [];
      setAvailableBranches(branches);
      setFormData(prev => ({ ...prev, officeBranchName: '' }));
    } else {
      setAvailableBranches([]);
      setFormData(prev => ({ ...prev, officeBranchName: '' }));
    }
  }, [formData.officeType, formData.office]);

  // Update handleChange to reset letterType if letterCategory changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'letterCategory' ? { letterType: '' } : {})
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    try {
      const formDataToSend = new FormData();
      
      // Combine recipient name and designation as required by the backend
      const recipientNameAndDesignation = `${formData.recipientName} - ${formData.recipientDesignation}`;
      
      // Combine subject and details as required by the backend
      const subjectAndDetails = `${formData.subject}: ${formData.details}`;
      
      // Add all form fields to FormData
      formDataToSend.append('receivedByOffice', formData.receivedByOffice);
      formDataToSend.append('recipientName', formData.recipientName);
      formDataToSend.append('recipientNameAndDesignation', recipientNameAndDesignation);
      formDataToSend.append('letterCategory', formData.letterCategory);
      formDataToSend.append('letterMedium', formData.letterMedium);
      formDataToSend.append('letterType', formData.letterType);
      formDataToSend.append('letterStatus', formData.letterStatus);
      formDataToSend.append('letterDate', formData.letterDate);
      formDataToSend.append('officeType', formData.officeType);
      formDataToSend.append('office', formData.office);
      formDataToSend.append('mobileNumber', formData.mobileNumber);
      formDataToSend.append('remarks', formData.remarks);
      
      // Find the selected branch to get its ID
      let branchId = null; // Default to null if no branch is selected
      if (formData.officeType && formData.office && formData.officeBranchName) {
        const branchData = getBranchData();
        const branches = branchData[formData.officeType]?.[formData.office] || [];
        const selectedBranch = branches.find(branch => branch.name === formData.officeBranchName);
        if (selectedBranch && selectedBranch.id) {
          // Ensure we have a valid numeric ID
          branchId = Number.isInteger(selectedBranch.id) ? selectedBranch.id : parseInt(selectedBranch.id, 10);
        }
      }
      
      // Only append officeBranchName if it has a value
      if (formData.officeBranchName) {
        formDataToSend.append('officeBranchName', formData.officeBranchName);
      } else {
        formDataToSend.append('officeBranchName', '');
      }
      
      // Always include branchName with a default value of 0 if no branch is selected
      // This is needed because the database field is NOT NULL
      formDataToSend.append('branchName', branchId !== null ? branchId : 0);
      formDataToSend.append('actionType', formData.actionType);
      formDataToSend.append('typeOfAction', formData.actionType); // Add typeOfAction as required
      formDataToSend.append('subject', formData.subject);
      formDataToSend.append('details', formData.details);
      formDataToSend.append('subjectAndDetails', subjectAndDetails); // Add combined subject and details
      formDataToSend.append('userId', '1'); // Replace with actual user ID from auth context
      
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
      alert(t.letterSubmitted);
      console.log('Reference Number:', data.referenceNumber);
      
      // Reset form
      setFormData({
        receivedByOffice: '',
        recipientName: '',
        letterCategory: '',
        letterMedium: '',
        letterType: '',
        letterStatus: '',
        letterDate: new Date().toISOString().split('T')[0],
        officeType: '',
        office: '',
        mobileNumber: '',
        remarks: '',
        officeBranchName: '',
        actionType: '',
        subject: '',
        details: ''
      });
      setMainFiles([]);
      setAdditionalFiles([]);
      
    } catch (error) {
      console.error('Error submitting form:', error);
      alert(error.message || t.submitError);
    }
  };

  return (
    <div className="space-y-6">
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
              <div className="mt-4 space-y-2">
                {mainFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-blue-100 rounded-lg shadow-sm">
                    <div className="flex items-center">
                      <FiPaperclip className="text-blue-400 mr-2" />
                      <span className="text-sm text-blue-900 truncate max-w-xs font-medium">{file.name} <span className="text-xs text-blue-500">({t.fileUploaded})</span></span>
                    </div>
                    <button 
                      type="button" 
                      className="text-blue-400 hover:text-red-500 transition"
                      onClick={() => setMainFiles([])}
                    >
                      <FiX title={t.remove} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Process File Button - Only for OCR Processing */}
            {mainFiles.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    mainFiles.forEach(file => {
                      const fileCopy = new File([file], file.name, { type: file.type });
                      extractTextFromFile(fileCopy).catch(error => {
                        console.error('Error in text extraction:', error);
                      });
                    });
                  }}
                  className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 font-semibold shadow"
                >
                  <FiUpload className="mr-2" />
                  {t.processFile}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-blue-900">{t.receivedByOffice}</label>
              <input
                type="text"
                name="receivedByOffice"
                value={formData.receivedByOffice}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder-gray-400 bg-white hover:border-blue-300"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-blue-900">{t.recipientName}</label>
              <input
                type="text"
                name="recipientName"
                value={formData.recipientName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder-gray-400 bg-white hover:border-blue-300"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-blue-900">{t.outward_letter_no}</label>
              <input
                type="text"
                name="outward_letter_no"
                value={formData.outward_letter_no}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder-gray-400 bg-white hover:border-blue-300"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-blue-900">{t.no_of_documents}</label>
              <input
                type="text"
                name="no_of_documents"
                value={formData.no_of_documents}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder-gray-400 bg-white hover:border-blue-300"
                required
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
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-blue-900">{t.letterMedium}</label>
              <select
                name="letterMedium"
                value={formData.letterMedium}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white hover:border-blue-300"
                required
              >
                <option value="">{t.selectMedium}</option>
                <option value="hard_copy">{t.hard_copy}</option>
                <option value="soft_copy">{t.soft_copy}</option>
                <option value="soft_copy_and_hard_copy">{t.soft_copy_and_hard_copy}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-blue-900">{t.letterCategory}</label>
              <select
                name="letterCategory"
                value={formData.letterCategory}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white hover:border-blue-300"
                required
              >
                <option value="">{t.select_category}</option>
                <option value="senior mail">{t.senior_mail}</option>
                <option value="a class">{t.a_class}</option>
                <option value="reference">{t.reference}</option>
                <option value="c class">{t.c_class}</option>
                <option value="direct visit">{t.direct_visit}</option>
                <option value="legal and administrative">{t.legal_and_administrative}</option>
                <option value="application">{t.application}</option>
                <option value="cyber technical">{t.cyber_technical}</option>
                <option value="license and permission">{t.license_and_permission}</option>
                <option value="portal application">{t.portal_application}</option>
                <option value="others">{t.others}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-blue-900">{t.letterType}</label>
              <select
                name="letterType"
                value={formData.letterType}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white hover:border-blue-300"
                required
              >
                <option value="">{t.selectType}</option>
                {(letterTypeOptionsMap[formData.letterCategory] || []).map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
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
      required
      showYearDropdown
      dropdownMode="select"
      wrapperClassName="w-full"
      placeholderText="Select date"
    />
  </div>
</div>

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
      required
      showYearDropdown
      dropdownMode="select"
      wrapperClassName="w-full"
      placeholderText="Select date"
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
              required
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
