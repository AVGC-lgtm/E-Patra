// controllers/roleController.js
const Role = require('../models/Role');

// Utility function for error responses
const sendError = (res, message, status = 500) => {
  return res.status(status).json({ success: false, message });
};

// Create a new role
const createRole = async (req, res) => {
  try {
    const { roleName, table, categories } = req.body;

    // Validate required fields
    if (!roleName || !table) {
      return sendError(res, 'Role name and table are required', 400);
    }

    // Validate roleName format (no spaces, special characters)
    const roleNamePattern = /^[a-zA-Z0-9_]+$/;
    if (!roleNamePattern.test(roleName)) {
      return sendError(res, 'Role name can only contain letters, numbers, and underscores', 400);
    }

    // Check if role with same name already exists
    const existingRole = await Role.findOne({ where: { roleName } });
    if (existingRole) {
      return sendError(res, 'Role with this name already exists', 400);
    }

    // Validate categories if provided
    let validatedCategories = [];
    if (categories) {
      if (Array.isArray(categories)) {
        validatedCategories = categories.filter(cat => cat && typeof cat === 'string');
      } else {
        return sendError(res, 'Categories must be an array of strings', 400);
      }
    }

    // Create the new role
    const newRole = await Role.create({
      roleName: roleName.trim(),
      table: table.trim(),
      categories: validatedCategories
    });

    return res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: {
        id: newRole.id,
        roleName: newRole.roleName,
        table: newRole.table,
        categories: newRole.categories,
        createdAt: newRole.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating role:', error);
    return sendError(res, 'Error creating role');
  }
};

// Update an existing role
const updateRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { roleName, table, categories } = req.body;

    // Find the role
    const role = await Role.findByPk(roleId);
    if (!role) {
      return sendError(res, 'Role not found', 404);
    }

    // Validate roleName format if provided
    if (roleName) {
      const roleNamePattern = /^[a-zA-Z0-9_]+$/;
      if (!roleNamePattern.test(roleName)) {
        return sendError(res, 'Role name can only contain letters, numbers, and underscores', 400);
      }

      // Check if another role with same name exists
      const existingRole = await Role.findOne({ 
        where: { 
          roleName,
          id: { [require('sequelize').Op.ne]: roleId }
        } 
      });
      if (existingRole) {
        return sendError(res, 'Role with this name already exists', 400);
      }
    }

    // Validate categories if provided
    let validatedCategories = role.categories;
    if (categories !== undefined) {
      if (Array.isArray(categories)) {
        validatedCategories = categories.filter(cat => cat && typeof cat === 'string');
      } else {
        return sendError(res, 'Categories must be an array of strings', 400);
      }
    }

    // Update the role
    const updatedRole = await role.update({
      roleName: roleName ? roleName.trim() : role.roleName,
      table: table ? table.trim() : role.table,
      categories: validatedCategories
    });

    return res.json({
      success: true,
      message: 'Role updated successfully',
      data: {
        id: updatedRole.id,
        roleName: updatedRole.roleName,
        table: updatedRole.table,
        categories: updatedRole.categories,
        updatedAt: updatedRole.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating role:', error);
    return sendError(res, 'Error updating role');
  }
};

// Delete a role
const deleteRole = async (req, res) => {
  try {
    const { roleId } = req.params;

    // Find the role
    const role = await Role.findByPk(roleId);
    if (!role) {
      return sendError(res, 'Role not found', 404);
    }

    // Check if any users are associated with this role
    const User = require('../models/User');
    const usersWithRole = await User.findOne({ where: { roleId } });
    if (usersWithRole) {
      return sendError(res, 'Cannot delete role as it is assigned to users', 400);
    }

    // Delete the role
    await role.destroy();

    return res.json({
      success: true,
      message: 'Role deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting role:', error);
    return sendError(res, 'Error deleting role');
  }
};

// Get all roles
const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.findAll({
      order: [['table', 'ASC'], ['roleName', 'ASC']]
    });
    return res.json({ success: true, data: roles });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return sendError(res, 'Error fetching roles');
  }
};

// Get roles grouped by table
const getRolesByTable = async (req, res) => {
  try {
    const roles = await Role.findAll({
      order: [['table', 'ASC'], ['roleName', 'ASC']]
    });
    // Group roles by table
    const groupedRoles = {};
    roles.forEach(role => {
      if (!groupedRoles[role.table]) groupedRoles[role.table] = [];
      groupedRoles[role.table].push({
        id: role.id,
        roleName: role.roleName,
        categories: role.categories
      });
    });
    return res.json({ success: true, data: groupedRoles });
  } catch (error) {
    console.error('Error fetching roles by table:', error);
    return sendError(res, 'Error fetching roles by table');
  }
};

// Get categories for a specific role
const getRoleCategories = async (req, res) => {
  try {
    const { roleName } = req.params;
    const role = await Role.findOne({ where: { roleName } });
    if (!role) {
      return sendError(res, 'Role not found', 404);
    }
    return res.json({
      success: true,
      data: {
        roleName: role.roleName,
        table: role.table,
        categories: role.categories
      }
    });
  } catch (error) {
    console.error('Error fetching role categories:', error);
    return sendError(res, 'Error fetching role categories');
  }
};

// Get roles for a specific table
const getRolesForTable = async (req, res) => {
  try {
    const { tableName } = req.params;
    const roles = await Role.findAll({
      where: { table: tableName },
      order: [['roleName', 'ASC']]
    });
    return res.json({ success: true, data: roles });
  } catch (error) {
    console.error('Error fetching roles for table:', error);
    return sendError(res, 'Error fetching roles for table');
  }
};

// Get role by ID
const getRoleById = async (req, res) => {
  try {
    const { roleId } = req.params;
    const role = await Role.findByPk(roleId);
    
    if (!role) {
      return sendError(res, 'Role not found', 404);
    }

    return res.json({
      success: true,
      data: role
    });
  } catch (error) {
    console.error('Error fetching role by ID:', error);
    return sendError(res, 'Error fetching role');
  }
};

module.exports = {
  createRole,
  updateRole,
  deleteRole,
  getAllRoles,
  getRolesByTable,
  getRoleCategories,
  getRolesForTable,
  getRoleById
};
