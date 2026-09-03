import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Images,
  Layers3,
  LockKeyhole,
  ScanSearch,
  Scissors,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import heroVisual from "../../../mobile/mobile/assets/images/store/trimswipe-current-ui-banner-copy-v2.png";
import { TRIMSWIPE_APP_STORE_URL, TRIMSWIPE_SITE_URL } from "@/lib/marketing";

const faqItems = [
  {
    question: "Does TrimSwipe upload my photos?",
    answer:
      "No. Photo review, matching, trimming, and cleanup decisions happen on your device. TrimSwipe never uploads your camera roll to its own servers.",
  },
  {
    question: "What happens when I trim a photo?",
    answer:
      "TrimSwipe creates a smaller, cleaner copy by compressing the file and removing unnecessary metadata such as GPS and camera details, while keeping the visible image.",
  },
  {
    question: "Will TrimSwipe delete photos automatically?",
    answer:
      "No. You review the suggestions and confirm every trim or delete action before anything in your library changes.",
  },
  {
    question: "Can I use TrimSwipe on iPad?",
    answer:
      "Yes. TrimSwipe is available for iPhone and iPad and requires iOS or iPadOS 15.1 or later.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MobileApplication",
      name: "TrimSwipe: Photo Cleaner",
      url: TRIMSWIPE_SITE_URL,
      downloadUrl: TRIMSWIPE_APP_STORE_URL,
      operatingSystem: "iOS 15.1 or later; iPadOS 15.1 or later",
      applicationCategory: "UtilitiesApplication",
      description:
        "TrimSwipe helps you clean up your iPhone camera roll, review similar photos, trim large files, and reclaim storage with private on-device processing.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "Swipe to keep, trim, or delete photos",
        "Review similar, large, old, blurry, burst, and screenshot photos",
        "On-device photo processing",
        "Confirm every change before it happens",
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ],
};

