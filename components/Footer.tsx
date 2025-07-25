export default function Footer() {
  return (
    <footer className="bg-neutral-950 text-white mt-16 relative z-10">
      <div className="ml-[200px] px-6 py-16 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8 text-sm text-gray-400 z-10 relative">
        <div className="space-y-2">
          <a href="#">Contact us</a>
          <br />
          <a href="#">Keep in touch</a>
          <br />
          <a href="#">Careers</a>
          <br />
          <a href="#">About Voltique</a>
        </div>
        <div className="space-y-2">
          <a href="#">News & media</a>
          <br />
          <a href="#">Community</a>
          <br />
          <a href="#">Events</a>
          <br />
          <a href="#">Specs</a>
        </div>
        <div className="space-y-2">
          <a href="#">Privacy policy</a>
          <br />
          <a href="#">Terms of use</a>
          <br />
          <a href="#">Fleet</a>
          <br />
          <a href="#">FAQ</a>
        </div>
        <div className="space-y-2">
          <a href="#" className="hover:text-white">
            Instagram
          </a>
          <br />
          <a href="#" className="hover:text-white">
            YouTube
          </a>
          <br />
          <a href="#" className="hover:text-white">
            LinkedIn
          </a>
        </div>
      </div>
      <div className="text-center text-xs text-neutral-500 pb-4 pt-2 relative z-10">
        ©2025 Voltique. All rights reserved.
      </div>
      <div className="absolute bottom-0 left-[20px] text-[140px] font-bold text-neutral-900 leading-none z-0 select-none">
        VOLTIQUE
      </div>
    </footer>
  );
}
