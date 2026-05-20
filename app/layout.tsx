import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "智慧评教与反馈平台",
  description: "Teaching evaluation and feedback platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
