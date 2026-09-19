import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { BookProvider } from "@/components/BookProvider";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PwaUpdatePrompt } from "@/components/PwaUpdatePrompt";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "記帳本",
  description: "Offline-first personal ledger with TWD / MYR books",
  applicationName: "記帳本",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "記帳",
  },
  icons: {
    // app/favicon.ico is picked up by convention and stays first in the list.
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/icons/favicon-32.png"],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f7a5f",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${display.variable} ${body.variable} h-full`}
      style={{ colorScheme: "light" }}
    >
      <body className="min-h-full antialiased">
        <AuthProvider>
          <BookProvider>
            <ToastProvider>
              <ConfirmProvider>
                <ErrorBoundary>{children}</ErrorBoundary>
                {/* PWA banners stack clear of the bottom nav and the quick-add FAB. */}
                <div
                  className="pointer-events-none fixed inset-x-0 z-50 mx-auto flex w-full max-w-lg flex-col gap-2 px-4"
                  style={{
                    bottom:
                      "calc(var(--bottom-nav-height, 3.25rem) + env(safe-area-inset-bottom, 0px) + 4.5rem)",
                  }}
                >
                  <PwaUpdatePrompt />
                  <InstallPrompt />
                </div>
              </ConfirmProvider>
            </ToastProvider>
          </BookProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
