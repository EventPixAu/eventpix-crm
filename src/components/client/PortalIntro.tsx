import {
  Calendar,
  Users,
  FileText,
  MapPin,
  BookOpen,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import eventpixLogo from '@/assets/eventpix-logo.png';

interface PortalIntroProps {
  email: string | null;
  onDismiss: () => void;
}

const features = [
  {
    icon: Calendar,
    title: 'All of your events',
    text: 'Dates, venues and the current status of every event you have with us — including multi-event programs.',
  },
  {
    icon: Users,
    title: 'Your event team',
    text: 'Who is looking after each event, their roles and how to reach them on the day.',
  },
  {
    icon: MapPin,
    title: 'Event details',
    text: 'Session times, special instructions, and whether meals and parking are provided.',
  },
  {
    icon: FileText,
    title: 'Budgets & documents',
    text: 'Open any event to view budgets, agreements and confirmations as they are finalised.',
  },
];

export function PortalIntro({ email, onDismiss }: PortalIntroProps) {
  return (
    <div className="min-h-[calc(100vh-56px)] flex items-start justify-center px-4 py-10">
      <div className="max-w-xl w-full space-y-8">
        <div className="text-center space-y-4">
          <img src={eventpixLogo} alt="Eventpixii" className="h-12 mx-auto" />
          <h1 className="text-2xl font-display font-bold text-foreground">
            Introduction to your Client Portal
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Everything about your events with Eventpixii, in one place.
            {email && (
              <>
                {' '}You're signed in as <strong className="text-foreground">{email}</strong>.
              </>
            )}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-card space-y-5">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <BookOpen className="h-4 w-4 text-primary" />
            What you'll find inside
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">{title}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ExternalLink className="h-4 w-4 text-primary" />
            How it works
          </div>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="text-foreground font-medium">1.</span> Each event card opens its
              full details — team, sessions and documents.
            </li>
            <li>
              <span className="text-foreground font-medium">2.</span> Sign-in is by secure email
              link only — no password to remember.
            </li>
            <li>
              <span className="text-foreground font-medium">3.</span> Come back any time: just
              enter your email at the portal sign-in page and we'll send a fresh link.
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Questions? Simply reply to any email from us and the team will get straight back to you.
          </p>
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={onDismiss}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-glow"
          >
            Enter your portal
          </Button>
        </div>
      </div>
    </div>
  );
}
