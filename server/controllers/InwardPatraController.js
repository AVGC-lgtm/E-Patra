// controllers/InwardPatraController.js - Fixed version with proper column references
const Patra = require('../models/InwardPatra');
const User = require('../models/User');
const File = require('../models/File');
const CoveringLetter = require('../models/CoveringLetter');
const sequelize = require('../config/database');

// Import associations to ensure they're loaded
require('../models/associations');

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

    const existingPatra = await Patra.findOne({ where: { referenceNumber } });
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

// Common include configuration for user - ONLY include fields that exist
const getUserInclude = () => ({
  model: User,
  attributes: ['id', 'email'], // Only include existing fields
  required: false
});

// Common include configuration for uploaded file
const getUploadedFileInclude = () => ({
  model: File,
  as: 'uploadedFile',
  attributes: ['id', 'originalName', 'fileName', 'fileUrl', 'extractData'],
  required: false
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

    // Create Patra within transaction
    const newPatra = await Patra.create({
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
      
      // Fetch the complete created Patra with all covering letter data
      const completePatra = await Patra.findByPk(newPatra.id, {
        include: [
          getUserInclude(),
          getUploadedFileInclude(),
          getCoveringLetterInclude()
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
      
      // Rollback transaction if covering letter creation fails
      await transaction.rollback();
      
      return res.status(500).json({
        message: 'Failed to create Patra due to covering letter generation error',
        error: coveringLetterError.message,
        coveringLetterGenerated: false
      });
    }

  } catch (error) {
    console.error('Error creating Patra:', error);
    await transaction.rollback();
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get all Patras with their complete covering letters data
const getAllPatras = async (req, res) => {
  try {
    const patras = await Patra.findAll({
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude()
      ],
      order: [['createdAt', 'DESC']]
    });

    // Debug: Log the structure of the first patra
    if (patras.length > 0) {
      console.log('🔍 Debug: First patra structure:');
      console.log('  - ID:', patras[0].id);
      console.log('  - Reference Number:', patras[0].referenceNumber);
      console.log('  - Has uploadedFile:', !!patras[0].uploadedFile);
      console.log('  - Has coveringLetter:', !!patras[0].coveringLetter);
      
      if (patras[0].uploadedFile) {
        console.log('  - Uploaded file details:', {
          id: patras[0].uploadedFile.id,
          originalName: patras[0].uploadedFile.originalName,
          fileUrl: patras[0].uploadedFile.fileUrl
        });
      }
      
      if (patras[0].coveringLetter) {
        console.log('  - Covering letter details:', {
          id: patras[0].coveringLetter.id,
          hasAttachedFile: !!patras[0].coveringLetter.attachedFile
        });
        
        if (patras[0].coveringLetter.attachedFile) {
          console.log('  - Covering letter file details:', {
            id: patras[0].coveringLetter.attachedFile.id,
            originalName: patras[0].coveringLetter.attachedFile.originalName,
            fileUrl: patras[0].coveringLetter.attachedFile.fileUrl
          });
        }
      }
    }

    res.json({
      message: 'Patras retrieved successfully',
      count: patras.length,
      patras: patras
    });
  } catch (error) {
    console.error('Error retrieving Patras:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get a Patra by ID with complete covering letter data
const getPatraById = async (req, res) => {
  const { id } = req.params;

  try {
    const patra = await Patra.findByPk(id, {
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude()
      ]
    });

    if (!patra) {
      return res.status(404).json({ error: 'Patra not found' });
    }

    return res.status(200).json({
      message: 'Patra retrieved successfully',
      patra: patra
    });
  } catch (error) {
    console.error('Error fetching Patra by ID:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get Patra by reference number with complete covering letter data
const getPatraByReferenceNumber = async (req, res) => {
  const { referenceNumber } = req.params;

  try {
    const patra = await Patra.findOne({
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
      message: 'Patra retrieved successfully',
      patra: patra
    });
  } catch (error) {
    console.error('Error fetching Patra by reference number:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get Patra by user ID with complete covering letter data
const getPatraByUserId = async (req, res) => {
  const { userId } = req.params;

  try {
    const patras = await Patra.findAll({
      where: { userId },
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude()
      ],
      order: [['createdAt', 'DESC']]
    });

    if (patras.length === 0) {
      return res.status(404).json({ error: 'No Patra found for this user' });
    }

    return res.status(200).json({
      message: 'Patras retrieved successfully',
      count: patras.length,
      patras: patras
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
    const patra = await Patra.findByPk(id, { transaction });
    if (!patra) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Patra not found' });
    }

    // Delete associated covering letter first
    await CoveringLetter.destroy({ 
      where: { patraId: id },
      transaction 
    });

    // Delete the patra
    await patra.destroy({ transaction });
    
    // Commit transaction
    await transaction.commit();
    
    return res.status(200).json({ message: 'Patra and associated covering letter deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting Patra by ID:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Update a Patra by ID
// Update a Patra by ID - FIXED VERSION
// Update a Patra by ID - FIXED VERSION
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
    // Add support for the new fields from frontend
    sentTo,
    sentAt,
    updatedBy,
    updatedByEmail,
    updatedByName,
    userRole
  } = req.body;

  try {
    const patra = await Patra.findByPk(id);
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
    
    // Add new fields for tracking who sent the letter and where
    if (sentTo !== undefined) updateData.sentTo = JSON.stringify(sentTo); // Store as JSON string
    if (sentAt !== undefined) updateData.sentAt = sentAt;
    if (updatedBy !== undefined) updateData.updatedBy = updatedBy;
    if (updatedByEmail !== undefined) updateData.updatedByEmail = updatedByEmail;
    if (updatedByName !== undefined) updateData.updatedByName = updatedByName;
    if (userRole !== undefined) updateData.userRole = userRole;

    await patra.update(updateData);
    
    // Reload with complete covering letter data
    // FIXED: Use the correct alias 'uploadedFile' instead of 'upload'
    await patra.reload({
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude()
      ]
    });

    return res.status(200).json({ 
      message: 'Patra updated successfully', 
      patra: patra 
    });
  } catch (error) {
    console.error('Error updating Patra by ID:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get Patra by user ID and Patra ID with complete covering letter data
const getPatraByUserIdAndPatraId = async (req, res) => {
  const { userId, patraId } = req.params;

  try {
    const patra = await Patra.findOne({
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
      message: 'Patra retrieved successfully',
      patra: patra
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
    const patra = await Patra.findByPk(id);
    if (!patra) {
      return res.status(404).json({ error: 'Patra not found' });
    }

    if (letterStatus === undefined) {
      return res.status(400).json({ error: 'letterStatus is required' });
    }

    await patra.update({ letterStatus });

    // Return updated patra with complete covering letter data
    await patra.reload({
      include: [
        getUserInclude(),
        getUploadedFileInclude(),
        getCoveringLetterInclude()
      ]
    });

    return res.status(200).json({ 
      message: 'Letter status updated successfully', 
      letterStatus: patra.letterStatus,
      patra: patra
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
    const patra = await Patra.findByPk(id);
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
    const patra = await Patra.findByPk(id);
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
    const coveringLetters = await CoveringLetter.findAll({
      include: [
        {
          model: Patra, // Changed from InwardPatra to Patra
          attributes: ['id', 'referenceNumber', 'subject', 'officeSendingLetter', 'senderNameAndDesignation']
        },
        getUserInclude(),
        {
          model: File,
          as: 'attachedFile',
          attributes: ['id', 'originalName', 'fileName', 'fileUrl'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      message: 'Covering letters retrieved successfully',
      count: coveringLetters.length,
      coveringLetters: coveringLetters
    });
  } catch (error) {
    console.error('Error fetching covering letters:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// NEW: Get covering letter by ID with complete data
const getCoveringLetterById = async (req, res) => {
  const { id } = req.params;

  try {
    const coveringLetter = await CoveringLetter.findByPk(id, {
      include: [
        {
          model: Patra, // Changed from InwardPatra to Patra
          attributes: ['id', 'referenceNumber', 'subject', 'officeSendingLetter', 'senderNameAndDesignation']
        },
        getUserInclude(),
        {
          model: File,
          as: 'attachedFile',
          attributes: ['id', 'originalName', 'fileName', 'fileUrl'],
          required: false
        }
      ]
    });

    if (!coveringLetter) {
      return res.status(404).json({ error: 'Covering letter not found' });
    }

    return res.status(200).json({
      message: 'Covering letter retrieved successfully',
      coveringLetter: coveringLetter
    });
  } catch (error) {
    console.error('Error fetching covering letter by ID:', error);
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
};