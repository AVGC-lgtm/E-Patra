const express = require('express');
const router = express.Router();
const CoveringLetterController = require('../controllers/coveringLetterController');
const { uploadSingle } = require('../controllers/coveringLetterController');
const { authenticateToken } = require('../middleware/auth');

// Create controller instance
const coveringLetterController = new CoveringLetterController();

// Download covering letter as PDF from S3
router.get('/download/:id', coveringLetterController.downloadCoveringLetter.bind(coveringLetterController));

// View covering letter as HTML
router.get('/view/:id', coveringLetterController.viewCoveringLetterHTML.bind(coveringLetterController));

// Get covering letter by Patra ID
router.get('/patra/:patraId', coveringLetterController.getCoveringLetterByPatraId.bind(coveringLetterController));

// Manually generate covering letter
router.post('/generate', authenticateToken, coveringLetterController.generateCoveringLetter.bind(coveringLetterController));

// Get all covering letters
router.get('/', coveringLetterController.getAllCoveringLetters.bind(coveringLetterController));

// Get covering letter by ID
router.get('/:id', coveringLetterController.getCoveringLetterById.bind(coveringLetterController));

// Upload covering letter file - Only creates new, no replace
router.post('/upload', authenticateToken, uploadSingle, coveringLetterController.uploadCoveringLetter.bind(coveringLetterController));

// Delete covering letter with S3 cleanup
router.delete('/:id', authenticateToken, coveringLetterController.deleteCoveringLetter.bind(coveringLetterController));

// View covering letter PDF preview
router.get('/preview/:id', coveringLetterController.previewCoveringLetter.bind(coveringLetterController));

// Simple update covering letter (for backward compatibility)
router.put('/:id', authenticateToken, coveringLetterController.updateCoveringLetter.bind(coveringLetterController));

module.exports = router;