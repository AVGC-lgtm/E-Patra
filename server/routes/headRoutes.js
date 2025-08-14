// routes/headRoutes.js - Complete signature upload routes

const express = require('express');
const router = express.Router();
const headController = require('../controllers/headController');

// Import the upload middleware from controller
const { 
  upload, 
  uploadToS3,
  uploadSignatureAndSignLetter, 
  uploadHeadSignature,
  getHeadSignature,
  deleteHeadSignature,
  getHeadsByCoveringLetter, 
  getHeadsByUser, 
  updateHeadStatus, 
  deleteHead 
} = headController;

// ✅ NEW: Upload signature for Head users (S3 upload)
router.put('/upload-head-signature', 
  uploadToS3.single('sign'), // 'sign' is the form field name
  uploadHeadSignature
);

// ✅ NEW: Get user's uploaded signature
router.get('/head-signature/:userId', getHeadSignature);

// ✅ NEW: Delete head signature
router.delete('/delete-head-signature', deleteHeadSignature);

// POST: Upload signature and sign covering letter (no file upload required)
router.post('/upload-signature/:coveringLetterId', uploadSignatureAndSignLetter);

// GET: Get all signatures for a covering letter
router.get('/covering-letter/:coveringLetterId', getHeadsByCoveringLetter);

// GET: Get all signatures by user (with pagination)
router.get('/user/:userId', getHeadsByUser);

// PUT: Update signature status
router.put('/:id/status', updateHeadStatus);

// DELETE: Delete signature
router.delete('/:id', deleteHead);

module.exports = router;
