const Role = require('../models/Role');
const roleResponses = require('../responses/roleResponses'); // Importing response module

// Create a new role
const createRole = async (req, res) => {
  const { roleName } = req.body;

  // Validate roleName
  if (!roleName) {
    return res.status(400).json(roleResponses.error('Role name is required'));
  }

  try {
    // Check if the role already exists
    const existingRole = await Role.findOne({ where: { roleName } });
    if (existingRole) {
      return res.status(400).json(roleResponses.error('Role already exists'));
    }

    // Create the new role
    const role = await Role.create({ roleName });
    return res.status(201).json(roleResponses.roleCreated(role));
  } catch (error) {
    console.error('Create role error:', error);
    return res.status(500).json(roleResponses.error('Server error'));
  }
};

// Get a list of all roles
const getRoles = async (req, res) => {
  try {
    const roles = await Role.findAll();
    return res.json(roleResponses.rolesList(roles));
  } catch (error) {
    console.error('Get roles error:', error);
    return res.status(500).json(roleResponses.error('Server error'));
  }
};

// Get a role by ID
const getRoleById = async (req, res) => {
  const { id } = req.params;

  try {
    const role = await Role.findByPk(id);
    if (!role) {
      return res.status(404).json(roleResponses.roleNotFound());
    }

    return res.json(roleResponses.roleCreated(role));
  } catch (error) {
    console.error('Get role by ID error:', error);
    return res.status(500).json(roleResponses.error('Server error'));
  }
};

// Update a role by ID
const updateRoleById = async (req, res) => {
  const { id } = req.params;
  const { roleName } = req.body;

  // Validate roleName
  if (!roleName) {
    return res.status(400).json(roleResponses.error('Role name is required'));
  }

  try {
    const role = await Role.findByPk(id);
    if (!role) {
      return res.status(404).json(roleResponses.roleNotFound());
    }

    role.roleName = roleName;
    await role.save();

    return res.json(roleResponses.roleCreated(role));
  } catch (error) {
    console.error('Update role error:', error);
    return res.status(500).json(roleResponses.error('Server error'));
  }
};

// Delete a role by ID
const deleteRoleById = async (req, res) => {
  const { id } = req.params;

  try {
    const role = await Role.findByPk(id);
    if (!role) {
      return res.status(404).json(roleResponses.roleNotFound());
    }

    await role.destroy();
    return res.json(roleResponses.roleDeleted());
  } catch (error) {
    console.error('Delete role error:', error);
    return res.status(500).json(roleResponses.error('Server error'));
  }
};

// Delete all roles
const deleteAllRoles = async (req, res) => {
  try {
    await Role.destroy({ where: {}, truncate: true });
    return res.json(roleResponses.allRolesDeleted());
  } catch (error) {
    console.error('Delete all roles error:', error);
    return res.status(500).json(roleResponses.error('Server error'));
  }
};

module.exports = {
  createRole,
  getRoles,
  getRoleById,
  updateRoleById,
  deleteRoleById,
  deleteAllRoles
};
