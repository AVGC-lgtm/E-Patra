// services/s3Service.js - Complete enhanced version with better name extraction and subject generation
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configure S3 Client (using AWS SDK v3)
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

class S3Service {
  
  // Convert image to base64
  getImageBase64(imagePath) {
    try {
      const fullPath = path.join(__dirname, '..', imagePath);
      if (fs.existsSync(fullPath)) {
        const imageBuffer = fs.readFileSync(fullPath);
        return `data:image/png;base64,${imageBuffer.toString('base64')}`;
      }
      return null;
    } catch (error) {
      console.error('Error reading image:', error);
      return null;
    }
  }

  // Determine वर्ग classification based on letterType
  determineVargClassification(letterType) {
    switch(letterType) {
      case 'NA':
        return 'ब वर्ग अर्ज';
      case 'FORWARD':
        return 'क वर्ग अर्ज';
      default:
        return 'अ वर्ग अर्ज';
    }
  }

  // Determine right header text based on letterType
  determineRightHeaderText(letterType) {
    switch(letterType) {
      case 'NA':
        return 'कक्ष ३(२) प्रत्यक्ष भेट';
      case 'FORWARD':
        return 'कक्ष ३(४) मा.जिल्हाधिकारी/सैनिक';
      default:
        return 'कक्ष ३(१)मा.पोमस अर्ज.';
    }
  }

  // Enhanced extractComplainantName function with better patterns
  extractComplainantName(letterData) {
    let name = 'अर्जदाराचे नाव';
    
    // Priority order: use pre-extracted name if available and valid
    if (letterData.complainantName && 
        letterData.complainantName !== 'अर्जदार' && 
        letterData.complainantName !== 'अर्जदाराचे नाव' &&
        letterData.complainantName.length > 2) {
      name = letterData.complainantName;
    } else if (letterData.senderName && 
               letterData.senderName !== 'अर्जदार' && 
               letterData.senderName !== 'अर्जदाराचे नाव' &&
               letterData.senderName.length > 2) {
      name = letterData.senderName;
    } else if (letterData.extractedText) {
      // Use enhanced extraction logic
      name = this.extractNameFromText(letterData.extractedText);
    }
    
    // Final cleaning and validation
    name = this.cleanAndValidateName(name);
    
    return name;
  }

  // Enhanced name extraction from text with comprehensive patterns
  extractNameFromText(extractedText) {
    if (!extractedText) return 'अर्जदाराचे नाव';
    
    // Clean text for better matching
    const cleanText = extractedText.replace(/\s+/g, ' ').trim();
    
    // Comprehensive name extraction patterns (ordered by priority)
    const namePatterns = [
      // Pattern 1: तक्रारदार - Name (most common)
      /तक्रारदार\s*[-:–—]?\s*(.+?)(?:\n|।|,|\s+रा\.|\s+वय|\s+रह|\s+यांच)/i,
      
      // Pattern 2: अर्जदार - Name
      /अर्जदार\s*[-:–—]?\s*(.+?)(?:\n|।|,|\s+रा\.|\s+वय|\s+रह|\s+यांच)/i,
      
      // Pattern 3: श्री/श्रीमती Name (formal titles)
      /(?:श्री|श्रीमती)\s+([^,\n।]+?)(?:\s+रा\.|\s+वय|\s+ता\.|\s+यांच|\s+मोबा|\s+फोन|\n|।|,)/i,
      
      // Pattern 4: नाव/नावे - Name
      /(?:नाव|नावे)\s*[-:–—]?\s*(.+?)(?:\n|।|,|\s+रा\.|\s+वय|\s+यांच)/i,
      
      // Pattern 5: आवेदक - Name
      /आवेदक\s*[-:–—]?\s*(.+?)(?:\n|।|,|\s+रा\.|\s+वय|\s+यांच)/i,
      
      // Pattern 6: Name at beginning with address/age marker
      /^(.+?)\s+(?:रा\.|वय|ता\.)/m,
      
      // Pattern 7: Name with यांच्या/यांचे/यांनी (possessive forms)
      /(.+?)\s+यांच्या\s+तक्रार|(.+?)\s+यांचे\s+अर्ज|(.+?)\s+यांनी\s+दिलेल्या/i,
      
      // Pattern 8: Name before phone/mobile
      /(.+?)(?:\s+मोबा|\s+फोन)\s*(?:नं\.?)?\s*[-:–—]?\s*\d/i,
      
      // Pattern 9: Name in subject line format
      /विषय.*?(.+?)\s+यांच्या\s+तक्रार/i,
      
      // Pattern 10: Name with common suffixes
      /(.+?)\s+(?:साहेब|जी|ची|चे|च्या)\s+(?:तक्रार|अर्ज)/i
    ];
    
    let extractedName = 'अर्जदाराचे नाव';
    
    // Try each pattern until we find a valid match
    for (const pattern of namePatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        // Get the first non-empty capturing group
        const nameCandidate = match[1] || match[2] || match[3];
        if (nameCandidate && nameCandidate.trim()) {
          extractedName = nameCandidate.trim();
          break;
        }
      }
    }

