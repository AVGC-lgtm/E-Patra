const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Role = require('../models/Role');
const authResponses = require('../responses/authResponses'); // Importing response module
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
// Import the professional email templates
const {
  getPasswordResetOTPTemplate,
  getWelcomeEmailTemplate,
  getPasswordChangedTemplate,
  getAccountLockedTemplate
} = require('../utils/emailTemplates'); // Adjust path as needed
require('dotenv').config();

// AWS S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

// Setup multer to upload the signature to S3
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.AWS_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const fileName = `signatures/${Date.now()}-${file.originalname}`;
      cb(null, fileName);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Only allow one file at a time
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, PNG, or JPEG files are allowed'), false);
    }
  },
});

// Create upload middleware for handling digital signature uploads
const uploadSingle = upload.single('sign'); // 'sign' is the field name used in the form

// Email configuration for authentication
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Register a new user - UPDATED TO USE roleId
const register = async (req, res) => {
  const { email, password, roleId } = req.body;

  // Validate required fields
  if (!email || !password || !roleId) {
    return res.status(400).json(authResponses.error('Email, password, and roleId are required'));
  }

  try {
    // Check if the role exists by roleId
    const role = await Role.findByPk(roleId);
    if (!role) {
      return res.status(400).json(authResponses.error('Invalid role ID'));
    }

    // Check if user already exists
    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return res.status(400).json(authResponses.error('Email already registered'));
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new user
    const user = await User.create({
      email,
      password: hashedPassword,
      roleId: roleId,  // Use the roleId directly from request
    });

    // Send a welcome email using the professional template
    try {
      const { subject, html, text } = getWelcomeEmailTemplate(email);
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject,
        html,
        text,
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Continue with registration even if email fails
    }

    // Eagerly load the associated role for the user
    const userWithRole = await User.findOne({
      where: { email },
      include: [Role],  // Include Role model
    });

    // Generate JWT token with roleId, roleName, table, and categories
    const token = jwt.sign(
      { 
        id: userWithRole.id, 
        email, 
        roleId: userWithRole.roleId, 
        roleName: userWithRole.Role.roleName,
        table: userWithRole.Role.table,
        categories: userWithRole.Role.categories
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return success response with token
    return res.status(201).json(authResponses.userRegistered(userWithRole, token));
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json(authResponses.error('Server error'));
  }
};

// Login user
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json(authResponses.error('Email and password required'));
  }

  try {
    const user = await User.findOne({ where: { email }, include: Role });
    const valid = user && await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json(authResponses.error('Invalid email or password'));
    }

    const token = jwt.sign(
      {
        id: user.id,
        email,
        roleId: user.roleId,
        roleName: user.Role.roleName,
        table: user.Role.table,
        categories: user.Role.categories
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json(authResponses.loginSuccessful(token));
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json(authResponses.error('Server error'));
  }
};

// Forgot password
const forgotPassword = async (req, res) => {
  console.log('Forgot password request received for email:', req.body.email);
  const { email } = req.body;
  if (!email) {
    console.log('No email provided in request');
    return res.status(400).json(authResponses.error('Email required'));
  }

  let user;
  try {
    console.log('Looking for user with email:', email);
    user = await User.findOne({ where: { email } });
    if (!user) {
      console.log('User not found for email:', email);
      return res.status(404).json(authResponses.error('User not found'));
    }

    console.log('User found. Generating OTP...');
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiration = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    const otpHash = await bcrypt.hash(otp, 10);

    console.log('Saving OTP to user record...', {
      userId: user.id,
      otpHash: !!otpHash,
      otpExpiration
    });

    // Update user with the new OTP
    const updatedUser = await user.update({
      otpHash,
      otpExpiration
    });

    console.log('User record after save:', {
      id: updatedUser.id,
      otpHash: !!updatedUser.otpHash,
      otpExpiration: updatedUser.otpExpiration
    });

    console.log('Sending OTP email to:', email);
    
    // Send OTP email using the professional template
    try {
      const { subject, html, text } = getPasswordResetOTPTemplate(otp);
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject,
        html,
        text
      });
      console.log('OTP email sent successfully');
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      return res.status(500).json(authResponses.error('Failed to send OTP email'));
    }

    return res.json(authResponses.otpSentToEmail());
  } catch (error) {
    console.error('Forgot password error:', error);
    if (user) {
      user.otpHash = null;
      user.otpExpiration = null;
      await user.save().catch(() => { });
    }
    return res.status(500).json(authResponses.error('Server error'));
  }
};

