// controllers/InwardPatraController.js - Updated with EmailRecord inclusion
const { InwardPatra, CoveringLetter, User, File, Head, EmailRecord } = require('../models/associations');
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

// Common include configuration for covering letter
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

// NEW: Common include configuration for email records
const getEmailRecordsInclude = () => ({
  model: EmailRecord,
  as: 'EmailRecords', // This should match the association name
  attributes: ['id', 'subject', 'from', 'date', 'text', 'html', 'messageId', 'inReplyTo', 'references', 'attachments', 'referenceNumber', 'createdAt'],
  required: false,
  order: [['date', 'DESC']] // Order emails by date, newest first
});

// Create a new Patra (InwardPatra) with auto-generated covering letter
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
    fileId
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

    const referenceNumber = await generateReferenceNumber();

    // Create InwardPatra within transaction
    const newPatra = await InwardPatra.create({
      referenceNumber,
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
      coveringLetterId: null // Initially null
    }, { transaction });

    // AUTO-GENERATE COVERING LETTER
    try {
      const coveringLetter = await coveringLetterControllerInstance.autoGenerateCoveringLetter(
        newPatra.id, 
        user.id,
        transaction
      );
      
      console.log('Covering letter generated automatically:', coveringLetter.id);
      
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
          getCoveringLetterInclude(),
          getEmailRecordsInclude() // Include email records
        ]
      });
      
      return res.status(201).json({
        message: 'Patra created successfully with covering letter',
        referenceNumber: referenceNumber,
        patraId: newPatra.id,
        letterStatus: newPatra.letterStatus,
        coveringLetterId: coveringLetter.id,
        coveringLetterGenerated: true,
        patra: completePatra
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

// Get all Patras with their complete covering letters data and email records
const getAllPatras = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, classification, includeEmails = 'true' } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    if (status) whereClause.letterStatus = status;
    if (classification) whereClause.letterClassification = classification;

    // Build includes array based on query params
    const includes = [
      getUserInclude(),
      getUploadedFileInclude(),
      getCoveringLetterInclude()
    ];
    
    // Optionally include email records (default is true)
    if (includeEmails === 'true') {
      includes.push(getEmailRecordsInclude());
    }

    const patras = await InwardPatra.findAndCountAll({
      where: whereClause,
      include: includes,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Debug: Log the structure of the first patra
    if (patras.rows.length > 0) {
      console.log('🔍 Debug: First patra structure:');
      console.log('  - ID:', patras.rows[0].id);
      console.log('  - Reference Number:', patras.rows[0].referenceNumber);
      console.log('  - Has uploadedFile:', !!patras.rows[0].uploadedFile);
      console.log('  - Has coveringLetter:', !!patras.rows[0].coveringLetter);
      console.log('  - Email Records count:', patras.rows[0].EmailRecords ? patras.rows[0].EmailRecords.length : 0);
      
      if (patras.rows[0].uploadedFile) {
        console.log('  - Uploaded file details:', {
          id: patras.rows[0].uploadedFile.id,
          originalName: patras.rows[0].uploadedFile.originalName,
          fileUrl: patras.rows[0].uploadedFile.fileUrl
        });
      }
      
      if (patras.rows[0].coveringLetter) {
        console.log('  - Covering letter details:', {
          id: patras.rows[0].coveringLetter.id,
          hasAttachedFile: !!patras.rows[0].coveringLetter.attachedFile
        });
        
        if (patras.rows[0].coveringLetter.attachedFile) {
          console.log('  - Covering letter file details:', {
            id: patras.rows[0].coveringLetter.attachedFile.id,
            originalName: patras.rows[0].coveringLetter.attachedFile.originalName,
            fileUrl: patras.rows[0].coveringLetter.attachedFile.fileUrl
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Patras retrieved successfully',
      data: {
        patras: patras.rows,
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

// Get a Patra by ID with complete covering letter data and email records
const getPatraById = async (req, res) => {
  const { id } = req.params;

  try {
    const patra = await InwardPatra.findByPk(id, {
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude(),
        getEmailRecordsInclude(), // Include email records
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
      message: 'Patra retrieved successfully',
      data: patra
    });
  } catch (error) {
    console.error('Error fetching Patra by ID:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get Patra by reference number with complete covering letter data and email records
const getPatraByReferenceNumber = async (req, res) => {
  const { referenceNumber } = req.params;

  try {
    const patra = await InwardPatra.findOne({
      where: { referenceNumber },
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude(),
        getEmailRecordsInclude() // Include email records
      ]
    });

    if (!patra) {
      return res.status(404).json({ error: 'Patra not found with this reference number' });
    }

    return res.status(200).json({
      success: true,
      message: 'Patra retrieved successfully',
      data: patra
    });
  } catch (error) {
    console.error('Error fetching Patra by reference number:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get Patra by user ID with complete covering letter data and email records
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
    
    // Optionally include email records
    if (includeEmails === 'true') {
      includes.push(getEmailRecordsInclude());
    }

    const patras = await InwardPatra.findAll({
      where: { userId },
      include: includes,
      order: [['createdAt', 'DESC']]
    });

    if (patras.length === 0) {
      return res.status(404).json({ error: 'No Patra found for this user' });
    }

    return res.status(200).json({
      success: true,
      message: 'Patras retrieved successfully',
      data: {
        count: patras.length,
        patras: patras
      }
    });
  } catch (error) {
    console.error('Error fetching Patras by user ID:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Delete a Patra by ID
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

    // Delete associated email records first
    await EmailRecord.destroy({ 
      where: { referenceNumber: patra.referenceNumber },
      transaction 
    });

    // Delete associated covering letter
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
      message: 'Patra and associated data deleted successfully' 
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
    userRole
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

    await patra.update(updateData);
    
    // Reload with complete data using proper associations
    const updatedPatra = await InwardPatra.findByPk(id, {
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude(),
        getEmailRecordsInclude() // Include email records
      ]
    });

    return res.status(200).json({ 
      success: true,
      message: 'Patra updated successfully', 
      data: updatedPatra 
    });
  } catch (error) {
    console.error('Error updating Patra by ID:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get Patra by user ID and Patra ID with complete covering letter data and email records
const getPatraByUserIdAndPatraId = async (req, res) => {
  const { userId, patraId } = req.params;

  try {
    const patra = await InwardPatra.findOne({
      where: { id: patraId, userId },
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude(),
        getEmailRecordsInclude() // Include email records
      ]
    });

    if (!patra) {
      return res.status(404).json({ error: 'Patra not found for this user' });
    }

    return res.status(200).json({
      success: true,
      message: 'Patra retrieved successfully',
      data: patra
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

    // Return updated patra with complete covering letter data and email records
    const updatedPatra = await InwardPatra.findByPk(id, {
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude(),
        getEmailRecordsInclude() // Include email records
      ]
    });

    return res.status(200).json({ 
      success: true,
      message: 'Letter status updated successfully', 
      data: {
        letterStatus: updatedPatra.letterStatus,
        patra: updatedPatra
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

// NEW: Get only covering letters with complete data
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
          attributes: ['id', 'referenceNumber', 'subject', 'officeSendingLetter', 'senderNameAndDesignation', 'outwardLetterNumber']
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

    return res.status(200).json({
      success: true,
      message: 'Covering letters retrieved successfully',
      data: {
        coveringLetters: coveringLetters.rows,
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

// FIXED: Get covering letter by ID with proper associations
const getCoveringLetterById = async (req, res) => {
  const { id } = req.params;

  try {
    const coveringLetter = await CoveringLetter.findByPk(id, {
      include: [
        {
          model: InwardPatra,
          as: 'InwardPatra',
          attributes: ['id', 'referenceNumber', 'subject', 'officeSendingLetter', 'senderNameAndDesignation', 'outwardLetterNumber', 'letterDate']
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
      message: 'Covering letter retrieved successfully',
      data: coveringLetter
    });
  } catch (error) {
    console.error('Error fetching covering letter by ID:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// NEW: Get email conversation history for a specific InwardPatra
const getEmailConversation = async (req, res) => {
  const { referenceNumber } = req.params;

  try {
    const emails = await EmailRecord.findAll({
      where: { referenceNumber },
      order: [['date', 'ASC']], // Order by date ascending to show conversation flow
      attributes: ['id', 'subject', 'from', 'date', 'text', 'html', 'messageId', 'inReplyTo', 'references', 'attachments', 'createdAt']
    });

    if (emails.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No email conversation found for this reference number' 
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Email conversation retrieved successfully',
      data: {
        referenceNumber,
        emailCount: emails.length,
        emails: emails
      }
    });
  } catch (error) {
    console.error('Error fetching email conversation:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

module.exports = {
  createPatra,
  getAllPatras,
  getPatraById,
  getPatraByReferenceNumber,
  getPatraByUserId,
  deletePatraById,
  updatePatraById,
  getPatraByUserIdAndPatraId,
  updateLetterStatus,
  sendToHOD,
  approveLetter,
  getAllCoveringLetters,
  getCoveringLetterById,
  getEmailConversation, // Export new function
};