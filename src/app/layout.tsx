import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/../../components/ui/toaster";
import { AuthProvider } from "@/contexts/auth-context";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://dar-alhekma.dyam.dev'),
  title: "حجاثون",
  description: "تحدي يجمع طلبة الجامعات لاستكشاف وتوظيف الابتكارات الجامعية، توفر جائزة مايـدة محي الديـــن ناظـــر للابتكــــار هاكاثون الابتكار فرصة للعمل ضمن فرق تنافسية على تطوير حلول مبتكرة تسهم في تعزيز الاستدامة وجودة الحيـاة في جامعة دار الحكمة",
  keywords: [
    "جائزة مايدة محي الدين ناظر للابتكار 3",
    "هاكاثون الابتكار",
    "دار الحكمة",
    "جامعة دار الحكمة",
    "تحدي يجمع طلبة الجامعات لاستكشاف وتوظيف الابتكارات الجامعية",
    "الاستدامة",
    "جودة الحياة",
    "الابتكار الجامعي",
    "فرق تنافسية",
    "حلول مبتكرة"
  ],
  authors: [{ name: "جامعة دار الحكمة" }],
  creator: "جامعة دار الحكمة",
  publisher: "جامعة دار الحكمة",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: "حجاثون",
    description: "هاكاثون الابتكار في جامعة دار الحكمة: تحدي يجمع طلبة الجامعات لاستكشاف وتوظيف الابتكارات الجامعية وتطوير حلول مبتكرة تسهم في تعزيز الاستدامة وجودة الحياة",
    url: "https://dar-alhekma.dyam.dev/",
    siteName: "حجاثون",
    images: [
      {
        url: "/main.png",
        width: 1200,
        height: 630,
        alt: "جائزة مايدة محي الدين ناظر للابتكار 3 - هاكاثون الابتكار في جامعة دار الحكمة"
      }
    ],
    locale: "ar_SA",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "حجاثون",
    description: "هاكاثون الابتكار في جامعة دار الحكمة",
    images: ["/main.png"],
    creator: "@DAHUniversity"
  },
  alternates: {
    canonical: "https://dar-alhekma.dyam.dev/",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster />
          <Analytics />
        </AuthProvider>
      </body>
    </html>
  );
}
