import Link from "next/link";
import { getNavigationPages } from "@/lib/models/pages";
import { getSocialMediaSettings } from "@/lib/utils/settings";

export default async function Footer() {
  const [navigationPages, socialMedia] = await Promise.all([
    getNavigationPages(),
    getSocialMediaSettings()
  ]);

  return (
    <footer className="bg-neutral-950 text-white mt-16 relative z-10">
      <div className="ml-0 sm:ml-[100px] lg:ml-[200px] px-4 sm:px-6 py-12 sm:py-16 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8 text-sm text-gray-400 z-10 relative">
        <div className="space-y-2">
          {/* Navigation Pages from CMS */}
          {navigationPages.map((page) => (
            <Link
              key={page.id}
              href={`/${page.slug}`}
              className="block hover:text-white"
            >
              {page.nav_title || page.title}
            </Link>
          ))}
        </div>
        <div className="space-y-2">
          <a href="#" className="block hover:text-white">Contact us</a>
          <a href="#" className="block hover:text-white">Keep in touch</a>
          <a href="#" className="block hover:text-white">Careers</a>
        </div>
        <div className="space-y-2">
          <a href="#" className="block hover:text-white">News & media</a>
          <a href="#" className="block hover:text-white">Community</a>
          <a href="#" className="block hover:text-white">Events</a>
          <a href="#" className="block hover:text-white">Specs</a>
        </div>
        <div className="space-y-2">
          {/* Social Media Links from Settings */}
          {socialMedia.instagram && (
            <a 
              href={socialMedia.instagram} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:text-white"
            >
              Instagram
            </a>
          )}
          {socialMedia.youtube && (
            <a 
              href={socialMedia.youtube} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:text-white"
            >
              YouTube
            </a>
          )}
          {socialMedia.linkedin && (
            <a 
              href={socialMedia.linkedin} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:text-white"
            >
              LinkedIn
            </a>
          )}
          {socialMedia.twitter && (
            <a 
              href={socialMedia.twitter} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:text-white"
            >
              Twitter
            </a>
          )}
          {socialMedia.facebook && (
            <a 
              href={socialMedia.facebook} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:text-white"
            >
              Facebook
            </a>
          )}
          {socialMedia.tiktok && (
            <a 
              href={socialMedia.tiktok} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:text-white"
            >
              TikTok
            </a>
          )}
        </div>
      </div>
      <div className="text-center text-xs text-neutral-500 pb-4 pt-2 relative z-10">
        ©2025 Voltique. All rights reserved.
      </div>
      <div className="absolute bottom-0 left-[10px] sm:left-[20px] text-[60px] sm:text-[100px] lg:text-[140px] font-bold text-neutral-900 leading-none z-0 select-none">
        VOLTIQUE
      </div>
    </footer>
  );
}
