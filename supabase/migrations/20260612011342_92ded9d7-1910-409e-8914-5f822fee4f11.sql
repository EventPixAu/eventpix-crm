
CREATE TABLE public.onboarding_guide_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  title text NOT NULL,
  icon text NOT NULL DEFAULT 'User',
  sort_order integer NOT NULL DEFAULT 0,
  body_markdown text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_guide_sections TO authenticated;
GRANT SELECT ON public.onboarding_guide_sections TO anon;
GRANT ALL ON public.onboarding_guide_sections TO service_role;

ALTER TABLE public.onboarding_guide_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active onboarding sections"
  ON public.onboarding_guide_sections
  FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage onboarding sections"
  ON public.onboarding_guide_sections
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER onboarding_guide_sections_updated_at
  BEFORE UPDATE ON public.onboarding_guide_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.onboarding_guide_sections (section_key, title, icon, sort_order, body_markdown) VALUES
('getting_started', 'Getting Started', 'User', 10,
$$### Accept Your Invitation
You'll receive an email invitation to join EventPix. Click the link to create your account with a secure password.

### Access the App
Visit **app.eventpix.com.au** from a computer to complete your profile. The app is mobile-optimized, so you can use it on your phone at events.

### Complete Your Profile
Navigate to **My Profile** to add your details including:
- Contact phone number
- Emergency contact details
- Vehicle information (for parking purposes)
- Equipment you own (cameras, lenses, lighting)$$),

('dashboard', 'Your Dashboard', 'Smartphone', 20,
$$When you log in, you'll see your personalized Photographer Dashboard showing:

### Upcoming Events
See all events you're assigned to, with dates, times, and venue information at a glance.

### Crew Call Times
Your arrival time is displayed prominently — this is when YOU need to be on-site, which may differ from the event start.$$),

('my_calendar', 'My Calendar', 'Calendar', 30,
$$Access your personal event calendar from the sidebar. Key features include:

### Calendar Sync
Click "Subscribe" to sync your EventPix schedule with your personal calendar:
- **Google Calendar** — One-click add
- **Apple Calendar** — Opens in Calendar app
- **Outlook** — Subscribe via URL

Once subscribed, new assignments automatically appear in your calendar!

### Timezone Support
Events display their local timezone (e.g., [SYD], [PER]) so you always know the correct time zone for each shoot.$$),

('app_walkthrough', 'App Walkthrough', 'Smartphone', 40,
$$A quick tour of the key screens you'll use on a typical job.

### Event Day-Of View
On the day of an event, tap any assignment to open the **Day-Of View** — your mobile-optimized briefing with everything you need:
- **Venue & Parking** — address with a direct Google Maps link, plus parking instructions and venue access notes.
- **Contacts** — on-site contact names and phone numbers with tap-to-call.
- **Photography Brief** — specific shooting instructions, style notes, and must-capture shots.
- **Your Checklist** — a role-specific checklist (Lead Photographer vs Assistant) for prep and on-site tasks.

### Dress Code
Each event shows the required **Dress Code** (e.g. Black Tie, Smart Casual, Corporate). You'll see the dress code label on:
- Your **Day-Of View** (top of the event briefing)
- The event card on **My Calendar** and **Photographer Dashboard**

To see the **full description** of what a dress code means (what to wear, what to avoid, footwear, etc.), tap the dress code label on the Day-Of View — a panel opens with the complete guidelines set by the office. If you're ever unsure, check there first before contacting your coordinator.

### Notifications
Important updates (new assignments, schedule changes, call-time changes) appear in the bell icon at the top of the app and via email.$$),

('checklist', 'Your Checklist', 'CheckSquare', 50,
$$Each event includes a personalized checklist based on your role. Tap items to mark them complete.

**Example items:**
- Confirm arrival with team lead
- Check camera settings (ISO, WB, focus mode)
- Backup batteries and cards ready
- Review shot list with client

Your checklist progress is saved automatically and visible to the team coordinator.$$),

('equipment', 'Equipment', 'Camera', 60,
$$### Your Gear Kits
In your profile, you can add your personal equipment organized into kits:
- **Camera Kit** — Bodies and lenses
- **Lighting Kit** — Flashes, modifiers, stands
- **Backdrop Kit** — Backgrounds and supports
- **Other** — Tripods, batteries, accessories

### EventPix Gear
For some events, EventPix equipment may be allocated to you. This will appear in your Day-Of view under the Equipment section.$$),

('quick_tips', 'Quick Tips', 'Bell', 70,
$$- **Add to Home Screen** — On your phone, use "Add to Home Screen" for quick app-like access.
- **Check the Day Before** — Review your Day-Of view the evening before each event to be fully prepared.
- **Sync Your Calendar** — Set up calendar sync once and never miss an assignment again.
- **Keep Profile Updated** — Update your equipment list when you get new gear so coordinators know what you have.$$);
