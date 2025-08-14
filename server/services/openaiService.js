// services/openaiService.js - Updated without API key dependency - EXACT PDF MATCH
require('dotenv').config();

class OpenAIService {
  
  // ✅ GENERATE COVERING LETTER - OFFLINE (No API Required)
  async generateCoveringLetter(patraData) {
    try {
      const { patra, letterType, extractedText } = patraData;
      
      // Extract complainant information from the text
      const complainantInfo = this.extractComplainantInfo(extractedText);
      
      // Generate problem statement and solution OFFLINE
      const problemSolution = this.generateProblemSolutionOffline(extractedText, letterType);
      
      // Create comprehensive offline letter content
      const letterContent = this.createOfflineLetterContent(patra, letterType, extractedText, complainantInfo, problemSolution);
      
      console.log('✅ Covering letter generated offline successfully');
      return letterContent;

    } catch (error) {
      console.error('❌ Error generating covering letter offline:', error);
      return this.getDefaultLetterContent(letterType);
    }
  }

  // ✅ GENERATE PROBLEM SOLUTION - OFFLINE
  generateProblemSolutionOffline(extractedText, letterType) {
    try {
      // Analyze text content to determine problem type
      const problemType = this.analyzeProblemType(extractedText, letterType);
      
      // Generate problem and solution based on type
      const templates = this.getProblemSolutionTemplates();
      const template = templates[problemType] || templates['DEFAULT'];
      
      return `**समस्या विवरण:**\n${template.problem}\n\n**उपाय/कार्यवाही:**\n${template.solution}`;

    } catch (error) {
      console.error('❌ Error generating problem solution offline:', error);
      return '**समस्या विवरण:**\nपोलीस कर्मचाऱ्यांविरुद्ध तक्रार.\n\n**उपाय/कार्यवाही:**\nयोग्य चौकशी करून कार्यवाही करणे.';
    }
  }

  // ✅ ANALYZE PROBLEM TYPE FROM TEXT
  analyzeProblemType(extractedText, letterType) {
    if (!extractedText) return letterType;

    const text = extractedText.toLowerCase();
    
    // Problem type detection based on keywords
    if (text.includes('तक्रार') || text.includes('complaint')) {
      if (text.includes('पोलीस') || text.includes('police')) return 'POLICE_COMPLAINT';
      if (text.includes('भ्रष्टाचार') || text.includes('corruption')) return 'CORRUPTION';
      return 'GENERAL_COMPLAINT';
    }
    
    if (text.includes('अर्ज') || text.includes('application')) {
      if (text.includes('नोकरी') || text.includes('job')) return 'JOB_APPLICATION';
      if (text.includes('परवानगी') || text.includes('permission')) return 'PERMISSION_REQUEST';
      return 'GENERAL_APPLICATION';
    }
    
    if (text.includes('माहिती') || text.includes('information')) return 'INFORMATION_REQUEST';
    if (text.includes('तपासणी') || text.includes('inquiry')) return 'INQUIRY';
    
    return letterType || 'DEFAULT';
  }

