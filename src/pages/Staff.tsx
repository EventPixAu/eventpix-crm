import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, FileCheck, Mail, MapPin, Phone, Plus, Search, UserCircle, Users, X } from 'lucide-react';
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
import { useStaff, useCreateStaff, Staff as StaffType } from '@/hooks/useStaff';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { StaffComplianceOverview } from '@/components/StaffComplianceOverview';
import { StaffBulkActions } from '@/components/StaffBulkActions';

export default function Staff() {
  const { isAdmin } = useAuth();
  const { data: staff = [], isLoading } = useStaff();
  const createStaff = useCreateStaff();
  const { toast } = useToast();
  
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
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

  // Get unique locations for filter dropdown
  const uniqueLocations = useMemo(() => {
    const locations = staff
      .map(m => m.location)
      .filter((loc): loc is string => !!loc && loc.trim() !== '');
    return [...new Set(locations)].sort();
  }, [staff]);

  const filteredStaff = staff.filter((member) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      member.name.toLowerCase().includes(searchLower) ||
      member.email.toLowerCase().includes(searchLower) ||
      (member.phone && member.phone.toLowerCase().includes(searchLower)) ||
      (member.location && member.location.toLowerCase().includes(searchLower));
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    const matchesLocation = !locationFilter || 
      (member.location && member.location.toLowerCase().includes(locationFilter.toLowerCase()));
    return matchesSearch && matchesRole && matchesLocation;
  });

  const selectedStaff = staff.filter(s => selectedIds.has(s.id));

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
        description={`${staff.length} team members`}
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
                    <Input
                      value={newStaff.location}
                      onChange={(e) => setNewStaff({ ...newStaff, location: e.target.value })}
                      placeholder="e.g. Sydney, Melbourne"
                      className="bg-secondary"
                    />
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
                      {uniqueLocations.map((loc) => (
                        <CommandItem
                          key={loc}
                          value={loc}
                          onSelect={() => {
                            setLocationFilter(loc);
                            setLocationPopoverOpen(false);
                          }}
                        >
                          {loc}
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
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium truncate">{member.name}</h3>
                              <StatusBadge status={member.status} />
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
    </AppLayout>
  );
}
