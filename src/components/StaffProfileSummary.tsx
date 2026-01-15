import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Star, MapPin, Briefcase } from 'lucide-react';
import { useStaffRatesByUser } from '@/hooks/useStaffRates';
import { useStaffPerformanceSummary, useStaffFeedbackHistory } from '@/hooks/useStaffFeedback';
import { useStaffSkills } from '@/hooks/useStaffCapabilities';
import { StaffRateEditor } from './StaffRateEditor';
import { StaffPerformanceBadge } from './StaffPerformanceBadge';
import { format } from 'date-fns';

interface StaffProfileSummaryProps {
  userId: string;
  userName: string;
  userEmail: string;
  profile?: {
    home_city?: string | null;
    home_state?: string | null;
    seniority?: string | null;
    status?: string | null;
  };
}

export function StaffProfileSummary({ userId, userName, userEmail, profile }: StaffProfileSummaryProps) {
  const { data: rates } = useStaffRatesByUser(userId);
  const { data: performance } = useStaffPerformanceSummary(userId);
  const { data: feedbackHistory } = useStaffFeedbackHistory(userId);
  const { data: staffSkills } = useStaffSkills(userId);
  

  const activeRate = rates?.find((r) => {
    const today = new Date().toISOString().split('T')[0];
    return r.effective_from <= today && (!r.effective_to || r.effective_to >= today);
  });

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={profile?.status === 'active' ? 'default' : 'secondary'}>
              {profile?.status || 'Unknown'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Seniority</span>
            <span className="text-sm font-medium capitalize">{profile?.seniority || 'Not set'}</span>
          </div>
          {(profile?.home_city || profile?.home_state) && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Location
              </span>
              <span className="text-sm font-medium">
                {[profile.home_city, profile.home_state].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skills Card */}
      {staffSkills && staffSkills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {staffSkills.map((ss) => (
                <Badge key={ss.id} variant="outline">
                  {ss.skill?.name || 'Unknown'}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rates Card */}
      <StaffRateEditor userId={userId} userName={userName} />

      {/* Performance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4" />
            Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <StaffPerformanceBadge userId={userId} />

          {performance && performance.totalEvents > 0 && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-2 bg-muted rounded">
                <div className="text-xl font-bold">{performance.averageRating}/5</div>
                <div className="text-xs text-muted-foreground">Avg Rating</div>
              </div>
              <div className="text-center p-2 bg-muted rounded">
                <div className="text-xl font-bold">{performance.totalEvents}</div>
                <div className="text-xs text-muted-foreground">Events Rated</div>
              </div>
            </div>
          )}

          {feedbackHistory && feedbackHistory.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Recent Feedback</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {feedbackHistory.slice(0, 5).map((fb) => {
                    const events = fb.events as { event_name: string; event_date: string } | null;
                    return (
                      <div key={fb.id} className="flex items-start justify-between text-sm border-b pb-2 last:border-0">
                        <div>
                          <div className="font-medium">{events?.event_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {events?.event_date && format(new Date(events.event_date), 'MMM d, yyyy')}
                          </div>
                        </div>
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-3 w-3 ${
                                star <= fb.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
