const express = require('express');
const router = express.Router();
const imapController = require('../controllers/imapController');

router.post('/start-listener', imapController.startImapListener);
router.get('/fetch-unread', imapController.fetchUnreadEmails);
router.get('/fetch-replies', imapController.fetchReplyEmails )
router.get('/fetch-all', imapController.fetchAllEmails);
// New endpoint to search by reference number
router.get('/search-by-reference', imapController.searchByReferenceNumber);
router.get('/inward-patra-with-replies', imapController.getInwardPatraWithReplies);

// New routes for email reply functionality (working with EmailRecords)
router.get('/email/:emailId', imapController.getEmailDetails);
router.get('/emails/reference/:referenceNumber', imapController.getEmailsByReference);
router.post('/reply', imapController.sendEmailReply);

module.exports = router;           