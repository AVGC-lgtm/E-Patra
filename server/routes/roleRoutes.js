// routes/roleRoutes.js
const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');

// Create a new role
router.post('/', roleController.createRole);  

// Get all roles
router.get('/', roleController.getRoles);  

// Get a role by ID
router.get('/:id', roleController.getRoleById);  

// Update a role by ID
router.put('/:id', roleController.updateRoleById);  

// Delete a role by ID
router.delete('/:id', roleController.deleteRoleById);  

// Delete all roles
router.delete('/', roleController.deleteAllRoles);

module.exports = router;
