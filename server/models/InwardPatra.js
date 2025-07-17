const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const File = require('./File');
const User = require('./User');

const InwardPatra = sequelize.define('InwardPatra', {
  referenceNumber: {
    type: DataTypes.STRING(8),
    allowNull: false,
    unique: true,
  },
  dateOfReceiptOfLetter: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  officeSendingLetter: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  senderNameAndDesignation: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  mobileNumber: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  letterMedium: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  letterClassification: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  letterType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  letterDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  subject: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  outwardLetterNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  numberOfCopies: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1,
  },
  fileId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: File, key: 'id' },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: User, key: 'id' },
  },
}, {
  underscored: true,
  timestamps: true,
});

InwardPatra.belongsTo(File, { as: 'upload', foreignKey: 'file_id' });
InwardPatra.belongsTo(User, { foreignKey: 'user_id' });

module.exports = InwardPatra;
