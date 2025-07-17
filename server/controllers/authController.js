const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Role = require('../models/Role');
const authResponses = require('../responses/authResponses'); // Importing response module
const { getPasswordResetOTPTemplate, getWelcomeEmailTemplate, getPasswordChangedTemplate } = require('../utils/emailTemplates');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
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


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Register a new user
const register = async (req, res) => {
  const { email, password, roleName, stationName } = req.body;

  // Validate required fields
  if (!email || !password || !roleName) {
    return res.status(400).json(authResponses.error('Email, password, and role name are required'));
  }

  try {
    // Check if the role exists
    const role = await Role.findOne({ where: { roleName } });
    if (!role) {
      return res.status(400).json(authResponses.error('Invalid role name'));
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
      roleId: role.id,  // Associate the user with the roleId
      stationName: stationName || null,  // Optional station name
    });

    // Send a welcome email
    const { subject, html, text } = getWelcomeEmailTemplate(email);
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      html,
      text,
    });

    // Eagerly load the associated role for the user
    const userWithRole = await User.findOne({
      where: { email },
      include: [Role],  // Include Role model
    });

    // Generate JWT token with roleId and roleName
    const token = jwt.sign(
      { id: userWithRole.id, email, roleId: userWithRole.roleId, roleName: userWithRole.Role.roleName, stationName: userWithRole.stationName },
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
        stationName: user.stationName
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
    const { subject, html, text } = getPasswordResetOTPTemplate(otp);
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      html,
      text
    });
    console.log('OTP email sent successfully');

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
const verifyOtp = async (req, res) => {
  console.log('OTP Verification Request:', {
    body: req.body,
    headers: req.headers
  });

  const { email, otp } = req.body;
  
  if (!email || !otp) {
    console.log('Missing email or OTP in request');
    return res.status(400).json(authResponses.error('Email and OTP required'));
  }

  try {
    console.log('Looking for user with email:', email);
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      console.log('User not found');
      return res.status(400).json(authResponses.error('User not found'));
    }

    console.log('User found. Checking OTP...', {
      hasOtpHash: !!user.otpHash,
      otpExpiration: user.otpExpiration,
      currentTime: new Date(),
      isOtpExpired: user.otpExpiration && new Date() > user.otpExpiration
    });

    const now = new Date();
    const isOtpExpired = user.otpExpiration && now > user.otpExpiration;
    
    if (isOtpExpired) {
      console.log('OTP has expired');
      return res.status(400).json(authResponses.error('OTP has expired'));
    }

    if (!user.otpHash) {
      console.log('No OTP found for this user');
      return res.status(400).json(authResponses.error('No OTP found'));
    }

    const isOtpValid = await bcrypt.compare(otp, user.otpHash);
    console.log('OTP comparison result:', isOtpValid);

    if (!isOtpValid) {
      console.log('Invalid OTP provided');
      return res.status(400).json(authResponses.error('Invalid OTP'));
    }

    // If we get here, OTP is valid
    console.log('OTP verified successfully');
    user.otpHash = null;
    user.otpExpiration = null;
    await user.save();

    return res.json(authResponses.otpVerified());
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json(authResponses.error('Server error: ' + error.message));
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

    const { subject, html, text } = getPasswordChangedTemplate();
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      html,
      text
    });

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

    // TODO: Optionally delete the file from S3 here
    // const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    // const key = user.sign.split('/').pop(); // Extract key from URL
    // await s3Client.send(new DeleteObjectCommand({
    //   Bucket: process.env.AWS_BUCKET_NAME,
    //   Key: `signatures/${key}`
    // }));

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
};