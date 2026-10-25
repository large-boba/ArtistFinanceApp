// The root layout wraps EVERY page. Next.js puts each page's content where
// {children} is, and the layout stays in place while you move between pages.
// That is why the bottom navigation lives here: it is written once and shows
// on every screen.
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Home uses the default. Other pages set a short title (e.g. "Reports") and
  // the template adds the app name, with a middle dot (U+00B7), after it.
  title: {
    default: "BentoBudget",
    template: "%s · BentoBudget",
  },
  description: "Track expenses, income, events and profit for your art business.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the page draw under the phone's rounded corners / home bar; the
  // nav and <main> add padding using env(safe-area-inset-bottom) to stay clear.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* The one <main> per page. The bottom padding is the nav height (4rem
            plus its 4px top border) plus the phone's safe area, so the last
            line of content is never hidden behind the fixed nav. */}
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
