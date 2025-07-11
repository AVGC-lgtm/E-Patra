const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patra = require('./Patra');  // Reference to the Patra model
const User = require('./User');  // Reference to the User model
const PoliceStation = require('./PoliceStation'); // Reference to the PoliceStation model

const Acknowledgment = sequelize.define('Acknowledgment', {
  // Reference to Patra
  patraId: {
    type: DataTypes.INTEGER,
    references: {
      model: Patra,
      key: 'id',
    },
    allowNull: false,
  },

  // Reference Number
  referenceNumber: {
    type: DataTypes.STRING,
    allowNull: false,  // Ensure the reference number is always provided
  },

  // Acknowledged by User
  acknowledgedBy: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
    allowNull: false,
  },

  // Acknowledgment Date
  acknowledgedDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,  // Set the current timestamp
  },

  // Letter Status (Initially 'pending', will be updated after acknowledgment)
  letterStatus: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending', // Default status when acknowledgment happens
  },

  // Created User ID (User who created the Patra)
  createdUserId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
    allowNull: false,
  },

  // Branch Name (PoliceStation reference)
  branchName: {
    type: DataTypes.INTEGER,
    references: {
      model: PoliceStation,
      key: 'id',
    },
    allowNull: false,
  },

}, {
  timestamps: true,
  underscored: true,
});

module.exports = Acknowledgment;
