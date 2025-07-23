// models/InwardPatra.js - Fixed with proper associations and resend fields
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
  
  // ===== NEW RESEND TRACKING FIELDS =====
  
  // Previous status before resend
  previousStatus: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'The letter status before it was resent'
  },
  
  // Reason for resending
  resendReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Reason provided for resending the letter'
  },
  
  // Timestamp when letter was resent
  resendAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when the letter was resent'
  },
  
  // User ID who resent the letter
  resendBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { 
      model: 'users', 
      key: 'id' 
    },
    comment: 'User ID of the person who resent the letter'
  },
  
  // Email of user who resent
  resendByEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Email of the person who resent the letter'
  },
  
  // Name of user who resent
  resendByName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Name of the person who resent the letter'
  },
  
  // Role of user who resent (e.g., 'HOD', 'ADMIN')
  resendByRole: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Role of the person who resent the letter'
  },
  
  // Count of how many times letter has been resent
  resendCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Number of times this letter has been resent'
  },
  
  // ===== ADDITIONAL TRACKING FIELDS (OPTIONAL) =====
  
  // When letter was sent to HOD
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when letter was sent to HOD'
  },
  
  // Who last updated the letter
  updatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { 
      model: 'users', 
      key: 'id' 
    },
    comment: 'User ID of the person who last updated the letter'
  },
  
  // Email of who last updated
  updatedByEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Email of the person who last updated the letter'
  },
  
  // Name of who last updated
  updatedByName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Name of the person who last updated the letter'
  },
  
  // Role of who last updated
  userRole: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Role of the person who last updated the letter'
  }
}, {
  underscored: true,
  timestamps: true,
  tableName: 'inward_patras',
  
  // Add hooks to automatically increment resend count
  hooks: {
    beforeUpdate: (instance, options) => {
      // If previousStatus is being set (indicating a resend), increment the count
      if (instance.changed('previousStatus') && instance.previousStatus) {
        instance.resendCount = (instance.resendCount || 0) + 1;
      }
    }
  }
});

// Remove any associations from here - they will be defined in associations.js

module.exports = InwardPatra;