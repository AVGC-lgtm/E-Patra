// routes/inwardPatraRoutes.js - Updated with OW reference number route and authentication
const express = require('express');
const patraController = require('../controllers/InwardPatraController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// ===== PATRA ROUTES =====

// Get forward-to options (utility route - MUST BE BEFORE other routes)
router.get('/forward-to-options', patraController.getForwardToOptions);

// Create a new Patra with auto-generated covering letter
router.post('/', patraController.createPatra);

// Get all Patras with complete covering letter data (with role-based filtering)
router.get('/', authenticateToken, patraController.getAllPatras);

// Get letters specifically for Head (HOD approval)
router.get('/head', authenticateToken, patraController.getHeadLetters);

// Get Patra by reference number (MUST BE BEFORE /:id route)
router.get('/reference/:referenceNumber', patraController.getPatraByReferenceNumber);

// NEW: Get Patra by OW reference number (MUST BE BEFORE /:id route)
router.get('/ow-reference/:owReferenceNumber', patraController.getPatraByOwReferenceNumber);

// Get Patra by user ID
router.get('/user/:userId', patraController.getPatraByUserId);

// Get Patra by user ID and Patra ID
router.get('/user/:userId/patra/:patraId', patraController.getPatraByUserIdAndPatraId);

// Update letter status only (MUST BE BEFORE /:id route)
router.put('/:id/status', patraController.updateLetterStatus);

// Send to HOD for approval (MUST BE BEFORE /:id route)
router.put('/:id/send-to-hod', patraController.sendToHOD);

// Approve letter (HOD action) (MUST BE BEFORE /:id route)
router.put('/:id/approve', patraController.approveLetter);

// Resend letter back to Inward Letters (HOD action) (MUST BE BEFORE /:id route)
router.put('/:id/resend', patraController.resendLetter);

// Upload report files for completed letters (MUST BE BEFORE /:id route)
router.post('/:id/upload-report', authenticateToken, patraController.uploadReportFiles);

// Close case for letters with uploaded reports (MUST BE BEFORE /:id route)
router.put('/:id/close-case', authenticateToken, patraController.closeCase);

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