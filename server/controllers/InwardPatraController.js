const Patra = require('../models/InwardPatra');
const User = require('../models/User');
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
    subject,
    outwardLetterNumber,
    numberOfCopies,
    userId
  } = req.body;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Generate unique reference number
    const referenceNumber = await generateReferenceNumber();

    // Handle uploaded files and assign fileId (if file is uploaded)
    let fileId = null;
    if (req.files && req.files.length > 0) {
      // Assuming files are handled elsewhere and fileId is already assigned
      fileId = req.files[0].fileId;  // Assuming the first uploaded file is linked with the record
    }

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
      numberOfCopies,
      fileId, // Added fileId here to associate the uploaded file
      userId: user.id,
    });

    return res.status(201).json({
      message: 'Patra created successfully',
      referenceNumber: referenceNumber,
      patraId: newPatra.id, // Added patraId in response
    });
  } catch (error) {
    console.error('Error creating Patra:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Get all Patras
const getAllPatras = async (req, res) => {
  try {
    const patras = await Patra.findAll({
      include: [
        { model: User, attributes: ['id', 'email'] },  // Include User to show creator info
      ]
    });
    return res.status(200).json(patras);
  } catch (error) {
    console.error('Error fetching all Patras:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Get a Patra by ID
const getPatraById = async (req, res) => {
  const { id } = req.params;

  try {
    const patra = await Patra.findByPk(id, {
      include: [
        { model: User, attributes: ['id', 'email'] },  // Include User to show creator info
      ]
    });

    if (!patra) {
      return res.status(404).json({ error: 'Patra not found' });
    }

    return res.status(200).json(patra);
  } catch (error) {
    console.error('Error fetching Patra by ID:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Get Patra by reference number
const getPatraByReferenceNumber = async (req, res) => {
  const { referenceNumber } = req.params;

  try {
    const patra = await Patra.findOne({
      where: { referenceNumber },
      include: [
        { model: User, attributes: ['id', 'email'] },
      ]
    });

    if (!patra) {
      return res.status(404).json({ error: 'Patra not found with this reference number' });
    }

    return res.status(200).json(patra);
  } catch (error) {
    console.error('Error fetching Patra by reference number:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Get Patra by user ID
const getPatraByUserId = async (req, res) => {
  const { userId } = req.params;

  try {
    const patras = await Patra.findAll({
      where: { userId },
      include: [
        { model: User, attributes: ['id', 'email'] },
      ]
    });

    if (patras.length === 0) {
      return res.status(404).json({ error: 'No Patra found for this user' });
    }

    return res.status(200).json(patras);
  } catch (error) {
    console.error('Error fetching Patras by user ID:', error);
    return res.status(500).json({ error: 'Server error' });
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
    return res.status(500).json({ error: 'Server error' });
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
    userId
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
    };

    // Handle fileId if file is uploaded
    let fileId = patra.fileId;
    if (req.files && req.files.length > 0) {
      fileId = req.files[0].fileId;  // Assuming the first uploaded file is linked with the record
    }

    await patra.update({
      ...updateData,
      fileId, // Update fileId
    });
    await patra.reload();

    return res.status(200).json({ message: 'Patra updated successfully', patra });
  } catch (error) {
    console.error('Error updating Patra by ID:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Get Patra by user ID and Patra ID
const getPatraByUserIdAndPatraId = async (req, res) => {
  const { userId, patraId } = req.params;

  try {
    const patra = await Patra.findOne({
      where: { id: patraId, userId },
      include: [
        { model: User, attributes: ['id', 'email'] },
      ]
    });

    if (!patra) {
      return res.status(404).json({ error: 'Patra not found for this user' });
    }

    return res.status(200).json(patra);
  } catch (error) {
    console.error('Error fetching Patra by user ID and Patra ID:', error);
    return res.status(500).json({ error: 'Server error' });
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
