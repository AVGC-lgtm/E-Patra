// models/associations.js - FIXED VERSION WITH UNIQUE ALIASES
const sequelize = require('../config/database');

// Direct imports since these are already defined models, not factory functions
const InwardPatra = require('./InwardPatra');
const File = require('./File');
const Head = require('./Head');
const CoveringLetter = require('./CoveringLetter');
const User = require('./User'); // You'll need this for associations
const Role = require('./Role'); // Add Role model import

// Define associations

// InwardPatra - User association
InwardPatra.belongsTo(User, {
  foreignKey: 'userId',
  as: 'User'
});

User.hasMany(InwardPatra, {
  foreignKey: 'userId',
  as: 'InwardPatras'
});

// InwardPatra - File association (for uploaded file)
InwardPatra.belongsTo(File, {
  foreignKey: 'fileId',
  as: 'uploadedFile'
});

File.hasMany(InwardPatra, {
  foreignKey: 'fileId',
  as: 'InwardPatras'
});

// InwardPatra - CoveringLetter association (one-to-one via coveringLetterId)
InwardPatra.belongsTo(CoveringLetter, {
  foreignKey: 'coveringLetterId',
  as: 'coveringLetter'
});

CoveringLetter.hasOne(InwardPatra, {
  foreignKey: 'coveringLetterId',
  as: 'patraWithCoveringLetter' // Changed alias to be unique
});

// CoveringLetter - InwardPatra association (belongs to via patraId)
CoveringLetter.belongsTo(InwardPatra, {
  foreignKey: 'patraId',
  as: 'InwardPatra' // This is OK as it's on CoveringLetter model
});

InwardPatra.hasOne(CoveringLetter, {
  foreignKey: 'patraId',
  as: 'generatedCoveringLetter' // Unique alias for the reverse association
});

// CoveringLetter - User association
CoveringLetter.belongsTo(User, {
  foreignKey: 'userId',
  as: 'User'
});

User.hasMany(CoveringLetter, {
  foreignKey: 'userId',
  as: 'CoveringLetters'
});

// CoveringLetter - File association (for attached file)
CoveringLetter.belongsTo(File, {
  foreignKey: 'fileId',
  as: 'attachedFile'
});

File.hasMany(CoveringLetter, {
  foreignKey: 'fileId',
  as: 'CoveringLetters'
});

// Head - InwardPatra association
Head.belongsTo(InwardPatra, {
  foreignKey: 'patraId',
  as: 'InwardPatra'
});

InwardPatra.hasMany(Head, {
  foreignKey: 'patraId',
  as: 'heads'
});

// Head - CoveringLetter association
Head.belongsTo(CoveringLetter, {
  foreignKey: 'coveringLetterId',
  as: 'CoveringLetter'
});

CoveringLetter.hasMany(Head, {
  foreignKey: 'coveringLetterId',
  as: 'heads'
});

// Head - User association
Head.belongsTo(User, {
  foreignKey: 'userId',
  as: 'User'
});

User.hasMany(Head, {
  foreignKey: 'userId',
  as: 'Heads'
});

// Export all models
module.exports = {
  InwardPatra,
  File,
  Head,
  CoveringLetter,
  User,
  Role, // Add Role model to exports
  sequelize // Export sequelize instance as well
};