import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Lock, Smartphone, Eye, Database, Mail } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — Slim" },
      {
        name: "description",
        content:
          "Slim is built on-device. We don't collect, sell, or upload your photos or personal data. Read the full privacy policy.",
      },
    ],
  }),
});

function PrivacyPage() {
  return (
    <div className="px-5 pt-5 pb-10">
      <Link
        to="/profile"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Profile
      </Link>

      <header className="mt-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 text-success shadow-soft">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Effective: April 29, 2026 · Last updated: April 29, 2026
        </p>
      </header>

      <p className="mt-5 text-sm text-foreground/90 text-balance">
        Slim is designed around a simple promise: your photos and personal data
        stay on your device. We don't run analytics, we don't show ads, and we
        don't upload your library to any server.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Pillar icon={<Smartphone className="h-4 w-4" />} title="On-device" body="Photo processing happens locally on your iPhone." />
        <Pillar icon={<Eye className="h-4 w-4" />} title="No tracking" body="No analytics SDKs, no advertising IDs, no cookies." />
        <Pillar icon={<Database className="h-4 w-4" />} title="No collection" body="We never store your photos, names, or email." />
      </div>

      <Section title="1. What Slim does on your device">
        Slim helps you review your camera roll by swiping to keep, trim, or
        delete photos. Trimming optimizes a copy of an image and strips
        sensitive metadata (such as GPS coordinates and device tags). All of
        this happens locally — the original and trimmed files never leave your
        iPhone.
      </Section>

      <Section title="2. Data we collect">
        <strong>None that personally identifies you.</strong> Slim stores the
        following on-device only, in your phone's local storage:
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-foreground/85">
          <li>Aggregate stats (storage freed, streak, daily counts).</li>
          <li>App preferences (cards per round, reminder time, display name you typed).</li>
          <li>Your in-app purchase status (Slim Pro), validated via Apple.</li>
        </ul>
        <p className="mt-2">
          This data is never transmitted to us. Deleting the app or tapping
          "Delete all Slim data" in Profile wipes it instantly.
        </p>
      </Section>

      <Section title="3. iCloud sync (optional)">
        If you enable "Sync with iCloud" in Profile, your stats and settings
        sync between your devices through Apple's iCloud. Slim does not run a
        server in this flow — Apple handles encryption and storage. We never
        see this data.
      </Section>

      <Section title="4. Photos & permissions">
        Slim asks for Photo Library access so you can review your own photos
        inside the app. You may grant Limited Access (specific photos) or Full
        Access. We only read photos you choose to swipe and only modify photos
        when you explicitly tap Trim or Delete. We never copy or upload them.
      </Section>

      <Section title="5. Third-party services">
        Slim uses Apple's StoreKit for in-app purchases (Slim Pro) and
        UserNotifications for daily reminders. These are operated by Apple
        under Apple's privacy policy. Slim does not embed any third-party
        analytics, ads, attribution, or crash-reporting SDKs.
      </Section>

      <Section title="6. Children">
        Slim does not knowingly collect data from anyone, including children
        under 13. The app is rated for general audiences.
      </Section>

      <Section title="7. Your rights">
        Because we don't collect personal data, there is nothing for us to
        export or delete on your behalf. To erase all on-device data at any
        time, open Profile → "Delete all Slim data", or uninstall the app.
      </Section>

      <Section title="8. Changes to this policy">
        If we ever change how Slim handles data, we'll update this page and
        bump the "Last updated" date. Material changes will be highlighted in
        the app on first launch.
      </Section>

      <Section title="9. Contact">
        Questions about privacy? Reach out at{" "}
        <a
          href="mailto:eaconsulting.supp@gmail.com"
          className="font-medium text-primary underline underline-offset-2"
        >
          eaconsulting.supp@gmail.com
        </a>
        .
      </Section>

      <a
        href="mailto:eaconsulting.supp@gmail.com"
        className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-semibold transition hover:border-primary/40"
      >
        <Mail className="h-4 w-4" /> eaconsulting.supp@gmail.com
      </a>

      <p className="mt-6 text-center text-[10px] text-muted-foreground">
        Slim · Made privately for cluttered camera rolls
      </p>
    </div>
  );
}

function Pillar({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      <div className="mt-1.5 text-sm leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}
