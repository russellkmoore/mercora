/**
 * === Promotional Banner Component ===
 *
 * Server-side component that displays configurable promotional banners
 * based on admin settings. Shows above the main header when enabled.
 *
 * === Features ===
 * - **Server-Side Rendering**: Fetches banner settings on the server
 * - **Conditional Display**: Only shows when banner is enabled in admin
 * - **Multiple Styles**: Support for info, success, warning, and error styles
 * - **Customizable Content**: Admin-configurable banner text and styling
 * - **Performance Optimized**: Cached settings lookup with minimal overhead
 *
 * === Banner Types ===
 * - **Info**: Blue theme for general announcements
 * - **Success**: Green theme for positive messaging
 * - **Warning**: Yellow theme for important notices
 * - **Error**: Red theme for urgent alerts
 *
 * === Admin Integration ===
 * Banner content and styling controlled via admin settings:
 * - `promotions.banner_enabled`: Show/hide banner
 * - `promotions.banner_text`: Banner message text
 * - `promotions.banner_type`: Visual style (info/success/warning/error)
 *
 * === Technical Implementation ===
 * - Server component for optimal performance
 * - Settings cached for fast loading
 * - Responsive design with proper spacing
 * - Semantic HTML for accessibility
 *
 * @returns JSX element with promotional banner or null if disabled
 */

import { getSettings } from "@/lib/utils/settings";
import { AlertCircle, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { unstable_cache } from "next/cache";

// Cache banner settings for performance
const getCachedBannerSettings = unstable_cache(
  async () => getSettings('promotions'),
  ['banner-settings'],
  { revalidate: 300 } // Cache for 5 minutes - shorter than categories since promotions change more frequently
);

/**
 * Server-side Promotional Banner component
 * 
 * @returns Promise<JSX.Element | null> Banner component or null if disabled
 */
export default async function PromotionalBanner() {
  try {
    // Fetch banner settings from database
    const promotionSettings = await getCachedBannerSettings();
    
    const bannerEnabled = promotionSettings['promotions.banner_enabled'] || false;
    
    // Return null if banner is disabled
    if (!bannerEnabled) {
      return null;
    }
    
    const bannerText = promotionSettings['promotions.banner_text'] || '🎉 Free shipping on orders over $75!';
    const bannerType = promotionSettings['promotions.banner_type'] || 'info';
    
    // Define styling for different banner types
    const bannerStyles = {
      info: {
        bg: 'bg-blue-600',
        text: 'text-white',
        icon: AlertCircle,
      },
      success: {
        bg: 'bg-green-600',
        text: 'text-white',
        icon: CheckCircle,
      },
      warning: {
        bg: 'bg-yellow-600',
        text: 'text-black',
        icon: AlertTriangle,
      },
      error: {
        bg: 'bg-red-600',
        text: 'text-white',
        icon: XCircle,
      },
    };
    
    const currentStyle = bannerStyles[bannerType as keyof typeof bannerStyles] || bannerStyles.info;
    const IconComponent = currentStyle.icon;
    
    return (
      <div className={`${currentStyle.bg} ${currentStyle.text} py-3 px-4 text-center relative`}>
        <div className="flex items-center justify-center space-x-2 max-w-4xl mx-auto">
          <IconComponent className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            {bannerText}
          </p>
        </div>
      </div>
    );
    
  } catch (error) {
    // If settings fetch fails, don't show banner to avoid breaking the site
    console.error('Error loading banner settings:', error);
    return null;
  }
}