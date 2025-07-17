// routes/coveringLetterRoutes.js - Updated with new edit functionality
const express = require('express');
const coveringLetterController = require('../controllers/coveringLetterController');
const router = express.Router();

// Get all covering letters
router.get('/', coveringLetterController.getAllCoveringLetters);

// Get covering letter by Patra ID
router.get('/patra/:patraId', coveringLetterController.getCoveringLetterByPatraId);

// NEW: Get covering letter for editing - returns editable HTML template
router.get('/edit/:id', coveringLetterController.getCoveringLetterForEdit);

// NEW: Update covering letter content and regenerate PDF
router.put('/update-content/:id', coveringLetterController.updateCoveringLetterContent);

// Download covering letter as PDF from S3
router.get('/download/:id', coveringLetterController.downloadCoveringLetter);

// View covering letter as HTML
router.get('/view/:id', coveringLetterController.viewCoveringLetterHTML);

// View PDF preview
router.get('/preview/:id', coveringLetterController.previewCoveringLetter);

// Get covering letter by ID
router.get('/:id', coveringLetterController.getCoveringLetterById);

// Manually generate covering letter
router.post('/generate', coveringLetterController.generateCoveringLetter);

// LEGACY: Update covering letter (maintained for backward compatibility)
router.put('/:id', coveringLetterController.updateCoveringLetter);

// Delete covering letter
router.delete('/:id', coveringLetterController.deleteCoveringLetter);

module.exports = router;