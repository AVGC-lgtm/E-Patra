// controllers/coveringLetterController.js - COMPLETE UPDATED VERSION
const { InwardPatra, CoveringLetter, User, File, Head } = require('../models/associations');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Sequelize } = require('sequelize');

const openaiService = require('../services/openaiService');
const s3Service = require('../services/s3Service');

// Configure S3 client for multer
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
    },
});

// ✅ UPDATED: Configure multer for covering letter uploads (PDF, DOC, DOCX)
const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: process.env.AWS_BUCKET_NAME,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
            // Clean filename to avoid database issues
            const timestamp = Date.now();
            const cleanName = file.originalname
                .replace(/[^\w\s.-]/g, '_') // Replace special chars with underscore
                .replace(/\s+/g, '_') // Replace spaces with underscore
                .substring(0, 100); // Limit length
            
            const fileName = `covering-letters/${timestamp}-${cleanName}`;
            console.log('📁 Generated S3 key:', fileName);
            cb(null, fileName);
        },
    }),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 1 // Only allow one file at a time
    },
    fileFilter: (req, file, cb) => {
        console.log('🔍 File filter check:', {
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size
        });
        
        // ✅ UPDATED: Accept PDF, DOC, and DOCX files
        const allowedMimeTypes = [
            'application/pdf',                                                    // PDF files
            'application/msword',                                                // .doc files
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx files
        ];
        
        const allowedExtensions = ['pdf', 'doc', 'docx'];
        const fileExtension = file.originalname.split('.').pop().toLowerCase();
        
        // Check both MIME type and file extension for security
        const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
        const isValidExtension = allowedExtensions.includes(fileExtension);
        
        if (isValidMimeType && isValidExtension) {
            console.log('✅ File accepted:', file.originalname);
            cb(null, true);
        } else {
            console.log('❌ File rejected:', {
                originalName: file.originalname,
                mimeType: file.mimetype,
                extension: fileExtension,
                isValidMimeType,
                isValidExtension
            });
            cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
        }
    }
});

// Create upload middleware
const uploadSingle = upload.single('coveringLetterFile');

class CoveringLetterController {

  // ✅ UTILITY: Helper function to validate file types
  validateFileType(filename, mimeType) {
      const allowedExtensions = ['pdf', 'doc', 'docx'];
      const allowedMimeTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      const fileExtension = filename.split('.').pop().toLowerCase();
      
      return {
          isValid: allowedExtensions.includes(fileExtension) && allowedMimeTypes.includes(mimeType),
          extension: fileExtension,
          isWordDocument: ['doc', 'docx'].includes(fileExtension),
          isPdfDocument: fileExtension === 'pdf'
      };
  }

  // ✅ UTILITY: Helper function to clean filename for database
  cleanFilename(originalName, maxLength = 200) {
      if (!originalName) return 'file';
      
      return originalName
          .replace(/[<>:"/\\|?*]/g, '_') // Replace forbidden characters
          .replace(/\s+/g, '_') // Replace spaces with underscores
          .replace(/_{2,}/g, '_') // Replace multiple underscores with single
          .substring(0, maxLength) // Limit length
          .trim();
  }

// ✅ FIXED: Delete covering letter with proper heads table handling
async deleteCoveringLetter(req, res) {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Starting deletion process for covering letter ID:', id);
    
    const coveringLetter = await CoveringLetter.findByPk(id, {
      include: [
        {
          model: File,
          as: 'attachedFile',
          required: false
        }
      ]
    });
    
    if (!coveringLetter) {
      return res.status(404).json({
        success: false,
        error: 'Covering letter not found'
      });
    }

    console.log('📋 Found covering letter to delete:', {
      id: coveringLetter.id,
      letterNumber: coveringLetter.letterNumber,
      patraId: coveringLetter.patraId
    });

    // ✅ STEP 1: Remove reference from InwardPatra
    if (coveringLetter.patraId) {
      try {
        await InwardPatra.update(
          { coveringLetterId: null },
          { where: { id: coveringLetter.patraId } }
        );
        console.log('✅ Removed covering letter reference from InwardPatra');
      } catch (patraError) {
        console.warn('⚠️ Could not update InwardPatra reference:', patraError.message);
      }
    }

    // ✅ STEP 2: Handle heads table - DELETE head records instead of setting to null
    try {
      if (Head) {
        // Find heads that reference this covering letter
        const headsToDelete = await Head.findAll({
          where: { coveringLetterId: id },
          attributes: ['id', 'coveringLetterId']
        });

        if (headsToDelete.length > 0) {
          console.log(`📋 Found ${headsToDelete.length} head record(s) that reference this covering letter`);
          
          // Option 1: Delete the head records entirely
          const deletedHeads = await Head.destroy({
            where: { coveringLetterId: id }
          });
          
          console.log(`✅ Deleted ${deletedHeads} head record(s) that referenced covering letter ${id}`);
        } else {
          console.log('✅ No head records found referencing this covering letter');
        }
      }
    } catch (headError) {
      console.error('❌ Error handling heads table:', headError.message);
      
      // If coveringLetterId is NOT NULL, we need to delete the head records
      // Let's try a different approach - check the constraint details
      if (headError.name === 'SequelizeValidationError' || headError.message.includes('notNull')) {
        console.log('🔄 Attempting to delete head records instead of updating...');
        
        try {
          // Delete head records that reference this covering letter
          const deletedCount = await Head.destroy({
            where: { coveringLetterId: id }
          });
          
          console.log(`✅ Deleted ${deletedCount} head record(s) to resolve NOT NULL constraint`);
        } catch (deleteHeadError) {
          console.error('❌ Could not delete head records:', deleteHeadError.message);
          
          return res.status(400).json({
            success: false,
            error: 'Cannot delete covering letter',
            message: 'Unable to handle references in heads table',
            details: deleteHeadError.message,
            suggestion: 'Please manually remove or reassign head records that reference this covering letter'
          });
        }
      } else {
        return res.status(500).json({
          success: false,
          error: 'Cannot delete covering letter',
          message: 'Error handling heads table references',
          details: headError.message
        });
      }
    }

    // ✅ STEP 3: Delete S3 files
    const filesToDelete = [];
    
    if (coveringLetter.s3FileName) {
      filesToDelete.push({
        key: coveringLetter.s3FileName,
        type: 'PDF'
      });
    }
    
    if (coveringLetter.s3WordFileName) {
      filesToDelete.push({
        key: coveringLetter.s3WordFileName,
        type: 'Word'
      });
    }
    
    if (coveringLetter.s3HtmlFileName) {
      filesToDelete.push({
        key: coveringLetter.s3HtmlFileName,
        type: 'HTML'
      });
    }

    if (coveringLetter.attachedFile && coveringLetter.attachedFile.fileName) {
      filesToDelete.push({
        key: coveringLetter.attachedFile.fileName,
        type: 'Attached File'
      });
    }

    // Delete files from S3
    if (filesToDelete.length > 0) {
      for (const fileInfo of filesToDelete) {
        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileInfo.key
          });
          
          await s3Client.send(deleteCommand);
          console.log(`✅ Deleted ${fileInfo.type} file from S3:`, fileInfo.key);
        } catch (s3Error) {
          console.warn(`⚠️ Could not delete ${fileInfo.type} file from S3:`, fileInfo.key, s3Error.message);
        }
      }
    }
    
