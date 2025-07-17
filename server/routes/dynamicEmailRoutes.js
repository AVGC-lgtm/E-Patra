// routes/dynamicEmailRoutes.js
const express = require('express');
const router = express.Router();
const dynamicEmailController = require('../controllers/dynamicEmailController');

// Dynamic email routes
router.post('/send-single', dynamicEmailController.sendSingleEmail);
router.post('/send-bulk', dynamicEmailController.sendBulkEmail);
router.post('/send-dynamic', dynamicEmailController.sendDynamicEmail);
router.post('/send-with-attachments', dynamicEmailController.sendEmailWithAttachments);
router.get('/contacts', dynamicEmailController.getEmailContacts);

module.exports = router;

