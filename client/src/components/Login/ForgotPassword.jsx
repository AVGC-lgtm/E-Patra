import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ForgotPassword = () => {
  // Form steps: 1 = Email, 2 = OTP, 3 = New Password
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [isResending, setIsResending] = useState(false);
  const otpInputs = useRef([]);

  const navigate = useNavigate();

  // Handle OTP input change
  const handleOtpChange = (index, value) => {
    // Only allow single digit numbers or empty string
    if (value !== '' && !/^\d$/.test(value)) return;
    
    // Update the OTP array with the new value
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    // Clear error when user is typing - but use a callback to ensure it's based on latest state
    setError('');
    
    // Move to next input if a digit was entered
    if (value !== '' && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
    
    // Auto-submit when all digits are entered (but not if currently loading)
    const otpString = newOtp.join('');
    if (otpString.length === 6 && /^\d{6}$/.test(otpString) && !isLoading) {
      // Use the newOtp directly for auto-submit to avoid state timing issues
      setTimeout(() => {
        const currentOtpString = newOtp.join('');
        if (currentOtpString.length === 6 && /^\d{6}$/.test(currentOtpString)) {
          handleOtpSubmitWithCode(currentOtpString);
        }
      }, 150);
    }
  };

  // Helper function to submit with a specific OTP code
  const handleOtpSubmitWithCode = async (otpCode = null) => {
    const finalOtpCode = otpCode || otp.join('').trim();
    
    // Debug log
    console.log('OTP Submission:', { 
      finalOtpCode, 
      length: finalOtpCode.length,
      isValid: /^\d{6}$/.test(finalOtpCode)
    });
    
    // Check if we have exactly 6 digits
    if (finalOtpCode.length !== 6 || !/^\d{6}$/.test(finalOtpCode)) {
      const errorMessage = 'Please enter all 6 digits of the OTP';
      setError(errorMessage);
      toast.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }

    // Clear any existing errors before proceeding
    setError('');
    setIsLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const emailToSend = email.trim().toLowerCase();

      const requestBody = { 
        email: emailToSend,
        otp: finalOtpCode
      };

      console.log('Sending OTP verification request:', {
        url: `${apiUrl}/api/auth/verify-otp`,
        method: 'POST',
        body: requestBody,
        apiUrl: apiUrl
      });

      const response = await fetch(`${apiUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const responseText = await response.text();
      console.log('Raw response text:', responseText);

      let data = {};

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        console.error('Response text was:', responseText);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        let errorMessage;
        
        // Handle specific error cases
        if (response.status === 400) {
          // 400 Bad Request typically means wrong OTP
          errorMessage = data.message || 'Wrong OTP. Please enter valid OTP';
        } else if (response.status === 404) {
          errorMessage = 'OTP not found or expired. Please request a new OTP';
        } else if (response.status === 429) {
          errorMessage = 'Too many attempts. Please try again later';
        } else {
          errorMessage = data.message || `Server error: ${response.status} ${response.statusText}`;
        }
        
        console.error('OTP verification failed:', errorMessage);
        throw new Error(errorMessage);
      }

      console.log('OTP verification successful:', data);

      // If OTP verification is successful, proceed to the next step
      setStep(3); // Move to password reset step
      toast.success('OTP verified successfully!', {
        position: 'top-right',
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

    } catch (error) {
      console.error('Error verifying OTP:', error);

      // Handle network error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setError('Network error - please check if the server is running');
        toast.error('Network error - please check your connection', {
          position: 'top-right',
          autoClose: 5000,
        });
      } else {
        // For wrong OTP or other API errors, show the specific message
        let errorMessage = error.message;
        
        // If no specific message, provide a default for wrong OTP
        if (!errorMessage || errorMessage.includes('Server error')) {
          errorMessage = 'Wrong OTP. Please enter valid OTP';
        }
        
        setError(errorMessage);
        toast.error(errorMessage, {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle paste OTP
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text/plain').trim();
    if (/^\d{6}$/.test(paste)) {
      const pasteOtp = paste.split('');
      setOtp(pasteOtp);
      // Clear any existing error
      setError('');
      // Focus on the last input and auto-submit after a short delay
      otpInputs.current[5]?.focus();
      setTimeout(() => {
        handleOtpSubmitWithCode(paste);
      }, 100);
    }
  };

  // Handle backspace in OTP fields
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      // Clear error when user is editing
      if (error) {
        setError('');
      }
      
      if (!otp[index] && index > 0) {
        otpInputs.current[index - 1]?.focus();
      }
    }
  };

  // Handle email submission
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const response = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('OTP has been sent to your email', {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        setStep(2); // Move to OTP step
        startResendTimer();
      } else {
        // Handle specific error cases for email submission
        let errorMessage;
        
        if (response.status === 404) {
          // User not found/registered
          errorMessage = data.message || 'This account does not exist.';
        } else if (response.status === 400) {
          // Bad request - invalid email format or other validation error
          errorMessage = data.message || 'Invalid email address. Please check and try again.';
        } else if (response.status === 429) {
          // Too many requests
          errorMessage = data.message || 'Too many requests. Please try again later.';
        } else if (response.status >= 500) {
          // Server error
          errorMessage = 'Server is currently unavailable. Please try again later.';
        } else {
          // Generic fallback
          errorMessage = data.message || 'Failed to send OTP. Please try again.';
        }
        
        setError(errorMessage);
        toast.error(errorMessage, {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      
      // Handle network errors and other exceptions
      let errorMessage;
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else {
        errorMessage = 'An unexpected error occurred. Please try again.';
      }
      
      setError(errorMessage);
      toast.error(errorMessage, {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    return handleOtpSubmitWithCode();
  };

  // Handle password reset
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
        setError('Please fill in all fields');
        return;
      }
      
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      
      if (newPassword.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
      }
      
      setIsLoading(true);
      setError('');
      
      try {
        const otpCode = otp.join('');
        const apiUrl = import.meta.env.VITE_API_URL ;
        const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            email,
            otp: otpCode,
            newPassword,
            confirmPassword
          }),
        });

        const data = await response.json();

        if (response.ok) {
          toast.success('Password has been reset successfully', {
            position: 'top-right',
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
          setStep(4); // Success step
        } else {
          setError(data.message || 'Failed to reset password');
          toast.error(data.message || 'Failed to reset password', {
            position: 'top-right',
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        }
      } catch (error) {
        console.error('Error resetting password:', error);
        setError('An error occurred. Please try again.');
        toast.error('An error occurred. Please try again.', {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } finally {
        setIsLoading(false);
      }
    };

    // Resend OTP functionality
    const handleResendOtp = async () => {
      if (isResending || resendTimer > 0) return;
      
      setIsResending(true);
      
      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        const response = await fetch(`${apiUrl}/api/auth/forgot-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (response.ok) {
          toast.success('New OTP has been sent to your email', {
            position: 'top-right',
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
          setResendTimer(30);
          startResendTimer();
        } else {
          toast.error(data.message || 'Failed to resend OTP', {
            position: 'top-right',
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        }
      } catch (error) {
        console.error('Error resending OTP:', error);
        toast.error('An error occurred. Please try again.', {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } finally {
        setIsResending(false);
      }
    };

    // Start resend timer
    const startResendTimer = () => {
      const timer = setInterval(() => {
        setResendTimer(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    };

    const handleBackToLogin = () => {
      navigate('/login');
    };
    
    // Auto-focus first OTP input when step changes to 2
    useEffect(() => {
      if (step === 2) {
        otpInputs.current[0]?.focus();
      }
    }, [step]);

    const renderStepContent = () => {
      switch (step) {
        case 1: // Email Step
          return (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </>
                  ) : 'Send OTP'}
                </button>
              </div>
            </form>
          );

        case 2: // OTP Step
          return (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-gray-600 mb-2">We've sent a 6-digit code to</p>
                <p className="font-medium">{email}</p>
                <button 
                  type="button" 
                  onClick={() => setStep(1)}
                  className="text-blue-600 text-sm mt-2 hover:underline"
                >
                  Change email
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between space-x-2">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <input
                      key={index}
                      ref={(el) => (otpInputs.current[index] = el)}
                      type="text"
                      maxLength={1}
                      value={otp[index]}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={index === 0 ? handleOtpPaste : undefined}
                      className="w-12 h-12 text-center text-xl border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">
                    {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Didn\'t receive the code?'}
                  </span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendTimer > 0 || isResending}
                    className={`text-blue-600 font-medium ${(resendTimer > 0 || isResending) ? 'opacity-50 cursor-not-allowed' : 'hover:underline'}`}
                  >
                    {isResending ? 'Sending...' : 'Resend OTP'}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOtpSubmit}
                disabled={(() => {
                  const otpString = otp.join('');
                  return otpString.length !== 6 || !/^\d{6}$/.test(otpString) || isLoading;
                })()}
                className={`w-full py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${(() => {
                  const otpString = otp.join('');
                  return (otpString.length !== 6 || !/^\d{6}$/.test(otpString) || isLoading) ? 'opacity-70 cursor-not-allowed' : '';
                })()}`}
              >
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </div>
          );

        case 3: // New Password Step
          return (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Must be at least 8 characters long
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Confirm new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading || !newPassword || !confirmPassword}
                  className={`w-full py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${(isLoading || !newPassword || !confirmPassword) ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          );

        case 4: // Success Step
          return (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Password Reset Successful!</h3>
              <p className="text-gray-600 mb-6">Your password has been updated successfully.</p>
              <button
                onClick={handleBackToLogin}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Back to Login
              </button>
            </div>
          );

        default:
          return null;
      }
    };

    const getStepTitle = () => {
      switch (step) {
        case 1: return 'Forgot Password';
        case 2: return 'Verify OTP';
        case 3: return 'Reset Password';
        case 4: return 'Password Reset';
        default: return 'Forgot Password';
      }
    };

    const getStepDescription = () => {
      switch (step) {
        case 1: return 'Enter your email address and we\'ll send you a verification code.';
        case 2: return 'Enter the 6-digit code sent to your email.';
        case 3: return 'Create a new password for your account.';
        case 4: return 'Your password has been successfully reset!';
        default: return '';
      }
    };

    return (
      <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header - Enhanced design */}
        <header className="w-full bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white shadow-2xl relative overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}></div>
          </div>
          
          <div className="relative z-10 px-4 py-4 md:px-8 md:py-6">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Enhanced logo container */}
                <div className="bg-white rounded-xl p-2 shadow-lg transform hover:scale-105 transition-transform duration-200">
                  <img 
                    src="/web icon (1).png" 
                    alt="ई-पत्र Logo" 
                    className="w-12 h-12 md:w-14 md:h-14 object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white tracking-wide">ई-पत्र</h1>
                </div>
              </div>
              <div className="text-right">
                <p className="text-blue-100 text-sm md:text-base font-semibold">Maharashtra Police</p>
                <p className="text-blue-200 text-xs md:text-sm">Application Department</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          <div className="w-full max-w-md transform hover:scale-[1.01] transition-transform duration-300">
            <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-10 border border-blue-100 backdrop-blur-sm bg-opacity-95">
              {step !== 4 && (
                <button 
                  onClick={step === 1 ? handleBackToLogin : () => setStep(step - 1)}
                  className="flex items-center text-gray-600 hover:text-gray-800 mb-6 transition-colors duration-200"
                >
                  <ArrowLeft className="h-5 w-5 mr-1" />
                  Back
                </button>
              )}
              
              <div className="text-center mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-900">{getStepTitle()}</h2>
                <p className="text-gray-600 mt-2">
                  {getStepDescription()}
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center">
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              {renderStepContent()}
            </div>
          </div>
        </main>

        {/* Footer - Enhanced design */}
        <footer className="w-full bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white shadow-2xl">
          <div className="px-4 py-6 md:px-8 md:py-8">
            <div className="max-w-7xl mx-auto text-center">
              <p className="text-base md:text-lg text-blue-100 font-medium">© 2025 E-Patra. All rights reserved.</p>
              <p className="text-sm md:text-base text-blue-200 mt-2">Maharashtra Police Application Department</p>
            </div>
          </div>
        </footer>
      </div>
    );
  };

export default ForgotPassword;