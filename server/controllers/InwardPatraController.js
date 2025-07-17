// controllers/InwardPatraController.js - Fixed with proper model imports
const Patra = require('../models/InwardPatra');
const User = require('../models/User');
const File = require('../models/File');
const CoveringLetter = require('../models/CoveringLetter');

// Import associations to ensure they're loaded
require('../models/associations');

const coveringLetterController = require('./coveringLetterController');
const { Op } = require('sequelize');

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

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    let validatedFileId = null;
    if (fileId) {
      const file = await File.findByPk(fileId);
      if (!file) {
        return res.status(400).json({ error: 'File not found' });
      }
      validatedFileId = fileId;
    }

    const referenceNumber = await generateReferenceNumber();

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
    });

    // AUTO-GENERATE COVERING LETTER
    try {
      const coveringLetter = await coveringLetterController.autoGenerateCoveringLetter(
        newPatra.id, 
        user.id
      );
      
      console.log('Covering letter generated automatically:', coveringLetter.id);
      
      return res.status(201).json({
        message: 'Patra created successfully with covering letter',
        referenceNumber: referenceNumber,
        patraId: newPatra.id,
        letterStatus: newPatra.letterStatus,
        coveringLetterId: coveringLetter.id,
        coveringLetterGenerated: true
      });

    } catch (coveringLetterError) {
      console.error('Error generating covering letter:', coveringLetterError);
      
      // Still return success for Patra creation, but note covering letter failed
      return res.status(201).json({
        message: 'Patra created successfully, but covering letter generation failed',
        referenceNumber: referenceNumber,
        patraId: newPatra.id,
        letterStatus: newPatra.letterStatus,
        coveringLetterGenerated: false,
        coveringLetterError: coveringLetterError.message
      });
    }

  } catch (error) {
    console.error('Error creating Patra:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get all Patras with their covering letters
const getAllPatras = async (req, res) => {
  try {
    const patras = await Patra.findAll({
      include: [
        {
          model: User,
          attributes: ['id', 'email'],
          foreignKey: 'userId'
        },
        {
          model: File,
          as: 'uploadedFile',
          attributes: ['id', 'originalName', 'fileName', 'fileUrl', 'extractData'],
          required: false
        }
      ]
    });

    // Add covering letter info to each patra
    const patrasWithCoveringLetters = await Promise.all(
      patras.map(async (patra) => {
        const coveringLetter = await CoveringLetter.findOne({
          where: { patraId: patra.id },
          attributes: ['id', 'letterType', 'status', 'letterNumber', 'generatedAt']
        });

        return {
          ...patra.toJSON(),
          coveringLetter: coveringLetter || null
        };
      })
    );

    return res.status(200).json(patrasWithCoveringLetters);
  } catch (error) {
    console.error('Error fetching all Patras:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get a Patra by ID with covering letter
const getPatraById = async (req, res) => {
  const { id } = req.params;

  try {
    const patra = await Patra.findByPk(id, {
      include: [
        {
          model: User,
          attributes: ['id', 'email'],
          foreignKey: 'userId'
        },
        {
          model: File,
          as: 'uploadedFile',
          attributes: ['id', 'originalName', 'fileName', 'fileUrl', 'extractData'],
          required: false
        }
      ]
    });

    if (!patra) {
      return res.status(404).json({ error: 'Patra not found' });
    }

    // Get covering letter
    const coveringLetter = await CoveringLetter.findOne({
      where: { patraId: id }
    });

    return res.status(200).json({
      ...patra.toJSON(),
      coveringLetter: coveringLetter || null
    });
  } catch (error) {
    console.error('Error fetching Patra by ID:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get Patra by reference number
const getPatraByReferenceNumber = async (req, res) => {
  const { referenceNumber } = req.params;

  try {
    const patra = await Patra.findOne({
      where: { referenceNumber },
      include: [
        {
          model: User,
          attributes: ['id', 'email'],
          foreignKey: 'userId'
        },
        {
          model: File,
          as: 'uploadedFile',
          attributes: ['id', 'originalName', 'fileName', 'fileUrl', 'extractData'],
          required: false
        }
      ]
    });

    if (!patra) {
      return res.status(404).json({ error: 'Patra not found with this reference number' });
    }

    return res.status(200).json(patra);
  } catch (error) {
    console.error('Error fetching Patra by reference number:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get Patra by user ID
const getPatraByUserId = async (req, res) => {
  const { userId } = req.params;

  try {
    const patras = await Patra.findAll({
      where: { userId },
      include: [
        {
          model: User,
          attributes: ['id', 'email'],
          foreignKey: 'userId'
        },
        {
          model: File,
          as: 'uploadedFile',
          attributes: ['id', 'originalName', 'fileName', 'fileUrl'],
          required: false
        }
      ]
    });

    if (patras.length === 0) {
      return res.status(404).json({ error: 'No Patra found for this user' });
    }

    return res.status(200).json(patras);
  } catch (error) {
    console.error('Error fetching Patras by user ID:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Delete a Patra by ID
const deletePatraById = async (req, res) => {
  const { id } = req.params;

  try {
    const patra = await Patra.findByPk(id);
    if (!patra) {
      return res.status(404).json({ error: 'Patra not found' });
    }

    // Delete associated covering letter first
    await CoveringLetter.destroy({ where: { patraId: id } });

    await patra.destroy();
    return res.status(200).json({ message: 'Patra and associated covering letter deleted successfully' });
  } catch (error) {
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
    fileId
  } = req.body;

  try {
    const patra = await Patra.findByPk(id);
    if (!patra) {
      return res.status(404).json({ error: 'Patra not found' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
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

    const updateData = {
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
      letterStatus: letterStatus !== undefined ? letterStatus : patra.letterStatus,
      NA: NA !== undefined ? NA : patra.NA,
      NAR: NAR !== undefined ? NAR : patra.NAR,
      userId: user.id,
      fileId: validatedFileId,
    };

    await patra.update(updateData);
    await patra.reload({
      include: [
        {
          model: User,
          attributes: ['id', 'email'],
          foreignKey: 'userId'
        },
        {
          model: File,
          as: 'upload',
          attributes: ['id', 'originalName', 'fileName', 'fileUrl'],
          required: false
        }
      ]
    });

    return res.status(200).json({ message: 'Patra updated successfully', patra });
  } catch (error) {
    console.error('Error updating Patra by ID:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get Patra by user ID and Patra ID
const getPatraByUserIdAndPatraId = async (req, res) => {
  const { userId, patraId } = req.params;

  try {
    const patra = await Patra.findOne({
      where: { id: patraId, userId },
      include: [
        {
          model: User,
          attributes: ['id', 'email'],
          foreignKey: 'userId'
        },
        {
          model: File,
          as: 'upload',
          attributes: ['id', 'originalName', 'fileName', 'fileUrl', 'extractData'],
          required: false
        }
      ]
    });

    if (!patra) {
      return res.status(404).json({ error: 'Patra not found for this user' });
    }

    return res.status(200).json(patra);
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

    return res.status(200).json({ 
      message: 'Letter status updated successfully', 
      letterStatus: patra.letterStatus
    });
  } catch (error) {
    console.error('Error updating letter status:', error);
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
};