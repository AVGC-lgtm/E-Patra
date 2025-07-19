// routes/headRoutes.js - Complete signature upload routes

const express = require('express');
const router = express.Router();
const headController = require('../controllers/headController');

// Import the upload middleware from controller
const { upload, uploadSignatureAndSignLetter, getHeadsByCoveringLetter, getHeadsByUser, updateHeadStatus, deleteHead } = headController;

// POST: Upload signature and sign covering letter
// Form field name should be 'signature'
router.post('/upload-signature/:coveringLetterId', 
  upload.single('signature'), // 'signature' is the form field name
  uploadSignatureAndSignLetter
);

// GET: Get all signatures for a covering letter
router.get('/covering-letter/:coveringLetterId', getHeadsByCoveringLetter);

// GET: Get all signatures by user (with pagination)
router.get('/user/:userId', getHeadsByUser);

// PUT: Update signature status
router.put('/:id/status', updateHeadStatus);

// DELETE: Delete signature
router.delete('/:id', deleteHead);

module.exports = router;
