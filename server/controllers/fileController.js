/// controllers/FileController.js
const { Mistral } = require('@mistralai/mistralai');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const File = require('../models/File');
require('dotenv').config();

// Initialize Mistral client
const mistralClient = new Mistral({
    apiKey: process.env.MISTRAL_API_KEY 
});

// Configure S3
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
    },
});

// Configure multer upload
const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: process.env.AWS_BUCKET_NAME,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
            const fileName = `files/${Date.now()}-${file.originalname}`;
            cb(null, fileName);
        },
    }),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1 // Only allow one file
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

// Create upload middleware
const uploadSingle = upload.single('file');

// Dynamic Letter Classification and Type Mapping
const LETTER_CLASSIFICATION_MAPPING = {
    "वरिष्ठ टपाल": {
        key: "senior_mail",
        letterTypes: {
            "senior_post_dgp": "वरिष्ठ टपाल - पोलिस महासंचालक",
            "senior_post_govt_maharashtra": "वरिष्ठ टपाल - महाराष्ट्र शासन",
            "senior_post_igp": "वरिष्ठ टपाल - विशेष पोलिस महानिरीक्षक",
            "senior_post_addl_dgp": "वरिष्ठ टपाल - अप्पर पोलिस महासंचालक",
            "senior_post_accountant_general": "वरिष्ठ टपाल - महालेखापाल कार्या नागपूर महाराष्ट्र राज्य मुंबई",
            "senior_post_accountant_general_office": "वरिष्ठ टपाल - महालेखापाल कार्यालय, महाराष्ट्र राज्य मुंबई",
            "senior_post_director_pay_verification": "वरिष्ठ टपाल - संचालक, वेतन पडताळणी पथक, नाशिक",
            "senior_post_police_commissioner": "वरिष्ठ टपाल - पोलिस आयुक्त",
            "senior_post_divisional_commissioner": "वरिष्ठ टपाल - विभागीय आयुक्त अर्धशासकीय संदर्भ",
            "senior_post_sp": "वरिष्ठ टपाल - एसपी",
            "senior_post_sdpo": "वरिष्ठ टपाल - एसडीपीओ"
        }
    },
    "अ वर्ग": {
        key: "a_class",
        letterTypes: {
            "category_a_pm": "अ वर्ग - मा. पंतप्रधान",
            "category_a_cm": "अ वर्ग - मा. मुख्यमंत्री",
            "category_a_deputy_cm": "अ वर्ग - मा. उपमुख्यमंत्री",
            "category_a_home_minister": "अ वर्ग - मा. गृहमंत्री",
            "category_a_mos_home": "अ वर्ग - मा. गृहराज्यमंत्री",
            "category_a_guardian_minister": "अ वर्ग - मा. पालक मंत्री",
            "category_a_union_minister": "अ वर्ग - केंद्रीय मंत्री",
            "category_a_mp": "अ वर्ग - खासदार",
            "category_a_mla": "अ वर्ग - आमदार",
            "category_a_others": "अ वर्ग - इतर"
        }
    },
    "संदर्भ": {
        key: "reference",
        letterTypes: {
            "your_government_reference": "आपले सरकार संदर्भ",
            "mla_reference": "आमदार संदर्भ",
            "district_sp_reference": "जि पो अधीक्षक संदर्भ",
            "mp_reference": "खासदार संदर्भ",
            "district_collector_reference": "जिल्हाधिकारी संदर्भ",
            "payment_reference": "देयके संदर्भ",
            "judicial_reference": "न्यायालयीन संदर्भ",
            "disposed_reference": "नस्ती संदर्भ",
            "circular": "परीपत्रक",
            "minister_reference": "मंत्री संदर्भ",
            "mayor_officer_councilor": "महापौर पदाधिकारी/नगरसेवक",
            "human_rights_reference": "मानवी हक्क संदर्भ",
            "lokayukta_reference": "लोक आयुक्त/उप लोक आयुक्त संदर्भ",
            "democracy_day_reference": "लोकशाही दिन संदर्भ",
            "assembly_questions": "विधानसभा तारांकिता /अतारांकित प्रश्न",
            "divisional_commissioner_reference": "विभागीय आयुक्त संदर्भ",
            "government_order": "शासन पत्र",
            "government_reference": "शासन संदर्भ"
        }
    },
    "क वर्ग": {
        key: "c_class",
        letterTypes: {
            "category_k_police_commissioner": "क वर्ग - पोलिस आयुक्त",
            "category_k_divisional_commissioner": "क वर्ग - विभागीय आयुक्त",
            "category_k_district_collector": "क वर्ग - जिल्हाधिकारी",
            "category_k_sainik_board": "क वर्ग - सैनिक बोर्ड",
            "category_k_senior_army_officer": "क वर्ग - वरिष्ठ आर्मी अधिकारी",
            "category_k_democracy_day": "क वर्ग - लोकशाही दिन",
            "category_k_sdpo_nagar_city": "क वर्ग - एस. डी. पी. ओ. नगर शहर",
            "category_k_sdpo_nagar_taluka": "क वर्ग - एस. डी. पी. ओ नगर तालुका",
            "category_k_sdpo_sangamner": "क वर्ग - एस. डी. पी. ओ. संगमनेर",
            "category_k_sdpo_shrirampur": "क वर्ग - एस. डी. पी. ओ. श्रीरामपूर",
            "category_k_sdpo_karjat": "क वर्ग - एस. डी. पी. ओ. कर्जत",
            "category_k_sdpo_shirdi": "क वर्ग - एस. डी. पी. ओ. शिर्डी",
            "category_k_sdpo_shevgaon": "क वर्ग - एस. डी. पी. ओ. शेवगांव",
            "category_k_all_police_stations": "क वर्ग - सर्व पोलिस स्टेशन",
            "category_k_all_branches": "क वर्ग - सर्व शाखा"
        }
    },
    "व वर्ग": {
        key: "direct_visit",
        letterTypes: {
            "category_v_sp_ahmednagar": "व वर्ग - मा.पो. अ.सो अहमदनगर (प्रत्यक्ष भेट)",
            "category_v_addl_sp_ahmednagar": "व वर्ग - मा. अप्पर पो.अ. अहमदनगर (प्रत्यक्ष भेट)"
        }
    },
    "कायदेशीर व प्रशासकीय": {
        key: "legal_and_administrative",
        letterTypes: {
            "confidential": "गोपनीय",
            "approval_crime": "मंजुरी गुन्हा",
            "error": "त्रुटी",
            "hospital_record": "दवाखाना नोंद",
            "earned_leave_case": "संचित रजा प्रकरण",
            "parole_leave_case": "पॅरोल रजा प्रकरण",
            "weekly_diary": "आठवडा डायरी",
            "daily_section": "डेली सेक",
            "fingerprint": "अंगुली मुद्रा",
            "medical_bill": "वैद्यकीय बील",
            "tenant_verification": "टेनंट व्हेरी फीकेशन",
            "leave_approval": "रजा मंजुरी बाबत",
            "warrant": "वॉरंट",
            "disclosure_absentee": "खुलासा/ गैरहजर",
            "deceased_summary_approval": "मयत समरी मंजूरी बाबत",
            "visa": "व्हिसा",
            "departmental_inquiry_order": "विभागीय चौकशा आदेश",
            "final_order": "अंतिम आदेश",
            "district_police_press_release": "जिल्हा पोलीस प्रसिध्दी प्रत्रक",
            "annexure": "अनुशाप्ती",
            "office_inspection": "दफ्तर तपासणी",
            "vip_visit": "व्ही आय पी दौरा",
            "bandobast": "बंदोबस्त",
            "reward_punishment": "बक्षिस /शिक्षा",
            "in_charge_officer_order": "प्रभारी अधिकारी आदेश",
            "do_order": "डी. ओ."
        }
    },
    "सायबर आणि तांत्रिक": {
        key: "cyber_technical",
        letterTypes: {
            "cyber": "सायबर",
            "cdr": "सीडीआर",
            "caf": "सीएएफ",
            "sdr": "एसडीआर",
            "imei": "आयएमईआय",
            "dump_data": "डंप डेटा",
            "it_act": "आयटी कायदा",
            "facebook": "फेसबुक",
            "whatsapp": "व्हॉट्सअॅप",
            "online_fraud": "ऑनलाईन फसवणूक",
            "cdr_sdr_caf_ime_ipdr_dump": "सीडीआर/एसडीआर/सीएएफ/आयएमई/आयपीडीआर/डंप"
        }
    },
    "अर्ज": {
        key: "application",
        letterTypes: {
            "application_branch_inquiry": "अर्ज शाखा चौकशी अहवाल",
            "appeal": "अपील",
            "in_service_training": "सेवांतर्गत प्रशिक्षण",
            "building_branch": "इमारत शाखा",
            "pension_reference": "पेन्शन संदर्भात",
            "govt_vehicle_license": "शासकीय वाहन परवाना",
            "bills": "देयके",
            "departmental_inquiry": "विभागीय चौकशी",
            "kasuri_case": "कसूरी प्रकरण",
            "salary_fixation": "वेतननिश्ती",
            "transfer": "बदली",
            "local_application": "स्थानिक अर्ज",
            "nivvi_application": "निनवी अर्ज",
            "district_soldier_application": "जिल्हासैनिक अर्ज",
            "loan_application": "सावकारी संदर्भात अर्ज",
            "democracy_application": "लोकशाही संदर्भातील अर्ज",
            "confidential_application": "गोपनीय अर्ज"
        }
    },
    "परवाने आणि परवानग्या": {
        key: "license_and_permission",
        letterTypes: {
            "weapon_license": "शस्त्र परवाना",
            "character_verification": "चारित्र्य पडताळणी",
            "loudspeaker_license": "लाउडस्पीकर परवाना",
            "entertainment_noc": "मनोरंजनाचे कार्यक्रमांना ना-हरकत परवाना",
            "event_permission": "सभा, संमेलन मिरवणूक, शोभायात्रा ई. करिता परवानगी",
            "business_noc": "गॅस, पेट्रोल, हॉटेल, बार ई करिता ना-हरकत प्रमाणपत्र",
            "paid_bandobast": "सशुल्क बंदोबस्त",
            "security_guard_agency": "सुरक्षा रक्षक एजन्सी",
            "explosive_license": "स्फोटक परवाना",
            "deity_status_k": "देवस्थान दर्जा क वर्ग",
            "deity_status_b": "देवस्थान दर्जा ब वर्ग",
            "other_licenses": "इतर परवाने"
        }
    },
    "पोर्टल अर्ज": {
        key: "portal_application",
        letterTypes: {
            "portal_pm_pg": "पोर्टल अर्ज वर्ग-पंतप्रधान (पी.जी.)",
            "portal_your_government": "पोर्टल अर्ज वर्ग-आपले सरकार",
            "portal_home_minister": "पोर्टल अर्ज वर्ग-एच ओ एम डी (गृहराज्यमंत्री)"
        }
    },
    "इतर": {
        key: "others",
        letterTypes: {
            "other": "इतर",
            "treasury": "कोषागार",
            "assessor": "समादेशक",
            "principal_ptc": "प्राचार्य - पोलीस प्रशीक्षण केंद्र",
            "self_immolation": "आत्मदहन",
            "civil_rights_protection": "नागरी हक्क संरक्षण",
            "pcr": "पीसीआर",
            "steno": "स्टेनो",
            "stenographer": "लघुलेखक"
        }
    }
};

