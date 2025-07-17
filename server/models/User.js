// models/User.js - Clean version without associations
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  stationName: { type: DataTypes.STRING, allowNull: true },
  sign: { // Digital signature column
      type: DataTypes.STRING, // You can change to BLOB if needed for binary data
      allowNull: true, // Allow null initially to avoid issues with existing users
  },
  roleId: { 
    type: DataTypes.INTEGER, 
    references: { model: 'roles', key: 'id' }, 
    allowNull: false 
  }
  // roleId: { type: DataTypes.INTEGER, references: { model: Role, key: 'id' }, allowNull: false }
}, { 
  timestamps: true, 
  underscored: true  
});

// No associations defined here - they will be in associations.js

module.exports = User;