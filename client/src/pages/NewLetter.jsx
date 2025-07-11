import { useState, useRef, useEffect } from 'react';
import { FiUpload, FiX, FiPaperclip } from 'react-icons/fi';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import translations from '../translations';

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
      
      // Extract sender's designation (प्रभारी अधिकारी, पोलीस अधिक्षक कार्यालय)
      const senderMatch = text.match(/प्रभारी अधिकारी[^,]+,\s*([^\n]+)/);
      if (senderMatch && senderMatch[1]) {
        result.recipientDesignation = senderMatch[1].trim();
        console.log('Found recipient designation:', result.recipientDesignation);
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
    
    // Handle recipient name and designation
    if (extractedData.recipientNameAndDesignation) {
      const nameParts = extractedData.recipientNameAndDesignation.split(',');
      if (nameParts.length > 1) {
        formUpdates.recipientName = nameParts[0].trim();
        formUpdates.recipientDesignation = nameParts.slice(1).join(',').trim();
      } else {
        formUpdates.recipientName = extractedData.recipientNameAndDesignation;
        // Try to extract designation from officeName if available
        if (extractedData.officeName) {
          const officeParts = extractedData.officeName.split('(');
          if (officeParts.length > 0) {
            formUpdates.recipientDesignation = officeParts[0].trim();
          }
        }
      }
    }
    
    // Map other fields
    const fieldMappings = {
      letterType: 'letterType',
      letterDate: 'letterDate',
      mobileNumber: 'mobileNumber',
      remarks: 'remarks',
      actionType: 'actionType',
      letterStatus: 'letterStatus',
      letterMedium: 'letterMedium',
      letterSubject: 'letterSubject',
      officeType: 'officeType',
      officeName: 'officeName'
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
      
      const response = await fetch('https://b1c85584a967.ngrok-free.app/api/files/upload', {
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
      
      // Map the extracted data to form fields
      const formUpdates = {
        receivedByOffice: extractedData.receivedByOffice || '',
        recipientName: extractedData.recipientNameAndDesignation?.split(',')[0]?.trim() || '',
        recipientDesignation: extractedData.recipientNameAndDesignation?.split(',').slice(1).join(',').trim() || '',
        letterDate: extractedData.letterDate || new Date().toISOString().split('T')[0],
        mobileNumber: extractedData.mobileNumber || '',
        remarks: extractedData.remarks || '',
        subject: extractedData.letterSubject || extractedData.remarks || '',
        details: extractedData.remarks || '',
        officeName: extractedData.officeName || ''
      };
      
      // Map letterMedium - convert to match form values
      if (extractedData.letterMedium) {
        if (extractedData.letterMedium.toLowerCase().includes('hard')) {
          formUpdates.letterMedium = 'hard_copy';
        } else if (extractedData.letterMedium.toLowerCase().includes('soft')) {
          formUpdates.letterMedium = 'soft_copy';
        } else {
          formUpdates.letterMedium = extractedData.letterMedium;
        }
      } else {
        formUpdates.letterMedium = 'hard_copy'; // Default value
      }
      
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
          'complaint': t.complaint_letter,
          'application': t.application,
          'request': t.request_letter,
          'report': t.report,
          'circular': t.circular,
          'order': t.order,
          'notice': t.notice
        };
        
        // First try exact match, then try partial match
        formUpdates.letterType = letterTypeMap[extractedData.letterType] || 
          Object.entries(letterTypeMap).find(([key]) => 
            extractedData.letterType.toLowerCase().includes(key.toLowerCase())
          )?.[1] || 
          t.other; // Default to 'other' if no match found
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
        recipientDesignation: extracted.recipientDesignation || prev.recipientDesignation,
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
  
  // Branch data with translations
  const branch_data = {
    // Office Types
    sp: 'एसपी',
    sdpo: 'एसडीपीओ',
    police_station: 'पोलीस स्टेशन',
    district_police_officer: 'जिल्हा पोलीस अधिकारी अहमदनगर',
    
    // SP Branches
    economic_crime_branch: 'आर्थिक गुन्हा शाखा',
    registration_branch: 'नोंदणी शाखा',
    cyber_branch: 'सायबर शाखा',
    terrorism_special_unit: 'दहशतवाद विशेष तुकडी',
    special_branch: 'विशेष शाखा',
    motor_vehicle_branch: 'मोटर वाहन शाखा',
    wireless_department: 'वायरलेस विभाग',
    police_headquarters: 'पोलीस मुख्यालय',
    reader_branch: 'रीडर शाखा',
    bdds: 'बीडीडीएस',
    business_restriction_wing: 'व्यवसाय निर्बंध विभाग',
    trust: 'ट्रस्ट',
    dog_squad: 'कुत्रा तुकडी',
    trial_monitoring_wing: 'चौकशी देखरेख विभाग',
    police_welfare_hr: 'पोलीस कल्याण एचआर',
    fingerprints: 'बोटांच्या ठशांची नोंद',
    dy_sp_hq: 'डीवाय एसपी मुख्यालय',
    sp_ahmednagar: 'एसपी अहमदनगर',
    south_division_mobile_unit: 'दक्षिण विभाग मोबाईल युनिट',
    steno_ahmednagar: 'स्टेनो अहमदनगर',
    cctns_department: 'सीसीटीएनएस विभाग',
    women_child_crime: 'महिला व बाल गुन्हे',
    city_traffic_branch: 'सिटी ट्रॅफिक शाखा',
    addl_sp_shrirampur: 'अतिरिक्त एसपी श्रीरामपूर',
    north_mobile_cell: 'नॉर्थ मोबाईल सेल',
    shirdi_traffic_branch: 'शिर्डी ट्रॅफिक शाखा',
    
    // SDPO Branches
    shevgaon_inward: 'शेवगाव इनवर्ड शाखा',
    shikrapur_inward: 'शिक्रापूर इनवर्ड शाखा',
    ahmednagar_city_inward: 'अहमदनगर सिटी इनवर्ड शाखा',
    sangamner_inward: 'सांगमनेर इनवर्ड शाखा',
    karjat_inward: 'करजत इनवर्ड शाखा',
    rural_inward: 'ग्रामीण इनवर्ड शाखा',
    shirdi_inward: 'शिर्डी इनवर्ड शाखा',
    
    // Police Stations
    nevasak_ps: 'नेवासा पोलीस स्टेशन',
    sonai_ps: 'सोनाई पोलीस स्टेशन',
    rajura_ps: 'राजूरा पोलीस स्टेशन',
    parner_ps: 'परनेर पोलीस स्टेशन',
    shevgaon_ps: 'शेवगाव पोलीस स्टेशन',
    kotwali_ps: 'कोतवाली पोलीस स्टेशन',
    bhingar_ps: 'भिंगार पोलीस स्टेशन',
    sangamner_ps: 'सांगमनेर पोलीस स्टेशन',
    akole_ps: 'आकोले पोलीस स्टेशन',
    shirdi_ps: 'शिर्डी पोलीस स्टेशन',
    rahta_ps: 'राहता पोलीस स्टेशन',
    shrirampur_ps: 'श्रीरामपूर पोलीस स्टेशन',
    newasa_ps: 'नेवासा पोलीस स्टेशन',
    kopargaon_ps: 'कोपरगाव पोलीस स्टेशन',
    rahuri_ps: 'राहुरी पोलीस स्टेशन',
    shrirampur_rural_ps: 'श्रीरामपूर ग्रामीण पोलीस स्टेशन',
    nagar_rural_ps: 'नगर ग्रामीण पोलीस स्टेशन',
    rahar_ps: 'राहर पोलीस स्टेशन',
    karjat_ps: 'करजत पोलीस स्टेशन',
    jamkhed_ps: 'जामखेड पोलीस स्टेशन',
    pathardi_ps: 'पाथर्डी पोलीस स्टेशन',
    shrigonda_ps: 'श्रीगोंदा पोलीस स्टेशन',
    pargaon_ps: 'परगाव पोलीस स्टेशन',
    nagar_ps: 'नगर पोलीस स्टेशन',
    sangamner_rural_ps: 'सांगमनेर ग्रामीण पोलीस स्टेशन',
    takli_dhokeshwar_ps: 'टाकळी धोकेश्वर पोलीस स्टेशन',
    shrirampur_city_ps: 'श्रीरामपूर सिटी पोलीस स्टेशन',
    kohokade_ps: 'कोहोकाडे पोलीस स्टेशन',
    nighoj_ps: 'निघोज पोलीस स्टेशन',
    khadakjamb_ps: 'खडकजांब पोलीस स्टेशन',
    takli_bhansingh_ps: 'टाकळी भानसिंग पोलीस स्टेशन',
    pimpalgaon_ps: 'पिंपळगाव पोलीस स्टेशन',
    akole_tal_ps: 'आकोले ता. पोलीस स्टेशन',
    sangamner_city_ps: 'सांगमनेर सिटी पोलीस स्टेशन',
    pachora_devachi_ps: 'पाचोरा देवाची पोलीस स्टेशन',
    shrirampur_rural_2_ps: 'श्रीरामपूर ग्रामीण २ पोलीस स्टेशन',
    rahta_pachapati_ps: 'राहता पाचपती पोलीस स्टेशन',
    akole_city_ps: 'आकोले सिटी पोलीस स्टेशन',
    shrirampur_city_2_ps: 'श्रीरामपूर सिटी २ पोलीस स्टेशन',
    sangamner_rural_2_ps: 'सांगमनेर ग्रामीण २ पोलीस स्टेशन',
    kohokade_rural_ps: 'कोहोकाडे ग्रामीण पोलीस स्टेशन',
    kohokade_city_ps: 'कोहोकाडे सिटी पोलीस स्टेशन',
    kohokade_rural_2_ps: 'कोहोकाडे ग्रामीण २ पोलीस स्टेशन',
    kohokade_city_2_ps: 'कोहोकाडे सिटी २ पोलीस स्टेशन',
  };

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

  // Helper function to get branch data
  const getBranchData = () => {
    return {
      'SP': {
        'District Police Officer Ahmednagar': [
          { id: 1, name: 'economic_crime_branch', displayName: getBranchName('economic_crime_branch') },
          { id: 2, name: 'registration_branch', displayName: getBranchName('registration_branch') },
          { id: 3, name: 'cyber_branch', displayName: getBranchName('cyber_branch') },
          { id: 4, name: 'terrorism_special_unit', displayName: getBranchName('terrorism_special_unit') },
          { id: 5, name: 'special_branch', displayName: getBranchName('special_branch') },
          { id: 6, name: 'motor_vehicle_branch', displayName: getBranchName('motor_vehicle_branch') },
          { id: 7, name: 'wireless_department', displayName: getBranchName('wireless_department') },
          { id: 8, name: 'police_headquarters', displayName: getBranchName('police_headquarters') },
          { id: 9, name: 'reader_branch', displayName: getBranchName('reader_branch') },
          { id: 10, name: 'bdds', displayName: getBranchName('bdds') },
          { id: 11, name: 'business_restriction_wing', displayName: getBranchName('business_restriction_wing') },
          { id: 12, name: 'trust', displayName: getBranchName('trust') },
          { id: 13, name: 'dog_squad', displayName: getBranchName('dog_squad') },
          { id: 14, name: 'trial_monitoring_wing', displayName: getBranchName('trial_monitoring_wing') },
          { id: 15, name: 'police_welfare_hr', displayName: getBranchName('police_welfare_hr') },
          { id: 16, name: 'fingerprints', displayName: getBranchName('fingerprints') },
          { id: 17, name: 'dy_sp_hq', displayName: getBranchName('dy_sp_hq') },
          { id: 18, name: 'sp_ahmednagar', displayName: getBranchName('sp_ahmednagar') },
          { id: 19, name: 'south_division_mobile_unit', displayName: getBranchName('south_division_mobile_unit') },
          { id: 20, name: 'steno_ahmednagar', displayName: getBranchName('steno_ahmednagar') },
          { id: 21, name: 'cctns_department', displayName: getBranchName('cctns_department') },
          { id: 22, name: 'women_child_crime', displayName: getBranchName('women_child_crime') },
          { id: 23, name: 'city_traffic_branch', displayName: getBranchName('city_traffic_branch') },
          { id: 24, name: 'addl_sp_shrirampur', displayName: getBranchName('addl_sp_shrirampur') },
          { id: 25, name: 'north_mobile_cell', displayName: getBranchName('north_mobile_cell') },
          { id: 26, name: 'shirdi_traffic_branch', displayName: getBranchName('shirdi_traffic_branch') }
        ]
      },
      'SDPO': {
        'District Police Officer Ahmednagar': [
          { id: 27, name: 'shevgaon_inward', displayName: getBranchName('shevgaon_inward') },
          { id: 28, name: 'shikrapur_inward', displayName: getBranchName('shikrapur_inward') },
          { id: 29, name: 'ahmednagar_city_inward', displayName: getBranchName('ahmednagar_city_inward') },
          { id: 30, name: 'sangamner_inward', displayName: getBranchName('sangamner_inward') },
          { id: 31, name: 'karjat_inward', displayName: getBranchName('karjat_inward') },
          { id: 32, name: 'rural_inward', displayName: getBranchName('rural_inward') },
          { id: 33, name: 'shirdi_inward', displayName: getBranchName('shirdi_inward') }
        ]
      },
      'Police Station': {
        'District Police Officer Ahmednagar': [
          { id: 34, name: 'nevasak_ps', displayName: getBranchName('nevasak_ps') },
          { id: 35, name: 'sonai_ps', displayName: getBranchName('sonai_ps') },
          { id: 36, name: 'rajura_ps', displayName: getBranchName('rajura_ps') },
          { id: 37, name: 'parner_ps', displayName: getBranchName('parner_ps') },
          { id: 38, name: 'shevgaon_ps', displayName: getBranchName('shevgaon_ps') },
          { id: 39, name: 'kotwali_ps', displayName: getBranchName('kotwali_ps') },
          { id: 40, name: 'bhingar_ps', displayName: getBranchName('bhingar_ps') },
          { id: 41, name: 'sangamner_ps', displayName: getBranchName('sangamner_ps') },
          { id: 42, name: 'akole_ps', displayName: getBranchName('akole_ps') },
          { id: 43, name: 'shirdi_ps', displayName: getBranchName('shirdi_ps') },
          { id: 44, name: 'rahta_ps', displayName: getBranchName('rahta_ps') },
          { id: 45, name: 'shrirampur_ps', displayName: getBranchName('shrirampur_ps') },
          { id: 46, name: 'newasa_ps', displayName: getBranchName('newasa_ps') },
          { id: 47, name: 'kopargaon_ps', displayName: getBranchName('kopargaon_ps') },
          { id: 48, name: 'rahuri_ps', displayName: getBranchName('rahuri_ps') },
          { id: 49, name: 'shrirampur_rural_ps', displayName: getBranchName('shrirampur_rural_ps') },
          { id: 50, name: 'nagar_rural_ps', displayName: getBranchName('nagar_rural_ps') },
          { id: 51, name: 'rahar_ps', displayName: getBranchName('rahar_ps') },
          { id: 52, name: 'karjat_ps', displayName: getBranchName('karjat_ps') },
          { id: 53, name: 'jamkhed_ps', displayName: getBranchName('jamkhed_ps') },
          { id: 54, name: 'pathardi_ps', displayName: getBranchName('pathardi_ps') },
          { id: 55, name: 'shrigonda_ps', displayName: getBranchName('shrigonda_ps') },
          { id: 56, name: 'pargaon_ps', displayName: getBranchName('pargaon_ps') },
          { id: 57, name: 'nagar_ps', displayName: getBranchName('nagar_ps') },
          { id: 58, name: 'sangamner_rural_ps', displayName: getBranchName('sangamner_rural_ps') },
          { id: 59, name: 'takli_dhokeshwar_ps', displayName: getBranchName('takli_dhokeshwar_ps') },
          { id: 60, name: 'shrirampur_city_ps', displayName: getBranchName('shrirampur_city_ps') },
          { id: 61, name: 'kohokade_ps', displayName: getBranchName('kohokade_ps') },
          { id: 62, name: 'nighoj_ps', displayName: getBranchName('nighoj_ps') },
          { id: 63, name: 'khadakjamb_ps', displayName: getBranchName('khadakjamb_ps') },
          { id: 64, name: 'takli_bhansingh_ps', displayName: getBranchName('takli_bhansingh_ps') },
          { id: 65, name: 'pimpalgaon_ps', displayName: getBranchName('pimpalgaon_ps') },
          { id: 66, name: 'akole_tal_ps', displayName: getBranchName('akole_tal_ps') },
          { id: 67, name: 'sangamner_city_ps', displayName: getBranchName('sangamner_city_ps') },
          { id: 68, name: 'pachora_devachi_ps', displayName: getBranchName('pachora_devachi_ps') },
          { id: 69, name: 'shrirampur_rural_2_ps', displayName: getBranchName('shrirampur_rural_2_ps') },
          { id: 70, name: 'rahta_pachapati_ps', displayName: getBranchName('rahta_pachapati_ps') },
          { id: 71, name: 'akole_city_ps', displayName: getBranchName('akole_city_ps') },
          { id: 72, name: 'shrirampur_city_2_ps', displayName: getBranchName('shrirampur_city_2_ps') },
          { id: 73, name: 'sangamner_rural_2_ps', displayName: getBranchName('sangamner_rural_2_ps') },
          { id: 74, name: 'kohokade_rural_ps', displayName: getBranchName('kohokade_rural_ps') },
          { id: 75, name: 'kohokade_city_ps', displayName: getBranchName('kohokade_city_ps') },
          { id: 76, name: 'kohokade_rural_2_ps', displayName: getBranchName('kohokade_rural_2_ps') },
          { id: 77, name: 'kohokade_city_2_ps', displayName: getBranchName('kohokade_city_2_ps') }
        ]
      }
    };
  };

  const [formData, setFormData] = useState({
    receivedByOffice: '',
    recipientName: '',
    recipientDesignation: '',
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
      formDataToSend.append('recipientDesignation', formData.recipientDesignation);
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
        recipientDesignation: '',
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
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">{t.newLetter}</h2>
        
        {/* File Upload Section */}
        <div className="mb-8">
          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-blue-500 transition-colors">
            <div className="flex flex-col items-center justify-center py-8">
              <FiUpload className="w-12 h-12 text-blue-500 mb-3" />
              <h3 className="text-lg font-medium text-gray-700 mb-1">{t.uploadLetter}</h3>
              <p className="text-sm text-gray-500 mb-4">{t.dragAndDrop}</p>
              <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
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
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <FiPaperclip className="text-gray-500 mr-2" />
                      <span className="text-sm text-gray-700 truncate max-w-xs">{file.name} <span className="text-xs text-gray-400">({t.fileUploaded})</span></span>
                    </div>
                    <button 
                      type="button" 
                      className="text-gray-400 hover:text-red-500"
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
                    // This only processes the file with OCR, doesn't submit the form
                    mainFiles.forEach(file => {
                      const fileCopy = new File([file], file.name, { type: file.type });
                      extractTextFromFile(fileCopy).catch(error => {
                        console.error('Error in text extraction:', error);
                      });
                    });
                  }}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                >
                  <FiUpload className="mr-2" />
                  {t.processFile}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t.receivedByOffice}</label>
              <input
                type="text"
                name="receivedByOffice"
                value={formData.receivedByOffice}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t.recipientName}</label>
              <input
                type="text"
                name="recipientName"
                value={formData.recipientName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t.mobileNumber}</label>
              <input
                type="tel"
                name="mobileNumber"
                value={formData.mobileNumber}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>


            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t.designation}</label>
              <input
                type="text"
                name="recipientDesignation"
                value={formData.recipientDesignation}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t.letterMedium}</label>
              <select
                name="letterMedium"
                value={formData.letterMedium}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              >
                <option value="">{t.selectMedium}</option>
                <option value="hard_copy">{t.hard_copy}</option>
                <option value="soft_copy">{t.soft_copy}</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t.letterStatus}</label>
              <select
                name="letterStatus"
                value={formData.letterStatus}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              >
                <option value="">{t.selectStatus}</option>
                <option value="acknowledged">{t.acknowledged}</option>
                <option value="received">{t.received}</option>
                <option value="forwarded">{t.forwarded}</option>
                <option value="closed">{t.closed}</option>
                <option value="recall">{t.recall}</option>
                <option value="return">{t.return}</option>
                <option value="return_received">{t.return_received}</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t.letterType}</label>
              <select
                name="letterType"
                value={formData.letterType}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              >
                <option value="">{t.selectType}</option>
                
                {/* Senior Posts */}
                <optgroup label="वरिष्ठ टपाल">
                  <option value={t.senior_post_dgp}>{t.senior_post_dgp}</option>
                  <option value={t.senior_post_govt_maharashtra}>{t.senior_post_govt_maharashtra}</option>
                  <option value={t.senior_post_igp}>{t.senior_post_igp}</option>
                  <option value={t.senior_post_addl_dgp}>{t.senior_post_addl_dgp}</option>
                  <option value={t.senior_post_accountant_general}>{t.senior_post_accountant_general}</option>
                  <option value={t.senior_post_accountant_general_office}>{t.senior_post_accountant_general_office}</option>
                  <option value={t.senior_post_director_pay_verification}>{t.senior_post_director_pay_verification}</option>
                  <option value={t.senior_post_police_commissioner}>{t.senior_post_police_commissioner}</option>
                  <option value={t.senior_post_divisional_commissioner}>{t.senior_post_divisional_commissioner}</option>
                  <option value={t.senior_post_sp}>{t.senior_post_sp}</option>
                  <option value={t.senior_post_sdpo}>{t.senior_post_sdpo}</option>
                </optgroup>

                {/* Category A */}
                <optgroup label="अ वर्ग">
                  <option value={t.category_a_pm}>{t.category_a_pm}</option>
                  <option value={t.category_a_cm}>{t.category_a_cm}</option>
                  <option value={t.category_a_deputy_cm}>{t.category_a_deputy_cm}</option>
                  <option value={t.category_a_home_minister}>{t.category_a_home_minister}</option>
                  <option value={t.category_a_mos_home}>{t.category_a_mos_home}</option>
                  <option value={t.category_a_guardian_minister}>{t.category_a_guardian_minister}</option>
                  <option value={t.category_a_union_minister}>{t.category_a_union_minister}</option>
                  <option value={t.category_a_mp}>{t.category_a_mp}</option>
                  <option value={t.category_a_mla}>{t.category_a_mla}</option>
                  <option value={t.category_a_others}>{t.category_a_others}</option>
                </optgroup>

                {/* References */}
                <optgroup label="संदर्भ">
                  <option value={t.your_government_reference}>{t.your_government_reference}</option>
                  <option value={t.mla_reference}>{t.mla_reference}</option>
                  <option value={t.district_sp_reference}>{t.district_sp_reference}</option>
                  <option value={t.mp_reference}>{t.mp_reference}</option>
                  <option value={t.district_collector_reference}>{t.district_collector_reference}</option>
                  <option value={t.payment_reference}>{t.payment_reference}</option>
                  <option value={t.judicial_reference}>{t.judicial_reference}</option>
                  <option value={t.disposed_reference}>{t.disposed_reference}</option>
                  <option value={t.circular}>{t.circular}</option>
                  <option value={t.minister_reference}>{t.minister_reference}</option>
                  <option value={t.mayor_officer_councilor}>{t.mayor_officer_councilor}</option>
                  <option value={t.human_rights_reference}>{t.human_rights_reference}</option>
                  <option value={t.lokayukta_reference}>{t.lokayukta_reference}</option>
                  <option value={t.democracy_day_reference}>{t.democracy_day_reference}</option>
                  <option value={t.assembly_questions}>{t.assembly_questions}</option>
                  <option value={t.divisional_commissioner_reference}>{t.divisional_commissioner_reference}</option>
                  <option value={t.government_order}>{t.government_order}</option>
                  <option value={t.government_reference}>{t.government_reference}</option>
                </optgroup>

                {/* Category K */}
                <optgroup label="क वर्ग">
                  <option value={t.category_k_police_commissioner}>{t.category_k_police_commissioner}</option>
                  <option value={t.category_k_divisional_commissioner}>{t.category_k_divisional_commissioner}</option>
                  <option value={t.category_k_district_collector}>{t.category_k_district_collector}</option>
                  <option value={t.category_k_sainik_board}>{t.category_k_sainik_board}</option>
                  <option value={t.category_k_senior_army_officer}>{t.category_k_senior_army_officer}</option>
                  <option value={t.category_k_democracy_day}>{t.category_k_democracy_day}</option>
                  <option value={t.category_k_sdpo_nagar_city}>{t.category_k_sdpo_nagar_city}</option>
                  <option value={t.category_k_sdpo_nagar_taluka}>{t.category_k_sdpo_nagar_taluka}</option>
                  <option value={t.category_k_sdpo_sangamner}>{t.category_k_sdpo_sangamner}</option>
                  <option value={t.category_k_sdpo_shrirampur}>{t.category_k_sdpo_shrirampur}</option>
                  <option value={t.category_k_sdpo_karjat}>{t.category_k_sdpo_karjat}</option>
                  <option value={t.category_k_sdpo_shirdi}>{t.category_k_sdpo_shirdi}</option>
                  <option value={t.category_k_sdpo_shevgaon}>{t.category_k_sdpo_shevgaon}</option>
                  <option value={t.category_k_all_police_stations}>{t.category_k_all_police_stations}</option>
                  <option value={t.category_k_all_branches}>{t.category_k_all_branches}</option>
                </optgroup>

                {/* Category V - Direct Meetings */}
                <optgroup label="व वर्ग - प्रत्यक्ष भेट">
                  <option value={t.category_v_sp_ahmednagar}>{t.category_v_sp_ahmednagar}</option>
                  <option value={t.category_v_addl_sp_ahmednagar}>{t.category_v_addl_sp_ahmednagar}</option>
                </optgroup>

                {/* Legal & Administrative */}
                <optgroup label="कायदेशीर व प्रशासकीय">
                  <option value={t.confidential}>{t.confidential}</option>
                  <option value={t.approval_crime}>{t.approval_crime}</option>
                  <option value={t.error}>{t.error}</option>
                  <option value={t.hospital_record}>{t.hospital_record}</option>
                  <option value={t.earned_leave_case}>{t.earned_leave_case}</option>
                  <option value={t.parole_leave_case}>{t.parole_leave_case}</option>
                  <option value={t.weekly_diary}>{t.weekly_diary}</option>
                  <option value={t.daily_section}>{t.daily_section}</option>
                  <option value={t.fingerprint}>{t.fingerprint}</option>
                  <option value={t.medical_bill}>{t.medical_bill}</option>
                  <option value={t.tenant_verification}>{t.tenant_verification}</option>
                  <option value={t.leave_approval}>{t.leave_approval}</option>
                  <option value={t.warrant}>{t.warrant}</option>
                  <option value={t.disclosure_absentee}>{t.disclosure_absentee}</option>
                  <option value={t.deceased_summary_approval}>{t.deceased_summary_approval}</option>
                  <option value={t.visa}>{t.visa}</option>
                  <option value={t.departmental_inquiry_order}>{t.departmental_inquiry_order}</option>
                  <option value={t.final_order}>{t.final_order}</option>
                  <option value={t.district_police_press_release}>{t.district_police_press_release}</option>
                  <option value={t.annexure}>{t.annexure}</option>
                  <option value={t.office_inspection}>{t.office_inspection}</option>
                  <option value={t.vip_visit}>{t.vip_visit}</option>
                  <option value={t.bandobast}>{t.bandobast}</option>
                  <option value={t.reward_punishment}>{t.reward_punishment}</option>
                  <option value={t.in_charge_officer_order}>{t.in_charge_officer_order}</option>
                  <option value={t.do_order}>{t.do_order}</option>
                </optgroup>

                {/* Cyber & Technical */}
                <optgroup label="सायबर आणि तांत्रिक">
                  <option value={t.cyber}>{t.cyber}</option>
                  <option value={t.cdr}>{t.cdr}</option>
                  <option value={t.caf}>{t.caf}</option>
                  <option value={t.sdr}>{t.sdr}</option>
                  <option value={t.imei}>{t.imei}</option>
                  <option value={t.dump_data}>{t.dump_data}</option>
                  <option value={t.it_act}>{t.it_act}</option>
                  <option value={t.facebook}>{t.facebook}</option>
                  <option value={t.whatsapp}>{t.whatsapp}</option>
                  <option value={t.online_fraud}>{t.online_fraud}</option>
                  <option value={t.cdr_sdr_caf_ime_ipdr_dump}>{t.cdr_sdr_caf_ime_ipdr_dump}</option>
                </optgroup>

                {/* Applications */}
                <optgroup label="अर्ज">
                  <option value={t.application_branch_inquiry}>{t.application_branch_inquiry}</option>
                  <option value={t.appeal}>{t.appeal}</option>
                  <option value={t.in_service_training}>{t.in_service_training}</option>
                  <option value={t.building_branch}>{t.building_branch}</option>
                  <option value={t.pension_reference}>{t.pension_reference}</option>
                  <option value={t.govt_vehicle_license}>{t.govt_vehicle_license}</option>
                  <option value={t.bills}>{t.bills}</option>
                  <option value={t.departmental_inquiry}>{t.departmental_inquiry}</option>
                  <option value={t.kasuri_case}>{t.kasuri_case}</option>
                  <option value={t.salary_fixation}>{t.salary_fixation}</option>
                  <option value={t.transfer}>{t.transfer}</option>
                  <option value={t.local_application}>{t.local_application}</option>
                  <option value={t.nivvi_application}>{t.nivvi_application}</option>
                  <option value={t.district_soldier_application}>{t.district_soldier_application}</option>
                  <option value={t.loan_application}>{t.loan_application}</option>
                  <option value={t.democracy_application}>{t.democracy_application}</option>
                  <option value={t.confidential_application}>{t.confidential_application}</option>
                </optgroup>

                {/* Licenses & Permissions */}
                <optgroup label="परवाने आणि परवानग्या">
                  <option value={t.weapon_license}>{t.weapon_license}</option>
                  <option value={t.character_verification}>{t.character_verification}</option>
                  <option value={t.loudspeaker_license}>{t.loudspeaker_license}</option>
                  <option value={t.entertainment_noc}>{t.entertainment_noc}</option>
                  <option value={t.event_permission}>{t.event_permission}</option>
                  <option value={t.business_noc}>{t.business_noc}</option>
                  <option value={t.paid_bandobast}>{t.paid_bandobast}</option>
                  <option value={t.security_guard_agency}>{t.security_guard_agency}</option>
                  <option value={t.explosive_license}>{t.explosive_license}</option>
                  <option value={t.deity_status_k}>{t.deity_status_k}</option>
                  <option value={t.deity_status_b}>{t.deity_status_b}</option>
                  <option value={t.other_licenses}>{t.other_licenses}</option>
                </optgroup>

                {/* Portal Applications */}
                <optgroup label="पोर्टल अर्ज">
                  <option value={t.portal_pm_pg}>{t.portal_pm_pg}</option>
                  <option value={t.portal_your_government}>{t.portal_your_government}</option>
                  <option value={t.portal_home_minister}>{t.portal_home_minister}</option>  
                </optgroup>

                {/* Other Categories */}
                <optgroup label="इतर">
                  <option value={t.other}>{t.other}</option>
                  <option value={t.treasury}>{t.treasury}</option>
                  <option value={t.assessor}>{t.assessor}</option>
                  <option value={t.principal_ptc}>{t.principal_ptc}</option>
                  <option value={t.self_immolation}>{t.self_immolation}</option>
                  <option value={t.civil_rights_protection}>{t.civil_rights_protection}</option>
                  <option value={t.pcr}>{t.pcr}</option>
                  <option value={t.steno}>{t.steno}</option>
                  <option value={t.stenographer}>{t.stenographer}</option>
                </optgroup>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t.letterDate}</label>
              <input
                type="date"
                name="letterDate"
                value={formData.letterDate}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>

            
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t.office}</label>
              <select
                name="office"
                value={formData.office}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              >
                <option value="">{t.selectOffice}</option>
                <option value="District Police Officer Ahmednagar">{t.dpo_ahmednagar}</option>
                <option value="District Police Officer Pune Rural">{t.dpo_pune_rural}</option>
              <option value="District Police Officer Jalgaon">{t.dpo_jalgaon}</option>
              <option value="District Police Officer Nandurbar">{t.dpo_nandurbar}</option>
              <option value="District Police Officer Nashik Rural">{t.dpo_nashik_rural}</option>
              </select>
            </div>


            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t.officeType}</label>
              <select
                name="officeType"
                value={formData.officeType}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              >
                <option value="">{t.selectOfficeType}</option>
                <option value="IGP">{t.igp}</option>  
                <option value="SP">{t.sp}</option>
                <option value="SDPO">{t.sdpo}</option>
                <option value="Police Station">{t.police_station}</option>
              </select>
            </div>

            {formData.officeType && formData.office && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  {currentLanguage === 'mr' ? 'शाखेचे नाव' : t.officeBranchName}
                </label>
                <select
                  name="officeBranchName"
                  value={formData.officeBranchName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                >
                  <option value="">{currentLanguage === 'mr' ? 'शाखा निवडा' : `Select ${formData.officeType} Branch`}</option>
                  {availableBranches.map((branch, index) => (
                    <option key={index} value={branch.name}>
                      {branch.displayName}
                    </option>
                  ))}
                </select>
              </div>
            )}  



     
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t.typeOfAction}</label>
              <select
                name="actionType"
                value={formData.actionType}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              >
                <option value="">{t.selectAction}</option>
                <option value="proceeding">{t.proceeding}</option>
                <option value="answer">{t.answer}</option>
              </select>
            </div>          
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t.subject}</label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t.details}</label>
            <textarea
              name="details"
              value={formData.details}
              onChange={handleChange}
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Enter letter details..."
              required
            ></textarea>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">{t.remarks}</label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 bg-white/50 backdrop-blur-sm"
                placeholder="Any additional remarks..."
              ></textarea>
            </div>

            {/* Secondary Upload Section */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {currentLanguage === 'mr' ? 'अतिरिक्त संलग्नके' : 'Additional Attachments'}
              </label>
              <div className="flex items-center space-x-4">
                <label className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 transition-colors duration-200 bg-white/50 backdrop-blur-sm">
                    <FiUpload className="w-5 h-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      {currentLanguage === 'mr' ? 'अधिक फायली जोडा' : 'Add more files'}
                    </span>
                    <input 
                      type="file" 
                      className="hidden" 
                      multiple
                      onChange={handleAdditionalFilesChange}
                    />
                  </div>
                </label>
                {additionalFiles.length > 0 && (
                  <span className="text-sm text-gray-500">
                    {currentLanguage === 'mr' 
                      ? `${additionalFiles.length} फाईल${additionalFiles.length !== 1 ? 's' : ''} जोडली`
                      : `${additionalFiles.length} file${additionalFiles.length !== 1 ? 's' : ''} attached`}
                  </span>
                )}
              </div>
              {/* File preview chips */}
              {additionalFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {additionalFiles.map((file, index) => (
                    <div key={index} className="flex items-center bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-full">
                      <FiPaperclip className="mr-1.5 flex-shrink-0" />
                      <span className="truncate max-w-[120px]">{file.name}</span>
                      <button 
                        type="button" 
                        className="ml-2 text-blue-400 hover:text-blue-700"
                        onClick={() => removeAdditionalFile(index)}
                      >
                        <FiX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="submit" 
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
