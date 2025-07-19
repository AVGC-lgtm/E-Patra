// controllers/headController.js - Updated to handle multiple signatures properly

const { InwardPatra, CoveringLetter, User, Head } = require('../models/associations');
const s3Service = require('../services/s3Service');
const multer = require('multer');

// Simple signature processing
const processSignatureBuffer = (buffer) => {
  try {
    if (!buffer || buffer.length === 0) {
      throw new Error('Invalid buffer');
    }

    const base64 = buffer.toString('base64');
    
    if (!base64 || base64.length < 100) {
      throw new Error('Signature too small');
    }

    return {
      base64: base64,
      size: buffer.length,
      success: true
    };
  } catch (error) {
    throw new Error(`Signature processing failed: ${error.message}`);
  }
};

// Configure multer for signature uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  console.log('📁 Processing file:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  const allowedMimeTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 
    'image/gif', 'image/bmp', 'image/webp'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    console.log('✅ File type accepted:', file.mimetype);
    cb(null, true);
  } else {
    console.log('❌ File type rejected:', file.mimetype);
    cb(new Error(`Invalid file type. Allowed: ${allowedMimeTypes.join(', ')}`), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: fileFilter
});

// UPDATED: Upload signature with multiple signature support
const uploadSignatureAndSignLetter = async (req, res) => {
  console.log('🖊️ === SIGNATURE UPLOAD START ===');
  console.log('📥 Request params:', req.params);
  console.log('📥 Request body:', req.body);

  try {
    const { coveringLetterId } = req.params;
    const { 
      userId, 
      signaturePosition = 'top-right', 
      remarks = '',
      signerName 
    } = req.body;

    // Validate required fields
    if (!coveringLetterId) {
      return res.status(400).json({
        success: false,
        error: 'Covering letter ID is required'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Check file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No signature file uploaded. Please select an image file.'
      });
    }

    console.log('📁 File received:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Validate file
    if (!req.file.buffer || req.file.size === 0) {
      return res.status(400).json({
        success: false,
        error: 'Uploaded file is empty or corrupted'
      });
    }

    // Process signature
    console.log('🔄 Processing signature...');
    let signatureBase64;
    try {
      const processed = processSignatureBuffer(req.file.buffer);
      signatureBase64 = processed.base64;
      console.log('✅ Signature processed successfully, size:', processed.size);
    } catch (processingError) {
      return res.status(400).json({
        success: false,
        error: 'Failed to process signature image',
        details: processingError.message
      });
    }

    // Fetch user
    console.log('👤 Fetching user...');
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Fetch covering letter
    console.log('📄 Fetching covering letter...');
    const coveringLetter = await CoveringLetter.findByPk(coveringLetterId, {
      include: [
        {
          model: InwardPatra,
          as: 'InwardPatra',
          attributes: ['id', 'referenceNumber', 'subject']
        }
      ]
    });

    if (!coveringLetter) {
      return res.status(404).json({
        success: false,
        error: 'Covering letter not found'
      });
    }

    if (!coveringLetter.pdfUrl) {
      return res.status(400).json({
        success: false,
        error: 'Covering letter PDF not available'
      });
    }

    // FIXED: Get existing signatures for this covering letter to avoid overlap
    console.log('🔍 Checking for existing signatures...');
    const existingSignatures = await Head.findAll({
      where: { 
        coveringLetterId: coveringLetterId,
        signStatus: 'signed'
      },
      attributes: ['id', 'userId', 'signaturePosition', 'signedAt'],
      order: [['signedAt', 'ASC']]
    });

    console.log(`📊 Found ${existingSignatures.length} existing signatures`);

    // Validate signature position
    const validPositions = [
      'top-left', 'top-right', 'center', 
      'bottom-left', 'bottom-right', 'bottom-center'
    ];
    
    const finalPosition = validPositions.includes(signaturePosition) 
      ? signaturePosition 
      : 'top-right';

    // Determine signer name
    const finalSignerName = signerName || user.stationName || user.email || 'अधिकारी';

    // FIXED: Add signature to PDF with existing signature info
    console.log('🖊️ Adding signature to PDF...');
    console.log('📋 Signature details:', {
      pdfUrl: coveringLetter.pdfUrl,
      signerName: finalSignerName,
      position: finalPosition,
      existingSignatures: existingSignatures.length
    });

    let signedPdfResult;
    try {
      // Pass existing signatures to avoid overlap
      signedPdfResult = await s3Service.addSignatureToPDF(
        coveringLetter.pdfUrl,
        signatureBase64,
        finalSignerName,
        finalPosition,
        existingSignatures  // FIXED: Pass existing signatures
      );

      console.log('✅ PDF signed successfully:', {
        originalUrl: signedPdfResult.originalUrl,
        signedUrl: signedPdfResult.signedPdfUrl,
        signedBy: signedPdfResult.signedBy,
        coordinates: signedPdfResult.coordinates
      });

    } catch (signatureError) {
      console.error('❌ Failed to add signature to PDF:', signatureError);
      return res.status(500).json({
        success: false,
        error: 'Failed to add signature to PDF',
        details: signatureError.message
      });
    }

    // Check for existing head entry for this user
    let headEntry = await Head.findOne({
      where: {
        coveringLetterId: coveringLetterId,
        userId: userId
      }
    });

    const currentTime = new Date();
    
    if (headEntry) {
      console.log('🔄 Updating existing head entry...');
      await headEntry.update({
        signStatus: 'signed',
        signedAt: currentTime,
        remarks: remarks,
        signaturePosition: finalPosition
      });
      console.log('✅ Head entry updated');
    } else {
      console.log('➕ Creating new head entry...');
      headEntry = await Head.create({
        patraId: coveringLetter.patraId,
        userId: userId,
        coveringLetterId: coveringLetterId,
        signStatus: 'signed',
        signedAt: currentTime,
        remarks: remarks,
        signaturePosition: finalPosition
      });
      console.log('✅ New head entry created:', headEntry.id);
    }

    // Update covering letter with new signed PDF URL
    console.log('🔄 Updating covering letter...');
    try {
      await coveringLetter.update({
        pdfUrl: signedPdfResult.signedPdfUrl
      });
      console.log('✅ Covering letter updated with signed PDF');
    } catch (updateError) {
      console.warn('⚠️ Could not update covering letter:', updateError.message);
    }

    // Prepare response with detailed signature info
    const responseData = {
      success: true,
      message: 'Signature uploaded and covering letter signed successfully',
      data: {
        headEntry: {
          id: headEntry.id,
          signStatus: headEntry.signStatus,
          signedAt: headEntry.signedAt,
          signaturePosition: headEntry.signaturePosition,
          remarks: headEntry.remarks
        },
        coveringLetter: {
          id: coveringLetter.id,
          letterNumber: coveringLetter.letterNumber,
          status: coveringLetter.status,
          signedPdfUrl: signedPdfResult.signedPdfUrl
        },
        signature: {
          signedBy: finalSignerName,
          signedAt: currentTime,
          position: finalPosition,
          coordinates: signedPdfResult.coordinates,
          originalFileName: req.file.originalname,
          sequenceNumber: existingSignatures.length + 1 // Position in signature sequence
        },
        existingSignatures: {
          count: existingSignatures.length,
          list: existingSignatures.map(sig => ({
            userId: sig.userId,
            position: sig.signaturePosition,
            signedAt: sig.signedAt
          }))
        },
        inwardPatra: coveringLetter.InwardPatra ? {
          id: coveringLetter.InwardPatra.id,
          referenceNumber: coveringLetter.InwardPatra.referenceNumber,
          subject: coveringLetter.InwardPatra.subject
        } : null
      }
    };

    console.log('🎉 Signature upload completed successfully');
    return res.status(200).json(responseData);

  } catch (error) {
    console.error('💥 === ERROR IN SIGNATURE UPLOAD ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error occurred during signature upload',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Get all signatures for a covering letter with position details
const getHeadsByCoveringLetter = async (req, res) => {
  try {
    const { coveringLetterId } = req.params;

    console.log('📋 Fetching signatures for covering letter:', coveringLetterId);

    if (!coveringLetterId) {
      return res.status(400).json({
        success: false,
        error: 'Covering letter ID is required'
      });
    }

    const heads = await Head.findAll({
      where: { coveringLetterId },
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'email', 'stationName']
        },
        {
          model: InwardPatra,
          as: 'InwardPatra',
          attributes: ['id', 'referenceNumber', 'subject']
        },
        {
          model: CoveringLetter,
          as: 'CoveringLetter',
          attributes: ['id', 'letterNumber', 'status', 'pdfUrl']
        }
      ],
      order: [['signedAt', 'ASC'], ['createdAt', 'ASC']] // Order by signing sequence
    });

    // Add sequence numbers
    const signaturesWithSequence = heads.map((head, index) => ({
      ...head.toJSON(),
      sequenceNumber: index + 1,
      signedOrder: head.signedAt ? index + 1 : null
    }));

    console.log(`✅ Found ${heads.length} signatures`);

    return res.status(200).json({
      success: true,
      message: 'Signatures retrieved successfully',
      data: {
        coveringLetterId,
        count: heads.length,
        signatures: signaturesWithSequence,
        summary: {
          signed: heads.filter(h => h.signStatus === 'signed').length,
          pending: heads.filter(h => h.signStatus === 'pending').length,
          rejected: heads.filter(h => h.signStatus === 'rejected').length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching signatures:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch signatures',
      details: error.message
    });
  }
};

// Get all signatures by user
const getHeadsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const offset = (page - 1) * limit;
    const whereClause = { userId };
    
    if (status) {
      whereClause.signStatus = status;
    }

    const { rows: heads, count } = await Head.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'email', 'stationName']
        },
        {
          model: InwardPatra,
          as: 'InwardPatra',
          attributes: ['id', 'referenceNumber', 'subject']
        },
        {
          model: CoveringLetter,
          as: 'CoveringLetter',
          attributes: ['id', 'letterNumber', 'status', 'pdfUrl']
        }
      ],
      order: [['signedAt', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return res.status(200).json({
      success: true,
      message: 'User signatures retrieved successfully',
      data: {
        userId,
        count,
        signatures: heads,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user signatures:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user signatures',
      details: error.message
    });
  }
};

// Update signature status
const updateHeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { signStatus, remarks } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Signature ID is required'
      });
    }

    const headEntry = await Head.findByPk(id);
    if (!headEntry) {
      return res.status(404).json({
        success: false,
        error: 'Signature not found'
      });
    }

    const updateData = {};
    
    if (signStatus !== undefined) {
      const validStatuses = ['pending', 'signed', 'rejected'];
      if (!validStatuses.includes(signStatus)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }
      
      updateData.signStatus = signStatus;
      
      if (signStatus === 'signed') {
        updateData.signedAt = new Date();
      }
    }
    
    if (remarks !== undefined) {
      updateData.remarks = remarks;
    }

    await headEntry.update(updateData);

    const updatedHead = await Head.findByPk(id, {
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'email', 'stationName']
        },
        {
          model: CoveringLetter,
          as: 'CoveringLetter',
          attributes: ['id', 'letterNumber', 'status']
        }
      ]
    });

    return res.status(200).json({
      success: true,
      message: 'Signature status updated successfully',
      data: updatedHead
    });

  } catch (error) {
    console.error('Error updating signature status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update signature status',
      details: error.message
    });
  }
};

// Delete signature
const deleteHead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Signature ID is required'
      });
    }

    const headEntry = await Head.findByPk(id);
    if (!headEntry) {
      return res.status(404).json({
        success: false,
        error: 'Signature not found'
      });
    }

    await headEntry.destroy();

    return res.status(200).json({
      success: true,
      message: 'Signature deleted successfully',
      data: {
        deletedId: id,
        deletedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error deleting signature:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete signature',
      details: error.message
    });
  }
};

module.exports = {
  upload,
  uploadSignatureAndSignLetter,
  getHeadsByCoveringLetter,
  getHeadsByUser,
  updateHeadStatus,
  deleteHead
};