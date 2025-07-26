// routes/roleRoutes.js
const express = require('express');
const router = express.Router();
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
router.post('/', createRole);

// Get all roles
router.get('/', getAllRoles);

// Get roles grouped by table (must come before /:roleId)
router.get('/grouped/by-table', getRolesByTable);

// Get categories for a specific role by role name
router.get('/categories/:roleName', getRoleCategories);

// Get roles for a specific table
router.get('/table/:tableName', getRolesForTable);

// Get role by ID (should come after specific routes)
router.get('/:roleId', getRoleById);

// Update a role
router.put('/:roleId', updateRole);

// Delete a role
router.delete('/:roleId', deleteRole);

module.exports = router;

