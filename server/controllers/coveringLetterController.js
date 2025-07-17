// controllers/coveringLetterController.js - Enhanced with edit functionality
const CoveringLetter = require('../models/CoveringLetter');
const InwardPatra = require('../models/InwardPatra');
const User = require('../models/User');
const File = require('../models/File');

// Import associations to ensure they're loaded
require('../models/associations');

const openaiService = require('../services/openaiService');
const s3Service = require('../services/s3Service');

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

      // Create covering letter record within transaction
      const coveringLetter = await CoveringLetter.create({
        patraId: patraId,
        userId: userId,
        fileId: patra.fileId || null,
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

  // NEW: Get covering letter for editing - returns editable HTML template
  async getCoveringLetterForEdit(req, res) {
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

      // Generate editable HTML template
      const editableHTML = await s3Service.generateEditableHTML(coveringLetter.letterContent, {
        letterNumber: coveringLetter.letterNumber,
        patraId: coveringLetter.patraId,
        letterType: coveringLetter.letterType,
        extractedText: coveringLetter.letterContent
      });

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
          recipientOffice: coveringLetter.recipientOffice,
          recipientDesignation: coveringLetter.recipientDesignation,
          patra: coveringLetter.InwardPatra,
          user: coveringLetter.User,
          attachedFile: coveringLetter.attachedFile
        },
        editableHTML: editableHTML
      });

    } catch (error) {
      console.error('Error fetching covering letter for edit:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  // NEW: Update covering letter with new content and regenerate PDF
  async updateCoveringLetterContent(req, res) {
    try {
      const { id } = req.params;
      const { letterContent, status, recipientOffice, recipientDesignation } = req.body;

      if (!letterContent || letterContent.trim() === '') {
        return res.status(400).json({ error: 'Letter content is required' });
      }

      const coveringLetter = await CoveringLetter.findByPk(id, {
        include: [
          {
            model: InwardPatra,
            attributes: ['referenceNumber', 'subject', 'officeSendingLetter']
          }
        ]
      });

      if (!coveringLetter) {
        return res.status(404).json({ error: 'Covering letter not found' });
      }

      console.log('Updating covering letter content and regenerating PDF...');

      // Prepare letter data for PDF generation
      const letterData = {
        letterNumber: coveringLetter.letterNumber,
        patraId: coveringLetter.patraId,
        letterType: coveringLetter.letterType,
        extractedText: letterContent,
        complainantName: s3Service.extractComplainantName({ extractedText: letterContent }),
        senderName: s3Service.extractComplainantName({ extractedText: letterContent })
      };

      // Regenerate PDF with updated content
      const uploadResult = await s3Service.generateAndUploadCoveringLetter(
        letterContent,
        letterData
      );

      // Update the covering letter in database
      const updateData = {
        letterContent: letterContent,
        pdfUrl: uploadResult.pdfUrl,
        htmlUrl: uploadResult.htmlUrl,
        s3FileName: uploadResult.fileName,
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
            attributes: ['referenceNumber', 'subject', 'officeSendingLetter']
          },
          {
            model: User,
            attributes: ['id', 'email']
          }
        ]
      });

      console.log('Covering letter updated successfully and PDF regenerated');

      return res.status(200).json({
        message: 'Covering letter updated successfully and PDF regenerated',
        coveringLetter: updatedCoveringLetter,
        pdfUrl: uploadResult.pdfUrl,
        htmlUrl: uploadResult.htmlUrl
      });

    } catch (error) {
      console.error('Error updating covering letter:', error);
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

  // Delete covering letter
  async deleteCoveringLetter(req, res) {
    try {
      const { id } = req.params;

      const coveringLetter = await CoveringLetter.findByPk(id);

      if (!coveringLetter) {
        return res.status(404).json({ error: 'Covering letter not found' });
      }

      await coveringLetter.destroy();

      return res.status(200).json({ message: 'Covering letter deleted successfully' });

    } catch (error) {
      console.error('Error deleting covering letter:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
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

  // LEGACY: Update covering letter (maintained for backward compatibility)
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

module.exports = new CoveringLetterController();