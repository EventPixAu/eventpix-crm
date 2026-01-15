import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Search, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  ArrowLeft,
  Users
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StaffCompliancePanel } from './StaffCompliancePanel';
import { ONBOARDING_STATUS_CONFIG, type OnboardingStatus } from '@/hooks/useCompliance';

interface StaffProfile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  onboarding_status: string;
  default_role_id: string | null;
}

export function StaffComplianceOverview() {
  const [search, setSearch] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);

  // Fetch all profiles for admin review
  const { data: profiles, isLoading } = useQuery({
    queryKey: ['admin-staff-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, onboarding_status, default_role_id')
        .order('full_name', { ascending: true });

      if (error) throw error;
      return data as StaffProfile[];
    },
  });

  // Filter by search
  const filteredProfiles = profiles?.filter(p => 
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Group by onboarding status
  const statusCounts = profiles?.reduce((acc, p) => {
    const status = p.onboarding_status as OnboardingStatus;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<OnboardingStatus, number>) || {};

  if (selectedStaff) {
    return (
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setSelectedStaff(null)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to staff list
        </Button>
        
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedStaff.avatar_url || undefined} />
                <AvatarFallback>
                  {selectedStaff.full_name?.[0] || selectedStaff.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-base">
                  {selectedStaff.full_name || 'Unnamed Staff'}
                </CardTitle>
                <CardDescription>{selectedStaff.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <StaffCompliancePanel 
          userId={selectedStaff.id}
          currentOnboardingStatus={selectedStaff.onboarding_status as OnboardingStatus}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{statusCounts['active'] ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{statusCounts['pending_review'] ?? 0}</p>
                <p className="text-xs text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{statusCounts['incomplete'] ?? 0}</p>
                <p className="text-xs text-muted-foreground">Incomplete</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{statusCounts['suspended'] ?? 0}</p>
                <p className="text-xs text-muted-foreground">Suspended</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff List */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Compliance Status</CardTitle>
          <CardDescription>Review and manage staff compliance documents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Staff List */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredProfiles.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No staff found</p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredProfiles.map((profile) => {
                  const status = profile.onboarding_status as OnboardingStatus;
                  const config = ONBOARDING_STATUS_CONFIG[status] || ONBOARDING_STATUS_CONFIG.incomplete;
                  
                  return (
                    <button
                      key={profile.id}
                      onClick={() => setSelectedStaff(profile)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={profile.avatar_url || undefined} />
                          <AvatarFallback>
                            {profile.full_name?.[0] || profile.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {profile.full_name || 'Unnamed Staff'}
                          </p>
                          <p className="text-sm text-muted-foreground">{profile.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={config.variant}>
                          {config.label}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
