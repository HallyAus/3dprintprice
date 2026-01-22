import React from 'react';
import { createRoot } from 'react-dom/client';
import { Widget } from './Widget';
import './styles.css';

// Find all widget containers and render the widget
function initWidget() {
  const containers = document.querySelectorAll('[id="printforge-quote-widget"]');

  containers.forEach((container) => {
    const shopId = container.getAttribute('data-shop-id');
    const apiUrl = container.getAttribute('data-api-url') || 'http://localhost:3001';

    if (!shopId) {
      console.error('PrintForge Widget: data-shop-id attribute is required');
      return;
    }

    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <Widget shopId={shopId} apiUrl={apiUrl} />
      </React.StrictMode>
    );
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWidget);
} else {
  initWidget();
}

// Export for manual initialization
(window as unknown as { PrintForgeWidget: { init: () => void } }).PrintForgeWidget = {
  init: initWidget,
};
