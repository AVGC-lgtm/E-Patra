// controllers/coveringLetterController.js - Without edit functionality
const CoveringLetter = require('../models/CoveringLetter');
const InwardPatra = require('../models/InwardPatra');
const User = require('../models/User');
const File = require('../models/File');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');

// Import associations to ensure they're loaded
require('../models/associations');



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

  // Auto-generate covering letter after Patra creation
  async autoGenerateCoveringLetter(patraId, userId, transaction = null) {
    try {
      // Get the Patra data with file information
      const patra = await InwardPatra.findByPk(patraId, {
        include: [
          {
            model: User,
            attributes: ['id', 'email']
          },
          {
            model: File,
            as: 'uploadedFile',
            attributes: ['id', 'originalName', 'fileName', 'fileUrl', 'extractData'],
            required: false
          }
        ],
        transaction // Use transaction if provided
      });

      if (!patra) {
        throw new Error('Patra not found');
      }

      // Extract text from file if available
      let extractedText = '';
      if (patra.uploadedFile && patra.uploadedFile.extractData) {
        extractedText = patra.uploadedFile.extractData.text || '';
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

      const letterNumber = `CL/${patra.referenceNumber}/${new Date().getFullYear()}`;

      console.log('Letter content generated, uploading to S3...');

      // Generate and upload to S3
      const uploadResult = await s3Service.generateAndUploadCoveringLetter(letterContent, {
        letterNumber: letterNumber,
        patraId: patraId,
        letterType: letterType
      });

      console.log('S3 upload successful:', uploadResult.pdfUrl);

      // Create a new file record for the covering letter
      const coveringLetterFile = await File.create({
        originalName: `${letterNumber}.pdf`,
        fileName: uploadResult.fileName,
        fileUrl: uploadResult.pdfUrl,
        filePath: uploadResult.pdfUrl, // Use S3 URL as filePath for consistency
        mimeType: 'application/pdf',
        fileSize: 0, // Will be updated if we can get the size
        uploadDate: new Date(),
        userId: userId
      }, { transaction });

      // Create covering letter record within transaction
      const coveringLetter = await CoveringLetter.create({
        patraId: patraId,
        userId: userId,
        fileId: coveringLetterFile.id, // Use the new file record's ID
        letterContent: letterContent,
        letterType: letterType,
        recipientOffice: patra.officeSendingLetter,
        recipientDesignation: patra.senderNameAndDesignation,
        letterNumber: letterNumber,
        letterDate: new Date(),
        status: 'DRAFT',
        pdfUrl: uploadResult.pdfUrl,
        htmlUrl: uploadResult.htmlUrl,
        s3FileName: uploadResult.fileName
      }, { transaction }); // Use transaction if provided

      return coveringLetter;

    } catch (error) {
      console.error('Error auto-generating covering letter:', error);

      // Provide more specific error messages
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
      console.error('Error downloading covering letter:', error);
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
      console.error('Error viewing covering letter:', error);
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
            attributes: ['referenceNumber', 'subject', 'officeSendingLetter']
          },
          {
            model: User,
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
      console.error('Error fetching covering letter:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  // Manually generate covering letter
  async generateCoveringLetter(req, res) {
    try {
      const { patraId, letterType, fileId } = req.body;
      const userId = req.user?.id || 1; // Get from authentication middleware

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
        message: 'Covering letter generated successfully',
        coveringLetter
      });

    } catch (error) {
      console.error('Error generating covering letter:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  // Get all covering letters
  async getAllCoveringLetters(req, res) {
    try {
      const coveringLetters = await CoveringLetter.findAll({
        include: [
          {
            model: InwardPatra,
            attributes: ['referenceNumber', 'subject', 'officeSendingLetter']
          },
          {
            model: User,
            attributes: ['id', 'email']
          },
          {
            model: File,
            as: 'attachedFile',
            attributes: ['id', 'originalName', 'fileName', 'fileUrl'],
            required: false
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      return res.status(200).json(coveringLetters);

    } catch (error) {
      console.error('Error fetching covering letters:', error);
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
            attributes: ['referenceNumber', 'subject', 'officeSendingLetter', 'senderNameAndDesignation']
          },
          {
            model: User,
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
      console.error('Error fetching covering letter by ID:', error);
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
            const { S3Client } = require('@aws-sdk/client-s3');
            const s3Client = new S3Client({
              region: process.env.AWS_REGION,
              credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY,
                secretAccessKey: process.env.AWS_SECRET_KEY,
              },
            });
            
            const deleteCommand = new DeleteObjectCommand({
              Bucket: process.env.AWS_BUCKET_NAME,
              Key: req.file.key
            });
            await s3Client.send(deleteCommand);
          } catch (deleteError) {
            console.error('Error deleting uploaded S3 file:', deleteError);
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
        filePath: s3FileUrl, // Use S3 URL as filePath for consistency
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        uploadDate: new Date(),
        userId: userId
      });
      
      // CREATE new covering letter
      const newCoveringLetter = await CoveringLetter.create({
        patraId: patraId, // Use the existing patra ID
        userId: userId,
        fileId: coveringLetterFile.id, // Use the new file record's ID
        letterNumber: letterNumber || `CL/${patra.referenceNumber}/${new Date().getFullYear()}`,
        letterDate: letterDate || new Date().toISOString().split('T')[0],
        recipientOffice: recipientOffice || patra.officeSendingLetter || 'Office',
        recipientDesignation: recipientDesignation || patra.senderNameAndDesignation || 'Officer',
        letterContent: 'Uploaded file - content available in PDF',
        status: status || 'DRAFT',
        letterType: finalLetterType,
        // S3 file information
        pdfUrl: s3FileUrl,
        htmlUrl: null,
        s3FileName: s3Key
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
            attributes: ['id', 'referenceNumber', 'subject', 'officeSendingLetter', 'senderNameAndDesignation', 'fileId']
          },
          {
            model: User,
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
        message: 'Covering letter uploaded successfully',
        coveringLetter: savedCoveringLetter,
        updatedPatra: updatedPatra // Return the updated patra data
      });
      
    } catch (error) {
      console.error('Error uploading covering letter:', error);
      
      // Clean up S3 file if database operation fails
      if (req.file && req.file.key) {
        try {
          const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
          const { S3Client } = require('@aws-sdk/client-s3');
          const s3Client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY,
              secretAccessKey: process.env.AWS_SECRET_KEY,
            },
          });
          
          const deleteCommand = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: req.file.key
          });
          await s3Client.send(deleteCommand);
        } catch (deleteError) {
          console.error('Error deleting S3 file after failure:', deleteError);
        }
      }
      
      res.status(500).json({
        success: false,
        error: 'Error uploading covering letter',
        details: error.message
      });
    }
  }

  // Delete covering letter with S3 cleanup
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
      
      // Delete from S3 if file exists
      if (coveringLetter.s3FileName) {
        try {
          const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
          const { S3Client } = require('@aws-sdk/client-s3');
          const s3Client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY,
              secretAccessKey: process.env.AWS_SECRET_KEY,
            },
          });
          
          const deleteCommand = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: coveringLetter.s3FileName
          });
          await s3Client.send(deleteCommand);
          console.log('Deleted file from S3:', coveringLetter.s3FileName);
        } catch (s3Error) {
          console.error('Error deleting from S3:', s3Error);
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
        message: 'Covering letter deleted successfully from database and S3'
      });
      
    } catch (error) {
      console.error('Error deleting covering letter:', error);
      res.status(500).json({
        success: false,
        error: 'Error deleting covering letter',
        details: error.message
      });
    }
  }

  // View covering letter PDF preview
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

      // Send the PDF URL to frontend for preview
      res.status(200).json({
        message: 'Covering letter found',
        pdfUrl: coveringLetter.pdfUrl,  // This is the S3 URL for the PDF
      });

    } catch (error) {
      console.error('Error fetching covering letter PDF preview:', error);
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

      return res.status(200).json({
        message: 'Covering letter updated successfully',
        coveringLetter
      });

    } catch (error) {
      console.error('Error updating covering letter:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

}

module.exports = CoveringLetterController;
module.exports.uploadSingle = uploadSingle;