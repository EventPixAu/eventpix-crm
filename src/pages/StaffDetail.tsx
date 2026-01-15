import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Star,
  DollarSign,
  FileCheck,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useStaffRatesByUser, type StaffRate } from '@/hooks/useStaffRates';
import { useStaffFeedbackHistory, useStaffPerformanceSummary } from '@/hooks/useStaffFeedback';
import { StaffCompliancePanel } from '@/components/StaffCompliancePanel';
import { StaffRateEditor } from '@/components/StaffRateEditor';
import { StaffProfileEditor } from '@/components/StaffProfileEditor';
import { AvatarUpload } from '@/components/AvatarUpload';
import { ONBOARDING_STATUS_CONFIG, type OnboardingStatus } from '@/hooks/useCompliance';
import { cn } from '@/lib/utils';

interface StaffProfile {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  home_city: string | null;
  home_state: string | null;
  status: string | null;
  seniority: string | null;
  onboarding_status: string;
  travel_ready: boolean | null;
  preferred_start_time: string | null;
  preferred_end_time: string | null;
  notes_internal: string | null;
  default_role_id: string | null;
  default_role: {
    name: string;
  } | null;
}

interface Assignment {
  id: string;
  event_id: string;
  role_on_event: string | null;
  created_at: string;
  events: {
    event_name: string;
    event_date: string;
    client_name: string;
    ops_status: string | null;
  };
}

