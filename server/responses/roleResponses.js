// responses/roleResponses.js

module.exports = {
  roleCreated: (role) => {
    return {
      message: 'Role created successfully',
      role,
    };
  },
  rolesList: (roles) => {
    return {
      roles,
    };
  },
  roleNotFound: () => {
    return {
      error: 'Role not found',
    };
  },
  roleDeleted: () => {
    return {
      message: 'Role deleted successfully',
    };
  },
  allRolesDeleted: () => {
    return {
      message: 'All roles deleted successfully',
    };
  },
  error: (message) => {
    return {
      error: message,
    };
  },
};
