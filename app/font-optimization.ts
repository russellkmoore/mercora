/**
 * Font Optimization Utilities
 * 
 * Reduces preload warnings by implementing progressive font loading
 * and better resource timing management.
 */

// Font loading optimization for client-side
export const optimizeFontLoading = () => {
  if (typeof window !== 'undefined') {
    // Use font loading API to better control when fonts are loaded
    if ('fonts' in document) {
      // Load fonts after initial render to reduce preload warnings
      window.addEventListener('load', () => {
        // Small delay to ensure critical rendering is complete
        setTimeout(() => {
          const fontPromises = [
            document.fonts.load('400 1em Geist'),
            document.fonts.load('500 1em Geist'),
            document.fonts.load('600 1em Geist'),
          ];
          
          Promise.all(fontPromises).then(() => {
            document.documentElement.classList.add('fonts-loaded');
          });
        }, 100);
      });
    }
  }
};

// Resource hint optimization
export const optimizeResourceHints = () => {
  if (typeof window !== 'undefined') {
    // Remove unused preloaded resources after page load
    window.addEventListener('load', () => {
      // Clean up unused preload links after a delay
      setTimeout(() => {
        const preloadLinks = document.querySelectorAll('link[rel="preload"]');
        preloadLinks.forEach(link => {
          const href = (link as HTMLLinkElement).href;
          // Check if resource is actually being used
          if (href.includes('.woff2') || href.includes('.css')) {
            // Keep critical fonts/css, remove unused ones
            const isUsed = document.querySelector(`[href="${href}"]`) !== null;
            if (!isUsed) {
              link.remove();
            }
          }
        });
      }, 3000); // Wait 3 seconds as per browser warning
    });
  }
};
