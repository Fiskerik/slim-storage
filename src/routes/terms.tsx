import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, Mail } from "lucide-react";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — Slim" },
      {
        name: "description",
        content:
          "Terms of Service for the Slim app. Read about usage rules, limitations, and your rights.",
      },
    ],
  }),
});

function TermsPage() {
  return (
    <div className="px-5 pt-5 pb-10">
      <Link
        to="/profile"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Profile
      </Link>

      <header className="mt-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-soft">
          <FileText className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Effective: May 4, 2026 · Last updated: May 4, 2026
        </p>
      </header>

      <p className="mt-5 text-sm text-foreground/90 text-balance">
        By downloading or using Slim ("the App"), you agree to these Terms of
        Service. If you do not agree, please do not use the App.
      </p>

      <Section title="1. Use of the App">
        Slim is a photo-management tool that helps you review and organize your
        camera roll. You may use the App for personal, non-commercial purposes.
        You agree not to reverse-engineer, decompile, or attempt to extract the
        source code of the App.
      </Section>

      <Section title="2. Account & Data">
        Slim does not require an account. All data (stats, preferences) is
        stored locally on your device. If you enable iCloud sync, Apple handles
        the storage and encryption — we never access this data. You can delete
        all local data at any time from Profile → "Delete all Slim data".
      </Section>

      <Section title="3. In-App Purchases">
        Slim may offer premium features ("Slim Pro") as in-app purchases
        processed through Apple's App Store. All purchases are subject to
        Apple's terms. Refund requests should be directed to Apple. We do not
        process payments directly.
      </Section>

      <Section title="4. Intellectual Property">
        The App, including its design, code, graphics, and content, is owned by
        the developer and protected by applicable intellectual property laws.
        You may not copy, modify, distribute, or create derivative works based
        on the App without prior written consent.
      </Section>

      <Section title="5. Disclaimer of Warranties">
        The App is provided "as is" and "as available" without warranties of any
        kind, express or implied. We do not guarantee that the App will be
        uninterrupted, error-free, or free of harmful components.
      </Section>

      <Section title="6. Limitation of Liability">
        To the maximum extent permitted by law, we shall not be liable for any
        indirect, incidental, special, consequential, or punitive damages, or
        any loss of data, profits, or goodwill arising from your use of the App.
      </Section>

      <Section title="7. Photo Permissions">
        Slim requests access to your Photo Library solely to display and manage
        photos within the App. Photos are never uploaded, copied, or shared with
        any third party. You may revoke access at any time in your device
        settings.
      </Section>

      <Section title="8. Termination">
        We reserve the right to suspend or terminate access to the App at any
        time, with or without cause. Upon termination, your right to use the App
        ceases immediately. Deleting the App removes all locally stored data.
      </Section>

      <Section title="9. Changes to These Terms">
        We may update these Terms from time to time. Changes will be reflected
        on this page with an updated "Last updated" date. Continued use of the
        App after changes constitutes acceptance of the revised Terms.
      </Section>

      <Section title="10. Governing Law">
        These Terms are governed by the laws of Sweden. Any disputes shall be
        resolved in the courts of Sweden.
      </Section>

      <Section title="11. Contact">
        Questions about these terms? Reach out at{" "}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      <div className="mt-1.5 text-sm leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}
