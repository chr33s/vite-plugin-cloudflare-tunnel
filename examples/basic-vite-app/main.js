import './style.css';

document.querySelector('#app');

// Simple status checker
function updateStatus() {
  const statusEl = document.getElementById('status');
  const tunnelUrlEl = document.getElementById('tunnel-url');
  
  // Check if we can detect we're running through Cloudflare
  const isCloudflare = document.location.hostname !== 'localhost' && 
                      document.location.hostname !== '127.0.0.1';
  
  if (isCloudflare) {
    statusEl.textContent = '🟢 Connected via Cloudflare Tunnel';
    tunnelUrlEl.textContent = document.location.origin;
    statusEl.style.color = 'green';
  } else {
    statusEl.textContent = '🟡 Running locally (tunnel may be starting...)';
    statusEl.style.color = 'orange';
  }
}

// Add refresh functionality
document.getElementById('refresh').addEventListener('click', () => {
  updateStatus();
  console.log('Status refreshed at:', new Date().toLocaleTimeString());
});

// Update status on page load
updateStatus();

// Log some helpful info
console.log('🌐 Cloudflare Tunnel Plugin Example');
console.log('Current URL:', window.location.href);
console.log('User Agent:', navigator.userAgent);

// Add some interactivity
let clickCount = 0;
document.addEventListener('click', () => {
  clickCount++;
  if (clickCount === 10) {
    alert('🎉 You clicked 10 times! The tunnel is working great!');
    clickCount = 0;
  }
});