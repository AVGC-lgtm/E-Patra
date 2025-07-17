const emailService = require('../services/emailService');
const { verifyEmailConfig } = require('../config/email');




class EmailController {
  // Send test email

  // Add this method to your emailController.js

// Send bulk emails with attachments
async sendBulkEmailsWithAttachment(req, res) {
    try {
      const { recipients, subject, htmlContent, textContent, attachments } = req.body;
      
      if (!recipients || !Array.isArray(recipients) || !subject || !htmlContent) {
        return res.status(400).json({
          error: 'Recipients array, subject, and HTML content are required'
        });
      }
      
      if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
        return res.status(400).json({
          error: 'At least one attachment is required'
        });
      }
      
      const results = [];
      
      for (const recipient of recipients) {
        try {
          const result = await emailService.sendEmailWithAttachments(
            recipient,
            subject,
            htmlContent,
            textContent,
            attachments
          );
          
          results.push({
            recipient,
            success: true,
            messageId: result.messageId
          });
        } catch (error) {
          results.push({
            recipient,
            success: false,
            error: error.message
          });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      res.json({
        success: true,
        message: `Bulk emails with attachments processed: ${successCount} successful, ${failureCount} failed`,
        results,
        summary: {
          total: recipients.length,
          successful: successCount,
          failed: failureCount,
          attachments: attachments.length
        }
      });
    } catch (error) {
      console.error('Bulk email with attachment error:', error);
      res.status(500).json({
        error: 'Failed to send bulk emails with attachments',
        details: error.message
      });
    }
  }

  async sendTestEmail(req, res) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          error: 'Email address is required'
        });
      }
      
      const result = await emailService.testEmail(email);
      
      res.json({
        success: true,
        message: 'Test email sent successfully',
        messageId: result.messageId
      });
    } catch (error) {
      console.error('Test email error:', error);
      res.status(500).json({
        error: 'Failed to send test email',
        details: error.message
      });
    }
  }

  // Send acknowledgment email manually
  async sendAcknowledgment(req, res) {
    try {
      const { email, applicationData } = req.body;
      
      if (!email || !applicationData) {
        return res.status(400).json({
          error: 'Email and application data are required'
        });
      }
      
      const result = await emailService.sendApplicationAcknowledgment(email, applicationData);
      
      res.json({
        success: true,
        message: 'Acknowledgment email sent successfully',
        messageId: result.messageId
      });
    } catch (error) {
      console.error('Acknowledgment email error:', error);
      res.status(500).json({
        error: 'Failed to send acknowledgment email',
        details: error.message
      });
    }
  }

  // Send status update email manually
  async sendStatusUpdate(req, res) {
    try {
      const { email, applicationData, newStatus, remarks } = req.body;
      
      if (!email || !applicationData || !newStatus) {
        return res.status(400).json({
          error: 'Email, application data, and new status are required'
        });
      }
      
      const result = await emailService.sendStatusUpdate(email, applicationData, newStatus, remarks);
      
      res.json({
        success: true,
        message: 'Status update email sent successfully',
        messageId: result.messageId
      });
    } catch (error) {
      console.error('Status update email error:', error);
      res.status(500).json({
        error: 'Failed to send status update email',
        details: error.message
      });
    }
  }

  // Send forwarding notification email manually
  async sendForwardingNotification(req, res) {
    try {
      const { emails, letterData, forwardedTo } = req.body;
      
      if (!emails || !letterData || !forwardedTo) {
        return res.status(400).json({
          error: 'Emails, letter data, and forwarded to information are required'
        });
      }
      
      const results = [];
      
      for (const email of emails) {
        try {
          const result = await emailService.sendLetterForwardingNotification(email, letterData, forwardedTo);
          results.push({
            email,
            success: true,
            messageId: result.messageId
          });
        } catch (error) {
          results.push({
            email,
            success: false,
            error: error.message
          });
        }
      }
      
      res.json({
        success: true,
        message: 'Forwarding notification emails processed',
        results
      });
    } catch (error) {
      console.error('Forwarding notification email error:', error);
      res.status(500).json({
        error: 'Failed to send forwarding notification emails',
        details: error.message
      });
    }
  }

  // Send bulk emails
  async sendBulkEmails(req, res) {
    try {
      const { recipients, subject, htmlContent, textContent } = req.body;
      
      if (!recipients || !subject || !htmlContent) {
        return res.status(400).json({
          error: 'Recipients, subject, and HTML content are required'
        });
      }
      
      const results = await emailService.sendBulkEmails(recipients, subject, htmlContent, textContent);
      
      res.json({
        success: true,
        message: 'Bulk emails processed',
        results
      });
    } catch (error) {
      console.error('Bulk email error:', error);
      res.status(500).json({
        error: 'Failed to send bulk emails',
        details: error.message
      });
    }
  }

  // Send email with attachment
  async sendEmailWithAttachment(req, res) {
    try {
      const { email, subject, htmlContent, filePath, fileName } = req.body;
      
      if (!email || !subject || !htmlContent || !filePath || !fileName) {
        return res.status(400).json({
          error: 'Email, subject, HTML content, file path, and file name are required'
        });
      }
      
      const result = await emailService.sendEmailWithAttachment(email, subject, htmlContent, filePath, fileName);
      
      res.json({
        success: true,
        message: 'Email with attachment sent successfully',
        messageId: result.messageId
      });
    } catch (error) {
      console.error('Email with attachment error:', error);
      res.status(500).json({
        error: 'Failed to send email with attachment',
        details: error.message
      });
    }
  }

  // Check email configuration
  async checkEmailConfig(req, res) {
    try {
      const isValid = await verifyEmailConfig();
      
      res.json({
        success: true,
        configured: isValid,
        message: isValid ? 'Email configuration is valid' : 'Email configuration is invalid'
      });
    } catch (error) {
      console.error('Email config check error:', error);
      res.status(500).json({
        error: 'Failed to check email configuration',
        details: error.message
      });
    }
  }

  // Get email statistics (you can implement this based on your logging needs)
  async getEmailStats(req, res) {
    try {
      // This is a placeholder - implement based on your logging system
      const stats = {
        totalSent: 0,
        successful: 0,
        failed: 0,
        lastSent: null
      };
      
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Email stats error:', error);
      res.status(500).json({
        error: 'Failed to get email statistics',
        details: error.message
      });
    }
  }
}



module.exports = new EmailController();