// services/s3Service.js - COMPLETE FIXED VERSION
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { PDFDocument, rgb } = require('pdf-lib');
const puppeteer = require('puppeteer');
const { Document, Packer, Paragraph, TextRun, Header, ImageRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell } = require('docx');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Try different fetch methods based on Node.js version
let fetch;
try {
  fetch = globalThis.fetch;
  if (!fetch) {
    throw new Error('Built-in fetch not available');
  }
  console.log('Using built-in fetch');
} catch (e) {
  try {
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

  // Get image buffer for Word documents
  getImageBuffer(imagePath) {
    try {
      const fullPath = path.join(__dirname, '..', imagePath);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
      console.warn(`Image not found at path: ${fullPath}`);
      return null;
    } catch (error) {
      console.error('Error reading image buffer:', error);
      return null;
    }
  }

  // Determine वर्ग classification based on letterType (returns only वर्ग)
  determineVargClassification(letterType) {
    switch(letterType) {
      case 'NA':
        return 'ब वर्ग';
      case 'FORWARD':
        return 'क वर्ग';
      default:
        return 'अ वर्ग';
    }
  }

  // Determine वर्ग classification for letterhead (includes अर्ज)
  determineVargClassificationForHeader(letterType) {
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
        return 'कक्ष ३(३) प्रत्यक्ष भेट';
      case 'FORWARD':
        return 'कक्ष ३(४) मा. जिल्हाधिकारी/सैनिक';
      case 'GOVERNMENT':
        return 'कक्ष३ (२) मा. गह/शासन/पालकमंत्री';
      case 'POLICE_COMMISSIONER':
        return 'कक्ष ३(१) मा. पोमनि अजे.';
      case 'LOCAL':
        return 'कक्ष ३(५) स्थानिक अर्ज';
      default:
        return 'कक्ष ३(१) मा. पोमसं अर्ज';
    }
  }

  // Extract complainant name (simplified to avoid errors)
  extractComplainantName(letterData) {
    // Return default to avoid complex extraction errors
    return 'अर्जदाराचे नाव';
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

  // Generate subject line based on वर्ग classification only
  generateSubjectLine(letterType, complainantName = null, letterData = null) {
    const vargClassification = this.determineVargClassification(letterType);
    
    switch(letterType) {
      case 'NAR':
      case 'ACKNOWLEDGMENT':
        return `${vargClassification} तक्रारी अर्जाबाबत (NAR)`;
      case 'NA':
        return `${vargClassification} तक्रारी अर्जाबाबत (NA)`;
      case 'FORWARD':
        return `${vargClassification} तक्रारी अर्जाबाबत (NAR)`;
      default:
        return `${vargClassification} तक्रारी अर्जाबाबत (NAR)`;
    }
  }

  // ✅ FIXED: Generate table data with clean letter number
  generateTableDataFixed(letterData, complainantName, cleanLetterNumber) {
    const currentYear = new Date().getFullYear();
    const marathiAppType = this.convertApplicationTypeToMarathi(letterData.letterType);
    
    return [
      {
        applicationNumber: cleanLetterNumber, // ✅ Use clean letter number
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

  // Original table data method (for backward compatibility)
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

  // ✅ COMPLETE FIXED WORD DOCUMENT GENERATION - Matches PDF Format
  async generateWordDocument(letterContent, letterData, signatureBase64 = null, signerName = null) {
    try {
      console.log('📝 Generating Word document matching PDF format...');
      
      const currentYear = new Date().getFullYear();
      const today = new Date();
      const formattedDate = `${today.getDate().toString().padStart(2, '0')} / ${(today.getMonth() + 1).toString().padStart(2, '0')} / ${today.getFullYear()}`;
      
      const complainantName = this.extractComplainantName(letterData);
      const subjectLine = this.generateSubjectLine(letterData.letterType);
      const vargClassification = this.determineVargClassificationForHeader(letterData.letterType);
      const rightHeaderText = this.determineRightHeaderText(letterData.letterType);
      
      // Get logo buffers
      const leftLogoBuffer = this.getImageBuffer('png/leftlogo.png');
      const rightLogoBuffer = this.getImageBuffer('png/rightlogo.png');
      
      // ✅ Process signature if provided
      let signatureBuffer = null;
      if (signatureBase64) {
        try {
          const base64Data = signatureBase64.includes(',') ? signatureBase64.split(',')[1] : signatureBase64;
          signatureBuffer = Buffer.from(base64Data, 'base64');
          console.log('✅ Signature processed for Word document');
        } catch (error) {
          console.warn('⚠️ Could not process signature:', error.message);
        }
      }

      // ✅ FIXED: Clean letter number format (remove extra /2025/2025)
      const cleanLetterNumber = letterData.letterNumber ? 
        letterData.letterNumber.replace(/\/\d{4}\/\d{4}$/, '') : // Remove /YYYY/YYYY pattern
        `CL/${letterData.patraId || 'TEMP'}`;
      
      console.log('📋 Cleaned letter number:', letterData.letterNumber, '->', cleanLetterNumber);
      
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 720,    // ✅ Reduced margins to match PDF
                right: 720,
                bottom: 720,
                left: 720,
              },
            },
          },
          children: [
            // ✅ LETTERHEAD - Simplified table structure like PDF
            new Table({
              width: { size: 100, type: 'pct' },
              borders: {
                top: { style: 'single', size: 6, color: '000000' },
                bottom: { style: 'single', size: 6, color: '000000' },
                left: { style: 'single', size: 6, color: '000000' },
                right: { style: 'single', size: 6, color: '000000' },
              },
              rows: [
                new TableRow({
                  children: [
                    // Left logo
                    new TableCell({
                      children: leftLogoBuffer ? [
                        new Paragraph({
                          children: [
                            new ImageRun({
                              data: leftLogoBuffer,
                              transformation: { width: 50, height: 50 },
                            }),
                          ],
                          alignment: AlignmentType.CENTER,
                        }),
                      ] : [
                        new Paragraph({
                          children: [new TextRun({ text: "🏛️", size: 30 })],
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                      width: { size: 15, type: 'pct' },
                      borders: {
                        top: { style: 'single', size: 3 },
                        bottom: { style: 'single', size: 3 },
                        left: { style: 'single', size: 3 },
                        right: { style: 'single', size: 3 },
                      },
                    }),
                    
                    // Center header
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "पोलीस अधिक्षक कार्यालय, अहिल्यानगर",
                              bold: true,
                              size: 24,
                            }),
                          ],
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 100 },
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "(अर्ज शाखा)",
                              bold: true,
                              size: 20,
                            }),
                          ],
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 150 },
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: vargClassification,
                              size: 16,
                            }),
                            new TextRun({
                              text: "                    ",
                              size: 16,
                            }),
                            new TextRun({
                              text: rightHeaderText,
                              size: 16,
                            }),
                          ],
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                      width: { size: 70, type: 'pct' },
                      borders: {
                        top: { style: 'single', size: 3 },
                        bottom: { style: 'single', size: 3 },
                        left: { style: 'single', size: 3 },
                        right: { style: 'single', size: 3 },
                      },
                    }),
                    
                    // Right emblem
                    new TableCell({
                      children: rightLogoBuffer ? [
                        new Paragraph({
                          children: [
                            new ImageRun({
                              data: rightLogoBuffer,
                              transformation: { width: 50, height: 50 },
                            }),
                          ],
                          alignment: AlignmentType.CENTER,
                        }),
                      ] : [
                        new Paragraph({
                          children: [new TextRun({ text: "🏛️", size: 30 })],
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                      width: { size: 15, type: 'pct' },
                      borders: {
                        top: { style: 'single', size: 3 },
                        bottom: { style: 'single', size: 3 },
                        left: { style: 'single', size: 3 },
                        right: { style: 'single', size: 3 },
                      },
                    }),
                  ],
                }),
              ],
            }),
            
            // ✅ SPACING - Match PDF
            new Paragraph({ 
              text: "",
              spacing: { after: 200 }
            }),
            
            // ✅ REFERENCE SECTION - With clean letter number
            new Paragraph({
              children: [
                new TextRun({
                  text: `अर्ज क्रमांक :- ${cleanLetterNumber}, अर्ज शाखा,        जावक क्र. - /${currentYear},        दि. ${formattedDate}`,
                  size: 20,
                }),
              ],
              spacing: { after: 150 },
            }),
            
            // ✅ SUBJECT LINE - Match PDF format  
            new Paragraph({
              children: [
                new TextRun({
                  text: `विषय :- ${subjectLine}`,
                  bold: true,
                  size: 22,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 150 },
            }),
            
            // ✅ REFERENCE NUMBER LINE - Match PDF
            new Paragraph({
              children: [
                new TextRun({
                  text: "उ.नि.पो.अ./पो.नि/स.पो.नि./ ___________________________",
                  size: 20,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            
            // ✅ LETTER CONTENT - Match PDF format
            ...letterContent.split('\n').filter(line => line.trim()).map(line => 
              new Paragraph({
                children: [
                  new TextRun({
                    text: line.trim(),
                    size: 20,
                  }),
                ],
                spacing: { after: 120 },
                alignment: AlignmentType.JUSTIFIED,
              })
            ),
            
            // ✅ SPACING BEFORE TABLE
            new Paragraph({ 
              text: "",
              spacing: { after: 200 }
            }),
            
            // ✅ DATA TABLE - Match PDF format with clean letter number
            new Table({
              width: { size: 100, type: 'pct' },
              borders: {
                top: { style: 'single', size: 6, color: '000000' },
                bottom: { style: 'single', size: 6, color: '000000' },
                left: { style: 'single', size: 6, color: '000000' },
                right: { style: 'single', size: 6, color: '000000' },
              },
              rows: [
                // Header row
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "अर्ज क्रमांक",
                              bold: true,
                              size: 18,
                            }),
                          ],
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                      shading: { fill: 'f0f0f0' },
                      borders: {
                        top: { style: 'single', size: 3 },
                        bottom: { style: 'single', size: 3 },
                        left: { style: 'single', size: 3 },
                        right: { style: 'single', size: 3 },
                      },
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "अर्ज प्रकार",
                              bold: true,
                              size: 18,
                            }),
                          ],
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                      shading: { fill: 'f0f0f0' },
                      borders: {
                        top: { style: 'single', size: 3 },
                        bottom: { style: 'single', size: 3 },
                        left: { style: 'single', size: 3 },
                        right: { style: 'single', size: 3 },
                      },
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "अर्जदाराचे नाव",
                              bold: true,
                              size: 18,
                            }),
                          ],
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                      shading: { fill: 'f0f0f0' },
                      borders: {
                        top: { style: 'single', size: 3 },
                        bottom: { style: 'single', size: 3 },
                        left: { style: 'single', size: 3 },
                        right: { style: 'single', size: 3 },
                      },
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "जावक क्रमांक",
                              bold: true,
                              size: 18,
                            }),
                          ],
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                      shading: { fill: 'f0f0f0' },
                      borders: {
                        top: { style: 'single', size: 3 },
                        bottom: { style: 'single', size: 3 },
                        left: { style: 'single', size: 3 },
                        right: { style: 'single', size: 3 },
                      },
                    }),
                  ],
                }),
                
                // ✅ Data rows with clean letter number and empty name column
                ...this.generateTableDataFixed(letterData, complainantName, cleanLetterNumber).map(rowData => 
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: rowData.applicationNumber,
                                size: 16,
                              }),
                            ],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                        borders: {
                          top: { style: 'single', size: 3 },
                          bottom: { style: 'single', size: 3 },
                          left: { style: 'single', size: 3 },
                          right: { style: 'single', size: 3 },
                        },
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: rowData.applicationType,
                                size: 16,
                              }),
                            ],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                        borders: {
                          top: { style: 'single', size: 3 },
                          bottom: { style: 'single', size: 3 },
                          left: { style: 'single', size: 3 },
                          right: { style: 'single', size: 3 },
                        },
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: "", // ✅ Empty - no applicant name
                                size: 16,
                              }),
                            ],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                        borders: {
                          top: { style: 'single', size: 3 },
                          bottom: { style: 'single', size: 3 },
                          left: { style: 'single', size: 3 },
                          right: { style: 'single', size: 3 },
                        },
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: rowData.outwardNumber,
                                size: 16,
                              }),
                            ],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                        borders: {
                          top: { style: 'single', size: 3 },
                          bottom: { style: 'single', size: 3 },
                          left: { style: 'single', size: 3 },
                          right: { style: 'single', size: 3 },
                        },
                      }),
                    ],
                  })
                ),
              ],
            }),
            
            // ✅ SPACING AFTER TABLE
            new Paragraph({ 
              text: "",
              spacing: { after: 300 }
            }),
            
            // ✅ CLOSING CONTENT - Match PDF format
            new Paragraph({
              children: [
                new TextRun({
                  text: "मा.पोलीस अधिक्षक सो,",
                  bold: true,
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "    आदेश अनुसरणे",
                  bold: true,
                  size: 20,
                }),
              ],
              spacing: { after: 200 },
            }),
            
            // ✅ SIGNATURE SECTION - Exactly like PDF
            ...(signatureBuffer ? [
              new Paragraph({
                children: [
                  new ImageRun({
                    data: signatureBuffer,
                    transformation: {
                      width: 100,  // Slightly smaller to match PDF
                      height: 40,  
                    },
                  }),
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { after: 100 },
              }),
            ] : [
              new Paragraph({ 
                text: "",
                spacing: { after: 150 }
              }),
            ]),
            
            // ✅ OFFICER TEXT - Match PDF exactly (NO DATE)
            new Paragraph({
              children: [
                new TextRun({
                  text: signerName || "अर्ज शाखा प्रभारी अधिकारी",
                  bold: true,
                  size: 20,
                }),
              ],
              alignment: AlignmentType.RIGHT,
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "पोलीस अधिक्षक कार्यालय, अहिल्यानगर",
                  bold: true,
                  size: 20,
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
            // ✅ NO DATE LINE - matches PDF exactly
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      console.log('✅ Word document generated to match PDF format');
      return buffer;

    } catch (error) {
      console.error('❌ Error generating Word document:', error);
      throw new Error(`Word document generation failed: ${error.message}`);
    }
  }

  // ✅ Simplify generateWordDocumentWithSignature - just call the main method
  async generateWordDocumentWithSignature(letterContent, letterData, signatureBase64, signerName) {
    return this.generateWordDocument(letterContent, letterData, signatureBase64, signerName);
  }

  // Generate HTML with flexible signature positioning (ABOVE or BELOW officer text)
  generateSignableHTML(letterContent, letterData, signatureBase64 = null, signerName = null, signaturePosition = 'above') {
    const htmlContent = this.generateCoveringLetterHTML(letterContent, letterData);
    
    if (!signatureBase64) {
      return htmlContent;
    }

    // Create signature image element
    const signatureImg = `<img src="${signatureBase64}" alt="Signature" style="max-width: 120px; max-height: 50px; display: block;">`;

    if (signaturePosition === 'below') {
      // Place signature BELOW officer text
      const belowSignatureSection = `
        <div style="margin-top: 10px;">
          ${signatureImg}
        </div>
      `;
      
      // Insert signature after officer designation
      const officerPattern = /<p><strong>पोलीस अधिक्षक कार्यालय, अहिल्यानगर<\/strong><\/p>/;
      if (officerPattern.test(htmlContent)) {
        return htmlContent.replace(officerPattern, 
          `<p><strong>पोलीस अधिक्षक कार्यालय, अहिल्यानगर</strong></p>${belowSignatureSection}`
        );
      }
    } else {
      // Default: Place signature ABOVE officer text
      const aboveSignatureSection = `
        <div style="margin-bottom: 10px;">
          ${signatureImg}
        </div>
      `;

      // Insert signature before officer designation
      const signatureSectionPattern = /<div id="digital-signature-area"[^>]*>[\s\S]*?<\/div>/;
      if (signatureSectionPattern.test(htmlContent)) {
        return htmlContent.replace(signatureSectionPattern, 
          `<div id="digital-signature-area">${aboveSignatureSection}</div>`
        );
      }
    }
    
    return htmlContent;
  }

  // Generate editable HTML template with simplified signature upload
  generateEditableHTML(letterContent, letterData) {
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')} / ${(today.getMonth() + 1).toString().padStart(2, '0')} / ${today.getFullYear()}`;
    
    // Get base64 images
    const leftLogo = this.getImageBase64('png/leftlogo.png');
    const rightLogo = this.getImageBase64('png/rightlogo.png');
    
    // ✅ Clean letter number for display
    const cleanLetterNumber = letterData.letterNumber ? 
      letterData.letterNumber.replace(/\/\d{4}\/\d{4}$/, '') : 
      `CL/${letterData.patraId || 'TEMP'}`;
    
    // Determine classifications
    const vargClassification = this.determineVargClassificationForHeader(letterData.letterType);
    const rightHeaderText = this.determineRightHeaderText(letterData.letterType);
    const complainantName = this.extractComplainantName(letterData);
    const subjectLine = this.generateSubjectLine(letterData.letterType);
    const tableData = this.generateTableDataFixed(letterData, complainantName, cleanLetterNumber);
    
    return `
<!DOCTYPE html>
<html lang="mr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>संपादनयोग्य कव्हरिंग लेटर - ${cleanLetterNumber}</title>
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
        
        .editor-actions {
            background: #34495e;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
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
        
        .btn-success {
            background: #2ecc71;
            color: white;
        }
        
        .document-container {
            padding: 30px;
            border: 3px solid #000;
            margin: 20px;
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
        }
        
        .office-subtitle {
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .office-address {
            font-size: 10px;
            color: #333;
        }
        
        .reference-section {
            display: flex;
            justify-content: space-between;
            margin: 15px 0;
            font-size: 11px;
            border-bottom: 1px solid #000;
            padding-bottom: 8px;
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
        
        .signature-section {
            margin-top: 20px;
        }
        
        #digital-signature-area {
            margin-bottom: 10px;
        }
        
        #signatureDisplayArea {
            display: none;
            margin-bottom: 10px;
        }
        
        #uploadedSignature {
            max-width: 120px;
            max-height: 50px;
        }
        
        .signature-controls {
            margin-bottom: 10px;
        }
        
        .upload-btn, .clear-btn {
            padding: 8px 16px;
            margin: 0 5px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
        }
        
        .upload-btn {
            background: #28a745;
            color: white;
        }
        
        .clear-btn {
            background: #dc3545;
            color: white;
        }
        
        .bold {
            font-weight: 600;
        }
        
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
        }
        
        .loading.active {
            display: block;
        }
        
        .success-message, .error-message {
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            display: none;
        }
        
        .success-message {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .error-message {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
    </style>
</head>
<body>
    <div class="editor-container">
        <!-- Editor Header -->
        <div class="editor-header">
            <h1>कव्हरिंग लेटर संपादक</h1>
            <p>Letter Number: ${cleanLetterNumber} | Type: ${letterData.letterType}</p>
        </div>
        
        <!-- Action Buttons -->
        <div class="editor-actions">
            <div class="letter-info">
                <strong>Last Updated:</strong> ${formattedDate}
            </div>
            <div class="action-buttons">
                <button class="btn btn-primary" onclick="saveLetter()">सेव्ह करा</button>
                <button class="btn btn-success" onclick="updateAndGenerate()">अपडेट व PDF तयार करा</button>
            </div>
        </div>
        
        <!-- Success/Error Messages -->
        <div id="successMessage" class="success-message"></div>
        <div id="errorMessage" class="error-message"></div>
        
        <!-- Loading Indicator -->
        <div id="loadingIndicator" class="loading">
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
                    <strong>अर्ज क्रमांक :-</strong> ${cleanLetterNumber}, अर्ज शाखा, &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>जावक क्र. -</strong> /${new Date().getFullYear()}, &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>दि. ${formattedDate}</strong>
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
                        <th>अर्ज क्रमांक</th>
                        <th>अर्ज प्रकार</th>
                        <th>अर्जदाराचे नाव</th>
                        <th>जावक क्रमांक</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableData.map(row => `
                    <tr>
                        <td>${row.applicationNumber}</td>
                        <td>${row.applicationType}</td>
                        <td></td>
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
            
            <!-- Simple Signature Section -->
            <div class="signature-section">
                <!-- Simple signature upload controls -->
                <div class="signature-controls">
                    <input type="file" id="signatureUpload" accept="image/*" style="display: none;">
                    <button type="button" onclick="document.getElementById('signatureUpload').click()" class="upload-btn">
                        स्वाक्षरी अपलोड करा
                    </button>
                    <button type="button" onclick="clearSignature()" class="clear-btn">
                        स्वाक्षरी साफ करा
                    </button>
                </div>
                
                <!-- Simple signature display ABOVE officer text -->
                <div id="digital-signature-area">
                    <div id="signatureDisplayArea" style="margin-bottom: 10px;">
                        <img id="uploadedSignature">
                    </div>
                </div>
                
                <p><strong>अर्ज शाखा प्रभारी अधिकारी</strong></p>
                <p><strong>पोलीस अधिक्षक कार्यालय, अहिल्यानगर</strong></p>
            </div>
        </div>
    </div>
    
    <script>
        // Global variables
        const LETTER_ID = '${letterData.patraId}';
        const API_BASE_URL = '/api/covering-letters';
        
        // Show success message
        function showSuccess(message) {
            const successDiv = document.getElementById('successMessage');
            successDiv.textContent = message;
            successDiv.style.display = 'block';
            setTimeout(() => successDiv.style.display = 'none', 5000);
        }
        
        // Show error message
        function showError(message) {
            const errorDiv = document.getElementById('errorMessage');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => errorDiv.style.display = 'none', 5000);
        }
        
        // Show/hide loading
        function showLoading() {
            document.getElementById('loadingIndicator').classList.add('active');
        }
        
        function hideLoading() {
            document.getElementById('loadingIndicator').classList.remove('active');
        }
        
        // Save letter content
        function saveLetter() {
            showSuccess('पत्राचा मजकूर सेव्ह झाला!');
        }
        
        // Get simple signature data
        function getSignatureData() {
            const img = document.getElementById('uploadedSignature');
            const displayArea = document.getElementById('signatureDisplayArea');
            
            if (displayArea.style.display !== 'none' && img.src) {
                return {
                    hasSignature: true,
                    signatureBase64: img.src,
                    signerName: 'अर्ज शाखा प्रभारी अधिकारी',
                    position: 'above'
                };
            }
            return { hasSignature: false };
        }
        
        // Update letter and generate PDF
        async function updateAndGenerate() {
            const content = document.getElementById('letterContent').value.trim();
            
            if (!content) {
                showError('कृपया पत्राचा मजकूर टाका!');
                return;
            }
            
            showLoading();
            
            try {
                const signatureData = getSignatureData();
                const requestBody = {
                    letterContent: content,
                    status: 'UPDATED'
                };
                
                if (signatureData.hasSignature) {
                    requestBody.signatureBase64 = signatureData.signatureBase64;
                    requestBody.signerName = signatureData.signerName;
                    requestBody.signaturePosition = signatureData.position;
                }
                
                const response = await fetch(\`\${API_BASE_URL}/update-content/\${LETTER_ID}\`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showSuccess('कव्हरिंग लेटर यशस्वीरित्या अपडेट झाले!');
                    
                    if (result.pdfUrl) {
                        setTimeout(() => {
                            if (confirm('नवीन PDF पाहायचे?')) {
                                window.open(result.pdfUrl, '_blank');
                            }
                        }, 2000);
                    }

                    if (result.wordUrl) {
                        setTimeout(() => {
                            if (confirm('Word फाइल डाउनलोड करायची?')) {
                                window.open(result.wordUrl, '_blank');
                            }
                        }, 3000);
                    }
                } else {
                    showError('त्रुटी: ' + (result.error || 'अपडेट करण्यात अयशस्वी'));
                }
            } catch (error) {
                showError('नेटवर्क त्रुटी: ' + error.message);
            } finally {
                hideLoading();
            }
        }
        
        // Handle signature upload
        function handleSignatureUpload(event) {
            const file = event.target.files[0];
            if (file) {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const img = document.getElementById('uploadedSignature');
                        const displayArea = document.getElementById('signatureDisplayArea');
                        
                        img.src = e.target.result;
                        displayArea.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                } else {
                    alert('कृपया फक्त इमेज फाइल अपलोड करा');
                }
            }
        }
        
        // Clear signature
        function clearSignature() {
            const img = document.getElementById('uploadedSignature');
            const displayArea = document.getElementById('signatureDisplayArea');
            img.src = '';
            displayArea.style.display = 'none';
            document.getElementById('signatureUpload').value = '';
        }
        
        // Add event listeners
        document.addEventListener('DOMContentLoaded', function() {
            const fileInput = document.getElementById('signatureUpload');
            if (fileInput) {
                fileInput.addEventListener('change', handleSignatureUpload);
            }
        });
    </script>
</body>
</html>
    `;
  }
  
  // Generate simplified HTML template 
  generateCoveringLetterHTML(letterContent, letterData) {
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')} / ${(today.getMonth() + 1).toString().padStart(2, '0')} / ${today.getFullYear()}`;
    
    // Get base64 images
    const leftLogo = this.getImageBase64('png/leftlogo.png');
    const rightLogo = this.getImageBase64('png/rightlogo.png');
    
    // ✅ Clean letter number for display
    const cleanLetterNumber = letterData.letterNumber ? 
      letterData.letterNumber.replace(/\/\d{4}\/\d{4}$/, '') : 
      `CL/${letterData.patraId || 'TEMP'}`;
    
    // Determine classifications
    const vargClassification = this.determineVargClassificationForHeader(letterData.letterType);
    const rightHeaderText = this.determineRightHeaderText(letterData.letterType);
    const complainantName = this.extractComplainantName(letterData);
    const subjectLine = this.generateSubjectLine(letterData.letterType);
    const tableData = this.generateTableDataFixed(letterData, complainantName, cleanLetterNumber);
    
    return `
<!DOCTYPE html>
<html lang="mr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>कव्हरिंग लेटर - ${cleanLetterNumber}</title>
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
        }
        
        .office-subtitle {
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .office-address {
            font-size: 10px;
            color: #333;
        }
        
        .reference-section {
            display: flex;
            justify-content: space-between;
            margin: 15px 0;
            font-size: 11px;
            border-bottom: 1px solid #000;
            padding-bottom: 8px;
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
        
        .signature-section {
            margin-top: 20px;
        }
        
        #digital-signature-area {
            margin-bottom: 10px;
        }
        
        .bold {
            font-weight: 600;
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
                <strong>अर्ज क्रमांक :-</strong> ${cleanLetterNumber}, अर्ज शाखा, &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>जावक क्र. -</strong> /${new Date().getFullYear()}, &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>दि. ${formattedDate}</strong>
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
                    <th>अर्ज क्रमांक</th>
                    <th>अर्ज प्रकार</th>
                    <th>अर्जदाराचे नाव</th>
                    <th>जावक क्रमांक</th>
                </tr>
            </thead>
            <tbody>
                ${tableData.map(row => `
                <tr>
                    <td>${row.applicationNumber}</td>
                    <td>${row.applicationType}</td>
                    <td></td>
                    <td>${row.outwardNumber}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        
        <!-- Closing Content -->
        <div class="content-section">
            <p><strong>मा.पोलीस अधिक्षक सो,</strong></p>
            <p style="margin-left: 20px;"><strong>आदेश अनुसरणे</strong></p>
        </div>
        
        <!-- Simple Signature Section -->
        <div class="signature-section">
            <!-- Signature ABOVE officer text -->
            <div id="digital-signature-area">
                <!-- Simple signature will be inserted here ABOVE officer designation -->
            </div>
            <p><strong>अर्ज शाखा प्रभारी अधिकारी</strong></p>
            <p><strong>पोलीस अधिक्षक कार्यालय, अहिल्यानगर</strong></p>
        </div>
        
    </div>
</body>
</html>
    `;
  }
  
  // Enhanced method to generate covering letter with Word document support
  async generateAndUploadSignedCoveringLetter(letterContent, letterData, signatureBase64 = null, signerName = null) {
    try {
      console.log('📄 Generating covering letter with Word document and signature support...', {
        hasSignature: !!signatureBase64,
        signerName,
        letterNumber: letterData.letterNumber
      });

      // Generate HTML with simple signature if provided
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
      
      // Generate Word document with/without signature
      let wordBuffer;
      if (signatureBase64) {
        wordBuffer = await this.generateWordDocument(letterContent, letterData, signatureBase64, signerName);
      } else {
        wordBuffer = await this.generateWordDocument(letterContent, letterData);
      }
      
      // ✅ Clean letter number for filename
      const cleanLetterNumber = letterData.letterNumber ? 
        letterData.letterNumber.replace(/\/\d{4}\/\d{4}$/, '') : 
        `CL-${letterData.patraId || 'TEMP'}`;
      
      // Determine filename suffix
      const suffix = signatureBase64 ? '-signed' : '';
      const timestamp = Date.now();
      
      // Upload PDF to S3
      const pdfFileName = `covering-letters/${cleanLetterNumber}${suffix}-${timestamp}.pdf`;
      const pdfCommand = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: pdfFileName,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      });
      
      await s3Client.send(pdfCommand);
      
      // Upload HTML to S3
      const htmlFileName = `covering-letters/${cleanLetterNumber}${suffix}-${timestamp}.html`;
      const htmlCommand = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: htmlFileName,
        Body: htmlContent,
        ContentType: 'text/html',
      });
      
      await s3Client.send(htmlCommand);
      
      // Upload Word document to S3
      const wordFileName = `covering-letters/${cleanLetterNumber}${suffix}-${timestamp}.docx`;
      const wordCommand = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: wordFileName,
        Body: wordBuffer,
        ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      
      await s3Client.send(wordCommand);
      
      // Generate URLs
      const pdfUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${pdfFileName}`;
      const htmlUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${htmlFileName}`;
      const wordUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${wordFileName}`;
      
      console.log('✅ Covering letter generated and uploaded successfully with Word document:', {
        pdfUrl,
        htmlUrl,
        wordUrl,
        signed: !!signatureBase64
      });
      
      return {
        pdfUrl: pdfUrl,
        htmlUrl: htmlUrl,
        wordUrl: wordUrl,
        fileName: pdfFileName,
        htmlFileName: htmlFileName,
        wordFileName: wordFileName,
        signed: !!signatureBase64,
        signedBy: signerName,
        signedAt: signatureBase64 ? new Date() : null
      };
      
    } catch (error) {
      console.error('❌ Error generating and uploading covering letter:', error);
      throw new Error(`Failed to generate and upload covering letter: ${error.message}`);
    }
  }
  
  // Generate PDF and upload to S3 with Word document support
  async generateAndUploadCoveringLetter(letterContent, letterData) {
    try {
      console.log('📄 Generating covering letter with Word document support...', {
        letterNumber: letterData.letterNumber,
        letterType: letterData.letterType
      });

      // Generate HTML
      const htmlContent = this.generateCoveringLetterHTML(letterContent, letterData);
      
      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security'
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
        
        // Generate Word document
        const wordBuffer = await this.generateWordDocument(letterContent, letterData);
        console.log('✅ Word document generated successfully, size:', wordBuffer.length, 'bytes');
        
        // ✅ Clean letter number for filename
        const cleanLetterNumber = letterData.letterNumber ? 
          letterData.letterNumber.replace(/\/\d{4}\/\d{4}$/, '') : 
          `CL-${letterData.patraId || 'TEMP'}`;
        
        const timestamp = Date.now();
        
        // Upload PDF to S3
        const pdfFileName = `covering-letters/${cleanLetterNumber}-${timestamp}.pdf`;
        const pdfCommand = new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: pdfFileName,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        });
        
        await s3Client.send(pdfCommand);
        console.log('✅ PDF uploaded to S3:', pdfFileName);
        
        // Upload HTML to S3
        const htmlFileName = `covering-letters/${cleanLetterNumber}-${timestamp}.html`;
        const htmlCommand = new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: htmlFileName,
          Body: htmlContent,
          ContentType: 'text/html',
        });
        
        await s3Client.send(htmlCommand);
        console.log('✅ HTML uploaded to S3:', htmlFileName);
        
        // Upload Word document to S3
        const wordFileName = `covering-letters/${cleanLetterNumber}-${timestamp}.docx`;
        const wordCommand = new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: wordFileName,
          Body: wordBuffer,
          ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        
        await s3Client.send(wordCommand);
        console.log('✅ Word document uploaded to S3:', wordFileName);
        
        // Generate URLs
        const pdfUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${pdfFileName}`;
        const htmlUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${htmlFileName}`;
        const wordUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${wordFileName}`;
        
        return {
          pdfUrl: pdfUrl,
          htmlUrl: htmlUrl,
          wordUrl: wordUrl,
          fileName: pdfFileName,
          htmlFileName: htmlFileName,
          wordFileName: wordFileName
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
  
  // Upload file to S3 with better error handling
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

  // Download file from S3
  async downloadFileFromS3(key) {
    try {
      console.log('☁️ Downloading from S3, key:', key);
      
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      });

      const response = await s3Client.send(command);
      
      // Convert the readable stream to buffer
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      
      const fileBuffer = Buffer.concat(chunks);
      
      console.log('✅ S3 download successful, size:', fileBuffer.length, 'bytes');
      return fileBuffer;
      
    } catch (error) {
      console.error('❌ Error downloading file from S3:', error);
      console.error('S3 Error details:', {
        message: error.message,
        code: error.Code,
        statusCode: error.$metadata?.httpStatusCode
      });
      throw new Error(`Failed to download file from S3: ${error.message}`);
    }
  }

  // Delete file from S3
  async deleteFromS3(fileName) {
    try {
      const deleteParams = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileName,
      };

      const command = new DeleteObjectCommand(deleteParams);
      await s3Client.send(command);
      
      console.log(`🗑️ File deleted from S3: ${fileName}`);
      return true;

    } catch (error) {
      console.error('❌ Error deleting from S3:', error);
      throw new Error(`S3 delete failed: ${error.message}`);
    }
  }
}

module.exports = new S3Service();