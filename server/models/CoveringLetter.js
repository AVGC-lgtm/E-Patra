// models/CoveringLetter.js - Fixed with proper associations
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CoveringLetter = sequelize.define('CoveringLetter', {
  patraId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'inward_patras', key: 'id' },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  fileId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'files', key: 'id' },
  },
  letterContent: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  letterType: {
    type: DataTypes.ENUM('NAR', 'NA', 'FORWARD', 'ACKNOWLEDGMENT'),
    allowNull: false,
  },
  generatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  status: {
    type: DataTypes.ENUM('DRAFT', 'SENT', 'ARCHIVED'),
    defaultValue: 'DRAFT',
  },
  recipientOffice: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  recipientDesignation: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  letterNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  letterDate: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW,
  },
  pdfUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'S3 URL for PDF version'
  },
  htmlUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'S3 URL for HTML version'
  },
  s3FileName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'S3 file name for the PDF'
  },
  problemStatement: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'AI-generated problem statement'
  },
  solutionApproach: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'AI-generated solution approach'
  }
}, {
  underscored: true,
  timestamps: true,
  tableName: 'covering_letters'
});

module.exports = CoveringLetter;