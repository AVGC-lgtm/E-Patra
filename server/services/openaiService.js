// services/openaiService.js - Updated for better format matching
require('dotenv').config();
const axios = require('axios');

const apiKey = process.env.OPENAI_API_KEY;

class OpenAIService {
  
  // Generate covering letter based on extracted text and Patra data
  async generateCoveringLetter(patraData) {
    try {
      const { patra, letterType, extractedText } = patraData;
      
      // Extract complainant information from the text
      const complainantInfo = this.extractComplainantInfo(extractedText);
      
      // Generate problem statement and solution
      const problemSolution = await this.generateProblemSolution(extractedText);
      
      // Create comprehensive prompt for Marathi government letter
      const prompt = this.createMarathiGovernmentPrompt(patra, letterType, extractedText, complainantInfo, problemSolution);
      
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert in drafting official Maharashtra government covering letters in Marathi. 
            You must generate letters that exactly match the format, style, and language used in official government correspondence.
            Always use proper Marathi government terminology, formatting, and structure.
            The response should be formal, professional, and follow Maharashtra government letter writing standards.
            Generate ONLY the letter content without any explanations or additional text.
            The content should be suitable for placement in the main body of the letter, not including letterhead or signature sections.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1200,
        temperature: 0.2,
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices[0].message.content.trim();

    } catch (error) {
      console.error('Error generating covering letter:', error.response ? error.response.data : error.message);
      throw new Error('Failed to generate covering letter');
    }
  }

  // Extract complainant information from the text
  extractComplainantInfo(extractedText) {
    if (!extractedText) {
      return {
        name: 'अर्जदाराचे नाव',
        address: 'पत्ता',
        phone: '',
        firs: [],
        courtCase: '',
        policeOfficers: []
      };
    }

    // Extract name - try multiple patterns
    let name = 'अर्जदाराचे नाव';
    
    // Pattern 1: तक्रारदार - Name
    const nameMatch1 = extractedText.match(/तक्रारदार[:\s]*[-–—]?\s*(.+?)(?:\n|रा\.|\s+वय|\s+रह)/i);
    if (nameMatch1) {
      name = nameMatch1[1].trim();
    } else {
      // Pattern 2: श्री/श्रीमती Name
      const nameMatch2 = extractedText.match(/(?:श्री|श्रीमती)\s+(.+?)(?:,|\s+रा\.|\s+वय|\n)/i);
      if (nameMatch2) {
        name = nameMatch2[1].trim();
      } else {
        // Pattern 3: General name pattern at start of document
        const nameMatch3 = extractedText.match(/^(.+?)\s+(?:रा\.|वय|ता\.)/m);
        if (nameMatch3) {
          name = nameMatch3[1].trim();
        } else {
          // Pattern 4: Look for name after common keywords
          const nameMatch4 = extractedText.match(/(?:नाव|नावे|आवेदक|अर्जदार)[:\s]*[-–—]?\s*(.+?)(?:\n|,|।)/i);
          if (nameMatch4) {
            name = nameMatch4[1].trim();
          }
        }
      }
    }

    // Clean up the name
    name = name.replace(/[,\.\-–—]/g, '').trim();
    if (name.length > 50) {
      name = name.substring(0, 50) + '...';
    }

    // Extract address
    let address = 'पत्ता';
    const addressMatch = extractedText.match(/रा\.?\s*(.+?)(?:\n|मोबा|ता\.|\s+फोन)/i);
    if (addressMatch) {
      address = 'रा. ' + addressMatch[1].trim();
    }

    // Extract phone number
    let phone = '';
    const phoneMatch = extractedText.match(/(?:मोबा|फोन)\.?\s*(?:नं\.?)?\s*[:-]?\s*(\d{10})/i);
    if (phoneMatch) {
      phone = phoneMatch[1];
    }

    // Extract FIR numbers
    const firMatches = extractedText.match(/(?:एफ\s*आय\s*आर|FIR)\s*नं?\.?\s*(\d+\/\d+)/gi);
    const firs = firMatches ? firMatches.map(match => match.match(/(\d+\/\d+)/)[1]) : [];

    // Extract court case
    let courtCase = '';
    const courtMatch = extractedText.match(/(?:आर\s*सी\s*सी|RCC)\s*नं?\.?\s*(\d+\/\d+)/i);
    if (courtMatch) {
      courtCase = courtMatch[1];
    }

    // Extract police officers
    const policeOfficers = [];
    const officerMatches = extractedText.match(/(?:प्रताप\s*दराडे|सागर\s*पालवे|संदिप\s*नारायण\s*साठे)/gi);
    if (officerMatches) {
      policeOfficers.push(...officerMatches);
    }

    return { name, address, phone, firs, courtCase, policeOfficers };
  }

  // Generate problem statement and solution
  async generateProblemSolution(extractedText) {
    try {
      const prompt = `
निम्नलिखित पोलीस तक्रार मजकुराचे विश्लेषण करून मराठीत समस्या विवरण आणि उपाय सुचवा:

मजकूर: ${extractedText.substring(0, 2000)}

कृपया खालील स्वरूपात उत्तर द्या:
**समस्या विवरण:**
[मुख्य समस्या स्पष्ट करा]

**उपाय/कार्यवाही:**
[सुचविलेली कार्यवाही]

फक्त मराठी मजकूर द्या. प्रत्येक विभाग 2-3 वाक्यांचा असावा.
`;

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'तुम्ही महाराष्ट्र शासनाच्या दस्तऐवजांचे विश्लेषण करण्यात तज्ञ आहात. मराठीमध्ये अचूक आणि स्पष्ट उत्तर द्या.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 400,
        temperature: 0.3,
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices[0].message.content.trim();

    } catch (error) {
      console.error('Error generating problem solution:', error);
      return '**समस्या विवरण:**\nपोलीस कर्मचाऱ्यांविरुद्ध तक्रार.\n\n**उपाय/कार्यवाही:**\nयोग्य चौकशी करून कार्यवाही करणे.';
    }
  }

  // Create Marathi government letter prompt
  createMarathiGovernmentPrompt(patra, letterType, extractedText, complainantInfo, problemSolution) {
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    return `
कृपया खालील माहितीच्या आधारे मराठी सरकारी पत्राचा मुख्य भाग तयार करा:

तक्रारदार माहिती:
- नाव: ${complainantInfo.name}
- पत्ता: ${complainantInfo.address}
- फोन: ${complainantInfo.phone}
- विषय: ${patra.subject}
- दिनांक: ${patra.dateOfReceiptOfLetter}

समस्या आणि उपाय:
${problemSolution}

कृपया खालील स्वरूपात मजकूर तयार करा:

उपरोक्त विषयान्वये सविनय निवेदन की, आपल्या अधिक्षक कार्यालयात येथे प्राप्त झालेल्या तक्रार अर्जाच्या संदर्भात खाली नमूद केल्यानुसार कार्यवाही करण्यात आली आहे. कार्यवाहीचा तपशील खालीलप्रमाणे आहे:

[इथे समस्येचे वर्णन करा]

[इथे केलेल्या कार्यवाहीचे वर्णन करा]

[इथे पुढील कार्यवाहीचे वर्णन करा]

फक्त मुख्य मजकूर द्या. लेटरहेड, स्वाक्षरी किंवा प्रती यादी नको.
`;
  }
}

module.exports = new OpenAIService();