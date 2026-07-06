"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const DETAIL_LINKS = [
  { label: "About Us", href: "/pages/about-us" },
  { label: "Rules", href: "/pages/rules" },
  { label: "FAQs", href: "/pages/faqs" },
  { label: "Privacy Policy", href: "/pages/privacy-policy" },
  { label: "Contact Us", href: "/pages/contact-us" },
];

const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://instagram.com/cubelelo" },
  { label: "YouTube", href: "https://youtube.com/@cubelelo" },
  { label: "Discord", href: "https://discord.gg/cubelelo" },
];

export function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <footer data-layout="footer" className="mt-auto border-t border-zinc-200 bg-white py-8 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="font-mono text-sm font-semibold text-accent-primary">🧊 Built for the cubing community</p>
      <div className="mt-4 flex flex-wrap justify-center gap-6">
        {DETAIL_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="transition hover:text-zinc-900 dark:hover:text-zinc-300">
            {link.label}
          </Link>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-4">
        {SOCIAL_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-zinc-400 transition hover:text-accent-primary dark:text-zinc-600"
          >
            {link.label}
          </a>
        ))}
      </div>
      <p className="mt-4">© {new Date().getFullYear()} Cubelelo Events. All rights reserved.</p>
    </footer>
  );
}
