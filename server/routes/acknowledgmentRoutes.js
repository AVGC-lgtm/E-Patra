const express = require('express');
const acknowledgmentController = require('../controllers/acknowledgmentController');
const router = express.Router();

// Route to acknowledge the Patra and update its letterStatus
router.put('/acknowledge/patra/:patraId/user/:userId', acknowledgmentController.acknowledgePatra);

module.exports = router;
