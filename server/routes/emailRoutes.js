const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { validateEmailConfig } = require('../middleware/emailMiddleware');

// Middleware to validate email config for all routes
router.use(validateEmailConfig);

// Test email endpoint
router.post('/test', emailController.sendTestEmail);

// Send acknowledgment email
router.post('/acknowledgment', emailController.sendAcknowledgment);

// Send status update email
router.post('/status-update', emailController.sendStatusUpdate);

// Send forwarding notification
router.post('/forwarding-notification', emailController.sendForwardingNotification);

// Send bulk emails
router.post('/bulk', emailController.sendBulkEmails);

// Send email with attachment
router.post('/attachment', emailController.sendEmailWithAttachment);

// Check email configuration
router.get('/config/check', emailController.checkEmailConfig);


// Get email statistics
router.get('/stats', emailController.getEmailStats);

router.post('/bulk-attachment', emailController.sendBulkEmailsWithAttachment);

module.exports = router;