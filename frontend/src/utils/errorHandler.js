/**
 * Handles Firebase permission errors with user-friendly messages
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message
 */
export const handleFirebaseError = (error) => {
  // Standard Firebase auth error codes
  if (error.code) {
    switch (error.code) {
      case 'permission-denied':
        return 'You do not have permission to perform this action. Try logging in again.';
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      case 'auth/wrong-password':
        return 'Invalid password. Please try again.';
      case 'auth/email-already-in-use':
        return 'This email is already in use by another account.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use a stronger password.';
      case 'auth/invalid-email':
        return 'Invalid email address format.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/requires-recent-login':
        return 'Please log out and log back in to perform this action.';
      case 'storage/unauthorized':
        return 'You do not have permission to access this file.';
      case 'storage/quota-exceeded':
        return 'Storage quota exceeded.';
      default:
        return error.message || 'An unexpected error occurred.';
    }
  }
  // Check for Firestore/RTDB permissions
  if (error.message) {
    if (error.message.includes('Missing or insufficient permissions')) {
      return 'You do not have permission to perform this action. Please log in again.';
    }
    if (error.message.includes('PERMISSION_DENIED')) {
      return 'Database permission denied. Make sure you are logged in.';
    }
    if (error.message.includes('network error')) {
      return 'Network error. Please check your internet connection.';
    }
  }
  return 'An unexpected error occurred. Please try again.';
};
/**
 * Displays a notification to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of notification (success, error, warning, info)
 * @param {number} duration - The duration in milliseconds
 */
export const showNotification = (message, type = 'info', duration = 5000) => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') return;
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  // Style the notification
  notification.style.position = 'fixed';
  notification.style.bottom = '20px';
  notification.style.right = '20px';
  notification.style.padding = '15px 20px';
  notification.style.borderRadius = '4px';
  notification.style.maxWidth = '300px';
  notification.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
  notification.style.zIndex = '9999';
  notification.style.opacity = '0';
  notification.style.transition = 'opacity 0.3s ease-in-out';
  // Set color based on type
  switch (type) {
    case 'success':
      notification.style.backgroundColor = '#4CAF50';
      notification.style.color = 'white';
      break;
    case 'error':
      notification.style.backgroundColor = '#F44336';
      notification.style.color = 'white';
      break;
    case 'warning':
      notification.style.backgroundColor = '#FF9800';
      notification.style.color = 'white';
      break;
    default:
      notification.style.backgroundColor = '#2196F3';
      notification.style.color = 'white';
  }
  // Add to document
  document.body.appendChild(notification);
  // Trigger animation
  setTimeout(() => {
    notification.style.opacity = '1';
  }, 10);
  // Remove notification after duration
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, duration);
}; 