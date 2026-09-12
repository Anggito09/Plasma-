import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kasir & Antrean Kafe",
  description: "Kasir, dapur, TV antrean, dan keuangan untuk kafe & UMKM.",
  icons: {
    icon: "/logo-perusahaan.png",
    shortcut: "/logo-perusahaan.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
