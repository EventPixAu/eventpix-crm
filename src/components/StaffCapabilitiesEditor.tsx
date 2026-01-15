import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useSkills, useStaffSkills, useUpdateStaffSkills, useUpdateStaffCapabilities, StaffCapabilities } from '@/hooks/useStaffCapabilities';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';

interface StaffCapabilitiesEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  initialCapabilities?: Partial<StaffCapabilities>;
  userName?: string;
}

const STATES = [
  'ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'
];

export function StaffCapabilitiesEditor({
  open,
  onOpenChange,
  userId,
  initialCapabilities,
  userName,
}: StaffCapabilitiesEditorProps) {
  const [capabilities, setCapabilities] = useState<Partial<StaffCapabilities>>({
    home_city: '',
    home_state: '',
    travel_ready: false,
    preferred_start_time: null,
    preferred_end_time: null,
    notes_internal: '',
    seniority: 'mid',
    ...initialCapabilities,
  });
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  
  const { data: skills, isLoading: skillsLoading } = useSkills();
  const { data: staffSkills, isLoading: staffSkillsLoading } = useStaffSkills(userId);
  const updateSkillsMutation = useUpdateStaffSkills();
  const updateCapabilitiesMutation = useUpdateStaffCapabilities();
  
  // Initialize selected skills from staff skills
  useEffect(() => {
    if (staffSkills) {
      setSelectedSkillIds(staffSkills.map(ss => ss.skill_id));
    }
  }, [staffSkills]);
  
  // Reset capabilities when dialog opens with new data
  useEffect(() => {
    if (open && initialCapabilities) {
      setCapabilities({
        home_city: initialCapabilities.home_city || '',
        home_state: initialCapabilities.home_state || '',
        travel_ready: initialCapabilities.travel_ready || false,
        preferred_start_time: initialCapabilities.preferred_start_time || null,
        preferred_end_time: initialCapabilities.preferred_end_time || null,
        notes_internal: initialCapabilities.notes_internal || '',
        seniority: initialCapabilities.seniority || 'mid',
      });
    }
  }, [open, initialCapabilities]);
  
  const handleSave = async () => {
    try {
      await Promise.all([
        updateCapabilitiesMutation.mutateAsync({ userId, capabilities }),
        updateSkillsMutation.mutateAsync({ userId, skillIds: selectedSkillIds }),
      ]);
      
      toast.success('Staff capabilities updated');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to update capabilities');
    }
  };
  
  const toggleSkill = (skillId: string) => {
    setSelectedSkillIds(prev => 
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    );
  };
  
  const isLoading = skillsLoading || staffSkillsLoading;
  const isSaving = updateSkillsMutation.isPending || updateCapabilitiesMutation.isPending;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {userName ? `Edit ${userName}'s Capabilities` : 'Edit Staff Capabilities'}
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Home City</Label>
                <Input
                  value={capabilities.home_city || ''}
                  onChange={(e) => setCapabilities({ ...capabilities, home_city: e.target.value })}
                  placeholder="e.g., Brisbane"
                />
              </div>
              <div className="space-y-2">
                <Label>Home State</Label>
                <Select
                  value={capabilities.home_state || ''}
                  onValueChange={(value) => setCapabilities({ ...capabilities, home_state: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Travel Ready */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="travel-ready"
                checked={capabilities.travel_ready || false}
                onCheckedChange={(checked) => setCapabilities({ ...capabilities, travel_ready: !!checked })}
              />
              <Label htmlFor="travel-ready">Travel ready (willing to travel interstate)</Label>
            </div>
            
            {/* Seniority */}
            <div className="space-y-2">
              <Label>Seniority Level</Label>
              <Select
                value={capabilities.seniority || 'mid'}
                onValueChange={(value) => setCapabilities({ ...capabilities, seniority: value as 'lead' | 'mid' | 'junior' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="mid">Mid</SelectItem>
                  <SelectItem value="junior">Junior</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Preferred Times */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preferred Start Time</Label>
                <Input
                  type="time"
                  value={capabilities.preferred_start_time || ''}
                  onChange={(e) => setCapabilities({ ...capabilities, preferred_start_time: e.target.value || null })}
                />
              </div>
              <div className="space-y-2">
                <Label>Preferred End Time</Label>
                <Input
                  type="time"
                  value={capabilities.preferred_end_time || ''}
                  onChange={(e) => setCapabilities({ ...capabilities, preferred_end_time: e.target.value || null })}
                />
              </div>
            </div>
            
            {/* Skills */}
            <div className="space-y-2">
              <Label>Skills</Label>
              <div className="flex flex-wrap gap-2">
                {skills?.map((skill) => {
                  const isSelected = selectedSkillIds.includes(skill.id);
                  return (
                    <Badge
                      key={skill.id}
                      variant={isSelected ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleSkill(skill.id)}
                    >
                      {skill.name}
                      {isSelected && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  );
                })}
              </div>
            </div>
            
            {/* Internal Notes */}
            <div className="space-y-2">
              <Label>Internal Notes</Label>
              <Textarea
                value={capabilities.notes_internal || ''}
                onChange={(e) => setCapabilities({ ...capabilities, notes_internal: e.target.value })}
                placeholder="Notes visible only to admins..."
                rows={3}
              />
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Capabilities'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
