// services/s3Service.js - UPDATED VERSION with Enhanced Digital Signature Support and Proper Positioning
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { PDFDocument, rgb } = require('pdf-lib');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Try different fetch methods based on Node.js version
let fetch;
try {
  // For Node.js 18+ (built-in fetch)
  fetch = globalThis.fetch;
  if (!fetch) {
    throw new Error('Built-in fetch not available');
  }
  console.log('Using built-in fetch');
} catch (e) {
  try {
    // For older Node.js versions (node-fetch)
    fetch = require('node-fetch');
    console.log('Using node-fetch');
  } catch (e2) {
    console.log('Neither built-in fetch nor node-fetch available, will use AWS SDK');
    fetch = null;
  }
}

// Configure S3 Client (using AWS SDK v3)
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY,
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
      console.warn(`Image not found at path: ${fullPath}`);
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

  // ENHANCED: Calculate signature position to avoid overlaps
  calculateSignaturePosition(pageWidth, pageHeight, signatureWidth, signatureHeight, position, existingSignatures = []) {
    const margin = 40;
    let x, y;
    
    // Base positions
    const positions = {
      'top-right': {
        x: pageWidth - signatureWidth - margin,
        y: pageHeight - signatureHeight - 120 // Position above signature section
      },
      'top-left': {
        x: margin,
        y: pageHeight - signatureHeight - 120
      },
      'center': {
        x: (pageWidth - signatureWidth) / 2,
        y: (pageHeight - signatureHeight) / 2
      },
      'bottom-right': {
        x: pageWidth - signatureWidth - margin,
        y: margin + 30
      },
      'bottom-left': {
        x: margin,
        y: margin + 30
      },
      'bottom-center': {
        x: (pageWidth - signatureWidth) / 2,
        y: margin + 30
      }
    };
    
    // Get base position
    const basePos = positions[position] || positions['top-right'];
    x = basePos.x;
    y = basePos.y;
    
    // FIXED: Adjust for multiple signatures to avoid overlap
    if (existingSignatures && existingSignatures.length > 0) {
      console.log(`📍 Adjusting position for ${existingSignatures.length} existing signatures`);
      
      // For each existing signature, move the new one to avoid overlap
      const signatureSpacing = signatureHeight + 25; // Space between signatures
      
      switch (position) {
        case 'top-right':
        case 'top-left':
          // Stack signatures vertically downward
          y = y - (existingSignatures.length * signatureSpacing);
          break;
          
        case 'bottom-right':
        case 'bottom-left':
        case 'bottom-center':
          // Stack signatures vertically upward
          y = y + (existingSignatures.length * signatureSpacing);
          break;
          
        case 'center':
          // For center, alternate left and right
          if (existingSignatures.length % 2 === 0) {
            x = x + 120; // Move right
          } else {
            x = x - 120; // Move left
          }
          y = y + (Math.floor(existingSignatures.length / 2) * signatureSpacing);
          break;
      }
    }
    
    // Ensure signature stays within page bounds
    x = Math.max(margin, Math.min(x, pageWidth - signatureWidth - margin));
    y = Math.max(margin, Math.min(y, pageHeight - signatureHeight - margin));
    
    console.log(`📍 Final signature position: x=${x}, y=${y}, position=${position}, existing=${existingSignatures.length}`);
    
    return { x, y };
  }

  // ENHANCED: Download PDF from S3 URL using AWS SDK (MAIN FIX)
  async downloadPDFFromS3(pdfUrl) {
    try {
      console.log('📥 Downloading PDF from S3:', pdfUrl);
      
      // Validate URL
      if (!pdfUrl || typeof pdfUrl !== 'string') {
        throw new Error('Invalid PDF URL provided');
      }

      // Extract bucket and key from URL
      let bucketName, key;
      try {
        if (pdfUrl.includes('.s3.')) {
          // Format: https://bucket-name.s3.region.amazonaws.com/path/file.pdf
          const urlParts = pdfUrl.replace('https://', '').split('/');
          bucketName = urlParts[0].split('.s3.')[0];
          key = urlParts.slice(1).join('/');
        } else if (pdfUrl.includes('s3.amazonaws.com')) {
          // Format: https://s3.amazonaws.com/bucket-name/path/file.pdf  
          const urlParts = pdfUrl.replace('https://s3.amazonaws.com/', '').split('/');
          bucketName = urlParts[0];
          key = urlParts.slice(1).join('/');
        } else {
          throw new Error('Unrecognized S3 URL format');
        }
      } catch (parseError) {
        throw new Error(`Failed to parse S3 URL: ${parseError.message}`);
      }
      
      console.log('📊 S3 Download details:', { bucketName, key });
      
      // Validate bucket and key
      if (!bucketName || !key) {
        throw new Error('Could not extract bucket name or key from URL');
      }

      // Use AWS SDK to download (PRIMARY METHOD)
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key
      });
      
      try {
        const response = await s3Client.send(command);
        
        // Convert stream to buffer
        const chunks = [];
        for await (const chunk of response.Body) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        
        if (buffer.length === 0) {
          throw new Error('Downloaded PDF is empty');
        }
        
        console.log('✅ PDF downloaded successfully via AWS SDK, size:', buffer.length, 'bytes');
        return buffer;
        
      } catch (awsError) {
        console.error('❌ AWS SDK download failed:', awsError.message);
        throw awsError;
      }
      
    } catch (error) {
      console.error('❌ Error downloading PDF from S3 via AWS SDK:', error);
      
      // Fallback to fetch if AWS SDK fails
      if (fetch) {
        try {
          console.log('🔄 Trying fallback fetch method...');
          const response = await fetch(pdfUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          if (arrayBuffer.byteLength === 0) {
            throw new Error('Downloaded PDF is empty via fetch');
          }
          
          console.log('✅ PDF downloaded successfully via fetch, size:', arrayBuffer.byteLength, 'bytes');
          return arrayBuffer;
        } catch (fetchError) {
          console.error('❌ Fetch fallback also failed:', fetchError);
          throw new Error(`Both AWS SDK and fetch failed. AWS SDK: ${error.message}, Fetch: ${fetchError.message}`);
        }
      } else {
        throw new Error(`AWS SDK failed and fetch not available: ${error.message}`);
      }
    }
  }

  // ENHANCED: Convert base64 signature to image buffer (for signature overlay)
  base64ToImageBuffer(base64String) {
    try {
      console.log('🖼️ Converting base64 to image buffer...');
      
      // Enhanced validation
      if (!base64String || typeof base64String !== 'string') {
        throw new Error('Signature data is missing or invalid type');
      }
      
      if (base64String.length < 50) {
        throw new Error(`Signature data is too small (${base64String.length} chars) - file may be corrupted or empty`);
      }
      
      // Remove data URL prefix if present and validate
      let base64Data = base64String;
      if (base64String.startsWith('data:')) {
        const parts = base64String.split(',');
        if (parts.length !== 2) {
          throw new Error('Invalid data URL format');
        }
        base64Data = parts[1];
        console.log('📝 Removed data URL prefix, remaining length:', base64Data.length);
      }
      
      if (!base64Data || base64Data.length < 20) {
        throw new Error(`No valid base64 data found (${base64Data.length} chars after processing)`);
      }
      
      // Validate base64 format
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(base64Data)) {
        throw new Error('Invalid base64 characters detected');
      }
      
      try {
        const buffer = Buffer.from(base64Data, 'base64');
        console.log('✅ Signature converted to buffer, size:', buffer.length, 'bytes');
        
        if (buffer.length < 100) {
          throw new Error(`Signature file appears to be corrupted or too small (${buffer.length} bytes)`);
        }
        
        // Additional validation: check for common image file headers
        const header = buffer.slice(0, 8);
        const isPNG = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
        const isJPEG = header[0] === 0xFF && header[1] === 0xD8;
        const isGIF = header.slice(0, 3).toString() === 'GIF';
        const isBMP = header[0] === 0x42 && header[1] === 0x4D;
        
        if (!isPNG && !isJPEG && !isGIF && !isBMP) {
          console.warn('⚠️ Warning: Signature file may not be a valid image format');
        } else {
          console.log('✅ Valid image format detected:', isPNG ? 'PNG' : isJPEG ? 'JPEG' : isGIF ? 'GIF' : 'BMP');
        }
        
        return buffer;
      } catch (bufferError) {
        throw new Error(`Failed to create buffer from base64: ${bufferError.message}`);
      }
      
    } catch (error) {
      console.error('❌ Error converting base64 to buffer:', error);
      throw new Error(`Invalid signature format: ${error.message}`);
    }
  }

  // MAIN: Add signature to existing PDF with smart positioning (UPDATED)
  async addSignatureToPDF(pdfUrl, signatureBase64, signerName, position = 'top-right', existingSignatures = []) {
    try {
      console.log('🖊️ Starting PDF signature overlay process...', { 
        pdfUrl: pdfUrl ? `${pdfUrl.substring(0, 50)}...` : 'null', 
        signerName, 
        position,
        signatureLength: signatureBase64?.length || 0,
        existingSignatureCount: existingSignatures?.length || 0
      });

      // Enhanced input validation
      if (!pdfUrl || typeof pdfUrl !== 'string') {
        throw new Error('PDF URL is required and must be a valid string');
      }
      
      if (!signatureBase64 || typeof signatureBase64 !== 'string') {
        throw new Error('Signature data is required and must be a valid string');
      }
      
      if (signatureBase64.length < 50) {
        throw new Error(`Signature data is too small (${signatureBase64.length} chars) - file may be corrupted or empty`);
      }

      if (!signerName || typeof signerName !== 'string') {
        signerName = 'अधिकारी';
        console.warn('⚠️ No signer name provided, using default');
      }

      // Validate position
      const validPositions = ['bottom-left', 'bottom-center', 'bottom-right', 'top-left', 'top-right', 'center'];
      if (!validPositions.includes(position)) {
        console.warn(`⚠️ Invalid position "${position}", using default "top-right"`);
        position = 'top-right';
      }

      // Download existing PDF from S3
      console.log('📥 Downloading original PDF...');
      let pdfBuffer;
      try {
        pdfBuffer = await this.downloadPDFFromS3(pdfUrl);
      } catch (downloadError) {
        throw new Error(`Failed to download PDF: ${downloadError.message}`);
      }
      
      // Load the PDF document using PDF-lib
      console.log('📖 Loading PDF document...');
      let pdfDoc;
      try {
        pdfDoc = await PDFDocument.load(pdfBuffer);
        console.log('✅ PDF loaded successfully, pages:', pdfDoc.getPageCount());
      } catch (loadError) {
        throw new Error(`Failed to load PDF: ${loadError.message}`);
      }
      
      // Convert signature to image buffer
      console.log('🖼️ Processing signature image...');
      let signatureImageBytes;
      try {
        signatureImageBytes = this.base64ToImageBuffer(signatureBase64);
      } catch (conversionError) {
        throw new Error(`Signature conversion failed: ${conversionError.message}`);
      }
      
      // Embed the signature image (try PNG first, fallback to JPG)
      console.log('📎 Embedding signature image...');
      let signatureImage;
      try {
        signatureImage = await pdfDoc.embedPng(signatureImageBytes);
        console.log('✅ Signature embedded as PNG');
      } catch (pngError) {
        console.log('⚠️ PNG embedding failed, trying JPG...', pngError.message);
        try {
          signatureImage = await pdfDoc.embedJpg(signatureImageBytes);
          console.log('✅ Signature embedded as JPG');
        } catch (jpgError) {
          throw new Error(`Unsupported signature image format. PNG error: ${pngError.message}, JPG error: ${jpgError.message}`);
        }
      }

      // Get the last page (where signature typically goes)
      const pages = pdfDoc.getPages();
      if (pages.length === 0) {
        throw new Error('PDF has no pages');
      }
      
      const lastPage = pages[pages.length - 1];
      const { width, height } = lastPage.getSize();
      console.log('📏 Page dimensions:', { width, height });

      // Calculate signature dimensions - REDUCED SIZE for multiple signatures
      const maxSignatureWidth = 140;  // Reduced for better fit
      const maxSignatureHeight = 60;   // Reduced for better fit
      const signatureAspectRatio = signatureImage.width / signatureImage.height;
      
      // Better sizing for multiple signatures
      let signatureWidth = Math.min(maxSignatureWidth, signatureImage.width * 0.6);
      let signatureHeight = signatureWidth / signatureAspectRatio;
      
      if (signatureHeight > maxSignatureHeight) {
        signatureHeight = maxSignatureHeight;
        signatureWidth = signatureHeight * signatureAspectRatio;
      }

      // Ensure minimum size for visibility
      if (signatureWidth < 60) {
        signatureWidth = 60;
        signatureHeight = signatureWidth / signatureAspectRatio;
      }

      // FIXED: Calculate position with overlap prevention
      const { x, y } = this.calculateSignaturePosition(
        width, 
        height, 
        signatureWidth, 
        signatureHeight, 
        position, 
        existingSignatures
      );

      console.log('📍 Signature positioned at:', { x, y, signatureWidth, signatureHeight });

      // Add signature image to the page
      try {
        lastPage.drawImage(signatureImage, {
          x: x,
          y: y,
          width: signatureWidth,
          height: signatureHeight,
        });
        console.log('✅ Signature image added successfully');
      } catch (drawError) {
        throw new Error(`Failed to draw signature on PDF: ${drawError.message}`);
      }

      // Add signature text with unique timestamp
      const currentDate = new Date();
      const timeString = currentDate.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      // FIXED: Smaller, non-overlapping text
      const signatureText = `Digitally Signed\n${signerName}\nDate: ${timeString}`;
      
      try {
        lastPage.drawText(signatureText, {
          x: x,
          y: y - 20, // Position text below signature
          size: 5, // Smaller text size
          color: rgb(0, 0, 0),
          lineHeight: 6,
        });
        console.log('✅ Signature text added');
      } catch (textError) {
        console.warn('⚠️ Failed to add signature text:', textError.message);
        // Try with minimal text as fallback
        try {
          lastPage.drawText(`Signed: ${signerName}`, {
            x: x,
            y: y - 12,
            size: 5,
            color: rgb(0, 0, 0),
          });
          console.log('✅ Fallback signature text added');
        } catch (fallbackError) {
          console.warn('⚠️ Could not add any signature text:', fallbackError.message);
        }
      }

      // FIXED: Smaller watermark positioned uniquely
      try {
        const watermarkText = 'DIGITALLY SIGNED';
        lastPage.drawText(watermarkText, {
          x: x + signatureWidth - 60,
          y: y + signatureHeight + 3,
          size: 4, // Smaller watermark
          color: rgb(0.6, 0.6, 0.6),
        });
        console.log('✅ Digital signature watermark added');
      } catch (watermarkError) {
        console.warn('⚠️ Failed to add watermark:', watermarkError.message);
      }

      // Save the modified PDF
      console.log('💾 Saving modified PDF...');
      let modifiedPdfBytes;
      try {
        modifiedPdfBytes = await pdfDoc.save();
        console.log('✅ PDF saved with signature, new size:', modifiedPdfBytes.length, 'bytes');
      } catch (saveError) {
        throw new Error(`Failed to save modified PDF: ${saveError.message}`);
      }

      // Generate new filename for signed PDF
      const originalFilename = pdfUrl.split('/').pop().replace(/\?.*$/, ''); // Remove query params
      const timestamp = Date.now();
      const signedFilename = originalFilename.replace('.pdf', `-signed-${timestamp}.pdf`);

      console.log('☁️ Uploading signed PDF to S3:', signedFilename);

      // Upload signed PDF to S3
      let signedPdfUrl;
      try {
        signedPdfUrl = await this.uploadToS3(
          Buffer.from(modifiedPdfBytes), 
          signedFilename, 
          'application/pdf'
        );
        console.log('✅ Signed PDF uploaded successfully:', signedPdfUrl);
      } catch (uploadError) {
        throw new Error(`Failed to upload signed PDF: ${uploadError.message}`);
      }

      return {
        signedPdfUrl: signedPdfUrl,
        fileName: signedFilename,
        signedAt: new Date(),
        signedBy: signerName,
        originalUrl: pdfUrl,
        signaturePosition: position,
        coordinates: { x, y, width: signatureWidth, height: signatureHeight },
        success: true
      };

    } catch (error) {
      console.error('❌ Error adding signature to PDF:', error);
      throw new Error(`Failed to add signature to PDF: ${error.message}`);
    }
  }

  // Generate HTML with signature placeholder for preview (signature overlay support)
  generateSignableHTML(letterContent, letterData, signatureBase64 = null, signerName = null) {
    const htmlContent = this.generateCoveringLetterHTML(letterContent, letterData);
    
    if (!signatureBase64) {
      return htmlContent;
    }

    // Add signature section to HTML - positioned exactly in the signature section area
    const signatureSection = `
      <div style="text-align: right; margin-bottom: 15px; position: relative;">
        <div style="display: inline-block; text-align: center; background: rgba(248, 249, 250, 0.8); padding: 8px; border-radius: 4px; border: 1px solid #e0e0e0;">
          <img src="data:image/jpeg;base64,${signatureBase64}" alt="Digital Signature" style="max-width: 140px; max-height: 60px; display: block; margin: 0 auto 3px auto;">
          <div style="font-size: 6px; text-align: center; color: #666; line-height: 1.1;">
            <strong>Digitally Signed</strong><br>
            ${signerName || 'Officer'}<br>
            ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})}
          </div>
        </div>
      </div>
    `;

    // Insert signature exactly before the officer designation text
    const signatureSectionPattern = /<div id="digital-signature-area"[^>]*>[\s\S]*?<\/div>/;
    if (signatureSectionPattern.test(htmlContent)) {
      return htmlContent.replace(signatureSectionPattern, 
        `<div id="digital-signature-area" style="text-align: right; margin-bottom: 15px;">${signatureSection}</div>`
      );
    } else {
      // Fallback: insert before the signature section
      const fallbackPattern = /<div class="signature-section">/;
      if (fallbackPattern.test(htmlContent)) {
        return htmlContent.replace(fallbackPattern, signatureSection + '<div class="signature-section">');
      } else {
        // Final fallback: insert before closing body tag
        return htmlContent.replace('</body>', signatureSection + '</body>');
      }
    }
  }

  // Enhanced method to generate covering letter with optional signature (signature overlay support)
  async generateAndUploadSignedCoveringLetter(letterContent, letterData, signatureBase64 = null, signerName = null) {
    try {
      console.log('📄 Generating covering letter with signature support...', {
        hasSignature: !!signatureBase64,
        signerName,
        letterNumber: letterData.letterNumber
      });

      // Generate HTML with signature if provided
      const htmlContent = this.generateSignableHTML(letterContent, letterData, signatureBase64, signerName);
      
      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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
      
      // Determine filename suffix
      const suffix = signatureBase64 ? '-signed' : '';
      const timestamp = Date.now();
      
      // Upload PDF to S3
      const fileName = `covering-letters/${letterData.letterNumber}${suffix}-${timestamp}.pdf`;
      const pdfCommand = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileName,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      });
      
      await s3Client.send(pdfCommand);
      
      // Upload HTML to S3 as well
      const htmlFileName = `covering-letters/${letterData.letterNumber}${suffix}-${timestamp}.html`;
      const htmlCommand = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: htmlFileName,
        Body: htmlContent,
        ContentType: 'text/html',
      });
      
      await s3Client.send(htmlCommand);
      
      // Generate URLs
      const pdfUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      const htmlUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${htmlFileName}`;
      
      console.log('✅ Covering letter generated and uploaded successfully:', {
        pdfUrl,
        htmlUrl,
        signed: !!signatureBase64
      });
      
      return {
        pdfUrl: pdfUrl,
        htmlUrl: htmlUrl,
        fileName: fileName,
        htmlFileName: htmlFileName,
        signed: !!signatureBase64,
        signedBy: signerName,
        signedAt: signatureBase64 ? new Date() : null
      };
      
    } catch (error) {
      console.error('❌ Error generating and uploading covering letter:', error);
      throw new Error(`Failed to generate and upload covering letter: ${error.message}`);
    }
  }

  // Generate editable HTML template for the UI
  generateEditableHTML(letterContent, letterData) {
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
    <title>संपादनयोग्य कव्हरिंग लेटर - ${letterData.letterNumber}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Noto Sans Devanagari', Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #000;
            background: #f5f5f5;
            padding: 20px;
        }
        
        .editor-container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .editor-header {
            background: #2c3e50;
            color: white;
            padding: 20px;
            text-align: center;
        }
        
        .editor-header h1 {
            margin-bottom: 10px;
            font-size: 24px;
        }
        
        .editor-header p {
            opacity: 0.9;
            font-size: 14px;
        }
        
        .editor-actions {
            background: #34495e;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .action-buttons {
            display: flex;
            gap: 10px;
        }
        
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.3s ease;
        }
        
        .btn-primary {
            background: #3498db;
            color: white;
        }
        
        .btn-primary:hover {
            background: #2980b9;
        }
        
        .btn-success {
            background: #2ecc71;
            color: white;
        }
        
        .btn-success:hover {
            background: #27ae60;
        }
        
        .btn-secondary {
            background: #95a5a6;
            color: white;
        }
        
        .btn-secondary:hover {
            background: #7f8c8d;
        }
        
        .letter-info {
            color: #ecf0f1;
            font-size: 12px;
        }
        
        .document-container {
            padding: 30px;
            border: 3px solid #000;
            margin: 20px;
            background: #fff;
            position: relative;
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
            font-size: 12px;
        }
        
        .editable-content {
            min-height: 200px;
            padding: 15px;
            border: 2px dashed #3498db;
            border-radius: 5px;
            background: #f8f9fa;
            font-family: 'Noto Sans Devanagari', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.6;
            outline: none;
            resize: vertical;
            white-space: pre-wrap;
        }
        
        .editable-content:focus {
            border-color: #2ecc71;
            box-shadow: 0 0 5px rgba(46, 204, 113, 0.3);
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
        
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
        }
        
        .loading.active {
            display: block;
        }
        
        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .success-message {
            background: #d4edda;
            color: #155724;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            border: 1px solid #c3e6cb;
            display: none;
        }
        
        .error-message {
            background: #f8d7da;
            color: #721c24;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            border: 1px solid #f5c6cb;
            display: none;
        }
        
        @media print {
            .editor-container {
                box-shadow: none;
            }
            
            .editor-header,
            .editor-actions {
                display: none;
            }
            
            .document-container {
                margin: 0;
                padding: 15px;
                border: 2px solid #000;
            }
            
            .editable-content {
                border: none;
                background: white;
                min-height: auto;
            }
        }
    </style>
</head>
<body>
    <div class="editor-container">
        <!-- Editor Header -->
        <div class="editor-header">
            <h1>कव्हरिंग लेटर संपादक</h1>
            <p>Letter Number: ${letterData.letterNumber} | Type: ${letterData.letterType}</p>
        </div>
        
        <!-- Action Buttons -->
        <div class="editor-actions">
            <div class="letter-info">
                <strong>Last Updated:</strong> ${formattedDate}
            </div>
            <div class="action-buttons">
                <button class="btn btn-secondary" onclick="previewLetter()">पूर्वावलोकन</button>
                <button class="btn btn-primary" onclick="saveLetter()">सेव्ह करा</button>
                <button class="btn btn-success" onclick="updateAndGenerate()">अपडेट व PDF तयार करा</button>
            </div>
        </div>
        
        <!-- Success/Error Messages -->
        <div id="successMessage" class="success-message"></div>
        <div id="errorMessage" class="error-message"></div>
        
        <!-- Loading Indicator -->
        <div id="loadingIndicator" class="loading">
            <div class="spinner"></div>
            <span>अपडेट करत आहे...</span>
        </div>
        
        <!-- Document Container -->
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
            
            <!-- Editable Content Section -->
            <div class="content-section">
                <textarea id="letterContent" class="editable-content" placeholder="येथे पत्राचा मजकूर टाइप करा...">${letterContent}</textarea>
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
    </div>
    
    <script>
        // Global variables
        const LETTER_ID = '${letterData.patraId}'; // Use patraId for identification
        const API_BASE_URL = '/api/covering-letters';
        
        // Show success message
        function showSuccess(message) {
            const successDiv = document.getElementById('successMessage');
            successDiv.textContent = message;
            successDiv.style.display = 'block';
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 5000);
        }
        
        // Show error message
        function showError(message) {
            const errorDiv = document.getElementById('errorMessage');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
        
        // Show loading indicator
        function showLoading() {
            document.getElementById('loadingIndicator').classList.add('active');
        }
        
        // Hide loading indicator
        function hideLoading() {
            document.getElementById('loadingIndicator').classList.remove('active');
        }
        
        // Save letter content
        function saveLetter() {
            const content = document.getElementById('letterContent').value;
            showSuccess('पत्राचा मजकूर तात्पुरता सेव्ह झाला!');
        }
        
        // Preview letter (opens in new window)
        function previewLetter() {
            const content = document.getElementById('letterContent').value;
            const previewWindow = window.open('', '_blank', 'width=800,height=600');
            
            const currentHTML = document.documentElement.outerHTML;
            const previewHTML = currentHTML.replace(
                'class="editable-content"',
                'style="border: none; background: white; min-height: auto;" readonly'
            );
            
            previewWindow.document.open();
            previewWindow.document.write(previewHTML);
            previewWindow.document.close();
            
            previewWindow.document.getElementById('letterContent').value = content;
            previewWindow.document.title = 'कव्हरिंग लेटर पूर्वावलोकन';
        }
        
        // Update letter and generate new PDF
        async function updateAndGenerate() {
            const content = document.getElementById('letterContent').value.trim();
            
            if (!content) {
                showError('कृपया पत्राचा मजकूर टाका!');
                return;
            }
            
            showLoading();
            
            try {
                const response = await fetch(\`\${API_BASE_URL}/update-content/\${LETTER_ID}\`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        letterContent: content,
                        status: 'UPDATED'
                    })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showSuccess('कव्हरिंग लेटर यशस्वीरित्या अपडेट झाले व नवीन PDF तयार झाले!');
                    
                    if (result.pdfUrl) {
                        setTimeout(() => {
                            if (confirm('नवीन PDF पाहायचे?')) {
                                window.open(result.pdfUrl, '_blank');
                            }
                        }, 2000);
                    }
                } else {
                    showError('त्रुटी: ' + (result.error || 'अपडेट करण्यात अयशस्वी'));
                }
            } catch (error) {
                console.error('Error updating letter:', error);
                showError('नेटवर्क त्रुटी: ' + error.message);
            } finally {
                hideLoading();
            }
        }
        
        // Handle keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Ctrl+S to save
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                saveLetter();
            }
            
            // Ctrl+Enter to update and generate
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                updateAndGenerate();
            }
        });
    </script>
</body>
</html>
    `;
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
        
        <!-- Signature Section with integrated digital signature -->
        <div class="signature-section">
            <!-- Digital signature will be inserted here by JavaScript -->
            <div id="digital-signature-area" style="text-align: right; margin-bottom: 15px;">
                <!-- This area is reserved for digital signature overlay -->
            </div>
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
      console.log('📄 Generating covering letter PDF...', {
        letterNumber: letterData.letterNumber,
        letterType: letterData.letterType
      });

      // Generate HTML
      const htmlContent = this.generateCoveringLetterHTML(letterContent, letterData);
      
      // Generate PDF using Puppeteer with enhanced settings
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      
      try {
        const page = await browser.newPage();
        
        // Set page content with timeout
        await page.setContent(htmlContent, { 
          waitUntil: 'networkidle0',
          timeout: 30000
        });
        
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
        
        console.log('✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes');
        
        // Upload PDF to S3
        const fileName = `covering-letters/${letterData.letterNumber}-${Date.now()}.pdf`;
        const pdfCommand = new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: fileName,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        });
        
        await s3Client.send(pdfCommand);
        console.log('✅ PDF uploaded to S3:', fileName);
        
        // Upload HTML to S3 as well
        const htmlFileName = `covering-letters/${letterData.letterNumber}-${Date.now()}.html`;
        const htmlCommand = new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: htmlFileName,
          Body: htmlContent,
          ContentType: 'text/html',
        });
        
        await s3Client.send(htmlCommand);
        console.log('✅ HTML uploaded to S3:', htmlFileName);
        
        // Generate URLs manually
        const pdfUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
        const htmlUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${htmlFileName}`;
        
        return {
          pdfUrl: pdfUrl,
          htmlUrl: htmlUrl,
          fileName: fileName,
          htmlFileName: htmlFileName
        };
        
      } catch (puppeteerError) {
        await browser.close();
        throw puppeteerError;
      }
      
    } catch (error) {
      console.error('❌ Error generating and uploading covering letter:', error);
      throw new Error(`Failed to generate and upload covering letter: ${error.message}`);
    }
  }
  
  // Enhanced: Upload file to S3 with better error handling
  async uploadToS3(fileBuffer, fileName, contentType) {
    try {
      console.log('☁️ Uploading to S3:', { fileName, contentType, size: fileBuffer.length });
      
      // Validate inputs
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('File buffer is empty or invalid');
      }
      
      if (!fileName || typeof fileName !== 'string') {
        throw new Error('File name is required and must be a string');
      }
      
      if (!process.env.AWS_BUCKET_NAME) {
        throw new Error('AWS_BUCKET_NAME environment variable is not set');
      }
      
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `covering-letters/${fileName}`,
        Body: fileBuffer,
        ContentType: contentType || 'application/octet-stream',
      });
      
      await s3Client.send(command);
      
      // Generate URL manually
      const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/covering-letters/${fileName}`;
      
      console.log('✅ File uploaded successfully to S3:', fileUrl);
      return fileUrl;
      
    } catch (error) {
      console.error('❌ Error uploading to S3:', error);
      throw new Error(`Failed to upload to S3: ${error.message}`);
    }
  }
}

module.exports = new S3Service();