import { useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { Printer, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useOnboardingGuideSections } from '@/hooks/useOnboardingGuideSections';
import { markdownToHtml } from '@/lib/markdown';

function SectionIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as any)[name] ?? LucideIcons.Circle;
  return <Icon className={className} />;
}

export default function CrewOnboardingGuide() {
  const printRef = useRef<HTMLDivElement>(null);
  const { data: sections = [], isLoading } = useOnboardingGuideSections();

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-background">
      {/* Header - hidden on print */}
      <div className="print:hidden sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-end">
          <Button onClick={handlePrint} variant="default">
            <Printer className="h-4 w-4 mr-2" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Printable Content */}
      <div ref={printRef} className="max-w-4xl mx-auto px-4 py-8 print:py-0 print:px-8">
        {/* Cover / Title */}
        <div className="text-center mb-12 print:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Camera className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-display font-bold mb-2">Team Onboarding Guide</h1>
          <p className="text-xl text-muted-foreground">Welcome to Eventpixii</p>
          <p className="text-sm text-muted-foreground mt-2">Your complete guide to getting started</p>
        </div>

        <Separator className="my-8 print:my-6" />

        {/* Always-visible sign-in instructions */}
        <section className="mb-10 print:mb-6 page-break-inside-avoid">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <LucideIcons.KeyRound className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-semibold">Getting access to your account</h2>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-4 text-sm">
              <p className="text-muted-foreground">
                EventPix accounts are created for you by the team — you cannot register yourself, and
                you are never sent a password. You choose your own password the first time you use
                the invitation link.
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>
                  Open the invitation email from <strong className="text-foreground">pix@eventpix.com.au</strong> and click
                  <strong className="text-foreground"> Accept Invitation &amp; Create Password</strong>.
                </li>
                <li>Enter a new password twice (minimum 6 characters) and submit.</li>
                <li>You'll be signed straight into the dashboard at <strong className="text-foreground">app.eventpix.com.au</strong>.</li>
                <li>
                  After that, sign in at <a className="text-primary underline" href="https://app.eventpix.com.au/auth">app.eventpix.com.au</a> with
                  the <strong className="text-foreground">email address the invitation was sent to</strong> and the password you created.
                </li>
                <li>Open <strong className="text-foreground">My Profile</strong> and complete your details, ABN/banking and compliance documents so you can be assigned to jobs.</li>
              </ol>
              <div className="rounded-md border p-4 space-y-2 text-muted-foreground">
                <p className="font-semibold text-foreground">Trouble signing in?</p>
                <p>
                  <strong className="text-foreground">"Invalid login credentials"</strong> usually means you haven't created a
                  password yet, or you're using a different email address to the one we invited.
                </p>
                <p>
                  Invitation links are single-use and expire after about an hour. If yours has expired, go to{' '}
                  <a className="text-primary underline" href="https://app.eventpix.com.au/auth">app.eventpix.com.au</a>, click
                  <strong className="text-foreground"> Forgot password</strong>, enter your invited email address, and we'll send a fresh link.
                </p>
                <p>Still stuck? Email <a className="text-primary underline" href="mailto:pix@eventpix.com.au">pix@eventpix.com.au</a>.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {isLoading && (
          <p className="text-center text-muted-foreground text-sm">Loading…</p>
        )}

        {!isLoading && sections.length === 0 && (
          <p className="text-center text-muted-foreground text-sm">
            More onboarding sections will appear here once published.
          </p>
        )}

        {sections.map((s, idx) => (
          <section key={s.id} className="mb-10 print:mb-6 page-break-inside-avoid">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <SectionIcon name={s.icon} className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-display font-semibold">
                {idx + 1}. {s.title}
              </h2>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div
                  className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(s.body_markdown) }}
                />
              </CardContent>
            </Card>
          </section>
        ))}

        {/* Footer */}
        <Separator className="my-8 print:my-6" />

        <div className="text-center text-sm text-muted-foreground print:text-xs">
          <p className="font-semibold mb-1">Need Help?</p>
          <p>Contact your team coordinator or check the Knowledge Base in the app for more guides.</p>
          <p className="mt-4 text-xs">EventPix Team Onboarding Guide • app.eventpix.com.au</p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break-inside-avoid { page-break-inside: avoid; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
