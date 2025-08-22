// routes/coveringLetterRoutes.js - Enhanced with Word Document Support
const express = require('express');
const multer = require('multer'); // ✅ ADD THIS LINE
const router = express.Router();
const CoveringLetterController = require('../controllers/coveringLetterController');
const { uploadSingle } = require('../controllers/coveringLetterController');
const { authenticateToken } = require('../middleware/auth');

// Create controller instance
const coveringLetterController = new CoveringLetterController();

// ===== COVERING LETTER MANAGEMENT ROUTES =====

// GET all covering letters with pagination and filtering
router.get('/', authenticateToken, coveringLetterController.getAllCoveringLetters.bind(coveringLetterController));

// GET covering letter by ID
router.get('/:id', authenticateToken, coveringLetterController.getCoveringLetterById.bind(coveringLetterController));

// GET covering letter by Patra ID
router.get('/patra/:patraId', authenticateToken, coveringLetterController.getCoveringLetterByPatraId.bind(coveringLetterController));

// ✅ NEW: GET covering letter for editing (returns editable HTML template)
router.get('/:id/edit', authenticateToken, coveringLetterController.getCoveringLetterForEdit.bind(coveringLetterController));

// POST generate new covering letter automatically
router.post('/generate', authenticateToken, coveringLetterController.generateCoveringLetter.bind(coveringLetterController));

// POST upload covering letter file (PDF only)
router.post('/upload', authenticateToken, uploadSingle, coveringLetterController.uploadCoveringLetter.bind(coveringLetterController));

// ✅ NEW: PUT update covering letter content and regenerate all documents
router.put('/update-content/:id', authenticateToken, coveringLetterController.updateCoveringLetterContent.bind(coveringLetterController));

// PUT simple update covering letter (backward compatibility)
router.put('/:id', authenticateToken, coveringLetterController.updateCoveringLetter.bind(coveringLetterController));

// DELETE covering letter and all associated files
router.delete('/:id', authenticateToken, coveringLetterController.deleteCoveringLetter.bind(coveringLetterController));

// ===== DOCUMENT GENERATION ROUTES =====

// ✅ NEW: POST generate Word document for existing covering letter
router.post('/:id/generate-word', authenticateToken, coveringLetterController.generateWordDocument.bind(coveringLetterController));

// ===== DOWNLOAD ROUTES =====

// GET download PDF
router.get('/download/:id', authenticateToken, coveringLetterController.downloadCoveringLetter.bind(coveringLetterController));

// ✅ NEW: GET download Word document
router.get('/download/:id/word', authenticateToken, coveringLetterController.downloadCoveringLetterWord.bind(coveringLetterController));

// GET view HTML version
router.get('/view/:id', authenticateToken, coveringLetterController.viewCoveringLetterHTML.bind(coveringLetterController));

// ✅ ENHANCED: GET preview URLs (returns all available format URLs including Word)
router.get('/preview/:id', authenticateToken, coveringLetterController.previewCoveringLetter.bind(coveringLetterController));



module.exports = router;