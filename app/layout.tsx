import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MimiToys Image Studio",
  description: "Tạo ảnh sản phẩm MimiToys từ URL với Gemini",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
