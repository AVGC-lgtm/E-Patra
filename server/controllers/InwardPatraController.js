// controllers/InwardPatraController.js - Complete controller with Word document support and owReferenceNumber
const { InwardPatra, CoveringLetter, User, File, Head, Role } = require('../models/associations');
const sequelize = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const s3Service = require('../services/s3Service'); // Add S3Service

const coveringLetterController = require('./coveringLetterController');
const { Op } = require('sequelize');

// Create an instance of the CoveringLetterController
const coveringLetterControllerInstance = new coveringLetterController();

// Function to generate 8-digit reference number
const generateReferenceNumber = async () => {
  let referenceNumber;
  let isUnique = false;

  while (!isUnique) {
    referenceNumber = Math.floor(10000000 + Math.random() * 90000000).toString();

    const existingPatra = await InwardPatra.findOne({ where: { referenceNumber } });
    if (!existingPatra) {
      isUnique = true;
    }
  }

  return referenceNumber;
};

// NEW FUNCTION: Generate unique OW reference number (OW + 8 digits)
const generateOwReferenceNumber = async () => {
  let owReferenceNumber;
  let isUnique = false;

  while (!isUnique) {
    // Generate 8 random digits
    const randomDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
    // Prepend "OW" to make it 10 characters total
    owReferenceNumber = `OW${randomDigits}`;

    // Check if this OW reference number already exists
    const existingPatra = await InwardPatra.findOne({ where: { owReferenceNumber } });
    if (!existingPatra) {
      isUnique = true;
    }
  }

  return owReferenceNumber;
};

// Common include configuration for covering letter with Word document support
const getCoveringLetterInclude = () => ({
  model: CoveringLetter,
  as: 'coveringLetter',
  required: false,
  include: [
    {
      model: File,
      as: 'attachedFile',
      attributes: ['id', 'originalName', 'fileName', 'fileUrl'],
      required: false
    }
  ]
});

// Common include configuration for user
const getUserInclude = () => ({
  model: User,
  as: 'User',
  attributes: ['id', 'email'],
  required: false
});

// Common include configuration for uploaded file
const getUploadedFileInclude = () => ({
  model: File,
  as: 'uploadedFile',
  attributes: ['id', 'originalName', 'fileName', 'fileUrl', 'extractData'],
  required: false
});

// Helper function to format covering letter data with Word document URLs
const formatCoveringLetterData = (coveringLetter) => {
  if (!coveringLetter) return null;
  
  return {
    ...coveringLetter.toJSON(),
    // Ensure all document URLs are included
    documentUrls: {
      pdf: coveringLetter.pdfUrl || null,
      html: coveringLetter.htmlUrl || null,
      word: coveringLetter.wordUrl || null // Include Word document URL
    },
    // File information
    fileInfo: {
      s3FileName: coveringLetter.s3FileName || null,
      s3WordFileName: coveringLetter.s3WordFileName || null, // Include Word filename
      attachedFile: coveringLetter.attachedFile || null
    }
  };
};

