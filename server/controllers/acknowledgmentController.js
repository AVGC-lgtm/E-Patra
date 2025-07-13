const Acknowledgment = require('../models/Acknowledgment');
const Patra = require('../models/InwardPatra');  // Reference to Patra model
const User = require('../models/User');  // Reference to User model
const PoliceStation = require('../models/PoliceStation'); // Reference to PoliceStation model

const acknowledgePatra = async (req, res) => {
  const { patraId, userId } = req.params;  // Get Patra ID and User ID from URL params

  try {
    // Check if the Patra exists
    const patra = await Patra.findByPk(patraId);
    if (!patra) {
      return res.status(404).json({ error: 'Patra not found' });
    }

    // Check if the User exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch the reference number and createdBy (userId) from the Patra model
    const referenceNumber = patra.referenceNumber;
    const createdByUserId = patra.userId;  // Fetch the user ID who created the Patra

    // Fetch branchName (PoliceStation ID) from Patra
    const branchName = patra.branchName;

    // Create a new acknowledgment record
    const acknowledgment = await Acknowledgment.create({
      patraId,
      referenceNumber,  // Pass the reference number to the Acknowledgment table
      acknowledgedBy: userId,
      acknowledgedDate: new Date(),
      letterStatus: 'send to police station',  // Update letterStatus after acknowledgment
      createdUserId: createdByUserId,  // Store the user ID who created the Patra
      branchName,  // Pass the PoliceStation reference (branchName)
    });

    // Update the Patra's letterStatus to 'send to police station'
    patra.letterStatus = 'send to police station';
    await patra.save();

    return res.status(200).json({
      message: 'Patra acknowledged successfully',
      acknowledgment,
      updatedPatraStatus: patra.letterStatus,  // Send the updated Patra status
      createdByUserId,  // Include the created user ID in the response
    });
  } catch (error) {
    console.error('Error acknowledging Patra:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { acknowledgePatra };
