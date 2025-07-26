/**
 * Email Templates for Ahilyanagar Police
 * This file contains all email templates used in the application
 */

// Base HTML template wrapper
const baseHTMLTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ahilyanagar Police</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
        .content { padding: 30px; }
        .otp-box { background-color: #e8f4fd; padding: 20px; border-radius: 6px; text-align: center; margin: 20px 0; }
        .otp-code { font-size: 32px; font-weight: bold; color: #2c3e50; letter-spacing: 5px; background-color: white; padding: 15px 25px; border: 2px dashed #3498db; border-radius: 4px; display: inline-block; }
        .warning-box { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .warning-box h4 { color: #856404; margin-top: 0; }
        .warning-box ul { color: #856404; margin: 0; padding-left: 20px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #dee2e6; }
        .footer p { margin: 0; color: #6c757d; font-size: 14px; }
        .info-box { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .info-box h3 { color: #2c3e50; margin-top: 0; }
        .info-box p { color: #34495e; line-height: 1.6; margin: 0; }
        .success-box { background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .success-box h4 { color: #155724; margin-top: 0; }
        .success-box p { color: #155724; margin: 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Ahilyanagar Police</h1>
            <p>Official Communication</p>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>This is an automated message from Ahilyanagar Police Department.<br>
            Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
`;

// Password Reset OTP Template
const getPasswordResetOTPTemplate = (otp) => {
    const content = `
        <div class="info-box">
            <h3>Password Reset Request</h3>
            <p>We received a request to reset your password for your Ahilyanagar Police account. 
            If you did not make this request, please ignore this email.</p>
        </div>
        
        <div class="otp-box">
            <h3 style="color: #2980b9; margin-top: 0;">Your One-Time Password (OTP)</h3>
            <div class="otp-code">${otp}</div>
            <p style="color: #7f8c8d; margin-top: 15px; font-size: 14px;">
                This OTP is valid for 10 minutes only.
            </p>
        </div>
        
        <div class="warning-box">
            <h4>Security Notice:</h4>
            <ul>
                <li>Never share this OTP with anyone</li>
                <li>Ahilyanagar Police will never ask for your OTP over phone or email</li>
                <li>If you suspect any suspicious activity, contact us immediately</li>
            </ul>
        </div>
    `;
    
    return {
        subject: 'Ahilyanagar Police - Password Reset OTP',
        html: baseHTMLTemplate(content),
        text: `
Ahilyanagar Police - Password Reset OTP

We received a request to reset your password for your Ahilyanagar Police account.

Your One-Time Password (OTP) is: ${otp}

This OTP is valid for 10 minutes only.

Security Notice:
- Never share this OTP with anyone
- Ahilyanagar Police will never ask for your OTP over phone or email
- If you suspect any suspicious activity, contact us immediately

This is an automated message from Ahilyanagar Police Department.
Please do not reply to this email.
        `
    };
};

// Welcome Email Template
const getWelcomeEmailTemplate = (userEmail) => {
    const content = `
        <div class="success-box">
            <h4>Welcome to Ahilyanagar Police Portal!</h4>
            <p>Your account has been successfully created. You can now access all our services.</p>
        </div>
        
        <div class="info-box">
            <h3>Getting Started</h3>
            <p>Thank you for registering with Ahilyanagar Police Department. Your account is now active and ready to use.</p>
        </div>
        
        <div class="warning-box">
            <h4>Account Security:</h4>
            <ul>
                <li>Keep your login credentials secure</li>
                <li>Never share your password with anyone</li>
                <li>Log out when using shared devices</li>
                <li>Contact us immediately if you notice any suspicious activity</li>
            </ul>
        </div>
    `;
    
    return {
        subject: 'Ahilyanagar Police - Welcome to Our Portal',
        html: baseHTMLTemplate(content),
        text: `
Ahilyanagar Police - Welcome to Our Portal

Welcome to Ahilyanagar Police Portal!

Your account has been successfully created. You can now access all our services.

Getting Started:
Thank you for registering with Ahilyanagar Police Department. Your account is now active and ready to use.

Account Security:
- Keep your login credentials secure
- Never share your password with anyone
- Log out when using shared devices
- Contact us immediately if you notice any suspicious activity

This is an automated message from Ahilyanagar Police Department.
Please do not reply to this email.
        `
    };
};

// Password Changed Success Template
const getPasswordChangedTemplate = () => {
    const content = `
        <div class="success-box">
            <h4>Password Successfully Changed</h4>
            <p>Your password has been successfully updated for your Ahilyanagar Police account.</p>
        </div>
        
        <div class="info-box">
            <h3>Security Confirmation</h3>
            <p>If you made this change, you can safely ignore this email. If you did not change your password, please contact us immediately.</p>
        </div>
        
        <div class="warning-box">
            <h4>If you didn't make this change:</h4>
            <ul>
                <li>Contact our support team immediately</li>
                <li>Check your account for any suspicious activity</li>
                <li>Consider changing your password again</li>
            </ul>
        </div>
    `;
    
    return {
        subject: 'Ahilyanagar Police - Password Changed Successfully',
        html: baseHTMLTemplate(content),
        text: `
Ahilyanagar Police - Password Changed Successfully

Password Successfully Changed

Your password has been successfully updated for your Ahilyanagar Police account.

Security Confirmation:
If you made this change, you can safely ignore this email. If you did not change your password, please contact us immediately.

If you didn't make this change:
- Contact our support team immediately
- Check your account for any suspicious activity
- Consider changing your password again

This is an automated message from Ahilyanagar Police Department.
Please do not reply to this email.
        `
    };
};

// Account Locked Template
const getAccountLockedTemplate = (reason = 'Multiple failed login attempts') => {
    const content = `
        <div class="warning-box">
            <h4>Account Temporarily Locked</h4>
            <p>Your Ahilyanagar Police account has been temporarily locked for security reasons.</p>
        </div>
        
        <div class="info-box">
            <h3>Reason for Lock</h3>
            <p>${reason}</p>
        </div>
        
        <div class="info-box">
            <h3>What to do next:</h3>
            <ul>
                <li>Wait for 30 minutes before attempting to login again</li>
                <li>Use the "Forgot Password" option if you've forgotten your password</li>
                <li>Contact our support team if you need immediate assistance</li>
            </ul>
        </div>
    `;
    
    return {
        subject: 'Ahilyanagar Police - Account Temporarily Locked',
        html: baseHTMLTemplate(content),
        text: `
Ahilyanagar Police - Account Temporarily Locked

Account Temporarily Locked

Your Ahilyanagar Police account has been temporarily locked for security reasons.

Reason for Lock:
${reason}

What to do next:
- Wait for 30 minutes before attempting to login again
- Use the "Forgot Password" option if you've forgotten your password
- Contact our support team if you need immediate assistance

This is an automated message from Ahilyanagar Police Department.
Please do not reply to this email.
        `
    };
};

// Export all templates
module.exports = {
    getPasswordResetOTPTemplate,
    getWelcomeEmailTemplate,
    getPasswordChangedTemplate,
    getAccountLockedTemplate,
    baseHTMLTemplate
};