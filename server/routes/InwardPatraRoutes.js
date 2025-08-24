// routes/inwardPatraRoutes.js - Updated with OW reference number route and authentication
const express = require('express');
const patraController = require('../controllers/InwardPatraController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// ===== PATRA ROUTES =====

// Forward-to options route removed - no table forwarding needed

// Create a new Patra with auto-generated covering letter
router.post('/', authenticateToken, patraController.createPatra);

// Get all Patras with complete covering letter data (with role-based filtering)
router.get('/', authenticateToken, patraController.getAllPatras);

// Get letters specifically for Head (HOD approval)
router.get('/head', authenticateToken, patraController.getHeadLetters);

// Get Patra by reference number (MUST BE BEFORE /:id route)
router.get('/reference/:referenceNumber', authenticateToken, patraController.getPatraByReferenceNumber);

// NEW: Get Patra by OW reference number (MUST BE BEFORE /:id route)
router.get('/ow-reference/:owReferenceNumber', authenticateToken, patraController.getPatraByOwReferenceNumber);

// Get Patra by user ID
router.get('/user/:userId', authenticateToken, patraController.getPatraByUserId);

// Get Patra by user ID and Patra ID
router.get('/user/:userId/patra/:patraId', authenticateToken, patraController.getPatraByUserIdAndPatraId);

// Update letter status only (MUST BE BEFORE /:id route)
router.put('/:id/status', authenticateToken, patraController.updateLetterStatus);

// Send to HOD for approval (MUST BE BEFORE /:id route)
router.put('/:id/send-to-hod', authenticateToken, patraController.sendToHOD);

// Approve letter (HOD action) (MUST BE BEFORE /:id route)
router.put('/:id/approve', authenticateToken, patraController.approveLetter);

// Resend letter back to Inward Letters (HOD action) (MUST BE BEFORE /:id route)
router.put('/:id/resend', authenticateToken, patraController.resendLetter);

// Upload report files for completed letters (MUST BE BEFORE /:id route)
router.post('/:id/upload-report', authenticateToken, patraController.uploadReportFiles);

// Download merged PDF (covering letter + uploaded report) (MUST BE BEFORE /:id route)
router.get('/:id/download-merged', authenticateToken, patraController.mergeCoveringLetterWithReport);

// Download merged PDF (covering letter + uploaded file for extraction) (MUST BE BEFORE /:id route)
router.get('/:id/download-merged-file', authenticateToken, patraController.mergeCoveringLetterWithUploadedFile);

// Close case for letters with uploaded reports (MUST BE BEFORE /:id route)
router.put('/:id/close-case', authenticateToken, patraController.closeCase);

// Get a Patra by ID with complete covering letter data
router.get('/:id', authenticateToken, patraController.getPatraById);

// Update a Patra by ID
router.put('/:id', authenticateToken, patraController.updatePatraById);

// Delete a Patra by ID
router.delete('/:id', authenticateToken, patraController.deletePatraById);

// ===== COVERING LETTER ROUTES =====

// Get all covering letters with complete data
router.get('/covering-letters/all', authenticateToken, patraController.getAllCoveringLetters);

// Get covering letter by ID with complete data
router.get('/covering-letters/:id', authenticateToken, patraController.getCoveringLetterById);

module.exports = router;