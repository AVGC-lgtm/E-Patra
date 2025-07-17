const Patra = require('../models/InwardPatra');
const User = require('../models/User');
const File = require('../models/File');
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

// Create a new Patra (InwardPatra)
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
    subject,  // Ensure subject is passed in request body
    outwardLetterNumber,
    numberOfCopies,
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
      subject,  // Pass subject to the model
      outwardLetterNumber,
      numberOfCopies: numberOfCopies || 1,  // Default to 1 if not provided
      fileId: validatedFileId,
      userId: user.id,
    });

    return res.status(201).json({
      message: 'Patra created successfully',
      referenceNumber: referenceNumber,
      patraId: newPatra.id,
    });
  } catch (error) {
    console.error('Error creating Patra:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};


// Get all Patras
const getAllPatras = async (req, res) => {
  try {
    const patras = await Patra.findAll({
      include: [
        {
          model: User,
          attributes: ['id', 'email'],
          // FIXED: Use correct foreign key
          foreignKey: 'userId'
        },
        {
          model: File,
          as: 'upload', // FIXED: Use the alias defined in the model
          attributes: ['id', 'originalName', 'fileName', 'fileUrl', 'extractData'],
          required: false // Left join to include patras without files
        }
      ]
    });
    return res.status(200).json(patras);
  } catch (error) {
    console.error('Error fetching all Patras:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get a Patra by ID
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
          as: 'upload',
          attributes: ['id', 'originalName', 'fileName', 'fileUrl', 'extractData'],
          required: false
        }
      ]
    });

    if (!patra) {
      return res.status(404).json({ error: 'Patra not found' });
    }

    return res.status(200).json(patra);
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
          as: 'upload',
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
          as: 'upload',
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

    await patra.destroy();
    return res.status(200).json({ message: 'Patra deleted successfully' });
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
    userId,
    fileId // FIXED: Get fileId from request body
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

    // FIXED: Validate fileId if provided
    let validatedFileId = patra.fileId; // Keep existing fileId by default
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
      userId: user.id,
      fileId: validatedFileId, // FIXED: Update fileId properly
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

module.exports = {
  createPatra,
  getAllPatras,
  getPatraById,
  getPatraByReferenceNumber,
  getPatraByUserId,
  deletePatraById,
  updatePatraById,
  getPatraByUserIdAndPatraId,
};