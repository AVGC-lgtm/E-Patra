// controllers/coveringLetterController.js - FIXED for PostgreSQL with Word Document Support
const { InwardPatra, CoveringLetter, User, File, Head } = require('../models/associations');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
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

// Configure multer for covering letter uploads
const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: process.env.AWS_BUCKET_NAME,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
            const fileName = `covering-letters/${Date.now()}-${file.originalname}`;
            cb(null, fileName);
        },
    }),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1 // Only allow one file
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

// Create upload middleware
const uploadSingle = upload.single('coveringLetterFile');

class CoveringLetterController {

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

  // Upload covering letter file - Only creates new, no replace
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
      
      // Validate letterType if provided
      const validLetterTypes = ['ACKNOWLEDGMENT', 'NAR', 'NA', 'FORWARD'];
      const finalLetterType = letterType && validLetterTypes.includes(letterType) ? letterType : 'ACKNOWLEDGMENT';
      
      // First, verify the InwardPatra exists
      const patra = await InwardPatra.findByPk(patraId);
      if (!patra) {
        return res.status(404).json({
          success: false,
          error: 'InwardPatra not found with the provided ID'
        });
      }
      
      // Check if covering letter already exists for this patra
      const existingCoveringLetter = await CoveringLetter.findOne({ 
        where: { patraId } 
      });
      
      if (existingCoveringLetter) {
        // Delete the uploaded S3 file since we're rejecting this upload
        if (req.file && req.file.key) {
          try {
            const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
            
            const deleteCommand = new DeleteObjectCommand({
              Bucket: process.env.AWS_BUCKET_NAME,
              Key: req.file.key
            });
            await s3Client.send(deleteCommand);
          } catch (deleteError) {
            console.error('❌ Error deleting uploaded S3 file:', deleteError);
          }
        }
        
        return res.status(400).json({
          success: false,
          error: 'Covering letter already exists. Please delete the existing one first.'
        });
      }
      
      // The file is already uploaded to S3 by multer-s3
      const s3FileUrl = req.file.location; // S3 URL
      const s3Key = req.file.key; // S3 file key
      
      // Get user ID from authentication middleware
      const userId = req.user?.id || 1;
      
      // Create a new file record for the covering letter
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
      
      // ✅ ENHANCED: CREATE new covering letter with all format URL placeholders
      const newCoveringLetter = await CoveringLetter.create({
        patraId: patraId,
        userId: userId,
        fileId: coveringLetterFile.id,
        letterNumber: letterNumber || `CL/${patra.referenceNumber}/${new Date().getFullYear()}`,
        letterDate: letterDate || new Date().toISOString().split('T')[0],
        recipientOffice: recipientOffice || patra.officeSendingLetter || 'Office',
        recipientDesignation: recipientDesignation || patra.senderNameAndDesignation || 'Officer',
        letterContent: 'Uploaded file - content available in PDF',
        status: status || 'DRAFT',
        letterType: finalLetterType,
        // S3 file information
        pdfUrl: s3FileUrl,
        htmlUrl: null, // Will be generated when needed
        wordUrl: null, // ✅ Will be generated when needed
        s3FileName: s3Key,
        s3HtmlFileName: null,
        s3WordFileName: null // ✅ Will be set when Word document is generated
      });
      
      // Update the existing InwardPatra to link to this covering letter
      await patra.update({ 
        coveringLetterId: newCoveringLetter.id 
      });
      
      // Fetch the created covering letter with associations
      const savedCoveringLetter = await CoveringLetter.findByPk(newCoveringLetter.id, {
        include: [
          {
            model: InwardPatra,
            as: 'InwardPatra',
            attributes: ['id', 'referenceNumber', 'subject', 'officeSendingLetter', 'senderNameAndDesignation', 'fileId']
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
      
      // Also fetch the updated patra to return complete data
      const updatedPatra = await InwardPatra.findByPk(patraId, {
        include: [
          {
            model: User,
            as: 'User',
            attributes: ['id', 'email']
          },
          {
            model: File,
            as: 'uploadedFile',
            attributes: ['id', 'originalName', 'fileName', 'fileUrl', 'extractData'],
            required: false
          },
          {
            model: CoveringLetter,
            as: 'coveringLetter',
            required: false,
            include: [
              {
                model: File,
                as: 'attachedFile',
                attributes: ['id', 'originalName', 'fileName', 'fileUrl'],
                required: false
              }
            ]
          }
        ]
      });
      
      res.status(201).json({
        success: true,
        message: 'Covering letter uploaded successfully (Word document will be generated on first access)',
        coveringLetter: savedCoveringLetter,
        updatedPatra: updatedPatra
      });
      
    } catch (error) {
      console.error('❌ Error uploading covering letter:', error);
      
      // Clean up S3 file if database operation fails
      if (req.file && req.file.key) {
        try {
          const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
          
          const deleteCommand = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: req.file.key
          });
          await s3Client.send(deleteCommand);
        } catch (deleteError) {
          console.error('❌ Error deleting S3 file after failure:', deleteError);
        }
      }
      
      res.status(500).json({
        success: false,
        error: 'Error uploading covering letter',
        details: error.message
      });
    }
  }

  // ✅ ENHANCED: Delete covering letter with S3 cleanup for all file types including Word
  async deleteCoveringLetter(req, res) {
    try {
      const { id } = req.params;
      
      const coveringLetter = await CoveringLetter.findByPk(id);
      
      if (!coveringLetter) {
        return res.status(404).json({
          success: false,
          error: 'Covering letter not found'
        });
      }

      // Remove reference from InwardPatra if exists
      if (coveringLetter.patraId) {
        await InwardPatra.update(
          { coveringLetterId: null },
          { where: { id: coveringLetter.patraId } }
        );
      }

      // ✅ ENHANCED: Delete ALL files from S3 (PDF, Word, HTML)
      const filesToDelete = [];
      if (coveringLetter.s3FileName) filesToDelete.push(coveringLetter.s3FileName);
      if (coveringLetter.s3WordFileName) filesToDelete.push(coveringLetter.s3WordFileName);
      if (coveringLetter.s3HtmlFileName) filesToDelete.push(coveringLetter.s3HtmlFileName);

      if (filesToDelete.length > 0) {
        try {
          const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
          
          for (const fileName of filesToDelete) {
            const deleteCommand = new DeleteObjectCommand({
              Bucket: process.env.AWS_BUCKET_NAME,
              Key: fileName
            });
            await s3Client.send(deleteCommand);
            console.log('🗑️ Deleted file from S3:', fileName);
          }
        } catch (s3Error) {
          console.error('❌ Error deleting from S3:', s3Error);
          // Continue with database deletion even if S3 deletion fails
        }
      }
      
      // Update the related Patra to remove covering letter reference
      const patra = await InwardPatra.findByPk(coveringLetter.patraId);
      if (patra) {
        await patra.update({ coveringLetterId: null });
      }
      
      // Delete the covering letter record
      await coveringLetter.destroy();
      
      res.status(200).json({
        success: true,
        message: 'Covering letter and all associated files (PDF, Word, HTML) deleted successfully from database and S3'
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