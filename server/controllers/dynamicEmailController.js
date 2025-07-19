// controllers/dynamicEmailController.js
const emailService = require('../services/emailService');
const EmailSender = require('../models/EmailSender');
const EmailReceiver = require('../models/EmailReceiver');
const InwardPatra = require('../models/InwardPatra');
const CoveringLetter = require('../models/CoveringLetter');
const File = require('../models/File');
const s3Service = require('../services/s3Service');
const axios = require('axios');

class DynamicEmailController {
  // Helper function to extract S3 key from URL
  extractS3KeyFromUrl(fileUrl) {
    try {
      console.log('🔍 Extracting S3 key from URL:', fileUrl);
      
      // Handle different S3 URL formats
      if (fileUrl.includes('s3.amazonaws.com')) {
        // Format: https://bucket-name.s3.region.amazonaws.com/key
        const urlParts = fileUrl.split('.com/');
        const s3Key = urlParts.length > 1 ? urlParts[1] : null;
        console.log('🔑 Extracted S3 key:', s3Key);
        return s3Key;
      } else if (fileUrl.includes('.s3.')) {
        // Format: https://s3.region.amazonaws.com/bucket-name/key
        const urlParts = fileUrl.split('/');
        const bucketIndex = urlParts.findIndex(part => part.includes('.s3.'));
        if (bucketIndex !== -1 && bucketIndex + 1 < urlParts.length) {
          const s3Key = urlParts.slice(bucketIndex + 1).join('/');
          console.log('🔑 Extracted S3 key:', s3Key);
          return s3Key;
        }
      }
      console.log('❌ Could not extract S3 key from URL');
      return null;
    } catch (error) {
      console.error('❌ Error extracting S3 key:', error);
      return null;
    }
  }

