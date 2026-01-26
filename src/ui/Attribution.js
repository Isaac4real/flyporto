/**
 * Create and append Google attribution element
 * This is legally required when using Google 3D Tiles
 * @returns {HTMLElement}
 */
export function createAttribution() {
  const attribution = document.createElement('div');
  attribution.id = 'google-attribution';
  attribution.innerHTML = 'Imagery &copy;2025 Google';

  // Styling
  Object.assign(attribution.style, {
    position: 'fixed',
    bottom: '8px',
    right: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    color: '#333',
    padding: '4px 8px',
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    borderRadius: '2px',
    zIndex: '1000',
    pointerEvents: 'none'  // Don't interfere with controls
  });

  document.body.appendChild(attribution);
  return attribution;
}
