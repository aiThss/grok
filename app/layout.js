import "./globals.css";

// This personal workspace is served behind a CDN and is redeployed often.
// Always render the app shell at request time so a browser never combines an
// older prerendered shell with JavaScript from a newer Next.js build.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Grok Pocket · Private AI",
  description: "Private Grok-style chat with image generation and GitHub workspace tools.",
  applicationName: "Grok Pocket",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Grok Pocket" },
};

export const viewport = { themeColor: "#0b0d12", colorScheme: "dark" };

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