    return extractedName;
  }

  // Enhanced name cleaning and validation
  cleanAndValidateName(name) {
    if (!name) return 'अर्जदाराचे नाव';
    
    // Remove common prefixes
    name = name.replace(/^(तक्रारदार|अर्जदार|आवेदक|श्री|श्रीमती|मा\.|डॉ\.|प्रा\.)\s*/i, '');
    
    // Remove common suffixes and possessive forms
    name = name.replace(/\s*(यांचे|यांची|यांच्या|यांनी|साहेब|जी|ची|चे|च्या|बाबत|विषयी).*$/i, '');
    
    // Remove punctuation and clean up
    name = name.replace(/[,\.\-–—:;]/g, '').trim();
    name = name.replace(/\s+/g, ' ');
    
    // Remove unwanted words that might be captured
    const unwantedWords = [
      'तुमचे', 'तुमच्या', 'आपले', 'आपल्या', 'नाव', 'नावे', 
      'रा', 'वय', 'ता', 'मोबा', 'फोन', 'येथे', 'येथील', 'तक्रार', 
      'अर्ज', 'बाबत', 'विषयी', 'संदर्भात', 'अनुषंगाने'
    ];
    
    for (const word of unwantedWords) {
      name = name.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').trim();
    }
    
    // Final cleanup
    name = name.replace(/\s+/g, ' ').trim();
    
    // Validation checks
    if (!name || 
        name.length < 2 || 
        name === 'तुमचे नाव' || 
        name === 'नाव' ||
        name.match(/^\d+$/) || // Only numbers
        name.match(/^[,\.\-–—:;\s]+$/) // Only punctuation
       ) {
      return 'अर्जदाराचे नाव';
    }
    
    // Truncate if too long
    if (name.length > 50) {
      name = name.substring(0, 50) + '...';
    }
    
    return name;
  }

  // Convert application type to Marathi
  convertApplicationTypeToMarathi(letterType) {
    switch(letterType) {
      case 'NAR':
        return 'NAR';
      case 'NA':
        return 'NA';
      case 'FORWARD':
        return 'पुढे पाठवणे';
      case 'ACKNOWLEDGMENT':
        return 'पोच पावती';
      default:
        return letterType || 'NAR';
    }
  }

  // Enhanced subject line generation with complaint type detection
  generateSubjectLine(letterType, complainantName, letterData = null) {
    // Extract complaint type if letterData is available
    let complaintType = '';
    if (letterData && letterData.extractedText) {
      complaintType = this.extractComplaintType(letterData.extractedText);
    }
    
    // Generate base subject with complaint type
    let baseSubject = `${complainantName} यांच्या तक्रार अर्जाबाबत`;
    if (complaintType) {
      baseSubject = `${complainantName} यांच्या ${complaintType} तक्रार अर्जाबाबत`;
    }
    
    // Generate subject based on letter type
    switch(letterType) {
      case 'NAR':
        return `${baseSubject} - कार्यवाही न करण्याबाबत (NAR)`;
      case 'NA':
        return `${baseSubject} - आवश्यक कार्यवाही (NA)`;
      case 'FORWARD':
        return `${baseSubject} - पुढील कार्यवाहीसाठी पाठवणे`;
      case 'ACKNOWLEDGMENT':
        return `${baseSubject} - पोच पावती (ACK)`;
      default:
        return `${baseSubject} - ${letterType}`;
    }
  }

  // Extract complaint type for better subject generation
  extractComplaintType(extractedText) {
    if (!extractedText) return '';
    
    const complaintTypes = [
      { pattern: /पोलीस\s*अत्याचार/i, type: 'पोलीस अत्याचार' },
      { pattern: /गैरव्यवहार/i, type: 'गैरव्यवहार' },
      { pattern: /दुर्लक्ष/i, type: 'दुर्लक्ष' },
      { pattern: /अन्याय/i, type: 'अन्याय' },
      { pattern: /चुकीची\s*कार्यवाही/i, type: 'चुकीची कार्यवाही' },
      { pattern: /अयोग्य\s*वर्तन/i, type: 'अयोग्य वर्तन' },
      { pattern: /तपासात\s*दुर्लक्ष/i, type: 'तपासात दुर्लक्ष' },
      { pattern: /भ्रष्टाचार/i, type: 'भ्रष्टाचार' },
      { pattern: /गैरकारभार/i, type: 'गैरकारभार' }
    ];
    
    for (const { pattern, type } of complaintTypes) {
      if (pattern.test(extractedText)) {
        return type;
      }
    }
    
    return '';
  }

  // Generate table data for covering letter
  generateTableData(letterData, complainantName) {
    const currentYear = new Date().getFullYear();
    const marathiAppType = this.convertApplicationTypeToMarathi(letterData.letterType);
    
    return [
      {
        applicationNumber: `${letterData.letterNumber}/${currentYear}`,
        applicationType: marathiAppType,
        applicantName: complainantName,
        outwardNumber: `/${currentYear}`
      },
      {
        applicationNumber: `/${currentYear}`,
        applicationType: '',
        applicantName: complainantName,
        outwardNumber: `/${currentYear}`
      },
      {
        applicationNumber: '',
        applicationType: '',
        applicantName: complainantName,
        outwardNumber: `/${currentYear}`
      }
    ];
  }
  
  // Generate HTML template for covering letter with PNG images
  generateCoveringLetterHTML(letterContent, letterData) {
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')} / ${(today.getMonth() + 1).toString().padStart(2, '0')} / ${today.getFullYear()}`;
    
    // Get base64 images
    const leftLogo = this.getImageBase64('png/leftlogo.png');
    const rightLogo = this.getImageBase64('png/rightlogo.png');
    
    // Determine classifications
    const vargClassification = this.determineVargClassification(letterData.letterType);
    const rightHeaderText = this.determineRightHeaderText(letterData.letterType);
    const complainantName = this.extractComplainantName(letterData);
    
    // Use enhanced subject line generation
    const subjectLine = this.generateSubjectLine(letterData.letterType, complainantName, letterData);
    
    const tableData = this.generateTableData(letterData, complainantName);
    
    return `
<!DOCTYPE html>
<html lang="mr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>कव्हरिंग लेटर - ${letterData.letterNumber}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Noto Sans Devanagari', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
            background: #fff;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
        }
        
        .document-container {
            border: 3px solid #000;
            padding: 15px;
            background: #fff;
        }
        
        .letterhead {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            border: 2px solid #000;
        }
        
        .letterhead td {
            border: 1px solid #000;
            padding: 8px;
            vertical-align: middle;
            text-align: center;
        }
        
        .logo-cell {
            width: 80px;
            background: #f5f5f5;
        }
        
        .logo-img {
            width: 60px;
            height: 60px;
            object-fit: contain;
        }
        
        .office-title {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 3px;
            line-height: 1.2;
        }
        
        .office-subtitle {
            font-size: 12px;
            font-weight: 600;
            color: #000;
            margin-bottom: 8px;
        }
        
        .office-address {
            font-size: 10px;
            color: #333;
        }
        
        .emblem-cell {
            width: 80px;
            background: #f5f5f5;
        }
        
        .reference-section {
            display: flex;
            justify-content: space-between;
            margin: 15px 0;
            font-size: 11px;
            border-bottom: 1px solid #000;
            padding-bottom: 8px;
        }
        
        .reference-left {
            flex: 1;
        }
        
        .reference-right {
            text-align: right;
        }
        
        .subject-line {
            font-weight: 600;
            margin: 15px 0;
            text-align: center;
            padding: 8px;
            background: #f8f9fa;
            border: 1px solid #000;
            font-size: 13px;
        }
        
        .reference-number {
            font-size: 11px;
            margin: 8px 0;
            text-align: center;
        }
        
        .content-section {
            margin: 15px 0;
            text-align: justify;
            line-height: 1.6;
            font-size: 11px;
        }
        
        .content-section p {
            margin-bottom: 10px;
        }
        
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 11px;
        }
        
        .data-table th,
        .data-table td {
            border: 1px solid #000;
            padding: 8px;
            text-align: center;
            vertical-align: middle;
        }
        
        .data-table th {
            background: #f0f0f0;
            font-weight: 600;
        }
        
        .data-table .number-col {
            width: 15%;
        }
        
        .data-table .date-col {
            width: 20%;
        }
        
        .data-table .details-col {
            width: 40%;
        }
        
        .data-table .amount-col {
            width: 25%;
        }
        
        .signature-section {
            margin-top: 30px;
            text-align: right;
            font-size: 11px;
            padding: 15px 0;
        }
        
        .signature-section p {
            margin-bottom: 3px;
        }
        
        .copies-section {
            margin-top: 25px;
            font-size: 10px;
            text-align: left;
        }
        
        .copies-section p {
            margin-bottom: 2px;
        }
        
        .bold {
            font-weight: 600;
        }
        
        .underline {
            text-decoration: underline;
        }
        
        .center {
            text-align: center;
        }
        
        .indent {
            margin-left: 20px;
        }
        
        @media print {
            body {
                padding: 5px;
            }
            
            .document-container {
                border: 2px solid #000;
                padding: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="document-container">
        <!-- Letterhead -->
        <table class="letterhead">
            <tr>
                <td class="logo-cell">
                    ${leftLogo ? `<img src="${leftLogo}" alt="Left Logo" class="logo-img">` : '<div style="width: 60px; height: 60px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: bold;">महाराष्ट्र<br>पोलीस</div>'}
                </td>
                <td>
                    <div class="office-title">पोलीस अधिक्षक कार्यालय, अहिल्यानगर</div>
                    <div class="office-subtitle">(अर्ज शाखा)</div>
                    <div class="office-address">${vargClassification} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${rightHeaderText}</div>
                </td>
                <td class="emblem-cell">
                    ${rightLogo ? `<img src="${rightLogo}" alt="Right Logo" class="logo-img">` : '<div style="width: 60px; height: 60px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 20px;">🏛️</div>'}
                </td>
            </tr>
        </table>
        
        <!-- Reference Section -->
        <div class="reference-section">
            <div class="reference-left">
                <strong>अर्ज क्रमांक :-</strong> ${letterData.letterNumber}/${new Date().getFullYear()}, अर्ज शाखा, &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>जावक क्र. -</strong> /${new Date().getFullYear()}, &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>दि. ${formattedDate}</strong>
            </div>
        </div>
        
        <!-- Subject Line -->
        <div class="subject-line">
            <strong>विषय :- ${subjectLine}</strong>
        </div>
        
        <!-- Reference Number -->
        <div class="reference-number">
            उ.नि.पो.अ./पो.नि/स.पो.नि./ ___________________________
        </div>
        
        <!-- Content Section -->
        <div class="content-section">
            <pre style="font-family: 'Noto Sans Devanagari', Arial, sans-serif; white-space: pre-wrap; word-wrap: break-word; margin: 0;">${letterContent}</pre>
        </div>
        
        <!-- Data Table -->
        <table class="data-table">
            <thead>
                <tr>
                    <th class="number-col">अर्ज क्रमांक</th>
                    <th class="date-col">अर्ज प्रकार</th>
                    <th class="details-col">अर्जदाराचे नाव</th>
                    <th class="amount-col">जावक क्रमांक</th>
                </tr>
            </thead>
            <tbody>
                ${tableData.map(row => `
                <tr>
                    <td>${row.applicationNumber}</td>
                    <td>${row.applicationType}</td>
                    <td>${row.applicantName}</td>
                    <td>${row.outwardNumber}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        
        <!-- Closing Content -->
        <div class="content-section">
            <p><strong>मा.पोलीस अधिक्षक सो,</strong></p>
            <p class="indent"><strong>आदेश अनुसरणे</strong></p>
        </div>
        
        <!-- Signature Section -->
        <div class="signature-section">
            <p><strong>अर्ज शाखा प्रभारी अधिकारी,</strong></p>
            <p><strong>पोलीस अधिक्षक कार्यालय, अहिल्यानगर</strong></p>
        </div>
    </div>
</body>
</html>
    `;
  }
  
  // Generate PDF and upload to S3
  async generateAndUploadCoveringLetter(letterContent, letterData) {
    try {
      // Generate HTML
      const htmlContent = this.generateCoveringLetterHTML(letterContent, letterData);
      
      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '15mm',
          bottom: '15mm',
          left: '15mm',
          right: '15mm'
        }
      });
      
      await browser.close();
      
      // Upload PDF to S3
      const fileName = `covering-letters/${letterData.letterNumber}-${Date.now()}.pdf`;
      const pdfCommand = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileName,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      });
      
      await s3Client.send(pdfCommand);
      
      // Upload HTML to S3 as well
      const htmlFileName = `covering-letters/${letterData.letterNumber}-${Date.now()}.html`;
      const htmlCommand = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: htmlFileName,
        Body: htmlContent,
        ContentType: 'text/html',
      });
      
      await s3Client.send(htmlCommand);
      
      // Generate URLs manually
      const pdfUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      const htmlUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${htmlFileName}`;
      
      return {
        pdfUrl: pdfUrl,
        htmlUrl: htmlUrl,
        fileName: fileName,
        htmlFileName: htmlFileName
      };
      
    } catch (error) {
      console.error('Error generating and uploading covering letter:', error);
      throw new Error('Failed to generate and upload covering letter');
    }
  }
  
  // Upload file to S3
  async uploadToS3(fileBuffer, fileName, contentType) {
    try {
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `covering-letters/${fileName}`,
        Body: fileBuffer,
        ContentType: contentType,
      });
      
      await s3Client.send(command);
      
      // Generate URL manually
      const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/covering-letters/${fileName}`;
      
      return fileUrl;
      
    } catch (error) {
      console.error('Error uploading to S3:', error);
      throw new Error('Failed to upload to S3');
    }
  }
}

module.exports = new S3Service();