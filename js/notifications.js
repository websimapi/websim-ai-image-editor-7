let activeTimeout;

export function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.setAttribute('role', 'alert');
  
  // Remove existing notification if present
  document.querySelector('.notification')?.remove();
  clearTimeout(activeTimeout);
  
  document.body.appendChild(notification);
  requestAnimationFrame(() => notification.classList.add('show'));
  
  activeTimeout = setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}