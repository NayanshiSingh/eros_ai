"use client";

import "./globals.css";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { ChatProvider } from "@/lib/chat-store";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Diary", href: "/diary" },
  { label: "Chat", href: "/chat" },
  { label: "Settings", href: "/settings" },
];

const AUTH_PAGES = ["/login", "/register"];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = AUTH_PAGES.includes(pathname);

  useEffect(() => {
    const token = getToken();
    if (!token && !isAuthPage) {
      router.push("/login");
    }
  }, [pathname, isAuthPage, router]);

  return (
    <html lang="en">
      <head>
        <title>Eros AI — Your Companion</title>
        <meta name="description" content="Personal AI companion with deep memory and voice" />
      </head>
      <body>
        <ChatProvider>
          <div className="app-layout">
            {!isAuthPage && (
              <nav className="navbar">
                <Link href="/dashboard" className="navbar-brand" aria-label="Eros">
                  <span className="navbar-brand-mark">◈</span>
                  <span className="navbar-brand-text">eros</span>
                </Link>
                <div className="navbar-links">
                  {NAV_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`navbar-link ${pathname === item.href ? "active" : ""}`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </nav>
            )}
            <div className="app-content">{children}</div>
          </div>
        </ChatProvider>
      </body>
    </html>
  );
}
