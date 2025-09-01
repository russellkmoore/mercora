/**
 * Page Renderer Component - Content Management System
 * 
 * Renders the content of a CMS page with proper styling, custom CSS/JS,
 * and responsive design. Handles different page templates and layouts.
 */

"use client";

import { useEffect } from "react";
import { PageSelect } from "@/lib/db/schema/pages";
import { Calendar, User } from "lucide-react";

interface PageRendererProps {
  page: PageSelect;
}

export default function PageRenderer({ page }: PageRendererProps) {
  // Inject custom CSS and JS if present
  useEffect(() => {
    // Handle custom CSS
    if (page.custom_css) {
      const styleElement = document.createElement('style');
      styleElement.id = `page-${page.id}-styles`;
      styleElement.textContent = page.custom_css;
      document.head.appendChild(styleElement);

      // Cleanup on unmount
      return () => {
        const existingStyle = document.getElementById(`page-${page.id}-styles`);
        if (existingStyle) {
          existingStyle.remove();
        }
      };
    }
  }, [page.custom_css, page.id]);

  useEffect(() => {
    // Handle custom JavaScript
    if (page.custom_js) {
      try {
        const scriptFunction = new Function(page.custom_js);
        scriptFunction();
      } catch (error) {
        console.error("Error executing custom JavaScript for page:", error);
      }
    }
  }, [page.custom_js]);

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get page template styling
  const getTemplateClasses = (template: string) => {
    switch (template) {
      case 'legal':
        return {
          container: 'max-w-4xl',
          content: 'prose prose-invert prose-orange max-w-none prose-headings:text-white prose-p:text-gray-300 prose-li:text-gray-300 prose-a:text-orange-400 prose-strong:text-white',
          header: 'border-b border-neutral-700 pb-6 mb-8'
        };
      case 'about':
        return {
          container: 'max-w-6xl',
          content: 'prose prose-invert prose-orange max-w-none prose-headings:text-white prose-p:text-gray-300 prose-li:text-gray-300 prose-a:text-orange-400 prose-strong:text-white',
          header: 'text-center pb-8 mb-12 border-b border-neutral-700'
        };
      default:
        return {
          container: 'max-w-4xl',
          content: 'prose prose-invert prose-orange max-w-none prose-headings:text-white prose-p:text-gray-300 prose-li:text-gray-300 prose-a:text-orange-400 prose-strong:text-white',
          header: 'pb-6 mb-8'
        };
    }
  };

  const templateClasses = getTemplateClasses(page.template || 'default');

  return (
    <div className="min-h-screen bg-black">
      {/* Background Pattern */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_30%_80%,rgba(255,165,0,0.1),transparent_50%),radial-gradient(circle_at_80%_20%,rgba(255,165,0,0.05),transparent_50%)]" />
      <div className="fixed inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Navigation Spacer */}
        <div className="h-20" />

        {/* Page Content */}
        <div className="container mx-auto px-4 py-12">
          <div className={`mx-auto ${templateClasses.container}`}>
            {/* Page Header */}
            <div className={templateClasses.header}>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                {page.title}
              </h1>
              
              {page.excerpt && (
                <p className="text-xl text-gray-400 mb-6">
                  {page.excerpt}
                </p>
              )}

              {/* Page Meta Information */}
              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500">
                {page.published_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Published {formatDate(page.published_at.toString())}</span>
                  </div>
                )}
                
                {page.updated_at && page.updated_at !== page.created_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Updated {formatDate(page.updated_at.toString())}</span>
                  </div>
                )}

                {page.version > 1 && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>Version {page.version}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Page Content */}
            <div 
              className={templateClasses.content}
              dangerouslySetInnerHTML={{ __html: page.content }}
            />

            {/* Page Footer */}
            {(page.template || 'default') === 'legal' && (
              <div className="mt-12 pt-8 border-t border-neutral-700">
                <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Need Help?</h3>
                  <p className="text-gray-400 mb-4">
                    If you have any questions about this document or our policies, 
                    please don't hesitate to contact us.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <a 
                      href="mailto:support@voltique.com" 
                      className="text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      Contact Support
                    </a>
                    <a 
                      href="/about" 
                      className="text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      About Us
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Related Pages or CTA Section (for about page) */}
        {(page.template || 'default') === 'about' && (
          <div className="bg-gradient-to-r from-orange-900/20 to-orange-800/20 py-16">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto text-center">
                <h2 className="text-3xl font-bold text-white mb-6">
                  Ready to Explore?
                </h2>
                <p className="text-xl text-gray-300 mb-8">
                  Discover our AI-powered outdoor gear recommendations and start your next adventure.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <a 
                    href="/products"
                    className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Shop Products
                  </a>
                  <a 
                    href="/agent"
                    className="bg-transparent border-2 border-orange-600 text-orange-400 hover:bg-orange-600 hover:text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Chat with Volt AI
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}