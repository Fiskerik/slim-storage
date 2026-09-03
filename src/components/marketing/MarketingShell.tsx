import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Mail } from "lucide-react";
import appIcon from "../../../mobile/mobile/assets/images/icon.png";
import { TRIMSWIPE_APP_STORE_URL, TRIMSWIPE_SUPPORT_EMAIL } from "@/lib/marketing";

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[60] rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background focus:not-sr-only"
      >
        Skip to content
      </a>
      <MarketingHeader />
      <main id="main-content">{children}</main>
      <MarketingFooter />
    </div>
  );
}

function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/88 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:h-[4.5rem] sm:px-8 lg:px-10">
        <Link to="/" className="group inline-flex items-center gap-2.5" aria-label="TrimSwipe home">
          <img
            src={appIcon}
            alt=""
            width={42}
            height={42}
            className="h-10 w-10 rounded-[0.9rem] shadow-soft transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"
          />
          <span className="font-display text-lg font-extrabold tracking-[-0.035em] sm:text-xl">
            Trim<span className="text-primary">Swipe</span>
          </span>
        </Link>

        <nav
          className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex"
          aria-label="Website"
        >
          <a href="/#how-it-works" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="/#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <Link to="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
        </nav>

        <a
          href={TRIMSWIPE_APP_STORE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-semibold text-background shadow-soft transition hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5"
        >
          <span className="hidden sm:inline">Get TrimSwipe</span>
          <span className="sm:hidden">App Store</span>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="border-t border-border/80 bg-card/45">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto] md:items-end lg:px-10">
        <div>
          <div className="inline-flex items-center gap-2.5">
            <img src={appIcon} alt="" width={36} height={36} className="h-9 w-9 rounded-xl" />
            <p className="font-display text-base font-bold tracking-tight">TrimSwipe</p>
          </div>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            A private iPhone photo cleaner for lighter camera rolls and more room for what comes
            next.
          </p>
        </div>

        <div className="md:text-right">
          <nav
            className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-medium text-muted-foreground md:justify-end"
            aria-label="Legal"
          >
            <Link to="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link to="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <a
              href={`mailto:${TRIMSWIPE_SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Support
            </a>
          </nav>
          <p className="mt-4 text-xs text-muted-foreground">
            © 2026 EA Consulting. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