  // ✅ GET PROBLEM SOLUTION TEMPLATES
  getProblemSolutionTemplates() {
    return {
      'POLICE_COMPLAINT': {
        problem: 'पोलीस कर्मचाऱ्यांविरुद्ध तक्रार प्राप्त झाली आहे. संबंधित घटनेची तपासणी करण्याची मागणी करण्यात आली आहे.',
        solution: 'संबंधित पोलीस कर्मचाऱ्यांकडून स्पष्टीकरण घेऊन आवश्यक चौकशी करण्यात आली आहे. योग्य ती शिस्तभंगाची कार्यवाही करण्यात आली आहे.'
      },
      'CORRUPTION': {
        problem: 'भ्रष्टाचाराच्या संदर्भात तक्रार प्राप्त झाली आहे. या प्रकरणी तातडीने कार्यवाही करण्याची मागणी करण्यात आली आहे.',
        solution: 'संबंधित अधिकाऱ्यांविरुद्ध चौकशी करून आवश्यक कायदेशीर कार्यवाही करण्यात आली आहे.'
      },
      'GENERAL_COMPLAINT': {
        problem: 'सामान्य तक्रार प्राप्त झाली आहे. या संदर्भात लक्ष देण्याची मागणी करण्यात आली आहे.',
        solution: 'संबंधित विभागाकडून आवश्यक कार्यवाही करून प्रकरणाचे निराकरण करण्यात आले आहे.'
      },
      'JOB_APPLICATION': {
        problem: 'नोकरीसाठी अर्ज प्राप्त झाला आहे. पात्रतेची पूर्तता करणाऱ्या उमेदवारांची मागणी आहे.',
        solution: 'अर्जाची तपासणी करून पात्र उमेदवारांची यादी तयार करण्यात आली आहे. पुढील प्रक्रिया सुरू करण्यात आली आहे.'
      },
      'PERMISSION_REQUEST': {
        problem: 'विशिष्ट कार्यासाठी परवानगीचा अर्ज प्राप्त झाला आहे. नियमांनुसार परवानगी मिळावी अशी मागणी आहे.',
        solution: 'अर्जाचे परीक्षण करून नियमांच्या अधीन राहून आवश्यक परवानगी देण्यात आली आहे.'
      },
      'INFORMATION_REQUEST': {
        problem: 'माहिती अधिकार कायद्यांतर्गत माहितीची मागणी करण्यात आली आहे.',
        solution: 'उपलब्ध माहिती संकलित करून नियमांनुसार पुरवण्यात आली आहे.'
      },
      'INQUIRY': {
        problem: 'विशिष्ट प्रकरणाबाबत तपासणीची मागणी करण्यात आली आहे.',
        solution: 'संबंधित प्रकरणाची सविस्तर तपासणी करून अहवाल तयार करण्यात आला आहे.'
      },
      'NAR': {
        problem: 'प्राप्त झालेल्या तक्रारीचे परीक्षण करण्यात आले आहे.',
        solution: 'संबंधित तक्रारीवर आवश्यक कार्यवाही करून प्रकरणाचे निराकरण करण्यात आले आहे.'
      },
      'NA': {
        problem: 'अर्जदाराची तक्रार विचारात घेण्यात आली आहे.',
        solution: 'सदर प्रकरणी कोणतीही कार्यवाही आवश्यक नसल्याचे निष्पन्न झाले आहे.'
      },
      'FORWARD': {
        problem: 'प्राप्त अर्जाचा विषय संबंधित अधिकाऱ्यांच्या कार्यक्षेत्रात येतो.',
        solution: 'सदर अर्ज योग्य त्या अधिकाऱ्यांकडे पुढील कार्यवाहीसाठी पाठवण्यात आला आहे.'
      },
      'DEFAULT': {
        problem: 'प्राप्त झालेल्या अर्जाचे/तक्रारीचे परीक्षण करण्यात आले आहे.',
        solution: 'आवश्यक कार्यवाही करून योग्य निर्णय घेण्यात आला आहे.'
      }
    };
  }

  // ✅ CREATE OFFLINE LETTER CONTENT
  createOfflineLetterContent(patra, letterType, extractedText, complainantInfo, problemSolution) {
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    // Generate content based on letter type and extracted information
    const letterContent = this.generateMarathiGovernmentLetter(patra, letterType, extractedText, complainantInfo, problemSolution);
    
    return letterContent;
  }

