// responses/authResponses.js

module.exports = {
  userRegistered: (user, token) => {
    return {
      message: 'User registered successfully',
      token,
      user: { id: user.id, email: user.email, roleName: user.Role.roleName, stationName: user.stationName },
    };
  },
  loginSuccessful: (token) => {
    return {
      message: 'Login successful',
      token,
    };
  },
  passwordResetSuccess: () => {
    return {
      message: 'Password reset successful',
    };
  },
  otpSentToEmail: () => {
    return {
      message: 'OTP sent to your email',
    };
  },
  otpVerified: () => {
    return {
      message: 'OTP verified successfully',
    };
  },
  error: (message) => {
    return {
      error: message,
    };
  },
};
