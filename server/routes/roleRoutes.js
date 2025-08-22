// routes/roleRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  createRole,
  updateRole, 
  deleteRole,
  getAllRoles,
  getRolesByTable,
  getRoleCategories,
  getRolesForTable,
  getRoleById
} = require('../controllers/roleController');

// Create a new role
router.post('/', authenticateToken, createRole);

// Get all roles
router.get('/', authenticateToken, getAllRoles);

// Get roles grouped by table (must come before /:roleId)
router.get('/grouped/by-table', authenticateToken, getRolesByTable);

// Get categories for a specific role by role name
router.get('/categories/:roleName', authenticateToken, getRoleCategories);

// Get roles for a specific table
router.get('/table/:tableName', authenticateToken, getRolesForTable);

// Get role by ID (should come after specific routes)
router.get('/:roleId', authenticateToken, getRoleById);

// Update a role
router.put('/:roleId', authenticateToken, updateRole);

// Delete a role
router.delete('/:roleId', authenticateToken, deleteRole);

module.exports = router;

