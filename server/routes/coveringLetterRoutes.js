// routes/coveringLetterRoutes.js - Enhanced with Word Document Support
const express = require('express');
const router = express.Router();
const CoveringLetterController = require('../controllers/coveringLetterController');
const { uploadSingle } = require('../controllers/coveringLetterController');
const { authenticateToken } = require('../middleware/auth');

// Create controller instance
const coveringLetterController = new CoveringLetterController();

// ===== COVERING LETTER MANAGEMENT ROUTES =====

// GET all covering letters with pagination and filtering
router.get('/', coveringLetterController.getAllCoveringLetters.bind(coveringLetterController));

// GET covering letter by ID
router.get('/:id', coveringLetterController.getCoveringLetterById.bind(coveringLetterController));

// GET covering letter by Patra ID
router.get('/patra/:patraId', coveringLetterController.getCoveringLetterByPatraId.bind(coveringLetterController));

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
router.get('/download/:id', coveringLetterController.downloadCoveringLetter.bind(coveringLetterController));

// ✅ NEW: GET download Word document
router.get('/download/:id/word', coveringLetterController.downloadCoveringLetterWord.bind(coveringLetterController));

// GET view HTML version
router.get('/view/:id', coveringLetterController.viewCoveringLetterHTML.bind(coveringLetterController));

// ✅ ENHANCED: GET preview URLs (returns all available format URLs including Word)
router.get('/preview/:id', coveringLetterController.previewCoveringLetter.bind(coveringLetterController));

// ===== BULK OPERATIONS ROUTES =====

