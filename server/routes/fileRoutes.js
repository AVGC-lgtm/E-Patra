const express = require('express');
const { uploadAndExtract, getAllFiles, getFileById, deleteFileById, getExtractedData } = require('../controllers/fileController');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Upload and process PDF
router.post('/upload', authenticateToken, uploadAndExtract);

// Get all files
router.get('/', authenticateToken, getAllFiles);

// Get file by ID
router.route('/:id')
    .get(authenticateToken, getFileById)
    .delete(authenticateToken, deleteFileById);

// Get extracted data for a file
router.get('/:id/extracted-data', authenticateToken, getExtractedData);

module.exports = router;
