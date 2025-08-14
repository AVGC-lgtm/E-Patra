// utils/errorHandler.js

class ErrorHandler {
  
    // Check if OpenAI service is available
    static async checkOpenAIService() {
      try {
        const openaiService = require('../services/openaiService');
        // Simple test to check if OpenAI is working
        await openaiService.generateProblemSolution('test');
        return { status: true, message: 'OpenAI service is available' };
      } catch (error) {
        return { 
          status: false, 
          message: 'OpenAI service is not available',
          error: error.message 
        };
      }
    }
  
    // Check if S3 service is available
    static async checkS3Service() {
      try {
        const AWS = require('aws-sdk');
        const s3 = new AWS.S3();
        
        // Simple test to check S3 connectivity
        const params = {
          Bucket: process.env.AWS_BUCKET_NAME,
          MaxKeys: 1
        };
        
        await s3.listObjects(params).promise();
        return { status: true, message: 'S3 service is available' };
      } catch (error) {
        return { 
          status: false, 
          message: 'S3 service is not available',
          error: error.message 
        };
      }
    }
  
    // Check if file has extractable text
    static checkFileText(file) {
      if (!file) {
        return { status: false, message: 'No file provided' };
      }
  
      if (!file.extractData || !file.extractData.text) {
        return { status: false, message: 'No extracted text found in file' };
      }
  
      const textLength = file.extractData.text.trim().length;
      if (textLength < 100) {
        return { 
          status: false, 
          message: `Extracted text too short (${textLength} characters). Need at least 100 characters for covering letter generation.` 
        };
      }
  
      return { status: true, message: 'File text is sufficient for processing' };
    }
  
    // Pre-flight check before creating Patra
    static async preFlightCheck(fileId = null) {
      const checks = {
        openai: await this.checkOpenAIService(),
        s3: await this.checkS3Service(),
        file: { status: true, message: 'No file validation required' }
      };
  
      if (fileId) {
        try {
          const File = require('../models/File');
          const file = await File.findByPk(fileId);
          checks.file = this.checkFileText(file);
        } catch (error) {
          checks.file = { status: false, message: 'File not found or inaccessible' };
        }
      }
  
      const allPassed = Object.values(checks).every(check => check.status);
      
      return {
        passed: allPassed,
        checks: checks,
        errors: Object.values(checks)
          .filter(check => !check.status)
          .map(check => check.message)
      };
    }
  
    // Format error response
    static formatErrorResponse(error, context = '') {
      const errorMap = {
        'OpenAI': 'AI service is currently unavailable. Please try again later.',
        'S3': 'File storage service is unavailable. Please try again later.',
        'Patra not found': 'The requested Patra record could not be found.',
        'File not found': 'The uploaded file could not be found.',
        'No text found': 'The uploaded file does not contain readable text.',
        'text too short': 'The uploaded file does not contain enough text for processing.'
      };
  
      let userFriendlyMessage = error.message;
  
      for (const [key, message] of Object.entries(errorMap)) {
        if (error.message.toLowerCase().includes(key.toLowerCase())) {
          userFriendlyMessage = message;
          break;
        }
      }
  
      return {
        success: false,
        error: userFriendlyMessage,
        context: context,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { 
          originalError: error.message,
          stack: error.stack 
        })
      };
    }
  }
  
  module.exports = ErrorHandler;