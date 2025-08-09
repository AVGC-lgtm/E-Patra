const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');

const authenticateToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'NO_TOKEN'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists and is active
    const user = await User.findByPk(decoded.id, {
      include: [{
        model: Role,
        attributes: ['id', 'roleName']
      }]
    });
    
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Verify that the role in the token matches the user's current role
    if (user.Role && user.Role.roleName !== decoded.roleName) {
      return res.status(401).json({ 
        error: 'Role mismatch detected. Please login again.',
        code: 'ROLE_MISMATCH'
      });
    }

    // Check token expiration with buffer
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp <= currentTime) {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Add user info to request object with validated data
    req.user = {
      id: user.id,
      email: user.email,
      roleId: user.Role ? user.Role.id : decoded.roleId,
      roleName: user.Role ? user.Role.roleName : decoded.roleName,
      table: decoded.table
    };

    // Log security event for audit
    console.log(`Authentication successful for user ${user.email} with role ${req.user.roleName} at ${new Date().toISOString()}`);

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

// Role-based authorization middleware
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'NO_AUTH'
      });
    }

    const userRole = req.user.roleName;
    if (!allowedRoles.includes(userRole)) {
      console.warn(`Access denied: User ${req.user.email} with role '${userRole}' attempted to access resource requiring roles [${allowedRoles.join(', ')}]`);
      
      return res.status(403).json({ 
        error: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        userRole: userRole,
        requiredRoles: allowedRoles
      });
    }

    next();
  };
};

module.exports = { 
  authenticateToken,
  requireRole
};
