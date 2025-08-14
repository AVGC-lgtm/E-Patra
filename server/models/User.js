// models/User.js - Clean version without stationName but with OTP fields
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  sign: { // Digital signature column
      type: DataTypes.STRING, // You can change to BLOB if needed for binary data
      allowNull: true, // Allow null initially to avoid issues with existing users
  },
  roleId: { 
    type: DataTypes.INTEGER, 
    references: { model: 'roles', key: 'id' }, 
    allowNull: false 
  },
  // OTP fields for password reset functionality
  otpHash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  otpExpiration: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, { 
  timestamps: true, 
  underscored: true  
});

// No associations defined here - they will be in associations.js

module.exports = User;