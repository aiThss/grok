import "./globals.css";

export const metadata = {
  title: "Grok Pocket",
  description: "A private mobile Grok workspace with direct GitHub tools.",
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