    // ✅ STEP 4: Delete attached file record
    if (coveringLetter.fileId) {
      try {
        const attachedFile = await File.findByPk(coveringLetter.fileId);
        if (attachedFile) {
          await attachedFile.destroy();
          console.log('✅ Deleted attached file record from database');
        }
      } catch (fileError) {
        console.warn('⚠️ Could not delete attached file record:', fileError.message);
      }
    }
    
    // ✅ STEP 5: Finally delete the covering letter record
    try {
      await coveringLetter.destroy();
      console.log('✅ Deleted covering letter record from database');
    } catch (deleteError) {
      console.error('❌ Error deleting covering letter record:', deleteError);
      
      if (deleteError.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
          success: false,
          error: 'Still cannot delete covering letter',
          message: 'There may be other foreign key references not handled',
          details: deleteError.message,
          suggestion: 'Check for other tables that reference this covering letter'
        });
      }
      
      throw deleteError;
    }
    
    res.status(200).json({
      success: true,
      message: 'Covering letter and all associated files deleted successfully',
      deletedFiles: filesToDelete.length,
      details: {
        coveringLetterId: id,
        letterNumber: coveringLetter.letterNumber,
        patraId: coveringLetter.patraId,
        filesDeleted: filesToDelete.map(f => ({ type: f.type, key: f.key }))
      }
    });
    
  } catch (error) {
    console.error('❌ Error deleting covering letter:', error);
    
    res.status(500).json({
      success: false,
      error: 'Error deleting covering letter',
      details: error.message
    });
  }
}

// ✅ ALTERNATIVE: Method to reassign heads to a default covering letter instead of deleting
async reassignHeadsToDefault(coveringLetterId) {
  try {
    // Find a default covering letter or create one
    let defaultCoveringLetter = await CoveringLetter.findOne({
      where: { 
        letterType: 'DEFAULT',
        status: 'ACTIVE' 
      }
    });

    // If no default exists, you might want to create one or use another strategy
    if (!defaultCoveringLetter) {
      console.log('⚠️ No default covering letter found for reassignment');
      // You could create a default one here or use another approach
      return false;
    }

    // Reassign heads to the default covering letter
    const reassignedCount = await Head.update(
      { coveringLetterId: defaultCoveringLetter.id },
      { where: { coveringLetterId } }
    );

    console.log(`✅ Reassigned ${reassignedCount[0]} head records to default covering letter`);
    return true;

  } catch (error) {
    console.error('❌ Error reassigning heads:', error);
    return false;
  }
}

// ✅ ENHANCED: Check heads constraint before deletion
async checkHeadsConstraint(coveringLetterId) {
  try {
    const headsCount = await Head.count({
      where: { coveringLetterId }
    });

    if (headsCount > 0) {
      console.log(`⚠️ Found ${headsCount} head record(s) referencing covering letter ${coveringLetterId}`);
      
      // Check if coveringLetterId allows null
      const { sequelize } = require('../models/associations');
      
      const constraintInfo = await sequelize.query(`
        SELECT 
          column_name,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'heads' 
          AND column_name = 'covering_letter_id'
      `, {
        type: sequelize.QueryTypes.SELECT
      });

      const allowsNull = constraintInfo[0]?.is_nullable === 'YES';
      
      return {
        hasReferences: true,
        count: headsCount,
        allowsNull: allowsNull,
        strategy: allowsNull ? 'SET_NULL' : 'DELETE_RECORDS'
      };
    }

    return {
      hasReferences: false,
      count: 0,
      allowsNull: true,
      strategy: 'NONE'
    };

  } catch (error) {
    console.error('❌ Error checking heads constraint:', error);
    return {
      hasReferences: false,
      count: 0,
      allowsNull: false,
      strategy: 'UNKNOWN'
    };
  }
}