  // ✅ GENERATE MARATHI GOVERNMENT LETTER - EXACT PDF TEXT MATCH
  generateMarathiGovernmentLetter(patra, letterType, extractedText, complainantInfo, problemSolution) {
    // Generate content based on exact PDF format - CHARACTER BY CHARACTER MATCH
    let letterContent = '';

    switch(letterType) {
      case 'NAR':
        letterContent = `उपरोक्त विषयान्वये कळविण्यात येते की, मा. पोलीस अधीक्षक कार्यालय येथे खालील नमुद अर्ज प्राप्त झाले आहेत.सदर अर्जांची चौकशी करतांना मा. सर्वोच्च न्यायालयाच्या संवैधानीक खंडपीठाने ललित कुमारी विरुध्द यु.पी. सरकार रिट पिटीशन मध्ये दिलेल्या निर्देशांचे व सुचनांचे तंतोतंत पालन करावे तसेच मा. पोलीस अधीक्षक सो.यांनी अर्जां संबंधात दिलेल्या सुचनांचे पालन करून अर्जांची तात्काळ निर्गती करण्यात यावी.

तसेच खालील नमुद अर्जांची चौकशी आपण स्वत: करून अर्जांची चौकशी पुर्ण झाल्यानंतर सदरचा अर्ज दप्तरी फाईल होणेकामी पोलीस अधीक्षक कार्यालय,अहिल्यानगर येथे सादर करण्यात यावा.अर्जांसोबत मुळ अर्ज प्रकरण,अर्जदार,गैरअर्जदार यांचे जबाब,पुराव्याचे कागदपत्रे,अर्जदारास त्यांचे अर्जांवरती केलेल्या कारवाईच्या  माहिती बाबतचे लेखी समजपत्र,झाले चौकशीचा अंतिम अहवाल इत्यादी कागदपत्र सोबत जोडुन ०७ दिवसांचे आत ईकडील कार्यालयास पाठविण्यात यावेत.अन्यथा होणा-या विलंबास आपणास व्यक्तीश:जबाबदार धरण्यात येईल यांची नोंद घ्यावी.`;
        break;

      case 'NA':
        letterContent = `उपरोक्त विषयान्वये कळविण्यात येते की, मा. पोलीस अधीक्षक कार्यालय येथे खालील नमुद अर्ज प्राप्त झाले आहेत.सदर अर्जांची चौकशी करतांना मा. सर्वोच्च न्यायालयाच्या संवैधानीक खंडपीठाने ललित कुमारी विरुध्द यु.पी. सरकार रिट पिटीशन मध्ये दिलेल्या निर्देशांचे व सुचनांचे तंतोतंत पालन करावे तसेच मा. पोलीस अधीक्षक सो.यांनी अर्जां संबंधात दिलेल्या सुचनांचे पालन करून अर्जांची तात्काळ निर्गती करण्यात यावी.

तसेच अर्जप्रकरणांची चौकशी पुर्ण झाल्यानंतर अर्जदार यांना त्यांच्या अर्जवर केलेल्या कार्यवाहीचे माहिती बाबत लेखी समज देवुन सदरचा अर्ज आपल्या स्तरावर दप्तरी  करून अर्जच्या चौकशीची संपुर्ण कागदपत्रे पोलीस ठाणेस जतन करून ठेवण्यात यावीत.`;
        break;

      case 'FORWARD':
        letterContent = `उपरोक्त विषयान्वये कळविण्यात येते की, आपल्या अधीक्षक कार्यालयात येथे प्राप्त झालेल्या तक्रार अर्जाच्या संदर्भात खाली नमुद केल्यानुसार कार्यवाही करण्यात आली आहे.

सदर अर्ज संबंधित अधिकाऱ्यांच्या कार्यक्षेत्रात येत असल्याने योग्य त्या अधिकाऱ्यांकडे पुढील कार्यवाहीसाठी पाठवण्यात आला आहे.

पुढील कार्यवाहीची माहिती संबंधित कार्यालयाकडून मिळेल.`;
        break;

      case 'ACKNOWLEDGMENT':
        letterContent = `उपरोक्त विषयान्वये कळविण्यात येते की, आपला अर्ज प्राप्त झाला आहे.

सदर अर्जाचे परीक्षण करून योग्य ती कार्यवाही लवकरच करण्यात येईल.

अधिक माहितीसाठी कार्यालयीन वेळेत संपर्क साधावा.`;
        break;

      case 'GOVERNMENT':
        letterContent = `उपरोक्त विषयान्वये कळविण्यात येते की, शासनाच्या सूचनांनुसार आवश्यक कार्यवाही करण्यात आली आहे.

संबंधित नियमांच्या अधीन राहून योग्य निर्णय घेण्यात आला आहे.

सदर प्रकरणाबाबत अधिक माहिती आवश्यक असल्यास कार्यालयीन वेळेत संपर्क साधावा.`;
        break;

      case 'POLICE_COMMISSIONER':
        letterContent = `उपरोक्त विषयान्वये कळविण्यात येते की, पोलीस आयुक्तांच्या आदेशानुसार कार्यवाही करण्यात आली आहे.

संबंधित सूचनांचे अनुपालन करण्यात आले आहे.

सदर प्रकरणाबाबत अधिक माहिती आवश्यक असल्यास कार्यालयीन वेळेत संपर्क साधावा.`;
        break;

      case 'LOCAL':
        letterContent = `उपरोक्त विषयान्वये कळविण्यात येते की, स्थानिक पोलीस ठाण्याकडून आवश्यक कार्यवाही करण्यात आली आहे.

संबंधित प्रकरणावर योग्य ती कार्यवाही करण्यात आली आहे.

सदर प्रकरणाबाबत अधिक माहिती आवश्यक असल्यास कार्यालयीन वेळेत संपर्क साधावा.`;
        break;

      default:
        // Default NAR content - EXACT PDF TEXT
        letterContent = `उपरोक्त विषयान्वये कळविण्यात येते की, मा. पोलीस अधीक्षक कार्यालय येथे खालील नमुद अर्ज प्राप्त झाले आहेत.सदर अर्जांची चौकशी करतांना मा. सर्वोच्च न्यायालयाच्या संवैधानीक खंडपीठाने ललित कुमारी विरुध्द यु.पी. सरकार रिट पिटीशन मध्ये दिलेल्या निर्देशांचे व सुचनांचे तंतोतंत पालन करावे तसेच मा. पोलीस अधीक्षक सो.यांनी अर्जां संबंधात दिलेल्या सुचनांचे पालन करून अर्जांची तात्काळ निर्गती करण्यात यावी.

तसेच खालील नमुद अर्जांची चौकशी आपण स्वत: करून अर्जांची चौकशी पूर्ण झाल्यानंतर सदरचा अर्ज दप्तरी फाईल होणेकामी पोलीस अधीक्षक कार्यालय,अहिल्यानगर येथे सादर करण्यात यावा.अर्जांसोबत मुळ अर्ज प्रकरण,अर्जदार,गैरअर्जदार यांचे जबाब,पुराव्याचे कागदपत्रे,अर्जदारास त्यांचे अर्जांवरती केलेल्या कारवाईच्या  माहिती बाबतचे लेखी समजपत्र,झाले चौकशीचा अंतिम अहवाल इत्यादी कागदपत्र सोबत जोडुन ०७ दिवसांचे आत ईकडील कार्यालयास पाठविण्यात यावेत.अन्यथा होणा-या विलंबास आपणास व्यक्तीश:जबाबदार धरण्यात येईल यांची नोंद घ्यावी.`;
        break;
    }

    return letterContent;
  }

