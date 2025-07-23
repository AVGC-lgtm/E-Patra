const nodemailer = require('nodemailer');

console.log('Loading email configuration...');

// Email configuration - Fixed for Gmail
const emailConfig = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
};

// Create transporter function
function createTransporter() {
  try {
    console.log('Creating email transporter...');
    console.log('Email user:', process.env.EMAIL_USER ? process.env.EMAIL_USER.substring(0, 5) + '***' : 'not set');
    console.log('Email pass:', process.env.EMAIL_PASS ? '***set***' : 'not set');
    console.log('SMTP Config:', {
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure
    });
    
    // Use the correct method: createTransport
    const transporter = nodemailer.createTransport(emailConfig);
    console.log('✓ Email transporter created successfully');
    return transporter;
  } catch (error) {
    console.error('✗ Error creating email transporter:', error);
    throw error;
  }
}

// Verify email configuration
async function verifyEmailConfig() {
  try {
    console.log('Verifying email configuration...');
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✓ Email configuration verified successfully');
    return true;
  } catch (error) {
    console.error('✗ Email configuration verification failed:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('EACCES') || error.message.includes('465')) {
      console.log('💡 Suggestion: Try using port 587 instead of 465');
    }
    if (error.message.includes('auth')) {
      console.log('💡 Suggestion: Check your Gmail app password');
    }
    if (error.message.includes('ENOTFOUND')) {
      console.log('💡 Suggestion: Check your internet connection');
    }
    
    return false;
  }
}

// Export functions
module.exports = {
  emailConfig,
  createTransporter,
  verifyEmailConfig
};

module.exports.imap = {
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASS,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
  // SMTP settings for sending emails
  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  smtpSecure: false,
  checkInterval: 30000 // Check for new emails every 30 seconds
};