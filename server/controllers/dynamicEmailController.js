// controllers/dynamicEmailController.js
const emailService = require('../services/emailService');
const EmailSender = require('../models/EmailSender');
const EmailReceiver = require('../models/EmailReceiver');

class DynamicEmailController {
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

  // Send email from sender to multiple receivers
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

      // Send emails to all receivers
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
        message: `Bulk email processed: ${successCount} sent, ${failureCount} failed`,
        data: {
          from: sender.email,
          totalReceivers: receivers.length,
          successful: successCount,
          failed: failureCount,
          results
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

      if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
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
            attachments
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
          attachmentCount: attachments.length,
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