  // ✅ CREATE MARATHI GOVERNMENT PROMPT (For future API use)
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

उपरोक्त विषयान्वये कळविण्यात येते की, आपल्या अधीक्षक कार्यालयात येथे प्राप्त झालेल्या तक्रार अर्जाच्या संदर्भात खाली नमुद केल्यानुसार कार्यवाही करण्यात आली आहे. कार्यवाहीचा तपशील खालीलप्रमाणे आहे:

[इथे समस्येचे वर्णन करा]

[इथे केलेल्या कार्यवाहीचे वर्णन करा]

[इथे पुढील कार्यवाहीचे वर्णन करा]

फक्त मुख्य मजकूर द्या. लेटरहेड, स्वाक्षरी किंवा प्रती यादी नको.
`;
  }

  // ✅ EXTRACT COMPLAINANT INFORMATION FROM TEXT (Enhanced)
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

    // Extract name - Multiple patterns
    let name = 'अर्जदाराचे नाव';
    
    const namePatterns = [
      /तक्रारदार[:\s]*[-–—]?\s*(.+?)(?:\n|रा\.|\s+वय|\s+रह)/i,
      /(?:श्री|श्रीमती)\s+(.+?)(?:,|\s+रा\.|\s+वय|\n)/i,
      /^(.+?)\s+(?:रा\.|वय|ता\.)/m,
      /(?:नाव|नावे|आवेदक|अर्जदार)[:\s]*[-–—]?\s*(.+?)(?:\n|,|।)/i
    ];

    for (const pattern of namePatterns) {
      const match = extractedText.match(pattern);
      if (match) {
        name = match[1].trim().replace(/[,\.\-–—]/g, '').trim();
        if (name.length > 50) name = name.substring(0, 50) + '...';
        break;
      }
    }

    // Extract address
    let address = 'पत्ता';
    const addressMatch = extractedText.match(/रा\.?\s*(.+?)(?:\n|मोबा|ता\.|\s+फोन)/i);
    if (addressMatch) {
      address = 'रा. ' + addressMatch[1].trim();
    }

    // Extract phone
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

  // ✅ GET DEFAULT LETTER CONTENT FALLBACK
  getDefaultLetterContent(letterType) {
    const defaultContents = {
      'NAR': `उपरोक्त विषयान्वये कळविण्यात येते की, आपल्या अधीक्षक कार्यालयात येथे प्राप्त झालेल्या तक्रार अर्जाच्या संदर्भात आवश्यक कार्यवाही करण्यात आली आहे.

सदर तक्रारीच्या संदर्भात संबंधित पोलीस कर्मचाऱ्यांकडून स्पष्टीकरण घेऊन योग्य ती कार्यवाही करण्यात आली आहे.

सदर प्रकरणाबाबत अधिक माहिती आवश्यक असल्यास कार्यालयीन वेळेत संपर्क साधावा.`,

      'NA': `उपरोक्त विषयान्वये कळविण्यात येते की, आपल्या अधीक्षक कार्यालयात येथे प्राप्त झालेल्या अर्जाचा विषय विचारात घेण्यात आला आहे.

सदर प्रकरणी कोणतीही कार्यवाही आवश्यक नसल्याचे निष्पन्न झाले आहे.`,

      'FORWARD': `उपरोक्त विषयान्वये कळविण्यात येते की, प्राप्त झालेल्या अर्जाचा विषय संबंधित अधिकाऱ्यांच्या कार्यक्षेत्रात येतो.

सदर अर्ज योग्य त्या अधिकाऱ्यांकडे पुढील कार्यवाहीसाठी पाठवण्यात आला आहे.`,

      'ACKNOWLEDGMENT': `उपरोक्त विषयान्वये कळविण्यात येते की, आपला अर्ज प्राप्त झाला आहे.

सदर अर्जावर लवकरच आवश्यक कार्यवाही करण्यात येईल.`,

      'GOVERNMENT': `उपरोक्त विषयान्वये कळविण्यात येते की, शासनाच्या सूचनांनुसार आवश्यक कार्यवाही करण्यात आली आहे.

संबंधित नियमांच्या अधीन राहून योग्य निर्णय घेण्यात आला आहे.`,

      'POLICE_COMMISSIONER': `उपरोक्त विषयान्वये कळविण्यात येते की, पोलीस आयुक्तांच्या आदेशानुसार कार्यवाही करण्यात आली आहे.

संबंधित सूचनांचे अनुपालन करण्यात आले आहे.`,

      'LOCAL': `उपरोक्त विषयान्वये कळविण्यात येते की, स्थानिक पोलीस ठाण्याकडून आवश्यक कार्यवाही करण्यात आली आहे.

संबंधित प्रकरणावर योग्य ती कार्यवाही करण्यात आली आहे.`
    };

    return defaultContents[letterType] || defaultContents['NAR'];
  }
}

module.exports = new OpenAIService();