// models/Role.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Role model to store different roles like inward_user, sp, head, etc.
const Role = sequelize.define('Role', {
  roleName: { type: DataTypes.STRING, allowNull: false, unique: true  }
}, { 
  timestamps: true, 
  underscored: true 
});

module.exports = Role;
