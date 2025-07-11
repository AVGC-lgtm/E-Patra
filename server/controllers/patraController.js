const Patra = require('../models/Patra');
const User = require('../models/User');
const PoliceStation = require('../models/PoliceStation');
const Acknowledgment = require('../models/Acknowledgment');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Function to generate 8-digit reference number
const generateReferenceNumber = async () => {
  let referenceNumber;
  let isUnique = false;

  while (!isUnique) {
    // Generate 8-digit random number
    referenceNumber = Math.floor(10000000 + Math.random() * 90000000).toString();

    // Check if this reference number already exists
    const existingPatra = await Patra.findOne({ where: { referenceNumber } });
    if (!existingPatra) {
      isUnique = true;
    }
  }

  return referenceNumber;
};

// Create a new Patra
const createPatra = async (req, res) => {
  const {
    receivedByOffice,
    recipientNameAndDesignation,
    letterType,
    letterDate,
    officeType,
    office,
    mobileNumber,
    remarks,
    branchName,  // branchName is used to store PoliceStation ID
    typeOfAction,
    letterStatus,
    letterMedium,
    subjectAndDetails,
    userId
  } = req.body;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Generate unique reference number
    const referenceNumber = await generateReferenceNumber();

    // Handle uploaded files
    let letterFiles = [];
    if (req.files && req.files.length > 0) {
      letterFiles = req.files.map(file => ({
        originalName: file.originalname,
        fileName: file.filename,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date()
      }));
    }

    const newPatra = await Patra.create({
      referenceNumber,
      receivedByOffice,
      recipientNameAndDesignation,
      letterType,
      letterDate,
      officeType,
      office,
      mobileNumber,
      remarks,
      branchName,  // Used to store the PoliceStation ID (branchName is a foreign key to PoliceStation's id)
      typeOfAction,
      letterStatus: 'pending',
      letterMedium,
      subjectAndDetails,
      letterFiles,
      userId: user.id,
    });

    return res.status(201).json({
      message: 'Patra created successfully',
      referenceNumber: referenceNumber
    });
  } catch (error) {
    console.error('Error creating Patra:', error);

    // Clean up uploaded files if Patra creation failed
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }

    return res.status(500).json({ error: 'Server error' });
  }
};

// Get all Patras
const getAllPatras = async (req, res) => {
  try {
    const patras = await Patra.findAll({
      include: [
        { model: User, attributes: ['id', 'email'] },  // Include User to show creator info
        { model: PoliceStation, attributes: ['id', 'name'] }  // Include PoliceStation to show branch name
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
        { model: PoliceStation, attributes: ['id', 'name'] }  // Include PoliceStation to show branch name
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
        { model: PoliceStation, attributes: ['id', 'name'] }
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
        { model: PoliceStation, attributes: ['id', 'name'] }
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

    // Delete associated files
    if (patra.letterFiles && patra.letterFiles.length > 0) {
      patra.letterFiles.forEach(fileInfo => {
        if (fs.existsSync(fileInfo.filePath)) {
          fs.unlink(fileInfo.filePath, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        }
      });
    }

    await patra.destroy();
    return res.status(200).json({ message: 'Patra deleted successfully' });
  } catch (error) {
    console.error('Error deleting Patra by ID:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Update a Patra by ID - Complete Update with File Management
const updatePatraById = async (req, res) => {
  const { id } = req.params;
  const {
    receivedByOffice,
    recipientNameAndDesignation,
    letterType,
    letterDate,
    officeType,
    office,
    mobileNumber,
    remarks,
    branchName,  // branchName is used to store PoliceStation ID
    typeOfAction,
    letterStatus,
    letterMedium,
    subjectAndDetails,
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

    const updatedStatus = letterStatus || 'pending';

    const updateData = {
      receivedByOffice: receivedByOffice || patra.receivedByOffice,
      recipientNameAndDesignation: recipientNameAndDesignation || patra.recipientNameAndDesignation,
      letterType: letterType || patra.letterType,
      letterDate: letterDate || patra.letterDate,
      officeType: officeType || patra.officeType,
      office: office || patra.office,
      mobileNumber: mobileNumber !== undefined ? mobileNumber : patra.mobileNumber,
      remarks: remarks !== undefined ? remarks : patra.remarks,
      branchName: branchName || patra.branchName,  // Branch Name used to reference PoliceStation ID
      typeOfAction: typeOfAction || patra.typeOfAction,
      letterStatus: updatedStatus,
      letterMedium: letterMedium || patra.letterMedium,
      subjectAndDetails: subjectAndDetails || patra.subjectAndDetails,
      userId: user.id
    };

    await patra.update(updateData);
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
        { model: PoliceStation, attributes: ['id', 'name'] }
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
