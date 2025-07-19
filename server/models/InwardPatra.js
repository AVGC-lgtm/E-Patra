// models/InwardPatra.js - Fixed with proper associations
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InwardPatra = sequelize.define('InwardPatra', {
  referenceNumber: {
    type: DataTypes.STRING(8),
    allowNull: false,
    unique: true,
  },
  dateOfReceiptOfLetter: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  officeSendingLetter: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  senderNameAndDesignation: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  mobileNumber: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  letterMedium: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  letterClassification: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  letterType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  letterDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  subject: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  outwardLetterNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  numberOfCopies: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1,
  },
  letterStatus: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  NA: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },
  NAR: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },
  fileId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'files', key: 'id' },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  coveringLetterId: {
    type: DataTypes.INTEGER,
    allowNull: true, // Nullable initially, will be set after covering letter creation
    references: { model: 'covering_letters', key: 'id' },
  },
  sentTo: {
    type: DataTypes.TEXT,
    allowNull: true, // Store JSON string of recipient information
  },
}, {
  underscored: true,
  timestamps: true,
  tableName: 'inward_patras'
});

// Remove any associations from here - they will be defined in associations.js

module.exports = InwardPatra;