// models/User.js - Clean version without associations
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  email: { 
    type: DataTypes.STRING, 
    allowNull: false, 
    unique: true 
  },
  password: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  stationName: { 
    type: DataTypes.STRING, 
    allowNull: true 
  },
  sign: {  
    type: DataTypes.STRING,  
    allowNull: true,
    comment: 'Digital signature column'
  },
  roleId: { 
    type: DataTypes.INTEGER, 
    references: { model: 'roles', key: 'id' }, 
    allowNull: false 
  }
}, { 
  timestamps: true, 
  underscored: true,
  tableName: 'users'
});

// No associations defined here - they will be in associations.js

module.exports = User;