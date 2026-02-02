import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Clock,
  Car,
  Utensils,
  Package,
  UserPlus,
  Camera,
  User,
  Building2,
  Shield,
  CheckCircle
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useStaffRatesByUser, type StaffRate } from '@/hooks/useStaffRates';
import { useStaffFeedbackHistory, useStaffPerformanceSummary } from '@/hooks/useStaffFeedback';
import { StaffCompliancePanel } from '@/components/StaffCompliancePanel';
import { StaffRateEditor } from '@/components/StaffRateEditor';
import { StaffProfileEditor } from '@/components/StaffProfileEditor';
import { AvatarUpload } from '@/components/AvatarUpload';
import { InviteStaffToAccountDialog } from '@/components/InviteStaffToAccountDialog';
import { PhotographyEquipmentEditor, type PhotographyEquipment } from '@/components/PhotographyEquipmentEditor';
import { ONBOARDING_STATUS_CONFIG, useUpdateOnboardingStatus, type OnboardingStatus } from '@/hooks/useCompliance';
import { useUserAllocations, ALLOCATION_STATUS_CONFIG, type AllocationStatus } from '@/hooks/useEquipmentAllocations';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  vehicle_registration: string | null;
  dietary_requirements: string | null;
  certificates?: string | null;
  location?: string | null;
  // New fields
  business_name?: string | null;
  abn?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_postcode?: string | null;
  vehicle_make_model?: string | null;
  pli_details?: string | null;
  pli_expiry?: string | null;
  photography_equipment?: string | null;
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
  
  // First try to find a profile with this ID
  const { data: profileData, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['staff-profile', id],
    queryFn: async () => {
      if (!id) return null;
      
      // First try to find directly in profiles table
      const { data: profileResult, error: profileErr } = await supabase
        .from('profiles')
        .select(`
          id, full_name, email, phone, avatar_url, 
          home_city, home_state, status, seniority,
          onboarding_status, travel_ready, 
          preferred_start_time, preferred_end_time,
          notes_internal, default_role_id,
            vehicle_registration, dietary_requirements, certificates, location,
          business_name, abn, address_line1, address_line2,
          address_city, address_state, address_postcode,
          vehicle_make_model, pli_details, pli_expiry, photography_equipment,
          default_role:staff_roles(name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (profileResult) {
        // Check if there's a linked staff record with additional data
        const { data: linkedStaffData } = await supabase
          .from('staff')
          .select(`
            business_name, abn,
            address_line1, address_line2, address_city, address_state, address_postcode,
            vehicle_make_model, vehicle_registration,
            pli_details, pli_expiry,
            photography_equipment,
            dietary_requirements, certificates, location
          `)
          .eq('user_id', id)
          .maybeSingle();
        
        // Merge staff data as fallback for empty profile fields
        if (linkedStaffData) {
          const mergedProfile: StaffProfile = {
            ...profileResult as StaffProfile,
            business_name: profileResult.business_name || linkedStaffData.business_name || null,
            abn: profileResult.abn || linkedStaffData.abn || null,
            address_line1: profileResult.address_line1 || linkedStaffData.address_line1 || null,
            address_line2: profileResult.address_line2 || linkedStaffData.address_line2 || null,
            address_city: profileResult.address_city || linkedStaffData.address_city || null,
            address_state: profileResult.address_state || linkedStaffData.address_state || null,
            address_postcode: profileResult.address_postcode || linkedStaffData.address_postcode || null,
            vehicle_make_model: profileResult.vehicle_make_model || linkedStaffData.vehicle_make_model || null,
            vehicle_registration: profileResult.vehicle_registration || linkedStaffData.vehicle_registration || null,
            pli_details: profileResult.pli_details || linkedStaffData.pli_details || null,
            pli_expiry: profileResult.pli_expiry || linkedStaffData.pli_expiry || null,
            photography_equipment: profileResult.photography_equipment || linkedStaffData.photography_equipment || null,
            dietary_requirements: profileResult.dietary_requirements || linkedStaffData.dietary_requirements || null,
            certificates: profileResult.certificates || linkedStaffData.certificates || null,
            location: profileResult.location || linkedStaffData.location || null,
          };
          return { profile: mergedProfile, sourceTable: 'profiles' as const, staffId: undefined };
        }
        
        return { profile: profileResult as StaffProfile, sourceTable: 'profiles' as const, staffId: undefined };
      }
      
      // If not found, check if this is a staff table ID and get the linked user_id
      const { data: staffData, error: staffErr } = await supabase
        .from('staff')
          .select(`
            user_id, name, email, phone, role, status, notes, location,
            business_name, abn,
            address_line1, address_line2, address_city, address_state, address_postcode,
            vehicle_make_model, vehicle_registration,
            pli_details, pli_expiry,
            photography_equipment,
            dietary_requirements, certificates
          `)
        .eq('id', id)
        .maybeSingle();
      
      if (staffData?.user_id) {
        // Fetch the linked profile
        const { data: linkedProfile, error: linkedErr } = await supabase
          .from('profiles')
          .select(`
            id, full_name, email, phone, avatar_url, 
            home_city, home_state, status, seniority,
            onboarding_status, travel_ready, 
            preferred_start_time, preferred_end_time,
            notes_internal, default_role_id,
            vehicle_registration, dietary_requirements, certificates, location,
            business_name, abn, address_line1, address_line2,
            address_city, address_state, address_postcode,
            vehicle_make_model, pli_details, pli_expiry, photography_equipment,
            default_role:staff_roles(name)
          `)
          .eq('id', staffData.user_id)
          .single();
        
        if (linkedProfile) {
          // Merge staff data as fallback for empty profile fields
          // Crew member's profile data takes priority, staff data is fallback
          const mergedProfile: StaffProfile = {
            ...linkedProfile as StaffProfile,
            business_name: linkedProfile.business_name || staffData.business_name || null,
            abn: linkedProfile.abn || staffData.abn || null,
            address_line1: linkedProfile.address_line1 || staffData.address_line1 || null,
            address_line2: linkedProfile.address_line2 || staffData.address_line2 || null,
            address_city: linkedProfile.address_city || staffData.address_city || null,
            address_state: linkedProfile.address_state || staffData.address_state || null,
            address_postcode: linkedProfile.address_postcode || staffData.address_postcode || null,
            vehicle_make_model: linkedProfile.vehicle_make_model || staffData.vehicle_make_model || null,
            vehicle_registration: linkedProfile.vehicle_registration || staffData.vehicle_registration || null,
            pli_details: linkedProfile.pli_details || staffData.pli_details || null,
            pli_expiry: linkedProfile.pli_expiry || staffData.pli_expiry || null,
            photography_equipment: linkedProfile.photography_equipment || staffData.photography_equipment || null,
            dietary_requirements: linkedProfile.dietary_requirements || staffData.dietary_requirements || null,
            certificates: linkedProfile.certificates || staffData.certificates || null,
            location: linkedProfile.location || staffData.location || null,
          };
          return { profile: mergedProfile, sourceTable: 'profiles' as const, staffId: id };
        }
      }
      
      // If we have staff data but no profile, create a minimal profile object
      if (staffData) {
        return {
          profile: {
            id: id,
            full_name: staffData.name,
            email: staffData.email,
            phone: staffData.phone,
            avatar_url: null,
            home_city: null,
            home_state: null,
            status: staffData.status,
            seniority: null,
            onboarding_status: 'incomplete',
            travel_ready: null,
            preferred_start_time: null,
            preferred_end_time: null,
            notes_internal: staffData.notes,
            default_role_id: null,
            vehicle_registration: staffData.vehicle_registration || null,
            dietary_requirements: staffData.dietary_requirements || null,
            certificates: staffData.certificates || null,
            default_role: { name: staffData.role },
            location: staffData.location,

            business_name: staffData.business_name || null,
            abn: staffData.abn || null,
            address_line1: staffData.address_line1 || null,
            address_line2: staffData.address_line2 || null,
            address_city: staffData.address_city || null,
            address_state: staffData.address_state || null,
            address_postcode: staffData.address_postcode || null,
            vehicle_make_model: staffData.vehicle_make_model || null,
            pli_details: staffData.pli_details || null,
            pli_expiry: staffData.pli_expiry || null,
            photography_equipment: staffData.photography_equipment || null,
          } as StaffProfile,
          sourceTable: 'staff' as const,
          staffId: id,
        };
      }
      
      return null;
    },
    enabled: !!id,
  });
  
  const profile = profileData?.profile;
  const sourceTable = profileData?.sourceTable || 'profiles';
  const staffId = profileData?.staffId;
  
  // Determine the actual user ID for related queries (might be different from route ID)
  const actualUserId = profile?.id || id;
  
  // Users can edit their own avatar, admins can edit any
  const canEditAvatar = user?.id === actualUserId || isAdmin;

  // Fetch assignment history
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['staff-assignments', actualUserId],
    queryFn: async () => {
      if (!actualUserId) return [];
      const { data, error } = await supabase
        .from('event_assignments')
        .select(`
          id, event_id, role_on_event, created_at,
          events (
            event_name, event_date, client_name, ops_status
          )
        `)
        .eq('user_id', actualUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Assignment[];
    },
    enabled: !!actualUserId && !!profile,
  });

  // Rates
  const { data: rates, isLoading: ratesLoading } = useStaffRatesByUser(actualUserId);

  // Feedback
  const { data: feedbackHistory, isLoading: feedbackLoading } = useStaffFeedbackHistory(actualUserId);
  const { data: performanceSummary } = useStaffPerformanceSummary(actualUserId);

  // Equipment allocations
  const { data: allocations, isLoading: allocationsLoading } = useUserAllocations(actualUserId);

  // Photography equipment (structured JSON)
  const queryClient = useQueryClient();
  
  const { data: photographyEquipment, isLoading: equipmentLoading } = useQuery({
    queryKey: ['photography-equipment', id, sourceTable],
    queryFn: async () => {
      if (!id) return null;
      
      if (sourceTable === 'staff' && staffId) {
        const { data, error } = await supabase
          .from('staff')
          .select('photography_equipment_json')
          .eq('id', staffId)
          .maybeSingle();
        if (error) throw error;
        return (data?.photography_equipment_json as unknown) as PhotographyEquipment | null;
      } else {
        const { data, error } = await supabase
          .from('profiles')
          .select('photography_equipment_json')
          .eq('id', actualUserId)
          .maybeSingle();
        if (error) throw error;
        return (data?.photography_equipment_json as unknown) as PhotographyEquipment | null;
      }
    },
    enabled: !!id && !!profile,
  });

  const updateEquipmentMutation = useMutation({
    mutationFn: async (equipment: PhotographyEquipment) => {
      if (sourceTable === 'staff' && staffId) {
        const { error } = await supabase
          .from('staff')
          .update({ photography_equipment_json: equipment as any })
          .eq('id', staffId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('profiles')
          .update({ photography_equipment_json: equipment as any })
          .eq('id', actualUserId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Equipment updated');
      queryClient.invalidateQueries({ queryKey: ['photography-equipment', id, sourceTable] });
      queryClient.invalidateQueries({ queryKey: ['staff-profile', id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update equipment');
    },
  });

  // Admin: Update onboarding status
  const updateOnboardingStatusMutation = useUpdateOnboardingStatus();

  const handleApproveProfile = () => {
    if (!id) return;
    updateOnboardingStatusMutation.mutate({
      userId: id,
      status: 'active',
      notes: 'Approved by admin',
    });
  };

  if (!id) {
    return (
      <AppLayout>
        <div className="text-center py-12 text-muted-foreground">Team member not found</div>
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
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="gap-2 -ml-2">
            <Link to="/staff">
              <ArrowLeft className="h-4 w-4" />
              Back to Team
            </Link>
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          Team member not found. They may not have a linked user account yet.
        </div>
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
            Back to Team
          </Link>
        </Button>
      </div>

      <PageHeader
        title={profile.full_name || 'Team Member'}
        description={profile.default_role?.name || 'Team Member'}
      />

      {/* Staff-only member notice */}
      {sourceTable === 'staff' && isAdmin && (
        <Alert className="mb-6">
          <UserPlus className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              This team member doesn't have a user account yet. Invite them to create one to unlock full profile features.
            </span>
            <InviteStaffToAccountDialog
              staff={{
                id: staffId || id!,
                name: profile.full_name || 'Team Member',
                email: profile.email,
                role: profile.default_role?.name || 'photographer',
              }}
              trigger={
                <Button size="sm" className="ml-4">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invitation
                </Button>
              }
            />
          </AlertDescription>
        </Alert>
      )}

      {/* Profile Summary Card */}
      <Card className="mb-6">
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
                  {/* Only show onboarding badge if not fully active (avoid duplicate "Active" badges) */}
                  {onboardingStatus !== 'active' && (
                    <>
                      <Badge variant={onboardingConfig.variant}>
                        {onboardingConfig.label}
                      </Badge>
                      {/* Admin can approve profiles that are pending review */}
                      {isAdmin && onboardingStatus === 'pending_review' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs gap-1 border-green-500 text-green-600 hover:bg-green-50"
                          onClick={handleApproveProfile}
                          disabled={updateOnboardingStatusMutation.isPending}
                        >
                          <CheckCircle className="h-3 w-3" />
                          {updateOnboardingStatusMutation.isPending ? 'Approving...' : 'Approve'}
                        </Button>
                      )}
                    </>
                  )}
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

          {/* Operational details - admin only */}
          {isAdmin && (
            <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              {(profile.preferred_start_time || profile.preferred_end_time) && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>Hours: {profile.preferred_start_time || '—'} - {profile.preferred_end_time || '—'}</span>
                </div>
              )}
              {profile.vehicle_registration && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Car className="h-4 w-4 shrink-0" />
                  <span>Vehicle: {profile.vehicle_registration}</span>
                </div>
              )}
              {profile.dietary_requirements && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Utensils className="h-4 w-4 shrink-0" />
                  <span>Diet: {profile.dietary_requirements}</span>
                </div>
              )}
              {allocations && allocations.length > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Package className="h-4 w-4 shrink-0" />
                  <span>{allocations.filter((a: any) => a.status !== 'returned').length} equipment assigned</span>
                </div>
              )}
            </div>
          )}
          {isAdmin && profile.notes_internal && (
            <div className="mt-3 text-sm">
              <span className="font-medium">Internal Notes: </span>
              <span className="text-muted-foreground">{profile.notes_internal}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for detailed info */}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="equipment" className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Equipment
          </TabsTrigger>
          <TabsTrigger value="assignments" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Assignments
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="feedback" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Feedback
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="rates" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Rates
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="allocations" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Allocations
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="compliance" className="flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Compliance
            </TabsTrigger>
          )}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Personal & Business Details */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Business Details
                </CardTitle>
                {isAdmin && (
                  <StaffProfileEditor profile={profile} sourceTable={sourceTable} staffId={staffId} />
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.business_name ? (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Business Name</span>
                    <p className="text-sm font-medium">{profile.business_name}</p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">No business name set</div>
                )}
                
                {profile.abn && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">ABN</span>
                    <p className="text-sm font-medium">{profile.abn}</p>
                  </div>
                )}
                
                <div className="pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Address</span>
                  {(profile.address_line1 || profile.address_city || profile.address_state) ? (
                    <div className="text-sm font-medium mt-1">
                      {profile.address_line1 && <p>{profile.address_line1}</p>}
                      {profile.address_line2 && <p>{profile.address_line2}</p>}
                      {(profile.address_city || profile.address_state || profile.address_postcode) && (
                        <p>
                          {[profile.address_city, profile.address_state].filter(Boolean).join(' ')} {profile.address_postcode}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic mt-1">No address set</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Vehicle & Insurance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Vehicle & Insurance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Vehicle</span>
                  {(profile.vehicle_make_model || profile.vehicle_registration) ? (
                    <div className="text-sm font-medium">
                      {profile.vehicle_make_model && <p>{profile.vehicle_make_model}</p>}
                      {profile.vehicle_registration && (
                        <p className="text-muted-foreground">Rego: {profile.vehicle_registration}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No vehicle details</p>
                  )}
                </div>
                
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Public Liability Insurance</span>
                  {profile.pli_details ? (
                    <div className="text-sm font-medium">
                      <p>{profile.pli_details}</p>
                      {profile.pli_expiry && (
                        <p className="text-muted-foreground">
                          Expires: {format(parseISO(profile.pli_expiry), 'dd MMM yyyy')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No PLI details</p>
                  )}
                </div>

                {profile.certificates && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Certificates</span>
                    <p className="text-sm font-medium">{profile.certificates}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dietary Requirements */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Utensils className="h-4 w-4" />
                  Dietary Requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profile.dietary_requirements ? (
                  <p className="text-sm">{profile.dietary_requirements}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No dietary requirements specified</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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

        {/* Feedback Tab (Admin only) */}
        {isAdmin && (
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
        )}

        {/* Rates Tab (Admin only) */}
        {isAdmin && (
          <TabsContent value="rates">
            <StaffRateEditor userId={id} userName={profile.full_name || profile.email} />
          </TabsContent>
        )}

        {/* Equipment Tab - Photography Equipment (Team member's own gear) */}
        <TabsContent value="equipment" className="space-y-6">
          {/* Photography Equipment (Owned Gear) */}
          {equipmentLoading ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Photography Equipment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              </CardContent>
            </Card>
          ) : (
            <PhotographyEquipmentEditor
              initialData={photographyEquipment || undefined}
              onSave={(equipment) => updateEquipmentMutation.mutateAsync(equipment)}
              isSaving={updateEquipmentMutation.isPending}
            />
          )}
        </TabsContent>

        {/* Allocations Tab (Admin only) - Company equipment assigned to team member */}
        {isAdmin && (
          <TabsContent value="allocations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Assigned Equipment
                </CardTitle>
                <CardDescription>
                  Company equipment currently allocated to this team member
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allocationsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : !allocations || allocations.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No equipment currently assigned</p>
                ) : (
                  <div className="space-y-2">
                    {allocations.map((allocation: any) => (
                      <div 
                        key={allocation.id} 
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <Package className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{allocation.equipment_item?.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">
                              {allocation.equipment_item?.brand} {allocation.equipment_item?.model}
                              {allocation.event && (
                                <> • <Link to={`/events/${allocation.event.id}`} className="text-primary hover:underline">{allocation.event.event_name}</Link></>
                              )}
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            allocation.status === 'allocated' && "border-blue-500 text-blue-600",
                            allocation.status === 'picked_up' && "border-green-500 text-green-600",
                            allocation.status === 'returned' && "border-muted-foreground text-muted-foreground",
                            allocation.status === 'missing' && "border-destructive text-destructive",
                            allocation.status === 'damaged' && "border-orange-500 text-orange-600"
                          )}
                        >
                          {ALLOCATION_STATUS_CONFIG[allocation.status as AllocationStatus]?.label || allocation.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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
