// models/InwardPatra.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const File    = require('./File');
const User    = require('./User');

const InwardPatra = sequelize.define('InwardPatra', {
  // 0. Auto-generated 8-digit reference number
  referenceNumber: {
    type: DataTypes.STRING(8),
    allowNull: false,
    unique: true,
  },

  // 1. Date of Receipt of the Letter
  dateOfReceiptOfLetter: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },

  // 2. Office Sending the Letter
  officeSendingLetter: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  // 3. Name and Designation of the Sender
  senderNameAndDesignation: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  // 4. Mobile Number
  mobileNumber: {
    type: DataTypes.STRING(15),
    allowNull: true,
  },

  // 5. Letter Medium
  letterMedium: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  // 6. Letter Classification
  letterClassification: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  // 7. Letter Type
  letterType: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  // 8. Date of the Letter
  letterDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },

  // 9. Subject
  subject: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  // 10. Outward Letter Number
  outwardLetterNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },

  // 11. Number of Copies
  numberOfCopies: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },

  // reference to uploaded file
  fileId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: File, key: 'id' },
  },

  // who created it
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: User, key: 'id' },
  },

}, {
  underscored: true,
  timestamps: true,
});

// Associations
InwardPatra.belongsTo(File, { as: 'upload', foreignKey: 'file_id' });
InwardPatra.belongsTo(User, { foreignKey: 'user_id' });

module.exports = InwardPatra;
