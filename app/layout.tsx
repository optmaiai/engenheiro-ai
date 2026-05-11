import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Engenheiro.AI",
  description: "Sistema de agentes IA para engenheiros PJ brasileiros"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
