// Email template utilities
const baseStyle = `
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
  .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
  .content { padding: 20px; background-color: white; border-radius: 0 0 8px 8px; }
  .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
  .highlight { background-color: #dbeafe; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #1e40af; }
  .status-badge { background-color: #10b981; color: white; padding: 5px 10px; border-radius: 20px; font-size: 12px; }
  .button { background-color: #1e40af; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
  .warning { background-color: #fef3c7; padding: 10px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #f59e0b; }
  .success { background-color: #d1fae5; padding: 10px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #10b981; }
  .error { background-color: #fee2e2; padding: 10px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #ef4444; }
  .info { background-color: #dbeafe; padding: 10px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #3b82f6; }
  .table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  .table th, .table td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
  .table th { background-color: #f8f9fa; font-weight: bold; }
`;

const emailTemplates = {
  // Base template wrapper
  baseTemplate: (title, content) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>${baseStyle}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${title}</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>Police Department - Digital Letter Management System<br>
          This is an automated message. Please do not reply to this email.<br>
          For support, contact: support@police.gov.in</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // Application acknowledgment template
  acknowledgment: (data) => {
    const content = `
      <p>Dear ${data.senderNameAndDesignation || 'Applicant'},</p>
      
      <p>We acknowledge the receipt of your application/letter. Here are the details:</p>
      
      <div class="highlight">
        <table class="table">
          <tr>
            <th>Reference Number</th>
            <td><strong>${data.referenceNumber}</strong></td>
          </tr>
          <tr>
            <th>Subject</th>
            <td>${data.subject}</td>
          </tr>
          <tr>
            <th>Date of Receipt</th>
            <td>${new Date(data.dateOfReceiptOfLetter).toLocaleDateString()}</td>
          </tr>
          <tr>
            <th>Status</th>
            <td><span class="status-badge">Received</span></td>
          </tr>
        </table>
      </div>
      
      <div class="info">
        <p><strong>What's Next?</strong></p>
        <ul>
          <li>Your application is being processed by our team</li>
          <li>You will receive updates via email as the status changes</li>
          <li>You can track your application status using the reference number</li>
        </ul>
      </div>
      
      <p>If you have any questions, please contact us with your reference number.</p>
      
      <p>Thank you for your patience.</p>
    `;
    
    return emailTemplates.baseTemplate('Application Acknowledgment', content);
  },

  // Status update template
  statusUpdate: (data, newStatus, remarks) => {
    const statusColors = {
      'received': '#10b981',
      'acknowledged': '#3b82f6',
      'forwarded': '#8b5cf6',
      'processing': '#f59e0b',
      'sending for head sign': '#ef4444',
      'approved': '#10b981',
      'rejected': '#ef4444',
      'completed': '#10b981'
    };

    const content = `
      <p>Dear ${data.senderNameAndDesignation || 'Applicant'},</p>
      
      <p>Your application status has been updated. Here are the details:</p>
      
      <div class="highlight">
        <table class="table">
          <tr>
            <th>Reference Number</th>
            <td><strong>${data.referenceNumber}</strong></td>
          </tr>
          <tr>
            <th>Subject</th>
            <td>${data.subject}</td>
          </tr>
          <tr>
            <th>Previous Status</th>
            <td>${data.letterStatus || 'Processing'}</td>
          </tr>
          <tr>
            <th>New Status</th>
            <td><span class="status-badge" style="background-color: ${statusColors[newStatus] || '#6b7280'}">${newStatus.toUpperCase()}</span></td>
          </tr>
          <tr>
            <th>Updated On</th>
            <td>${new Date().toLocaleDateString()}</td>
          </tr>
        </table>
      </div>
      
      ${remarks ? `<div class="warning"><strong>Remarks:</strong> ${remarks}</div>` : ''}
      
      <div class="info">
        <p><strong>Status Information:</strong></p>
        ${emailTemplates.getStatusInfo(newStatus)}
      </div>
      
      <p>You can continue to track your application status using your reference number.</p>
      
      <p>Thank you for your patience.</p>
    `;
    
    return emailTemplates.baseTemplate('Application Status Update', content);
  },

  // Forwarding notification template
  forwardingNotification: (data, forwardedTo) => {
    const content = `
      <p>Dear Recipient,</p>
      
      <p>A letter has been forwarded to you for your attention and action:</p>
      
      <div class="highlight">
        <table class="table">
          <tr>
            <th>Reference Number</th>
            <td><strong>${data.referenceNumber}</strong></td>
          </tr>
          <tr>
            <th>Subject</th>
            <td>${data.subject}</td>
          </tr>
          <tr>
            <th>From</th>
            <td>${data.senderNameAndDesignation}</td>
          </tr>
          <tr>
            <th>Office</th>
            <td>${data.officeSendingLetter}</td>
          </tr>
          <tr>
            <th>Original Date</th>
            <td>${new Date(data.letterDate).toLocaleDateString()}</td>
          </tr>
        </table>
      </div>
      
      <div class="warning">
        <p><strong>Forwarded Information:</strong></p>
        <ul>
          <li><strong>Forwarded to:</strong> ${forwardedTo.join(', ')}</li>
          <li><strong>Forwarded on:</strong> ${new Date().toLocaleDateString()}</li>
        </ul>
      </div>
      
      <div class="info">
        <p><strong>Action Required:</strong></p>
        <ul>
          <li>Please review the forwarded letter carefully</li>
          <li>Take appropriate action as per your department's guidelines</li>
          <li>Update the status once action is taken</li>
        </ul>
      </div>
      
      <p>Please log in to the system to view the complete letter and take necessary action.</p>
      
      <p>Thank you for your attention to this matter.</p>
    `;
    
    return emailTemplates.baseTemplate('Letter Forwarded', content);
  },

  // Deadline reminder template
  deadlineReminder: (data, deadlineDate) => {
    const content = `
      <p>Dear ${data.senderNameAndDesignation || 'Applicant'},</p>
      
      <p>This is a reminder regarding your application that is approaching its deadline:</p>
      
      <div class="highlight">
        <table class="table">
          <tr>
            <th>Reference Number</th>
            <td><strong>${data.referenceNumber}</strong></td>
          </tr>
          <tr>
            <th>Subject</th>
            <td>${data.subject}</td>
          </tr>
          <tr>
            <th>Current Status</th>
            <td><span class="status-badge">${data.letterStatus || 'Processing'}</span></td>
          </tr>
          <tr>
            <th>Deadline</th>
            <td><strong>${new Date(deadlineDate).toLocaleDateString()}</strong></td>
          </tr>
        </table>
      </div>
      
      <div class="warning">
        <p><strong>Important Notice:</strong></p>
        <p>Your application is approaching its processing deadline. Our team is working to complete the processing within the specified timeframe.</p>
      </div>
      
      <p>If you have any urgent concerns, please contact us immediately.</p>
      
      <p>Thank you for your patience.</p>
    `;
    
    return emailTemplates.baseTemplate('Application Deadline Reminder', content);
  },

  // Bulk notification template
  bulkNotification: (subject, message, additionalInfo = null) => {
    const content = `
      <p>Dear Recipient,</p>
      
      <p>${message}</p>
      
      ${additionalInfo ? `<div class="info">${additionalInfo}</div>` : ''}
      
      <p>For any questions or concerns, please contact the administration.</p>
      
      <p>Thank you for your attention.</p>
    `;
    
    return emailTemplates.baseTemplate(subject, content);
  },

  // Helper function to get status information
  getStatusInfo: (status) => {
    const statusInfo = {
      'received': 'Your application has been received and is in the initial processing stage.',
      'acknowledged': 'Your application has been acknowledged and assigned for review.',
      'forwarded': 'Your application has been forwarded to the appropriate department for further processing.',
      'processing': 'Your application is currently being processed by the assigned officer.',
      'sending for head sign': 'Your application is being sent for final approval and signature.',
      'approved': 'Congratulations! Your application has been approved.',
      'rejected': 'Your application has been rejected. Please check the remarks for more information.',
      'completed': 'Your application has been completed successfully.'
    };
    
    return `<p>${statusInfo[status] || 'Your application is being processed.'}</p>`;
  }
};

module.exports = emailTemplates;