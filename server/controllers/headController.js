// controllers/headController.js - FINAL FIXED VERSION

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

    const dataUrl = `data:image/png;base64,${base64}`;

    return {
      base64: base64,
      dataUrl: dataUrl,
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

// ✅ FINAL FIXED SIGNATURE UPLOAD FUNCTION
// const uploadSignatureAndSignLetter = async (req, res) => {
//   console.log('🖊️ === SIGNATURE UPLOAD START ===');
//   console.log('📥 Request params:', req.params);
//   console.log('📥 Request body:', req.body);

//   try {
//     const { coveringLetterId } = req.params;
//     const { 
//       userId, 
//       signaturePosition = 'top-right', // ✅ FIXED: Use valid enum value
//       remarks = '',
//       signerName 
//     } = req.body;

//     // Validate required fields
//     if (!coveringLetterId) {
//       return res.status(400).json({
//         success: false,
//         error: 'Covering letter ID is required'
//       });
//     }

//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         error: 'User ID is required'
//       });
//     }

//     // Check file upload
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         error: 'No signature file uploaded. Please select an image file.'
//       });
//     }

//     console.log('📁 File received:', {
//       originalname: req.file.originalname,
//       mimetype: req.file.mimetype,
//       size: req.file.size
//     });

//     // Validate file
//     if (!req.file.buffer || req.file.size === 0) {
//       return res.status(400).json({
//         success: false,
//         error: 'Uploaded file is empty or corrupted'
//       });
//     }

//     // Process signature
//     console.log('🔄 Processing signature...');
//     let signatureData;
//     try {
//       signatureData = processSignatureBuffer(req.file.buffer);
//       console.log('✅ Signature processed successfully, size:', signatureData.size);
//     } catch (processingError) {
//       return res.status(400).json({
//         success: false,
//         error: 'Failed to process signature image',
//         details: processingError.message
//       });
//     }

//     // Fetch user
//     console.log('👤 Fetching user...');
//     const user = await User.findByPk(userId);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         error: 'User not found'
//       });
//     }

//     // Fetch covering letter with minimal InwardPatra fields
//     console.log('📄 Fetching covering letter...');
//     const coveringLetter = await CoveringLetter.findByPk(coveringLetterId, {
//       include: [
//         {
//           model: InwardPatra,
//           as: 'InwardPatra',
//           attributes: ['id', 'referenceNumber', 'subject']
//         }
//       ]
//     });

//     if (!coveringLetter) {
//       return res.status(404).json({
//         success: false,
//         error: 'Covering letter not found'
//       });
//     }

//     if (!coveringLetter.letterContent) {
//       return res.status(400).json({
//         success: false,
//         error: 'Covering letter content not available'
//       });
//     }

//     console.log('📋 Covering letter found:', {
//       id: coveringLetter.id,
//       letterNumber: coveringLetter.letterNumber,
//       letterType: coveringLetter.letterType,
//       status: coveringLetter.status,
//       hasContent: !!coveringLetter.letterContent
//     });

//     // ✅ FIXED: Always use Marathi text as default, ignore user.stationName
//     const finalSignerName = signerName || 'अर्ज शाखा प्रभारी अधिकारी';
    
//     console.log('👤 Final signer name:', finalSignerName);

//     // Prepare minimal letter data
//     console.log('📋 Preparing minimal letter data...');
//     const letterData = {
//       patraId: coveringLetter.patraId,
//       letterNumber: coveringLetter.letterNumber || `CL/${coveringLetter.id}/${new Date().getFullYear()}`,
//       letterType: coveringLetter.letterType || 'NAR',
//       extractedText: null,
//       complainantName: null,
//       senderName: null
//     };

//     console.log('📋 Letter data prepared:', letterData);

//     // Generate signed documents (both PDF and Word)
//     console.log('🖊️ Generating signed documents...');
//     let signedDocumentsResult;
//     try {
//       signedDocumentsResult = await s3Service.generateAndUploadSignedCoveringLetter(
//         coveringLetter.letterContent,
//         letterData,
//         signatureData.dataUrl,
//         finalSignerName
//       );

//       console.log('✅ Signed documents generated successfully:', {
//         pdfUrl: signedDocumentsResult.pdfUrl,
//         wordUrl: signedDocumentsResult.wordUrl,
//         signedBy: signedDocumentsResult.signedBy
//       });

//     } catch (documentError) {
//       console.error('❌ Failed to generate signed documents:', documentError);
//       return res.status(500).json({
//         success: false,
//         error: 'Failed to generate signed documents',
//         details: documentError.message
//       });
//     }

//     // ✅ FIXED: Map position values to valid enum values
//     const mapSignaturePosition = (position) => {
//       const positionMap = {
//         'above': 'top-right',
//         'below': 'bottom-right', 
//         'top': 'top-right',
//         'bottom': 'bottom-right',
//         'left': 'bottom-left',
//         'right': 'bottom-right',
//         'center': 'center'
//       };
      
//       // Valid enum values from your Head model
//       const validPositions = [
//         'bottom-right', 'bottom-left', 'bottom-center', 
//         'top-right', 'top-left', 'center'
//       ];
      
//       // If position is already valid, use it
//       if (validPositions.includes(position)) {
//         return position;
//       }
      
//       // Otherwise map it
//       return positionMap[position] || 'top-right';
//     };

//     const validSignaturePosition = mapSignaturePosition(signaturePosition);
//     console.log('📍 Mapped signature position:', signaturePosition, '->', validSignaturePosition);

//     // Check for existing head entry for this user
//     let headEntry = await Head.findOne({
//       where: {
//         coveringLetterId: coveringLetterId,
//         userId: userId
//       }
//     });

//     const currentTime = new Date();
    
//     if (headEntry) {
//       console.log('🔄 Updating existing head entry...');
//       await headEntry.update({
//         signStatus: 'signed',
//         signedAt: currentTime,
//         remarks: remarks,
//         signaturePosition: validSignaturePosition // ✅ FIXED: Use valid enum value
//       });
//       console.log('✅ Head entry updated');
//     } else {
//       console.log('➕ Creating new head entry...');
//       headEntry = await Head.create({
//         patraId: coveringLetter.patraId,
//         userId: userId,
//         coveringLetterId: coveringLetterId,
//         signStatus: 'signed',
//         signedAt: currentTime,
//         remarks: remarks,
//         signaturePosition: validSignaturePosition // ✅ FIXED: Use valid enum value
//       });
//       console.log('✅ New head entry created:', headEntry.id);
//     }

//     // Update covering letter with signed documents
//     console.log('🔄 Updating covering letter with signed documents...');
//     try {
//       const updateData = {
//         pdfUrl: signedDocumentsResult.pdfUrl,
//         wordUrl: signedDocumentsResult.wordUrl
//       };

//       if (coveringLetter.status !== 'SENT') {
//         updateData.status = 'SENT'; // Use existing enum value
//       }

//       await coveringLetter.update(updateData);
//       console.log('✅ Covering letter updated with signed documents');
//     } catch (updateError) {
//       console.warn('⚠️ Could not update covering letter:', updateError.message);
//     }

//     // Get existing signatures for response
//     const existingSignatures = await Head.findAll({
//       where: { 
//         coveringLetterId: coveringLetterId,
//         signStatus: 'signed',
//         id: { [require('sequelize').Op.ne]: headEntry.id }
//       },
//       attributes: ['id', 'userId', 'signaturePosition', 'signedAt'],
//       order: [['signedAt', 'ASC']]
//     });

//     // Response with correct data
//     const responseData = {
//       success: true,
//       message: 'Signature uploaded and documents signed successfully',
//       data: {
//         headEntry: {
//           id: headEntry.id,
//           signStatus: headEntry.signStatus,
//           signedAt: headEntry.signedAt,
//           signaturePosition: headEntry.signaturePosition,
//           remarks: headEntry.remarks
//         },
//         coveringLetter: {
//           id: coveringLetter.id,
//           letterNumber: coveringLetter.letterNumber,
//           letterType: coveringLetter.letterType,
//           status: coveringLetter.status,
//           signedPdfUrl: signedDocumentsResult.pdfUrl,
//           signedWordUrl: signedDocumentsResult.wordUrl
//         },
//         signature: {
//           signedBy: finalSignerName, // ✅ FIXED: Will show correct Marathi name
//           signedAt: currentTime,
//           position: validSignaturePosition,
//           originalFileName: req.file.originalname,
//           sequenceNumber: existingSignatures.length + 1
//         },
//         documents: {
//           pdf: {
//             url: signedDocumentsResult.pdfUrl,
//             fileName: signedDocumentsResult.fileName,
//             signed: true
//           },
//           word: {
//             url: signedDocumentsResult.wordUrl,
//             fileName: signedDocumentsResult.wordFileName,
//             signed: true
//           },
//           html: {
//             url: signedDocumentsResult.htmlUrl,
//             fileName: signedDocumentsResult.htmlFileName,
//             signed: true
//           }
//         },
//         existingSignatures: {
//           count: existingSignatures.length,
//           list: existingSignatures.map(sig => ({
//             userId: sig.userId,
//             position: sig.signaturePosition,
//             signedAt: sig.signedAt
//           }))
//         },
//         inwardPatra: coveringLetter.InwardPatra ? {
//           id: coveringLetter.InwardPatra.id,
//           referenceNumber: coveringLetter.InwardPatra.referenceNumber,
//           subject: coveringLetter.InwardPatra.subject
//         } : null
//       }
//     };

//     console.log('🎉 Signature upload completed successfully');
//     return res.status(200).json(responseData);

//   } catch (error) {
//     console.error('💥 === ERROR IN SIGNATURE UPLOAD ===');
//     console.error('Error message:', error.message);
//     console.error('Error stack:', error.stack);
    
//     return res.status(500).json({
//       success: false,
//       error: 'Internal server error occurred during signature upload',
//       details: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// };

// Updated uploadSignatureAndSignLetter function in controller - FIXED LETTER NUMBER

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
    let signatureData;
    try {
      signatureData = processSignatureBuffer(req.file.buffer);
      console.log('✅ Signature processed successfully, size:', signatureData.size);
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

    // Fetch covering letter with minimal InwardPatra fields
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

    if (!coveringLetter.letterContent) {
      return res.status(400).json({
        success: false,
        error: 'Covering letter content not available'
      });
    }

    console.log('📋 Covering letter found:', {
      id: coveringLetter.id,
      letterNumber: coveringLetter.letterNumber,
      letterType: coveringLetter.letterType,
      status: coveringLetter.status,
      hasContent: !!coveringLetter.letterContent
    });

    // ✅ FIXED: Always use Marathi text as default, ignore user.stationName
    const finalSignerName = signerName || 'अर्ज शाखा प्रभारी अधिकारी';
    
    console.log('👤 Final signer name:', finalSignerName);

    // ✅ FIXED: Generate clean letter number without double year
    const generateCleanLetterNumber = (letterNumber, patraId) => {
      if (letterNumber) {
        // If letterNumber already exists, use it but clean it
        return letterNumber.replace(/\/\d{4}\/\d{4}$/, ''); // Remove /YYYY/YYYY pattern
      } else {
        // Generate new clean format
        return `CL/${patraId}`;
      }
    };

    const cleanLetterNumber = generateCleanLetterNumber(coveringLetter.letterNumber, coveringLetter.patraId);
    
    // Prepare minimal letter data with clean letter number
    console.log('📋 Preparing minimal letter data...');
    const letterData = {
      patraId: coveringLetter.patraId,
      letterNumber: cleanLetterNumber, // ✅ Use clean format
      letterType: coveringLetter.letterType || 'NAR',
      extractedText: null,
      complainantName: null,
      senderName: null
    };

    console.log('📋 Letter data prepared:', letterData);

    // Generate signed documents (both PDF and Word)
    console.log('🖊️ Generating signed documents...');
    let signedDocumentsResult;
    try {
      signedDocumentsResult = await s3Service.generateAndUploadSignedCoveringLetter(
        coveringLetter.letterContent,
        letterData,
        signatureData.dataUrl,
        finalSignerName
      );

      console.log('✅ Signed documents generated successfully:', {
        pdfUrl: signedDocumentsResult.pdfUrl,
        wordUrl: signedDocumentsResult.wordUrl,
        signedBy: signedDocumentsResult.signedBy
      });

    } catch (documentError) {
      console.error('❌ Failed to generate signed documents:', documentError);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate signed documents',
        details: documentError.message
      });
    }

    // Map position values to valid enum values
    const mapSignaturePosition = (position) => {
      const positionMap = {
        'above': 'top-right',
        'below': 'bottom-right', 
        'top': 'top-right',
        'bottom': 'bottom-right',
        'left': 'bottom-left',
        'right': 'bottom-right',
        'center': 'center'
      };
      
      const validPositions = [
        'bottom-right', 'bottom-left', 'bottom-center', 
        'top-right', 'top-left', 'center'
      ];
      
      if (validPositions.includes(position)) {
        return position;
      }
      
      return positionMap[position] || 'top-right';
    };

    const validSignaturePosition = mapSignaturePosition(signaturePosition);
    console.log('📍 Mapped signature position:', signaturePosition, '->', validSignaturePosition);

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
        signaturePosition: validSignaturePosition
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
        signaturePosition: validSignaturePosition
      });
      console.log('✅ New head entry created:', headEntry.id);
    }

    // Update covering letter with signed documents
    console.log('🔄 Updating covering letter with signed documents...');
    try {
      const updateData = {
        pdfUrl: signedDocumentsResult.pdfUrl,
        wordUrl: signedDocumentsResult.wordUrl
      };

      if (coveringLetter.status !== 'SENT') {
        updateData.status = 'SENT';
      }

      await coveringLetter.update(updateData);
      console.log('✅ Covering letter updated with signed documents');
    } catch (updateError) {
      console.warn('⚠️ Could not update covering letter:', updateError.message);
    }

    // Get existing signatures for response
    const existingSignatures = await Head.findAll({
      where: { 
        coveringLetterId: coveringLetterId,
        signStatus: 'signed',
        id: { [require('sequelize').Op.ne]: headEntry.id }
      },
      attributes: ['id', 'userId', 'signaturePosition', 'signedAt'],
      order: [['signedAt', 'ASC']]
    });

    // Response with correct data
    const responseData = {
      success: true,
      message: 'Signature uploaded and documents signed successfully',
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
          letterNumber: cleanLetterNumber, // ✅ Return clean letter number
          letterType: coveringLetter.letterType,
          status: coveringLetter.status,
          signedPdfUrl: signedDocumentsResult.pdfUrl,
          signedWordUrl: signedDocumentsResult.wordUrl
        },
        signature: {
          signedBy: finalSignerName,
          signedAt: currentTime,
          position: validSignaturePosition,
          originalFileName: req.file.originalname,
          sequenceNumber: existingSignatures.length + 1
        },
        documents: {
          pdf: {
            url: signedDocumentsResult.pdfUrl,
            fileName: signedDocumentsResult.fileName,
            signed: true
          },
          word: {
            url: signedDocumentsResult.wordUrl,
            fileName: signedDocumentsResult.wordFileName,
            signed: true
          },
          html: {
            url: signedDocumentsResult.htmlUrl,
            fileName: signedDocumentsResult.htmlFileName,
            signed: true
          }
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

// Other methods remain the same...
const getHeadsByCoveringLetter = async (req, res) => {
  try {
    const { coveringLetterId } = req.params;

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
          attributes: ['id', 'letterNumber', 'letterType', 'status', 'pdfUrl', 'wordUrl']
        }
      ],
      order: [['signedAt', 'ASC'], ['createdAt', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      message: 'Signatures retrieved successfully',
      data: {
        coveringLetterId,
        count: heads.length,
        signatures: heads
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

const getHeadsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const heads = await Head.findAll({
      where: { userId },
      include: [
        {
          model: CoveringLetter,
          as: 'CoveringLetter',
          attributes: ['id', 'letterNumber', 'letterType', 'status']
        }
      ],
      order: [['signedAt', 'DESC'], ['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      message: 'User signatures retrieved successfully',
      data: {
        userId,
        count: heads.length,
        signatures: heads
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

    return res.status(200).json({
      success: true,
      message: 'Signature status updated successfully',
      data: headEntry
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