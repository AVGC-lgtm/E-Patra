# Email API Documentation

## Overview
This API provides comprehensive email functionality for sending letters with attachments to multiple recipients. It supports both single and bulk email operations with file attachments.

## Email Endpoints

### 1. Send Inward Letter Email (Bulk with Attachments)
**POST** `/api/dynamic-email/send-inward-letter`

Sends inward letters with attachments and covering letters to multiple recipients (IGP, SP, SDPO).

**Request Body:**
```json
{
  "letterId": "123",
  "senderEmail": "staff@police.gov.in",
  "recipients": ["igp", "sp", "sdpo"],
  "customMessage": "Please review this letter urgently",
  "includeCoveringLetter": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Inward letter email processed: 3 sent, 0 failed",
  "data": {
    "letterId": "123",
    "referenceNumber": "REF001",
    "from": "staff@police.gov.in",
    "totalReceivers": 3,
    "successful": 3,
    "failed": 0,
    "attachments": 2,
    "results": [
      {
        "email": "punddipak444@gmail.com",
        "name": "Inspector General of Police",
        "designation": "IGP",
        "success": true,
        "messageId": "msg_123"
      },
      {
        "email": "punddipak9@gmail.com",
        "name": "Superintendent of Police",
        "designation": "SP",
        "success": true,
        "messageId": "msg_124"
      },
      {
        "email": "punddipak444@gmail.com",
        "name": "Sub-Divisional Police Officer",
        "designation": "SDPO",
        "success": true,
        "messageId": "msg_125"
      }
    ]
  }
}
```

### 2. Send Bulk Email with Attachments
**POST** `/api/dynamic-email/send-bulk`

Sends emails with attachments to multiple recipients using sender and receiver IDs.