// ✅ FIXED: Upload method with proper heads table NOT NULL constraint handling
async uploadCoveringLetter(req, res) {
  try {
    const { patraId, letterNumber, letterDate, recipientOffice, recipientDesignation, status, letterType } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }
    
    if (!patraId) {
      return res.status(400).json({
        success: false,
        error: 'Patra ID is required'
      });
    }
    
    console.log('📤 Starting upload process for patraId:', patraId);
    console.log('📄 Uploaded file info:', {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      s3Key: req.file.key,
      s3Url: req.file.location
    });
    
    // Validate letterType
    const validLetterTypes = ['ACKNOWLEDGMENT', 'NAR', 'NA', 'FORWARD'];
    const finalLetterType = letterType && validLetterTypes.includes(letterType) ? letterType : 'ACKNOWLEDGMENT';
    
    // Verify the InwardPatra exists
    const patra = await InwardPatra.findByPk(patraId);
    if (!patra) {
      // Clean up uploaded file since patra doesn't exist
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: req.file.key
        });
        await s3Client.send(deleteCommand);
        console.log('🧹 Cleaned up uploaded file - Patra not found');
      } catch (cleanupError) {
        console.warn('⚠️ Could not clean up uploaded file:', cleanupError.message);
      }
      
      return res.status(404).json({
        success: false,
        error: 'InwardPatra not found with the provided ID'
      });
    }
    
    // ✅ STEP 1: Check for existing covering letter and DELETE IT COMPLETELY
    const existingCoveringLetter = await CoveringLetter.findOne({ 
      where: { patraId },
      include: [
        {
          model: File,
          as: 'attachedFile',
          required: false
        }
      ]
    });
    
    if (existingCoveringLetter) {
      console.log('🔄 Found existing covering letter, deleting it completely...', {
        existingId: existingCoveringLetter.id,
        existingType: existingCoveringLetter.letterType,
        existingLetterNumber: existingCoveringLetter.letterNumber
      });
      
      try {
        // ✅ HANDLE FOREIGN KEY CONSTRAINTS FIRST
        
        // Remove reference from InwardPatra
        await InwardPatra.update(
          { coveringLetterId: null },
          { where: { id: existingCoveringLetter.patraId } }
        );
        console.log('✅ Removed covering letter reference from InwardPatra');

        // ✅ FIXED: Handle heads table with NOT NULL constraint - DELETE instead of UPDATE
        try {
          if (Head) {
            // Check if there are heads referencing this covering letter
            const headsToHandle = await Head.findAll({
              where: { coveringLetterId: existingCoveringLetter.id },
              attributes: ['id', 'coveringLetterId']
            });

            if (headsToHandle.length > 0) {
              console.log(`📋 Found ${headsToHandle.length} head record(s) referencing covering letter ${existingCoveringLetter.id}`);
              
              // Delete the head records since coveringLetterId cannot be null
              const deletedHeads = await Head.destroy({
                where: { coveringLetterId: existingCoveringLetter.id }
              });
              
              console.log(`✅ Deleted ${deletedHeads} head record(s) that referenced the existing covering letter`);
            } else {
              console.log('✅ No head records found referencing the existing covering letter');
            }
          }
        } catch (headError) {
          console.error('❌ Error handling heads table during upload:', headError.message);
          
          // Clean up the newly uploaded file since we can't proceed
          try {
            const deleteCommand = new DeleteObjectCommand({
              Bucket: process.env.AWS_BUCKET_NAME,
              Key: req.file.key
            });
            await s3Client.send(deleteCommand);
            console.log('🧹 Cleaned up new upload due to heads table error');
          } catch (cleanupError) {
            console.warn('⚠️ Could not clean up new upload:', cleanupError.message);
          }
          
          return res.status(500).json({
            success: false,
            error: 'Cannot replace existing covering letter',
            message: 'Unable to handle references in heads table during replacement',
            details: headError.message,
            suggestion: 'The heads table has a NOT NULL constraint on coveringLetterId. Associated head records were deleted.'
          });
        }
        
        // Delete S3 files associated with existing covering letter
        const filesToDelete = [];
        
        if (existingCoveringLetter.s3FileName) {
          filesToDelete.push({
            key: existingCoveringLetter.s3FileName,
            type: 'PDF'
          });
        }
        
        if (existingCoveringLetter.s3WordFileName) {
          filesToDelete.push({
            key: existingCoveringLetter.s3WordFileName,
            type: 'Word'
          });
        }
        
        if (existingCoveringLetter.s3HtmlFileName) {
          filesToDelete.push({
            key: existingCoveringLetter.s3HtmlFileName,
            type: 'HTML'
          });
        }

        if (existingCoveringLetter.attachedFile && existingCoveringLetter.attachedFile.fileName) {
          filesToDelete.push({
            key: existingCoveringLetter.attachedFile.fileName,
            type: 'Attached File'
          });
        }

        // Delete from S3
        if (filesToDelete.length > 0) {
          for (const fileInfo of filesToDelete) {
            try {
              const deleteCommand = new DeleteObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: fileInfo.key
              });
              await s3Client.send(deleteCommand);
              console.log(`✅ Deleted existing ${fileInfo.type} file:`, fileInfo.key);
            } catch (deleteError) {
              console.warn(`⚠️ Could not delete existing ${fileInfo.type} file:`, fileInfo.key, deleteError.message);
            }
          }
        }
        
        // Delete attached file record
        if (existingCoveringLetter.fileId) {
          try {
            const attachedFile = await File.findByPk(existingCoveringLetter.fileId);
            if (attachedFile) {
              await attachedFile.destroy();
              console.log('✅ Deleted existing attached file record');
            }
          } catch (fileError) {
            console.warn('⚠️ Could not delete existing attached file record:', fileError.message);
          }
        }
        
        // Finally delete the covering letter record
        await existingCoveringLetter.destroy();
        console.log('✅ Existing covering letter completely deleted');
        
      } catch (deleteError) {
        console.error('❌ Error deleting existing covering letter:', deleteError);
        
        // Clean up the newly uploaded file since we can't proceed
        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: req.file.key
          });
          await s3Client.send(deleteCommand);
          console.log('🧹 Cleaned up new upload due to deletion error');
        } catch (cleanupError) {
          console.warn('⚠️ Could not clean up new upload:', cleanupError.message);
        }
        
        return res.status(500).json({
          success: false,
          error: 'Could not delete existing covering letter',
          details: deleteError.message
        });
      }
    }
    
    // ✅ STEP 2: Process the uploaded file
    const s3FileUrl = req.file.location;
    const s3Key = req.file.key;
    const userId = req.user?.id || 1;
    
    // Determine file type
    const fileValidation = this.validateFileType(req.file.originalname, req.file.mimetype);
    
    console.log('📝 File type analysis:', {
      extension: fileValidation.extension,
      isWordDocument: fileValidation.isWordDocument,
      isPdfDocument: fileValidation.isPdfDocument,
      mimeType: req.file.mimetype
    });
    
    // ✅ STEP 3: Create new file record
    const coveringLetterFile = await File.create({
      originalName: req.file.originalname,
      fileName: s3Key,
      fileUrl: s3FileUrl,
      filePath: s3FileUrl,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadDate: new Date(),
      userId: userId
    });
    
    console.log('✅ Created new file record:', coveringLetterFile.id);
    
    // ✅ STEP 4: Create new covering letter
    const coveringLetterData = {
      patraId: patraId,
      userId: userId,
      fileId: coveringLetterFile.id,
      letterNumber: letterNumber || `CL/${patra.referenceNumber}/${new Date().getFullYear()}`,
      letterDate: letterDate || new Date().toISOString().split('T')[0],
      recipientOffice: recipientOffice || patra.officeSendingLetter || 'Office',
      recipientDesignation: recipientDesignation || patra.senderNameAndDesignation || 'Officer',
      letterContent: fileValidation.isWordDocument ? 'Uploaded Word document - content extractable' : 'Uploaded PDF document - content available',
      status: status || 'DRAFT',
      letterType: finalLetterType,
      // Set appropriate URLs based on file type
      pdfUrl: fileValidation.isPdfDocument ? s3FileUrl : null,
      wordUrl: fileValidation.isWordDocument ? s3FileUrl : null,
      htmlUrl: null, // Will be generated when needed
      s3FileName: fileValidation.isPdfDocument ? s3Key : null,
      s3WordFileName: fileValidation.isWordDocument ? s3Key : null,
      s3HtmlFileName: null
    };
    
    const newCoveringLetter = await CoveringLetter.create(coveringLetterData);
    console.log('✅ Created new covering letter:', newCoveringLetter.id);
    
    // ✅ STEP 5: Update InwardPatra reference
    await patra.update({ 
      coveringLetterId: newCoveringLetter.id 
    });
    console.log('✅ Updated InwardPatra reference');
    
    // ✅ STEP 6: Fetch complete data for response
    const savedCoveringLetter = await CoveringLetter.findByPk(newCoveringLetter.id, {
      include: [
        {
          model: InwardPatra,
          as: 'InwardPatra',
          attributes: ['id', 'referenceNumber', 'subject', 'officeSendingLetter', 'senderNameAndDesignation']
        },
        {
          model: User,
          as: 'User',
          attributes: ['id', 'email']
        },
        {
          model: File,
          as: 'attachedFile',
          attributes: ['id', 'originalName', 'fileName', 'fileUrl'],
          required: false
        }
      ]
    });
    
    const updatedPatra = await InwardPatra.findByPk(patraId, {
      include: [
        {
          model: CoveringLetter,
          as: 'coveringLetter',
          required: false
        }
      ]
    });
    
    // ✅ STEP 7: Send success response
    const responseMessage = existingCoveringLetter 
      ? `Existing covering letter replaced successfully with ${fileValidation.isWordDocument ? 'Word' : 'PDF'} document` 
      : `Covering letter uploaded successfully with ${fileValidation.isWordDocument ? 'Word' : 'PDF'} document`;
    
    res.status(201).json({
      success: true,
      message: responseMessage,
      fileType: fileValidation.isWordDocument ? 'word' : 'pdf',
      replacedExisting: !!existingCoveringLetter,
      coveringLetter: savedCoveringLetter,
      updatedPatra: updatedPatra,
      availableFormats: {
        pdf: !!savedCoveringLetter.pdfUrl,
        word: !!savedCoveringLetter.wordUrl,
        html: !!savedCoveringLetter.htmlUrl
      },
      nextSteps: {
        canGeneratePdf: fileValidation.isWordDocument && !savedCoveringLetter.pdfUrl,
        canGenerateWord: fileValidation.isPdfDocument && !savedCoveringLetter.wordUrl,
        canGenerateHtml: !savedCoveringLetter.htmlUrl
      },
      warnings: existingCoveringLetter ? [
        'Associated head records were deleted due to database constraints'
      ] : []
    });
    
  } catch (error) {
    console.error('❌ Error in upload process:', error);
    
    // Clean up uploaded file if database operations fail
    if (req.file && req.file.key) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: req.file.key
        });
        await s3Client.send(deleteCommand);
        console.log('🧹 Cleaned up failed upload from S3');
      } catch (cleanupError) {
        console.error('❌ Error cleaning up failed upload:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Error uploading covering letter',
      details: error.message
    });
  }
}
  // ===== OTHER METHODS REMAIN THE SAME =====

  // ✅ FIXED: PostgreSQL-compatible auto-generation with Word document support
  async autoGenerateCoveringLetter(patraId, userId, transaction = null) {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      let useTransaction = null;
      
      try {
        console.log('🚀 Starting auto-generation with Word document support...', { 
          patraId, 
          userId, 
          attempt: attempt + 1 
        });

        // ✅ FIXED: Create fresh transaction for each attempt to avoid "aborted transaction" error
        useTransaction = transaction || await require('../models/associations').sequelize.transaction({
          isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
        });

        // ✅ FIXED: First check if covering letter already exists (without JOIN to avoid FOR UPDATE issues)
        const existingCoveringLetter = await CoveringLetter.findOne({
          where: { patraId },
          transaction: useTransaction
        });

        if (existingCoveringLetter) {
          console.log('⚠️ Covering letter already exists, returning existing one');
          if (!transaction) await useTransaction.commit();
          return existingCoveringLetter;
        }

        // ✅ FIXED: Get Patra without FOR UPDATE and without JOINs to avoid PostgreSQL error
        const patra = await InwardPatra.findByPk(patraId, {
          transaction: useTransaction
        });

        if (!patra) {
          throw new Error('Patra not found');
        }

        // ✅ FIXED: Get related data separately to avoid FOR UPDATE on JOINs
        let user = null;
        let uploadedFile = null;
        
        if (patra.userId) {
          user = await User.findByPk(patra.userId, {
            attributes: ['id', 'email'],
            transaction: useTransaction
          });
        }
        
        if (patra.fileId) {
          uploadedFile = await File.findByPk(patra.fileId, {
            attributes: ['id', 'originalName', 'fileName', 'fileUrl', 'extractData'],
            transaction: useTransaction
          });
        }

        // Attach the related data to patra object for compatibility
        patra.User = user;
        patra.uploadedFile = uploadedFile;

        // Extract text from file if available
        let extractedText = '';
        if (uploadedFile && uploadedFile.extractData) {
          extractedText = uploadedFile.extractData.text || '';
        }

        // Validate that we have text to work with
        if (!extractedText.trim()) {
          throw new Error('No text found in uploaded file for covering letter generation');
        }

        // Determine letter type based on Patra status
        let letterType = 'ACKNOWLEDGMENT';

        if (patra.NAR) {
          letterType = 'NAR';
        } else if (patra.NA) {
          letterType = 'NA';
        } else if (patra.letterStatus === 'forwarded') {
          letterType = 'FORWARD';
        }

        console.log(`Generating covering letter of type: ${letterType} for Patra: ${patraId}`);

        // Generate covering letter content using OpenAI with extracted text
        const letterContent = await openaiService.generateCoveringLetter({
          patra,
          letterType,
          extractedText
        });

        if (!letterContent || letterContent.trim() === '') {
          throw new Error('OpenAI failed to generate letter content');
        }

        const letterNumber = `CL/${patra.referenceNumber || patra.outwardLetterNumber}/${new Date().getFullYear()}`;

        console.log('Letter content generated, uploading to S3 with Word document...');

        // ✅ ENHANCED: Generate and upload ALL formats (PDF, HTML, Word) to S3
        const uploadResult = await s3Service.generateAndUploadCoveringLetter(letterContent, {
          letterNumber: letterNumber,
          patraId: patraId,
          letterType: letterType,
          extractedText: extractedText,
          complainantName: s3Service.extractComplainantName({ extractedText }),
          senderName: s3Service.extractComplainantName({ extractedText })
        });

        console.log('✅ S3 upload successful with ALL formats:', {
          pdfUrl: uploadResult.pdfUrl,
          wordUrl: uploadResult.wordUrl,
          htmlUrl: uploadResult.htmlUrl
        });

        // Create a new file record for the covering letter (PDF)
        const coveringLetterFile = await File.create({
          originalName: `${letterNumber}.pdf`,
          fileName: uploadResult.fileName,
          fileUrl: uploadResult.pdfUrl,
          filePath: uploadResult.pdfUrl,
          mimeType: 'application/pdf',
          fileSize: 0,
          uploadDate: new Date(),
          userId: userId
        }, { transaction: useTransaction });

        // ✅ ENHANCED: Create covering letter record with ALL URLs including Word
        const coveringLetter = await CoveringLetter.create({
          patraId: patraId,
          userId: userId,
          fileId: coveringLetterFile.id,
          letterContent: letterContent,
          letterType: letterType,
          recipientOffice: patra.officeSendingLetter,
          recipientDesignation: patra.senderNameAndDesignation,
          letterNumber: letterNumber,
          letterDate: new Date(),
          status: 'DRAFT',
          // ✅ ENHANCED: Save ALL format URLs to database
          pdfUrl: uploadResult.pdfUrl,
          htmlUrl: uploadResult.htmlUrl,
          wordUrl: uploadResult.wordUrl, // ✅ WORD URL SAVED
          s3FileName: uploadResult.fileName,
          s3HtmlFileName: uploadResult.htmlFileName,
          s3WordFileName: uploadResult.wordFileName // ✅ WORD FILENAME SAVED
        }, { transaction: useTransaction });

        // Update the Patra to reference the covering letter
        await patra.update({ 
          coveringLetterId: coveringLetter.id 
        }, { transaction: useTransaction });

        // Commit the transaction if we created it
        if (!transaction) {
          await useTransaction.commit();
        }

        console.log('✅ Covering letter created successfully with Word document:', {
          id: coveringLetter.id,
          pdfUrl: coveringLetter.pdfUrl,
          wordUrl: coveringLetter.wordUrl,
          htmlUrl: coveringLetter.htmlUrl
        });

        return coveringLetter;

      } catch (error) {
        attempt++;
        console.error(`❌ Error auto-generating covering letter (attempt ${attempt}):`, error);

        // ✅ FIXED: Always rollback transaction if we created it
        if (useTransaction && !transaction) {
          try {
            await useTransaction.rollback();
          } catch (rollbackError) {
            console.error('❌ Error rolling back transaction:', rollbackError);
          }
        }

        // Check for PostgreSQL-specific errors
        const isRetryableError = (
          error.parent && (
            error.parent.code === '40001' || // serialization_failure
            error.parent.code === '40P01' || // deadlock_detected
            error.parent.code === '25P02' || // current transaction aborted
            error.name === 'SequelizeDatabaseError'
          )
        );

        if (isRetryableError && attempt < maxRetries) {
          console.log(`🔄 Retryable error detected, retrying in ${attempt * 1000}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          continue;
        }

        // Provide more specific error messages for non-retryable errors
        if (error.message.includes('OpenAI')) {
          throw new Error(`OpenAI service error: ${error.message}`);
        } else if (error.message.includes('S3')) {
          throw new Error(`S3 upload error: ${error.message}`);
        } else if (error.message.includes('No text found')) {
          throw new Error('Cannot generate covering letter: No text extracted from uploaded file');
        } else {
          throw new Error(`Covering letter generation failed: ${error.message}`);
        }
      }
    }
  }

  // ✅ ENHANCED: Generate Word document with proper database saving
  async generateWordDocument(req, res) {
    try {
      const { id } = req.params;
      const { letterContent } = req.body;

      const coveringLetter = await CoveringLetter.findByPk(id, {
        include: [
          {
            model: InwardPatra,
            as: 'InwardPatra',
            attributes: ['referenceNumber', 'subject', 'officeSendingLetter', 'senderNameAndDesignation', 'outwardLetterNumber']
          }
        ]
      });

      if (!coveringLetter) {
        return res.status(404).json({ error: 'Covering letter not found' });
      }

      // Use provided content or existing content
      const contentToUse = letterContent || coveringLetter.letterContent;

      console.log('📄 Generating Word document with logos for covering letter:', id);

      // ✅ ENHANCED: Prepare letter data for Word generation
      const letterData = {
        letterNumber: coveringLetter.letterNumber,
        patraId: coveringLetter.patraId,
        letterType: coveringLetter.letterType,
        extractedText: contentToUse,
        complainantName: s3Service.extractComplainantName({ extractedText: contentToUse }),
        senderName: s3Service.extractComplainantName({ extractedText: contentToUse })
      };

      // Generate Word document buffer with logos
      const wordBuffer = await s3Service.generateWordDocument(contentToUse, letterData);

      // Upload Word document to S3
      const timestamp = Date.now();
      const wordFileName = `${coveringLetter.letterNumber}-word-${timestamp}.docx`;
      const wordUrl = await s3Service.uploadToS3(
        wordBuffer, 
        wordFileName,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      // ✅ ENHANCED: Update covering letter with Word document URL and filename in database
      await coveringLetter.update({
        wordUrl: wordUrl,
        s3WordFileName: `covering-letters/${wordFileName}` // Include full S3 path
      });

      console.log('✅ Word document generated successfully and saved to database:', wordUrl);

      return res.status(200).json({
        success: true,
        message: 'Word document with logos generated successfully and saved to database',
        wordUrl: wordUrl,
        wordFileName: wordFileName
      });

    } catch (error) {
      console.error('❌ Error generating Word document:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  // ✅ ENHANCED: Get covering letter for editing - returns editable HTML template
  async getCoveringLetterForEdit(req, res) {
    try {
      const { id } = req.params;

      const coveringLetter = await CoveringLetter.findByPk(id, {
        include: [
          {
            model: InwardPatra,
            as: 'InwardPatra',
            attributes: ['referenceNumber', 'subject', 'officeSendingLetter', 'senderNameAndDesignation', 'outwardLetterNumber']
          },
          {
            model: User,
            as: 'User',
            attributes: ['id', 'email']
          },
          {
            model: File,
            as: 'attachedFile',
            attributes: ['id', 'originalName', 'fileName', 'fileUrl'],
            required: false
          }
        ]
      });

      if (!coveringLetter) {
        return res.status(404).json({ error: 'Covering letter not found' });
      }

      // ✅ ENHANCED: Generate editable HTML template
      const letterData = {
        letterNumber: coveringLetter.letterNumber,
        patraId: coveringLetter.patraId,
        letterType: coveringLetter.letterType,
        extractedText: coveringLetter.letterContent,
        complainantName: s3Service.extractComplainantName({ extractedText: coveringLetter.letterContent }),
        senderName: s3Service.extractComplainantName({ extractedText: coveringLetter.letterContent })
      };

      const editableHTML = await s3Service.generateEditableHTML(coveringLetter.letterContent, letterData);

      return res.status(200).json({
        message: 'Covering letter retrieved successfully',
        coveringLetter: {
          id: coveringLetter.id,
          letterContent: coveringLetter.letterContent,
          letterType: coveringLetter.letterType,
          letterNumber: coveringLetter.letterNumber,
          letterDate: coveringLetter.letterDate,
          status: coveringLetter.status,
          pdfUrl: coveringLetter.pdfUrl,
          htmlUrl: coveringLetter.htmlUrl,
          wordUrl: coveringLetter.wordUrl, // ✅ Include Word URL
          recipientOffice: coveringLetter.recipientOffice,
          recipientDesignation: coveringLetter.recipientDesignation,
          patra: coveringLetter.InwardPatra,
          user: coveringLetter.User,
          attachedFile: coveringLetter.attachedFile
        },
        editableHTML: editableHTML
      });

    } catch (error) {
      console.error('❌ Error fetching covering letter for edit:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  // ✅ ENHANCED: Update covering letter with new content and regenerate ALL formats
  async updateCoveringLetterContent(req, res) {
    try {
      const { id } = req.params;
      const { letterContent, status, recipientOffice, recipientDesignation, signatureBase64, signerName, signaturePosition } = req.body;

      if (!letterContent || letterContent.trim() === '') {
        return res.status(400).json({ error: 'Letter content is required' });
      }

      const coveringLetter = await CoveringLetter.findByPk(id, {
        include: [
          {
            model: InwardPatra,
            as: 'InwardPatra',
            attributes: ['referenceNumber', 'subject', 'officeSendingLetter', 'outwardLetterNumber']
          }
        ]
      });

      if (!coveringLetter) {
        return res.status(404).json({ error: 'Covering letter not found' });
      }

      console.log('🔄 Updating covering letter content and regenerating ALL formats...');

      // ✅ ENHANCED: Prepare letter data for ALL format generation
      const letterData = {
        letterNumber: coveringLetter.letterNumber,
        patraId: coveringLetter.patraId,
        letterType: coveringLetter.letterType,
        extractedText: letterContent,
        complainantName: s3Service.extractComplainantName({ extractedText: letterContent }),
        senderName: s3Service.extractComplainantName({ extractedText: letterContent })
      };

      let uploadResult;

      // Check if signature is provided for signed document generation
      if (signatureBase64) {
        // Generate signed document with signature (includes Word document)
        uploadResult = await s3Service.generateAndUploadSignedCoveringLetter(
          letterContent,
          letterData,
          signatureBase64,
          signerName || 'अर्ज शाखा प्रभारी अधिकारी'
        );
      } else {
        // Generate regular document without signature (includes Word document)
        uploadResult = await s3Service.generateAndUploadCoveringLetter(
          letterContent,
          letterData
        );
      }

      // ✅ ENHANCED: Update the covering letter in database with ALL URLs including Word
      const updateData = {
        letterContent: letterContent,
        pdfUrl: uploadResult.pdfUrl,
        htmlUrl: uploadResult.htmlUrl,
        wordUrl: uploadResult.wordUrl, // ✅ Update Word URL in database
        s3FileName: uploadResult.fileName,
        s3HtmlFileName: uploadResult.htmlFileName,
        s3WordFileName: uploadResult.wordFileName, // ✅ Update Word filename in database
        updatedAt: new Date()
      };

      if (status !== undefined) updateData.status = status;
      if (recipientOffice !== undefined) updateData.recipientOffice = recipientOffice;
      if (recipientDesignation !== undefined) updateData.recipientDesignation = recipientDesignation;

      await coveringLetter.update(updateData);

      // Fetch updated covering letter with associations
      const updatedCoveringLetter = await CoveringLetter.findByPk(id, {
        include: [
          {
            model: InwardPatra,
            as: 'InwardPatra',
            attributes: ['referenceNumber', 'subject', 'officeSendingLetter', 'outwardLetterNumber']
          },
          {
            model: User,
            as: 'User',
            attributes: ['id', 'email']
          }
        ]
      });

      console.log('✅ Covering letter updated successfully, ALL formats regenerated and saved to database');

      return res.status(200).json({
        message: 'Covering letter updated successfully, ALL formats regenerated with Word document support',
        coveringLetter: updatedCoveringLetter,
        pdfUrl: uploadResult.pdfUrl,
        htmlUrl: uploadResult.htmlUrl,
        wordUrl: uploadResult.wordUrl // ✅ Return Word URL
      });

    } catch (error) {
      console.error('❌ Error updating covering letter:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  // Download covering letter as PDF from S3
  async downloadCoveringLetter(req, res) {
    try {
      const { id } = req.params;

      const coveringLetter = await CoveringLetter.findByPk(id);

      if (!coveringLetter) {
        return res.status(404).json({ error: 'Covering letter not found' });
      }

      if (!coveringLetter.pdfUrl) {
        return res.status(404).json({ error: 'PDF not available for this covering letter' });
      }

      // Redirect to S3 URL for download
      res.redirect(coveringLetter.pdfUrl);

    } catch (error) {
      console.error('❌ Error downloading covering letter:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  // ✅ ENHANCED: Download covering letter as Word document from S3
  async downloadCoveringLetterWord(req, res) {
    try {
      const { id } = req.params;

      const coveringLetter = await CoveringLetter.findByPk(id);

      if (!coveringLetter) {
        return res.status(404).json({ error: 'Covering letter not found' });
      }

      if (!coveringLetter.wordUrl) {
        // If Word URL doesn't exist, try to generate it
        console.log('⚠️ Word URL not found, generating Word document...');
        
        try {
          const letterData = {
            letterNumber: coveringLetter.letterNumber,
            patraId: coveringLetter.patraId,
            letterType: coveringLetter.letterType,
            extractedText: coveringLetter.letterContent,
            complainantName: s3Service.extractComplainantName({ extractedText: coveringLetter.letterContent }),
            senderName: s3Service.extractComplainantName({ extractedText: coveringLetter.letterContent })
          };

          const wordBuffer = await s3Service.generateWordDocument(coveringLetter.letterContent, letterData);
          const timestamp = Date.now();
          const wordFileName = `${coveringLetter.letterNumber}-word-${timestamp}.docx`;
          const wordUrl = await s3Service.uploadToS3(
            wordBuffer, 
            wordFileName,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          );

          // ✅ ENHANCED: Update the covering letter with the new Word URL in database
          await coveringLetter.update({
            wordUrl: wordUrl,
            s3WordFileName: `covering-letters/${wordFileName}`
          });

          console.log('✅ Word document generated and saved to database:', wordUrl);
          
          // Redirect to the newly created Word document
          return res.redirect(wordUrl);
          
        } catch (generateError) {
          console.error('❌ Error generating Word document:', generateError);
          return res.status(500).json({ error: 'Word document could not be generated', details: generateError.message });
        }
      }

      // Redirect to S3 URL for download
      res.redirect(coveringLetter.wordUrl);

    } catch (error) {
      console.error('❌ Error downloading Word document:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  // View covering letter as HTML
  async viewCoveringLetterHTML(req, res) {
    try {
      const { id } = req.params;

      const coveringLetter = await CoveringLetter.findByPk(id);

      if (!coveringLetter) {
        return res.status(404).json({ error: 'Covering letter not found' });
      }

      if (!coveringLetter.htmlUrl) {
        return res.status(404).json({ error: 'HTML version not available' });
      }

      // Redirect to S3 HTML URL
      res.redirect(coveringLetter.htmlUrl);

    } catch (error) {
      console.error('❌ Error viewing covering letter:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  // Get covering letter by Patra ID
  async getCoveringLetterByPatraId(req, res) {
    try {
      const { patraId } = req.params;

      const coveringLetter = await CoveringLetter.findOne({
        where: { patraId },
        include: [
          {
            model: InwardPatra,
            as: 'InwardPatra',
            attributes: ['referenceNumber', 'subject', 'officeSendingLetter', 'outwardLetterNumber']
          },
          {
            model: User,
            as: 'User',
            attributes: ['id', 'email']
          },
          {
            model: File,
            as: 'attachedFile',
            attributes: ['id', 'originalName', 'fileName', 'fileUrl'],
            required: false
          }
        ]
      });

      if (!coveringLetter) {
        return res.status(404).json({ error: 'Covering letter not found' });
      }

      return res.status(200).json(coveringLetter);

    } catch (error) {
      console.error('❌ Error fetching covering letter:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  // Manually generate covering letter with retry logic for PostgreSQL
  async generateCoveringLetter(req, res) {
    try {
      const { patraId, letterType, fileId } = req.body;
      const userId = req.user?.id || 1;

      // Check if covering letter already exists
      const existingCoveringLetter = await CoveringLetter.findOne({ 
        where: { patraId } 
      });

      if (existingCoveringLetter) {
        return res.status(400).json({ 
          error: 'Covering letter already exists for this patra. Please delete the existing one first.' 
        });
      }

      // Validate file if provided
      if (fileId) {
        const file = await File.findByPk(fileId);
        if (!file) {
          return res.status(400).json({ error: 'File not found' });
        }
      }

      const coveringLetter = await this.autoGenerateCoveringLetter(patraId, userId);

      // Update with fileId if provided
      if (fileId) {
        await coveringLetter.update({ fileId });
      }

      return res.status(201).json({
        message: 'Covering letter with Word document generated successfully',
        coveringLetter
      });

    } catch (error) {
      console.error('❌ Error generating covering letter:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  // Get all covering letters
  async getAllCoveringLetters(req, res) {
    try {
      const { page = 1, limit = 10, status, letterType } = req.query;
      const offset = (page - 1) * limit;
      
      const whereClause = {};
      if (status) whereClause.status = status;
      if (letterType) whereClause.letterType = letterType;

      const coveringLetters = await CoveringLetter.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: InwardPatra,
            as: 'InwardPatra',
            attributes: ['referenceNumber', 'subject', 'officeSendingLetter', 'outwardLetterNumber']
          },
          {
            model: User,
            as: 'User',
            attributes: ['id', 'email']
          },
          {
            model: File,
            as: 'attachedFile',
            attributes: ['id', 'originalName', 'fileName', 'fileUrl'],
            required: false
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return res.status(200).json({
        success: true,
        data: {
          coveringLetters: coveringLetters.rows,
          totalCount: coveringLetters.count,
          currentPage: parseInt(page),
          totalPages: Math.ceil(coveringLetters.count / limit)
        }
      });

    } catch (error) {
      console.error('❌ Error fetching covering letters:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  // Get covering letter by ID
  async getCoveringLetterById(req, res) {
    try {
      const { id } = req.params;

      const coveringLetter = await CoveringLetter.findByPk(id, {
        include: [
          {
            model: InwardPatra,
            as: 'InwardPatra',
            attributes: ['referenceNumber', 'subject', 'officeSendingLetter', 'senderNameAndDesignation', 'outwardLetterNumber']
          },
          {
            model: User,
            as: 'User',
            attributes: ['id', 'email']
          },
          {
            model: File,
            as: 'attachedFile',
            attributes: ['id', 'originalName', 'fileName', 'fileUrl'],
            required: false
          }
        ]
      });

      if (!coveringLetter) {
        return res.status(404).json({ error: 'Covering letter not found' });
      }

      return res.status(200).json({
        success: true,
        data: coveringLetter
      });

    } catch (error) {
      console.error('❌ Error fetching covering letter by ID:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  // ✅ ENHANCED: View covering letter PDF preview with Word URL included
  async previewCoveringLetter(req, res) {
    try {
      const { id } = req.params;

      // Fetch the covering letter details from the database
      const coveringLetter = await CoveringLetter.findByPk(id);

      if (!coveringLetter) {
        return res.status(404).json({ error: 'Covering letter not found' });
      }

      if (!coveringLetter.pdfUrl) {
        return res.status(404).json({ error: 'PDF not available for this covering letter' });
      }

      // ✅ ENHANCED: Send all URLs including Word URL to frontend for preview
      res.status(200).json({
        message: 'Covering letter found',
        pdfUrl: coveringLetter.pdfUrl,
        wordUrl: coveringLetter.wordUrl || null, // ✅ Include Word URL
        htmlUrl: coveringLetter.htmlUrl || null, // ✅ Include HTML URL
      });

    } catch (error) {
      console.error('❌ Error fetching covering letter PDF preview:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  // Simple update covering letter (for backward compatibility)
  async updateCoveringLetter(req, res) {
    try {
      const { id } = req.params;
      const { letterContent, status, recipientOffice, recipientDesignation, fileId } = req.body;

      const coveringLetter = await CoveringLetter.findByPk(id);

      if (!coveringLetter) {
        return res.status(404).json({ error: 'Covering letter not found' });
      }

      // Validate file if provided
      if (fileId) {
        const file = await File.findByPk(fileId);
        if (!file) {
          return res.status(400).json({ error: 'File not found' });
        }
      }

      const updateData = {};
      if (letterContent !== undefined) updateData.letterContent = letterContent;
      if (status !== undefined) updateData.status = status;
      if (recipientOffice !== undefined) updateData.recipientOffice = recipientOffice;
      if (recipientDesignation !== undefined) updateData.recipientDesignation = recipientDesignation;
      if (fileId !== undefined) updateData.fileId = fileId;

      await coveringLetter.update(updateData);

      // Fetch updated covering letter with associations
      const updatedCoveringLetter = await CoveringLetter.findByPk(id, {
        include: [
          {
            model: InwardPatra,
            as: 'InwardPatra',
            attributes: ['referenceNumber', 'subject', 'officeSendingLetter', 'outwardLetterNumber']
          },
          {
            model: User,
            as: 'User',
            attributes: ['id', 'email']
          }
        ]
      });

      return res.status(200).json({
        message: 'Covering letter updated successfully',
        coveringLetter: updatedCoveringLetter
      });

    } catch (error) {
      console.error('❌ Error updating covering letter:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

}

module.exports = CoveringLetterController;
module.exports.uploadSingle = uploadSingle;