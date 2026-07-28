import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YM Campus GO｜陽明智慧校園導覽",
  description: "一掃就懂、一點就到的陽明高中智慧校園導覽。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
