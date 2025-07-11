// models/PoliceStation.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PoliceStation = sequelize.define('PoliceStation', {
  // Name of the Police Station
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Ensure each police station name is unique
  }
}, {
  timestamps: true,
  underscored: true,  // Convert camelCase field names to snake_case
});

module.exports = PoliceStation;