// Create a new Patra (InwardPatra) with auto-generated covering letter and OW reference number
const createPatra = async (req, res) => {
  const {
    dateOfReceiptOfLetter,
    officeSendingLetter,
    senderNameAndDesignation,
    mobileNumber,
    letterMedium,
    letterClassification,
    letterType,
    letterDate,
    subject,
    outwardLetterNumber,
    numberOfCopies,
    letterStatus,
    NA,
    NAR,
    userId,
    fileId,
    forwardTo
  } = req.body;

  // Ensure subject is provided
  if (!subject) {
    return res.status(400).json({ error: 'subject is required' });
  }

  // Start a database transaction for data consistency
  const transaction = await sequelize.transaction();

  try {
    console.log('createPatra - Received userId:', userId, 'Type:', typeof userId);
    console.log('createPatra - Request body:', req.body);
    
    const user = await User.findByPk(userId);
    if (!user) {
      await transaction.rollback();
      console.log('createPatra - User not found for userId:', userId);
      return res.status(400).json({ error: 'User not found' });
    }
    
    console.log('createPatra - Found user:', { id: user.id, email: user.email });

    let validatedFileId = null;
    if (fileId) {
      const file = await File.findByPk(fileId);
      if (!file) {
        await transaction.rollback();
        return res.status(400).json({ error: 'File not found' });
      }
      validatedFileId = fileId;
    }

    // Generate both reference numbers
    const referenceNumber = await generateReferenceNumber();
    const owReferenceNumber = await generateOwReferenceNumber(); // NEW: Generate OW reference number

    console.log('Generated reference numbers:', { referenceNumber, owReferenceNumber });

    // Create InwardPatra within transaction
    const newPatra = await InwardPatra.create({
      referenceNumber,
      owReferenceNumber, // NEW: Add OW reference number
      dateOfReceiptOfLetter,
      officeSendingLetter,
      senderNameAndDesignation,
      mobileNumber,
      letterMedium,
      letterClassification,
      letterType,
      letterDate,
      subject,
      outwardLetterNumber,
      numberOfCopies: numberOfCopies || 1,
      letterStatus: letterStatus || 'sending for head sign',
      NA: NA || false,
      NAR: NAR || false,
      fileId: validatedFileId,
      userId: user.id,
      coveringLetterId: null, // Initially null
      forwardTo: forwardTo || null, // NEW: Add forwardTo field
      originalTable: req.user?.roleName || null // NEW: Track original table
    }, { transaction });

    // AUTO-GENERATE COVERING LETTER WITH WORD DOCUMENT
    try {
      const coveringLetter = await coveringLetterControllerInstance.autoGenerateCoveringLetter(
        newPatra.id, 
        user.id,
        transaction
      );
      
      console.log('Covering letter generated automatically with Word document:', {
        id: coveringLetter.id,
        pdfUrl: coveringLetter.pdfUrl,
        wordUrl: coveringLetter.wordUrl
      });
      
      // UPDATE THE PATRA WITH COVERING LETTER ID
      await newPatra.update({
        coveringLetterId: coveringLetter.id
      }, { transaction });
      
      // Commit transaction if everything succeeds
      await transaction.commit();
      
      // Fetch the complete created Patra with all covering letter data and email records
      const completePatra = await InwardPatra.findByPk(newPatra.id, {
        include: [
          getUserInclude(),
          getUploadedFileInclude(),
          getCoveringLetterInclude()
        ]
      });
      
      return res.status(201).json({
        message: 'Patra created successfully with covering letter (PDF + Word)',
        referenceNumber: referenceNumber,
        owReferenceNumber: owReferenceNumber, // NEW: Include OW reference number in response
        patraId: newPatra.id,
        letterStatus: newPatra.letterStatus,
        coveringLetterId: coveringLetter.id,
        coveringLetterGenerated: true,
        documentUrls: {
          pdf: coveringLetter.pdfUrl,
          html: coveringLetter.htmlUrl,
          word: coveringLetter.wordUrl // Include Word document URL
        },
        patra: {
          ...completePatra.toJSON(),
          coveringLetter: formatCoveringLetterData(completePatra.coveringLetter)
        }
      });

    } catch (coveringLetterError) {
      console.error('Error generating covering letter:', coveringLetterError);
      
      // Check if transaction is still active before rollback
      if (!transaction.finished) {
        await transaction.rollback();
      }
      
      return res.status(500).json({
        message: 'Failed to create Patra due to covering letter generation error',
        error: coveringLetterError.message,
        coveringLetterGenerated: false
      });
    }

  } catch (error) {
    console.error('Error creating Patra:', error);
    // Check if transaction is still active before rollback
    if (!transaction.finished) {
      await transaction.rollback();
    }
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get all Patras with their complete covering letters data including Word documents
const getAllPatras = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, classification, includeEmails = 'true' } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    if (status) whereClause.letterStatus = status;
    if (classification) whereClause.letterClassification = classification;

    // Role-based filtering: Only show letters forwarded to user's table
    if (req.user && req.user.roleName && req.user.table) {
      // Map user's table to forwardTo values
      const roleToTableMap = {
        'dg_other': 'dg_other',
        'dg': 'dg_other',  // Add variation for 'dg'
        'director_general': 'dg_other',  // Add variation for 'director_general'
        'ig_nashik_other': 'ig_nashik_other', 
        'ig': 'ig_nashik_other',  // Add variation for 'ig'
        'sp': 'sp',
        'collector': 'collector',
        'home': 'home',
        'shanik_local': 'shanik_local',
        'shanik': 'shanik_local',  // Add variation for 'shanik'
        'head': 'head',  // Changed from 'admin' to 'head'
        'inward_user': 'inward_user',
        'outward_user': 'outward_user'
      };

      const userTable = roleToTableMap[req.user.roleName] || req.user.table;
      
      console.log('getAllPatras - User role:', req.user.roleName);
      console.log('getAllPatras - User table:', userTable);
      console.log('getAllPatras - Available role mappings:', Object.keys(roleToTableMap));
      console.log('getAllPatras - User object:', {
        roleName: req.user.roleName,
        table: req.user.table,
        email: req.user.email
      });
      
      // Special cases: inward_user and outward_user see all letters
      if (!['inward_user', 'outward_user'].includes(req.user.roleName)) {
        // Create an array of possible forwardTo values for this user
        let forwardToValues = [userTable];
        
        // Add role variations for specific roles
        if (req.user.roleName === 'dg_other') {
          forwardToValues.push('dg'); // Also check for 'dg' variation
        } else if (req.user.roleName === 'ig_nashik_other') {
          forwardToValues.push('ig', 'ig_nashik'); // Also check for 'ig' variations
        } else if (req.user.roleName === 'shanik_local') {
          forwardToValues.push('shanik', 'shanik_local'); // Also check for 'shanik' variations
        }
        
        console.log('getAllPatras - ForwardTo values:', forwardToValues);
        
        // Show letters that belong to this user's table
        // Include letters sent to head that originated from this user's table
        whereClause[Op.or] = [
          { forwardTo: { [Op.in]: forwardToValues } },
          { forwardTo: null }, // Also show letters without forwardTo specified
          { forwardTo: '' },   // Also show letters with empty forwardTo
          // Include letters sent to head that originated from this user's table
          {
            [Op.and]: [
              { forwardTo: 'head' },
              {
                [Op.or]: [
                  { letterStatus: 'sent to head' },
                  { letterStatus: 'प्रमुखांकडे पाठवले' },
                  { letterStatus: 'case close' },  // Include closed cases
                  { letterStatus: 'केस बंद' }      // Include closed cases in Marathi
                ]
              },
              // Only include letters that were originally from this user's table
              (() => {
                const roleToTableNameMap = {
                  'sp': 'SP Table',
                  'dg_other': 'DG Table',
                  'ig_nashik_other': 'IG Table',
                  'collector': 'Collector Table',
                  'home': 'Home Table',
                  'shanik_local': 'Shanik Table',
                  'inward_user': 'Inward Table',
                  'outward_user': 'Outward Table'
                };
                const expectedTableName = roleToTableNameMap[req.user.roleName] || req.user.roleName;
                return {
                  [Op.or]: [
                    { sentTo: { [Op.like]: `%"sourceTable":"${expectedTableName}"%` } },
                    { sentTo: { [Op.like]: `%"sourceTable":"${req.user.roleName}"%` } }
                  ]
                };
              })()
            ]
          }
        ];
        
        // Debug: Log the user ID being used for filtering
        console.log('getAllPatras - User ID for filtering:', req.user.id);
        console.log('getAllPatras - User role for filtering:', req.user.roleName);
      }
      
      // Don't exclude letters sent to Head - they should remain in original tables
      // The sign status will be shown in the UI instead
    }

    // Build includes array based on query params
    const includes = [
      getUserInclude(),
      getUploadedFileInclude(),
      getCoveringLetterInclude()
    ];

    console.log('getAllPatras - Final whereClause:', JSON.stringify(whereClause, null, 2));
    console.log('getAllPatras - User role:', req.user.roleName);
    
    const patras = await InwardPatra.findAndCountAll({
      where: whereClause,
      include: includes,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    console.log('getAllPatras - Found', patras.count, 'letters for user role:', req.user.roleName);
    if (patras.rows.length > 0) {
      console.log('getAllPatras - Sample letter forwardTo values:', patras.rows.map(p => ({ 
        id: p.id, 
        referenceNumber: p.referenceNumber, 
        forwardTo: p.forwardTo,
        letterStatus: p.letterStatus,
        sentTo: p.sentTo ? JSON.parse(p.sentTo) : null
      })));
      
      // Debug: Check if any letters have forwardTo as 'head'
      const headLetters = patras.rows.filter(p => p.forwardTo === 'head');
      if (headLetters.length > 0) {
        console.log('getAllPatras - Found', headLetters.length, 'letters with forwardTo="head":', 
          headLetters.map(p => ({ 
            id: p.id, 
            referenceNumber: p.referenceNumber, 
            forwardTo: p.forwardTo,
            letterStatus: p.letterStatus,
            sentTo: p.sentTo ? JSON.parse(p.sentTo) : null
          }))
        );
      }
    } else {
      console.log('getAllPatras - No letters found for user role:', req.user.roleName);
    }
    

    
    // Debug: Check what forwardTo values exist in the database
    const allForwardToValues = await InwardPatra.findAll({
      attributes: ['forwardTo'],
      group: ['forwardTo'],
      raw: true
    });
    console.log('getAllPatras - All forwardTo values in DB:', allForwardToValues.map(f => f.forwardTo));
    
    // Debug: Check all letters in the database
    const allLetters = await InwardPatra.findAll({
      attributes: ['id', 'referenceNumber', 'forwardTo', 'letterStatus', 'sentTo'],
      limit: 10,
      order: [['createdAt', 'DESC']]
    });
    console.log('getAllPatras - All letters in DB (first 10):', allLetters.map(l => ({
      id: l.id,
      referenceNumber: l.referenceNumber,
      forwardTo: l.forwardTo,
      letterStatus: l.letterStatus,
      sentTo: l.sentTo ? JSON.parse(l.sentTo) : null
    })));
    
    // Debug: Check letters created by this specific user
    if (req.user && req.user.id) {
      const userLetters = await InwardPatra.findAll({
        where: { userId: req.user.id },
        attributes: ['id', 'referenceNumber', 'forwardTo', 'letterStatus', 'userId'],
        order: [['createdAt', 'DESC']]
      });
      console.log('getAllPatras - Letters created by user ID', req.user.id, ':', userLetters.map(l => ({
        id: l.id,
        referenceNumber: l.referenceNumber,
        forwardTo: l.forwardTo,
        letterStatus: l.letterStatus,
        userId: l.userId
      })));
    }
    
    // Debug: Check all letters with shanik-related forwardTo values
    if (req.user.roleName === 'shanik_local') {
      const allShanikLetters = await InwardPatra.findAll({
        where: {
          [Op.or]: [
            { forwardTo: 'shanik' },
            { forwardTo: 'shanik_local' }
          ]
        },
        attributes: ['id', 'referenceNumber', 'forwardTo', 'letterStatus']
      });
      console.log('getAllPatras - All shanik letters in DB:', allShanikLetters.map(l => ({
        id: l.id,
        referenceNumber: l.referenceNumber,
        forwardTo: l.forwardTo,
        letterStatus: l.letterStatus
      })));
    }
    
    // Debug: Check all letters with home-related forwardTo values
    if (req.user.roleName === 'home') {
      const allHomeLetters = await InwardPatra.findAll({
        where: {
          forwardTo: 'home'
        },
        attributes: ['id', 'referenceNumber', 'forwardTo', 'letterStatus']
      });
      console.log('getAllPatras - All home letters in DB:', allHomeLetters.map(l => ({
        id: l.id,
        referenceNumber: l.referenceNumber,
        forwardTo: l.forwardTo,
        letterStatus: l.letterStatus
      })));
    }

    // Debug: Log the structure of the first patra with Word document info
    if (patras.rows.length > 0) {
      console.log('🔍 Debug: First patra structure with Word document support:');
      console.log('  - ID:', patras.rows[0].id);
      console.log('  - Reference Number:', patras.rows[0].referenceNumber);
      console.log('  - OW Reference Number:', patras.rows[0].owReferenceNumber); // NEW: Log OW reference
      console.log('  - Has uploadedFile:', !!patras.rows[0].uploadedFile);
      console.log('  - Has coveringLetter:', !!patras.rows[0].coveringLetter);
      
      if (patras.rows[0].coveringLetter) {
        console.log('  - Covering letter document URLs:', {
          pdf: !!patras.rows[0].coveringLetter.pdfUrl,
          html: !!patras.rows[0].coveringLetter.htmlUrl,
          word: !!patras.rows[0].coveringLetter.wordUrl
        });
      }
    }

    // Format the response with Word document URLs
    const formattedPatras = patras.rows.map(patra => ({
      ...patra.toJSON(),
      coveringLetter: formatCoveringLetterData(patra.coveringLetter)
    }));

    return res.status(200).json({
      success: true,
      message: 'Patras retrieved successfully with Word document support',
      data: {
        patras: formattedPatras,
        totalCount: patras.count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(patras.count / limit)
      }
    });
  } catch (error) {
    console.error('Error retrieving Patras:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get letters specifically for Head (HOD approval)
const getHeadLetters = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    // Filter for letters sent TO Head from other tables (SP, Collector, etc.)
    // Show only letters that were sent to Head for approval
    const whereClause = {
      [Op.or]: [
        { letterStatus: 'sent to head' },
        { letterStatus: 'प्रमुखांकडे पाठवले' },
        { letterStatus: 'case close' },     // Include closed cases
        { letterStatus: 'केस बंद' },         // Include closed cases in Marathi
        { forwardTo: 'head' }
      ]
    };

    // Build includes array
    const includes = [
      getUserInclude(),
      getUploadedFileInclude(),
      getCoveringLetterInclude()
    ];

    console.log('getHeadLetters - whereClause:', JSON.stringify(whereClause, null, 2));
    
    const patras = await InwardPatra.findAndCountAll({
      where: whereClause,
      include: includes,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    console.log('getHeadLetters - Found', patras.count, 'letters');
    if (patras.rows.length > 0) {
      console.log('getHeadLetters - Sample letters:', patras.rows.map(p => ({
        id: p.id,
        referenceNumber: p.referenceNumber,
        forwardTo: p.forwardTo,
        letterStatus: p.letterStatus,
        sentTo: p.sentTo
      })));
    }

    // Format the response with Word document URLs
    const formattedPatras = patras.rows.map(patra => ({
      ...patra.toJSON(),
      coveringLetter: formatCoveringLetterData(patra.coveringLetter)
    }));

    return res.status(200).json({
      success: true,
      message: 'Head letters retrieved successfully',
      data: {
        patras: formattedPatras,
        totalCount: patras.count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(patras.count / limit)
      }
    });
  } catch (error) {
    console.error('Error retrieving Head letters:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get a Patra by ID with complete covering letter data including Word documents
const getPatraById = async (req, res) => {
  const { id } = req.params;

  try {
    const patra = await InwardPatra.findByPk(id, {
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude(),
        {
          model: Head,
          as: 'heads',
          include: [
            {
              model: User,
              as: 'User',
              attributes: ['id', 'email']
            }
          ],
          required: false
        }
      ]
    });

    if (!patra) {
      return res.status(404).json({ error: 'Patra not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Patra retrieved successfully with Word document support',
      data: {
        ...patra.toJSON(),
        coveringLetter: formatCoveringLetterData(patra.coveringLetter)
      }
    });
  } catch (error) {
    console.error('Error fetching Patra by ID:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get Patra by reference number with complete covering letter data including Word documents
const getPatraByReferenceNumber = async (req, res) => {
  const { referenceNumber } = req.params;

  try {
    const patra = await InwardPatra.findOne({
      where: { referenceNumber },
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude()
      ]
    });

    if (!patra) {
      return res.status(404).json({ error: 'Patra not found with this reference number' });
    }

    return res.status(200).json({
      success: true,
      message: 'Patra retrieved successfully with Word document support',
      data: {
        ...patra.toJSON(),
        coveringLetter: formatCoveringLetterData(patra.coveringLetter)
      }
    });
  } catch (error) {
    console.error('Error fetching Patra by reference number:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// NEW FUNCTION: Get Patra by OW Reference Number
const getPatraByOwReferenceNumber = async (req, res) => {
  const { owReferenceNumber } = req.params;

  try {
    const patra = await InwardPatra.findOne({
      where: { owReferenceNumber },
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude()
      ]
    });

    if (!patra) {
      return res.status(404).json({ error: 'Patra not found with this OW reference number' });
    }

    return res.status(200).json({
      success: true,
      message: 'Patra retrieved successfully with Word document support',
      data: {
        ...patra.toJSON(),
        coveringLetter: formatCoveringLetterData(patra.coveringLetter)
      }
    });
  } catch (error) {
    console.error('Error fetching Patra by OW reference number:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get Patra by user ID with complete covering letter data including Word documents
const getPatraByUserId = async (req, res) => {
  const { userId } = req.params;
  const { includeEmails = 'true' } = req.query;

  console.log('getPatraByUserId - Requested userId:', userId, 'Type:', typeof userId);

  try {
    // Build includes array based on query params
    const includes = [
      getUserInclude(),
      getUploadedFileInclude(),
      getCoveringLetterInclude()
    ];

    console.log('getPatraByUserId - Searching for letters with userId:', userId);
    
    const patras = await InwardPatra.findAll({
      where: { userId },
      include: includes,
      order: [['createdAt', 'DESC']]
    });
    
    console.log('getPatraByUserId - Found', patras.length, 'letters for userId:', userId);

    // Format the response with Word document URLs
    const formattedPatras = patras.map(patra => ({
      ...patra.toJSON(),
      coveringLetter: formatCoveringLetterData(patra.coveringLetter)
    }));

    return res.status(200).json({
      success: true,
      message: patras.length > 0 ? 'Patras retrieved successfully with Word document support' : 'No letters found for this user',
      data: {
        count: patras.length,
        patras: formattedPatras
      }
    });
  } catch (error) {
    console.error('Error fetching Patras by user ID:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Delete a Patra by ID (now includes Word document cleanup)
const deletePatraById = async (req, res) => {
  const { id } = req.params;

  // Use transaction for deletion to ensure data consistency
  const transaction = await sequelize.transaction();

  try {
    const patra = await InwardPatra.findByPk(id, { transaction });
    if (!patra) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Patra not found' });
    }

    // Delete associated covering letter (this will also handle Word document cleanup via the covering letter controller)
    await CoveringLetter.destroy({ 
      where: { patraId: id },
      transaction 
    });

    // Delete associated head entries
    await Head.destroy({
      where: { patraId: id },
      transaction
    });

    // Delete the patra
    await patra.destroy({ transaction });
    
    // Commit transaction
    await transaction.commit();
    
    return res.status(200).json({ 
      success: true,
      message: 'Patra and associated data deleted successfully (including Word documents)' 
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error('Error deleting Patra by ID:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Update a Patra by ID
const updatePatraById = async (req, res) => {
  const { id } = req.params;
  const {
    dateOfReceiptOfLetter,
    officeSendingLetter,
    senderNameAndDesignation,
    mobileNumber,
    letterMedium,
    letterClassification,
    letterType,
    letterDate,
    subject,
    outwardLetterNumber,
    numberOfCopies,
    letterStatus,
    NA,
    NAR,
    userId,
    fileId,
    sentTo,
    sentAt,
    updatedBy,
    updatedByEmail,
    updatedByName,
    userRole,
    forwardTo
  } = req.body;

  try {
    const patra = await InwardPatra.findByPk(id);
    if (!patra) {
      return res.status(404).json({ error: 'Patra not found' });
    }

    // If userId is provided, validate it
    if (userId) {
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }
    }

    // Validate fileId if provided
    let validatedFileId = patra.fileId;
    if (fileId && fileId !== patra.fileId) {
      const file = await File.findByPk(fileId);
      if (!file) {
        return res.status(400).json({ error: 'File not found' });
      }
      validatedFileId = fileId;
    }

    // Build update data object with only provided fields
    const updateData = {};
    
    // Only update fields that were actually sent in the request
    if (dateOfReceiptOfLetter !== undefined) updateData.dateOfReceiptOfLetter = dateOfReceiptOfLetter;
    if (officeSendingLetter !== undefined) updateData.officeSendingLetter = officeSendingLetter;
    if (senderNameAndDesignation !== undefined) updateData.senderNameAndDesignation = senderNameAndDesignation;
    if (mobileNumber !== undefined) updateData.mobileNumber = mobileNumber;
    if (letterMedium !== undefined) updateData.letterMedium = letterMedium;
    if (letterClassification !== undefined) updateData.letterClassification = letterClassification;
    if (letterType !== undefined) updateData.letterType = letterType;
    if (letterDate !== undefined) updateData.letterDate = letterDate;
    if (subject !== undefined) updateData.subject = subject;
    if (outwardLetterNumber !== undefined) updateData.outwardLetterNumber = outwardLetterNumber;
    if (numberOfCopies !== undefined) updateData.numberOfCopies = numberOfCopies;
    if (letterStatus !== undefined) updateData.letterStatus = letterStatus;
    if (NA !== undefined) updateData.NA = NA;
    if (NAR !== undefined) updateData.NAR = NAR;
    if (userId !== undefined) updateData.userId = userId;
    if (fileId !== undefined) updateData.fileId = validatedFileId;
    
    // Add new fields for tracking
    if (sentTo !== undefined) updateData.sentTo = JSON.stringify(sentTo);
    if (sentAt !== undefined) updateData.sentAt = sentAt;
    if (updatedBy !== undefined) updateData.updatedBy = updatedBy;
    if (updatedByEmail !== undefined) updateData.updatedByEmail = updatedByEmail;
    if (updatedByName !== undefined) updateData.updatedByName = updatedByName;
    if (userRole !== undefined) updateData.userRole = userRole;
    if (forwardTo !== undefined) updateData.forwardTo = forwardTo;

    await patra.update(updateData);
    
    // Reload with complete data using proper associations
    const updatedPatra = await InwardPatra.findByPk(id, {
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude()
      ]
    });

    return res.status(200).json({ 
      success: true,
      message: 'Patra updated successfully', 
      data: {
        ...updatedPatra.toJSON(),
        coveringLetter: formatCoveringLetterData(updatedPatra.coveringLetter)
      }
    });
  } catch (error) {
    console.error('Error updating Patra by ID:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get Patra by user ID and Patra ID with complete covering letter data including Word documents
const getPatraByUserIdAndPatraId = async (req, res) => {
  const { userId, patraId } = req.params;

  try {
    const patra = await InwardPatra.findOne({
      where: { id: patraId, userId },
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude()
      ]
    });

    if (!patra) {
      return res.status(404).json({ error: 'Patra not found for this user' });
    }

    return res.status(200).json({
      success: true,
      message: 'Patra retrieved successfully with Word document support',
      data: {
        ...patra.toJSON(),
        coveringLetter: formatCoveringLetterData(patra.coveringLetter)
      }
    });
  } catch (error) {
    console.error('Error fetching Patra by user ID and Patra ID:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Update letter status specifically
const updateLetterStatus = async (req, res) => {
  const { id } = req.params;
  const { letterStatus } = req.body;

  try {
    const patra = await InwardPatra.findByPk(id);
    if (!patra) {
      return res.status(404).json({ error: 'Patra not found' });
    }

    if (letterStatus === undefined) {
      return res.status(400).json({ error: 'letterStatus is required' });
    }

    await patra.update({ letterStatus });

    // Return updated patra with complete covering letter data
    const updatedPatra = await InwardPatra.findByPk(id, {
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude()
      ]
    });

    return res.status(200).json({ 
      success: true,
      message: 'Letter status updated successfully', 
      data: {
        letterStatus: updatedPatra.letterStatus,
        patra: {
          ...updatedPatra.toJSON(),
          coveringLetter: formatCoveringLetterData(updatedPatra.coveringLetter)
        }
      }
    });
  } catch (error) {
    console.error('Error updating letter status:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Send letter to HOD for approval
const sendToHOD = async (req, res) => {
  const { id } = req.params;
  const { recipients, sendToData, includeCoveringLetter, forwardTo, letterStatus, sourceTable } = req.body;

      console.log('sendToHOD - Request body:', req.body);
    console.log('sendToHOD - sourceTable from request:', sourceTable);
    console.log('sendToHOD - req.user:', req.user);
    console.log('sendToHOD - User role from token:', req.user?.roleName);

  try {
    const patra = await InwardPatra.findByPk(id);
    if (!patra) {
      return res.status(404).json({ error: 'Patra not found' });
    }

    // Determine source table from request data first, then fallback to user role
    let finalSourceTable = sourceTable || 'Unknown';
    if (!sourceTable && req.user && req.user.roleName) {
      const roleToTableMap = {
        'sp': 'SP Table',
        'collector': 'Collector Table',
        'home': 'Home Table',
        'ig_nashik_other': 'IG Table',
        'shanik_local': 'Shanik Table',
        'dg_other': 'DG Table',
        'inward_user': 'Inward Table',
        'outward_user': 'Outward Table'
      };
      
      // Handle role variations
      let userRole = req.user.roleName;
      const roleVariations = {
        'ig': 'ig_nashik_other',
        'ig_nashik': 'ig_nashik_other',
        'shanik': 'shanik_local',
        'dg': 'dg_other',
        'inward': 'inward_user',
        'outward': 'outward_user'
      };
      
      const normalizedRole = roleVariations[userRole] || userRole;
      finalSourceTable = roleToTableMap[normalizedRole] || 'Unknown Table';
      
      console.log('sendToHOD - User role:', userRole);
      console.log('sendToHOD - Normalized role:', normalizedRole);
      console.log('sendToHOD - Final source table:', finalSourceTable);
    }
    
    console.log('sendToHOD - finalSourceTable:', finalSourceTable);

    // Update letter status and forwardTo field
    const updateData = {
      letterStatus: letterStatus || 'sent to head',
      sentTo: JSON.stringify({
        recipients: recipients,
        sendToData: sendToData,
        includeCoveringLetter: includeCoveringLetter,
        sourceTable: finalSourceTable, // Add source table information
        sentAt: new Date()
      })
    };

    // Add forwardTo if provided
    if (forwardTo) {
      updateData.forwardTo = forwardTo;
    }

    console.log('sendToHOD - updateData:', updateData);
    await patra.update(updateData);
    console.log('sendToHOD - Letter updated successfully');
    
    return res.status(200).json({ 
      message: 'Letter sent to HOD for approval',
      letterStatus: updateData.letterStatus,
      forwardTo: updateData.forwardTo,
      recipients: recipients
    });
  } catch (error) {
    console.error('Error sending to HOD:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Approve letter (HOD action)
const approveLetter = async (req, res) => {
  const { id } = req.params;

  try {
    const patra = await InwardPatra.findByPk(id);
    if (!patra) {
      return res.status(404).json({ error: 'Patra not found' });
    }

    // Update letter status to "approved"
    await patra.update({
      letterStatus: 'approved'
    });
    
    return res.status(200).json({ 
      message: 'Letter approved successfully',
      letterStatus: 'approved'
    });
  } catch (error) {
    console.error('Error approving letter:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Resend letter back to original source table (HOD action)
const resendLetter = async (req, res) => {
  const { id } = req.params;
  const { newStatus, reason, forwardTo } = req.body;

  console.log('resendLetter - Request body:', req.body);
  console.log('resendLetter - forwardTo:', forwardTo);

  // Start a database transaction for data consistency
  const transaction = await sequelize.transaction();

  try {
    // Find the patra
    const patra = await InwardPatra.findByPk(id, { transaction });
    
    if (!patra) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Patra not found' });
    }

    console.log('resendLetter - Found patra:', {
      id: patra.id,
      referenceNumber: patra.referenceNumber,
      currentStatus: patra.letterStatus,
      currentForwardTo: patra.forwardTo
    });

    // Validate current status - only allow resending if not already approved
    if (patra.letterStatus === 'approved' || patra.letterStatus === 'मंजूर') {
      await transaction.rollback();
      return res.status(400).json({ 
        error: 'Cannot resend an approved letter',
        message: 'Approved letters cannot be sent back'
      });
    }

    // Get current resend count
    const currentResendCount = patra.resendCount || 0;

    // Update the letter status and add metadata about the resend action
    const updateData = {
      letterStatus: newStatus || 'pending',
      previousStatus: patra.letterStatus,
      resendReason: reason || 'Resent by HOD back to original table',
      resendAt: new Date(),
      resendBy: req.user?.id || null, // If you have auth middleware that sets req.user
      resendByEmail: req.user?.email || null,
      resendByName: req.user?.name || null,
      resendByRole: 'HOD',
      resendCount: currentResendCount + 1 // Increment resend count
    };

    // Add forwardTo if provided (to send back to specific table)
    if (forwardTo) {
      updateData.forwardTo = forwardTo;
    }

    console.log('resendLetter - updateData:', updateData);

    await patra.update(updateData, { transaction });

    // Log the resend action (optional - for audit trail)
    console.log(`Letter ${patra.referenceNumber} resent by HOD. Resend count: ${updateData.resendCount}`);

    // Commit the transaction
    await transaction.commit();

    // Fetch the updated patra with all associations
    const updatedPatra = await InwardPatra.findByPk(id, {
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude()
      ]
    });

    return res.status(200).json({ 
      success: true,
      message: `Letter successfully resent to ${forwardTo || 'original table'}`,
      data: {
        letterStatus: updatedPatra.letterStatus,
        previousStatus: updateData.previousStatus,
        resendReason: updateData.resendReason,
        resendAt: updateData.resendAt,
        resendCount: updatedPatra.resendCount,
        forwardTo: updatedPatra.forwardTo,
        patra: updatedPatra
      }
    });

  } catch (error) {
    // Rollback transaction on error
    if (!transaction.finished) {
      await transaction.rollback();
    }
    
    console.error('Error resending letter:', error);
    return res.status(500).json({ 
      error: 'Server error', 
      message: 'Failed to resend letter',
      details: error.message 
    });
  }
};

// Upload report files for completed letters - S3 Storage
const uploadReportFiles = async (req, res) => {
  const { id } = req.params;
  
  console.log('=== Upload Report Files to S3 Debug ===');
  console.log('Letter ID:', id);
  console.log('User:', req.user ? { id: req.user.id, email: req.user.email, role: req.user.roleName } : 'No user');
  
  // Configure multer for memory storage (we'll upload to S3)
  const storage = multer.memoryStorage();

  const fileFilter = (req, file, cb) => {
    console.log('File filter check:', file.originalname, file.mimetype);
    // Check file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      console.log('File type accepted:', file.mimetype);
      cb(null, true);
    } else {
      console.log('File type rejected:', file.mimetype);
      cb(new Error('Invalid file type. Only PDF, Word documents, and images are allowed.'), false);
    }
  };

  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: fileFilter
  }).array('reportFiles', 10); // Allow up to 10 files

  // Use multer middleware
  upload(req, res, async function (err) {
    if (err) {
      console.error('Multer error:', err);
      if (err instanceof multer.MulterError) {
        console.error('Multer error type:', err.code);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: 'Too many files. Maximum 10 files allowed.' });
        }
      }
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }

    console.log('Files after multer:', req.files ? req.files.length : 0);

    try {
      // Find the letter
      const patra = await InwardPatra.findByPk(id, {
        include: [
          {
            model: CoveringLetter,
            as: 'coveringLetter',
            required: false
          }
        ]
      });

      if (!patra) {
        console.log('Letter not found:', id);
        return res.status(404).json({ error: 'Letter not found' });
      }

      console.log('Letter found:', {
        id: patra.id,
        referenceNumber: patra.referenceNumber,
        forwardTo: patra.forwardTo,
        letterStatus: patra.letterStatus,
        hasCoveringLetter: !!patra.coveringLetter,
        isSigned: patra.coveringLetter?.isSigned
      });

      // Check if letter is completed (same logic as frontend)
      const isLetterSentToHead = patra.forwardTo === 'head' || 
                                 patra.letterStatus === 'sent to head' || 
                                 patra.letterStatus === 'प्रमुखांकडे पाठवले';
      
      const hasCompletedSignature = isLetterSentToHead && 
                                   patra.coveringLetter && 
                                   patra.coveringLetter.isSigned === true;

      console.log('Signature check:', {
        isLetterSentToHead,
        hasCoveringLetter: !!patra.coveringLetter,
        isSigned: patra.coveringLetter?.isSigned,
        hasCompletedSignature
      });

      if (!hasCompletedSignature) {
        console.log('Letter signature not completed');
        return res.status(400).json({ 
          error: 'Cannot upload report. Letter signature is not completed.',
          signatureStatus: 'incomplete',
          debug: {
            isLetterSentToHead,
            hasCoveringLetter: !!patra.coveringLetter,
            isSigned: patra.coveringLetter?.isSigned
          }
        });
      }

      // Process uploaded files
      const uploadedFiles = req.files || [];
      
      console.log('Processing uploaded files:', uploadedFiles.length);
      
      if (uploadedFiles.length === 0) {
        console.log('No files were uploaded');
        return res.status(400).json({ error: 'No files were uploaded' });
      }

      // Upload files to S3 and store file information
      const fileInfos = [];
      const timestamp = Date.now();
      
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const ext = path.extname(file.originalname);
        const fileName = `report-${patra.referenceNumber}-${timestamp}-${i}${ext}`;
        
        try {
          console.log(`Uploading file ${i + 1}/${uploadedFiles.length} to S3:`, file.originalname);
          
          // Upload to S3 using the S3Service
          const s3Url = await s3Service.uploadToS3(file.buffer, `reports/${fileName}`, file.mimetype);
          
          console.log('File uploaded to S3:', s3Url);
          
          fileInfos.push({
            originalName: file.originalname,
            filename: fileName,
            s3Url: s3Url,
            s3Key: `reports/${fileName}`,
            size: file.size,
            mimetype: file.mimetype,
            uploadedAt: new Date()
          });
          
        } catch (s3Error) {
          console.error('S3 upload failed for file:', file.originalname, s3Error);
          // Continue with other files, but log the error
          fileInfos.push({
            originalName: file.originalname,
            filename: fileName,
            s3Url: null,
            s3Key: null,
            size: file.size,
            mimetype: file.mimetype,
            uploadedAt: new Date(),
            error: s3Error.message
          });
        }
      }

      // Check if any files were successfully uploaded
      const successfulUploads = fileInfos.filter(f => f.s3Url);
      if (successfulUploads.length === 0) {
        return res.status(500).json({ 
          error: 'All file uploads to S3 failed',
          details: fileInfos.map(f => ({ name: f.originalName, error: f.error }))
        });
      }

      // Update the patra with report files information
      const reportFiles = patra.reportFiles ? JSON.parse(patra.reportFiles) : [];
      reportFiles.push(...fileInfos);

      await patra.update({
        reportFiles: JSON.stringify(reportFiles),
        reportUploadedAt: new Date(),
        reportUploadedBy: req.user?.id || null,
        reportUploadedByEmail: req.user?.email || null
      });

      console.log(`Report files uploaded successfully to S3 for letter ${patra.referenceNumber}:`, successfulUploads.length, 'files');

      return res.status(200).json({
        success: true,
        message: `${successfulUploads.length} report file(s) uploaded successfully to S3`,
        data: {
          letterId: patra.id,
          referenceNumber: patra.referenceNumber,
          uploadedFiles: successfulUploads.length,
          totalFiles: uploadedFiles.length,
          files: successfulUploads.map(f => ({
            originalName: f.originalName,
            size: f.size,
            type: f.mimetype,
            s3Url: f.s3Url
          })),
          failedFiles: fileInfos.filter(f => !f.s3Url).map(f => ({
            originalName: f.originalName,
            error: f.error
          }))
        }
      });

    } catch (error) {
      console.error('Error uploading report files:', error);
      
      return res.status(500).json({ 
        error: 'Server error during file upload', 
        details: error.message 
      });
    }
  });
};

// Close case for letters with uploaded reports
const closeCase = async (req, res) => {
  const { id } = req.params;
  
  console.log('=== Close Case Debug ===');
  console.log('Letter ID:', id);
  console.log('User:', req.user ? { id: req.user.id, email: req.user.email, role: req.user.roleName } : 'No user');

  try {
    // Find the letter
    const patra = await InwardPatra.findByPk(id, {
      include: [
        {
          model: CoveringLetter,
          as: 'coveringLetter',
          required: false
        }
      ]
    });

    if (!patra) {
      console.log('Letter not found:', id);
      return res.status(404).json({ error: 'Letter not found' });
    }

    console.log('Letter found:', {
      id: patra.id,
      referenceNumber: patra.referenceNumber,
      hasReportFiles: !!patra.reportFiles,
      inwardPatraClose: patra.inwardPatraClose
    });

    // Check if letter already closed
    if (patra.inwardPatraClose) {
      return res.status(400).json({ 
        error: 'Case is already closed',
        closedAt: patra.caseClosedAt,
        closedBy: patra.caseClosedByEmail
      });
    }

    // Check if letter has uploaded report files
    const hasReportFiles = patra.reportFiles && patra.reportFiles !== '[]' && patra.reportFiles !== 'null';
    
    if (!hasReportFiles) {
      return res.status(400).json({ 
        error: 'Cannot close case. No report files have been uploaded.',
        requiresReports: true
      });
    }

    console.log('Closing case for letter:', patra.referenceNumber);

    // Update the patra to close the case
    await patra.update({
      inwardPatraClose: true,
      letterStatus: 'case close',
      caseClosedAt: new Date(),
      caseClosedBy: req.user?.id || null,
      caseClosedByEmail: req.user?.email || null
    });

    console.log(`Case closed successfully for letter ${patra.referenceNumber}`);

    return res.status(200).json({
      success: true,
      message: 'Case closed successfully',
      data: {
        letterId: patra.id,
        referenceNumber: patra.referenceNumber,
        status: 'case close',
        closedAt: new Date(),
        closedBy: req.user?.email || 'Unknown'
      }
    });

  } catch (error) {
    console.error('Error closing case:', error);
    
    return res.status(500).json({ 
      error: 'Server error during case closure', 
      details: error.message 
    });
  }
};

// Get only covering letters with complete data (including Word documents)
const getAllCoveringLetters = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, letterType } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    if (status) whereClause.status = status;
    if (letterType) whereClause.letterType = letterType;

    const coveringLetters = await CoveringLetter.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: InwardPatra,
          as: 'InwardPatra',
          attributes: ['id', 'referenceNumber', 'owReferenceNumber', 'subject', 'officeSendingLetter', 'senderNameAndDesignation', 'outwardLetterNumber']
        },
        {
          model: User,
          as: 'User',
          attributes: ['id', 'email']
        },
        {
          model: File,
          as: 'attachedFile',
          attributes: ['id', 'originalName', 'fileName', 'fileUrl'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Format covering letters with Word document URLs
    const formattedCoveringLetters = coveringLetters.rows.map(letter => formatCoveringLetterData(letter));

    return res.status(200).json({
      success: true,
      message: 'Covering letters retrieved successfully with Word document support',
      data: {
        coveringLetters: formattedCoveringLetters,
        totalCount: coveringLetters.count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(coveringLetters.count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching covering letters:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get covering letter by ID with proper associations (including Word documents)
const getCoveringLetterById = async (req, res) => {
  const { id } = req.params;

  try {
    const coveringLetter = await CoveringLetter.findByPk(id, {
      include: [
        {
          model: InwardPatra,
          as: 'InwardPatra',
          attributes: ['id', 'referenceNumber', 'owReferenceNumber', 'subject', 'officeSendingLetter', 'senderNameAndDesignation', 'outwardLetterNumber', 'letterDate']
        },
        {
          model: User,
          as: 'User',
          attributes: ['id', 'email']
        },
        {
          model: File,
          as: 'attachedFile',
          attributes: ['id', 'originalName', 'fileName', 'fileUrl'],
          required: false
        },
        {
          model: Head,
          as: 'heads',
          include: [
            {
              model: User,
              as: 'User',
              attributes: ['id', 'email']
            }
          ],
          required: false
        }
      ]
    });

    if (!coveringLetter) {
      return res.status(404).json({ error: 'Covering letter not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Covering letter retrieved successfully with Word document support',
      data: formatCoveringLetterData(coveringLetter)
    });
  } catch (error) {
    console.error('Error fetching covering letter by ID:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// NEW: Get available forward-to options - Only 6 specific tables
const getForwardToOptions = async (req, res) => {
  try {
    // Return only the 6 specific tables you want
    const finalOptions = [
      { value: 'dg', label: 'DG Table' },
      { value: 'ig', label: 'IG Table' },
      { value: 'sp', label: 'SP Table' },
      { value: 'dm', label: 'DM Table' },
      { value: 'home', label: 'Home Table' },
      { value: 'local', label: 'Local Table' }
    ];

    return res.status(200).json({
      success: true,
      message: 'Forward-to options retrieved successfully',
      data: finalOptions
    });
  } catch (error) {
    console.error('Error fetching forward-to options:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

module.exports = {
  createPatra,
  getAllPatras,
  getHeadLetters, // NEW: Export the Head letters function
  getPatraById,
  getPatraByReferenceNumber,
  getPatraByOwReferenceNumber, // NEW: Export the new function
  getPatraByUserId,
  deletePatraById,
  updatePatraById,
  getPatraByUserIdAndPatraId,
  resendLetter,
  updateLetterStatus,
  sendToHOD,
  approveLetter,
  getAllCoveringLetters,
  getCoveringLetterById,
  generateReferenceNumber,
  generateOwReferenceNumber, // Export the generator function for potential reuse
  getForwardToOptions, // NEW: Export the forward-to options function
  uploadReportFiles, // NEW: Export the new uploadReportFiles function
  closeCase // NEW: Export the new closeCase function
};