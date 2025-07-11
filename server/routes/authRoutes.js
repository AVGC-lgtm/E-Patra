const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Login route
router.post('/login', authController.login);

// Forgot password route
router.post('/forgot-password', authController.forgotPassword);

// Verify OTP route
router.post('/verify-otp', authController.verifyOtp);

// Reset password route
router.post('/reset-password', authController.resetPassword);

// Register route
router.post('/register', authController.register);

// Logout route (protected)
router.post('/logout', authenticateToken, authController.logout);

// Verify token route (protected)
router.get('/verify-token', authenticateToken, (req, res) => {
  res.json({ 
    message: 'Token is valid', 
    user: req.user 
  });
});

module.exports = router;