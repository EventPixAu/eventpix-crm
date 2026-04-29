import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Loader2, User, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface PendingSkillRequest {
  id: string;
  user_id: string;
  skill_id: string;
  status: string;
  created_at: string;
  skill: {
    id: string;
    name: string;
  };
  profile: {
    id: string;
    full_name: string | null;
    email: string;
  };
}

function usePendingSkillRequests() {
  return useQuery({
    queryKey: ['pending-skill-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_skills')
        .select(`
          id,
          user_id,
          skill_id,
          status,
          created_at,
          skill:skills(id, name),
          profile:profiles!staff_skills_user_id_fkey(id, full_name, email)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as unknown as PendingSkillRequest[];
    },
  });
}

function useReviewSkillRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      skillId, 
      action, 
      reason 
    }: { 
      skillId: string; 
      action: 'approve' | 'reject'; 
      reason?: string;
    }) => {
      const updates: any = {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id,
      };
      
      if (action === 'reject' && reason) {
        updates.rejected_reason = reason;
      }
      
      const { error } = await supabase
        .from('staff_skills')
        .update(updates)
        .eq('id', skillId);
      
      if (error) throw error;
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['pending-skill-requests'] });
      queryClient.invalidateQueries({ queryKey: ['staff-skills'] });
      toast.success(`Skill ${action === 'approve' ? 'approved' : 'rejected'}`);
    },
    onError: (error) => {
      toast.error('Failed to review skill: ' + error.message);
    },
  });
}

export function AdminSkillReviewQueue() {
  const { data: pendingRequests = [], isLoading } = usePendingSkillRequests();
  const reviewMutation = useReviewSkillRequest();
  
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; skillId: string | null }>({
    open: false,
    skillId: null,
  });
  const [rejectReason, setRejectReason] = useState('');
  
  const handleApprove = async (skillId: string) => {
    await reviewMutation.mutateAsync({ skillId, action: 'approve' });
  };
  
  const handleReject = async () => {
    if (!rejectDialog.skillId) return;
    await reviewMutation.mutateAsync({ 
      skillId: rejectDialog.skillId, 
      action: 'reject', 
      reason: rejectReason 
    });
    setRejectDialog({ open: false, skillId: null });
    setRejectReason('');
  };
  
  // Group by user
  const requestsByUser = pendingRequests.reduce((acc, req) => {
    const userId = req.user_id;
    if (!acc[userId]) {
      acc[userId] = {
        profile: req.profile,
        skills: [],
      };
    }
    acc[userId].skills.push(req);
    return acc;
  }, {} as Record<string, { profile: PendingSkillRequest['profile']; skills: PendingSkillRequest[] }>);
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  
  if (pendingRequests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Skill Requests
          </CardTitle>
          <CardDescription>
            Review and approve skill nominations from staff
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Check className="h-12 w-12 mx-auto mb-3 text-primary/50" />
            <p>No pending skill requests</p>
            <p className="text-sm">All nominations have been reviewed</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Skill Requests
            <Badge variant="secondary">{pendingRequests.length}</Badge>
          </CardTitle>
          <CardDescription>
            Review and approve skill nominations from staff
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(requestsByUser).map(([userId, { profile, skills }]) => (
            <div key={userId} className="p-4 rounded-lg border space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{profile?.full_name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {skills.map(skill => (
                  <div 
                    key={skill.id} 
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                  >
                    <span className="text-sm font-medium">{skill.skill?.name}</span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-primary hover:bg-primary/20"
                        onClick={() => handleApprove(skill.id)}
                        disabled={reviewMutation.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive hover:bg-destructive/20"
                        onClick={() => setRejectDialog({ open: true, skillId: skill.id })}
                        disabled={reviewMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      
      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, skillId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Skill Request</DialogTitle>
            <DialogDescription>
              Optionally provide a reason for rejection. This will be recorded in the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Textarea
              id="reject-reason"
              placeholder="e.g., Needs more experience with this equipment"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, skillId: null })}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
