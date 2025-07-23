const ImapService = require('../services/imapService');
const imapConfig = require('../config/email').imap;
const s3Service = require('../services/s3Service');
const sequelize = require('../config/database');
const { InwardPatra, EmailRecord } = require('../models/associations');

// Create a single instance
let imapService = null;

// Helper to ensure connection
async function ensureImapConnected() {
  if (!imapService || !imapService.isConnected) {
    console.log('Creating/reconnecting IMAP service...');
    imapService = new ImapService(imapConfig);
    await imapService.connect();
  }
  return imapService;
}

// Helper function to process and save email
async function processAndSaveEmail(mail) {
  console.log('Processing email:', mail.subject);
  
  // Check if it's a reply to an Inward Letter
  const subject = mail.subject || '';
  const isReply = mail.inReplyTo || (mail.references && mail.references.length > 0);
  
  // Match pattern for Inward Letter (with or without "Re:")
  const match = subject.match(/(?:re:\s*)?inward letter\s*-\s*(\d+)/i);
  
  if (match) {
    const referenceNumber = match[1];
    console.log(`Processing email for reference number: ${referenceNumber}`);
    
    // Check if InwardPatra exists
    const patraExists = await InwardPatra.findOne({ 
      where: { referenceNumber } 
    });
    
    if (patraExists) {
      try {
        // Check if this email already exists (avoid duplicates)
        const existingEmail = await EmailRecord.findOne({
          where: { messageId: mail.messageId }
        });
        
        if (existingEmail) {
          console.log(`Email already exists in database for reference ${referenceNumber}`);
          return;
        }
        
        // Process attachments
        const attachments = [];
        if (mail.attachments && mail.attachments.length > 0) {
          for (const att of mail.attachments) {
            if (att.content) {
              try {
                const s3Url = await s3Service.uploadToS3(
                  att.content,
                  att.filename,
                  att.contentType
                );
                attachments.push({
                  filename: att.filename,
                  contentType: att.contentType,
                  size: att.size,
                  s3Url: s3Url
                });
              } catch (uploadError) {
                console.error('Error uploading attachment:', uploadError);
                attachments.push({
                  filename: att.filename,
                  contentType: att.contentType,
                  size: att.size,
                  s3Url: null
                });
              }
            }
          }
        }
        
        // Create EmailRecord
        const emailRecord = await EmailRecord.create({
          referenceNumber,
          subject: mail.subject,
          from: mail.from?.text,
          date: mail.date,
          text: mail.text,
          html: mail.html,
          messageId: mail.messageId,
          inReplyTo: mail.inReplyTo,
          references: Array.isArray(mail.references) ? mail.references.join(',') : mail.references,
          attachments: attachments
        });
        
        console.log(`✅ Email record created for reference ${referenceNumber}`);
        console.log(`   Subject: ${mail.subject}`);
        console.log(`   From: ${mail.from?.text}`);
        console.log(`   Date: ${mail.date}`);
        console.log(`   Is Reply: ${isReply}`);
      } catch (error) {
        console.error('Error saving email record:', error);
      }
    } else {
      console.log(`⚠️  InwardPatra not found for reference ${referenceNumber}`);
    }
  } else {
    console.log(`Email subject doesn't match Inward Letter pattern: ${subject}`);
  }
}

// Auto-start function
async function startImapListenerAuto() {
  try {
    await ensureImapConnected();
    
    // Set up listener for new emails
    imapService.listenForNewMail(async (mail) => {
      console.log('📧 New mail detected:', mail.subject);
      await processAndSaveEmail(mail);
    });
    
    // Process any existing unread emails on startup
    console.log('Checking for existing unread emails...');
    setTimeout(() => {
      imapService.fetchUnreadEmails(async (mail) => {
        console.log('📨 Processing unread email:', mail.subject);
        await processAndSaveEmail(mail);
      });
    }, 2000); // Give the connection time to stabilize
    
    console.log('✅ IMAP listener started successfully and monitoring for new emails');
    console.log('📊 Checking for new emails every 30 seconds');
  } catch (err) {
    console.error('❌ Failed to start IMAP listener:', err);
    throw err;
  }
}