**Request Body:**
```json
{
  "senderId": 1,
  "receiverIds": [2, 3, 4],
  "subject": "Important Notice",
  "htmlContent": "<h1>Hello</h1><p>This is an important message.</p>",
  "textContent": "Hello, This is an important message.",
  "attachments": [
    {
      "filename": "document.pdf",
      "content": "base64_encoded_content",
      "contentType": "application/pdf"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bulk email processed: 3 sent, 0 failed",
  "data": {
    "from": "sender@example.com",
    "totalReceivers": 3,
    "successful": 3,
    "failed": 0,
    "attachmentCount": 1,
    "results": [
      {
        "receiverId": 2,
        "email": "recipient1@example.com",
        "name": "John Doe",
        "designation": "Manager",
        "success": true,
        "messageId": "msg_123"
      }
    ],
    "summary": {
      "totalProcessed": 3,
      "successRate": "100.0%",
      "processingTime": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

### 3. Send Email with Attachments
**POST** `/api/dynamic-email/send-with-attachments`

Sends emails with multiple attachments to multiple recipients.

**Request Body:**
```json
{
  "senderId": 1,
  "receiverIds": [2, 3],
  "subject": "Email with Attachments",
  "htmlContent": "<h1>Attachments</h1><p>Please find the attached files.</p>",
  "textContent": "Attachments: Please find the attached files.",
  "attachments": [
    {
      "filename": "report.pdf",
      "content": "base64_encoded_pdf_content",
      "contentType": "application/pdf"
    },
    {
      "filename": "image.jpg",
      "content": "base64_encoded_image_content",
      "contentType": "image/jpeg"
    }
  ]
}
```

### 4. Send Dynamic Email (Auto-create contacts)
**POST** `/api/dynamic-email/send-dynamic`

Sends emails using email addresses, automatically creating sender/receiver records if they don't exist.

**Request Body:**
```json
{
  "senderEmail": "sender@example.com",
  "receiverEmails": ["recipient1@example.com", "recipient2@example.com"],
  "subject": "Dynamic Email",
  "htmlContent": "<h1>Dynamic Message</h1><p>This email was sent dynamically.</p>",
  "textContent": "Dynamic Message: This email was sent dynamically.",
  "attachments": [],
  "createIfNotExists": true
}
```

### 5. Send Single Email
**POST** `/api/dynamic-email/send-single`

Sends a single email from one sender to one receiver.

**Request Body:**
```json
{
  "senderId": 1,
  "receiverId": 2,
  "subject": "Single Email",
  "htmlContent": "<h1>Hello</h1><p>This is a single email.</p>",
  "textContent": "Hello, This is a single email.",
  "attachments": []
}
```

### 6. Get Email Contacts
**GET** `/api/dynamic-email/contacts`

Retrieves all available email senders and receivers.

**Response:**
```json
{
  "success": true,
  "data": {
    "senders": [
      {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "designation": "Manager",
        "department": "IT"
      }
    ],
    "receivers": [
      {
        "id": 2,
        "name": "Jane Smith",
        "email": "jane@example.com",
        "designation": "Assistant",
        "department": "HR"
      }
    ],
    "totalSenders": 1,
    "totalReceivers": 1
  }
}
```

## Email Sender/Receiver Management

### Email Sender Endpoints
- **POST** `/api/email-sender-receiver/senders` - Create sender
- **GET** `/api/email-sender-receiver/senders` - Get all senders
- **GET** `/api/email-sender-receiver/senders/:id` - Get sender by ID
- **PUT** `/api/email-sender-receiver/senders/:id` - Update sender
- **DELETE** `/api/email-sender-receiver/senders/:id` - Delete sender

### Email Receiver Endpoints
- **POST** `/api/email-sender-receiver/receivers` - Create receiver
- **GET** `/api/email-sender-receiver/receivers` - Get all receivers
- **GET** `/api/email-sender-receiver/receivers/:id` - Get receiver by ID
- **PUT** `/api/email-sender-receiver/receivers/:id` - Update receiver
- **DELETE** `/api/email-sender-receiver/receivers/:id` - Delete receiver

## Features

### Bulk Email Capabilities
- ✅ Send to multiple recipients simultaneously
- ✅ Attach multiple files (PDF, images, documents)
- ✅ Progress tracking and detailed results
- ✅ Rate limiting protection (100ms delay between emails)
- ✅ Comprehensive error handling
- ✅ Success/failure statistics

### Attachment Support
- ✅ PDF files
- ✅ Images (JPEG, PNG, etc.)
- ✅ Documents (Word, Excel, etc.)
- ✅ Base64 encoded content
- ✅ Automatic content-type detection
- ✅ File size validation

### Email Management
- ✅ Sender and receiver management
- ✅ Active/inactive status tracking
- ✅ Automatic contact creation
- ✅ Email validation
- ✅ Designation and department tracking

## Environment Variables

Add these to your `.env` file:

```env
# Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password

# Police Department Email Addresses
IGP_EMAIL=igp@police.gov.in
SP_EMAIL=sp@police.gov.in
SDPO_EMAIL=sdpo@police.gov.in
```

## Usage Examples

### Frontend Integration (React)

```javascript
// Send inward letter with attachments
const sendInwardLetter = async (letterId, recipients) => {
  try {
    const response = await axios.post('/api/dynamic-email/send-inward-letter', {
      letterId: letterId,
      senderEmail: userEmail,
      recipients: recipients, // ['igp', 'sp', 'sdpo']
      customMessage: 'Please review this letter',
      includeCoveringLetter: true
    });
    
    console.log('Email sent:', response.data);
  } catch (error) {
    console.error('Email error:', error);
  }
};

// Send bulk email with attachments
const sendBulkEmail = async (senderId, receiverIds, subject, content, attachments) => {
  try {
    const response = await axios.post('/api/dynamic-email/send-bulk', {
      senderId: senderId,
      receiverIds: receiverIds,
      subject: subject,
      htmlContent: content,
      attachments: attachments
    });
    
    console.log('Bulk email sent:', response.data);
  } catch (error) {
    console.error('Bulk email error:', error);
  }
};
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "details": "Additional error details"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (missing required fields)
- `404` - Not Found (sender/receiver/letter not found)
- `500` - Internal Server Error

## Rate Limiting

The API includes built-in rate limiting:
- 100ms delay between emails to avoid SMTP rate limits
- Progress tracking for bulk operations
- Detailed success/failure reporting
- Graceful error handling for individual failures
