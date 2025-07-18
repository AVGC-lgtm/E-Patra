const express = require('express');
const patraController = require('../controllers/InwardPatraController');
const router = express.Router();

// ===== PATRA ROUTES =====

// Create a new Patra with auto-generated covering letter
router.post('/', patraController.createPatra);

// Get all Patras with complete covering letter data
router.get('/', patraController.getAllPatras);

// Get Patra by reference number (MUST BE BEFORE /:id route)
router.get('/reference/:referenceNumber', patraController.getPatraByReferenceNumber);

// Get Patra by user ID
router.get('/user/:userId', patraController.getPatraByUserId);

// Get Patra by user ID and Patra ID
router.get('/user/:userId/patra/:patraId', patraController.getPatraByUserIdAndPatraId);

// Update letter status only (MUST BE BEFORE /:id route)
router.put('/:id/status', patraController.updateLetterStatus);

// Get a Patra by ID with complete covering letter data
router.get('/:id', patraController.getPatraById);

// Update a Patra by ID
router.put('/:id', patraController.updatePatraById);

// Delete a Patra by ID
router.delete('/:id', patraController.deletePatraById);

// ===== COVERING LETTER ROUTES =====

// Get all covering letters with complete data
router.get('/covering-letters/all', patraController.getAllCoveringLetters);

// Get covering letter by ID with complete data
router.get('/covering-letters/:id', patraController.getCoveringLetterById);

module.exports = router;