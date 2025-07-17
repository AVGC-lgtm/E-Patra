// services/pdfService.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class PDFService {
  
  // Generate PDF from covering letter content
  async generateCoveringLetterPDF(letterContent, fileName = 'covering-letter.pdf') {
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Create HTML content for the letter
      const htmlContent = this.createHTMLTemplate(letterContent);
      
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0'
      });
      
      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '20mm',
          right: '20mm'
        }
      });
      
      await browser.close();
      
      return pdfBuffer;
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF');
    }
  }
  
  // Create HTML template for the covering letter
  createHTMLTemplate(letterContent) {
    return `
<!DOCTYPE html>
<html lang="mr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>कव्हरिंग लेटर</title>
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
            background: #fff;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
        }
        
        .header h1 {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 5px;
        }
        
        .header h2 {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 10px;
        }
        
        .letterhead {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .logo {
            width: 60px;
            height: 60px;
            border: 2px solid #000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        }
        
        .office-details {
            flex: 1;
            text-align: center;
        }
        
        .reference-details {
            margin-bottom: 20px;
            font-size: 12px;
        }
        
        .reference-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
        }
        
        .subject {
            font-weight: 600;
            margin: 20px 0;
        }
        
        .content {
            margin: 20px 0;
            text-align: justify;
        }
        
        .content p {
            margin-bottom: 15px;
        }
        
        .signature-section {
            margin-top: 40px;
            text-align: right;
        }
        
        .signature-section p {
            margin-bottom: 5px;
        }
        
        .copies-section {
            margin-top: 30px;
        }
        
        .copies-section p {
            margin-bottom: 5px;
        }
        
        .underline {
            text-decoration: underline;
        }
        
        .center {
            text-align: center;
        }
        
        .right {
            text-align: right;
        }
        
        .bold {
            font-weight: 600;
        }
        
        .letterhead-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .letterhead-table td {
            border: 1px solid #000;
            padding: 10px;
            vertical-align: top;
        }
        
        .letterhead-table .logo-cell {
            width: 80px;
            text-align: center;
        }
        
        .letterhead-table .content-cell {
            text-align: center;
        }
        
        .letterhead-table .emblem-cell {
            width: 80px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="letterhead">
        <table class="letterhead-table">
            <tr>
                <td class="logo-cell">
                    <div class="logo">महाराष्ट्र पोलीस</div>
                </td>
                <td class="content-cell">
                    <h1>पोलीस अधिक्षक कार्यालय, अहिल्यानगर</h1>
                    <h2>(अर्ज शाखा)</h2>
                </td>
                <td class="emblem-cell">
                    <div class="logo">🏛️</div>
                </td>
            </tr>
        </table>
    </div>
    
    <div class="content">
        <pre style="font-family: 'Noto Sans Devanagari', Arial, sans-serif; white-space: pre-wrap; word-wrap: break-word;">${letterContent}</pre>
    </div>
</body>
</html>
    `;
  }
  
  // Save PDF to file system
  async savePDFToFile(pdfBuffer, fileName) {
    try {
      const uploadsDir = path.join(__dirname, '../uploads/pdfs');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, pdfBuffer);
      
      return filePath;
      
    } catch (error) {
      console.error('Error saving PDF file:', error);
      throw new Error('Failed to save PDF file');
    }
  }
}

module.exports = new PDFService();