// Verify OTP
// Enhanced Verify OTP function with better error handling
const verifyOtp = async (req, res) => {
  console.log('=== OTP Verification Request ===');
  console.log('Request Body:', JSON.stringify(req.body, null, 2));
  console.log('Request Headers:', req.headers);
  console.log('Request Method:', req.method);

  const { email, otp } = req.body;
  
  // Enhanced validation
  if (!email) {
    console.log('ERROR: Email is missing from request');
    return res.status(400).json(authResponses.error('Email is required'));
  }
  
  if (!otp) {
    console.log('ERROR: OTP is missing from request');
    return res.status(400).json(authResponses.error('OTP is required'));
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.log('ERROR: Invalid email format:', email);
    return res.status(400).json(authResponses.error('Invalid email format'));
  }

  // Validate OTP format (should be 6 digits)
  if (!/^\d{6}$/.test(otp)) {
    console.log('ERROR: Invalid OTP format. Expected 6 digits, received:', otp);
    return res.status(400).json(authResponses.error('OTP must be 6 digits'));
  }

  try {
    console.log('Looking for user with email:', email);
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      console.log('ERROR: User not found for email:', email);
      return res.status(400).json(authResponses.error('User not found'));
    }

    console.log('User found:', {
      id: user.id,
      email: user.email,
      hasOtpHash: !!user.otpHash,
      otpExpiration: user.otpExpiration,
      currentTime: new Date()
    });

    // Check if OTP exists
    if (!user.otpHash) {
      console.log('ERROR: No OTP found for this user. Please request a new OTP.');
      return res.status(400).json(authResponses.error('No OTP found. Please request a new OTP.'));
    }

    // Check OTP expiration
    const now = new Date();
    if (!user.otpExpiration) {
      console.log('ERROR: OTP expiration time not set');
      return res.status(400).json(authResponses.error('Invalid OTP session. Please request a new OTP.'));
    }

    const isOtpExpired = now > user.otpExpiration;
    if (isOtpExpired) {
      console.log('ERROR: OTP has expired', {
        currentTime: now,
        expirationTime: user.otpExpiration,
        timeDifference: now - user.otpExpiration
      });
      
      // Clear expired OTP
      await user.update({
        otpHash: null,
        otpExpiration: null
      });
      
      return res.status(400).json(authResponses.error('OTP has expired. Please request a new OTP.'));
    }

    // Verify OTP
    console.log('Comparing OTP:', {
      providedOtp: otp,
      storedHashExists: !!user.otpHash
    });

    const isOtpValid = await bcrypt.compare(otp, user.otpHash);
    console.log('OTP comparison result:', isOtpValid);

    if (!isOtpValid) {
      console.log('ERROR: Invalid OTP provided');
      return res.status(400).json(authResponses.error('Invalid OTP. Please check and try again.'));
    }

    // Success - clear OTP fields
    console.log('SUCCESS: OTP verified successfully');
    await user.update({
      otpHash: null,
      otpExpiration: null
    });

    return res.json(authResponses.otpVerified());
    
  } catch (error) {
    console.error('=== VERIFY OTP ERROR ===');
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Database connection error
    if (error.name === 'SequelizeConnectionError') {
      return res.status(500).json(authResponses.error('Database connection error'));
    }
    
    // Validation error
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json(authResponses.error('Data validation error'));
    }
    
    return res.status(500).json(authResponses.error('Server error occurred while verifying OTP'));
  }
};

// Reset password
const resetPassword = async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;
  if (!email || !newPassword || !confirmPassword) {
    return res.status(400).json(authResponses.error('Email and new passwords required'));
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json(authResponses.error('Passwords do not match'));
  }
  if (newPassword.length < 6) {
    return res.status(400).json(authResponses.error('Password must be ≥ 6 characters'));
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json(authResponses.error('User not found'));
    }
    if (user.otpHash !== null || user.otpExpiration !== null) {
      return res.status(400).json(authResponses.error('Please verify OTP first'));
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    // Send password changed confirmation email using the professional template
    try {
      const { subject, html, text } = getPasswordChangedTemplate();
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject,
        html,
        text
      });
    } catch (emailError) {
      console.error('Failed to send password changed email:', emailError);
      // Continue with password reset even if email fails
    }

    return res.json(authResponses.passwordResetSuccess());
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json(authResponses.error('Server error'));
  }
};

const updateSign = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { userId } = req.body;  // Get userId from the request body

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // Find the user by userId
    const user = await User.findByPk(userId); // Assuming userId is passed as a number or string

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get the file URL from S3
    const signUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${req.file.key}`;

    // Update the user with the digital signature URL
    user.sign = signUrl;
    await user.save();

    // Return success response with the user ID and the new signature URL
    return res.status(200).json({
      success: 'Digital signature updated successfully',
      userId: user.id,  // Include user ID in response
      sign: signUrl,
    });
  } catch (error) {
    console.error('Error updating digital signature:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const deleteSign = async (req, res) => {
  const { userId } = req.body;  // Get userId from the request body

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // Find the user by userId
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.sign) {
      return res.status(400).json({ error: 'No signature found to delete' });
    }
    // Remove the signature URL from the user
    user.sign = null;
    await user.save();

    // Return success response
    return res.status(200).json({
      success: 'Digital signature deleted successfully',
      userId: user.id
    });
  } catch (error) {
    console.error('Error deleting digital signature:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Logout
const logout = (req, res) => {
  return res.json(authResponses.logout());
};

// Verify token endpoint
const verifyToken = async (req, res) => {
  try {
    // If the middleware passed, the token is valid
    // Return user information from the token
    const user = req.user;
    
    return res.status(200).json({
      success: true,
      message: 'Token is valid',
      user: {
        id: user.id,
        email: user.email,
        roleName: user.roleName,
        table: user.table
      }
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  verifyOtp,
  resetPassword,
  logout,
  updateSign,
  deleteSign,
  uploadSingle,
  verifyToken,
};
