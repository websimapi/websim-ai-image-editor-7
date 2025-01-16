let activeTimeout;

export function showNotification(message, type = 'info') {
  // Clear any existing notifications
  const existingNotification = document.querySelector('.notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Clear any existing timeout
  if (activeTimeout) {
    clearTimeout(activeTimeout);
  }

  // Create new notification
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Force reflow to enable transition
  notification.offsetHeight;
  
  // Show notification
  notification.classList.add('show');
  
  // Hide after 3 seconds
  activeTimeout = setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}