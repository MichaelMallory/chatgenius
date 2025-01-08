import type { Metadata } from "next";
import { GeistSans } from 'geist/font/sans'
import "./globals.css";
import SupabaseProvider from '@/components/providers/supabase-provider'
import { ThemeProvider } from "@/components/providers/theme-provider"
import { Header } from "@/components/layout/header"
import { cn } from "@/lib/utils";
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: "ChatGenius",
  description: "Smarter workplace communication with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        GeistSans.className
      )}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SupabaseProvider>
            <Header />
            {children}
            <Toaster />
          </SupabaseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