  // Helper function to download file from S3 URL or local path
  async downloadFileFromUrl(fileUrl) {
    try {
      console.log('🌐 Attempting to download from URL:', fileUrl);
      
      // Check if it's an S3 URL
      if (fileUrl.includes('s3.amazonaws.com') || fileUrl.includes('.s3.')) {
        console.log('☁️ Detected S3 URL, downloading from S3...');
        
        // Extract S3 key from URL
        const s3Key = this.extractS3KeyFromUrl(fileUrl);
        if (s3Key) {
          console.log('🔑 S3 Key:', s3Key);
          
          const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
          console.log('✅ File downloaded from S3 successfully, size:', fileBuffer.length, 'bytes');
          
          return {
            content: fileBuffer, // fileBuffer is already a Buffer
            contentType: 'application/pdf' // Default to PDF for S3 files
          };
        } else {
          throw new Error('Could not extract S3 key from URL');
        }
      }
      
      // Handle different URL types for local files
      let finalUrl = fileUrl;
      
      // If it's a relative path, make it absolute
      if (fileUrl.startsWith('/')) {
        finalUrl = `http://localhost:5000${fileUrl}`;
        console.log('🔄 Converted relative URL to:', finalUrl);
      }
      
      // If it's a file path, try to serve it from local server
      if (fileUrl.includes('uploads/') && !fileUrl.startsWith('http')) {
        finalUrl = `http://localhost:5000/${fileUrl}`;
        console.log('🔄 Converted file path to:', finalUrl);
      }
      
      const response = await axios.get(finalUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout
        headers: {
          'User-Agent': 'Police-Department-Email-System/1.0'
        }
      });
      
      console.log('📥 Download response status:', response.status);
      console.log('📥 Download response headers:', {
        'content-type': response.headers['content-type'],
        'content-length': response.headers['content-length']
      });
      
      const content = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'application/pdf';
      
      console.log('✅ File downloaded successfully');
      console.log('   - Size:', content.length, 'bytes');
      console.log('   - Content-Type:', contentType);
      
      return {
        content: content,
        contentType: contentType
      };
    } catch (error) {
      console.error('❌ Error downloading file from URL:', fileUrl);
      console.error('   - Error type:', error.constructor.name);
      console.error('   - Error message:', error.message);
      
      if (error.response) {
        console.error('   - Response status:', error.response.status);
        console.error('   - Response headers:', error.response.headers);
      }
      
      // Try alternative approach for local files
      if (fileUrl.includes('uploads/') || fileUrl.startsWith('/')) {
        console.log('🔄 Trying alternative local file approach...');
        try {
          const fs = require('fs').promises;
          const path = require('path');
          
          // Extract file path
          let filePath = fileUrl;
          if (fileUrl.startsWith('/')) {
            filePath = fileUrl.substring(1);
          }
          
          // Try to read file directly from filesystem
          const fullPath = path.join(__dirname, '..', filePath);
          console.log('📁 Trying to read file from:', fullPath);
          
          const content = await fs.readFile(fullPath);
          const contentType = 'application/pdf'; // Default to PDF
          
          console.log('✅ File read successfully from filesystem');
          console.log('   - Size:', content.length, 'bytes');
          
          return {
            content: content,
            contentType: contentType
          };
        } catch (fsError) {
          console.error('❌ Filesystem read also failed:', fsError.message);
        }
      }
      
      throw error;
    }
  }

  // Debug endpoint to check file structure
  async debugFileStructure(req, res) {
    try {
      const { letterId } = req.params;
      
      if (!letterId) {
        return res.status(400).json({
          error: 'Letter ID is required'
        });
      }

      // Get the letter details with associations
      const letter = await InwardPatra.findByPk(letterId, {
        include: [
          {
            model: File,
            as: 'uploadedFile'
          },
          {
            model: CoveringLetter,
            as: 'coveringLetter',
            include: [
              {
                model: File,
                as: 'attachedFile'
              }
            ]
          }
        ]
      });

      if (!letter) {
        return res.status(404).json({
          error: 'Letter not found'
        });
      }

      // Also try direct file lookup
      const directFile = letter.fileId ? await File.findByPk(letter.fileId) : null;

      res.json({
        success: true,
        data: {
          letter: {
            id: letter.id,
            referenceNumber: letter.referenceNumber,
            fileId: letter.fileId,
            coveringLetterId: letter.coveringLetterId
          },
          uploadedFile: letter.uploadedFile ? {
            id: letter.uploadedFile.id,
            originalName: letter.uploadedFile.originalName,
            fileUrl: letter.uploadedFile.fileUrl,
            filePath: letter.uploadedFile.filePath,
            mimeType: letter.uploadedFile.mimeType
          } : null,
          directFile: directFile ? {
            id: directFile.id,
            originalName: directFile.originalName,
            fileUrl: directFile.fileUrl,
            filePath: directFile.filePath,
            mimeType: directFile.mimeType
          } : null,
          coveringLetter: letter.coveringLetter ? {
            id: letter.coveringLetter.id,
            fileId: letter.coveringLetter.fileId,
            attachedFile: letter.coveringLetter.attachedFile ? {
              id: letter.coveringLetter.attachedFile.id,
              originalName: letter.coveringLetter.attachedFile.originalName,
              fileUrl: letter.coveringLetter.attachedFile.fileUrl,
              filePath: letter.coveringLetter.attachedFile.filePath,
              mimeType: letter.coveringLetter.attachedFile.mimeType
            } : null
          } : null
        }
      });
    } catch (error) {
      console.error('Debug file structure error:', error);
      res.status(500).json({
        error: 'Failed to debug file structure',
        details: error.message
      });
    }
  }

  // Test endpoint to verify file associations and downloads
  async testFileAssociations(req, res) {
    try {
      const { letterId } = req.params;
      
      if (!letterId) {
        return res.status(400).json({
          error: 'Letter ID is required'
        });
      }

      console.log('🧪 Testing file associations for letter ID:', letterId);

      // Get the letter details with associations
      const letter = await InwardPatra.findByPk(letterId, {
        include: [
          {
            model: File,
            as: 'uploadedFile'
          },
          {
            model: CoveringLetter,
            as: 'coveringLetter',
            include: [
              {
                model: File,
                as: 'attachedFile'
              }
            ]
          }
        ]
      });

      if (!letter) {
        return res.status(404).json({
          error: 'Letter not found'
        });
      }

      const testResults = {
        letter: {
          id: letter.id,
          referenceNumber: letter.referenceNumber,
          fileId: letter.fileId,
          coveringLetterId: letter.coveringLetterId
        },
        uploadedFile: null,
        coveringLetter: null,
        fileDownloadTests: []
      };

      // Test uploaded file
      if (letter.uploadedFile) {
        testResults.uploadedFile = {
          id: letter.uploadedFile.id,
          originalName: letter.uploadedFile.originalName,
          fileUrl: letter.uploadedFile.fileUrl,
          filePath: letter.uploadedFile.filePath,
          mimeType: letter.uploadedFile.mimeType
        };

        // Test file download
        if (letter.uploadedFile.fileUrl || letter.uploadedFile.filePath) {
          try {
            let fileUrl = letter.uploadedFile.fileUrl;
            if (!fileUrl && letter.uploadedFile.filePath) {
              fileUrl = `http://localhost:5000/${letter.uploadedFile.filePath.replace(/\\/g, '/')}`;
            }
            
            console.log('🧪 Testing file download for:', fileUrl);
            
            // Call S3 service directly to avoid binding issues
            let downloadedFile;
            if (fileUrl.includes('s3.amazonaws.com') || fileUrl.includes('.s3.')) {
              console.log('☁️ Detected S3 URL, downloading from S3...');
              const s3Key = this.extractS3KeyFromUrl(fileUrl);
              if (s3Key) {
                console.log('🔑 S3 Key:', s3Key);
                const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
                downloadedFile = {
                  content: fileBuffer,
                  contentType: 'application/pdf'
                };
              } else {
                throw new Error('Could not extract S3 key from URL');
              }
            } else {
              // Use axios for non-S3 URLs
              const response = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
                timeout: 30000
              });
              downloadedFile = {
                content: Buffer.from(response.data),
                contentType: response.headers['content-type'] || 'application/pdf'
              };
            }
            
            testResults.fileDownloadTests.push({
              type: 'uploadedFile',
              success: true,
              url: fileUrl,
              size: downloadedFile.content.length,
              contentType: downloadedFile.contentType
            });
          } catch (error) {
            testResults.fileDownloadTests.push({
              type: 'uploadedFile',
              success: false,
              url: letter.uploadedFile.fileUrl || `http://localhost:5000/${letter.uploadedFile.filePath?.replace(/\\/g, '/')}`,
              error: error.message
            });
          }
        }
      }

      // Test covering letter
      if (letter.coveringLetter) {
        testResults.coveringLetter = {
          id: letter.coveringLetter.id,
          fileId: letter.coveringLetter.fileId,
          attachedFile: letter.coveringLetter.attachedFile ? {
            id: letter.coveringLetter.attachedFile.id,
            originalName: letter.coveringLetter.attachedFile.originalName,
            fileUrl: letter.coveringLetter.attachedFile.fileUrl,
            filePath: letter.coveringLetter.attachedFile.filePath,
            mimeType: letter.coveringLetter.attachedFile.mimeType
          } : null
        };

        // Test covering letter file download
        if (letter.coveringLetter.attachedFile && (letter.coveringLetter.attachedFile.fileUrl || letter.coveringLetter.attachedFile.filePath)) {
          try {
            let fileUrl = letter.coveringLetter.attachedFile.fileUrl;
            if (!fileUrl && letter.coveringLetter.attachedFile.filePath) {
              fileUrl = `http://localhost:5000/${letter.coveringLetter.attachedFile.filePath.replace(/\\/g, '/')}`;
            }
            
            console.log('🧪 Testing covering letter download for:', fileUrl);
            
            // Call S3 service directly to avoid binding issues
            let downloadedFile;
            if (fileUrl.includes('s3.amazonaws.com') || fileUrl.includes('.s3.')) {
              console.log('☁️ Detected S3 URL, downloading from S3...');
              const s3Key = this.extractS3KeyFromUrl(fileUrl);
              if (s3Key) {
                console.log('🔑 S3 Key:', s3Key);
                const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
                downloadedFile = {
                  content: fileBuffer,
                  contentType: 'application/pdf'
                };
              } else {
                throw new Error('Could not extract S3 key from URL');
              }
            } else {
              // Use axios for non-S3 URLs
              const response = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
                timeout: 30000
              });
              downloadedFile = {
                content: Buffer.from(response.data),
                contentType: response.headers['content-type'] || 'application/pdf'
              };
            }
            
            testResults.fileDownloadTests.push({
              type: 'coveringLetter',
              success: true,
              url: fileUrl,
              size: downloadedFile.content.length,
              contentType: downloadedFile.contentType
            });
          } catch (error) {
            testResults.fileDownloadTests.push({
              type: 'coveringLetter',
              success: false,
              url: letter.coveringLetter.attachedFile.fileUrl || `http://localhost:5000/${letter.coveringLetter.attachedFile.filePath?.replace(/\\/g, '/')}`,
              error: error.message
            });
          }
        }
      }

      res.json({
        success: true,
        message: 'File association test completed',
        data: testResults
      });
    } catch (error) {
      console.error('Test file associations error:', error);
      res.status(500).json({
        error: 'Failed to test file associations',
        details: error.message
      });
    }
  }

  // Test letter attachments preparation
  async testLetterAttachments(req, res) {
    try {
      const { letterId } = req.params;
      
      if (!letterId) {
        return res.status(400).json({
          error: 'Letter ID is required'
        });
      }

      console.log('🧪 Testing letter attachments for letter ID:', letterId);

      // Get the letter details with associations
      const letter = await InwardPatra.findByPk(letterId, {
        include: [
          {
            model: File,
            as: 'uploadedFile'
          },
          {
            model: CoveringLetter,
            as: 'coveringLetter',
            include: [
              {
                model: File,
                as: 'attachedFile'
              }
            ]
          }
        ]
      });

      if (!letter) {
        return res.status(404).json({
          error: 'Letter not found'
        });
      }

      console.log('📝 Letter found:', {
        id: letter.id,
        referenceNumber: letter.referenceNumber,
        hasUploadedFile: !!letter.uploadedFile,
        hasCoveringLetter: !!letter.coveringLetter,
        fileId: letter.fileId,
        coveringLetterId: letter.coveringLetterId
      });

      // Test attachment preparation
      const attachments = [];
      const testResults = {
        mainFile: { success: false, error: null, details: null },
        coveringFile: { success: false, error: null, details: null }
      };

      // Test main letter file
      if (letter.uploadedFile) {
        try {
          console.log('📄 Testing main letter file...');
          const file = letter.uploadedFile;
          
          if (file && file.fileUrl) {
            console.log('⬇️ Testing file download from URL:', file.fileUrl);
            
            let downloadedFile;
            if (file.fileUrl.includes('s3.amazonaws.com') || file.fileUrl.includes('.s3.')) {
              console.log('☁️ Testing S3 download...');
              const s3Key = this.extractS3KeyFromUrl(file.fileUrl);
              if (s3Key) {
                console.log('🔑 S3 Key:', s3Key);
                const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
                downloadedFile = {
                  content: fileBuffer,
                  contentType: 'application/pdf'
                };
                console.log('✅ S3 download successful, size:', fileBuffer.length, 'bytes');
              } else {
                throw new Error('Could not extract S3 key from URL');
              }
            } else {
              console.log('🌐 Testing HTTP download...');
              const response = await axios.get(file.fileUrl, {
                responseType: 'arraybuffer',
                timeout: 30000
              });
              downloadedFile = {
                content: Buffer.from(response.data),
                contentType: response.headers['content-type'] || 'application/pdf'
              };
              console.log('✅ HTTP download successful, size:', downloadedFile.content.length, 'bytes');
            }
            
            attachments.push({
              filename: file.originalName || 'letter.pdf',
              content: downloadedFile.content,
              contentType: downloadedFile.contentType
            });
            
            testResults.mainFile = {
              success: true,
              error: null,
              details: {
                filename: file.originalName || 'letter.pdf',
                size: downloadedFile.content.length,
                contentType: downloadedFile.contentType,
                source: file.fileUrl.includes('s3.amazonaws.com') ? 'S3' : 'HTTP'
              }
            };
          } else {
            throw new Error('No fileUrl available');
          }
        } catch (error) {
          console.error('❌ Main file test failed:', error.message);
          testResults.mainFile = {
            success: false,
            error: error.message,
            details: {
              fileUrl: letter.uploadedFile?.fileUrl,
              filePath: letter.uploadedFile?.filePath
            }
          };
        }
      } else {
        testResults.mainFile = {
          success: false,
          error: 'No uploadedFile association found',
          details: { fileId: letter.fileId }
        };
      }

      // Test covering letter file
      if (letter.coveringLetter && letter.coveringLetter.attachedFile) {
        try {
          console.log('📄 Testing covering letter file...');
          const coveringFile = letter.coveringLetter.attachedFile;
          
          if (coveringFile && coveringFile.fileUrl) {
            console.log('⬇️ Testing covering file download from URL:', coveringFile.fileUrl);
            
            let downloadedFile;
            if (coveringFile.fileUrl.includes('s3.amazonaws.com') || coveringFile.fileUrl.includes('.s3.')) {
              console.log('☁️ Testing S3 download for covering letter...');
              const s3Key = this.extractS3KeyFromUrl(coveringFile.fileUrl);
              if (s3Key) {
                console.log('🔑 S3 Key:', s3Key);
                const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
                downloadedFile = {
                  content: fileBuffer,
                  contentType: 'application/pdf'
                };
                console.log('✅ S3 download successful for covering letter, size:', fileBuffer.length, 'bytes');
              } else {
                throw new Error('Could not extract S3 key from URL');
              }
            } else {
              console.log('🌐 Testing HTTP download for covering letter...');
              const response = await axios.get(coveringFile.fileUrl, {
                responseType: 'arraybuffer',
                timeout: 30000
              });
              downloadedFile = {
                content: Buffer.from(response.data),
                contentType: response.headers['content-type'] || 'application/pdf'
              };
              console.log('✅ HTTP download successful for covering letter, size:', downloadedFile.content.length, 'bytes');
            }
            
            attachments.push({
              filename: `covering_letter_${letter.referenceNumber}.pdf`,
              content: downloadedFile.content,
              contentType: downloadedFile.contentType
            });
            
            testResults.coveringFile = {
              success: true,
              error: null,
              details: {
                filename: `covering_letter_${letter.referenceNumber}.pdf`,
                size: downloadedFile.content.length,
                contentType: downloadedFile.contentType,
                source: coveringFile.fileUrl.includes('s3.amazonaws.com') ? 'S3' : 'HTTP'
              }
            };
          } else {
            throw new Error('No fileUrl available for covering letter');
          }
        } catch (error) {
          console.error('❌ Covering file test failed:', error.message);
          testResults.coveringFile = {
            success: false,
            error: error.message,
            details: {
              fileUrl: letter.coveringLetter.attachedFile?.fileUrl,
              filePath: letter.coveringLetter.attachedFile?.filePath
            }
          };
        }
      } else {
        testResults.coveringFile = {
          success: false,
          error: 'No covering letter or attached file found',
          details: { coveringLetterId: letter.coveringLetterId }
        };
      }

      console.log(`📎 Test completed. Total attachments prepared: ${attachments.length}`);

      res.json({
        success: true,
        data: {
          letterId: letterId,
          referenceNumber: letter.referenceNumber,
          totalAttachments: attachments.length,
          testResults,
          attachments: attachments.map(att => ({
            filename: att.filename,
            contentType: att.contentType,
            size: att.content.length
          }))
        }
      });
    } catch (error) {
      console.error('Test letter attachments error:', error);
      res.status(500).json({
        error: 'Failed to test letter attachments',
        details: error.message
      });
    }
  }

  // Send inward letter email with attachments and covering letter
  async sendInwardLetterEmail(req, res) {
    try {
      const { 
        letterId, 
        senderEmail, 
        recipients, 
        customMessage = '',
        includeCoveringLetter = true 
      } = req.body;

      // Create local reference to avoid 'this' binding issues
      const extractS3KeyFromUrl = (fileUrl) => {
        try {
          // Handle different S3 URL formats
          if (fileUrl.includes('s3.amazonaws.com')) {
            // Format: https://bucket-name.s3.region.amazonaws.com/key
            const urlParts = fileUrl.split('.com/');
            return urlParts.length > 1 ? urlParts[1] : null;
          } else if (fileUrl.includes('.s3.')) {
            // Format: https://s3.region.amazonaws.com/bucket-name/key
            const urlParts = fileUrl.split('/');
            const bucketIndex = urlParts.findIndex(part => part.includes('.s3.'));
            if (bucketIndex !== -1 && bucketIndex + 1 < urlParts.length) {
              return urlParts.slice(bucketIndex + 1).join('/');
            }
          }
          return null;
        } catch (error) {
          console.error('Error extracting S3 key:', error);
          return null;
        }
      };

      // Helper function to replace all this.extractS3KeyFromUrl calls in this method
      const getS3Key = (url) => extractS3KeyFromUrl(url);

      if (!letterId || !senderEmail || !recipients || !Array.isArray(recipients)) {
        return res.status(400).json({
          error: 'Letter ID, sender email, and recipients array are required'
        });
      }

      // Get the letter details with associations
      const letter = await InwardPatra.findByPk(letterId, {
        include: [
          {
            model: File,
            as: 'uploadedFile'
          },
          {
            model: CoveringLetter,
            as: 'coveringLetter',
            include: [
              {
                model: File,
                as: 'attachedFile'
              }
            ]
          }
        ]
      });
      if (!letter) {
        return res.status(404).json({
          error: 'Letter not found'
        });
      }

      // If covering letter exists but points to the same file as main letter, fix the association
      if (letter.coveringLetter && letter.coveringLetter.fileId === letter.fileId) {
        console.log('⚠️  Covering letter pointing to same file as main letter, checking for separate S3 URL...');
        
        // Check if covering letter has its own S3 URL
        if (letter.coveringLetter.pdfUrl && letter.coveringLetter.pdfUrl !== letter.uploadedFile?.fileUrl) {
          console.log('✅ Covering letter has different S3 URL, creating separate file record...');
          
          // Create a new file record for the covering letter
          const coveringLetterFile = await File.create({
            originalName: `${letter.coveringLetter.letterNumber || 'covering-letter'}.pdf`,
            fileName: letter.coveringLetter.s3FileName || `covering-letter-${letter.coveringLetter.id}.pdf`,
            fileUrl: letter.coveringLetter.pdfUrl,
            filePath: letter.coveringLetter.pdfUrl,
            mimeType: 'application/pdf',
            fileSize: 0,
            uploadDate: letter.coveringLetter.createdAt || new Date(),
            userId: letter.coveringLetter.userId
          });
          
          // Update the covering letter to point to the new file record
          await letter.coveringLetter.update({
            fileId: coveringLetterFile.id
          });
          
          // Refresh the covering letter association
          await letter.coveringLetter.reload({
            include: [
              {
                model: File,
                as: 'attachedFile'
              }
            ]
          });
          
          console.log('✅ Fixed covering letter file association');
        }
      }

      console.log('📝 Letter found with associations:', {
        id: letter.id,
        referenceNumber: letter.referenceNumber,
        hasUploadedFile: !!letter.uploadedFile,
        hasCoveringLetter: !!letter.coveringLetter,
        uploadedFileId: letter.fileId,
        coveringLetterId: letter.coveringLetterId
      });

      // Find or create sender
      let sender = await EmailSender.findOne({ where: { email: senderEmail } });
      if (!sender) {
        const senderName = senderEmail.split('@')[0].replace(/[._-]/g, ' ');
        sender = await EmailSender.create({
          email: senderEmail,
          name: senderName,
          designation: 'Staff',
          department: 'General'
        });
      }

      // Get or create receiver emails for IGP and SP
      const receiverEmails = [];
      const receiverDetails = [];

      for (const recipientType of recipients) {
        let receiverEmail = '';
        let receiverName = '';
        let designation = '';

        // Check if recipientType is already an email address
        if (recipientType.includes('@')) {
          receiverEmail = recipientType;
          receiverName = recipientType.split('@')[0];
          designation = 'External';
        } else {
          // Handle recipient types
          switch (recipientType.toLowerCase()) {
            case 'igp':
              receiverEmail = process.env.IGP_EMAIL || 'punddipak444@gmail.com';
              receiverName = 'Inspector General of Police';
              designation = 'IGP';
              break;
            case 'sp':
              receiverEmail = process.env.SP_EMAIL || 'punddipak9@gmail.com';
              receiverName = 'Superintendent of Police';
              designation = 'SP';
              break;
            case 'sdpo':
              receiverEmail = process.env.SDPO_EMAIL || 'punddipak444@gmail.com';
              receiverName = 'Sub-Divisional Police Officer';
              designation = 'SDPO';
              break;
            default:
              console.log(`Skipping invalid recipient type: ${recipientType}`);
              continue;
          }
        }

        // Validate email before creating/using receiver
        if (receiverEmail && receiverEmail.includes('@') && receiverEmail.split('@')[1]) {
          try {
            let receiver = await EmailReceiver.findOne({ where: { email: receiverEmail } });
            if (!receiver) {
              receiver = await EmailReceiver.create({
                email: receiverEmail,
                name: receiverName,
                designation: designation,
                department: 'Police'
              });
            }
            receiverEmails.push(receiverEmail);
            receiverDetails.push(receiver);
          } catch (error) {
            console.error(`Error creating/finding receiver for ${receiverEmail}:`, error.message);
            // Skip this recipient but continue with others
          }
        } else {
          console.log(`Skipping invalid email: ${receiverEmail}`);
        }
      }

      if (receiverEmails.length === 0) {
        return res.status(400).json({
          error: 'No valid recipients found. Please check that the recipient types (IGP, SP, SDPO) are valid or provide valid email addresses.'
        });
      }

      // Prepare attachments
      const attachments = [];
      console.log('🔍 Preparing attachments...');
      console.log('Letter uploadedFile:', letter.uploadedFile);
      console.log('Letter coveringLetter:', letter.coveringLetter);
      console.log('Letter fileId:', letter.fileId);
      console.log('Letter coveringLetterId:', letter.coveringLetterId);

      // Add main letter file
      if (letter.uploadedFile) {
        console.log('📄 Processing main letter file via association...');
        console.log('🔍 UploadedFile object:', JSON.stringify(letter.uploadedFile, null, 2));
        
        try {
          const file = letter.uploadedFile;
          console.log('File record from association:', file ? {
            id: file.id,
            originalName: file.originalName,
            fileUrl: file.fileUrl,
            mimeType: file.mimeType,
            filePath: file.filePath
          } : 'File not found');
          
          if (file && file.fileUrl) {
            console.log('⬇️ Downloading file from URL:', file.fileUrl);
            
            // Call S3 service directly to avoid binding issues
            let downloadedFile;
            if (file.fileUrl.includes('s3.amazonaws.com') || file.fileUrl.includes('.s3.')) {
              console.log('☁️ Detected S3 URL, downloading from S3...');
              const s3Key = getS3Key(file.fileUrl);
              if (s3Key) {
                console.log('🔑 S3 Key:', s3Key);
                try {
                  const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
                  downloadedFile = {
                    content: fileBuffer,
                    contentType: 'application/pdf'
                  };
                  console.log('✅ S3 download successful');
                } catch (s3Error) {
                  console.error('❌ S3 download failed:', s3Error.message);
                  console.log('🔄 Trying HTTP download as fallback...');
                  // Fallback to HTTP download
                  const response = await axios.get(file.fileUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                  });
                  downloadedFile = {
                    content: Buffer.from(response.data),
                    contentType: response.headers['content-type'] || 'application/pdf'
                  };
                  console.log('✅ HTTP fallback download successful');
                }
              } else {
                console.log('🔄 S3 key extraction failed, trying HTTP download...');
                // Fallback to HTTP download
                const response = await axios.get(file.fileUrl, {
                  responseType: 'arraybuffer',
                  timeout: 30000
                });
                downloadedFile = {
                  content: Buffer.from(response.data),
                  contentType: response.headers['content-type'] || 'application/pdf'
                };
                console.log('✅ HTTP download successful');
              }
            } else {
              // Use axios for non-S3 URLs
              const response = await axios.get(file.fileUrl, {
                responseType: 'arraybuffer',
                timeout: 30000
              });
              downloadedFile = {
                content: Buffer.from(response.data),
                contentType: response.headers['content-type'] || 'application/pdf'
              };
            }
            
            console.log('✅ File downloaded successfully, size:', downloadedFile.content.length, 'bytes');
            
            attachments.push({
              filename: file.originalName || 'letter.pdf',
              content: downloadedFile.content,
              contentType: downloadedFile.contentType
            });
            console.log('📎 Main letter file added to attachments');
          } else if (file && file.filePath) {
            // Try using filePath if fileUrl is not available
            console.log('⬇️ Downloading file from filePath:', file.filePath);
            const fileUrl = `http://localhost:5000/${file.filePath.replace(/\\/g, '/')}`;
            console.log('🔗 Constructed fileUrl from filePath:', fileUrl);
            
            // Call S3 service directly to avoid binding issues
            let downloadedFile;
            if (fileUrl.includes('s3.amazonaws.com') || fileUrl.includes('.s3.')) {
              console.log('☁️ Detected S3 URL, downloading from S3...');
              const s3Key = getS3Key(fileUrl);
              if (s3Key) {
                console.log('🔑 S3 Key:', s3Key);
                const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
                downloadedFile = {
                  content: fileBuffer,
                  contentType: 'application/pdf'
                };
              } else {
                throw new Error('Could not extract S3 key from URL');
              }
            } else {
              // Use axios for non-S3 URLs
              const response = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
                timeout: 30000
              });
              downloadedFile = {
                content: Buffer.from(response.data),
                contentType: response.headers['content-type'] || 'application/pdf'
              };
            }
            
            console.log('✅ File downloaded successfully from filePath, size:', downloadedFile.content.length, 'bytes');
            
            attachments.push({
              filename: file.originalName || 'letter.pdf',
              content: downloadedFile.content,
              contentType: downloadedFile.contentType
            });
            console.log('📎 Main letter file added to attachments (from filePath)');
          } else {
            console.log('❌ Main letter file not found or no URL/filePath');
            console.log('File object:', JSON.stringify(file, null, 2));
          }
        } catch (error) {
          console.error('❌ Error adding main letter file:', error);
          console.error('Error stack:', error.stack);
          console.error('Error details:', {
            message: error.message,
            code: error.code,
            statusCode: error.statusCode
          });
          
          // Log detailed error information for debugging
          console.error('❌ File download failed. Detailed error info:');
          console.error('   - File URL:', letter.uploadedFile?.fileUrl);
          console.error('   - File Path:', letter.uploadedFile?.filePath);
          console.error('   - File ID:', letter.uploadedFile?.id);
          console.error('   - Original Name:', letter.uploadedFile?.originalName);
          console.error('   - MIME Type:', letter.uploadedFile?.mimeType);
          
          // Try alternative download methods
          if (letter.uploadedFile && letter.uploadedFile.filePath) {
            console.log('🔄 Trying alternative download from filePath...');
            try {
              const fs = require('fs').promises;
              const path = require('path');
              
              // Try to read file directly from filesystem
              const fullPath = path.join(__dirname, '..', letter.uploadedFile.filePath);
              console.log('📁 Trying to read file from filesystem:', fullPath);
              
              const content = await fs.readFile(fullPath);
              console.log('✅ File read successfully from filesystem, size:', content.length, 'bytes');
              
              attachments.push({
                filename: letter.uploadedFile.originalName || 'letter.pdf',
                content: content,
                contentType: letter.uploadedFile.mimeType || 'application/pdf'
              });
              console.log('📎 Main letter file added to attachments (from filesystem)');
            } catch (fsError) {
              console.error('❌ Filesystem read also failed:', fsError.message);
            }
          }
        }
      } else {
        console.log('❌ No uploadedFile association found');
        console.log('🔍 Letter object keys:', Object.keys(letter));
        console.log('🔍 Letter fileId:', letter.fileId);
      }
      
      if (letter.fileId) {
        // Fallback: try to get file directly if association failed
        console.log('📄 Fallback: Processing main letter file by fileId...');
        let file = null;
        try {
          file = await File.findByPk(letter.fileId);
          console.log('File record (fallback):', file ? {
            id: file.id,
            originalName: file.originalName,
            fileUrl: file.fileUrl,
            mimeType: file.mimeType,
            filePath: file.filePath
          } : 'File not found');
          
          if (file && file.fileUrl) {
            console.log('⬇️ Downloading file from URL (fallback):', file.fileUrl);
            
            // Call S3 service directly to avoid binding issues
            let downloadedFile;
            if (file.fileUrl.includes('s3.amazonaws.com') || file.fileUrl.includes('.s3.')) {
              console.log('☁️ Detected S3 URL, downloading from S3...');
              const s3Key = getS3Key(file.fileUrl);
              if (s3Key) {
                console.log('🔑 S3 Key:', s3Key);
                try {
                  const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
                  downloadedFile = {
                    content: fileBuffer,
                    contentType: 'application/pdf'
                  };
                  console.log('✅ S3 download successful (fallback)');
                } catch (s3Error) {
                  console.error('❌ S3 download failed (fallback):', s3Error.message);
                  console.log('🔄 Trying HTTP download as fallback (fallback)...');
                  // Fallback to HTTP download
                  const response = await axios.get(file.fileUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                  });
                  downloadedFile = {
                    content: Buffer.from(response.data),
                    contentType: response.headers['content-type'] || 'application/pdf'
                  };
                  console.log('✅ HTTP fallback download successful (fallback)');
                }
              } else {
                console.log('🔄 S3 key extraction failed (fallback), trying HTTP download...');
                // Fallback to HTTP download
                const response = await axios.get(file.fileUrl, {
                  responseType: 'arraybuffer',
                  timeout: 30000
                });
                downloadedFile = {
                  content: Buffer.from(response.data),
                  contentType: response.headers['content-type'] || 'application/pdf'
                };
                console.log('✅ HTTP download successful (fallback)');
              }
            } else {
              // Use axios for non-S3 URLs
              const response = await axios.get(file.fileUrl, {
                responseType: 'arraybuffer',
                timeout: 30000
              });
              downloadedFile = {
                content: Buffer.from(response.data),
                contentType: response.headers['content-type'] || 'application/pdf'
              };
            }
            
            console.log('✅ File downloaded successfully (fallback), size:', downloadedFile.content.length, 'bytes');
            
            attachments.push({
              filename: file.originalName || 'letter.pdf',
              content: downloadedFile.content,
              contentType: downloadedFile.contentType
            });
            console.log('📎 Main letter file added to attachments (fallback)');
          } else if (file && file.filePath) {
            // Try using filePath if fileUrl is not available
            console.log('⬇️ Downloading file from filePath (fallback):', file.filePath);
            const fileUrl = `http://localhost:5000/${file.filePath.replace(/\\/g, '/')}`;
            const downloadedFile = await dynamicEmailController.downloadFileFromUrl(fileUrl);
            console.log('✅ File downloaded successfully from filePath (fallback), size:', downloadedFile.content.length, 'bytes');
            
            attachments.push({
              filename: file.originalName || 'letter.pdf',
              content: downloadedFile.content,
              contentType: downloadedFile.contentType
            });
            console.log('📎 Main letter file added to attachments (fallback from filePath)');
          } else {
            console.log('❌ Main letter file not found or no URL/filePath (fallback)');
            console.log('File object (fallback):', JSON.stringify(file, null, 2));
          }
        } catch (error) {
          console.error('❌ Error adding main letter file (fallback):', error);
          console.error('Error stack (fallback):', error.stack);
          
          // Log detailed error information for debugging
          console.error('❌ Main letter file download failed (fallback). Detailed error info:');
          console.error('   - File URL:', file?.fileUrl);
          console.error('   - File Path:', file?.filePath);
          console.error('   - File ID:', file?.id);
          console.error('   - Original Name:', file?.originalName);
          
          // Try alternative download methods for main letter file (fallback)
          if (file?.filePath) {
            console.log('🔄 Trying alternative download from filePath for main letter file (fallback)...');
            try {
              const fs = require('fs').promises;
              const path = require('path');
              
              // Try to read file directly from filesystem
              const fullPath = path.join(__dirname, '..', file.filePath);
              console.log('📁 Trying to read main letter file from filesystem (fallback):', fullPath);
              
              const content = await fs.readFile(fullPath);
              console.log('✅ Main letter file read successfully from filesystem (fallback), size:', content.length, 'bytes');
              
              attachments.push({
                filename: file.originalName || 'letter.pdf',
                content: content,
                contentType: file.mimeType || 'application/pdf'
              });
              console.log('📎 Main letter file added to attachments (from filesystem fallback)');
            } catch (fsError) {
              console.error('❌ Filesystem read for main letter file (fallback) also failed:', fsError.message);
            }
          }
        }
      } else {
        console.log('❌ No fileId found in letter');
      }

      // Add covering letter if requested and exists
      if (includeCoveringLetter && letter.coveringLetter) {
        try {
          console.log('📄 Processing covering letter...');
          console.log('Covering letter record:', letter.coveringLetter ? {
            id: letter.coveringLetter.id,
            fileId: letter.coveringLetter.fileId,
            hasAttachedFile: !!letter.coveringLetter.attachedFile
          } : 'Covering letter not found');
          
          if (letter.coveringLetter && letter.coveringLetter.attachedFile) {
            const coveringFile = letter.coveringLetter.attachedFile;
            console.log('Covering file record:', coveringFile ? {
              id: coveringFile.id,
              originalName: coveringFile.originalName,
              fileUrl: coveringFile.fileUrl,
              mimeType: coveringFile.mimeType
            } : 'Covering file not found');
            
            if (coveringFile && coveringFile.fileUrl) {
              console.log('⬇️ Downloading covering letter from URL:', coveringFile.fileUrl);
              
              // Call S3 service directly to avoid binding issues
              let downloadedFile;
              if (coveringFile.fileUrl.includes('s3.amazonaws.com') || coveringFile.fileUrl.includes('.s3.')) {
                console.log('☁️ Detected S3 URL, downloading from S3...');
                const s3Key = getS3Key(coveringFile.fileUrl);
                if (s3Key) {
                  console.log('🔑 S3 Key:', s3Key);
                  try {
                    const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
                    downloadedFile = {
                      content: fileBuffer,
                      contentType: 'application/pdf'
                    };
                    console.log('✅ S3 download successful for covering letter');
                  } catch (s3Error) {
                    console.error('❌ S3 download failed for covering letter:', s3Error.message);
                    console.log('🔄 Trying HTTP download as fallback for covering letter...');
                    // Fallback to HTTP download
                    const response = await axios.get(coveringFile.fileUrl, {
                      responseType: 'arraybuffer',
                      timeout: 30000
                    });
                    downloadedFile = {
                      content: Buffer.from(response.data),
                      contentType: response.headers['content-type'] || 'application/pdf'
                    };
                    console.log('✅ HTTP fallback download successful for covering letter');
                  }
                } else {
                  console.log('🔄 S3 key extraction failed for covering letter, trying HTTP download...');
                  // Fallback to HTTP download
                  const response = await axios.get(coveringFile.fileUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                  });
                  downloadedFile = {
                    content: Buffer.from(response.data),
                    contentType: response.headers['content-type'] || 'application/pdf'
                  };
                  console.log('✅ HTTP download successful for covering letter');
                }
              } else {
                // Use axios for non-S3 URLs
                const response = await axios.get(coveringFile.fileUrl, {
                  responseType: 'arraybuffer',
                  timeout: 30000
                });
                downloadedFile = {
                  content: Buffer.from(response.data),
                  contentType: response.headers['content-type'] || 'application/pdf'
                };
              }
              
              console.log('✅ Covering letter downloaded successfully, size:', downloadedFile.content.length, 'bytes');
              
              attachments.push({
                filename: `covering_letter_${letter.referenceNumber}.pdf`,
                content: downloadedFile.content,
                contentType: downloadedFile.contentType
              });
              console.log('📎 Covering letter added to attachments');
            } else if (coveringFile && coveringFile.filePath) {
              // Try using filePath if fileUrl is not available
              console.log('⬇️ Downloading covering letter from filePath:', coveringFile.filePath);
              const fileUrl = `http://localhost:5000/${coveringFile.filePath.replace(/\\/g, '/')}`;
              
              // Call S3 service directly to avoid binding issues
              let downloadedFile;
              if (fileUrl.includes('s3.amazonaws.com') || fileUrl.includes('.s3.')) {
                console.log('☁️ Detected S3 URL, downloading from S3...');
                const s3Key = getS3Key(fileUrl);
                if (s3Key) {
                  console.log('🔑 S3 Key:', s3Key);
                  const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
                  downloadedFile = {
                    content: fileBuffer,
                    contentType: 'application/pdf'
                  };
                } else {
                  throw new Error('Could not extract S3 key from URL');
                }
              } else {
                // Use axios for non-S3 URLs
                const response = await axios.get(fileUrl, {
                  responseType: 'arraybuffer',
                  timeout: 30000
                });
                downloadedFile = {
                  content: Buffer.from(response.data),
                  contentType: response.headers['content-type'] || 'application/pdf'
                };
              }
              
              console.log('✅ Covering letter downloaded successfully from filePath, size:', downloadedFile.content.length, 'bytes');
              
              attachments.push({
                filename: `covering_letter_${letter.referenceNumber}.pdf`,
                content: downloadedFile.content,
                contentType: downloadedFile.contentType
              });
              console.log('📎 Covering letter added to attachments (from filePath)');
            } else {
              console.log('❌ Covering file not found or no URL/filePath');
            }
          } else {
            console.log('❌ Covering letter not found or no attached file');
          }
        } catch (error) {
          console.error('❌ Error adding covering letter:', error);
          
          // Log detailed error information for debugging
          console.error('❌ Covering letter download failed. Detailed error info:');
          console.error('   - File URL:', letter.coveringLetter?.attachedFile?.fileUrl);
          console.error('   - File Path:', letter.coveringLetter?.attachedFile?.filePath);
          console.error('   - File ID:', letter.coveringLetter?.attachedFile?.id);
          console.error('   - Original Name:', letter.coveringLetter?.attachedFile?.originalName);
          
          // Try alternative download methods for covering letter
          if (letter.coveringLetter?.attachedFile?.filePath) {
            console.log('🔄 Trying alternative download from filePath for covering letter...');
            try {
              const fs = require('fs').promises;
              const path = require('path');
              
              // Try to read file directly from filesystem
              const fullPath = path.join(__dirname, '..', letter.coveringLetter.attachedFile.filePath);
              console.log('📁 Trying to read covering letter from filesystem:', fullPath);
              
              const content = await fs.readFile(fullPath);
              console.log('✅ Covering letter read successfully from filesystem, size:', content.length, 'bytes');
              
              attachments.push({
                filename: `covering_letter_${letter.referenceNumber}.pdf`,
                content: content,
                contentType: letter.coveringLetter.attachedFile.mimeType || 'application/pdf'
              });
              console.log('📎 Covering letter added to attachments (from filesystem)');
            } catch (fsError) {
              console.error('❌ Filesystem read for covering letter also failed:', fsError.message);
            }
          }
        }
      } else if (includeCoveringLetter && letter.coveringLetterId) {
        // Fallback: try to get covering letter directly if association failed
        try {
          console.log('📄 Fallback: Processing covering letter by coveringLetterId...');
          const coveringLetter = await CoveringLetter.findByPk(letter.coveringLetterId, {
            include: [
              {
                model: File,
                as: 'attachedFile'
              }
            ]
          });
          
          console.log('Covering letter record (fallback):', coveringLetter ? {
            id: coveringLetter.id,
            fileId: coveringLetter.fileId,
            hasAttachedFile: !!coveringLetter.attachedFile
          } : 'Covering letter not found');
          
          if (coveringLetter && coveringLetter.attachedFile) {
            const coveringFile = coveringLetter.attachedFile;
            console.log('Covering file record (fallback):', coveringFile ? {
              id: coveringFile.id,
              originalName: coveringFile.originalName,
              fileUrl: coveringFile.fileUrl,
              mimeType: coveringFile.mimeType
            } : 'Covering file not found');
            
            if (coveringFile && coveringFile.fileUrl) {
              console.log('⬇️ Downloading covering letter from URL (fallback):', coveringFile.fileUrl);
              
              // Call S3 service directly to avoid binding issues
              let downloadedFile;
              if (coveringFile.fileUrl.includes('s3.amazonaws.com') || coveringFile.fileUrl.includes('.s3.')) {
                console.log('☁️ Detected S3 URL, downloading from S3...');
                const s3Key = getS3Key(coveringFile.fileUrl);
                if (s3Key) {
                  console.log('🔑 S3 Key:', s3Key);
                  try {
                    const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
                    downloadedFile = {
                      content: fileBuffer,
                      contentType: 'application/pdf'
                    };
                    console.log('✅ S3 download successful for covering letter (fallback)');
                  } catch (s3Error) {
                    console.error('❌ S3 download failed for covering letter (fallback):', s3Error.message);
                    console.log('🔄 Trying HTTP download as fallback for covering letter (fallback)...');
                    // Fallback to HTTP download
                    const response = await axios.get(coveringFile.fileUrl, {
                      responseType: 'arraybuffer',
                      timeout: 30000
                    });
                    downloadedFile = {
                      content: Buffer.from(response.data),
                      contentType: response.headers['content-type'] || 'application/pdf'
                    };
                    console.log('✅ HTTP fallback download successful for covering letter (fallback)');
                  }
                } else {
                  console.log('🔄 S3 key extraction failed for covering letter (fallback), trying HTTP download...');
                  // Fallback to HTTP download
                  const response = await axios.get(coveringFile.fileUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                  });
                  downloadedFile = {
                    content: Buffer.from(response.data),
                    contentType: response.headers['content-type'] || 'application/pdf'
                  };
                  console.log('✅ HTTP download successful for covering letter (fallback)');
                }
              } else {
                // Use axios for non-S3 URLs
                const response = await axios.get(coveringFile.fileUrl, {
                  responseType: 'arraybuffer',
                  timeout: 30000
                });
                downloadedFile = {
                  content: Buffer.from(response.data),
                  contentType: response.headers['content-type'] || 'application/pdf'
                };
              }
              
              console.log('✅ Covering letter downloaded successfully (fallback), size:', downloadedFile.content.length, 'bytes');
              
              attachments.push({
                filename: `covering_letter_${letter.referenceNumber}.pdf`,
                content: downloadedFile.content,
                contentType: downloadedFile.contentType
              });
              console.log('📎 Covering letter added to attachments (fallback)');
            } else if (coveringFile && coveringFile.filePath) {
              // Try using filePath if fileUrl is not available
              console.log('⬇️ Downloading covering letter from filePath (fallback):', coveringFile.filePath);
              const fileUrl = `http://localhost:5000/${coveringFile.filePath.replace(/\\/g, '/')}`;
              
              // Call S3 service directly to avoid binding issues
              let downloadedFile;
              if (fileUrl.includes('s3.amazonaws.com') || fileUrl.includes('.s3.')) {
                console.log('☁️ Detected S3 URL, downloading from S3...');
                const s3Key = getS3Key(fileUrl);
                if (s3Key) {
                  console.log('🔑 S3 Key:', s3Key);
                  try {
                    const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
                    downloadedFile = {
                      content: fileBuffer,
                      contentType: 'application/pdf'
                    };
                    console.log('✅ S3 download successful for covering letter filePath (fallback)');
                  } catch (s3Error) {
                    console.error('❌ S3 download failed for covering letter filePath (fallback):', s3Error.message);
                    console.log('🔄 Trying HTTP download as fallback for covering letter filePath (fallback)...');
                    // Fallback to HTTP download
                    const response = await axios.get(fileUrl, {
                      responseType: 'arraybuffer',
                      timeout: 30000
                    });
                    downloadedFile = {
                      content: Buffer.from(response.data),
                      contentType: response.headers['content-type'] || 'application/pdf'
                    };
                    console.log('✅ HTTP fallback download successful for covering letter filePath (fallback)');
                  }
                } else {
                  console.log('🔄 S3 key extraction failed for covering letter filePath (fallback), trying HTTP download...');
                  // Fallback to HTTP download
                  const response = await axios.get(fileUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                  });
                  downloadedFile = {
                    content: Buffer.from(response.data),
                    contentType: response.headers['content-type'] || 'application/pdf'
                  };
                  console.log('✅ HTTP download successful for covering letter filePath (fallback)');
                }
              } else {
                // Use axios for non-S3 URLs
                const response = await axios.get(fileUrl, {
                  responseType: 'arraybuffer',
                  timeout: 30000
                });
                downloadedFile = {
                  content: Buffer.from(response.data),
                  contentType: response.headers['content-type'] || 'application/pdf'
                };
              }
              
              console.log('✅ Covering letter downloaded successfully from filePath (fallback), size:', downloadedFile.content.length, 'bytes');
              
              attachments.push({
                filename: `covering_letter_${letter.referenceNumber}.pdf`,
                content: downloadedFile.content,
                contentType: downloadedFile.contentType
              });
              console.log('📎 Covering letter added to attachments (fallback from filePath)');
            } else {
              console.log('❌ Covering file not found or no URL/filePath (fallback)');
            }
          } else {
            console.log('❌ Covering letter not found or no attached file (fallback)');
          }
        } catch (error) {
          console.error('❌ Error adding covering letter (fallback):', error);
          
          // Log detailed error information for debugging
          console.error('❌ Covering letter download failed (fallback). Detailed error info:');
          console.error('   - File URL:', coveringFile?.fileUrl);
          console.error('   - File Path:', coveringFile?.filePath);
          console.error('   - File ID:', coveringFile?.id);
          console.error('   - Original Name:', coveringFile?.originalName);
          
          // Try alternative download methods for covering letter (fallback)
          if (coveringFile?.filePath) {
            console.log('🔄 Trying alternative download from filePath for covering letter (fallback)...');
            try {
              const fs = require('fs').promises;
              const path = require('path');
              
              // Try to read file directly from filesystem
              const fullPath = path.join(__dirname, '..', coveringFile.filePath);
              console.log('📁 Trying to read covering letter from filesystem (fallback):', fullPath);
              
              const content = await fs.readFile(fullPath);
              console.log('✅ Covering letter read successfully from filesystem (fallback), size:', content.length, 'bytes');
              
              attachments.push({
                filename: `covering_letter_${letter.referenceNumber}.pdf`,
                content: content,
                contentType: coveringFile.mimeType || 'application/pdf'
              });
              console.log('📎 Covering letter added to attachments (from filesystem fallback)');
            } catch (fsError) {
              console.error('❌ Filesystem read for covering letter (fallback) also failed:', fsError.message);
            }
          }
        }
      } else {
        console.log('ℹ️ Covering letter not requested or not available');
      }

      console.log(`📎 Total attachments prepared: ${attachments.length}`);
      attachments.forEach((att, index) => {
        console.log(`  ${index + 1}. ${att.filename} (${att.contentType}) - ${att.content.length} bytes`);
      });

      // Check if we have any attachments
      if (attachments.length === 0) {
        console.log('❌ No attachments could be prepared');
        console.log('🔍 Debugging attachment preparation...');
        
        // Additional debugging
        console.log('Letter object keys:', Object.keys(letter));
        console.log('Letter associations:', {
          uploadedFile: !!letter.uploadedFile,
          coveringLetter: !!letter.coveringLetter,
          fileId: letter.fileId,
          coveringLetterId: letter.coveringLetterId
        });
        
        if (letter.uploadedFile) {
          console.log('UploadedFile details:', JSON.stringify(letter.uploadedFile, null, 2));
        }
        
        if (letter.coveringLetter) {
          console.log('CoveringLetter details:', JSON.stringify(letter.coveringLetter, null, 2));
        }
        
        return res.status(400).json({
          error: 'No PDF attachments could be prepared. The files may be inaccessible or corrupted. Please check the file URLs and ensure the files exist.',
          details: {
            hasUploadedFile: !!letter.uploadedFile,
            hasCoveringLetter: !!letter.coveringLetter,
            fileId: letter.fileId,
            coveringLetterId: letter.coveringLetterId,
            uploadedFileUrl: letter.uploadedFile?.fileUrl,
            uploadedFilePath: letter.uploadedFile?.filePath,
            coveringFileUrl: letter.coveringLetter?.attachedFile?.fileUrl,
            coveringFilePath: letter.coveringLetter?.attachedFile?.filePath
          }
        });
      }
      
      // Log what attachments we have
      console.log(`📎 Final attachments prepared: ${attachments.length}`);
      attachments.forEach((att, index) => {
        console.log(`  ${index + 1}. ${att.filename} (${att.contentType}) - ${att.content.length} bytes`);
      });

      // Set the sender email in environment temporarily
      process.env.EMAIL_FROM = sender.email;
      process.env.EMAIL_FROM_NAME = sender.name;

      // Prepare email content
      const subject = `Inward Letter - ${letter.referenceNumber} - ${letter.officeSendingLetter}`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
            Inward Letter Notification
          </h2>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #34495e; margin-top: 0;">Letter Details:</h3>
            <p><strong>Reference Number:</strong> ${letter.referenceNumber || 'N/A'}</p>
            <p><strong>Office:</strong> ${letter.officeSendingLetter || 'N/A'}</p>
            <p><strong>Subject:</strong> ${letter.subject || 'N/A'}</p>
            <p><strong>Date Received:</strong> ${new Date(letter.dateReceived).toLocaleDateString()}</p>
            <p><strong>Sender:</strong> ${letter.senderNameAndDesignation || 'N/A'}</p>
          </div>

          ${customMessage ? `
          <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="color: #27ae60; margin-top: 0;">Additional Message:</h4>
            <p style="margin: 0;">${customMessage}</p>
          </div>
          ` : ''}

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="color: #856404; margin-top: 0;">Attachments:</h4>
            <ul style="margin: 0;">
              <li>Main Letter Document</li>
              ${includeCoveringLetter && letter.coveringLetter ? '<li>Covering Letter</li>' : ''}
            </ul>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #7f8c8d; font-size: 12px;">
            <p>This is an automated notification from the Police Department Letter Management System.</p>
            <p>Sent on: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `;

      const textContent = `
