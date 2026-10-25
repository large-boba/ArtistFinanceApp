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
  // nav adds padding using env(safe-area-inset-bottom) to stay clear.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col">
        {/* The one <main> per page. It grows to fill the screen, which pushes
            the nav to the bottom on short pages. The nav comes after <main>
            and is sticky, so it takes its own real height in the page: the
            last line of content is never hidden behind it, whatever the text
            size. (The nav is 4rem tall plus a 1px top border; its 4px
            highlight bar is inside that 4rem. Big text can make it taller.) */}
        <main className="mx-auto w-full max-w-2xl flex-1 pt-6 pr-[max(1rem,env(safe-area-inset-right))] pb-6 pl-[max(1rem,env(safe-area-inset-left))]">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
