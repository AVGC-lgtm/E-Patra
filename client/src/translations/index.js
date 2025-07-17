const translations = {
  en: {
    dashboard: 'Dashboard',
    newLetter: 'Inward Letter',
    allLetters: 'All Letters',
    trackApplication: 'Track Application',
    logout: 'Logout',
    user: 'User',
    letterSystem: 'Letter System',
    close: 'Close',
    menu: 'Menu',
    receivedLetters: 'Received Letters',
    toggleSidebar: 'Toggle Sidebar',
    profile: 'Profile',
    settings: 'Settings',
    notifications: 'Notifications',
    uploadLetter: 'Upload Letter',
    dragAndDrop: 'Drag & drop files here or click to browse',
    selectFiles: 'Select Files',
    receivedByOffice: 'Office sending the letter',
    recipientName: 'Name and designation of the sender',
    designation: 'Designation',
    letterClassification: 'Letter Classification',
    letterType: 'Letter Type',
    letterMedium: 'Letter Medium',
    letterStatus: 'Letter Category',
    selectType: 'Select Type',
    letterDate: 'Letter Date',
    officeType: 'Office Type',
    selectOfficeType: 'Select Office Type',
    office: 'Office',
    mobileNumber: 'Mobile No / Telephone No',
    officeBranchName: 'Office/Branch Name',
    typeOfAction: 'Type of Action',
    selectAction: 'Select Action',
    selectCategory: 'Select Category',
    selectMedium: 'Select Medium',
    selectStatus: 'Select Status',
    selectOffice: 'Select Office',
    selectOfficeBranch: 'Select Office/Branch',
    submit: 'Submit',
    reset: 'Reset',
    remarks: 'Remarks',
    subject: 'Subject',
    details: 'Details',
    fileUploaded: 'File Uploaded',
    remove: 'Remove',
    letterSubmitted: 'Letter submitted successfully!',
    submitError: 'Failed to submit letter. Please try again.',
    inbox:"Inbox",
    // Letter Categories
    complaint: 'Complaint',
    inquiry: 'Inquiry',
    report: 'Report',
    notice_memo: 'Notice Memo',
    date_of_receipt_of_the_letter: "Date of Receipt of the Letter",
    no_of_documents: "No of Documents",
    // Letter Mediums
    hard_copy: 'Hard Copy',
    soft_copy: 'Soft Copy',
    soft_copy_and_hard_copy: "Soft Copy and Hard Copy",
    outward_letter_no: "Outward Letter No",

    // Letter Classifications
    select_category: "Select Category",
    select_category: "Select Category",
    senior_mail: "Senior Mail",
    senior_application: "Senior Application",
    reference_letter: "Reference Letter",
    other_mail: "Other Mail",
    other_application: "Other Application",
    portal_application: "Portal Application",
    right_to_public_services_act_2015: "Right to Public Services Act 2015",
    right_to_information: "Right to Information",
  
    // --- Senior Post (Senior Mail) specific entries ---
    senior_post_dgp: "Senior Mail - Director General of Police",
    senior_post_govt_maharashtra: "Senior Mail - Government of Maharashtra",
    senior_post_igp: "Senior Mail - Special Inspector General of Police",
    senior_post_addl_dgp: "Senior Mail - Additional Director General of Police",
    senior_post_accountant_general: "Senior Mail - Accountant General's Office, Nagpur, Maharashtra State, Mumbai",
    senior_post_accountant_general_office: "Senior Mail - Accountant General's Office, Maharashtra State, Mumbai",
    senior_post_director_pay_verification: "Senior Mail - Director, Salary Verification Team, Nashik",
    senior_post_police_commissioner: "Senior Mail - Commissioner of Police",
    senior_post_divisional_commissioner: "Senior Mail - Divisional Commissioner (Semi-Governmental Reference)",
    senior_post_sp: "Senior Mail - SP",
    senior_post_sdpo: "Senior Mail - SDPO",
  
    // --- Senior Application specific entries ---
    senior_application_dgp: "Senior Application - Director General of Police",
    senior_application_govt_maharashtra: "Senior Application - Government of Maharashtra",
    senior_application_igp: "Senior Application - Special Inspector General of Police",
    senior_application_addl_dgp: "Senior Application - Additional Director General of Police",
    senior_application_police_commissioner: "Senior Application - Commissioner of Police",
    senior_application_divisional_commissioner: "Senior Application - Divisional Commissioner",
  
    // --- Reference and Other Document Types ---
    // Note: 'reference_letter' is duplicated, assuming the user meant the category header. Removed redundancy.
    semi_governmental_reference: "Semi-Governmental Reference",
    aaple_sarkar_reference: "Aaple Sarkar Reference",
    mla_reference: "MLA Reference",
    dist_police_superintendent_reference: "District Police Superintendent Reference",
    mp_reference: "MP Reference",
    district_collector_reference: "District Collector Reference",
    complaint: "Complaint",
    bill_reference: "Bill Reference",
    judicial_reference: "Judicial Reference",
    file_reference: "File Reference",
    circular: "Circular",
    minister_reference: "Minister Reference",
    mayor_official_corporator: "Mayor / Office Bearer / Corporator",
    human_rights_reference: "Human Rights Reference",
    lokayukta_uplokayukta_reference: "Lokayukta/Uplokayukta Reference",
    lokshahi_din_reference: "Lokshahi Din Reference",
    assembly_question_starred_unstarred: "Assembly Starred/Unstarred Question",
    divisional_commissioner_reference: "Divisional Commissioner Reference",
    government_letter: "Government Letter",
    government_reference: "Government Reference",
  
    // --- Other Mail specific entries ---
    other_mail_confidential: "Confidential (Other Mail)",
    other_mail_sanction_offence: "Sanction of Offence (Other Mail)",
    other_mail_deficiency: "Deficiency (Other Mail)",
    other_mail_hospital_record: "Hospital Record (Other Mail)",
    other_mail_accumulated_leave: "Accumulated Leave Case (Other Mail)",
    other_mail_parole_leave: "Parole Leave Case (Other Mail)",
    other_mail_weekly_diary: "Weekly Diary (Other Mail)",
    other_mail_daily_check: "Daily Check (Other Mail)",
    other_mail_fingerprint: "Fingerprint (Other Mail)",
    other_mail_medical_bill: "Medical Bill (Other Mail)",
    other_mail_tenant_verification: "Tenant Verification (Other Mail)",
    other_mail_leave_sanction: "Leave Sanction Matter (Other Mail)",
    other_mail_warrant: "Warrant (Other Mail)",
    other_mail_explanation_absence: "Explanation / Absence (Other Mail)",
    other_mail_death_summary_approval: "Death Summary Approval (Other Mail)",
    other_mail_viscera: "Viscera (Other Mail)",
  
    // --- Departmental Inquiry & Orders ---
    departmental_inquiry_order: "Departmental Inquiry Order",
    final_order: "Final Order",
  
    // --- Public Relations ---
    district_police_press_release: "District Police Press Release",
  
    // --- Licenses & Permissions (General) ---
    license_permit: "License / Permit",
  
    // --- Inspections & Tours ---
    office_inspection: "Office Inspection",
    vip_tour: "VIP Tour",
  
    // --- Security & Law Enforcement ---
    bandobast: "Bandobast (Security Arrangement)",
    reward_punishment: "Reward / Punishment",
    officer_in_charge_order: "Officer-in-Charge Order",
    do_letter: "D.O. Letter (Demi-Official)",
    pcr: "PCR", 
    cyber: "Cyber",
    cdr: "CDR",
    caf: "CAF",
    sdr: "SDR",
    imei: "IMEI",
    dump_data: "Dump Data",
    it_act: "IT Act",
    facebook: "Facebook",
    online_fraud: "Online Fraud",
    cdr_sdr_caf_imei_ipdr_dump: "CDR/SDR/CAF/IMEI/IPDR/DUMP",
  
    self_immolation: "Self-Immolation",
    civil_rights_protection: "Civil Rights Protection",
  
    steno: "Steno",
    stenographer: "Stenographer",
  
  
    a_class_pm: "Class A - Hon'ble Prime Minister",
    a_class_cm: "Class A - Hon'ble Chief Minister",
    a_class_deputy_cm: "Class A - Hon'ble Deputy Chief Minister",
    a_class_home_minister: "Class A - Hon'ble Home Minister",
    a_class_mos_home: "Class A - Hon'ble Minister of State (Home)",
    a_class_guardian_minister: "Class A - Hon'ble Guardian Minister",
    a_class_union_minister: "Class A - Union Minister",
    a_class_mp: "Class A - MP (Member of Parliament)",
    a_class_mla: "Class A - MLA (Member of Legislative Assembly)",
    a_class_other: "Class A - Other",
  
    other_general: "Other",
  
    treasury: "Treasury",
    commandant: "Commandant",
    principal_police_training_center: "Principal - Police Training Center",
  

    c_class_police_commissioner: "Class C - Commissioner of Police",
  

    application_branch_inquiry_report: "Application Branch Inquiry Report",
    appeal: "Appeal",
  
 
    in_service_training: "In-Service Training",
    building_branch: "Building Branch",
    pension_matter: "Pension Matter",
    government_vehicle_license: "Government Vehicle License",
    payments_bills: "Payments / Bills",
    departmental_inquiry: "Departmental Inquiry",
    lapses_case: "Lapses / Default Case",
    pay_fixation: "Pay Fixation",
    transfer: "Transfer",

  
 
    other_application_local: "Local Application",
    other_application_anonymous: "Anonymous Application",
    other_application_district_serviceman: "District Serviceman Application",
    other_application_moneylending_related: "Moneylending Related Application",
    other_application_lokshahi_related: "Lokshahi Related Application",
    other_application_confidential: "Confidential Application",
  
   
    b_class_sp_ahmednagar_direct_visit: "Class B - Hon'ble SP, Ahmednagar (Direct Visit)",
    b_class_addl_sp_ahmednagar_direct_visit: "Class B - Hon'ble Addl. SP, Ahmednagar (Direct Visit)",
  

    c_class_divisional_commissioner: "Class C - Divisional Commissioner",
    c_class_district_collector: "Class C - District Collector",
    c_class_sdpo_shrirampur: "Class C - SDPO, Shrirampur",
    c_class_sdpo_karjat: "Class C - SDPO, Karjat",
    c_class_sdpo_shirdi: "Class C - SDPO, Shirdi",
    c_class_sdpo_shevgaon: "Class C - SDPO, Shevgaon",
    c_class_all_police_stations: "Class C - All Police Stations",
    c_class_all_branches: "Class C - All Branches",
    c_class_sainik_board: "Class C - Sainik Board",
    c_class_senior_army_officer: "Class C - Senior Army Officer",
    c_class_lokshahi_din: "Class C - Lokshahi Din",
    c_class_sdpo_nagar_city: "Class C - SDPO, Nagar City",
    c_class_sdpo_nagar_taluka: "Class C - SDPO, Nagar Taluka",
    c_class_sdpo_sangamner: "Class C - SDPO, Sangamner",
  
    portal_application_pm_pg: "Portal Application - Prime Minister (P.G.)",
    portal_application_aaple_sarkar: "Portal Application - Aaple Sarkar",
    portal_application_homd: "Portal Application - H.O.M.D. (Minister of State for Home)",
  
    // --- Right to Public Services Act 2015 specific entries ---
    right_to_public_services_act_2015_arms_license: "Arms License (RTS Act 2015)",
    right_to_public_services_act_2015_character_verification: "Character Verification (RTS Act 2015)",
    right_to_public_services_act_2015_loudspeaker_license: "Loudspeaker License (RTS Act 2015)",
    right_to_public_services_act_2015_entertainment_noc: "No-Objection Certificate for Entertainment Programs (RTS Act 2015)",
    right_to_public_services_act_2015_assembly_procession_permission: "Permission for Meetings, Conferences, Processions, Rallies etc. (RTS Act 2015)",
    right_to_public_services_act_2015_gas_petrol_hotel_bar_noc: "No-Objection Certificate for Gas, Petrol, Hotel, Bar etc. (RTS Act 2015)",
    right_to_public_services_act_2015_joint_bandobast: "Joint Bandobast (RTS Act 2015)",
    right_to_public_services_act_2015_security_agency: "Security Guard Agency (RTS Act 2015)",
    right_to_public_services_act_2015_explosive_license: "Explosive License (RTS Act 2015)",
    right_to_public_services_act_2015_devsthan_c_class: "Devasthan Status Class C (RTS Act 2015)",
    right_to_public_services_act_2015_devsthan_b_class: "Devasthan Status Class B (RTS Act 2015)",
    right_to_public_services_act_2015_other_licenses: "Other Licenses (RTS Act 2015)",
  
    
    // Letter Status
    acknowledged: 'Acknowledged',
    received: 'Received',
    forwarded: 'Forwarded',
    closed: 'Closed',
    recall: 'Recall',
    return: 'Return',
    return_received: 'Return Received',
    // Action Types
    proceeding: 'Proceeding',
    answer: 'Answer',
    // Office Types
    head: 'Head Office',
    branch: 'Branch Office',
    regional: 'Regional Office',
    // Office Branches
    igp: 'IGP',
    sp: 'SP',
    sdpo: 'SDPO',
    police_station: 'Police Station',
    // Offices
    dpo_ahmednagar: 'District Police Officer Ahmednagar',
    dpo_pune_rural: 'District Police Officer Pune Rural',
    dpo_jalgaon: 'District Police Officer Jalgaon',
    dpo_nandurbar: 'District Police Officer Nandurbar',
    dpo_nashik_rural: 'District Police Officer Nashik Rural'
  },
  mr: {
    dashboard: 'डॅशबोर्ड',
    newLetter: 'इनवर्ड पत्र',
    allLetters: 'सर्व पत्रे',
    trackApplication: 'अर्ज ट्रॅक करा',
    logout: 'बाहेर पडा',
    user: 'वापरकर्ता',
    letterSystem: 'पत्र प्रणाली',
    close: 'बंद करा',
    menu: 'मेनू',
    receivedLetters: 'प्राप्त पत्रे',
    toggleSidebar: 'साइडबार टॉगल करा',
    profile: 'प्रोफाइल',
    settings: 'सेटिंग्ज',
    notifications: 'सूचना',
    uploadLetter: 'पत्र अपलोड करा',
    dragAndDrop: 'फाईल्स येथे ड्रॅग आणि ड्रॉप करा किंवा ब्राउझ करण्यासाठी क्लिक करा',
    selectFiles: 'फाईल्स निवडा',
    receivedByOffice: 'पत्र पाठविणारे कार्यालय',
    recipientName: 'पत्र पाठविण्याऱ्याचे नाव व पदनाम',
    designation: 'पदनाम',
    letterClassification: 'पत्र वर्गीकरण',
    letterType: 'पत्राचा प्रकार',
    letterMedium: 'पत्राचे माध्यम',
    selectType: 'प्रकार निवडा',
    letterDate: 'पत्राची तारीख',
    officeType: 'कार्यालयाचा प्रकार',
    selectOfficeType: 'कार्यालयाचा प्रकार निवडा',
    office: 'कार्यालय',
    mobileNumber: 'मोबाईल नंबर / टेलीफोन नंबर',
    officeBranchName: 'कार्यालय/शाखेचे नाव',
    typeOfAction: 'कारवाईचा प्रकार',
    selectAction: 'कारवाई निवडा',
    selectCategory: 'श्रेणी निवडा',
    selectMedium: 'माध्यम निवडा',
    selectStatus: 'स्थिती निवडा',
    selectOffice: 'कार्यालय निवडा',
    selectOfficeBranch: 'कार्यालय/शाखा निवडा',
    submit: 'सबमिट करा',
    reset: 'रीसेट करा',
    remarks: 'टिप्पण्या',
    Outgoing_Reference_Number_of_the_Received_Letter: "प्राप्त पत्राचा जावक क्रमांक",
    along_with_the_Number_of_Enclosures: "सह कागद पत्रांची संख्या",
    date_of_receipt_of_the_letter: "पत्र मिळाल्याचा दिनांक",
    no_of_documents: "सह कागद पत्रांची संख्या",
    subject: 'विषय',
    details: 'तपशील',
    fileUploaded: 'फाईल अपलोड केली',
    remove: 'काढून टाका',
    letterSubmitted: 'पत्र यशस्वीरित्या सबमिट केले!',
    submitError: 'पत्र सबमिट करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.',
    outward_letter_no: "प्राप्त पत्राचा जावक क्रमांक",
    inbox:"इनबॉक्स",


    // Letter Categories
    complaint: 'तक्रार',
    inquiry: 'चौकशी',
    report: 'अहवाल',
    notice_memo: 'नोटीस मेमो',

    select_category: "वर्गीकरण निवडा",
    senior_mail: "वरिष्ठ टपाल",
   senior_application :"वरिष्ठ अर्ज",
  reference_letter : "संदर्भ पत्र",
   other_mail : "इतर टपाल",
  other_application : "इतर अर्ज",
  portal_application : "पोर्टल अर्ज",
  right_to_public_services_act_2015 : "लोकसेवा हक्क अधिनियम २०१५",
  right_to_information : "माहिती अधिकार ",

    // Letter Mediums
    hard_copy: 'हार्ड कॉपी',
    soft_copy: 'सॉफ्ट कॉपी',
    soft_copy_and_hard_copy: "सॉफ्ट कॉपी आणि हार्ड कॉपी",
    // Letter Types
    official: 'अधिकृत',
    confidential: 'गोपनीय',
    urgent: 'तातडीचे',
    standard: 'मानक',
    // Letter Status
    acknowledged: 'पावती दिली',
    received: 'प्राप्त',
    forwarded: 'पुढे पाठवले',
    closed: 'बंद केले',
    recall: 'परत बोलावणे',
    return: 'परत',
    return_received: 'परत प्राप्त',
    // Action Types
    proceeding: 'चालू कार्यवाही',
    answer: 'उत्तर',
    // Office Types
    head: 'मुख्य कार्यालय',
    branch: 'शाखा कार्यालय',
    regional: 'प्रादेशिक कार्यालय',
    // Office Branches
    igp: 'आयजीपी',
    sp: 'एसपी',
    sdpo: 'एसडीपीओ',
    police_station: 'पोलीस स्टेशन',
    // Offices
    dpo_ahmednagar: 'जिल्हा पोलीस अधिकारी अहमदनगर',
    dpo_pune_rural: 'जिल्हा पोलीस अधिकारी पुणे ग्रामीण',
    dpo_jalgaon: 'जिल्हा पोलीस अधिकारी जळगाव',
    dpo_nandurbar: 'जिल्हा पोलीस अधिकारी नंदुरबार',
    dpo_nashik_rural: 'जिल्हा पोलीस अधिकारी नाशिक ग्रामीण',

    // Letter Types in Marathi
    senior_post_dgp: 'वरिष्ठ टपाल - पोलिस महासंचालक',
    senior_post_govt_maharashtra: 'वरिष्ठ टपाल - महाराष्ट्र शासन',
    senior_post_igp: 'वरिष्ठ टपाल - विशेष पोलिस महानिरीक्षक', // Special Inspector General of Police
    senior_post_addl_dgp: 'वरिष्ठ टपाल - अप्पर पोलिस महासंचालक', // Additional Director General of Police
    senior_post_accountant_general: 'वरिष्ठ टपाल - महालेखापाल कार्या नागपूर महाराष्ट्र राज्य मुंबई', // Accountant General's Office, Nagpur, Maharashtra State, Mumbai
    senior_post_accountant_general_office: 'वरिष्ठ टपाल - महालेखापाल कार्यालय, महाराष्ट्र राज्य मुंबई', // Accountant General's Office, Maharashtra State, Mumbai
    senior_post_director_pay_verification: 'वरिष्ठ टपाल - संचालक, वेतन पडताळणी पथक, नाशिक', // Director, Salary Verification Team, Nashik
    senior_post_police_commissioner: 'वरिष्ठ टपाल - पोलिस आयुक्त', // Commissioner of Police
    senior_post_divisional_commissioner: 'वरिष्ठ टपाल - विभागीय आयुक्त अर्धशासकीय संदर्भ', // Divisional Commissioner (Semi-Governmental Reference)
    senior_post_sp: 'वरिष्ठ टपाल - एसपी', // SP (Superintendent of Police)
    senior_post_sdpo: 'वरिष्ठ टपाल - एसडीपीओ', // SDPO (Sub-Divisional Police Officer)

    senior_application_dgp: 'वरिष्ठ अर्ज - पोलिस महासंचालक',
    senior_application_govt_maharashtra: 'वरिष्ठ अर्ज - महाराष्ट्र शासन',
    senior_application_igp: 'वरिष्ठ अर्ज - विशेष पोलिस महानिरीक्षक',
    senior_application_addl_dgp: 'वरिष्ठ अर्ज - अप्पर पोलिस महासंचालक',
    senior_application_police_commissioner: 'वरिष्ठ अर्ज - पोलिस आयुक्त',
    senior_application_divisional_commissioner: 'वरिष्ठ अर्ज - विभागीय आयुक्त',

   // --- New Reference (संदर्भ) and Other Document Types ---
  reference_letter: 'संदर्भ पत्र',
  semi_governmental_reference: 'अर्धशासकीय संदर्भ',
  aaple_sarkar_reference: 'आपले सरकार संदर्भ', // "Aaple Sarkar" is a specific initiative/portal
  mla_reference: 'आमदार संदर्भ',
  dist_police_superintendent_reference: 'जि.पो. अधीक्षक संदर्भ',
  mp_reference: 'खासदार संदर्भ',
  district_collector_reference: 'जिल्हाधिकारी संदर्भ',
  complaint: 'तक्रार',
  bill_reference: 'देयके संदर्भ',
  judicial_reference: 'न्यायालयीन संदर्भ',
  file_reference: 'नस्ती संदर्भ',
  circular: 'परीपत्रक',
  minister_reference: 'मंत्री संदर्भ',
  mayor_official_corporator: 'महापौर / पदाधिकारी / नगरसेवक',
  human_rights_reference: 'मानवी हक्क संदर्भ',
  lokayukta_uplokayukta_reference: 'लोकायुक्त/उप लोकायुक्त संदर्भ',
  lokshahi_din_reference: 'लोकशाही दिन संदर्भ', // "Lokshahi Din" is a specific public grievance day
  assembly_question_starred_unstarred: 'विधानसभा तारांकित/अतारांकित प्रश्न',
  divisional_commissioner_reference: 'विभागीय आयुक्त संदर्भ',
  government_letter: 'शासन पत्र',
  government_reference: 'शासन संदर्भ',

// --- Other Mail (इतर टपाल) specific entries ---
other_mail_confidential: 'गोपनीय',
other_mail_sanction_offence: 'मंजुरी गुन्हा',
other_mail_deficiency: 'त्रुटी',
other_mail_hospital_record: 'दवाखाना नोंद',
other_mail_accumulated_leave: 'संचित रजा प्रकरण',
other_mail_parole_leave: 'पॅरोल रजा प्रकरण',
other_mail_weekly_diary: 'आठवडा डायरी',
other_mail_daily_check: 'डेली चेक',
other_mail_fingerprint: 'अंगुली मुद्रा',
other_mail_medical_bill: 'वैद्यकीय बील',
other_mail_tenant_verification: 'टेनेंट व्हेरी फिकेशन',
other_mail_leave_sanction: 'रजा मंजुरी बाबत',
other_mail_warrant: 'वॉरंट',
other_mail_explanation_absence: 'खुलासा/गैरहजर',
other_mail_death_summary_approval: 'मयत समरी मंजुरी बाबत',
other_mail_viscera: 'व्हीसेरा',

// --- Departmental Inquiry & Orders ---
departmental_inquiry_order: 'विभागीय चौकशी आदेश',
final_order: 'अंतिम आदेश',

// --- Public Relations ---
district_police_press_release: 'जिल्हा पोलीस प्रसिद्धी पत्रक',

// --- Licenses & Permissions ---
license_permit: 'अनुज्ञाप्ती', // General term, assuming it covers this category

// --- Inspections & Tours ---
office_inspection: 'दफ्तर तपासणी',
vip_tour: 'व्ही आय पी दौरा',

// --- Security & Law Enforcement ---
bandobast: 'बंदोबस्त',
reward_punishment: 'बक्षीस / शिक्षा',
officer_in_charge_order: 'प्रभारी अधिकारी आदेश',
do_letter: 'डि. ओ.', // Demi-Official letter
pcr: 'PCR', // Police Control Room / Petition Case Record (context dependent)

// --- Cyber & Technical ---
cyber: 'सायबर',
cdr: 'CDR',
caf: 'CAF',
sdr: 'SDR',
imei: 'IMEI',
dump_data: 'DUMP DATA',
it_act: 'IT ACT',
facebook: 'FACEBOOK',
online_fraud: 'ONLINE FRAUD',
cdr_sdr_caf_imei_ipdr_dump: 'CDR/SDR/CAF/IMEI/IPDR/DUMP', // Combined entry

// --- Specific Case Types ---
self_immolation: 'आत्मदहन',
civil_rights_protection: 'नागरी हक्क संरक्षण',

// --- Clerical / Administrative Roles ---
steno: 'STENO',
stenographer: 'लघुलेखक', // 'Steno' and 'Laghulekhak' refer to the same profession

// --- A-Class (अ वर्ग) VIP/High-Level ---
a_class_pm: 'अ वर्ग- मा. पंतप्रधान',
a_class_cm: 'अ वर्ग- मा. मुख्यमंत्री',
a_class_deputy_cm: 'अ वर्ग- मा. उपमुख्यमंत्री',
a_class_home_minister: 'अ वर्ग- मा. गृहमंत्री',
a_class_mos_home: 'अ वर्ग- मा. गृहराज्यमंत्री', // Minister of State for Home
a_class_guardian_minister: 'अ वर्ग- मा. पालक मंत्री',
a_class_union_minister: 'अ वर्ग- केंद्रीय मंत्री',
a_class_mp: 'अ वर्ग- खासदार',
a_class_mla: 'अ वर्ग- आमदार',
a_class_other: 'अ वर्ग- इतर',

// --- General "Other" Category ---
other_general: 'इतर', // Renamed to avoid clash if 'other_mail' is distinct

// --- Specific Departments/Roles ---
treasury: 'कोषागार',
commandant: 'समादेशक',
principal_police_training_center: 'प्राचार्य -पोलीस प्रशिक्षण केंद्र',

// --- C-Class (क वर्ग) ---
c_class_police_commissioner: 'क वर्ग -पोलीस आयुक्त',

// --- Application & Appeals ---
application_branch_inquiry_report: 'अर्ज शाखा चौकशी अहवाल',
appeal: 'अपील',

// --- Service & Administration ---
in_service_training: 'सेवांतर्गत प्रशिक्षण',
building_branch: 'इमारत शाखा',
pension_matter: 'पेन्शन संदर्भात',
government_vehicle_license: 'शासकीय वाहन परवाना',
payments_bills: 'देयके', // Broadened to 'payments_bills'
departmental_inquiry: 'विभागीय चौकशी', // Category for DI
lapses_case: 'कसुरी प्रकरण', // "Kasuri Prakaran" implies case of lapses/defaults
pay_fixation: 'वेतननिश्चिती',
transfer: 'बदली',
 // --- Other Applications (इतर अर्ज) ---
 other_application_local: 'स्थानिक अर्ज',
 other_application_anonymous: 'निनावी अर्ज',
 other_application_district_serviceman: 'जिल्हासैनिक अर्ज',
 other_application_moneylending_related: 'सावकारी संदर्भात अर्ज',
 other_application_lokshahi_related: 'लोकशाही संदर्भातील अर्ज',
 other_application_confidential: 'गोपनीय अर्ज',

 // --- Class B (ब वर्ग) - Direct Visit (प्रत्यक्ष भेट) ---
 b_class_sp_ahmednagar_direct_visit: 'ब वर्ग- मा.पो.अ.सो. अहमदनगर(प्रत्यक्ष भेट)',
 b_class_addl_sp_ahmednagar_direct_visit: 'ब वर्ग- मा.अप्पर पो.अ. अहमदनगर(प्रत्यक्ष भेट)',

 // --- Class C (क वर्ग) ---
 c_class_divisional_commissioner: 'क वर्ग-विभागीय आयुक्त',
 c_class_district_collector: 'क वर्ग-जिल्हाधिकारी',
 c_class_sdpo_shrirampur: 'क वर्ग-एस. डी. पी. ओ. श्रीरामपूर',
 c_class_sdpo_karjat: 'क वर्ग-एस. डी. पी. ओ. कर्जत',
 c_class_sdpo_shirdi: 'क वर्ग-एस. डी. पी. ओ. शिर्डी',
 c_class_sdpo_shevgaon: 'क वर्ग-एस. डी. पी. ओ. शेवगाव',
 c_class_all_police_stations: 'क वर्ग-सर्व पोलीस स्टेशन',
 c_class_all_branches: 'क वर्ग-सर्व शाखा',
 c_class_sainik_board: 'क वर्ग-सैनिक बोर्ड',
 c_class_senior_army_officer: 'क वर्ग-वरिष्ठ आर्मी अधिकारी',
 c_class_lokshahi_din: 'क वर्ग-लोकशाही दिन',
 c_class_sdpo_nagar_city: 'क वर्ग-एस. डी. पी. ओ नगर शहर',
 c_class_sdpo_nagar_taluka: 'क वर्ग-एस. डी. पी. ओ नगर तालुका',
 c_class_sdpo_sangamner: 'क वर्ग-एस. डी. पी. ओ संगमनेर',

  // --- Portal Application (पोर्टल अर्ज) ---
  portal_application_pm_pg: 'पोर्टल अर्ज वर्ग-पंतप्रधान (पी.जी.)', // PM (PG) likely refers to Prime Minister's Office (Public Grievances)
  portal_application_aaple_sarkar: 'पोर्टल अर्ज वर्ग-आपले सरकार',
  portal_application_homd: 'पोर्टल अर्ज वर्ग-एच. ओ. एम. डी. (गृहराज्यमंत्री)', // HOMD likely refers to Hon'ble Minister of State (Home Department)

  right_to_public_services_act_2015_arms_license: 'शस्त्र परवाना',
  right_to_public_services_act_2015_character_verification: 'चारित्र्य पडताळणी',
  right_to_public_services_act_2015_loudspeaker_license: 'लाउडस्पीकर परवाना',
  right_to_public_services_act_2015_entertainment_noc: 'मनोरंजनाचे कार्यक्रमांना ना-हरकत परवाना',
  right_to_public_services_act_2015_assembly_procession_permission: 'सभा,संमेलन,मिरवणूक, शोभायात्रा ई.करिता परवानगी',
  right_to_public_services_act_2015_gas_petrol_hotel_bar_noc: 'गॅस,पेट्रोल,हॉटेल,बार ई.करिता ना-हरकत प्रमाणपत्र',
  right_to_public_services_act_2015_joint_bandobast: 'संयुक्त बंदोबस्त',
  right_to_public_services_act_2015_security_agency: 'सुरक्षा रक्षक एजन्सी',
  right_to_public_services_act_2015_explosive_license: 'स्फोटक परवाना',
  right_to_public_services_act_2015_devsthan_c_class: 'देवस्थान दर्जा क वर्ग',
  right_to_public_services_act_2015_devsthan_b_class: 'देवस्थान दर्जा ब वर्ग',
  right_to_public_services_act_2015_other_licenses: 'इतर परवाने',
  right_to_information: 'माहिती अधिकार',


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

  },
};

export default translations;