// Express route handlers
exports.startImapListener = async (req, res) => {
  try {
    await startImapListenerAuto();
    res.json({ success: true, message: 'IMAP listener started' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.startImapListenerAuto = startImapListenerAuto;

exports.fetchUnreadEmails = async (req, res) => {
  try {
    await ensureImapConnected();
    
    const emails = [];
    const fetchPromise = new Promise((resolve) => {
      let timeout;
      
      imapService.fetchUnreadEmails((mail) => {
        if (mail.subject && mail.subject.trim().toLowerCase().includes('inward letter')) {
          emails.push({
            subject: mail.subject,
            from: mail.from?.text,
            date: mail.date,
            attachments: (mail.attachments || []).map(att => ({
              filename: att.filename,
              contentType: att.contentType,
              size: att.size,
              content: att.content ? att.content.toString('base64') : undefined
            }))
          });
        }
        
        clearTimeout(timeout);
        timeout = setTimeout(() => resolve(), 2000);
      });
      
      // Initial timeout
      timeout = setTimeout(() => resolve(), 3000);
    });
    
    await fetchPromise;
    res.json({ success: true, emails });
  } catch (error) {
    console.error('Error fetching unread emails:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.fetchReplyEmails = async (req, res) => {
  try {
    await ensureImapConnected();
    
    const emails = [];
    const emailsToSave = [];
    const fetchPromise = new Promise((resolve) => {
      let timeout;
      
      imapService.fetchReplyEmails(async (mail) => {
        if (mail.subject && mail.subject.trim().toLowerCase().includes('inward letter')) {
          const emailData = {
            subject: mail.subject,
            from: mail.from?.text,
            date: mail.date,
            messageId: mail.messageId,
            inReplyTo: mail.inReplyTo,
            references: mail.references,
            attachments: (mail.attachments || []).map(att => ({
              filename: att.filename,
              contentType: att.contentType,
              size: att.size,
              content: att.content ? att.content.toString('base64') : undefined
            }))
          };
          
          emails.push(emailData);
          
          // Also save to database if requested
          if (req.query.save === 'true') {
            await processAndSaveEmail(mail);
          }
        }
        
        clearTimeout(timeout);
        timeout = setTimeout(() => resolve(), 2000);
      });
      
      // Initial timeout
      timeout = setTimeout(() => resolve(), 5000);
    });
    
    await fetchPromise;
    res.json({ 
      success: true, 
      emails,
      message: req.query.save === 'true' ? 'Emails fetched and saved' : 'Emails fetched (not saved)'
    });
  } catch (error) {
    console.error('Error fetching reply emails:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.fetchAllEmails = async (req, res) => {
  try {
    await ensureImapConnected();
    
    const emails = [];
    const emailsToSave = [];
    const errors = [];
    
    const fetchPromise = new Promise((resolve, reject) => {
      imapService.fetchAllEmails(
        async (mail) => {
          // Check if it's a reply
          if (mail.inReplyTo || (mail.references && mail.references.length > 0)) {
            const subject = mail.subject || '';
            const match = subject.match(/re:\s*inward letter\s*-\s*(\d+)/i);
            
            if (match) {
              const referenceNumber = match[1];
              console.log(`Found reply email for reference: ${referenceNumber}`);
              
              const emailObj = {
                referenceNumber,
                subject: mail.subject,
                from: mail.from?.text,
                date: mail.date,
                text: mail.text,
                html: mail.html,
                messageId: mail.messageId,
                inReplyTo: mail.inReplyTo,
                references: Array.isArray(mail.references) ? mail.references.join(',') : mail.references,
                attachments: []
              };
              
              // Process attachments
              if (mail.attachments && mail.attachments.length > 0) {
                for (const att of mail.attachments) {
                  if (att.content) {
                    try {
                      const s3Url = await s3Service.uploadToS3(
                        att.content,
                        att.filename,
                        att.contentType
                      );
                      emailObj.attachments.push({
                        filename: att.filename,
                        contentType: att.contentType,
                        size: att.size,
                        s3Url: s3Url
                      });
                    } catch (uploadError) {
                      console.error('S3 upload error:', uploadError);
                      emailObj.attachments.push({
                        filename: att.filename,
                        contentType: att.contentType,
                        size: att.size,
                        s3Url: null
                      });
                    }
                  }
                }
              }
              
              emails.push(emailObj);
              emailsToSave.push(emailObj);
            }
          }
        },
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
    
    await fetchPromise;
    
    // Save emails to database
    if (emailsToSave.length > 0) {
      console.log(`Attempting to save ${emailsToSave.length} emails to database`);
      
      // Check which InwardPatras exist
      const referenceNumbers = [...new Set(emailsToSave.map(e => e.referenceNumber))];
      const existingPatras = await InwardPatra.findAll({
        where: { referenceNumber: referenceNumbers },
        attributes: ['referenceNumber']
      });
      
      const existingRefNumbers = new Set(existingPatras.map(p => p.referenceNumber));
      console.log(`Found ${existingPatras.length} existing InwardPatras`);
      
      // Save emails one by one to handle errors individually
      for (const email of emailsToSave) {
        if (existingRefNumbers.has(email.referenceNumber)) {
          try {
            // Check if email already exists
            const existingEmail = await EmailRecord.findOne({
              where: { messageId: email.messageId }
            });
            
            if (!existingEmail) {
              await EmailRecord.create(email);
              console.log(`Saved email for reference ${email.referenceNumber}`);
            } else {
              console.log(`Email already exists for reference ${email.referenceNumber}`);
            }
          } catch (saveError) {
            console.error(`Error saving email for reference ${email.referenceNumber}:`, saveError);
            errors.push({
              referenceNumber: email.referenceNumber,
              error: saveError.message
            });
          }
        } else {
          console.log(`Skipping email for non-existent InwardPatra: ${email.referenceNumber}`);
        }
      }
    }
    
    res.json({ 
      success: true, 
      emails,
      totalFound: emails.length,
      savedCount: emailsToSave.length - errors.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error in fetchAllEmails:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.searchByReferenceNumber = async (req, res) => {
  try {
    const refNumber = req.query.referenceNumber;
    if (!refNumber) {
      return res.status(400).json({ success: false, error: 'referenceNumber query param is required' });
    }
    
    console.log(`Searching for emails with reference number: ${refNumber}`);
    
    const emails = await EmailRecord.findAll({ 
      where: { referenceNumber: refNumber },
      order: [['date', 'DESC']]
    });
    
    console.log(`Found ${emails.length} emails for reference ${refNumber}`);
    
    res.json({ success: true, emails });
  } catch (error) {
    console.error('Error searching by reference number:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getInwardPatraWithReplies = async (req, res) => {
  try {
    const { referenceNumber } = req.query;
    if (!referenceNumber) {
      return res.status(400).json({ success: false, error: 'referenceNumber is required' });
    }
    
    const patra = await InwardPatra.findOne({
      where: { referenceNumber },
      include: [{
        model: EmailRecord,
        as: 'EmailRecords', // Use the correct alias from associations
        order: [['date', 'DESC']]
      }]
    });
    
    if (!patra) {
      return res.status(404).json({ success: false, error: 'InwardPatra not found' });
    }
    
    res.json({ success: true, patra });
  } catch (error) {
    console.error('Error getting InwardPatra with replies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Test connection endpoint
exports.testConnection = async (req, res) => {
  try {
    await ensureImapConnected();
    res.json({ 
      success: true, 
      message: 'IMAP connection is active',
      connected: imapService.isConnected 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get email details for replying (from EmailRecords database)
exports.getEmailDetails = async (req, res) => {
  try {
    const { emailId } = req.params;
    
    if (!emailId) {
      return res.status(400).json({ success: false, error: 'Email ID is required' });
    }

    // Get email from EmailRecords database
    const emailRecord = await EmailRecord.findByPk(emailId);
    
    if (!emailRecord) {
      return res.status(404).json({ success: false, error: 'Email not found' });
    }

    // Extract email address from the "from" field
    let fromEmail = '';
    if (emailRecord.from) {
      const emailMatch = emailRecord.from.match(/<(.+?)>/);
      if (emailMatch) {
        fromEmail = emailMatch[1];
      } else {
        // If no angle brackets, try to extract email from the text
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const match = emailRecord.from.match(emailRegex);
        if (match) {
          fromEmail = match[0];
        }
      }
    }

    res.json({
      success: true,
      email: {
        id: emailRecord.id,
        messageId: emailRecord.messageId,
        subject: emailRecord.subject,
        from: emailRecord.from,
        fromEmail: fromEmail,
        date: emailRecord.date,
        text: emailRecord.text,
        html: emailRecord.html,
        attachments: emailRecord.attachments || [],
        referenceNumber: emailRecord.referenceNumber
      }
    });
  } catch (error) {
    console.error('Error getting email details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all emails for a specific reference number
exports.getEmailsByReference = async (req, res) => {
  try {
    const { referenceNumber } = req.params;
    
    console.log('🔍 Searching for emails with reference number:', referenceNumber);
    
    if (!referenceNumber) {
      return res.status(400).json({ success: false, error: 'Reference number is required' });
    }

    const emails = await EmailRecord.findAll({
      where: { referenceNumber },
      order: [['date', 'ASC']]
    });

    console.log(`📧 Found ${emails.length} emails for reference ${referenceNumber}`);
    emails.forEach((email, index) => {
      console.log(`  ${index + 1}. Subject: ${email.subject}, From: ${email.from}, Date: ${email.date}`);
    });

    res.json({
      success: true,
      data: emails.map(email => ({
        id: email.id,
        messageId: email.messageId,
        subject: email.subject,
        from: email.from,
        date: email.date,
        text: email.text,
        html: email.html,
        attachments: email.attachments || [],
        referenceNumber: email.referenceNumber
      }))
    });
  } catch (error) {
    console.error('Error getting emails by reference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Send email reply
exports.sendEmailReply = async (req, res) => {
  try {
    const { 
      emailId,           // ID of the EmailRecord to reply to
      toEmail,           // Email address to send reply to
      subject,           // Custom subject
      body,              // Custom body
      attachments = [],  // Optional attachments
      referenceNumber    // Reference number for linking
    } = req.body;

    // Validate required fields
    if (!emailId || !toEmail || !subject || !body) {
      return res.status(400).json({ 
        success: false, 
        error: 'emailId, toEmail, subject, and body are required' 
      });
    }

    // Get the original email record
    const originalEmail = await EmailRecord.findByPk(emailId);
    if (!originalEmail) {
      return res.status(404).json({ 
        success: false, 
        error: 'Original email not found' 
      });
    }

    await ensureImapConnected();

    console.log('Sending email reply:', {
      emailId,
      toEmail,
      subject,
      bodyLength: body.length,
      originalMessageId: originalEmail.messageId,
      attachmentsCount: attachments.length,
      referenceNumber: referenceNumber || originalEmail.referenceNumber
    });

    // Send the email
    const result = await imapService.sendEmailReply(
      toEmail,
      subject,
      body,
      originalEmail.messageId, // Use original message ID for threading
      attachments
    );

    // Create a record of the sent email
    const replyReferenceNumber = referenceNumber || originalEmail.referenceNumber;
    if (replyReferenceNumber) {
      try {
        const patraExists = await InwardPatra.findOne({ 
          where: { referenceNumber: replyReferenceNumber } 
        });
        
        if (patraExists) {
          await EmailRecord.create({
            referenceNumber: replyReferenceNumber,
            subject: subject,
            from: imapConfig.user,
            date: new Date(),
            text: body,
            html: body,
            messageId: result.messageId,
            inReplyTo: originalEmail.messageId,
            references: originalEmail.messageId,
            attachments: attachments.map(att => ({
              filename: att.filename,
              contentType: att.contentType,
              size: att.size,
              s3Url: att.s3Url
            }))
          });
          
          console.log(`✅ Reply email record created for reference ${replyReferenceNumber}`);
        }
      } catch (dbError) {
        console.error('Error saving reply email record:', dbError);
        // Don't fail the email send if database save fails
      }
    }

    res.json({
      success: true,
      message: 'Email reply sent successfully',
      messageId: result.messageId,
      referenceNumber: replyReferenceNumber,
      originalEmailId: emailId
    });

  } catch (error) {
    console.error('Error sending email reply:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send email reply' 
    });
  }
};