import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'LegionCyber Shield - Web Application Security Scanner',
    template: '%s | LegionCyber Shield',
  },
  description: 'Enterprise-grade web application security scanning powered by Nuclei. Identify vulnerabilities, ensure compliance, protect your business.',
  keywords: ['security scanner', 'web application security', 'OWASP', 'vulnerability scanning', 'nuclei', 'penetration testing'],
  authors: [{ name: 'LegionCyber', url: 'https://legioncyber.com' }],
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-[#0A0E1A] text-slate-100 min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