// POST bulk generate covering letters for multiple Patras
router.post('/bulk/generate', authenticateToken, async (req, res) => {
  try {
    const { patraIds } = req.body;
    const userId = req.user.id;
    
    if (!patraIds || !Array.isArray(patraIds) || patraIds.length === 0) {
      return res.status(400).json({ error: 'patraIds array is required' });
    }
    
    const results = [];
    const errors = [];
    
    for (const patraId of patraIds) {
      try {
        const coveringLetter = await coveringLetterController.autoGenerateCoveringLetter(patraId, userId);
        results.push({
          patraId,
          success: true,
          coveringLetterId: coveringLetter.id,
          letterNumber: coveringLetter.letterNumber,
          formats: {
            pdf: !!coveringLetter.pdfUrl,
            html: !!coveringLetter.htmlUrl,
            word: !!coveringLetter.wordUrl
          }
        });
      } catch (error) {
        errors.push({
          patraId,
          success: false,
          error: error.message
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Processed ${patraIds.length} requests with Word document support`,
      results,
      errors,
      summary: {
        total: patraIds.length,
        successful: results.length,
        failed: errors.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error in bulk generation:', error);
    res.status(500).json({ error: 'Bulk generation failed', details: error.message });
  }
});

// POST bulk delete covering letters
router.post('/bulk/delete', authenticateToken, async (req, res) => {
  try {
    const { coveringLetterIds } = req.body;
    
    if (!coveringLetterIds || !Array.isArray(coveringLetterIds) || coveringLetterIds.length === 0) {
      return res.status(400).json({ error: 'coveringLetterIds array is required' });
    }
    
    const results = [];
    const errors = [];
    
    for (const id of coveringLetterIds) {
      try {
        // Create a mock request object for the delete method
        const mockReq = { params: { id } };
        const mockRes = {
          status: (code) => ({
            json: (data) => {
              if (code === 200 && data.success) {
                results.push({ id, success: true });
              } else {
                errors.push({ id, success: false, error: data.error || 'Unknown error' });
              }
            }
          })
        };
        
        await coveringLetterController.deleteCoveringLetter(mockReq, mockRes);
      } catch (error) {
        errors.push({
          id,
          success: false,
          error: error.message
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Processed ${coveringLetterIds.length} deletion requests (including Word documents)`,
      results,
      errors,
      summary: {
        total: coveringLetterIds.length,
        successful: results.length,
        failed: errors.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error in bulk deletion:', error);
    res.status(500).json({ error: 'Bulk deletion failed', details: error.message });
  }
});

// ===== STATISTICS ROUTES =====

// GET covering letter statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const { CoveringLetter } = require('../models/associations');
    
    // Get counts by status
    const statusCounts = await CoveringLetter.findAll({
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['status']
    });
    
    // Get counts by letter type
    const typeCounts = await CoveringLetter.findAll({
      attributes: [
        'letterType',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['letterType']
    });
    
    // Get total count
    const totalCount = await CoveringLetter.count();
    
    // ✅ ENHANCED: Get format availability including Word documents
    const formatStats = await CoveringLetter.findAll({
      attributes: [
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total'],
        [require('sequelize').fn('SUM', require('sequelize').literal('CASE WHEN pdf_url IS NOT NULL THEN 1 ELSE 0 END')), 'withPdf'],
        [require('sequelize').fn('SUM', require('sequelize').literal('CASE WHEN html_url IS NOT NULL THEN 1 ELSE 0 END')), 'withHtml'],
        [require('sequelize').fn('SUM', require('sequelize').literal('CASE WHEN word_url IS NOT NULL THEN 1 ELSE 0 END')), 'withWord'],
        [require('sequelize').fn('SUM', require('sequelize').literal('CASE WHEN pdf_url IS NOT NULL AND html_url IS NOT NULL AND word_url IS NOT NULL THEN 1 ELSE 0 END')), 'withAllFormats']
      ]
    });
    
    res.status(200).json({
      success: true,
      data: {
        total: totalCount,
        byStatus: statusCounts,
        byType: typeCounts,
        formats: {
          ...formatStats[0],
          formatPercentages: {
            pdfPercentage: totalCount > 0 ? Math.round((formatStats[0].withPdf / totalCount) * 100) : 0,
            htmlPercentage: totalCount > 0 ? Math.round((formatStats[0].withHtml / totalCount) * 100) : 0,
            wordPercentage: totalCount > 0 ? Math.round((formatStats[0].withWord / totalCount) * 100) : 0,
            allFormatsPercentage: totalCount > 0 ? Math.round((formatStats[0].withAllFormats / totalCount) * 100) : 0
          }
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting statistics:', error);
    res.status(500).json({ error: 'Failed to get statistics', details: error.message });
  }
});

// ===== HEALTH CHECK ROUTES =====

// GET health check for covering letter service
router.get('/health/check', async (req, res) => {
  try {
    const { CoveringLetter } = require('../models/associations');
    const s3Service = require('../services/s3Service');
    
    // Test database connection
    const dbTest = await CoveringLetter.count();
    
    // Test S3 service functions
    const s3Test = {
      generateHTML: typeof s3Service.generateCoveringLetterHTML === 'function',
      generateWord: typeof s3Service.generateWordDocument === 'function',
      uploadToS3: typeof s3Service.uploadToS3 === 'function'
    };
    
    // Count Word documents
    const wordCount = await CoveringLetter.count({
      where: {
        wordUrl: { [require('sequelize').Op.ne]: null }
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Covering letter service is healthy with Word document support',
      checks: {
        database: dbTest >= 0 ? 'OK' : 'FAILED',
        s3Service: Object.values(s3Test).every(t => t) ? 'OK' : 'FAILED',
        wordDocuments: wordCount >= 0 ? 'OK' : 'FAILED',
        timestamp: new Date()
      },
      stats: {
        totalCoveringLetters: dbTest,
        withWordDocuments: wordCount
      }
    });
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Covering letter service health check failed',
      error: error.message
    });
  }
});

// ===== UTILITY ROUTES =====

// ✅ NEW: GET regenerate Word document for existing covering letter
router.post('/:id/regenerate-word', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const coveringLetter = await coveringLetterController.getCoveringLetterById({ params: { id } }, {
      status: (code) => ({
        json: (data) => {
          if (code !== 200) {
            return res.status(code).json(data);
          }
          
          // Generate Word document
          coveringLetterController.generateWordDocument({ params: { id } }, res);
        }
      })
    });
    
  } catch (error) {
    console.error('❌ Error regenerating Word document:', error);
    res.status(500).json({ error: 'Failed to regenerate Word document', details: error.message });
  }
});

// ✅ NEW: GET check if Word document exists
router.get('/:id/word-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { CoveringLetter } = require('../models/associations');
    
    const coveringLetter = await CoveringLetter.findByPk(id, {
      attributes: ['id', 'wordUrl', 's3WordFileName']
    });
    
    if (!coveringLetter) {
      return res.status(404).json({ error: 'Covering letter not found' });
    }
    
    res.status(200).json({
      success: true,
      hasWordDocument: !!coveringLetter.wordUrl,
      wordUrl: coveringLetter.wordUrl,
      wordFileName: coveringLetter.s3WordFileName
    });
    
  } catch (error) {
    console.error('❌ Error checking Word document status:', error);
    res.status(500).json({ error: 'Failed to check Word document status', details: error.message });
  }
});

// ===== ERROR HANDLING MIDDLEWARE =====

// Handle file upload errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        message: 'File size exceeds 10MB limit'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files',
        message: 'Only one file allowed at a time'
      });
    }
  }
  
  if (err.message === 'Only PDF files are allowed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid file type',
      message: 'Only PDF files are allowed for upload'
    });
  }
  
  console.error('❌ Unhandled error in covering letter routes:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

module.exports = router;