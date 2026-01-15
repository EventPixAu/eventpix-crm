import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, startOfDay, isAfter, parseISO } from 'date-fns';
import {
  Calendar,
  CalendarCheck,
  Camera,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Phone,
  Plane,
  Save,
  Settings,
  Star,
  User,
  Loader2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AvatarUpload } from '@/components/AvatarUpload';
import { SkillNominationPanel } from '@/components/SkillNominationPanel';
import { NotificationPreferencesPanel } from '@/components/NotificationPreferencesPanel';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AUSTRALIAN_STATES = [
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NT', label: 'Northern Territory' },
];

interface ProfileData {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  home_city: string | null;
  home_state: string | null;
  travel_ready: boolean;
  preferred_start_time: string | null;
  preferred_end_time: string | null;
  seniority: string | null;
  onboarding_status: string;
  notification_preferences: {
    email_on_assignment: boolean;
    email_on_changes: boolean;
    in_app_notifications: boolean;
  } | null;
}

interface UpcomingEvent {
  id: string;
  event_name: string;
  event_date: string;
  start_at: string | null;
  venue_name: string | null;
  city: string | null;
  onsite_contact_name: string | null;
  onsite_contact_phone: string | null;
  role_on_event: string | null;
}

function useMyProfile() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data as unknown as ProfileData;
    },
    enabled: !!user?.id,
  });
}

function useUpcomingAssignments() {
  const { user } = useAuth();
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd');
  
  return useQuery({
    queryKey: ['my-upcoming-assignments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('event_assignments')
        .select(`
          id,
          role_on_event,
          events (
            id,
            event_name,
            event_date,
            start_at,
            venue_name,
            city,
            onsite_contact_name,
            onsite_contact_phone
          )
        `)
        .eq('user_id', user.id)
        .gte('events.event_date', today)
        .lte('events.event_date', nextWeek)
        .order('events(event_date)', { ascending: true });
      
      if (error) throw error;
      
      return (data || [])
        .filter(a => a.events)
        .map(a => ({
          ...(a.events as any),
          role_on_event: a.role_on_event,
        })) as UpcomingEvent[];
    },
    enabled: !!user?.id,
  });
}

function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (updates: Partial<ProfileData>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      toast.success('Profile updated');
    },
    onError: (error) => {
      toast.error('Failed to update profile: ' + error.message);
    },
  });
}

