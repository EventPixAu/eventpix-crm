import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Skill {
  id: string;
  name: string;
}

interface StaffSkill {
  id: string;
  skill_id: string;
  status: 'pending' | 'approved' | 'rejected';
  skill?: Skill;
}

interface SkillNominationPanelProps {
  userId?: string;
}

function useAvailableSkills() {
  return useQuery({
    queryKey: ['available-skills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skills')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data as Skill[];
    },
  });
}

function useMySkills(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-skills', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('staff_skills')
        .select(`
          id,
          skill_id,
          status,
          skill:skills(id, name)
        `)
        .eq('user_id', userId);
      
      if (error) throw error;
      return data as unknown as StaffSkill[];
    },
    enabled: !!userId,
  });
}

function useNominateSkill() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, skillId }: { userId: string; skillId: string }) => {
      const { error } = await supabase
        .from('staff_skills')
        .insert({
          user_id: userId,
          skill_id: skillId,
          status: 'pending',
        });
      
      if (error) throw error;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['my-skills', userId] });
      toast.success('Skill nomination submitted for review');
    },
    onError: (error) => {
      toast.error('Failed to nominate skill: ' + error.message);
    },
  });
}

function useRemovePendingSkill() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ skillId, userId }: { skillId: string; userId: string }) => {
      const { error } = await supabase
        .from('staff_skills')
        .delete()
        .eq('id', skillId);
      
      if (error) throw error;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['my-skills', userId] });
      toast.success('Nomination withdrawn');
    },
    onError: (error) => {
      toast.error('Failed to withdraw nomination: ' + error.message);
    },
  });
}

export function SkillNominationPanel({ userId }: SkillNominationPanelProps) {
  const [showNominateForm, setShowNominateForm] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  
  const { data: allSkills = [], isLoading: skillsLoading } = useAvailableSkills();
  const { data: mySkills = [], isLoading: mySkillsLoading } = useMySkills(userId);
  const nominateSkill = useNominateSkill();
  const removePendingSkill = useRemovePendingSkill();
  
  const isLoading = skillsLoading || mySkillsLoading;
  
  // Filter skills by status
  const approvedSkills = mySkills.filter(s => s.status === 'approved');
  const pendingSkills = mySkills.filter(s => s.status === 'pending');
  
  // Skills available to nominate (not already approved or pending)
  const mySkillIds = new Set(mySkills.map(s => s.skill_id));
  const availableToNominate = allSkills.filter(s => !mySkillIds.has(s.id));
  
  const handleNominate = async () => {
    if (!userId || selectedSkills.length === 0) return;
    
    for (const skillId of selectedSkills) {
      await nominateSkill.mutateAsync({ userId, skillId });
    }
    
    setSelectedSkills([]);
    setShowNominateForm(false);
  };
  
  const handleRemovePending = async (skillRecordId: string) => {
    if (!userId) return;
    await removePendingSkill.mutateAsync({ skillId: skillRecordId, userId });
  };
  
  const toggleSkillSelection = (skillId: string) => {
    setSelectedSkills(prev => 
      prev.includes(skillId) 
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    );
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Approved Skills */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-primary" />
            My Approved Skills
          </CardTitle>
          <CardDescription>
            These skills are verified and visible to admins when assigning you to events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {approvedSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No approved skills yet. Nominate skills below and wait for admin approval.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {approvedSkills.map(skill => (
                <Badge key={skill.id} variant="default" className="gap-1">
                  <Check className="h-3 w-3" />
                  {skill.skill?.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Pending Skills */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Pending Review
          </CardTitle>
          <CardDescription>
            Skills you've nominated that are awaiting admin approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No pending nominations
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pendingSkills.map(skill => (
                <Badge key={skill.id} variant="outline" className="gap-1 pr-1">
                  <Clock className="h-3 w-3 text-amber-500" />
                  {skill.skill?.name}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1 hover:bg-destructive/20"
                    onClick={() => handleRemovePending(skill.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Nominate New Skills */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Nominate New Skills
              </CardTitle>
              <CardDescription>
                Select skills you believe you have. These will be reviewed by an admin before becoming active.
              </CardDescription>
            </div>
            {!showNominateForm && availableToNominate.length > 0 && (
              <Button onClick={() => setShowNominateForm(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Skills
              </Button>
            )}
          </div>
        </CardHeader>
        {showNominateForm && (
          <CardContent className="space-y-4">
            {availableToNominate.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                You've already nominated all available skills!
              </p>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {availableToNominate.map(skill => (
                    <div
                      key={skill.id}
                      className="flex items-center space-x-2 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => toggleSkillSelection(skill.id)}
                    >
                      <Checkbox
                        id={`skill-${skill.id}`}
                        checked={selectedSkills.includes(skill.id)}
                        onCheckedChange={() => toggleSkillSelection(skill.id)}
                      />
                      <Label 
                        htmlFor={`skill-${skill.id}`} 
                        className="flex-1 cursor-pointer text-sm"
                      >
                        {skill.name}
                      </Label>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-muted-foreground">
                    {selectedSkills.length} skill{selectedSkills.length !== 1 ? 's' : ''} selected
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowNominateForm(false);
                        setSelectedSkills([]);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleNominate}
                      disabled={selectedSkills.length === 0 || nominateSkill.isPending}
                    >
                      {nominateSkill.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      )}
                      Submit for Review
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
