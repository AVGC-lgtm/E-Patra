const { Mistral } = require('@mistralai/mistralai');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const File = require('../models/File');
require('dotenv').config();

// Initialize Mistral client
const mistralClient = new Mistral({ 
    apiKey: process.env.MISTRAL_API_KEY || "B7X86kZ2MwX7Bfv3SsDn9FqAjSXKhOYW"
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

// Enhanced function to extract recipients and their designations with comprehensive Marathi support
const extractRecipientsAndDesignations = (cleanText) => {
    const recipients = [];
    
    // Enhanced patterns for comprehensive name and designation extraction including Marathi
    const enhancedRecipientPatterns = [
        // Pattern for formal addressing with titles and saheb (Enhanced)
        /मा\.?\s*([^,\n]{10,60})\s*साहेब/gi,
        /माननीय\s*([^,\n]{10,60})\s*साहेब/gi,
        
        // Pattern for Marathi titles with names
        /श्री\.?\s*([अ-ह\s]{3,40})[,\s]*([अ-ह\s]{5,50}(?:अधिकारी|अधीक्षक|सचिव|अध्यक्ष|प्रमुख|सहायक|मंत्री|आयुक्त|कलेक्टर|तहसिलदार))/gi,
        /श्रीमती\.?\s*([अ-ह\s]{3,40})[,\s]*([अ-ह\s]{5,50}(?:अधिकारी|अधीक्षक|सचिव|अध्यक्ष|प्रमुख|सहायक|मंत्री|आयुक्त|कलेक्टर|तहसिलदार))/gi,
        
        // Pattern for Dr./Adv./Mr./Ms. with titles (Enhanced with Marathi)
        /((?:Dr\.?|Adv\.?|Mr\.?|Ms\.?|श्री\.?|श्रीमती\.?|डॉ\.?)\s*[A-Za-zअ-ह\s\.]{3,40})[,\s]*([A-Za-zअ-ह\s]{5,50}(?:President|Secretary|Treasurer|Officer|अधिकारी|अधीक्षक|सचिव|अध्यक्ष|प्रमुख|सहायक|मंत्री|आयुक्त|कलेक्टर|तहसिलदार))/gi,
        
        // Pattern for police and government officials (Enhanced)
        /([A-Za-zअ-ह\s]{3,40})[,\s]*(?:पोलीस\s*अधीक्षक|पोलीस\s*अधिकारी|पोलीस\s*निरीक्षक|पोलीस\s*उपनिरीक्षक|Superintendent\s*of\s*Police|Inspector|अधिकारी|तहसिलदार|कलेक्टर|आयुक्त|जिल्हाधिकारी|उपजिल्हाधिकारी)/gi,
        
        // Pattern for formal titles with names (Enhanced)
        /(Chief\s*Secretary|पोलीस\s*महासंचालक|अपर\s*पोलीस\s*महासंचालक|मुख्यमंत्री|गृहमंत्री|राज्यमंत्री|सचिव|अतिरिक्त\s*सचिव|संयुक्त\s*सचिव)[,\s]*([A-Za-zअ-ह\s]{3,40})/gi,
        
        // Pattern for numbered list format (प्रति section) - Enhanced
        /प्रति[,\s]*\n?\s*\d+\.?\s*([A-Za-zअ-ह\s]{5,60})[,\s]*\n?\s*([A-Za-zअ-ह\s]{3,50})/gi,
        
        // Pattern for addresses with names and titles (Enhanced)
        /([A-Za-zअ-ह\s]{3,40})[,\s]*\n?\s*([A-Za-zअ-ह\s]{5,50}(?:विभाग|Department|कार्यालय|Office|मंत्रालय|Ministry|आयोग|Commission))/gi,
        
        // Pattern for names with mobile numbers nearby
        /([A-Za-zअ-ह\s]{3,40})\s*[\/\n]?\s*(?:National|N\.|राष्ट्रीय|रा\.)\s*([A-Za-zअ-ह\s]{5,40})\s*\n?\s*[6-9]\d{9}/gi,
        
        // Pattern for formal letter addressing (Enhanced)
        /The\s+([A-Za-z\s]{10,60})[,\s]*\n?\s*([A-Za-z\s]{5,50}(?:Department|Office|Ministry))/gi,
        /माननीय\s+([अ-ह\s]{10,60})[,\s]*\n?\s*([अ-ह\s]{5,50}(?:विभाग|कार्यालय|मंत्रालय))/gi,
        
        // Pattern for कक्ष अधिकारी type officials (Enhanced)
        /\(([A-Za-zअ-ह\s\.]{3,40})\)\s*\n?\s*([A-Za-zअ-ह\s]{5,50}(?:अधिकारी|विभाग|कार्यालय|मंत्रालय|आयोग))/gi,
        
        // NEW: Pattern for Marathi names with common titles
        /([अ-ह\s]{3,40})\s*(?:जी|साहेब|मॅडम)[,\s]*([अ-ह\s]{5,50}(?:अधिकारी|अधीक्षक|सचिव|अध्यक्ष|प्रमुख|सहायक|मंत्री|आयुक्त|कलेक्टर|तहसिलदार))/gi,
        
        // NEW: Pattern for government positions in Marathi
        /(मुख्यमंत्री|गृहमंत्री|राज्यमंत्री|केंद्रीय\s*मंत्री|पोलीस\s*महासंचालक|मुख्य\s*सचिव|अतिरिक्त\s*मुख्य\s*सचिव|सचिव|अतिरिक्त\s*सचिव|संयुक्त\s*सचिव|उप\s*सचिव)[,\s]*([अ-ह\s]{3,40})?/gi,
        
        // NEW: Pattern for district level officials
        /(जिल्हाधिकारी|उपजिल्हाधिकारी|तहसिलदार|नायब\s*तहसिलदार|तलाठी|ग्राम\s*सेवक)[,\s]*([अ-ह\s]{3,40})?/gi,
        
        // NEW: Pattern for police hierarchy in Marathi
        /(पोलीस\s*महासंचालक|अतिरिक्त\s*पोलीस\s*महासंचालक|पोलीस\s*महानिरीक्षक|पोलीस\s*उप\s*महानिरीक्षक|पोलीस\s*अधीक्षक|अतिरिक्त\s*पोलीस\s*अधीक्षक|पोलीस\s*उप\s*अधीक्षक|पोलीस\s*निरीक्षक|पोलीस\s*उपनिरीक्षक|पोलीस\s*हवालदार)[,\s]*([अ-ह\s]{3,40})?/gi,
        
        // NEW: Pattern for court officials
        /(न्यायाधीश|न्यायमूर्ती|न्यायाधिकारी|मुख्य\s*न्यायाधीश|जिल्हा\s*न्यायाधीश|न्यायालयीन\s*अधिकारी)[,\s]*([अ-ह\s]{3,40})?/gi,
        
        // NEW: Pattern for educational officials
        /(कुलगुरू|प्राचार्य|उप\s*प्राचार्य|मुख्याध्यापक|मुख्याध्यापिका|शिक्षण\s*अधिकारी|शिक्षण\s*निरीक्षक)[,\s]*([अ-ह\s]{3,40})?/gi,
        
        // NEW: Pattern for municipal officials
        /(महापौर|उपमहापौर|आयुक्त|उप\s*आयुक्त|सहायक\s*आयुक्त|नगर\s*सचिव|कार्यकारी\s*अधिकारी)[,\s]*([अ-ह\s]{3,40})?/gi,
        
        // NEW: Pattern for common Marathi surnames with titles
        /(पाटील|देशमुख|जाधव|शिंदे|गायकवाड|चव्हाण|कुलकर्णी|मोरे|भोसले|काळे|शेख|अहमद|खान|मुल्ला|शेळके|घोरपडे|साळुंखे|वाघ|सिंह|शर्मा|वर्मा|गुप्ता|अग्रवाल|जैन|शाह|मेहता|ठाकूर|राजपूत)\s*([अ-ह\s]{3,40})?[,\s]*([A-Za-zअ-ह\s]{5,50}(?:अधिकारी|अधीक्षक|सचिव|अध्यक्ष|प्रमुख|सहायक|मंत्री|आयुक्त|कलेक्टर|तहसिलदार))/gi
    ];
    
    // Extract recipients using all patterns
    enhancedRecipientPatterns.forEach(pattern => {
        let matches = [...cleanText.matchAll(pattern)];
        matches.forEach(match => {
            if (match[1] && match[2]) {
                const name = match[1].trim().replace(/\s+/g, ' ');
                const designation = match[2].trim().replace(/\s+/g, ' ');
                if (name.length > 2 && designation.length > 2) {
                    recipients.push(`${name}, ${designation}`);
                }
            } else if (match[1] && match[1].length > 5) {
                const fullTitle = match[1].trim().replace(/\s+/g, ' ');
                recipients.push(fullTitle);
            }
        });
    });
    
    // Additional extraction for formal addressing (Enhanced with Marathi)
    const formalPatterns = [
        // Pattern for "The + Title" format
        /The\s+(Superintendent\s+of\s+Police)[,\s]*([A-Za-zअ-ह\s]{3,30})?/gi,
        /The\s+(Chief\s+Secretary)[,\s]*([A-Za-zअ-ह\s]{3,30})?/gi,
        /The\s+(Inspector\s+General\s+of\s+Police)[,\s]*([A-Za-zअ-ह\s]{3,30})?/gi,
        
        // Pattern for police officials with locations (Enhanced)
        /पोलीस\s*अधीक्षक[,\s]*([A-Za-zअ-ह\s]{3,30})/gi,
        /पोलीस\s*महासंचालक[,\s]*([A-Za-zअ-ह\s]{3,30})?/gi,
        /पोलीस\s*महानिरीक्षक[,\s]*([A-Za-zअ-ह\s]{3,30})?/gi,
        /पोलीस\s*उप\s*महानिरीक्षक[,\s]*([A-Za-zअ-ह\s]{3,30})?/gi,
        
        // Pattern for departmental heads (Enhanced)
        /([A-Za-zअ-ह\s]{3,40})\s*विभाग/gi,
        /([A-Za-zअ-ह\s]{3,40})\s*Department/gi,
        /([A-Za-zअ-ह\s]{3,40})\s*मंत्रालय/gi,
        /([A-Za-zअ-ह\s]{3,40})\s*आयोग/gi,
        
        // NEW: Pattern for Marathi government departments
        /(गृह\s*विभाग|वित्त\s*विभाग|महसूल\s*विभाग|शिक्षण\s*विभाग|आरोग्य\s*विभाग|कृषी\s*विभाग|उद्योग\s*विभाग|परिवहन\s*विभाग|ग्रामविकास\s*विभाग|शहरी\s*विकास\s*विभाग)[,\s]*([अ-ह\s]{3,40})?/gi
    ];
    
    formalPatterns.forEach(pattern => {
        let matches = [...cleanText.matchAll(pattern)];
        matches.forEach(match => {
            if (match[1]) {
                const title = match[1].trim().replace(/\s+/g, ' ');
                if (title.length > 3) {
                    recipients.push(title);
                }
            }
            if (match[2]) {
                const location = match[2].trim().replace(/\s+/g, ' ');
                if (location.length > 2) {
                    recipients.push(`${match[1].trim()}, ${location}`);
                }
            }
        });
    });
    
    // NEW: Extract names from signature lines and letterheads
    const signaturePatterns = [
        /हस्ताक्षर[:\s]*([अ-ह\s]{3,40})/gi,
        /स्वाक्षरी[:\s]*([अ-ह\s]{3,40})/gi,
        /\(([अ-ह\s]{3,40})\)[,\s]*([अ-ह\s]{5,50}(?:अधिकारी|अधीक्षक|सचिव|अध्यक्ष|प्रमुख|सहायक|मंत्री|आयुक्त|कलेक्टर|तहसिलदार))/gi
    ];
    
    signaturePatterns.forEach(pattern => {
        let matches = [...cleanText.matchAll(pattern)];
        matches.forEach(match => {
            if (match[1]) {
                const name = match[1].trim().replace(/\s+/g, ' ');
                if (name.length > 2) {
                    if (match[2]) {
                        recipients.push(`${name}, ${match[2].trim()}`);
                    } else {
                        recipients.push(name);
                    }
                }
            }
        });
    });
    
    // Remove duplicates and clean up
    const uniqueRecipients = [...new Set(recipients)]
        .filter(recipient => 
            recipient.length > 5 && 
            !recipient.match(/^\d+$/) && 
            !recipient.includes('Email') &&
            !recipient.includes('www.') &&
            !recipient.includes('@') &&
            !recipient.includes('http') &&
            !recipient.match(/^[क्र\.\s\-\/\d०-९A-Z]+$/) &&
            !recipient.includes('Mo.') &&
            !recipient.includes('मो.') &&
            !recipient.includes('दिनांक') &&
            !recipient.includes('Date:')
        )
        .slice(0, 8); // Increased limit to capture more recipients
    
    return uniqueRecipients.join(' | ');
};

// Extract structured data from text - Enhanced version for Marathi documents
const extractStructuredData = (text) => {
    // Remove image tags and other markdown, clean the text
    const cleanText = text.replace(/!\[.*?\]\(.*?\)/g, '')
                          .replace(/\*\*/g, '')
                          .replace(/\n\s*\n/g, '\n')
                          .replace(/#+/g, '') // Remove markdown headers
                          .trim();
    
    console.log('Processing text:', cleanText.substring(0, 500)); // Debug log
    
    // Initialize result with empty fields
    const result = {
        receivedByOffice: '',
        recipientNameAndDesignation: '',
        letterType: '',
        letterDate: '',
        mobileNumber: '',
        remarks: '',
        actionType: '',
        letterStatus: '',
        letterMedium: '',
        letterSubject: '',
        officeType: '', // NEW: कार्यालयाचा प्रकार
        officeName: ''  // NEW: कार्यालय
    };
    
    // Extract all mobile numbers first (both Marathi and English digits, 10 and 12 digit formats)
    const allPhoneNumbers = [];
    
    // Function to convert Marathi digits to English
    const convertMarathiToEnglish = (text) => {
        const marathiToEnglish = {
            '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
            '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
        };
        return text.replace(/[०-९]/g, (match) => marathiToEnglish[match] || match);
    };
    
    // Convert text to have both original and English digit versions
    const textWithEnglishDigits = convertMarathiToEnglish(cleanText);
    const combinedText = cleanText + ' ' + textWithEnglishDigits;
    
    const phonePatterns = [
        // English digits patterns
        /\+91[6-9]\d{9}\b/g,
        /\b[6-9]\d{9}\b/g,
        /\b\d{5}[\s-]?\d{5}\b/g,
        /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g,
        // Marathi digits patterns
        /\+९१[६-९][०-९]{9}\b/g,
        /\b[६-९][०-९]{9}\b/g,
        /\b[०-९]{5}[\s-]?[०-९]{5}\b/g,
        /\b[०-९]{3}[\s-]?[०-९]{3}[\s-]?[०-९]{4}\b/g,
        // Mixed patterns with keywords
        /मोबाइल[:\s]*(\+?९?91)?[\s-]?([६-९६-९][०-९]{9}|[6-9]\d{9})/gi,
        /दूरध्वनी[:\s]*(\+?९?91)?[\s-]?([६-९][०-९]{9}|[6-9]\d{9})/gi,
        /फोन[:\s]*(\+?९?91)?[\s-]?([६-९][०-९]{9}|[6-9]\d{9})/gi,
        /मो\.\s*(\+?९?91)?[\s-]?([६-९][०-९]{9}|[6-9]\d{9})/gi,
        /Mo\.\s*(\+?९?91)?[\s-]?([६-९][०-९]{9}|[6-9]\d{9})/gi
    ];
    
    phonePatterns.forEach(pattern => {
        const matches = combinedText.match(pattern) || [];
        matches.forEach(match => {
            let convertedMatch = convertMarathiToEnglish(match);
            let cleanNumber = convertedMatch.replace(/[^\d+]/g, '');
            
            if (cleanNumber.startsWith('+91') && cleanNumber.length === 13) {
                allPhoneNumbers.push(cleanNumber);
            } else if (cleanNumber.startsWith('91') && cleanNumber.length === 12) {
                allPhoneNumbers.push('+' + cleanNumber);
            } else if (cleanNumber.length === 10 && /^[6-9]/.test(cleanNumber)) {
                allPhoneNumbers.push(cleanNumber);
            }
        });
    });
    
    // Remove duplicates and format mobile numbers
    const uniqueNumbers = [...new Set(allPhoneNumbers)];
    if (uniqueNumbers.length > 0) {
        result.mobileNumber = uniqueNumbers.join(',');
    }
    
    // Extract received by office (office name patterns) - Enhanced with more Marathi patterns
    const officePatterns = [
        /जिल्हाधिकारी\s+व\s+जिल्हा\s*दंडाधिकारी\s+कार्यालय[,\s]*([^\n]+)/i,
        /जिल्हाधिकारी\s+कार्यालय[,\s]*([^\n]+)/i,
        /जिल्हा\s+दंडाधिकारी\s+कार्यालय[,\s]*([^\n]+)/i,
        /पोलीस\s+अधीक्षक\s+कार्यालय[,\s]*([^\n]+)/i,
        /पोलीस\s+अधिकारी\s+कार्यालय[,\s]*([^\n]+)/i,
        /कलेक्टर\s+कार्यालय[,\s]*([^\n]+)/i,
        /तहसील\s+कार्यालय[,\s]*([^\n]+)/i,
        /नगर\s+परिषद[,\s]*([^\n]+)/i,
        /महानगरपालिका[,\s]*([^\n]+)/i,
        /ग्रामपंचायत[,\s]*([^\n]+)/i,
        /([^\n]*कार्यालय[^\n]*)/i,
        /([^\n]*विभाग[^\n]*)/i,
        /([^\n]*मंत्रालय[^\n]*)/i
    ];
    
    for (const pattern of officePatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            let office = match[1] ? match[1].trim() : match[0].trim();
            office = office.replace(/[#*(),]/g, '').replace(/\s+/g, ' ').trim();
            if (office.length > 5) {
                result.receivedByOffice = office;
                break;
            }
        }
    }
    
    if (!result.receivedByOffice) {
        const genericPatterns = [
            /जिल्हाधिकारी[^\n]*/i,
            /पोलीस[^\n]*कार्यालय[^\n]*/i,
            /कलेक्टर[^\n]*/i,
            /तहसिलदार[^\n]*/i
        ];
        
        for (const pattern of genericPatterns) {
            const match = cleanText.match(pattern);
            if (match) {
                result.receivedByOffice = match[0].replace(/[#*(),]/g, '').trim();
                break;
            }
        }
    }

    // Extract subject (विषय) - Enhanced patterns
    const subjectPatterns = [
        /विषय\s*:-?\s*([^\n]+)/i,
        /विषय\s*:?\s*([^\n]+)/i,
        /Subject\s*:-?\s*([^\n]+)/i,
        /संदर्भ\s*:-?\s*([^\n]+)/i,
        /([^\n]*बाबत[^\n]*)/i,
        /([^\n]*संदर्भात[^\n]*)/i,
        /([^\n]*विषयक[^\n]*)/i
    ];
    
    for (const pattern of subjectPatterns) {
        const match = cleanText.match(pattern);
        if (match && match[1] && match[1].trim().length > 10) {
            result.letterSubject = match[1].trim();
            break;
        }
    }

    // Use enhanced recipient extraction function
    result.recipientNameAndDesignation = extractRecipientsAndDesignations(cleanText);

    // Extract letter type from content analysis - Enhanced with comprehensive matching
    const letterTypePatterns = [
        // वरिष्ठ टपाल categories
        { pattern: /वरिष्ठ टपाल.*?पोलिस महासंचालक/i, type: 'वरिष्ठ टपाल - पोलिस महासंचालक' },
        { pattern: /वरिष्ठ टपाल.*?महाराष्ट्र शासन/i, type: 'वरिष्ठ टपाल - महाराष्ट्र शासन' },
        { pattern: /वरिष्ठ टपाल.*?विशेष पोलिस महानिरीक्षक/i, type: 'वरिष्ठ टपाल - विशेष पोलिस महानिरीक्षक' },
        { pattern: /वरिष्ठ टपाल.*?अप्पर पोलिस महासंचालक/i, type: 'वरिष्ठ टपाल - अप्पर पोलिस महासंचालक' },
        { pattern: /वरिष्ठ टपाल.*?महालेखापाल/i, type: 'वरिष्ठ टपाल - महालेखापाल कार्यालय' },
        { pattern: /वरिष्ठ टपाल.*?संचालक.*?वेतन पडताळणी/i, type: 'वरिष्ठ टपाल - संचालक, वेतन पडताळणी पथक' },
        { pattern: /वरिष्ठ टपाल.*?पोलिस आयुक्त/i, type: 'वरिष्ठ टपाल - पोलिस आयुक्त' },
        { pattern: /वरिष्ठ टपाल.*?एसपी|वरिष्ठ टपाल.*?SP/i, type: 'वरिष्ठ टपाल - एसपी' },
        { pattern: /वरिष्ठ टपाल.*?एसडीपीओ|वरिष्ठ टपाल.*?SDPO/i, type: 'वरिष्ठ टपाल - एसडीपीओ' },

        // अ वर्ग categories
        { pattern: /अ वर्ग.*?पंतप्रधान/i, type: 'अ वर्ग - मा. पंतप्रधान' },
        { pattern: /अ वर्ग.*?मुख्यमंत्री/i, type: 'अ वर्ग - मा. मुख्यमंत्री' },
        { pattern: /अ वर्ग.*?उपमुख्यमंत्री/i, type: 'अ वर्ग - मा. उपमुख्यमंत्री' },
        { pattern: /अ वर्ग.*?गृहमंत्री/i, type: 'अ वर्ग - मा. गृहमंत्री' },
        { pattern: /अ वर्ग.*?गृहराज्यमंत्री/i, type: 'अ वर्ग - मा. गृहराज्यमंत्री' },
        { pattern: /अ वर्ग.*?पालक मंत्री/i, type: 'अ वर्ग - मा. पालक मंत्री' },
        { pattern: /अ वर्ग.*?केंद्रीय मंत्री/i, type: 'अ वर्ग - केंद्रीय मंत्री' },
        { pattern: /अ वर्ग.*?खासदार/i, type: 'अ वर्ग - खासदार' },
        { pattern: /अ वर्ग.*?आमदार/i, type: 'अ वर्ग - आमदार' },

        // क वर्ग categories  
        { pattern: /क वर्ग.*?पोलिस आयुक्त/i, type: 'क वर्ग - पोलिस आयुक्त' },
        { pattern: /क वर्ग.*?विभागीय आयुक्त/i, type: 'क वर्ग - विभागीय आयुक्त' },
        { pattern: /क वर्ग.*?जिल्हाधिकारी/i, type: 'क वर्ग - जिल्हाधिकारी' },
        { pattern: /क वर्ग.*?सैनिक बोर्ड/i, type: 'क वर्ग - सैनिक बोर्ड' },
        { pattern: /क वर्ग.*?वरिष्ठ आर्मी अधिकारी/i, type: 'क वर्ग - वरिष्ठ आर्मी अधिकारी' },
        { pattern: /क वर्ग.*?लोकशाही दिन/i, type: 'क वर्ग - लोकशाही दिन' },
        { pattern: /क वर्ग.*?एस\.?\s*डी\.?\s*पी\.?\s*ओ/i, type: 'क वर्ग - एस.डी.पी.ओ' },
        { pattern: /क वर्ग.*?सर्व पोलिस स्टेशन/i, type: 'क वर्ग - सर्व पोलिस स्टेशन' },
        { pattern: /क वर्ग.*?सर्व शाखा/i, type: 'क वर्ग - सर्व शाखा' },

        // व वर्ग categories
        { pattern: /व वर्ग.*?पो\.?\s*अ\.?\s*सो/i, type: 'व वर्ग - मा.पो.अ.सो (प्रत्यक्ष भेट)' },
        { pattern: /व वर्ग.*?अप्पर पो\.?\s*अ/i, type: 'व वर्ग - मा. अप्पर पो.अ. (प्रत्यक्ष भेट)' },

        // Portal applications
        { pattern: /पोर्टल अर्ज.*?पंतप्रधान|पी\.?\s*जी/i, type: 'पोर्टल अर्ज - पंतप्रधान (पी.जी.)' },
        { pattern: /पोर्टल अर्ज.*?आपले सरकार/i, type: 'पोर्टल अर्ज - आपले सरकार' },
        { pattern: /पोर्टल अर्ज.*?एच\s*ओ\s*एम\s*डी|गृहराज्यमंत्री/i, type: 'पोर्टल अर्ज - एच ओ एम डी (गृहराज्यमंत्री)' },

        // License types
        { pattern: /शस्त्र परवाना/i, type: 'शस्त्र परवाना' },
        { pattern: /चारित्र्य पडताळणी/i, type: 'चारित्र्य पडताळणी' },
        { pattern: /लाउडस्पीकर परवाना/i, type: 'लाउडस्पीकर परवाना' },
        { pattern: /मनोरंजनाचे कार्यक्रम.*?ना-हरकत परवाना/i, type: 'मनोरंजनाचे कार्यक्रमांना ना-हरकत परवाना' },
        { pattern: /सभा.*?संमेलन.*?मिरवणूक.*?परवानगी/i, type: 'सभा, संमेलन मिरवणूक परवानगी' },
        { pattern: /गॅस.*?पेट्रोल.*?हॉटल.*?बार.*?ना-हरकत/i, type: 'गॅस, पेट्रोल, हॉटल, बार ना-हरकत प्रमाणपत्र' },
        { pattern: /सशुल्क बंदोबस्त/i, type: 'सशुल्क बंदोबस्त' },
        { pattern: /सुरक्षा रक्षक एजन्सी/i, type: 'सुरक्षा रक्षक एजन्सी' },
        { pattern: /स्फोटक परवाना/i, type: 'स्फोटक परवाना' },
        { pattern: /देवस्थान दर्जा क वर्ग/i, type: 'देवस्थान दर्जा क वर्ग' },
        { pattern: /देवस्थान दर्जा ब वर्ग/i, type: 'देवस्थान दर्जा ब वर्ग' },

        // Reference types
        { pattern: /विभागीय आयुक्त अर्धशासकीय संदर्भ/i, type: 'विभागीय आयुक्त अर्धशासकीय संदर्भ' },
        { pattern: /आपले सरकार संदर्भ/i, type: 'आपले सरकार संदर्भ' },
        { pattern: /आमदार संदर्भ/i, type: 'आमदार संदर्भ' },
        { pattern: /जि पो अधिक्षक संदर्भ/i, type: 'जि पो अधिक्षक संदर्भ' },
        { pattern: /खासदार संदर्भ/i, type: 'खासदार संदर्भ' },
        { pattern: /जिल्हाधिकारी संदर्भ/i, type: 'जिल्हाधिकारी संदर्भ' },
        { pattern: /देयके संदर्भ/i, type: 'देयके संदर्भ' },
        { pattern: /न्यायालयीन संदर्भ/i, type: 'न्यायालयीन संदर्भ' },
        { pattern: /नस्ती संदर्भ/i, type: 'नस्ती संदर्भ' },
        { pattern: /मंत्री संदर्भ/i, type: 'मंत्री संदर्भ' },
        { pattern: /महापौर पदाधिकारी|नगरसेवक/i, type: 'महापौर पदाधिकारी/नगरसेवक' },
        { pattern: /मानवी हक्क संदर्भ/i, type: 'मानवी हक्क संदर्भ' },
        { pattern: /लोक आयुक्त|उप लोक आयुक्त संदर्भ/i, type: 'लोक आयुक्त/उप लोक आयुक्त संदर्भ' },
        { pattern: /लोकशाही दिन संदर्भ/i, type: 'लोकशाही दिन संदर्भ' },
        { pattern: /विधानसभा तारांकिता|अतारांकित प्रश्न/i, type: 'विधानसभा तारांकिता/अतारांकित प्रश्न' },
        { pattern: /विभागीय आयुक्त संदर्भ/i, type: 'विभागीय आयुक्त संदर्भ' },
        { pattern: /शासन पत्र/i, type: 'शासन पत्र' },
        { pattern: /शासन संदर्भ/i, type: 'शासन संदर्भ' },

        // Special categories
        { pattern: /गोपनीय/i, type: 'गोपनीय' },
        { pattern: /मंजुरी गुन्हा/i, type: 'मंजुरी गुन्हा' },
        { pattern: /त्रुटी/i, type: 'त्रुटी' },
        { pattern: /दवाखाना नोंद/i, type: 'दवाखाना नोंद' },
        { pattern: /संचित रजा प्रकरण/i, type: 'संचित रजा प्रकरण' },
        { pattern: /पॅरोल रजा प्रकरण/i, type: 'पॅरोल रजा प्रकरण' },
        { pattern: /आठवडा डायरी/i, type: 'आठवडा डायरी' },
        { pattern: /डेली सेक/i, type: 'डेली सेक' },
        { pattern: /अंगुली मुद्रा/i, type: 'अंगुली मुद्रा' },
        { pattern: /वैद्यकीय बील/i, type: 'वैद्यकीय बील' },
        { pattern: /टेनंट व्हेरी फीकेशन/i, type: 'टेनंट व्हेरी फीकेशन' },
        { pattern: /रजा मंजुरी बाबत/i, type: 'रजा मंजुरी बाबत' },
        { pattern: /वॉरंट/i, type: 'वॉरंट' },
        { pattern: /खुलासा|गैरहजर/i, type: 'खुलासा/गैरहजर' },
        { pattern: /मयत समरी मंजूरी बाबत/i, type: 'मयत समरी मंजूरी बाबत' },
        { pattern: /व्हिसेरा/i, type: 'व्हिसेरा' },
        { pattern: /विभागीय चौकशी आदेश/i, type: 'विभागीय चौकशी आदेश' },
        { pattern: /अंतिम आदेश/i, type: 'अंतिम आदेश' },
        { pattern: /जिल्हा पोलीस प्रसिध्दी प्रत्रक/i, type: 'जिल्हा पोलीस प्रसिध्दी प्रत्रक' },
        { pattern: /अनुशाप्ती/i, type: 'अनुशाप्ती' },
        { pattern: /दफ्तर तपासणी/i, type: 'दफ्तर तपासणी' },
        { pattern: /व्ही आय पी दौरा/i, type: 'व्ही आय पी दौरा' },
        { pattern: /बंदोबस्त/i, type: 'बंदोबस्त' },
        { pattern: /बक्षिस|शिक्षा/i, type: 'बक्षिस/शिक्षा' },
        { pattern: /प्रभारी अधिकारी आदेश/i, type: 'प्रभारी अधिकारी आदेश' },
        { pattern: /डि\.?\s*ओ/i, type: 'डि.ओ' },

        // Cyber and technical
        { pattern: /सायबर/i, type: 'सायबर' },
        { pattern: /CDR/i, type: 'CDR' },
        { pattern: /CAF/i, type: 'CAF' },
        { pattern: /SDR/i, type: 'SDR' },
        { pattern: /IMEI/i, type: 'IMEI' },
        { pattern: /DUMP DATA/i, type: 'DUMP DATA' },
        { pattern: /IT ACT/i, type: 'IT ACT' },
        { pattern: /FACEBOOK/i, type: 'FACEBOOK' },
        { pattern: /ONLINE FRAUD/i, type: 'ONLINE FRAUD' },
        { pattern: /CDR\/SDR\/CAF\/IME\/IPDR\/DUMP/i, type: 'CDR/SDR/CAF/IME/IPDR/DUMP' },

        // Other categories
        { pattern: /आत्मदहन/i, type: 'आत्मदहन' },
        { pattern: /नागरी हक्क संरक्षण/i, type: 'नागरी हक्क संरक्षण' },
        { pattern: /PCR/i, type: 'PCR' },
        { pattern: /STENO/i, type: 'STENO' },
        { pattern: /लघुलेखक/i, type: 'लघुलेखक' },
        { pattern: /कोषागार/i, type: 'कोषागार' },
        { pattern: /समादेशक/i, type: 'समादेशक' },
        { pattern: /प्राचार्य.*?पोलीस प्रशीक्षण केंद्र/i, type: 'प्राचार्य - पोलीस प्रशीक्षण केंद्र' },

        // Application types
        { pattern: /अर्ज शाखा चौकशी अहवाल/i, type: 'अर्ज शाखा चौकशी अहवाल' },
        { pattern: /अपील/i, type: 'अपील' },
        { pattern: /सेवांतर्गत प्रशिक्षण/i, type: 'सेवांतर्गत प्रशिक्षण' },
        { pattern: /इमारत शाखा/i, type: 'इमारत शाखा' },
        { pattern: /पेन्शन संदर्भात/i, type: 'पेन्शन संदर्भात' },
        { pattern: /शासकीय वाहन परवाना/i, type: 'शासकीय वाहन परवाना' },
        { pattern: /विभागीय चौकशी/i, type: 'विभागीय चौकशी' },
        { pattern: /कसूरी प्रकरण/i, type: 'कसूरी प्रकरण' },
        { pattern: /वेतननिश्ती/i, type: 'वेतननिश्ती' },
        { pattern: /बदली/i, type: 'बदली' },
        { pattern: /स्थानिक अर्ज/i, type: 'स्थानिक अर्ज' },
        { pattern: /निनवी अर्ज/i, type: 'निनवी अर्ज' },
        { pattern: /जिल्हासैनिक अर्ज/i, type: 'जिल्हासैनिक अर्ज' },
        { pattern: /सावकारी संदर्भात अर्ज/i, type: 'सावकारी संदर्भात अर्ज' },
        { pattern: /लोकशाही संदर्भातील अर्ज/i, type: 'लोकशाही संदर्भातील अर्ज' },
        { pattern: /गोपनीय अर्ज/i, type: 'गोपनीय अर्ज' },

        // Generic patterns (fallback)
        { pattern: /तक्रारी.*?अर्ज|complaint.*?NAR/i, type: 'तक्रारी अर्ज' },
        { pattern: /अर्ज|application/i, type: 'अर्ज' },
        { pattern: /विनंती.*?पत्र|request/i, type: 'विनंती पत्र' },
        { pattern: /कळकळ/i, type: 'कळकळीचे पत्र' },
        { pattern: /नोंदणी/i, type: 'नोंदणी अर्ज' },
        { pattern: /सहाय्य|assistance/i, type: 'सहाय्य विनंती' },
        { pattern: /साहित्य.*?वाटप/i, type: 'साहित्य वाटप' },
        { pattern: /परिपत्रक|circular/i, type: 'परिपत्रक' },
        { pattern: /सूचना|notice/i, type: 'सूचना' },
        { pattern: /इतर परवाने/i, type: 'इतर परवाने' }
    ];

    // Find matching letter type
    for (const { pattern, type } of letterTypePatterns) {
        if (pattern.test(cleanText)) {
            result.letterType = type;
            break;
        }
    }

    // If no specific type found, set as general
    if (!result.letterType) {
        result.letterType = 'सामान्य पत्र';
    }

    // Extract date from various patterns - Enhanced
    const datePatterns = [
        /दिनांक\s*:-?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,
        /Date:\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,
        /दि\.\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,
        /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]20\d{2})/g,
        /(\d{1,2}-\d{1,2}-20\d{2})/g,
        /(\d{1,2}\/\d{1,2}\/20\d{2})/g,
        // Marathi date patterns
        /दिनांक[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
        /तारीख[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi
    ];
    
    for (const pattern of datePatterns) {
        const matches = cleanText.match(pattern);
        if (matches) {
            let date = matches[1] || matches[0];
            if (date && (date.includes('2024') || date.includes('2025') || date.includes('2023'))) {
                result.letterDate = date;
                break;
            }
        }
    }

    // Set letter status directly to pending
    result.letterStatus = 'pending';

    // Extract letter medium - Enhanced with specific soft/hard copy detection
    const letterMediumPatterns = [
        // Soft copy patterns
        { pattern: /soft copy|softcopy|electronic copy|digital copy|e-copy|ऑनलाइन|online|eOffice|ई-ऑफिस|इलेक्ट्रॉनिक|डिजिटल|ईमेल|email|इमेल/i, type: 'soft copy' },
        
        // Hard copy patterns  
        { pattern: /hard copy|hardcopy|physical copy|paper copy|print copy|printed copy|डाकेने|post|टपाल|हाताने|hand|By Hand|हस्तगत|कागदी प्रत|छपाई|प्रिंट/i, type: 'hard copy' },
        
        // Other specific mediums
        { pattern: /फॅक्स|fax|फैक्स/i, type: 'फॅक्स' },
        { pattern: /कुरियर|courier/i, type: 'कुरियर' },
        { pattern: /स्पीड पोस्ट|speed post|registered post/i, type: 'स्पीड पोस्ट' },
        { pattern: /व्हाट्सअॅप|whatsapp|SMS|message/i, type: 'व्हाट्सअॅप/SMS' }
    ];

    // Find matching letter medium
    let mediumFound = false;
    for (const { pattern, type } of letterMediumPatterns) {
        if (pattern.test(cleanText)) {
            result.letterMedium = type;
            mediumFound = true;
            break;
        }
    }

    // If no specific medium found, determine based on context
    if (!mediumFound) {
        // If document mentions digital/online elements, assume soft copy
        if (cleanText.includes('PDF') || cleanText.includes('scan') || cleanText.includes('digital') || 
            cleanText.includes('computer') || cleanText.includes('संगणक') || cleanText.includes('स्कॅन')) {
            result.letterMedium = 'soft copy';
        } 
        // If mentions postal/physical delivery, assume hard copy
        else if (cleanText.includes('डाक') || cleanText.includes('पोस्ट') || cleanText.includes('वितरण') || 
                 cleanText.includes('delivery') || cleanText.includes('हस्तक्षेप')) {
            result.letterMedium = 'hard copy';
        }
        // Default based on typical government correspondence
        else {
            result.letterMedium = 'hard copy'; // Most government letters are still hard copy
        }
    }

    // Extract action type - Enhanced with specific categories
    const actionTypePatterns = [
        // Proceeding/चालू कार्यवाही patterns
        { pattern: /proceeding|चालू कार्यवाही|कार्यवाही चालू|प्रगतीपथावर|सुरू कार्यवाही/i, type: 'proceeding / चालू कार्यवाही' },
        
        // Answer/उत्तर patterns  
        { pattern: /answer|उत्तर|प्रतिउत्तर|जबाब|पासखा|उत्तर देणे|जवाब देणे|प्रत्युत्तर/i, type: 'answer / उत्तर' },
        
        // Other specific action types
        { pattern: /चौकशी|inquiry|तपास|investigation/i, type: 'चौकशी' },
        { pattern: /तपासणी|inspection|निरीक्षण/i, type: 'तपासणी' },
        { pattern: /कारवाई|action|कार्यवाही/i, type: 'कारवाई' },
        { pattern: /निर्गती|disposal|निकाल/i, type: 'निर्गती' },
        { pattern: /फॉरवर्ड|forward|पुढे पाठवा|पुढे पाठवणे/i, type: 'पुढे पाठवणे' },
        { pattern: /सहाय्य|assistance|मदत/i, type: 'सहाय्य' },
        { pattern: /माहिती|information|विचारपूस/i, type: 'माहिती' },
        { pattern: /वाटप|distribution|वितरण/i, type: 'वाटप' },
        { pattern: /अनुदान|grant|मंजुरी/i, type: 'अनुदान' },
        { pattern: /मंजूरी|approval|परवानगी/i, type: 'मंजूरी' },
        { pattern: /नोंदणी|registration|नावनोंदणी/i, type: 'नोंदणी' },
        { pattern: /तक्रार|complaint|फिर्याद/i, type: 'तक्रार निवारण' },
        { pattern: /अर्ज|application|विनंती/i, type: 'अर्ज प्रक्रिया' }
    ];

    // Find matching action type
    for (const { pattern, type } of actionTypePatterns) {
        if (pattern.test(cleanText)) {
            result.actionType = type;
            break;
        }
    }

    // If no specific action type found, set as general
    if (!result.actionType) {
        result.actionType = 'सामान्य';
    }

    // Extract remarks (improved to get meaningful content) - Enhanced
    const remarksPatterns = [
        /विषय\s*:?-?\s*([^।\n]+)/i,
        /([^।\n]*बाबत[^।\n]*)/i,
        /उपरोक्त\s+विषयान्वये\s+([^।\n]+)/i,
        /संदर्भ[:\s]*([^।\n]+)/i,
        /कळविण्यात\s+येते\s+की\s*([^।\n]+)/i,
        /नम्र\s+विनंती\s+(?:की\s*)?([^।\n]+)/i,
        /अर्ज\s+करतो\s+की\s*([^।\n]+)/i,
        /माहिती\s+देण्यात\s+येते\s+की\s*([^।\n]+)/i,
        /सविनय\s+निवेदन\s+([^।\n]+)/i,
        /विनंती\s+आहे\s+की\s*([^।\n]+)/i
    ];
    
    for (const pattern of remarksPatterns) {
        const match = cleanText.match(pattern);
        if (match && match[1]) {
            let remark = match[1].trim().replace(/\s+/g, ' ').trim();
            
            if (remark.length > 15 && 
                !remark.match(/^[क्र\.\s\-\/\d०-९A-Z]+$/) &&
                !remark.match(/^[\d\/\-\.E]+$/)) {
                result.remarks = remark;
                break;
            }
        }
    }
    
    if (!result.remarks) {
        const lines = cleanText.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine.length > 25 && 
                !trimmedLine.includes('कार्यालय') &&
                !trimmedLine.includes('Email:') &&
                !trimmedLine.includes('www.') &&
                !trimmedLine.includes('@') &&
                !trimmedLine.match(/^[क्र\.\s\-\/\d०-९A-Z]+$/) &&
                !trimmedLine.includes('मो.') &&
                !trimmedLine.includes('Mo.') &&
                !trimmedLine.includes('प्रति') &&
                !trimmedLine.includes('दिनांक') &&
                (trimmedLine.includes('साहित्य') || 
                 trimmedLine.includes('उपकरणे') ||
                 trimmedLine.includes('संगणक') ||
                 trimmedLine.includes('धोरण') ||
                 trimmedLine.includes('वाटप') ||
                 trimmedLine.includes('करणे') ||
                 trimmedLine.includes('मागणी') ||
                 trimmedLine.includes('विनंती') ||
                 trimmedLine.includes('बाबत') ||
                 trimmedLine.includes('संदर्भात') ||
                 trimmedLine.includes('अनुदान') ||
                 trimmedLine.includes('योजना') ||
                 trimmedLine.includes('कार्यक्रम'))) {
                
                result.remarks = trimmedLine.replace(/\s+/g, ' ').substring(0, 300);
                break;
            }
        }
    }

    if (!result.remarks) {
        result.remarks = 'दस्तऐवजाचा मुख्य मजकूर उपलब्ध नाही';
    }

    // Extract office type (कार्यालयाचा प्रकार) - NEW
    const officeTypePatterns = [
        { pattern: /आयजीपी|IGP|Inspector\s+General\s+of\s+Police|पोलीस\s+महानिरीक्षक/i, type: 'IGP (आयजीपी)' },
        { pattern: /एसपी|SP|Superintendent\s+of\s+Police|पोलीस\s+अधीक्षक(?!\s+कार्यालय)/i, type: 'SP (एसपी)' },
        { pattern: /एसडीपीओ|SDPO|Sub\s+Divisional\s+Police\s+Officer|उप\s+विभागीय\s+पोलीस\s+अधिकारी/i, type: 'SDPO (एसडीपीओ)' },
        { pattern: /पोलीस\s+स्टेशन|Police\s+Station|PS|पो\.?\s*स्टे/i, type: 'Police Station (पोलीस स्टेशन)' },
        { pattern: /पोलीस\s+अधीक्षक\s+कार्यालय|District\s+Superintendent\s+of\s+Police|जिल्हा\s+पोलीस\s+अधीक्षक/i, type: 'SP (एसपी)' }
    ];

    // Find matching office type
    for (const { pattern, type } of officeTypePatterns) {
        if (pattern.test(cleanText)) {
            result.officeType = type;
            break;
        }
    }

    // If no specific office type found, determine from context
    if (!result.officeType) {
        if (cleanText.includes('महानिरीक्षक') || cleanText.includes('Inspector General')) {
            result.officeType = 'IGP (आयजीपी)';
        } else if (cleanText.includes('अधीक्षक') || cleanText.includes('Superintendent')) {
            result.officeType = 'SP (एसपी)';
        } else if (cleanText.includes('उप विभागीय') || cleanText.includes('Sub Divisional')) {
            result.officeType = 'SDPO (एसडीपीओ)';
        } else if (cleanText.includes('पोलीस स्टेशन') || cleanText.includes('Police Station')) {
            result.officeType = 'Police Station (पोलीस स्टेशन)';
        }
    }

    // Extract specific office name (कार्यालय) - FIXED for precise matching
    const officeNamePatterns = [
        // PRIORITY: Your 5 specific target offices (exact matching first)
        { 
            pattern: /अहिल्यानगर|Ahilyanagar/i, 
            name: 'जिल्हा पोलीस अधीक्षक अहिल्यानगर (District Superintendent of Police Ahilyanagar)' 
        },
        { 
            pattern: /पुणे.*?ग्रामीण|ग्रामीण.*?पुणे|Pune.*?Rural|Rural.*?Pune/i, 
            name: 'जिल्हा पोलीस अधीक्षक पुणे ग्रामीण (District Superintendent of Police Pune Rural)' 
        },
        { 
            pattern: /जळगाव|Jalgaon/i, 
            name: 'जिल्हा पोलीस अधीक्षक जळगाव (District Superintendent of Police Jalgaon)' 
        },
        { 
            pattern: /नंदुरबार|Nandurbar/i, 
            name: 'जिल्हा पोलीस अधीक्षक नंदुरबार (District Superintendent of Police Nandurbar)' 
        },
        { 
            pattern: /नाशिक.*?ग्रामीण|ग्रामीण.*?नाशिक|Nashik.*?Rural|Rural.*?Nashik/i, 
            name: 'जिल्हा पोलीस अधीक्षक नाशिक ग्रामीण (District Superintendent of Police Nashik Rural)' 
        }
    ];

    // Find matching office name - ONLY your 5 target offices
    for (const { pattern, name } of officeNamePatterns) {
        if (pattern.test(cleanText)) {
            result.officeName = name;
            break;
        }
    }

    // If no specific office found, leave empty (don't use receivedByOffice fallback)
    if (!result.officeName) {
        result.officeName = '';
    }

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

// MODIFIED: Upload and process PDF with automatic data extraction AND save to database
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

            // EXTRACT STRUCTURED DATA FIRST
            console.log('Auto-extracting structured data...');
            const structuredData = extractStructuredData(result.data.text);

            // Save to database with BOTH OCR and structured data
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
                    // ADD STRUCTURED DATA TO DATABASE
                    structuredData: {
                        receivedByOffice: structuredData.receivedByOffice || '',
                        recipientNameAndDesignation: structuredData.recipientNameAndDesignation || '',
                        letterType: structuredData.letterType || '',
                        letterDate: structuredData.letterDate || '',
                        mobileNumber: structuredData.mobileNumber || '',
                        remarks: structuredData.remarks || '',
                        actionType: structuredData.actionType || '',
                        letterStatus: structuredData.letterStatus || '',
                        letterMedium: structuredData.letterMedium || '',
                        letterSubject: structuredData.letterSubject || '',
                        officeType: structuredData.officeType || '', // NEW
                        officeName: structuredData.officeName || ''  // NEW
                    },
                    extractedAt: new Date().toISOString()
                }
            });
            
            // Return response with both file info AND extracted data
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
                    // INCLUDE EXTRACTED DATA IN FILE OBJECT
                    extractedData: {
                        receivedByOffice: structuredData.receivedByOffice || '',
                        recipientNameAndDesignation: structuredData.recipientNameAndDesignation || '',
                        letterType: structuredData.letterType || '',
                        letterDate: structuredData.letterDate || '',
                        mobileNumber: structuredData.mobileNumber || '',
                        remarks: structuredData.remarks || '',
                        actionType: structuredData.actionType || '',
                        letterStatus: structuredData.letterStatus || '',
                        letterMedium: structuredData.letterMedium || '',
                        letterSubject: structuredData.letterSubject || '',
                        officeType: structuredData.officeType || '', // NEW
                        officeName: structuredData.officeName || ''  // NEW
                    }
                },
                // ALSO INCLUDED AT ROOT LEVEL (for backwards compatibility)
                extractedData: {
                    receivedByOffice: structuredData.receivedByOffice || '',
                    recipientNameAndDesignation: structuredData.recipientNameAndDesignation || '',
                    letterType: structuredData.letterType || '',
                    letterDate: structuredData.letterDate || '',
                    mobileNumber: structuredData.mobileNumber || '',
                    remarks: structuredData.remarks || '',
                    actionType: structuredData.actionType || '',
                    letterStatus: structuredData.letterStatus || '',
                    letterMedium: structuredData.letterMedium || '',
                    letterSubject: structuredData.letterSubject || '',
                    officeType: structuredData.officeType || '', // NEW
                    officeName: structuredData.officeName || ''  // NEW
                },
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

// Get all files - ENHANCED to include extracted data
const getAllFiles = async (req, res) => {
    try {
        const files = await File.findAll({ 
            order: [['createdAt', 'DESC']],
            attributes: ['id', 'originalName', 'fileUrl', 'fileSize', 'createdAt', 'extractData']
        });
        
        // Include extracted data in the response for each file
        const filesWithExtractedData = files.map(file => ({
            id: file.id,
            originalName: file.originalName,
            fileUrl: file.fileUrl,
            fileSize: file.fileSize,
            createdAt: file.createdAt,
            hasExtractedData: !!(file.extractData && file.extractData.structuredData),
            extractedData: file.extractData && file.extractData.structuredData ? file.extractData.structuredData : null
        }));
        
        res.json({ success: true, files: filesWithExtractedData });
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// Get file by ID - ENHANCED to include extracted data
const getFileById = async (req, res) => {
    try {
        const file = await File.findByPk(req.params.id);
        if (!file) {
            return res.status(404).json({ 
                success: false, 
                error: 'File not found' 
            });
        }
        
        // Include extracted data in the response
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
            extractedData: file.extractData && file.extractData.structuredData ? file.extractData.structuredData : null
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
        
        // TODO: Delete file from S3
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

// ENHANCED: Get extracted data - uses stored data when available
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

        // Check if structured data already exists in database
        let structuredData;
        if (file.extractData.structuredData) {
            console.log('Using stored structured data from database');
            structuredData = file.extractData.structuredData;
        } else {
            console.log('Extracting structured data from text');
            // Extract structured data from the text using improved function
            structuredData = extractStructuredData(file.extractData.text);
        }
        
        // Debug log to see extracted data
        console.log('Final structured data:', JSON.stringify(structuredData, null, 2));
        
        // Prepare response data with all required fields
        const responseData = {
            receivedByOffice: structuredData.receivedByOffice || '',
            recipientNameAndDesignation: structuredData.recipientNameAndDesignation || '',
            letterType: structuredData.letterType || '',
            letterDate: structuredData.letterDate || '',
            mobileNumber: structuredData.mobileNumber || '',
            remarks: structuredData.remarks || '',
            actionType: structuredData.actionType || '',
            letterStatus: structuredData.letterStatus || '',
            letterMedium: structuredData.letterMedium || '',
            letterSubject: structuredData.letterSubject || '',
            officeType: structuredData.officeType || '', // NEW
            officeName: structuredData.officeName || ''  // NEW
        };
        
        // Format the final response
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

// Helper functions (kept for compatibility)
const extractBetween = (text, start, end) => {
    const regex = new RegExp(`${start}(.*?)${end}`, 's');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
};

const findLinesContaining = (text, searchText) => {
    return text.split('\n').filter(line => line.includes(searchText));
};

module.exports = {
    uploadAndExtract,
    getAllFiles,
    getFileById,
    deleteFileById,
    getExtractedData,
    extractStructuredData // Export for testing/reuse
};