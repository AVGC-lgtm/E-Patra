// models/associations.js - FIXED VERSION WITH HEAD MODEL
const InwardPatra = require('./InwardPatra');
const CoveringLetter = require('./CoveringLetter');
const User = require('./User');
const File = require('./File');
const Head = require('./Head'); // Added Head model

// Define associations

// InwardPatra associations
InwardPatra.belongsTo(User, { foreignKey: 'userId', as: 'User' });
InwardPatra.belongsTo(File, { as: 'uploadedFile', foreignKey: 'fileId' });

// One-to-One relationship: InwardPatra has one CoveringLetter
InwardPatra.hasOne(CoveringLetter, { foreignKey: 'patraId', as: 'coveringLetter' });
// Also add the direct reference through coveringLetterId
// InwardPatra.belongsTo(CoveringLetter, { foreignKey: 'coveringLetterId', as: 'coveringLetter' });

// InwardPatra has many Head entries (for signatures)
InwardPatra.hasMany(Head, { foreignKey: 'patraId', as: 'heads' });

// CoveringLetter associations
CoveringLetter.belongsTo(InwardPatra, { foreignKey: 'patraId', as: 'InwardPatra' });
CoveringLetter.belongsTo(User, { foreignKey: 'userId', as: 'User' });
CoveringLetter.belongsTo(File, { as: 'attachedFile', foreignKey: 'fileId' });

// CoveringLetter has many Head entries (for signatures)
CoveringLetter.hasMany(Head, { foreignKey: 'coveringLetterId', as: 'heads' });

// User associations
User.hasMany(InwardPatra, { foreignKey: 'userId', as: 'inwardPatras' });
User.hasMany(CoveringLetter, { foreignKey: 'userId', as: 'coveringLetters' });

// User has many Head entries (signatures they've made)
User.hasMany(Head, { foreignKey: 'userId', as: 'signatures' });

// File associations
File.hasMany(InwardPatra, { foreignKey: 'fileId', as: 'inwardPatras' });
File.hasMany(CoveringLetter, { foreignKey: 'fileId', as: 'coveringLetters' });



// Head associations
Head.belongsTo(User, { foreignKey: 'userId', as: 'User' });
Head.belongsTo(InwardPatra, { foreignKey: 'patraId', as: 'InwardPatra' });
Head.belongsTo(CoveringLetter, { foreignKey: 'coveringLetterId', as: 'coveringLetters' });

module.exports = {
  InwardPatra,
  CoveringLetter,
  User,
  File,
  Head // Added Head to exports
};