import { useRef } from 'react';
import { Printer, Smartphone, Calendar, Camera, CheckSquare, User, MapPin, Clock, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';


export default function CrewOnboardingGuide() {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

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

        {/* Section 1: Getting Started */}
        <section className="mb-10 print:mb-6 page-break-inside-avoid">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-semibold">1. Getting Started</h2>
          </div>
          
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Accept Your Invitation</h3>
                <p className="text-muted-foreground text-sm">
                  You'll receive an email invitation to join EventPix. Click the link to create your account with a secure password.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Access the App</h3>
                <p className="text-muted-foreground text-sm">
                  Visit <strong>app.eventpix.com.au</strong> from any device. The app is mobile-optimized, so you can use it on your phone at events.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Complete Your Profile</h3>
                <p className="text-muted-foreground text-sm">
                  Navigate to <strong>My Profile</strong> to add your details including:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1 ml-2">
                  <li>Contact phone number</li>
                  <li>Emergency contact details</li>
                  <li>Vehicle information (for parking purposes)</li>
                  <li>Equipment you own (cameras, lenses, lighting)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 2: Your Dashboard */}
        <section className="mb-10 print:mb-6 page-break-inside-avoid">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-semibold">2. Your Dashboard</h2>
          </div>
          
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-muted-foreground text-sm">
                When you log in, you'll see your personalized Photographer Dashboard showing:
              </p>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Upcoming Events
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    See all events you're assigned to, with dates, times, and venue information at a glance.
                  </p>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Crew Call Times
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Your arrival time is displayed prominently — this is when YOU need to be on-site, which may differ from the event start.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 3: My Calendar */}
        <section className="mb-10 print:mb-6 page-break-inside-avoid">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-semibold">3. My Calendar</h2>
          </div>
          
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-muted-foreground text-sm">
                Access your personal event calendar from the sidebar. Key features include:
              </p>
              
              <div>
                <h3 className="font-semibold mb-2">Calendar Sync</h3>
                <p className="text-muted-foreground text-sm">
                  Click "Subscribe" to sync your EventPix schedule with your personal calendar:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1 ml-2">
                  <li><strong>Google Calendar</strong> — One-click add</li>
                  <li><strong>Apple Calendar</strong> — Opens in Calendar app</li>
                  <li><strong>Outlook</strong> — Subscribe via URL</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  Once subscribed, new assignments automatically appear in your calendar!
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Timezone Support</h3>
                <p className="text-muted-foreground text-sm">
                  Events display their local timezone (e.g., [SYD], [PER]) so you always know the correct time zone for each shoot.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 4: Event Day-Of View */}
        <section className="mb-10 print:mb-6 page-break-inside-avoid">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Camera className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-semibold">4. Event Day-Of View</h2>
          </div>
          
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-muted-foreground text-sm">
                On the day of an event, tap any assignment to open the <strong>Day-Of View</strong> — your mobile-optimized briefing with everything you need:
              </p>
              
              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Venue & Parking</h3>
                    <p className="text-sm text-muted-foreground">Address with a direct Google Maps link, plus parking instructions and venue access notes.</p>
                  </div>
                </div>
                
                <div className="flex gap-3 items-start">
                  <User className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Contacts</h3>
                    <p className="text-sm text-muted-foreground">On-site contact names and phone numbers with tap-to-call functionality.</p>
                  </div>
                </div>
                
                <div className="flex gap-3 items-start">
                  <Camera className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Photography Brief</h3>
                    <p className="text-sm text-muted-foreground">Specific shooting instructions, style notes, and must-capture shots for the event.</p>
                  </div>
                </div>
                
                <div className="flex gap-3 items-start">
                  <CheckSquare className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Your Checklist</h3>
                    <p className="text-sm text-muted-foreground">A role-specific checklist (Lead Photographer vs Assistant) for pre-event prep and on-site tasks.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 5: Checklists */}
        <section className="mb-10 print:mb-6 page-break-inside-avoid">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <CheckSquare className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-semibold">5. Your Checklist</h2>
          </div>
          
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-muted-foreground text-sm">
                Each event includes a personalized checklist based on your role. Tap items to mark them complete:
              </p>
              
              <div className="border rounded-lg p-4 bg-muted/30">
                <h3 className="font-semibold mb-3">Example Checklist Items</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 rounded" />
                    <span>Confirm arrival with team lead</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 rounded" />
                    <span>Check camera settings (ISO, WB, focus mode)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 rounded" />
                    <span>Backup batteries and cards ready</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 rounded" />
                    <span>Review shot list with client</span>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Your checklist progress is saved automatically and visible to the team coordinator.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Section 6: Equipment */}
        <section className="mb-10 print:mb-6 page-break-inside-avoid">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Camera className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-semibold">6. Equipment</h2>
          </div>
          
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Your Gear Kits</h3>
                <p className="text-muted-foreground text-sm">
                  In your profile, you can add your personal equipment organized into kits:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1 ml-2">
                  <li><strong>Camera Kit</strong> — Bodies and lenses</li>
                  <li><strong>Lighting Kit</strong> — Flashes, modifiers, stands</li>
                  <li><strong>Backdrop Kit</strong> — Backgrounds and supports</li>
                  <li><strong>Other</strong> — Tripods, batteries, accessories</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">EventPix Gear</h3>
                <p className="text-muted-foreground text-sm">
                  For some events, EventPix equipment may be allocated to you. This will appear in your Day-Of view under the Equipment section.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 7: Quick Tips */}
        <section className="mb-10 print:mb-6 page-break-inside-avoid">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-semibold">7. Quick Tips</h2>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-semibold mb-1">Add to Home Screen</h3>
                  <p className="text-sm text-muted-foreground">
                    On your phone, use "Add to Home Screen" for quick app-like access.
                  </p>
                </div>
                
                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-semibold mb-1">Check the Day Before</h3>
                  <p className="text-sm text-muted-foreground">
                    Review your Day-Of view the evening before each event to be fully prepared.
                  </p>
                </div>
                
                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-semibold mb-1">Sync Your Calendar</h3>
                  <p className="text-sm text-muted-foreground">
                    Set up calendar sync once and never miss an assignment again.
                  </p>
                </div>
                
                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-semibold mb-1">Keep Profile Updated</h3>
                  <p className="text-sm text-muted-foreground">
                    Update your equipment list when you get new gear so coordinators know what you have.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

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
          @page {
            margin: 1.5cm;
            size: A4;
          }
          
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .page-break-inside-avoid {
            page-break-inside: avoid;
          }
          
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
