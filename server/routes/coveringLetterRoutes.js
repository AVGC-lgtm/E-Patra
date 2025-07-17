// routes/coveringLetterRoutes.js
const express = require('express');
const coveringLetterController = require('../controllers/coveringLetterController');
const router = express.Router();

// Get all covering letters
router.get('/', coveringLetterController.getAllCoveringLetters);

// Get covering letter by Patra ID
router.get('/patra/:patraId', coveringLetterController.getCoveringLetterByPatraId);

// Download covering letter as PDF from S3
router.get('/download/:id', coveringLetterController.downloadCoveringLetter);

// View covering letter as HTML
router.get('/view/:id', coveringLetterController.viewCoveringLetterHTML);

// Get covering letter by ID
router.get('/:id', coveringLetterController.getCoveringLetterById);

// Manually generate covering letter
router.post('/generate', coveringLetterController.generateCoveringLetter);

// Update covering letter
router.put('/:id', coveringLetterController.updateCoveringLetter);

// Delete covering letter
router.delete('/:id', coveringLetterController.deleteCoveringLetter);

module.exports = router;