export default function StaffMe() {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const { data: upcomingEvents = [], isLoading: eventsLoading } = useUpcomingAssignments();
  const updateProfile = useUpdateMyProfile();
  
  const [formData, setFormData] = useState<Partial<ProfileData>>({});
  const [hasChanges, setHasChanges] = useState(false);
  
  // Initialize form data when profile loads
  const initFormData = () => {
    if (profile && Object.keys(formData).length === 0) {
      setFormData({
        phone: profile.phone || '',
        home_city: profile.home_city || '',
        home_state: profile.home_state || '',
        travel_ready: profile.travel_ready ?? false,
        preferred_start_time: profile.preferred_start_time || '',
        preferred_end_time: profile.preferred_end_time || '',
      });
    }
  };
  
  if (profile && Object.keys(formData).length === 0) {
    initFormData();
  }
  
  const handleFieldChange = (field: keyof ProfileData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };
  
  const handleSave = async () => {
    await updateProfile.mutateAsync(formData);
    setHasChanges(false);
  };
  
  if (profileLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }
  
  if (!profile) {
    return (
      <AppLayout>
        <div className="text-center py-12 text-muted-foreground">
          Profile not found
        </div>
      </AppLayout>
    );
  }
  
  // Group events by date
  const eventsByDate = upcomingEvents.reduce((acc, event) => {
    const date = event.event_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, UpcomingEvent[]>);
  
  const multiJobDates = Object.entries(eventsByDate).filter(([_, events]) => events.length > 1);
  
  return (
    <AppLayout>
      <PageHeader
        title="My Profile"
        description="Manage your details and preferences"
      />
      
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Skills
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Settings className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Profile Card */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personal Details
                  </CardTitle>
                  <CardDescription>
                    Keep your contact information current so we can reach you
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar Section */}
                  <div className="flex items-center gap-4">
                    <AvatarUpload
                      userId={user?.id || ''}
                      currentAvatarUrl={profile.avatar_url}
                      userName={profile.full_name || profile.email}
                      size="lg"
                      editable
                    />
                    <div>
                      <h3 className="font-semibold">{profile.full_name || 'Your Name'}</h3>
                      <p className="text-sm text-muted-foreground">{profile.email}</p>
                      <Badge variant="outline" className="mt-1">
                        {profile.seniority || 'Photographer'}
                      </Badge>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Editable Fields */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Mobile Phone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          placeholder="0400 000 000"
                          value={formData.phone || ''}
                          onChange={(e) => handleFieldChange('phone', e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="home_city">Home City</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="home_city"
                          placeholder="Sydney"
                          value={formData.home_city || ''}
                          onChange={(e) => handleFieldChange('home_city', e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="home_state">Home State</Label>
                      <Select
                        value={formData.home_state || ''}
                        onValueChange={(value) => handleFieldChange('home_state', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {AUSTRALIAN_STATES.map(state => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Travel Ready</Label>
                      <div className="flex items-center gap-3 h-10">
                        <Switch
                          checked={formData.travel_ready ?? false}
                          onCheckedChange={(checked) => handleFieldChange('travel_ready', checked)}
                        />
                        <span className="text-sm text-muted-foreground">
                          {formData.travel_ready ? (
                            <span className="flex items-center gap-1 text-primary">
                              <Plane className="h-4 w-4" /> Available for interstate work
                            </span>
                          ) : (
                            'Not available for travel'
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Preferred Times */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Preferred Working Hours
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="preferred_start_time">Earliest Start</Label>
                        <Input
                          id="preferred_start_time"
                          type="time"
                          value={formData.preferred_start_time || ''}
                          onChange={(e) => handleFieldChange('preferred_start_time', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="preferred_end_time">Latest End</Label>
                        <Input
                          id="preferred_end_time"
                          type="time"
                          value={formData.preferred_end_time || ''}
                          onChange={(e) => handleFieldChange('preferred_end_time', e.target.value)}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      These are preferences only. Admins may still assign outside these times for urgent needs.
                    </p>
                  </div>
                  
                  {/* Save Button */}
                  {hasChanges && (
                    <div className="flex justify-end pt-2">
                      <Button onClick={handleSave} disabled={updateProfile.isPending}>
                        {updateProfile.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Read-Only Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Account Information</CardTitle>
                  <CardDescription>
                    These fields are managed by your administrator
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Seniority</span>
                      <p className="font-medium capitalize">{profile.seniority || 'Not set'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Onboarding Status</span>
                      <p className="font-medium capitalize">{profile.onboarding_status?.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email</span>
                      <p className="font-medium">{profile.email}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Contact your administrator to update seniority, rates, or compliance status.
                  </p>
                </CardContent>
              </Card>
            </div>
            
            {/* Sidebar */}
            <div className="space-y-6">
              {/* Upcoming Jobs */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Upcoming Jobs
                  </CardTitle>
                  <CardDescription>Next 7 days</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {eventsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : upcomingEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No upcoming assignments
                    </p>
                  ) : (
                    <>
                      {multiJobDates.length > 0 && (
                        <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                          <span className="text-amber-700 dark:text-amber-400">
                            {multiJobDates.length} multi-job day{multiJobDates.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      
                      {upcomingEvents.slice(0, 5).map((event) => (
                        <Link
                          key={event.id}
                          to={`/events/${event.id}/job-sheet`}
                          className="block p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{event.event_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(event.event_date), 'EEE, MMM d')}
                                {event.start_at && ` • ${format(parseISO(event.start_at), 'h:mm a')}`}
                              </p>
                              {event.city && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <MapPin className="h-3 w-3" />
                                  {event.city}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </div>
                        </Link>
                      ))}
                      
                      {upcomingEvents.length > 5 && (
                        <Button variant="ghost" size="sm" asChild className="w-full">
                          <Link to="/my-calendar">
                            View all {upcomingEvents.length} events
                          </Link>
                        </Button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
              
              {/* Quick Links */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" size="sm" asChild className="w-full justify-start gap-2">
                    <Link to="/my-calendar">
                      <Calendar className="h-4 w-4" />
                      My Calendar
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="w-full justify-start gap-2">
                    <Link to="/my-availability">
                      <CalendarCheck className="h-4 w-4" />
                      Set Availability
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="w-full justify-start gap-2">
                    <Link to="/my-documents">
                      <FileText className="h-4 w-4" />
                      My Documents
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="skills">
          <SkillNominationPanel userId={user?.id} />
        </TabsContent>
        
        <TabsContent value="notifications">
          <NotificationPreferencesPanel 
            preferences={profile.notification_preferences}
            userId={user?.id || ''}
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
