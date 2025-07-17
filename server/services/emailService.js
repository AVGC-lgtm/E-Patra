// services/emailService.js - Updated version with email list integration
const { createTransporter } = require('../config/email');
const emailTemplates = require('../utils/emailTemplates');

class EmailService {
  constructor() {
    try {
      console.log('Initializing EmailService...');
      this.transporter = createTransporter();
      console.log('✓ EmailService initialized successfully');
    } catch (error) {
      console.error('✗ Error initializing EmailService:', error);
      this.transporter = null;
    }
  }

  // Check if transporter is available
  isTransporterAvailable() {
    return this.transporter !== null;
  }

  // Send email with multiple attachments
  async sendEmailWithAttachments(to, subject, htmlContent, textContent = null, attachments = []) {
    try {
      if (!this.isTransporterAvailable()) {
        throw new Error('Email transporter is not available. Check email configuration.');
      }

      console.log(`Preparing to send email with ${attachments.length} attachment(s) to: ${to}`);
      
      const mailOptions = {
        from: {
          name: process.env.EMAIL_FROM_NAME || 'Police Department',
          address: process.env.EMAIL_FROM || process.env.EMAIL_USER
        },
        to: to,
        subject: subject,
        html: htmlContent,
        text: textContent || this.stripHtml(htmlContent),
        attachments: attachments
      };

      console.log('Sending email with attachments:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        attachmentCount: attachments.length
      });

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✓ Email with attachments sent successfully:', result.messageId);
      
      return {
        success: true,
        messageId: result.messageId,
        response: result.response
      };
    } catch (error) {
      console.error('✗ Error sending email with attachments:', error);
      throw error;
    }
  }

  // Send basic email
  async sendEmail(to, subject, htmlContent, textContent = null, attachments = null) {
    try {
      if (!this.isTransporterAvailable()) {
        throw new Error('Email transporter is not available. Check email configuration.');
      }

      console.log(`Preparing to send email to: ${to}`);
      
      const mailOptions = {
        from: {
          name: process.env.EMAIL_FROM_NAME || 'Police Department',
          address: process.env.EMAIL_FROM || process.env.EMAIL_USER
        },
        to: to,
        subject: subject,
        html: htmlContent,
        text: textContent || this.stripHtml(htmlContent)
      };

      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments;
      }

      console.log('Sending email with options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
      });

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✓ Email sent successfully:', result.messageId);
      
      return {
        success: true,
        messageId: result.messageId,
        response: result.response
      };
    } catch (error) {
      console.error('✗ Error sending email:', error);
      throw error;
    }
  }

  // Send email to email list
  async sendEmailToList(emailListId, subject, htmlContent, textContent = null, attachments = null) {
    try {
      const emailList = await EmailList.findByPk(emailListId, {
        include: [{
          model: EmailRecipient,
          as: 'recipients',
          where: { isActive: true }
        }]
      });

      if (!emailList) {
        throw new Error('Email list not found');
      }

      const results = [];
      
      for (const recipient of emailList.recipients) {
        try {
          const personalizedHtml = this.personalizeContent(htmlContent, recipient);
          const personalizedText = textContent ? this.personalizeContent(textContent, recipient) : null;
          
          const result = await this.sendEmail(
            recipient.email,
            subject,
            personalizedHtml,
            personalizedText,
            attachments
          );
          
          results.push({
            email: recipient.email,
            success: true,
            messageId: result.messageId
          });
        } catch (error) {
          results.push({
            email: recipient.email,
            success: false,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error sending email to list:', error);
      throw error;
    }
  }

  // Send email to multiple lists
  async sendEmailToMultipleLists(emailListIds, subject, htmlContent, textContent = null, attachments = null) {
    try {
      // Get unique recipients from all lists
      const recipients = await EmailRecipient.findAll({
        where: {
          emailListId: emailListIds,
          isActive: true
        },
        group: ['email', 'name', 'designation', 'department'], // Remove duplicates
        raw: true
      });

      const results = [];
      
      for (const recipient of recipients) {
        try {
          const personalizedHtml = this.personalizeContent(htmlContent, recipient);
          const personalizedText = textContent ? this.personalizeContent(textContent, recipient) : null;
          
          const result = await this.sendEmail(
            recipient.email,
            subject,
            personalizedHtml,
            personalizedText,
            attachments
          );
          
          results.push({
            email: recipient.email,
            success: true,
            messageId: result.messageId
          });
        } catch (error) {
          results.push({
            email: recipient.email,
            success: false,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error sending email to multiple lists:', error);
      throw error;
    }
  }

  // Personalize content with recipient data
  personalizeContent(content, recipient) {
    let personalizedContent = content;
    
    // Replace placeholders with recipient data
    personalizedContent = personalizedContent.replace(/{{name}}/g, recipient.name || 'Recipient');
    personalizedContent = personalizedContent.replace(/{{email}}/g, recipient.email);
    personalizedContent = personalizedContent.replace(/{{designation}}/g, recipient.designation || '');
    personalizedContent = personalizedContent.replace(/{{department}}/g, recipient.department || '');
    
    return personalizedContent;
  }

  // Send application acknowledgment email
  async sendApplicationAcknowledgment(userEmail, applicationData) {
    try {
      const subject = `Application Acknowledgment - ${applicationData.referenceNumber}`;
      const htmlContent = emailTemplates.acknowledgment(applicationData);
      
      return await this.sendEmail(userEmail, subject, htmlContent);
    } catch (error) {
      console.error('Error sending acknowledgment email:', error);
      throw error;
    }
  }

  // Send status update email
  async sendStatusUpdate(userEmail, applicationData, newStatus, remarks = '') {
    try {
      const subject = `Application Status Update - ${applicationData.referenceNumber}`;
      const htmlContent = emailTemplates.statusUpdate(applicationData, newStatus, remarks);
      
      return await this.sendEmail(userEmail, subject, htmlContent);
    } catch (error) {
      console.error('Error sending status update email:', error);
      throw error;
    }
  }

  // Send letter forwarding notification
  async sendLetterForwardingNotification(recipientEmail, letterData, forwardedTo) {
    try {
      const subject = `Letter Forwarded - ${letterData.referenceNumber}`;
      const htmlContent = emailTemplates.forwardingNotification(letterData, forwardedTo);
      
      return await this.sendEmail(recipientEmail, subject, htmlContent);
    } catch (error) {
      console.error('Error sending forwarding notification:', error);
      throw error;
    }
  }

  // Send bulk emails with template
  async sendBulkEmailsWithTemplate(emailListIds, subject, templateName, templateData = {}, attachments = null) {
    try {
      const htmlContent = emailTemplates[templateName](templateData);
      const textContent = this.stripHtml(htmlContent);
      
      if (Array.isArray(emailListIds)) {
        return await this.sendEmailToMultipleLists(emailListIds, subject, htmlContent, textContent, attachments);
      } else {
        return await this.sendEmailToList(emailListIds, subject, htmlContent, textContent, attachments);
      }
    } catch (error) {
      console.error('Error sending bulk emails with template:', error);
      throw error;
    }
  }

  // Send custom bulk notification
  async sendCustomBulkNotification(emailListIds, subject, message, additionalInfo = null, attachments = null) {
    try {
      const htmlContent = emailTemplates.bulkNotification(subject, message, additionalInfo);
      const textContent = this.stripHtml(htmlContent);
      
      if (Array.isArray(emailListIds)) {
        return await this.sendEmailToMultipleLists(emailListIds, subject, htmlContent, textContent, attachments);
      } else {
        return await this.sendEmailToList(emailListIds, subject, htmlContent, textContent, attachments);
      }
    } catch (error) {
      console.error('Error sending custom bulk notification:', error);
      throw error;
    }
  }

  // Send deadline reminder to email list
  async sendDeadlineReminderToList(emailListId, applicationData, deadlineDate) {
    try {
      const subject = `Deadline Reminder - ${applicationData.referenceNumber}`;
      const htmlContent = emailTemplates.deadlineReminder(applicationData, deadlineDate);
      
      return await this.sendEmailToList(emailListId, subject, htmlContent);
    } catch (error) {
      console.error('Error sending deadline reminder to list:', error);
      throw error;
    }
  }

  // Helper function to strip HTML tags
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '');
  }

  // Test email functionality
  async testEmail(testEmail) {
    try {
      const subject = 'Test Email - Police Department System';
      const htmlContent = `
        <h2>Test Email</h2>
        <p>This is a test email from the Police Department system.</p>
        <p>If you receive this email, the email configuration is working correctly.</p>
        <p>Time: ${new Date().toLocaleString()}</p>
      `;
      
      return await this.sendEmail(testEmail, subject, htmlContent);
    } catch (error) {
      console.error('Error sending test email:', error);
      throw error;
    }
  }

  // Get email list preview
  async getEmailListPreview(emailListIds, limit = 5) {
    try {
      let recipients;
      
      if (Array.isArray(emailListIds)) {
        recipients = await EmailRecipient.findAll({
          where: {
            emailListId: emailListIds,
            isActive: true
          },
          limit: limit,
          attributes: ['email', 'name', 'designation', 'department']
        });
      } else {
        recipients = await EmailRecipient.findAll({
          where: {
            emailListId: emailListIds,
            isActive: true
          },
          limit: limit,
          attributes: ['email', 'name', 'designation', 'department']
        });
      }

      return recipients;
    } catch (error) {
      console.error('Error getting email list preview:', error);
      throw error;
    }
  }

  // Validate email list before sending
  async validateEmailList(emailListIds) {
    try {
      let recipientCount;
      
      if (Array.isArray(emailListIds)) {
        recipientCount = await EmailRecipient.count({
          where: {
            emailListId: emailListIds,
            isActive: true
          },
          distinct: true,
          col: 'email'
        });
      } else {
        recipientCount = await EmailRecipient.count({
          where: {
            emailListId: emailListIds,
            isActive: true
          }
        });
      }

      return {
        isValid: recipientCount > 0,
        recipientCount: recipientCount
      };
    } catch (error) {
      console.error('Error validating email list:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();