// Helper function to convert Marathi digits to English
const convertMarathiToEnglish = (text) => {
    const marathiToEnglish = {
        '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
        '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
    };
    return text.replace(/[०-९]/g, (match) => marathiToEnglish[match] || match);
};

// Enhanced function to extract receipt date dynamically
const extractReceiptDate = (text) => {
    const textWithEnglishDigits = convertMarathiToEnglish(text);
    const combinedText = text + ' ' + textWithEnglishDigits;

    console.log('Searching for receipt date in text...');

    // Comprehensive patterns for receipt date extraction
    const receiptDatePatterns = [
        // Marathi patterns for receipt date
        /प्राप्त\s*झाल्याचा\s*दिनांक[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
        /प्राप्त\s*दिनांक[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
        /मिळाल्याचा\s*दिनांक[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
        /येत\s*दिनांक[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
        /आले\s*दिनांक[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
        /प्राप्ती\s*दिनांक[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
        /इनवर्ड\s*दिनांक[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,

        // English patterns
        /received\s*on[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
        /received\s*date[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
        /receipt\s*date[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
        /date\s*received[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,

        // Diary date patterns (often receipt date in government offices)
        /डायरी\s*दिनांक[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
        /diary\s*date[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
        /diarised\s*date[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
        /diarised\s*by[:\s]*.*?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,

        // Date in format like "15 OCT 2024", "21 MAR 2025" etc.
        /(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4})/gi,

        // Marathi month patterns
        /(\d{1,2}\s+(?:जानेवारी|फेब्रुवारी|मार्च|एप्रिल|मे|जून|जुलै|ऑगस्ट|सप्टेंबर|ऑक्टोबर|नोव्हेंबर|डिसेंबर)\s+\d{4})/gi,

        // Office stamp date patterns
        /दिनांक[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,

        // General patterns that could be receipt date
        /प्राप्त.*?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
        /received.*?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,

        // Date patterns with specific context
        /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}).*प्राप्त/gi,
        /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}).*received/gi,

        // Stamp date patterns
        /स्टॅम्प.*?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
        /stamp.*?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi
    ];

    // Try to find receipt date
    for (const pattern of receiptDatePatterns) {
        const matches = combinedText.match(pattern);
        if (matches) {
            for (const match of matches) {
                // Extract date part from match
                const dateMatch = match.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/);
                if (dateMatch) {
                    const extractedDate = dateMatch[1].trim();
                    // Validate year (should be reasonable - 2020-2030)
                    if (extractedDate.match(/20[2-3]\d/)) {
                        console.log('Found receipt date:', extractedDate);
                        return extractedDate;
                    }
                }

                // Handle month format dates like "15 OCT 2024"
                const monthMatch = match.match(/(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4})/i);
                if (monthMatch) {
                    console.log('Found receipt date (month format):', monthMatch[1]);
                    return monthMatch[1];
                }
            }
        }
    }

    console.log('No receipt date found in PDF');
    return '';
};

// FIXED Enhanced function to extract sender names and designations from document text
function extractSenderNameAndDesignation(text) {
    console.log('Starting enhanced sender extraction...');

    // Look for sender patterns at the end of the document
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Search from the bottom up for signature patterns
    const lastSection = lines.slice(-15); // Last 15 lines
    
    let bestMatch = {
        name: '',
        designation: '',
        confidence: 0
    };

    // Pattern 1: Look for "आपला विश्वासू" followed by name on next line
    for (let i = 0; i < lastSection.length - 1; i++) {
        const currentLine = lastSection[i].toLowerCase();
        const nextLine = lastSection[i + 1];
        
        if (currentLine.includes('आपला') && currentLine.includes('विश्वासू')) {
            // Check if next line has a name
            const cleanNextLine = nextLine.replace(/[()[\]{}]/g, '').trim();
            
            // Skip if it's just signature phrase repetition
            if (!cleanNextLine.toLowerCase().includes('विश्वासू') && 
                !cleanNextLine.toLowerCase().includes('आपला') &&
                cleanNextLine.length > 3) {
                
                bestMatch = {
                    name: cleanNextLine,
                    designation: '',
                    confidence: 5
                };
                break;
            }
        }
    }

    // Pattern 2: Look for name patterns in signature area
    if (bestMatch.confidence === 0) {
        for (const line of lastSection.reverse()) {
            const cleanLine = line.trim();
            
            // Skip common words and short lines
            if (cleanLine.length < 5 ||
                /^(date|place|copy|to|from|subject|ref|page|\d+|आपला|विश्वासू|your|faithfully|sincerely)$/i.test(cleanLine)) {
                continue;
            }

            // Look for name-like patterns (multiple words, proper case)
            if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/i.test(cleanLine) ||
                /^[अ-ह][क-ह]+(\s+[अ-ह][क-ह]+)+$/i.test(cleanLine)) {
                
                bestMatch = {
                    name: cleanLine,
                    designation: '',
                    confidence: 3
                };
                break;
            }
        }
    }

    // Pattern 3: Look for official designations with names
    if (bestMatch.confidence < 3) {
        const designationPatterns = [
            { pattern: /(?:colonel|कर्नल)[\s\n]*([^\n]+)/gi, designation: 'Colonel' },
            { pattern: /(?:inspector|निरीक्षक)[\s\n]*([^\n]+)/gi, designation: 'Inspector' },
            { pattern: /(?:superintendent|अधीक्षक)[\s\n]*([^\n]+)/gi, designation: 'Superintendent' },
            { pattern: /deputy\s*commander[\s\n]*([^\n]+)/gi, designation: 'Deputy Commander' },
            { pattern: /(?:संचालक|director)[\s\n]*([^\n]+)/gi, designation: 'Director' },
            { pattern: /(?:सहायक|assistant)[\s\n]*([^\n]+)/gi, designation: 'Assistant' }
        ];

        for (const patternInfo of designationPatterns) {
            const matches = text.match(patternInfo.pattern);
            if (matches) {
                for (const match of matches) {
                    const parts = match.split(/[\s\n]+/);
                    if (parts.length > 1) {
                        const extractedName = parts.slice(1).join(' ').trim()
                            .replace(/[()[\]{}]/g, '')
                            .replace(/\s+/g, ' ');

                        if (extractedName.length > 3) {
                            bestMatch = {
                                name: extractedName,
                                designation: patternInfo.designation,
                                confidence: 4
                            };
                            break;
                        }
                    }
                }
            }
            if (bestMatch.confidence > 0) break;
        }
    }

    // Format the final result
    let result = bestMatch.name;
    if (bestMatch.designation && bestMatch.designation.trim()) {
        result = `${bestMatch.name} - ${bestMatch.designation}`;
    }

    console.log(`Sender extraction result: "${result}"`);
    console.log(`Name: "${bestMatch.name}", Designation: "${bestMatch.designation}", Confidence: ${bestMatch.confidence}`);

    return {
        senderNameAndDesignation: result,
        extractedName: bestMatch.name,
        extractedDesignation: bestMatch.designation,
        confidence: bestMatch.confidence
    };
}

// Enhanced function specifically for the existing codebase
function extractSenderWithMultipleApproaches(text) {
    console.log('Enhanced sender extraction starting...');

    const result = extractSenderNameAndDesignation(text);

    if (result.extractedName) {
        console.log('Found sender:', result.extractedName);
        console.log('Designation:', result.extractedDesignation);
        return result.senderNameAndDesignation;
    }

    console.log('No sender found with enhanced extraction');
    return '';
}

// Enhanced function to extract outward letter number dynamically
const extractOutwardLetterNumber = (text) => {
    console.log('Searching for outward letter number...');

    const textWithEnglishDigits = convertMarathiToEnglish(text);
    const combinedText = text + ' ' + textWithEnglishDigits;

    const outwardLetterPatterns = [
        // Marathi patterns
        /जावक\s*पत्र\s*क्रमांक[:\s]*([A-Z0-9\/\-\u0900-\u097F]+)/gi,
        /जावक\s*क्रमांक[:\s]*([A-Z0-9\/\-\u0900-\u097F]+)/gi,
        /बाह्य\s*पत्र\s*क्रमांक[:\s]*([A-Z0-9\/\-\u0900-\u097F]+)/gi,

        // English patterns
        /outward\s*letter\s*number[:\s]*([A-Z0-9\/\-]+)/gi,
        /outward\s*no[:\s\.]*([A-Z0-9\/\-]+)/gi,
        /reference\s*no[:\s\.]*([A-Z0-9\/\-]+)/gi,
        /letter\s*ref[:\s\.]*([A-Z0-9\/\-]+)/gi,
        /ref[:\s\.]*([A-Z0-9\/\-]{3,20})/gi,

        // Government file number patterns
        /([A-Z]{1,6}\/[0-9]{1,8}\/[0-9]{4})/g,
        /([0-9]{1,6}\/[A-Z0-9]{1,8}\/[0-9]{4})/g,
        /(DESK-\d+[A-Z\-]*)/gi,
        /(DGPMS)/gi,
        /(COLAHM[A-Z0-9\-\/]*)/gi,

        // Receipt and complaint numbers
        /(?:Receipt\s*No|Receipt\s*Number)[:\s\.]*([A-Z0-9\/\-]{3,25})/gi,
        /(?:Comp\.\s*No|Complaint\s*No)[:\s\.]*([A-Z0-9\/\-]{3,25})/gi,

        // Common number patterns with context
        /(?:No\.|क्र\.|क्रमांक|Number)[:\s]*([A-Z0-9\/\-]{3,25})/gi,

        // File reference patterns
        /File\s*No[:\s\.]*([A-Z0-9\/\-]{3,25})/gi,
        /फाइल\s*क्र[:\s]*([A-Z0-9\/\-\u0900-\u097F]{3,25})/gi,

        // Letter number patterns
        /Letter\s*No[:\s\.]*([A-Z0-9\/\-]{3,25})/gi,
        /पत्र\s*क्रमांक[:\s]*([A-Z0-9\/\-\u0900-\u097F]{3,25})/gi,

        // Office specific patterns
        /(HQ\s*\d+[A-Z0-9\s]*)/gi,
        /(\d+\/[A-Z]+\/\d+)/g,

        // FIR and case numbers
        /(FIR\s*No[:\s\.]*[A-Z0-9\/\-]{3,20})/gi,
        /(Case\s*No[:\s\.]*[A-Z0-9\/\-]{3,20})/gi,

        // NCR patterns
        /(NCR\s*No[:\s\.]*[A-Z0-9\/\-]{3,20})/gi,

        // Communication reference patterns
        /([A-Z]{2,6}\-[0-9]{2,8})/g,
        /([0-9]{3,8}\/[0-9]{4})/g
    ];

    let bestMatch = '';
    let maxScore = 0;

    for (const pattern of outwardLetterPatterns) {
        const matches = combinedText.match(pattern);
        if (matches && matches.length > 0) {
            for (const match of matches) {
                // Extract the alphanumeric part
                let numberPart = '';
                if (match.includes(':') || match.includes('.')) {
                    const parts = match.split(/[:.]/);
                    numberPart = parts[parts.length - 1].trim();
                } else {
                    const numberMatch = match.match(/([A-Z0-9\/\-\u0900-\u097F]{3,25})/);
                    if (numberMatch) {
                        numberPart = numberMatch[1];
                    }
                }

                if (numberPart && numberPart.length >= 3) {
                    // Score based on patterns that typically indicate official numbers
                    let score = 0;

                    // Higher score for patterns with slashes (common in govt docs)
                    if (numberPart.includes('/')) score += 3;

                    // Higher score for patterns with specific keywords
                    if (match.toLowerCase().includes('outward')) score += 5;
                    if (match.toLowerCase().includes('ref')) score += 4;
                    if (match.toLowerCase().includes('letter')) score += 4;
                    if (match.toLowerCase().includes('जावक')) score += 5;

                    // Higher score for government office patterns
                    if (numberPart.includes('DESK')) score += 4;
                    if (numberPart.includes('DGPMS')) score += 4;
                    if (numberPart.includes('COLAHM')) score += 4;

                    // Higher score for year patterns
                    if (numberPart.match(/20[2-3]\d/)) score += 2;

                    // Prefer longer, more structured numbers
                    if (numberPart.length > 10) score += 1;

                    if (score > maxScore) {
                        maxScore = score;
                        bestMatch = numberPart.trim();
                    }
                }
            }
        }
    }

    if (bestMatch) {
        console.log('Found outward letter number:', bestMatch);
        return bestMatch;
    }

    console.log('No outward letter number found');
    return '';
};

// Function to determine letter classification and type based on content
const determineLetterClassificationAndType = (text) => {
    const cleanText = text.toLowerCase();

    // Check each classification category
    for (const [classification, config] of Object.entries(LETTER_CLASSIFICATION_MAPPING)) {
        // Check if any letter type from this classification matches the content
        for (const [typeKey, typeValue] of Object.entries(config.letterTypes)) {
            const searchText = typeValue.toLowerCase();
            const keywords = searchText.split(/[\s\-]+/).filter(word => word.length > 2);

            // Check if multiple keywords from the type are present
            const matchingKeywords = keywords.filter(keyword =>
                cleanText.includes(keyword)
            );

            if (matchingKeywords.length >= Math.min(2, keywords.length)) {
                return {
                    letterClassification: classification,
                    letterType: typeValue,
                    classificationKey: config.key,
                    typeKey: typeKey
                };
            }
        }
    }

    // Fallback: determine classification by broader patterns
    const classificationPatterns = {
        "वरिष्ठ टपाल": /वरिष्ठ|महासंचालक|महानिरीक्षक|आयुक्त/,
        "अ वर्ग": /मुख्यमंत्री|गृहमंत्री|पंतप्रधान|खासदार|आमदार/,
        "संदर्भ": /संदर्भ|reference|विधानसभा|शासन/,
        "क वर्ग": /जिल्हाधिकारी|कलेक्टर|तहसिलदार/,
        "अर्ज": /अर्ज|application|विनंती/,
        "परवाने आणि परवानग्या": /परवाना|license|permission|नोसीज/,
        "कायदेशीर व प्रशासकीय": /गोपनीय|चौकशी|रजा|वॉरंट/,
        "सायबर आणि तांत्रिक": /सायबर|cyber|फेसबुक|व्हॉट्सअॅप|online/,
        "पोर्टल अर्ज": /पोर्टल|portal/
    };

    for (const [classification, pattern] of Object.entries(classificationPatterns)) {
        if (pattern.test(cleanText)) {
            const config = LETTER_CLASSIFICATION_MAPPING[classification];
            return {
                letterClassification: classification,
                letterType: Object.values(config.letterTypes)[0], // First type as default
                classificationKey: config.key,
                typeKey: Object.keys(config.letterTypes)[0]
            };
        }
    }

    // Default fallback
    return {
        letterClassification: "इतर",
        letterType: "इतर",
        classificationKey: "others",
        typeKey: "other"
    };
};

// Enhanced function to extract mobile numbers
const extractMobileNumbers = (text) => {
    const textWithEnglishDigits = convertMarathiToEnglish(text);
    const combinedText = text + ' ' + textWithEnglishDigits;

    const phonePatterns = [
        // Enhanced Marathi patterns with दूरध्वनी क्रमांक (PRIORITY)
        /दूरध्वनी\s*क्रमांक[:\s\-]*([६-९०-९\+\s\-\(\)]{10,16})/gi,
        /दुरधनी\s*क्रमांक[:\s\-]*([६-९०-९\+\s\-\(\)]{10,16})/gi,
        /दूरध्वनी[:\s\-]*([६-९०-९\+\s\-\(\)]{10,16})/gi,

        // Standard mobile number patterns
        /मोबाइल\s*नंबर[:\s\-]*([६-९०-९\+\s\-\(\)]{10,16})/gi,
        /मोबाइल\s*क्रमांक[:\s\-]*([६-९०-९\+\s\-\(\)]{10,16})/gi,
        /मोबाइल[:\s\-]*([६-९०-९\+\s\-\(\)]{10,16})/gi,
        /फोन\s*नंबर[:\s\-]*([६-९०-९\+\s\-\(\)]{10,16})/gi,
        /फोन[:\s\-]*([६-९०-९\+\s\-\(\)]{10,16})/gi,
        /मो\.\s*([६-९०-९\+\s\-\(\)]{10,16})/gi,
        /संपर्क\s*क्रमांक[:\s\-]*([६-९०-९\+\s\-\(\)]{10,16})/gi,

        // English patterns
        /mobile\s*number[:\s\-]*([6-9\d\+\s\-\(\)]{10,16})/gi,
        /phone\s*number[:\s\-]*([6-9\d\+\s\-\(\)]{10,16})/gi,
        /contact\s*number[:\s\-]*([6-9\d\+\s\-\(\)]{10,16})/gi,
        /telephone[:\s\-]*([6-9\d\+\s\-\(\)]{10,16})/gi,
        /Mo\.\s*([6-9\d\+\s\-\(\)]{10,16})/gi,
        /Mob[:\s\-]*([6-9\d\+\s\-\(\)]{10,16})/gi,

        // Direct number patterns
        /\+91[\s\-]?[6-9]\d{9}\b/g,
        /\b[6-9]\d{9}\b/g,
        /\+९१[\s\-]?[६-९][०-९]{9}\b/g,
        /\b[६-९][०-९]{9}\b/g
    ];

    const allPhoneNumbers = [];
    phonePatterns.forEach(pattern => {
        const matches = combinedText.match(pattern) || [];
        matches.forEach(match => {
            let convertedMatch = convertMarathiToEnglish(match);
            let numbers = convertedMatch.match(/[\d\+\(\)]+/g) || [];

            numbers.forEach(number => {
                let cleanNumber = number.replace(/[^\d+]/g, '');

                if (cleanNumber.startsWith('+91') && cleanNumber.length === 13) {
                    allPhoneNumbers.push(cleanNumber);
                } else if (cleanNumber.startsWith('91') && cleanNumber.length === 12) {
                    allPhoneNumbers.push('+91' + cleanNumber.substring(2));
                } else if (cleanNumber.length === 10 && /^[6-9]/.test(cleanNumber)) {
                    allPhoneNumbers.push(cleanNumber);
                }
            });
        });
    });

    const uniqueNumbers = [...new Set(allPhoneNumbers)];
    if (uniqueNumbers.length > 0) {
        console.log('Found mobile/phone numbers:', uniqueNumbers);
        return uniqueNumbers.join(', ');
    }

    console.log('No mobile numbers found');
    return '';
};

// Main function to extract structured data dynamically
const extractStructuredData = (text) => {
    // Remove image tags and other markdown, clean the text
    const cleanText = text.replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\*\*/g, '')
        .replace(/\n\s*\n/g, '\n')
        .replace(/#+/g, '')
        .trim();

    console.log('Processing text for enhanced extraction...');

    const result = {
        dateOfReceiptOfLetter: '', // 1. पत्र मिळाल्याचा दिनांक
        officeSendingLetter: '', // 2. पत्र पाठविणारे कार्यालय
        senderNameAndDesignation: '', // 3. पत्र पाठविण्याऱ्याचे नाव व पदनाम
        mobileNumber: '', // 4. मोबाईल नंबर
        letterMedium: '', // 5. पत्राचे माध्यम
        letterClassification: '', // 6. पत्र वर्गीकरण
        letterType: '', // 7. पत्राचा प्रकार
        letterDate: '', // 8. पत्राची तारीख
        subject: '', // 9. विषय
        outwardLetterNumber: '', // 10. जावक पत्र क्रमांक
        numberOfCopies: '' // 11. सह कागद पत्राची संख्या
    };

    // Apply dynamic extractions for the main fields
    result.dateOfReceiptOfLetter = extractReceiptDate(cleanText);
    result.senderNameAndDesignation = extractSenderWithMultipleApproaches(cleanText);
    result.outwardLetterNumber = extractOutwardLetterNumber(cleanText);
    result.mobileNumber = extractMobileNumbers(cleanText);

    // Extract office sending letter
    const extractOfficeName = (text) => {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 5);

        const officePatterns = [
            /^([^।\n]*कार्यालय[^।\n]*)/i,
            /^([^।\n]*विभाग[^।\n]*)/i,
            /^([^।\n]*मंत्रालय[^।\n]*)/i,
            /जिल्हाधिकारी\s+कार्यालय[,\s]*([^\n।]+)/i,
            /पोलीस\s+अधीक्षक\s+कार्यालय[,\s]*([^\n।]+)/i,
            /([^\n]*पोलीस[^\n]*कार्यालय[^\n]*)/i,
            /([^\n]*office[^\n]*)/i
        ];

        let bestMatch = '';
        let maxScore = 0;

        lines.forEach((line, index) => {
            if (line.includes('विषय') || line.includes('अर्ज') ||
                line.includes('क्रमांक') || line.length > 200) {
                return;
            }

            officePatterns.forEach(pattern => {
                const match = line.match(pattern);
                if (match) {
                    let office = match[1] ? match[1].trim() : match[0].trim();
                    office = office.replace(/[#*(),।]/g, '').replace(/\s+/g, ' ').trim();

                    let score = 0;
                    if (office.includes('कार्यालय')) score += 3;
                    if (office.includes('विभाग')) score += 3;
                    if (office.includes('office')) score += 3;
                    if (index < 10) score += 1;

                    if (score > maxScore && office.length > 5) {
                        maxScore = score;
                        bestMatch = office;
                    }
                }
            });
        });

        return bestMatch;
    };

    result.officeSendingLetter = extractOfficeName(cleanText);

    // Extract subject
    const subjectPatterns = [
        /विषय\s*:-?\s*([^\n]+)/i,
        /Subject\s*:-?\s*([^\n]+)/i,
        /संदर्भ\s*:-?\s*([^\n]+)/i,
        /([^\n]*बाबत[^\n]*)/i,
        /RE\s*:\s*([^\n]+)/i,
        /regarding\s*:\s*([^\n]+)/i
    ];

    for (const pattern of subjectPatterns) {
        const match = cleanText.match(pattern);
        if (match && match[1] && match[1].trim().length > 5) {
            result.subject = match[1].trim();
            break;
        }
    }

    // Set letter date to today's date
    result.letterDate = new Date().toLocaleDateString('en-GB');

    // Extract letter medium
    const letterMediumPatterns = [
        { pattern: /soft copy|electronic|digital|ऑनलाइन|online|eOffice|ईमेल|email/i, type: 'soft copy' },
        { pattern: /hard copy|physical|paper|डाकेने|post|टपाल|हाताने|hand/i, type: 'hard copy' },
        { pattern: /फॅक्स|fax/i, type: 'फॅक्स' }
    ];

    for (const { pattern, type } of letterMediumPatterns) {
        if (pattern.test(cleanText)) {
            result.letterMedium = type;
            break;
        }
    }

    if (!result.letterMedium) {
        result.letterMedium = 'hard copy'; // Default
    }

    // Extract number of copies
    const copiesPatterns = [
        /प्रति[:\s]*(\d+)/gi,
        /copies[:\s]*(\d+)/gi,
        /सह कागद[:\s]*(\d+)/gi,
        /copy\s*to[:\s]*(\d+)/gi
    ];

    for (const pattern of copiesPatterns) {
        const matches = cleanText.match(pattern);
        if (matches && matches[1]) {
            result.numberOfCopies = matches[1].trim();
            break;
        }
    }

    if (!result.numberOfCopies) {
        result.numberOfCopies = '1';
    }

    // Determine letter classification and type
    const classificationResult = determineLetterClassificationAndType(cleanText);
    result.letterClassification = classificationResult.letterClassification;
    result.letterType = classificationResult.letterType;

    // Clean up all results
    Object.keys(result).forEach(key => {
        if (result[key] === null || result[key] === undefined) {
            result[key] = '';
        }
        if (typeof result[key] === 'string') {
            result[key] = result[key].replace(/\s+/g, ' ').trim();
        }
    });

    console.log('Final extracted result:', JSON.stringify(result, null, 2));
    return result;
};

// Process PDF and extract text
const processPdf = async (documentUrl) => {
    try {
        console.log('Processing PDF:', documentUrl);
        const response = await mistralClient.ocr.process({
            model: "mistral-ocr-latest",
            document: {
                type: "document_url",
                documentUrl: documentUrl
            }
        });

        // Extract text from all pages
        const fullText = response.pages
            .map(page => page.markdown || '')
            .join('\n\n')
            .trim();

        return {
            success: true,
            data: {
                text: fullText,
                pageCount: response.pages.length,
                model: response.model,
                processedAt: new Date().toISOString()
            }
        };
    } catch (error) {
        console.error('OCR Processing Error:', error);
        return {
            success: false,
            error: error.message || 'Failed to process PDF'
        };
    }
};

// Upload and process PDF with automatic data extraction AND save to database
const uploadAndExtract = (req, res) => {
    uploadSingle(req, res, async (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                error: err.message || 'File upload failed'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        try {
            const file = req.file;
            console.log(`Processing file: ${file.originalname}`);

            // Process the PDF
            const result = await processPdf(file.location);

            if (!result.success) {
                throw new Error(result.error);
            }

            // Extract structured data dynamically
            console.log('Auto-extracting structured data...');
            const structuredData = extractStructuredData(result.data.text);

            // Save to database with both OCR and structured data
            const fileRecord = await File.create({
                originalName: file.originalname,
                fileName: file.key,
                filePath: file.location,
                fileSize: file.size,
                mimeType: file.mimetype,
                fileUrl: file.location,
                uploadedAt: new Date().toISOString(),
                extractData: {
                    status: 'success',
                    text: result.data.text,
                    pageCount: result.data.pageCount,
                    model: result.data.model,
                    processedAt: result.data.processedAt,
                    structuredData: {
                        dateOfReceiptOfLetter: structuredData.dateOfReceiptOfLetter || '',
                        officeSendingLetter: structuredData.officeSendingLetter || '',
                        senderNameAndDesignation: structuredData.senderNameAndDesignation || '',
                        mobileNumber: structuredData.mobileNumber || '',
                        letterMedium: structuredData.letterMedium || '',
                        letterClassification: structuredData.letterClassification || '',
                        letterType: structuredData.letterType || '',
                        letterDate: structuredData.letterDate || '',
                        subject: structuredData.subject || '',
                        outwardLetterNumber: structuredData.outwardLetterNumber || '',
                        numberOfCopies: structuredData.numberOfCopies || ''
                    },
                    extractedAt: new Date().toISOString()
                }
            });

            // Return response with extracted data
            res.status(200).json({
                success: true,
                message: 'File uploaded and data extracted successfully',
                file: {
                    id: fileRecord.id,
                    name: fileRecord.originalName,
                    url: fileRecord.fileUrl,
                    text: result.data.text,
                    pageCount: result.data.pageCount,
                    processedAt: result.data.processedAt,
                    extractedData: structuredData
                },
                extractedData: structuredData,
                extractedAt: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to process file'
            });
        }
    });
};

// Get all files with extracted data
const getAllFiles = async (req, res) => {
    try {
        const files = await File.findAll({
            order: [['createdAt', 'DESC']],
            attributes: ['id', 'originalName', 'fileUrl', 'fileSize', 'createdAt', 'extractData']
        });

        const filesWithExtractedData = files.map(file => ({
            id: file.id,
            originalName: file.originalName,
            fileUrl: file.fileUrl,
            fileSize: file.fileSize,
            createdAt: file.createdAt,
            hasExtractedData: !!(file.extractData && file.extractData.structuredData),
            extractData: file.extractData
        }));

        res.json({ success: true, files: filesWithExtractedData });
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// Get file by ID with extracted data
const getFileById = async (req, res) => {
    try {
        const file = await File.findByPk(req.params.id);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        const responseFile = {
            id: file.id,
            originalName: file.originalName,
            fileName: file.fileName,
            filePath: file.filePath,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            fileUrl: file.fileUrl,
            uploadedAt: file.uploadedAt,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt,
            extractData: file.extractData,
            hasExtractedData: !!(file.extractData && file.extractData.structuredData),
        };

        res.json({ success: true, file: responseFile });
    } catch (error) {
        console.error('Error fetching file:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// Delete file by ID
const deleteFileById = async (req, res) => {
    try {
        const file = await File.findByPk(req.params.id);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        await file.destroy();

        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// Get extracted data with proper classification matching
const getExtractedData = async (req, res) => {
    try {
        const file = await File.findByPk(req.params.id);

        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        if (!file.extractData || !file.extractData.text) {
            return res.status(404).json({
                success: false,
                error: 'No extracted data available for this file'
            });
        }

        let structuredData;
        if (file.extractData.structuredData) {
            console.log('Using stored structured data from database');
            structuredData = file.extractData.structuredData;
        } else {
            console.log('Extracting structured data from text');
            structuredData = extractStructuredData(file.extractData.text);
        }

        const responseData = {
            dateOfReceiptOfLetter: structuredData.dateOfReceiptOfLetter || '',
            officeSendingLetter: structuredData.officeSendingLetter || '',
            senderNameAndDesignation: structuredData.senderNameAndDesignation || '',
            mobileNumber: structuredData.mobileNumber || '',
            letterMedium: structuredData.letterMedium || '',
            letterClassification: structuredData.letterClassification || '',
            letterType: structuredData.letterType || '',
            letterDate: structuredData.letterDate || '',
            subject: structuredData.subject || '',
            outwardLetterNumber: structuredData.outwardLetterNumber || '',
            numberOfCopies: structuredData.numberOfCopies || ''
        };

        const response = {
            success: true,
            data: responseData,
            extractedAt: file.extractData.extractedAt || new Date().toISOString(),
            processedAt: file.extractData.processedAt || new Date().toISOString(),
            fileInfo: {
                id: file.id,
                originalName: file.originalName,
                pageCount: file.extractData.pageCount || 0,
                model: file.extractData.model || 'mistral-ocr-latest'
            }
        };

        res.status(200).json(response);

    } catch (error) {
        console.error('Error getting extracted data:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while extracting data',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    uploadAndExtract,
    getAllFiles,
    getFileById,
    deleteFileById,
    getExtractedData,
    extractStructuredData,
    extractSenderNameAndDesignation,
    extractSenderWithMultipleApproaches
};