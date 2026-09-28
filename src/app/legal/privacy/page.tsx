import { SiteHeader } from "@/components/SiteHeader";

export const metadata = { title: "Privacy Policy — Theonexus Trading Oracle" };

export default function PrivacyPolicyPage() {
  return (
    <>
      <SiteHeader showNav={false} />
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-5 px-4 py-8 sm:px-6">
        <h1 className="m-0 text-[26px] font-medium text-foreground">Privacy Policy</h1>
        <p className="m-0 text-xs text-muted">Effective September 28, 2026</p>

        <p className="m-0 text-sm text-foreground/90">
          This policy describes how Theonexus Trading Oracle (&ldquo;we,&rdquo; &ldquo;us&rdquo;) handles information when
          you sign in and use the mastermind dashboard and related tools.
        </p>

        <h2 className="m-0 text-lg font-medium text-foreground">Information we collect</h2>
        <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-foreground/90">
          <li>
            <strong>Google account info</strong> — your name, email address, and profile picture, provided
            by Google Sign-In when you log in.
          </li>
          <li>
            <strong>Billing information</strong> — subscription and payment details are collected and
            stored by Stripe, our payment processor. We never see or store your full card number.
          </li>
          <li>
            <strong>Trading dashboard data</strong> — signals, trades, and account settings associated
            with your membership or client account.
          </li>
        </ul>

        <h2 className="m-0 text-lg font-medium text-foreground">How we use it</h2>
        <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-foreground/90">
          <li>To authenticate you and identify your account.</li>
          <li>To determine and enforce your membership/subscription status.</li>
          <li>To operate the dashboard, tools, and trade log you&apos;re entitled to see.</li>
          <li>To contact you about your account, billing, or the service.</li>
        </ul>

        <h2 className="m-0 text-lg font-medium text-foreground">Sharing</h2>
        <p className="m-0 text-sm text-foreground/90">
          We share data only with the service providers needed to run the app — Google (authentication)
          and Stripe (billing). We do not sell your information to third parties.
        </p>

        <h2 className="m-0 text-lg font-medium text-foreground">Data retention &amp; deletion</h2>
        <p className="m-0 text-sm text-foreground/90">
          We retain account data for as long as your membership is active. To request deletion of your
          data, contact us at the address below.
        </p>

        <h2 className="m-0 text-lg font-medium text-foreground">Security</h2>
        <p className="m-0 text-sm text-foreground/90">
          We use industry-standard measures to protect your data, but no method of transmission or storage
          is 100% secure.
        </p>

        <h2 className="m-0 text-lg font-medium text-foreground">Changes to this policy</h2>
        <p className="m-0 text-sm text-foreground/90">
          We may update this policy from time to time. Continued use of the app after a change means you
          accept the updated policy.
        </p>

        <h2 className="m-0 text-lg font-medium text-foreground">Contact</h2>
        <p className="m-0 text-sm text-foreground/90">
          Questions about this policy or your data? Email{" "}
          <a href="mailto:nettmakers@gmail.com" className="underline decoration-dotted">
            nettmakers@gmail.com
          </a>
          .
        </p>
      </main>
    </>
  );
}
