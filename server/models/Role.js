// models/Role.js - With table and categories support
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Role model to store different roles with their table and categories
const Role = sequelize.define('Role', {
  roleName: { 
    type: DataTypes.STRING, 
    allowNull: false, 
    unique: true  
  },
  table: {
    type: DataTypes.STRING,
    allowNull: true
  },
  categories: {
    type: DataTypes.JSON, 
    allowNull: true,
    defaultValue: []
  }
}, { 
  timestamps: true, 
  underscored: true 
});

module.exports = Role;
