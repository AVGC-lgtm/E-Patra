// controllers/InwardPatraController.js - Complete controller with Word document support and owReferenceNumber
const { InwardPatra, CoveringLetter, User, File, Head, Role } = require('../models/associations');
const sequelize = require('../config/database');

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
    const user = await User.findByPk(userId);
    if (!user) {
      await transaction.rollback();
      return res.status(400).json({ error: 'User not found' });
    }

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
      forwardTo: forwardTo || null // NEW: Add forwardTo field
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
        'dg_other': 'dg',
        'ig_nashik_other': 'ig', 
        'sp': 'sp',
        'collector': 'collector',
        'home': 'home',
        'shanik_local': 'shanik',
        'head': 'admin'
      };

      const userTable = roleToTableMap[req.user.roleName] || req.user.table;
      
      // Special cases: inward_user and outward_user see all letters
      if (!['inward_user', 'outward_user'].includes(req.user.roleName)) {
        whereClause[Op.or] = [
          { forwardTo: userTable },
          { forwardTo: null }, // Also show letters without forwardTo specified
          { forwardTo: '' }    // Also show letters with empty forwardTo
        ];
      }
    }

    // Build includes array based on query params
    const includes = [
      getUserInclude(),
      getUploadedFileInclude(),
      getCoveringLetterInclude()
    ];

    const patras = await InwardPatra.findAndCountAll({
      where: whereClause,
      include: includes,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

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

  try {
    // Build includes array based on query params
    const includes = [
      getUserInclude(),
      getUploadedFileInclude(),
      getCoveringLetterInclude()
    ];

    const patras = await InwardPatra.findAll({
      where: { userId },
      include: includes,
      order: [['createdAt', 'DESC']]
    });

    if (patras.length === 0) {
      return res.status(404).json({ error: 'No Patra found for this user' });
    }

    // Format the response with Word document URLs
    const formattedPatras = patras.map(patra => ({
      ...patra.toJSON(),
      coveringLetter: formatCoveringLetterData(patra.coveringLetter)
    }));

    return res.status(200).json({
      success: true,
      message: 'Patras retrieved successfully with Word document support',
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
  const { recipients, sendToData, includeCoveringLetter } = req.body;

  try {
    const patra = await InwardPatra.findByPk(id);
    if (!patra) {
      return res.status(404).json({ error: 'Patra not found' });
    }

    // Update letter status to "sent to head" and store recipient information
    await patra.update({
      letterStatus: 'sent to head',
      sentTo: JSON.stringify({
        recipients: recipients,
        sendToData: sendToData,
        includeCoveringLetter: includeCoveringLetter,
        sentAt: new Date()
      })
    });
    
    return res.status(200).json({ 
      message: 'Letter sent to HOD for approval',
      letterStatus: 'sent to head',
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

// Resend letter back to Inward Letters (HOD action)
const resendLetter = async (req, res) => {
  const { id } = req.params;
  const { newStatus, reason } = req.body;

  // Start a database transaction for data consistency
  const transaction = await sequelize.transaction();

  try {
    // Find the patra
    const patra = await InwardPatra.findByPk(id, { transaction });
    
    if (!patra) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Patra not found' });
    }

    // Validate current status - only allow resending if not already approved
    if (patra.letterStatus === 'approved' || patra.letterStatus === 'मंजूर') {
      await transaction.rollback();
      return res.status(400).json({ 
        error: 'Cannot resend an approved letter',
        message: 'Approved letters cannot be sent back to Inward Letters'
      });
    }

    // Get current resend count
    const currentResendCount = patra.resendCount || 0;

    // Update the letter status and add metadata about the resend action
    const updateData = {
      letterStatus: newStatus || 'sending for head sign',
      previousStatus: patra.letterStatus,
      resendReason: reason || 'Resent by HOD back to Inward Staff',
      resendAt: new Date(),
      resendBy: req.user?.id || null, // If you have auth middleware that sets req.user
      resendByEmail: req.user?.email || null,
      resendByName: req.user?.name || null,
      resendByRole: 'HOD',
      resendCount: currentResendCount + 1 // Increment resend count
    };

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
      message: 'Letter successfully resent to Inward Letters',
      data: {
        letterStatus: updatedPatra.letterStatus,
        previousStatus: updateData.previousStatus,
        resendReason: updateData.resendReason,
        resendAt: updateData.resendAt,
        resendCount: updatedPatra.resendCount,
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

// NEW: Get available forward-to options based on roles table
const getForwardToOptions = async (req, res) => {
  try {
    // Get all roles that have a table field (these represent forward-to destinations)
    const roles = await Role.findAll({
      where: {
        table: {
          [Op.ne]: null // Not null
        }
      },
      attributes: ['id', 'roleName', 'table'],
      order: [['table', 'ASC']]
    });

    // Transform the data to provide user-friendly options
    const options = roles.map(role => ({
      value: role.table,
      label: `${role.table.charAt(0).toUpperCase() + role.table.slice(1)} Table`,
      roleId: role.id,
      roleName: role.roleName
    }));

    // Add some default options if they don't exist in roles
    const defaultOptions = [
      { value: 'dg', label: 'DG Table' },
      { value: 'ig', label: 'IG Table' },
      { value: 'sp', label: 'SP Table' },
      { value: 'dm', label: 'DM Table' },
      { value: 'home', label: 'Home Table' },
      { value: 'local', label: 'Local Table' }
    ];

    // Merge and deduplicate
    const existingValues = options.map(opt => opt.value);
    const missingDefaults = defaultOptions.filter(def => !existingValues.includes(def.value));
    const finalOptions = [...options, ...missingDefaults];

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
  getForwardToOptions // NEW: Export the forward-to options function
};