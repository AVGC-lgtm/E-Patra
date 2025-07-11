// models/Patra.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');  // Import User model
const PoliceStation = require('./PoliceStation'); // Import PoliceStation model

const Patra = sequelize.define('Patra', {
  // Reference Number (8 digits)
  referenceNumber: {
    type: DataTypes.STRING(8),
    allowNull: false,
    unique: true,
  },

  // Received by Office
  receivedByOffice: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  // Name and Designation of the Recipient
  recipientNameAndDesignation: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  // Letter Type
  letterType: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  // Letter Date
  letterDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },

  // Office Type
  officeType: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  // Office
  office: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  // Mobile Number
  mobileNumber: {
    type: DataTypes.STRING,
    allowNull: true,  // Can be null
  },

  // Remarks
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,  // Can be null
  },

  // Reference to Police Station (via foreign key)
  branchName: {
    type: DataTypes.INTEGER,  // Foreign key to PoliceStation's id
    references: {
      model: PoliceStation,
      key: 'id',
    },
    allowNull: false,
  },

  // Type of Action
  typeOfAction: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  // Letter Status
  letterStatus: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  // Letter Medium (e.g., email, physical)
  letterMedium: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  // Subject and Details of the Letter
  subjectAndDetails: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  // Letter Files (JSON array of file paths)
  letterFiles: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },

  // Inward User ID (User who created the Patra)
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,  // Reference the User model
      key: 'id',    // Reference to the 'id' field of User model
    },
    allowNull: false,
  },

}, {
  timestamps: true,  // Automatically adds createdAt and updatedAt fields
  underscored: true,  // Converts camelCase field names to snake_case
});

// Define relationships:
Patra.belongsTo(User, { foreignKey: 'userId' }); // User who created the Patra
Patra.belongsTo(PoliceStation, { foreignKey: 'branchName' }); // PoliceStation related to the Patra (via branchName)

module.exports = Patra;