export default function StaffDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, user } = useAuth();
  
  // Users can edit their own avatar, admins can edit any
  const canEditAvatar = user?.id === id || isAdmin;

  // Fetch profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['staff-profile', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, full_name, email, phone, avatar_url, 
          home_city, home_state, status, seniority,
          onboarding_status, travel_ready, 
          preferred_start_time, preferred_end_time,
          notes_internal, default_role_id,
          default_role:staff_roles(name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as StaffProfile;
    },
    enabled: !!id,
  });

  // Fetch assignment history
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['staff-assignments', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('event_assignments')
        .select(`
          id, event_id, role_on_event, created_at,
          events (
            event_name, event_date, client_name, ops_status
          )
        `)
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Assignment[];
    },
    enabled: !!id,
  });

  // Rates
  const { data: rates, isLoading: ratesLoading } = useStaffRatesByUser(id);

  // Feedback
  const { data: feedbackHistory, isLoading: feedbackLoading } = useStaffFeedbackHistory(id);
  const { data: performanceSummary } = useStaffPerformanceSummary(id);

  if (!id) {
    return (
      <AppLayout>
        <div className="text-center py-12 text-muted-foreground">Staff member not found</div>
      </AppLayout>
    );
  }

  if (profileLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="text-center py-12 text-muted-foreground">Staff member not found</div>
      </AppLayout>
    );
  }

  const onboardingStatus = profile.onboarding_status as OnboardingStatus;
  const onboardingConfig = ONBOARDING_STATUS_CONFIG[onboardingStatus] || ONBOARDING_STATUS_CONFIG.incomplete;

  // Group assignments by status
  const upcomingAssignments = assignments?.filter(a => 
    new Date(a.events.event_date) >= new Date()
  ) || [];
  const pastAssignments = assignments?.filter(a => 
    new Date(a.events.event_date) < new Date()
  ) || [];

  return (
    <AppLayout>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="gap-2 -ml-2">
          <Link to="/staff">
            <ArrowLeft className="h-4 w-4" />
            Back to Staff
          </Link>
        </Button>
      </div>

      <PageHeader
        title={profile.full_name || 'Staff Member'}
        description={profile.default_role?.name || 'Team Member'}
      />

      {/* Profile Summary Card */}
      <Card className="mb-6 relative">
        {/* Edit Button for Admins */}
        {isAdmin && (
          <div className="absolute top-4 right-4 z-10">
            <StaffProfileEditor profile={profile} />
          </div>
        )}
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar & Basic Info */}
            <div className="flex items-start gap-4">
              <AvatarUpload
                userId={id}
                currentAvatarUrl={profile.avatar_url}
                userName={profile.full_name || profile.email}
                size="lg"
                editable={canEditAvatar}
              />
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={onboardingConfig.variant}>
                    {onboardingConfig.label}
                  </Badge>
                  {profile.status && (
                    <Badge variant={profile.status === 'active' ? 'default' : 'secondary'}>
                      {profile.status}
                    </Badge>
                  )}
                  {profile.seniority && (
                    <Badge variant="outline" className="capitalize">
                      {profile.seniority}
                    </Badge>
                  )}
                  {profile.travel_ready && (
                    <Badge variant="outline" className="border-blue-500 text-blue-600">
                      Travel Ready
                    </Badge>
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  <a href={`mailto:${profile.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <Mail className="h-4 w-4" />
                    {profile.email}
                  </a>
                  {profile.phone && (
                    <a href={`tel:${profile.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                      <Phone className="h-4 w-4" />
                      {profile.phone}
                    </a>
                  )}
                  {(profile.home_city || profile.home_state) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {[profile.home_city, profile.home_state].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-secondary/50 rounded-lg p-4 text-center">
                <Briefcase className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{assignments?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total Events</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4 text-center">
                <Calendar className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{upcomingAssignments.length}</p>
                <p className="text-xs text-muted-foreground">Upcoming</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4 text-center">
                <Star className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                <p className="text-2xl font-bold">
                  {performanceSummary?.averageRating || '—'}
                </p>
                <p className="text-xs text-muted-foreground">Avg Rating</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4 text-center">
                {performanceSummary?.recentTrend === 'up' ? (
                  <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
                ) : performanceSummary?.recentTrend === 'down' ? (
                  <TrendingDown className="h-5 w-5 mx-auto mb-1 text-red-500" />
                ) : (
                  <Minus className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                )}
                <p className="text-2xl font-bold capitalize">
                  {performanceSummary?.recentTrend || '—'}
                </p>
                <p className="text-xs text-muted-foreground">Trend</p>
              </div>
            </div>
          </div>

          {/* Preferred times & Internal notes */}
          {(profile.preferred_start_time || profile.preferred_end_time || profile.notes_internal) && isAdmin && (
            <div className="mt-4 pt-4 border-t space-y-2">
              {(profile.preferred_start_time || profile.preferred_end_time) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Preferred hours: {profile.preferred_start_time || '—'} - {profile.preferred_end_time || '—'}
                </div>
              )}
              {profile.notes_internal && (
                <div className="text-sm">
                  <span className="font-medium">Internal Notes: </span>
                  <span className="text-muted-foreground">{profile.notes_internal}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for detailed info */}
      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="assignments" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Feedback
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="rates" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Rates
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="compliance" className="flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Compliance
            </TabsTrigger>
          )}
        </TabsList>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          {upcomingAssignments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upcoming Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {upcomingAssignments.map((assignment) => (
                    <AssignmentRow key={assignment.id} assignment={assignment} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Past Events</CardTitle>
              <CardDescription>
                {pastAssignments.length} completed assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignmentsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : pastAssignments.length === 0 ? (
                <p className="text-muted-foreground text-sm">No past assignments</p>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {pastAssignments.map((assignment) => (
                      <AssignmentRow key={assignment.id} assignment={assignment} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback" className="space-y-4">
          {performanceSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium",
                    performanceSummary.performanceLabel === 'Consistently strong performance' && "bg-green-100 text-green-800",
                    performanceSummary.performanceLabel === 'Recent quality issues' && "bg-red-100 text-red-800",
                    performanceSummary.performanceLabel === 'New / limited history' && "bg-gray-100 text-gray-800"
                  )}>
                    {performanceSummary.performanceLabel}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Based on {performanceSummary.totalEvents} events
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Feedback History</CardTitle>
            </CardHeader>
            <CardContent>
              {feedbackLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !feedbackHistory || feedbackHistory.length === 0 ? (
                <p className="text-muted-foreground text-sm">No feedback recorded yet</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {feedbackHistory.map((feedback: any) => (
                      <div key={feedback.id} className="p-3 border rounded-lg bg-card">
                        <div className="flex items-center justify-between mb-2">
                          <Link 
                            to={`/events/${feedback.event_id}`}
                            className="font-medium hover:text-primary"
                          >
                            {feedback.events?.event_name || 'Unknown Event'}
                          </Link>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={cn(
                                  "h-4 w-4",
                                  star <= feedback.rating 
                                    ? "fill-yellow-400 text-yellow-400" 
                                    : "text-muted-foreground"
                                )}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-1">
                          {feedback.events?.event_date && format(parseISO(feedback.events.event_date), 'PP')}
                        </div>
                        {feedback.notes && (
                          <p className="text-sm text-muted-foreground">{feedback.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rates Tab (Admin only) */}
        {isAdmin && (
          <TabsContent value="rates">
            <StaffRateEditor userId={id} userName={profile.full_name || profile.email} />
          </TabsContent>
        )}

        {/* Compliance Tab (Admin only) */}
        {isAdmin && (
          <TabsContent value="compliance">
            <StaffCompliancePanel 
              userId={id} 
              currentOnboardingStatus={onboardingStatus}
            />
          </TabsContent>
        )}
      </Tabs>
    </AppLayout>
  );
}

function AssignmentRow({ assignment }: { assignment: Assignment }) {
  const eventDate = parseISO(assignment.events.event_date);
  const isPast = eventDate < new Date();

  return (
    <Link 
      to={`/events/${assignment.event_id}`}
      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-medium",
          isPast ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
        )}>
          <div className="text-center">
            <div>{format(eventDate, 'dd')}</div>
            <div className="text-[10px]">{format(eventDate, 'MMM')}</div>
          </div>
        </div>
        <div>
          <p className="font-medium">{assignment.events.event_name}</p>
          <p className="text-xs text-muted-foreground">
            {assignment.events.client_name}
            {assignment.role_on_event && ` • ${assignment.role_on_event}`}
          </p>
        </div>
      </div>
      {assignment.events.ops_status && (
        <Badge variant="outline" className="capitalize text-xs">
          {assignment.events.ops_status.replace(/_/g, ' ')}
        </Badge>
      )}
    </Link>
  );
}
