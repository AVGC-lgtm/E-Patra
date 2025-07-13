// routes/InwardPatraRoutes.js
const express = require('express');
const patraController = require('../controllers/InwardPatraController');
const { uploadMultiple, handleUploadError } = require('../middleware/upload');
const router = express.Router();

// Create a new Patra with file upload
router.post('/', uploadMultiple, handleUploadError, patraController.createPatra);

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

// Update a Patra by ID with complete file management
router.put('/:id', uploadMultiple, handleUploadError, patraController.updatePatraById);

// Delete a Patra by ID
router.delete('/:id', patraController.deletePatraById);

module.exports = router;