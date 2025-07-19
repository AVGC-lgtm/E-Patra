// models/Head.js - FIXED VERSION FOR POSTGRESQL
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Head = sequelize.define('Head', {

  patraId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'patra_id',
    references: {
      model: 'inward_patras', // Changed from 'patras' to match your actual table
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  coveringLetterId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'covering_letter_id',
    references: {
      model: 'covering_letters',
      key: 'id'
    }
  },
  referenceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'reference_id'
  },
  signStatus: {
    type: DataTypes.ENUM('pending', 'signed', 'rejected'),
    defaultValue: 'pending',
    field: 'sign_status'
  },
  signedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'signed_at'
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  signaturePosition: {
    type: DataTypes.ENUM('bottom-right', 'bottom-left', 'bottom-center', 'top-right', 'top-left', 'center'),
    defaultValue: 'bottom-right',
    field: 'signature_position'
  }
}, {
  timestamps: true,
  underscored: true,
  tableName: 'heads'
});

module.exports = Head;