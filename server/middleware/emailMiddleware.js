const emailService = require('../services/emailService');

// Middleware to send acknowledgment email after letter submission
const sendAcknowledgmentEmail = async (req, res, next) => {
  try {
    // This middleware runs after successful letter creation
    const { letterData, userEmail } = req.body;
    
    if (letterData && userEmail) {
      // Send acknowledgment email in background
      setImmediate(async () => {
        try {
          await emailService.sendApplicationAcknowledgment(userEmail, letterData);
          console.log(`Acknowledgment email sent to ${userEmail}`);
        } catch (error) {
          console.error('Failed to send acknowledgment email:', error);
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Email middleware error:', error);
    next(); // Continue even if email fails
  }
};

// Middleware to send status update email
const sendStatusUpdateEmail = async (req, res, next) => {
  try {
    const { letterData, userEmail, newStatus, remarks } = req.body;
    
    if (letterData && userEmail && newStatus) {
      // Send status update email in background
      setImmediate(async () => {
        try {
          await emailService.sendStatusUpdate(userEmail, letterData, newStatus, remarks);
          console.log(`Status update email sent to ${userEmail}`);
        } catch (error) {
          console.error('Failed to send status update email:', error);
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Email middleware error:', error);
    next(); // Continue even if email fails
  }
};

// Middleware to send forwarding notification email
const sendForwardingNotification = async (req, res, next) => {
  try {
    const { letterData, recipientEmails, forwardedTo } = req.body;
    
    if (letterData && recipientEmails && recipientEmails.length > 0) {
      // Send forwarding notification emails in background
      setImmediate(async () => {
        try {
          for (const email of recipientEmails) {
            await emailService.sendLetterForwardingNotification(email, letterData, forwardedTo);
          }
          console.log(`Forwarding notification emails sent to ${recipientEmails.join(', ')}`);
        } catch (error) {
          console.error('Failed to send forwarding notification emails:', error);
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Email middleware error:', error);
    next(); // Continue even if email fails
  }
};

// Middleware to validate email configuration
const validateEmailConfig = async (req, res, next) => {
  try {
    const { verifyEmailConfig } = require('../config/email');
    const isValid = await verifyEmailConfig();
    
    if (!isValid) {
      return res.status(500).json({
        error: 'Email service is not configured properly'
      });
    }
    
    next();
  } catch (error) {
    console.error('Email config validation error:', error);
    return res.status(500).json({
      error: 'Email service validation failed'
    });
  }
};

module.exports = {
  sendAcknowledgmentEmail,
  sendStatusUpdateEmail,
  sendForwardingNotification,
  validateEmailConfig
};