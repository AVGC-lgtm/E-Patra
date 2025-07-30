// Authentication utility functions with enhanced security

// Check if user has valid session
export const isValidSession = () => {
  const token = getAuthToken();
  if (!token) return false;
  
  try {
    const tokenData = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    
    // Check if token is expired (with 5 minute buffer)
    return tokenData.exp > (currentTime + 300);
  } catch (error) {
    console.error('Invalid token structure:', error);
    return false;
  }
};

// Get user role from token
export const getUserRole = () => {
  const token = getAuthToken();
  if (!token) return null;
  
  try {
    const tokenData = JSON.parse(atob(token.split('.')[1]));
    return tokenData.roleName;
  } catch (error) {
    console.error('Error extracting role from token:', error);
    return null;
  }
};

// Validate token with server
export const validateTokenWithServer = async () => {
  const token = getAuthToken();
  if (!token) return false;
  
  try {
    const response = await fetch('http://localhost:5000/api/auth/verify', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      return true;
    } else {
      const errorData = await response.json();
      console.warn('Token validation failed:', errorData);
      
      // Clear tokens if they're invalid
      if (['INVALID_TOKEN', 'TOKEN_EXPIRED', 'USER_NOT_FOUND', 'ROLE_MISMATCH'].includes(errorData.code)) {
        clearAuthTokens();
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error validating token with server:', error);
    return false;
  }
};

// Authentication utility functions
export const getAuthToken = () => {
  // Try sessionStorage first, then localStorage as fallback
  return sessionStorage.getItem('token') || localStorage.getItem('token');
};

export const setAuthToken = (token) => {
  sessionStorage.setItem('token', token);
  localStorage.setItem('token', token);
  sessionStorage.setItem('sessionActive', 'true');
  sessionStorage.setItem('lastActivity', Date.now().toString());
};

export const clearAuthTokens = () => {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('sessionActive');
  sessionStorage.removeItem('lastActivity');
  localStorage.removeItem('token');
};

export const isSessionActive = () => {
  const sessionActive = sessionStorage.getItem('sessionActive') === 'true';
  const lastActivity = sessionStorage.getItem('lastActivity');
  
  if (!sessionActive || !lastActivity) {
    return false;
  }
  
  // Check if session is older than 24 hours
  const activityTime = parseInt(lastActivity);
  const currentTime = Date.now();
  const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
  
  if (currentTime - activityTime > maxSessionAge) {
    clearAuthTokens();
    return false;
  }
  
  return true;
};

// Update last activity timestamp
export const updateLastActivity = () => {
  if (isSessionActive()) {
    sessionStorage.setItem('lastActivity', Date.now().toString());
  }
}; 