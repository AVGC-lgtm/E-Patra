const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Role = require('../models/Role');
const authResponses = require('../responses/authResponses'); // Importing response module
const { getPasswordResetOTPTemplate, getWelcomeEmailTemplate, getPasswordChangedTemplate } = require('../utils/emailTemplates');

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
  const { email } = req.body;
  if (!email) {
    return res.status(400).json(authResponses.error('Email required'));
  }

  let user;
  try {
    user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json(authResponses.error('User not found'));
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiration = new Date(Date.now() + 10 * 60 * 1000);
    const otpHash = await bcrypt.hash(otp, 10);

    user.otpHash = otpHash;
    user.otpExpiration = otpExpiration;
    await user.save();

    const { subject, html, text } = getPasswordResetOTPTemplate(otp);
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      html,
      text
    });

    return res.json(authResponses.otpSentToEmail());
  } catch (error) {
    console.error('Forgot password error:', error);
    if (user) {
      user.otpHash = null;
      user.otpExpiration = null;
      await user.save().catch(() => {});
    }
    return res.status(500).json(authResponses.error('Server error'));
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json(authResponses.error('Email and OTP required'));
  }

  try {
    const user = await User.findOne({ where: { email } });
    const now = new Date();
    const validOtp = user &&
      user.otpHash &&
      user.otpExpiration &&
      now <= user.otpExpiration &&
      await bcrypt.compare(otp, user.otpHash);

    if (!validOtp) {
      return res.status(400).json(authResponses.error('Invalid or expired OTP'));
    }

    user.otpHash = null;
    user.otpExpiration = null;
    await user.save();

    return res.json(authResponses.otpVerified());
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json(authResponses.error('Server error'));
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
  logout
};
