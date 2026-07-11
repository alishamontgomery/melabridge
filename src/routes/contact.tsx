import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — MelaBridge" },
      { name: "description", content: "Get in touch with the MelaBridge team. We're here to help you plan every moment." },
      { property: "og:title", content: "Contact MelaBridge" },
      { property: "og:description", content: "Talk to sales, get support, or share feedback." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="Contact"
      title={<>We'd <span className="text-gradient">love to hear from you.</span></>}
      description="Questions, partnership ideas, or press inquiries — send a note and a real human will reply."
    >
      <form className="not-prose grid gap-4 rounded-3xl border border-border bg-card p-8 shadow-soft" onSubmit={(e) => e.preventDefault()}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="c-name" className="mb-1.5 block text-sm font-medium">Name</label>
            <Input id="c-name" placeholder="Your name" required />
          </div>
          <div>
            <label htmlFor="c-email" className="mb-1.5 block text-sm font-medium">Email</label>
            <Input id="c-email" type="email" placeholder="you@example.com" required />
          </div>
        </div>
        <div>
          <label htmlFor="c-subject" className="mb-1.5 block text-sm font-medium">Subject</label>
          <Input id="c-subject" placeholder="How can we help?" />
        </div>
        <div>
          <label htmlFor="c-msg" className="mb-1.5 block text-sm font-medium">Message</label>
          <Textarea id="c-msg" rows={5} placeholder="Tell us a bit more…" />
        </div>
        <Button variant="hero" size="lg" className="justify-self-start rounded-full">Send message</Button>
      </form>
      <h2>Other ways to reach us</h2>
      <p><strong>Support:</strong> support@melabridge.com<br /><strong>Sales:</strong> sales@melabridge.com<br /><strong>Press:</strong> press@melabridge.com</p>
    </MarketingPage>
  ),
});
