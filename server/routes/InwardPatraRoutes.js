const express = require('express');
const patraController = require('../controllers/InwardPatraController');
const router = express.Router();

// Create a new Patra (expects raw JSON)
router.post('/', patraController.createPatra);

// Get all Patras
router.get('/', patraController.getAllPatras);

// Get a Patra by ID
router.get('/:id', patraController.getPatraById);

// Get Patra by reference number
router.get('/reference/:referenceNumber', patraController.getPatraByReferenceNumber);

// Get Patra by user ID
router.get('/user/:userId', patraController.getPatraByUserId);

// Get Patra by user ID and Patra ID
router.get('/user/:userId/patra/:patraId', patraController.getPatraByUserIdAndPatraId);

// Update letter status only (ADD THIS BEFORE THE GENERAL UPDATE ROUTE)
router.put('/:id/status', patraController.updateLetterStatus);

// Update a Patra by ID
router.put('/:id', patraController.updatePatraById);

// Delete a Patra by ID
router.delete('/:id', patraController.deletePatraById);

module.exports = router;