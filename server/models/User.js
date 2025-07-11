const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Role = require('./Role');  // Import the Role model

// User model with stationName and roleId
const User = sequelize.define('User', {
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  stationName: { type: DataTypes.STRING, allowNull: true},
  roleId: { type: DataTypes.INTEGER, references: { model: Role, key: 'id' }, allowNull: false }}, { 
  timestamps: true, 
  underscored: true  
});

// Define relationship: User belongs to Role
User.belongsTo(Role, { foreignKey: 'roleId' });

module.exports = User;
