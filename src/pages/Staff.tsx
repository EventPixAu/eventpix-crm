import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ChevronRight, FileCheck, Mail, MapPin, MoreVertical, Phone, Plus, Search, Send, Trash2, UserCheck, UserCircle, UserPlus, Users, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStaff, useCreateStaff, useDeleteStaff, useProfiles, useStaffDirectory, Staff as StaffType } from '@/hooks/useStaff';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useActiveLocations } from '@/hooks/useAdminLookups';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StaffComplianceOverview } from '@/components/StaffComplianceOverview';
import { StaffBulkActions } from '@/components/StaffBulkActions';
import { ONBOARDING_STATUS_CONFIG, type OnboardingStatus } from '@/hooks/useCompliance';
import { InviteStaffToAccountDialog } from '@/components/InviteStaffToAccountDialog';

// Unified team member type that works for both profiles and legacy staff
interface UnifiedTeamMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  role: 'photographer' | 'videographer' | 'assistant';
  status: 'active' | 'inactive';
  user_id: string | null;
  source: 'profile' | 'staff';
  // Legacy Staff fields for StaffBulkActions compatibility
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function Staff() {
  const { isAdmin } = useAuth();
  const { data: staff = [], isLoading: staffLoading } = useStaff();
  const { data: profiles = [], isLoading: profilesLoading } = useProfiles();
  const { data: locations = [] } = useActiveLocations();
  const { data: userRolesMap = new Map<string, string>() } = useQuery({
    queryKey: ['user-roles-map'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('user_id, role');
      if (error) throw error;
      return new Map((data || []).map(r => [r.user_id, r.role]));
    },
  });
  const createStaff = useCreateStaff();
  const deleteStaff = useDeleteStaff();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [memberToDelete, setMemberToDelete] = useState<UnifiedTeamMember | null>(null);
  const isLoading = staffLoading || profilesLoading;
  
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [locationFilter, setLocationFilter] = useState('');
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    role: 'photographer' as const,
    status: 'active' as const,
  });

  // Create a map of user_id to profile onboarding_status for quick lookup
  const profileStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    profiles.forEach(profile => {
      if (profile.id && profile.onboarding_status) {
        map.set(profile.id, profile.onboarding_status);
      }
    });
    return map;
  }, [profiles]);

  // Get sorted locations from lookup table
  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) => a.name.localeCompare(b.name));
  }, [locations]);

  // Create unified team member list from profiles and legacy staff
  const unifiedTeamMembers: UnifiedTeamMember[] = useMemo(() => {
    // Build a set of profile IDs for deduplication
    const profileIds = new Set(profiles.map(p => p.id));
    const now = new Date().toISOString();
    
    // Map profiles to unified format
    const profileMembers: UnifiedTeamMember[] = profiles.map(p => ({
      id: p.id,
      name: p.full_name || p.email || 'Unknown',
      email: p.email || '',
      phone: p.phone || null,
      location: p.location || null,
      role: (['photographer', 'videographer', 'assistant'].includes(userRolesMap.get(p.id) || '') ? userRolesMap.get(p.id) : 'photographer') as 'photographer' | 'videographer' | 'assistant',
      status: (p.status === 'inactive' || p.is_active === false ? 'inactive' : 'active') as 'active' | 'inactive',
      user_id: p.id, // Profile ID IS the user ID
      source: 'profile' as const,
      notes: null,
      created_at: p.created_at || now,
      updated_at: p.updated_at || now,
    }));
    
    // Add unlinked staff (those without user_id or user_id not in profiles)
    const unlinkedStaff: UnifiedTeamMember[] = staff
      .filter(s => !s.user_id || !profileIds.has(s.user_id))
      .map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        location: s.location,
        role: s.role,
        status: s.status,
        user_id: s.user_id,
        source: 'staff' as const,
        notes: s.notes,
        created_at: s.created_at,
        updated_at: s.updated_at,
      }));
    
    return [...profileMembers, ...unlinkedStaff].sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  }, [profiles, staff, userRolesMap]);

  const filteredStaff = unifiedTeamMembers.filter((member) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      member.name.toLowerCase().includes(searchLower) ||
      member.email.toLowerCase().includes(searchLower) ||
      (member.phone && member.phone.toLowerCase().includes(searchLower)) ||
      (member.location && member.location.toLowerCase().includes(searchLower));
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
    const matchesLocation = !locationFilter || 
      (member.location && member.location.toLowerCase().includes(locationFilter.toLowerCase()));
    return matchesSearch && matchesRole && matchesStatus && matchesLocation;
  });

  const activeTeamCount = unifiedTeamMembers.filter((member) => member.status === 'active').length;
  const inactiveTeamCount = unifiedTeamMembers.filter((member) => member.status === 'inactive').length;

  const selectedStaff = unifiedTeamMembers.filter(s => selectedIds.has(s.id));

  const handleSelectAll = () => {
    if (selectedIds.size === filteredStaff.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStaff.map(s => s.id)));
    }
  };

  const handleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;
    try {
      if (memberToDelete.source === 'staff') {
        await deleteStaff.mutateAsync(memberToDelete.id);
      } else {
        // Profile-based: delete from staff table if there's a matching record, then deactivate profile
        const { error } = await supabase
          .from('profiles')
          .update({ is_active: false, status: 'inactive' })
          .eq('id', memberToDelete.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['profiles'] });
        queryClient.invalidateQueries({ queryKey: ['staff-directory'] });
        toast({ title: 'Team member deactivated' });
      }
      setMemberToDelete(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to remove', description: err.message });
    }
  };

  const handleReactivateMember = async (member: UnifiedTeamMember) => {
    try {
      if (member.source === 'staff') {
        const { error } = await supabase
          .from('staff')
          .update({ status: 'active' })
          .eq('id', member.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['staff'] });
      } else {
        const { error } = await supabase
          .from('profiles')
          .update({ is_active: true, status: 'active' })
          .eq('id', member.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['profiles'] });
        queryClient.invalidateQueries({ queryKey: ['staff-directory'] });
      }
      toast({ title: 'Team member reactivated' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to reactivate', description: err.message });
    }
  };

  const handleCreateStaff = async () => {
    if (!newStaff.name || !newStaff.email) {
      toast({ variant: 'destructive', title: 'Name and email are required' });
      return;
    }
    
    await createStaff.mutateAsync({
      ...newStaff,
      user_id: null,
      notes: null,
      phone: newStaff.phone || null,
      location: newStaff.location || null,
    });
    
    setDialogOpen(false);
    setNewStaff({
      name: '',
      email: '',
      phone: '',
      location: '',
      role: 'photographer',
      status: 'active',
    });
  };

  return (
    <AppLayout>
      <PageHeader
        title="Team"
        description={`${activeTeamCount} active team members${inactiveTeamCount ? ` • ${inactiveTeamCount} inactive` : ''}`}
        actions={
          isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary hover:opacity-90">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Team Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={newStaff.name}
                      onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                      placeholder="Full name"
                      className="bg-secondary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newStaff.email}
                      onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                      placeholder="email@example.com"
                      className="bg-secondary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      type="tel"
                      value={newStaff.phone}
                      onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                      placeholder="Phone number"
                      className="bg-secondary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Select
                      value={newStaff.location}
                      onValueChange={(value) => setNewStaff({ ...newStaff, location: value })}
                    >
                      <SelectTrigger className="bg-secondary">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedLocations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.name}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={newStaff.role}
                      onValueChange={(value: any) => setNewStaff({ ...newStaff, role: value })}
                    >
                      <SelectTrigger className="bg-secondary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="photographer">Photographer</SelectItem>
                        <SelectItem value="videographer">Videographer</SelectItem>
                        <SelectItem value="assistant">Assistant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleCreateStaff}
                    className="w-full bg-gradient-primary"
                    disabled={createStaff.isPending}
                  >
                    {createStaff.isPending ? 'Adding...' : 'Add Team Member'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <Tabs defaultValue="directory" className="space-y-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="directory" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Directory
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="compliance" className="flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Compliance
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="directory" className="space-y-6">
          {/* Bulk Actions Bar */}
          {isAdmin && (
            <StaffBulkActions 
              selectedStaff={selectedStaff} 
              onClearSelection={handleClearSelection} 
            />
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            {isAdmin && filteredStaff.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === filteredStaff.length && filteredStaff.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">Select all</span>
              </div>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search team..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card border-border"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-40 bg-card border-border">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="photographer">Photographer</SelectItem>
                <SelectItem value="videographer">Videographer</SelectItem>
                <SelectItem value="assistant">Assistant</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'active' | 'inactive' | 'all')}>
              <SelectTrigger className="w-full sm:w-40 bg-card border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="all">All Statuses</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Location Filter */}
            <Popover open={locationPopoverOpen} onOpenChange={setLocationPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={locationPopoverOpen}
                  className="w-full sm:w-48 justify-between bg-card border-border"
                >
                  {locationFilter ? (
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {locationFilter}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      All Locations
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search location..." />
                  <CommandList>
                    <CommandEmpty>No location found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value=""
                        onSelect={() => {
                          setLocationFilter('');
                          setLocationPopoverOpen(false);
                        }}
                      >
                        All Locations
                      </CommandItem>
                      {sortedLocations.map((loc) => (
                        <CommandItem
                          key={loc.id}
                          value={loc.name}
                          onSelect={() => {
                            setLocationFilter(loc.name);
                            setLocationPopoverOpen(false);
                          }}
                        >
                          {loc.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            
            {locationFilter && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocationFilter('')}
                className="h-10 w-10"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Team Grid */}
          {isLoading ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              Loading team...
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <UserCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No team members found</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaff.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div
                    className={`bg-card border rounded-xl p-5 shadow-card hover:border-primary/50 hover:shadow-lg transition-all ${
                      selectedIds.has(member.id) ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {isAdmin && (
                        <Checkbox
                          checked={selectedIds.has(member.id)}
                          onCheckedChange={() => handleSelect(member.id)}
                          className="mt-1"
                        />
                      )}
                      <Link
                        to={`/staff/${member.user_id || member.id}`}
                        className="flex items-start gap-4 flex-1 min-w-0"
                      >
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-medium text-primary">
                            {member.name[0]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium truncate">{member.name}</h3>
                              <StatusBadge status={member.status} />
                              {(() => {
                                if (!member.user_id) {
                                  // No account linked yet
                                  return (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
                                      Pending
                                    </span>
                                  );
                                }
                                // Has user_id - check their profile onboarding status
                                const onboardingStatus = profileStatusMap.get(member.user_id) as OnboardingStatus | undefined;
                                const config = ONBOARDING_STATUS_CONFIG[onboardingStatus || 'incomplete'] || ONBOARDING_STATUS_CONFIG.incomplete;
                                
                                if (onboardingStatus === 'active') {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                                      <Check className="h-3 w-3" />
                                      Account
                                    </span>
                                  );
                                }
                                // Show their actual onboarding status with variant-based styling
                                const variantStyles = {
                                  default: 'bg-primary/10 text-primary',
                                  secondary: 'bg-muted text-muted-foreground',
                                  destructive: 'bg-destructive/10 text-destructive',
                                  outline: 'bg-background border border-border text-muted-foreground',
                                };
                                return (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantStyles[config.variant]}`}>
                                    {config.label}
                                  </span>
                                );
                              })()}
                            </div>
                            {isAdmin && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {!member.user_id && member.email && (
                                    <InviteStaffToAccountDialog
                                      staff={{ id: member.id, name: member.name, email: member.email, role: member.role }}
                                      trigger={
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                          <UserPlus className="h-4 w-4 mr-2" />
                                          Send Invitation
                                        </DropdownMenuItem>
                                      }
                                    />
                                  )}
                                  {member.user_id && member.email && (() => {
                                    const onboardingStatus = profileStatusMap.get(member.user_id!) as OnboardingStatus | undefined;
                                    return onboardingStatus !== 'active' ? (
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.preventDefault();
                                          supabase.functions.invoke('admin-create-user', {
                                            body: { resend_access_for_user_id: member.user_id, email: member.email },
                                          }).then(({ data, error }) => {
                                            if (error || !data?.success) {
                                              toast({ title: 'Failed to send', description: error?.message || data?.error, variant: 'destructive' });
                                            } else {
                                              toast({ title: 'Access email sent', description: `Password setup email sent to ${member.email}` });
                                            }
                                          });
                                        }}
                                      >
                                        <Send className="h-4 w-4 mr-2" />
                                        Resend Access Email
                                      </DropdownMenuItem>
                                    ) : null;
                                  })()}
                                  {member.status === 'inactive' && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleReactivateMember(member);
                                      }}
                                    >
                                      <UserCheck className="h-4 w-4 mr-2" />
                                      Reactivate
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setMemberToDelete(member);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            {!isAdmin && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                          </div>
                          <p className="text-sm text-muted-foreground capitalize mb-3">
                            {member.role}
                          </p>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                              <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                              {member.email}
                            </div>
                            {member.phone && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                                {member.phone}
                              </div>
                            )}
                            {member.location && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                {member.location}
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="compliance">
            <StaffComplianceOverview />
          </TabsContent>
        )}
      </Tabs>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!memberToDelete} onOpenChange={(open) => !open && setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToDelete?.source === 'staff' ? (
                <>Are you sure you want to remove <strong>{memberToDelete?.name}</strong>? This will permanently delete their record.</>
              ) : (
                <>Are you sure you want to deactivate <strong>{memberToDelete?.name}</strong>? Their account will be marked as inactive and they will no longer appear in the active directory.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {memberToDelete?.source === 'staff' ? 'Delete' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