Inward Letter Notification

Letter Details:
- Reference Number: ${letter.referenceNumber || 'N/A'}
- Office: ${letter.officeSendingLetter || 'N/A'}
- Subject: ${letter.subject || 'N/A'}
- Date Received: ${new Date(letter.dateReceived).toLocaleDateString()}
- Sender: ${letter.senderNameAndDesignation || 'N/A'}

${customMessage ? `Additional Message: ${customMessage}\n` : ''}

Attachments:
- Main Letter Document
${includeCoveringLetter && letter.coveringLetter ? '- Covering Letter\n' : ''}

This is an automated notification from the Police Department Letter Management System.
Sent on: ${new Date().toLocaleString()}
      `;

      // Send emails to all recipients
      const results = [];
      let processedCount = 0;
      
      console.log(`Starting inward letter email to ${receiverDetails.length} recipients with ${attachments.length} attachments`);
      
      for (const receiver of receiverDetails) {
        try {
          console.log(`Sending inward letter email ${processedCount + 1}/${receiverDetails.length} to: ${receiver.email} (${receiver.designation})`);
          
          const result = await emailService.sendEmailWithAttachments(
            receiver.email,
            subject,
            htmlContent,
            textContent,
            attachments
          );

          results.push({
            email: receiver.email,
            name: receiver.name,
            designation: receiver.designation,
            success: true,
            messageId: result.messageId
          });
          
          console.log(`✓ Inward letter email sent successfully to: ${receiver.email} (${receiver.designation})`);
        } catch (error) {
          console.error(`✗ Failed to send inward letter email to: ${receiver.email} (${receiver.designation})`, error.message);
          results.push({
            email: receiver.email,
            name: receiver.name,
            designation: receiver.designation,
            success: false,
            error: error.message
          });
        }
        
        processedCount++;
        
        // Add a small delay between emails to avoid rate limiting
        if (processedCount < receiverDetails.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      console.log(`Inward letter email completed: ${successCount} successful, ${failureCount} failed`);

      // Update letter status to sent
      await InwardPatra.update(
        { 
          letterStatus: 'sent to head',
          sentAt: new Date(),
          sentTo: JSON.stringify(recipients),
          emailSent: true,
          emailSentAt: new Date()
        },
        { where: { id: letterId } }
      );

      res.json({
        success: true,
        message: `Inward letter email processed: ${successCount} sent, ${failureCount} failed`,
        data: {
          letterId: letterId,
          referenceNumber: letter.referenceNumber,
          from: sender.email,
          totalReceivers: receiverDetails.length,
          successful: successCount,
          failed: failureCount,
          attachments: attachments.length,
          results
        }
      });
    } catch (error) {
      console.error('Send inward letter email error:', error);
      res.status(500).json({
        error: 'Failed to send inward letter email',
        details: error.message
      });
    }
  }

  // Send email from sender to single receiver
  async sendSingleEmail(req, res) {
    try {
      const { senderId, receiverId, subject, htmlContent, textContent, attachments } = req.body;

      if (!senderId || !receiverId || !subject || !htmlContent) {
        return res.status(400).json({
          error: 'Sender ID, Receiver ID, subject, and HTML content are required'
        });
      }

      // Get sender details
      const sender = await EmailSender.findByPk(senderId);
      if (!sender || !sender.isActive) {
        return res.status(404).json({
          error: 'Active sender not found'
        });
      }

      // Get receiver details
      const receiver = await EmailReceiver.findByPk(receiverId);
      if (!receiver || !receiver.isActive) {
        return res.status(404).json({
          error: 'Active receiver not found'
        });
      }

      // Set the sender email in environment temporarily
      process.env.EMAIL_FROM = sender.email;
      process.env.EMAIL_FROM_NAME = sender.name;

      // Send email
      const result = await emailService.sendEmail(
        receiver.email,
        subject,
        htmlContent,
        textContent,
        attachments
      );

      res.json({
        success: true,
        message: 'Email sent successfully',
        data: {
          from: sender.email,
          to: receiver.email,
          messageId: result.messageId
        }
      });
    } catch (error) {
      console.error('Send single email error:', error);
      res.status(500).json({
        error: 'Failed to send email',
        details: error.message
      });
    }
  }

  // Send email from sender to multiple receivers with attachments
  async sendBulkEmail(req, res) {
    try {
      const { senderId, receiverIds, subject, htmlContent, textContent, attachments } = req.body;

      if (!senderId || !receiverIds || !Array.isArray(receiverIds) || receiverIds.length === 0) {
        return res.status(400).json({
          error: 'Sender ID and receiver IDs array are required'
        });
      }

      if (!subject || !htmlContent) {
        return res.status(400).json({
          error: 'Subject and HTML content are required'
        });
      }

      // Get sender details
      const sender = await EmailSender.findByPk(senderId);
      if (!sender || !sender.isActive) {
        return res.status(404).json({
          error: 'Active sender not found'
        });
      }

      // Get all receivers
      const receivers = await EmailReceiver.findAll({
        where: {
          id: receiverIds,
          isActive: true
        }
      });

      if (receivers.length === 0) {
        return res.status(404).json({
          error: 'No active receivers found'
        });
      }

      // Set the sender email in environment temporarily
      process.env.EMAIL_FROM = sender.email;
      process.env.EMAIL_FROM_NAME = sender.name;

      console.log(`Starting bulk email to ${receivers.length} recipients with ${attachments ? attachments.length : 0} attachments`);

      // Send emails to all receivers with progress tracking
      const results = [];
      let processedCount = 0;
      
      for (const receiver of receivers) {
        try {
          console.log(`Sending email ${processedCount + 1}/${receivers.length} to: ${receiver.email}`);
          
          const result = await emailService.sendEmailWithAttachments(
            receiver.email,
            subject,
            htmlContent,
            textContent,
            attachments || []
          );

          results.push({
            receiverId: receiver.id,
            email: receiver.email,
            name: receiver.name,
            designation: receiver.designation,
            success: true,
            messageId: result.messageId
          });
          
          console.log(`✓ Email sent successfully to: ${receiver.email}`);
        } catch (error) {
          console.error(`✗ Failed to send email to: ${receiver.email}`, error.message);
          results.push({
            receiverId: receiver.id,
            email: receiver.email,
            name: receiver.name,
            designation: receiver.designation,
            success: false,
            error: error.message
          });
        }
        
        processedCount++;
        
        // Add a small delay between emails to avoid rate limiting
        if (processedCount < receivers.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      console.log(`Bulk email completed: ${successCount} successful, ${failureCount} failed`);

      res.json({
        success: true,
        message: `Bulk email processed: ${successCount} sent, ${failureCount} failed`,
        data: {
          from: sender.email,
          totalReceivers: receivers.length,
          successful: successCount,
          failed: failureCount,
          attachmentCount: attachments ? attachments.length : 0,
          results,
          summary: {
            totalProcessed: processedCount,
            successRate: `${((successCount / receivers.length) * 100).toFixed(1)}%`,
            processingTime: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      console.error('Send bulk email error:', error);
      res.status(500).json({
        error: 'Failed to send bulk email',
        details: error.message
      });
    }
  }

  // Send email using email addresses (search or create)
  async sendDynamicEmail(req, res) {
    try {
      const { 
        senderEmail, 
        receiverEmails, 
        subject, 
        htmlContent, 
        textContent, 
        attachments,
        createIfNotExists = true 
      } = req.body;

      if (!senderEmail || !receiverEmails || !Array.isArray(receiverEmails) || receiverEmails.length === 0) {
        return res.status(400).json({
          error: 'Sender email and receiver emails array are required'
        });
      }

      if (!subject || !htmlContent) {
        return res.status(400).json({
          error: 'Subject and HTML content are required'
        });
      }

      // Find or create sender
      let sender = await EmailSender.findOne({ where: { email: senderEmail } });
      
      if (!sender && createIfNotExists) {
        // Extract name from email if not exists
        const senderName = senderEmail.split('@')[0].replace(/[._-]/g, ' ');
        sender = await EmailSender.create({
          email: senderEmail,
          name: senderName,
          designation: 'Officer',
          department: 'General'
        });
      } else if (!sender) {
        return res.status(404).json({
          error: 'Sender not found and createIfNotExists is false'
        });
      }

      // Find or create receivers
      const receivers = [];
      for (const email of receiverEmails) {
        let receiver = await EmailReceiver.findOne({ where: { email } });
        
        if (!receiver && createIfNotExists) {
          const receiverName = email.split('@')[0].replace(/[._-]/g, ' ');
          receiver = await EmailReceiver.create({
            email: email,
            name: receiverName,
            designation: 'Recipient',
            department: 'General'
          });
        }
        
        if (receiver && receiver.isActive) {
          receivers.push(receiver);
        }
      }

      if (receivers.length === 0) {
        return res.status(404).json({
          error: 'No valid receivers found'
        });
      }

      // Set the sender email in environment temporarily
      process.env.EMAIL_FROM = sender.email;
      process.env.EMAIL_FROM_NAME = sender.name;

      // Send emails
      const results = [];
      for (const receiver of receivers) {
        try {
          const result = await emailService.sendEmail(
            receiver.email,
            subject,
            htmlContent,
            textContent,
            attachments
          );

          results.push({
            email: receiver.email,
            success: true,
            messageId: result.messageId
          });
        } catch (error) {
          results.push({
            email: receiver.email,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        message: `Dynamic email processed: ${successCount} sent, ${failureCount} failed`,
        data: {
          from: sender.email,
          totalReceivers: receivers.length,
          successful: successCount,
          failed: failureCount,
          results
        }
      });
    } catch (error) {
      console.error('Send dynamic email error:', error);
      res.status(500).json({
        error: 'Failed to send dynamic email',
        details: error.message
      });
    }
  }

  // Send email with attachments from sender to receivers
  async sendEmailWithAttachments(req, res) {
    try {
      const { senderId, receiverIds, subject, htmlContent, textContent, attachments, letterId, includeCoveringLetter = true } = req.body;

      if (!senderId || !receiverIds || !Array.isArray(receiverIds) || receiverIds.length === 0) {
        return res.status(400).json({
          error: 'Sender ID and receiver IDs array are required'
        });
      }

      if (!subject || !htmlContent) {
        return res.status(400).json({
          error: 'Subject and HTML content are required'
        });
      }

      let finalAttachments = attachments || [];

      // If letterId is provided, prepare attachments from the letter
      if (letterId) {
        console.log('📝 Preparing attachments from letter ID:', letterId);
        
        // Get the letter details with associations
        const letter = await InwardPatra.findByPk(letterId, {
          include: [
            {
              model: File,
              as: 'uploadedFile'
            },
            {
              model: CoveringLetter,
              as: 'coveringLetter',
              include: [
                {
                  model: File,
                  as: 'attachedFile'
                }
              ]
            }
          ]
        });

        if (!letter) {
          return res.status(404).json({
            error: 'Letter not found'
          });
        }

        console.log('📝 Letter found with associations:', {
          id: letter.id,
          referenceNumber: letter.referenceNumber,
          hasUploadedFile: !!letter.uploadedFile,
          hasCoveringLetter: !!letter.coveringLetter,
          uploadedFileId: letter.fileId,
          coveringLetterId: letter.coveringLetterId
        });

        // Prepare attachments from letter
        const letterAttachments = [];
        
        // Add main letter file
        if (letter.uploadedFile) {
          console.log('📄 Processing main letter file via association...');
          try {
            const file = letter.uploadedFile;
            console.log('File record from association:', file ? {
              id: file.id,
              originalName: file.originalName,
              fileUrl: file.fileUrl,
              mimeType: file.mimeType,
              filePath: file.filePath
            } : 'File not found');
            
            if (file && file.fileUrl) {
              console.log('⬇️ Downloading file from URL:', file.fileUrl);
              
              let downloadedFile;
              if (file.fileUrl.includes('s3.amazonaws.com') || file.fileUrl.includes('.s3.')) {
                console.log('☁️ Detected S3 URL, downloading from S3...');
                const s3Key = this.extractS3KeyFromUrl(file.fileUrl);
                if (s3Key) {
                  console.log('🔑 S3 Key:', s3Key);
                  const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
                  downloadedFile = {
                    content: fileBuffer,
                    contentType: 'application/pdf'
                  };
                } else {
                  throw new Error('Could not extract S3 key from URL');
                }
              } else {
                const response = await axios.get(file.fileUrl, {
                  responseType: 'arraybuffer',
                  timeout: 30000
                });
                downloadedFile = {
                  content: Buffer.from(response.data),
                  contentType: response.headers['content-type'] || 'application/pdf'
                };
              }
              
              console.log('✅ File downloaded successfully, size:', downloadedFile.content.length, 'bytes');
              
              letterAttachments.push({
                filename: file.originalName || 'letter.pdf',
                content: downloadedFile.content,
                contentType: downloadedFile.contentType
              });
              console.log('📎 Main letter file added to attachments');
            } else if (file && file.filePath) {
              console.log('⬇️ Downloading file from filePath:', file.filePath);
              const fileUrl = `http://localhost:5000/${file.filePath.replace(/\\/g, '/')}`;
              
              let downloadedFile;
              if (fileUrl.includes('s3.amazonaws.com') || fileUrl.includes('.s3.')) {
                console.log('☁️ Detected S3 URL, downloading from S3...');
                const s3Key = this.extractS3KeyFromUrl(fileUrl);
                if (s3Key) {
                  console.log('🔑 S3 Key:', s3Key);
                  const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
                  downloadedFile = {
                    content: fileBuffer,
                    contentType: 'application/pdf'
                  };
                } else {
                  throw new Error('Could not extract S3 key from URL');
                }
              } else {
                const response = await axios.get(fileUrl, {
                  responseType: 'arraybuffer',
                  timeout: 30000
                });
                downloadedFile = {
                  content: Buffer.from(response.data),
                  contentType: response.headers['content-type'] || 'application/pdf'
                };
              }
              
              console.log('✅ File downloaded successfully from filePath, size:', downloadedFile.content.length, 'bytes');
              
              letterAttachments.push({
                filename: file.originalName || 'letter.pdf',
                content: downloadedFile.content,
                contentType: downloadedFile.contentType
              });
              console.log('📎 Main letter file added to attachments (from filePath)');
            }
          } catch (error) {
            console.error('❌ Error adding main letter file:', error);
          }
        } else if (letter.fileId) {
          // Fallback: try to get file directly if association failed
          console.log('📄 Fallback: Processing main letter file by fileId...');
          try {
            const file = await File.findByPk(letter.fileId);
            if (file && file.fileUrl) {
              console.log('⬇️ Downloading file from URL (fallback):', file.fileUrl);
              
              let downloadedFile;
              if (file.fileUrl.includes('s3.amazonaws.com') || file.fileUrl.includes('.s3.')) {
                console.log('☁️ Detected S3 URL, downloading from S3...');
                const s3Key = this.extractS3KeyFromUrl(file.fileUrl);
                if (s3Key) {
                  console.log('🔑 S3 Key:', s3Key);
                  const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
                  downloadedFile = {
                    content: fileBuffer,
                    contentType: 'application/pdf'
                  };
                } else {
                  throw new Error('Could not extract S3 key from URL');
                }
              } else {
                const response = await axios.get(file.fileUrl, {
                  responseType: 'arraybuffer',
                  timeout: 30000
                });
                downloadedFile = {
                  content: Buffer.from(response.data),
                  contentType: response.headers['content-type'] || 'application/pdf'
                };
              }
              
              console.log('✅ File downloaded successfully (fallback), size:', downloadedFile.content.length, 'bytes');
              
              letterAttachments.push({
                filename: file.originalName || 'letter.pdf',
                content: downloadedFile.content,
                contentType: downloadedFile.contentType
              });
              console.log('📎 Main letter file added to attachments (fallback)');
            }
          } catch (error) {
            console.error('❌ Error adding main letter file (fallback):', error);
          }
        }

        // Add covering letter if requested and exists
        if (includeCoveringLetter && letter.coveringLetter) {
          try {
            console.log('📄 Processing covering letter...');
            if (letter.coveringLetter && letter.coveringLetter.attachedFile) {
              const coveringFile = letter.coveringLetter.attachedFile;
              
              if (coveringFile && coveringFile.fileUrl) {
                console.log('⬇️ Downloading covering letter from URL:', coveringFile.fileUrl);
                
                let downloadedFile;
                if (coveringFile.fileUrl.includes('s3.amazonaws.com') || coveringFile.fileUrl.includes('.s3.')) {
                  console.log('☁️ Detected S3 URL, downloading from S3...');
                  const s3Key = this.extractS3KeyFromUrl(coveringFile.fileUrl);
                  if (s3Key) {
                    console.log('🔑 S3 Key:', s3Key);
                    const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
                    downloadedFile = {
                      content: fileBuffer,
                      contentType: 'application/pdf'
                    };
                  } else {
                    throw new Error('Could not extract S3 key from URL');
                  }
                } else {
                  const response = await axios.get(coveringFile.fileUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                  });
                  downloadedFile = {
                    content: Buffer.from(response.data),
                    contentType: response.headers['content-type'] || 'application/pdf'
                  };
                }
                
                console.log('✅ Covering letter downloaded successfully, size:', downloadedFile.content.length, 'bytes');
                
                letterAttachments.push({
                  filename: `covering_letter_${letter.referenceNumber}.pdf`,
                  content: downloadedFile.content,
                  contentType: downloadedFile.contentType
                });
                console.log('📎 Covering letter added to attachments');
              }
            }
          } catch (error) {
            console.error('❌ Error adding covering letter:', error);
          }
        } else if (includeCoveringLetter && letter.coveringLetterId) {
          // Fallback: try to get covering letter directly if association failed
          try {
            console.log('📄 Fallback: Processing covering letter by coveringLetterId...');
            const coveringLetter = await CoveringLetter.findByPk(letter.coveringLetterId, {
              include: [
                {
                  model: File,
                  as: 'attachedFile'
                }
              ]
            });
            
            if (coveringLetter && coveringLetter.attachedFile) {
              const coveringFile = coveringLetter.attachedFile;
              
              if (coveringFile && coveringFile.fileUrl) {
                console.log('⬇️ Downloading covering letter from URL (fallback):', coveringFile.fileUrl);
                
                let downloadedFile;
                if (coveringFile.fileUrl.includes('s3.amazonaws.com') || coveringFile.fileUrl.includes('.s3.')) {
                  console.log('☁️ Detected S3 URL, downloading from S3...');
                  const s3Key = this.extractS3KeyFromUrl(coveringFile.fileUrl);
                  if (s3Key) {
                    console.log('🔑 S3 Key:', s3Key);
                    const fileBuffer = await s3Service.downloadFileFromS3(s3Key);
                    downloadedFile = {
                      content: fileBuffer,
                      contentType: 'application/pdf'
                    };
                  } else {
                    throw new Error('Could not extract S3 key from URL');
                  }
                } else {
                  const response = await axios.get(coveringFile.fileUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                  });
                  downloadedFile = {
                    content: Buffer.from(response.data),
                    contentType: response.headers['content-type'] || 'application/pdf'
                  };
                }
                
                console.log('✅ Covering letter downloaded successfully (fallback), size:', downloadedFile.content.length, 'bytes');
                
                letterAttachments.push({
                  filename: `covering_letter_${letter.referenceNumber}.pdf`,
                  content: downloadedFile.content,
                  contentType: downloadedFile.contentType
                });
                console.log('📎 Covering letter added to attachments (fallback)');
              }
            }
          } catch (error) {
            console.error('❌ Error adding covering letter (fallback):', error);
          }
        }

        console.log(`📎 Total letter attachments prepared: ${letterAttachments.length}`);
        
        // Combine letter attachments with any provided attachments
        finalAttachments = [...letterAttachments, ...finalAttachments];
        
        if (letterAttachments.length === 0) {
          return res.status(400).json({
            error: 'No PDF attachments could be prepared from the letter. The files may be inaccessible or corrupted. Please check the file URLs and ensure the files exist.',
            details: {
              hasUploadedFile: !!letter.uploadedFile,
              hasCoveringLetter: !!letter.coveringLetter,
              fileId: letter.fileId,
              coveringLetterId: letter.coveringLetterId,
              uploadedFileUrl: letter.uploadedFile?.fileUrl,
              uploadedFilePath: letter.uploadedFile?.filePath,
              coveringFileUrl: letter.coveringLetter?.attachedFile?.fileUrl,
              coveringFilePath: letter.coveringLetter?.attachedFile?.filePath
            }
          });
        }
      }

      if (finalAttachments.length === 0) {
        return res.status(400).json({
          error: 'At least one attachment is required'
        });
      }

      // Get sender details
      const sender = await EmailSender.findByPk(senderId);
      if (!sender || !sender.isActive) {
        return res.status(404).json({
          error: 'Active sender not found'
        });
      }

      // Get all receivers
      const receivers = await EmailReceiver.findAll({
        where: {
          id: receiverIds,
          isActive: true
        }
      });

      if (receivers.length === 0) {
        return res.status(404).json({
          error: 'No active receivers found'
        });
      }

      // Set the sender email in environment temporarily
      process.env.EMAIL_FROM = sender.email;
      process.env.EMAIL_FROM_NAME = sender.name;

      // Send emails with attachments
      const results = [];
      for (const receiver of receivers) {
        try {
          const result = await emailService.sendEmailWithAttachments(
            receiver.email,
            subject,
            htmlContent,
            textContent,
            finalAttachments
          );

          results.push({
            receiverId: receiver.id,
            email: receiver.email,
            success: true,
            messageId: result.messageId
          });
        } catch (error) {
          results.push({
            receiverId: receiver.id,
            email: receiver.email,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        message: `Emails with attachments processed: ${successCount} sent, ${failureCount} failed`,
        data: {
          from: sender.email,
          totalReceivers: receivers.length,
          successful: successCount,
          failed: failureCount,
          attachmentCount: finalAttachments.length,
          results
        }
      });
    } catch (error) {
      console.error('Send email with attachments error:', error);
      res.status(500).json({
        error: 'Failed to send emails with attachments',
        details: error.message
      });
    }
  }

  // Get all available senders and receivers
  async getEmailContacts(req, res) {
    try {
      const [senders, receivers] = await Promise.all([
        EmailSender.findAll({
          where: { isActive: true },
          attributes: ['id', 'name', 'email', 'designation', 'department']
        }),
        EmailReceiver.findAll({
          where: { isActive: true },
          attributes: ['id', 'name', 'email', 'designation', 'department']
        })
      ]);

      res.json({
        success: true,
        data: {
          senders,
          receivers,
          totalSenders: senders.length,
          totalReceivers: receivers.length
        }
      });
    } catch (error) {
      console.error('Get email contacts error:', error);
      res.status(500).json({
        error: 'Failed to fetch email contacts',
        details: error.message
      });
    }
  }
}

module.exports = new DynamicEmailController();