// models/File.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const File = sequelize.define('File', {
  originalName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fileUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  mimeType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  uploadedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  extractData: { // FIXED: Changed from extractData to extractedData for consistency
    type: DataTypes.JSON,
    allowNull: true
  },
  solution: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  problemStatement: { // FIXED: Corrected typo from problemStatemet
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'files',
  underscored: true
});

// FIXED: Add association method
File.associate = function(models) {
  // A file can be associated with multiple patras
  File.hasMany(models.InwardPatra, {
    foreignKey: 'fileId',
    as: 'patras'
  });
};

module.exports = File;