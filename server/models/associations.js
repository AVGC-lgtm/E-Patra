// models/associations.js - Define all model associations
const InwardPatra = require('./InwardPatra');
const CoveringLetter = require('./CoveringLetter');
const User = require('./User');
const File = require('./File');

// Define associations
// InwardPatra associations
InwardPatra.belongsTo(User, { foreignKey: 'userId' });
InwardPatra.belongsTo(File, { as: 'uploadedFile', foreignKey: 'fileId' });

// One-to-One relationship: InwardPatra has one CoveringLetter
InwardPatra.hasOne(CoveringLetter, { foreignKey: 'patraId', as: 'coveringLetter' });
// Also add the direct reference through coveringLetterId
InwardPatra.belongsTo(CoveringLetter, { foreignKey: 'coveringLetterId', as: 'directCoveringLetter' });

// CoveringLetter associations
CoveringLetter.belongsTo(InwardPatra, { foreignKey: 'patraId' });
CoveringLetter.belongsTo(User, { foreignKey: 'userId' });
CoveringLetter.belongsTo(File, { as: 'attachedFile', foreignKey: 'fileId' });

// User associations
User.hasMany(InwardPatra, { foreignKey: 'userId' });
User.hasMany(CoveringLetter, { foreignKey: 'userId' });

// File associations
File.hasMany(InwardPatra, { foreignKey: 'fileId' });
File.hasMany(CoveringLetter, { foreignKey: 'fileId' });

module.exports = {
  InwardPatra,
  CoveringLetter,
  User,
  File
};