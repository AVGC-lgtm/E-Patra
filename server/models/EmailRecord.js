// models/EmailRecord.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EmailRecord = sequelize.define('EmailRecord', {
  subject: DataTypes.STRING,
  from: DataTypes.STRING,
  date: DataTypes.DATE,
  text: DataTypes.TEXT,
  html: DataTypes.TEXT,
  messageId: DataTypes.STRING,
  inReplyTo: DataTypes.STRING,
  references: DataTypes.TEXT,
  attachments: DataTypes.JSON, // Array of { filename, contentType, size, s3Url }
  referenceNumber: DataTypes.STRING
}, {
  timestamps: true,
  tableName: 'EmailRecords'
});

module.exports = EmailRecord;