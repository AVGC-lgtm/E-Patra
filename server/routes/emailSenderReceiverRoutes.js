// routes/emailSenderReceiverRoutes.js
const express = require('express');
const router = express.Router();
const { emailSenderController, emailReceiverController } = require('../controllers/emailSenderReceiverController');

// Email Sender Routes
router.post('/senders', emailSenderController.create);
router.get('/senders', emailSenderController.getAll);
router.get('/senders/:id', emailSenderController.getById);
router.put('/senders/:id', emailSenderController.update);
router.delete('/senders/:id', emailSenderController.delete);

// Email Receiver Routes
router.post('/receivers', emailReceiverController.create);
router.get('/receivers', emailReceiverController.getAll);
router.get('/receivers/:id', emailReceiverController.getById);
router.put('/receivers/:id', emailReceiverController.update);
router.delete('/receivers/:id', emailReceiverController.delete);

module.exports = router;