export function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="relative isolate overflow-hidden border-b border-border/70">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(circle_at_78%_22%,color-mix(in_oklab,var(--primary)_20%,transparent),transparent_42%),radial-gradient(circle_at_18%_10%,color-mix(in_oklab,var(--warm)_18%,transparent),transparent_34%)]"
          aria-hidden="true"
        />
        <div className="mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.86fr_1.14fr] lg:gap-14 lg:px-10 lg:py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/75 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary shadow-soft backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Photo cleanup that feels lighter
            </div>
            <h1 className="mt-6 text-balance font-display text-[clamp(2.85rem,7vw,5.65rem)] font-extrabold leading-[0.96] tracking-[-0.065em]">
              Clean up your camera roll.
              <span className="mt-2 block text-primary">Keep what matters.</span>
            </h1>
            <p className="mt-6 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
              TrimSwipe is an iPhone photo cleaner that helps you find similar shots, trim oversized
              files, and reclaim storage with quick, confident swipes.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={TRIMSWIPE_APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-foreground px-7 text-base font-semibold text-background shadow-card transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Download free on the App Store
                <ArrowUpRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-foreground transition hover:bg-card/70"
              >
                See how it works <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <ul
              className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"
              aria-label="Key benefits"
            >
              {[
                "Photos stay on-device",
                "Nothing changes until you confirm",
                "Free to download",
              ].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-2xl lg:mx-0">
            <div
              className="absolute -inset-3 -z-10 rounded-[2.5rem] bg-primary/10 blur-2xl"
              aria-hidden="true"
            />
            <div className="aspect-square overflow-hidden rounded-[2rem] border border-white/75 bg-card shadow-[0_32px_90px_-38px_color-mix(in_oklab,var(--foreground)_48%,transparent)] sm:rounded-[2.5rem]">
              <img
                src={heroVisual}
                alt="TrimSwipe on two iPhones, showing similar-photo review and storage progress"
                width={1680}
                height={934}
                fetchPriority="high"
                className="h-full w-full object-cover"
                style={{ objectPosition: "88% center" }}
              />
            </div>
            <div className="absolute -bottom-5 left-5 inline-flex items-center gap-3 rounded-2xl border border-border/80 bg-card/94 px-4 py-3 shadow-card backdrop-blur sm:left-8">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 text-success">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Private by design
                </p>
                <p className="text-sm font-bold">Your photos stay yours.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 border-b border-border/70 bg-card/35">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Three simple moves
            </p>
            <h2 className="mt-3 text-balance font-display text-3xl font-extrabold tracking-[-0.045em] sm:text-5xl">
              From camera-roll chaos to clear decisions.
            </h2>
          </div>

          <ol className="mt-12 grid gap-4 lg:grid-cols-3">
            <StepCard
              number="01"
              icon={<ScanSearch className="h-6 w-6" aria-hidden="true" />}
              title="Find the clutter"
              body="Start with similar photos, large files, screenshots, bursts, blurry shots, or older memories."
            />
            <StepCard
              number="02"
              icon={<Layers3 className="h-6 w-6" aria-hidden="true" />}
              title="Swipe your decision"
              body="Keep the favorites, trim heavy files, and mark the rest for deletion—one quick choice at a time."
            />
            <StepCard
              number="03"
              icon={<Check className="h-6 w-6" aria-hidden="true" />}
              title="Review, then reclaim"
              body="See the storage impact and confirm your choices. Nothing changes before you say so."
            />
          </ol>
        </div>
      </section>

      <section id="features" className="scroll-mt-24">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
          <div className="grid gap-5 lg:grid-cols-2">
            <article className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-primary px-6 py-8 text-primary-foreground shadow-card sm:p-10">
              <div
                className="absolute -right-14 -top-14 h-56 w-56 rounded-full border-[2.5rem] border-white/10"
                aria-hidden="true"
              />
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] opacity-75">
                Privacy where it matters
              </p>
              <h2 className="mt-3 max-w-lg font-display text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
                Your camera roll never becomes our camera roll.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-relaxed opacity-85 sm:text-base">
                Photo analysis and edits happen on your device. There is no TrimSwipe account to
                create, and your pictures are never uploaded to our servers.
              </p>
              <a
                href="/privacy"
                className="mt-8 inline-flex items-center gap-2 text-sm font-bold underline decoration-white/40 underline-offset-4 transition hover:decoration-white"
              >
                Read our privacy promise <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </article>

            <div className="grid gap-5 sm:grid-cols-2">
              <FeatureCard
                icon={<Images className="h-5 w-5" aria-hidden="true" />}
                title="See what takes space"
                body="Quick Scan turns a crowded library into focused cleanup opportunities you can act on."
              />
              <FeatureCard
                icon={<Scissors className="h-5 w-5" aria-hidden="true" />}
                title="Trim, don't just delete"
                body="Shrink oversized photos and remove unnecessary metadata while keeping the visible memory."
              />
              <FeatureCard
                icon={<Trash2 className="h-5 w-5" aria-hidden="true" />}
                title="Stay in control"
                body="Items are only marked during swiping. You make the final call before a photo changes."
              />
              <FeatureCard
                icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
                title="Make cleanup a habit"
                body="Goals, streaks, progress reports, and quick games make small sessions feel rewarding."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border/70 bg-card/45">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Questions, answered
            </p>
            <h2 className="mt-3 text-balance font-display text-3xl font-extrabold tracking-[-0.045em] sm:text-5xl">
              Clean photos. Clear expectations.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              TrimSwipe is built to make every cleanup choice understandable and reversible until
              your final confirmation.
            </p>
          </div>

          <div className="divide-y divide-border/80 border-y border-border/80">
            {faqItems.map((item, index) => (
              <details key={item.question} className="group py-5" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-display text-base font-bold marker:content-none sm:text-lg">
                  {item.question}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-primary transition-transform group-open:rotate-45">
                    <span className="text-xl font-light leading-none">+</span>
                  </span>
                </summary>
                <p className="max-w-2xl pr-12 pt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-foreground px-6 py-12 text-background shadow-card sm:px-12 sm:py-16 lg:flex lg:items-center lg:justify-between lg:gap-12">
          <div
            className="absolute -right-20 -top-28 h-80 w-80 rounded-full bg-primary/35 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Make room for what comes next
            </p>
            <h2 className="mt-3 text-balance font-display text-3xl font-extrabold tracking-[-0.045em] sm:text-5xl">
              Less camera-roll clutter. More memories worth keeping.
            </h2>
          </div>
          <a
            href={TRIMSWIPE_APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="relative mt-8 inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-background px-7 text-base font-bold text-foreground transition hover:-translate-y-0.5 lg:mt-0"
          >
            Get TrimSwipe free <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>
    </>
  );
}

function StepCard({
  number,
  icon,
  title,
  body,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="group rounded-[1.75rem] border border-border bg-background p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-card sm:p-8">
      <div className="flex items-center justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          {icon}
        </span>
        <span className="font-display text-sm font-bold text-muted-foreground/60">{number}</span>
      </div>
      <h3 className="mt-8 font-display text-xl font-extrabold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </li>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-[1.75rem] border border-border bg-card p-6 shadow-soft sm:p-7">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warm/20 text-warm-foreground">
        {icon}
      </span>
      <h3 className="mt-7 font-display text-lg font-extrabold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </article>
  );
}
