const express = require('express');
const { uploadAndExtract, getAllFiles, getFileById, deleteFileById, getExtractedData } = require('../controllers/fileController');
const router = express.Router();

// Upload and process PDF
router.post('/upload', uploadAndExtract);

// Get all files
router.get('/', getAllFiles);

// Get file by ID
router.route('/:id')
    .get(getFileById)
    .delete(deleteFileById);

// Get extracted data for a file
router.get('/:id/extracted-data', getExtractedData);

module.exports = router;
