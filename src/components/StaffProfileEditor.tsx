import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { supabase } from '@/integrations/supabase/client';
import { useStaffRoles } from '@/hooks/useStaff';
import { toast } from 'sonner';

interface StaffProfile {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  home_city: string | null;
  home_state: string | null;
  status: string | null;
  seniority: string | null;
  travel_ready: boolean | null;
  preferred_start_time: string | null;
  preferred_end_time: string | null;
  notes_internal: string | null;
  default_role_id?: string | null;
  vehicle_registration?: string | null;
  dietary_requirements?: string | null;
  certificates?: string | null;
  assigned_equipment_notes?: string | null;
  location?: string | null;
  location_state?: string | null;
  location_postcode?: string | null;
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
}

interface StaffProfileEditorProps {
  profile: StaffProfile;
  sourceTable?: 'profiles' | 'staff';
  staffId?: string;
}

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const SENIORITY_LEVELS = ['junior', 'mid', 'senior', 'lead'];
const STATUS_OPTIONS = ['active', 'inactive', 'on_leave'];

export function StaffProfileEditor({ profile, sourceTable = 'profiles', staffId }: StaffProfileEditorProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile.full_name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    home_city: profile.home_city || '',
    home_state: profile.home_state || '',
    status: profile.status || 'active',
    seniority: profile.seniority || 'mid',
    travel_ready: profile.travel_ready ?? false,
    preferred_start_time: profile.preferred_start_time || '',
    preferred_end_time: profile.preferred_end_time || '',
    notes_internal: profile.notes_internal || '',
    default_role_id: profile.default_role_id || '',
    vehicle_registration: profile.vehicle_registration || '',
    dietary_requirements: profile.dietary_requirements || '',
    certificates: profile.certificates || '',
    assigned_equipment_notes: profile.assigned_equipment_notes || '',
    location: profile.location || '',
    location_state: profile.location_state || '',
    location_postcode: profile.location_postcode || '',
    business_name: profile.business_name || '',
    abn: profile.abn || '',
    address_line1: profile.address_line1 || '',
    address_line2: profile.address_line2 || '',
    address_city: profile.address_city || '',
    address_state: profile.address_state || '',
    address_postcode: profile.address_postcode || '',
    vehicle_make_model: profile.vehicle_make_model || '',
    pli_details: profile.pli_details || '',
    pli_expiry: profile.pli_expiry || '',
    photography_equipment: profile.photography_equipment || '',
  });

  const queryClient = useQueryClient();
  const { data: roles = [] } = useStaffRoles();

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (sourceTable === 'staff' && staffId) {
        // Update staff table for members without linked accounts
        const { error } = await supabase
          .from('staff')
          .update({
            name: data.full_name || null,
            email: data.email || null,
            phone: data.phone || null,
            status: data.status === 'active' ? 'active' : 'inactive',
            notes: data.notes_internal || null,
            location: data.location || null,
            business_name: data.business_name || null,
            abn: data.abn || null,
            address_line1: data.address_line1 || null,
            address_line2: data.address_line2 || null,
            address_city: data.address_city || null,
            address_state: data.address_state || null,
            address_postcode: data.address_postcode || null,
            vehicle_make_model: data.vehicle_make_model || null,
            vehicle_registration: data.vehicle_registration || null,
            pli_details: data.pli_details || null,
            pli_expiry: data.pli_expiry || null,
            photography_equipment: data.photography_equipment || null,
            dietary_requirements: data.dietary_requirements || null,
            certificates: data.certificates || null,
          })
          .eq('id', staffId);

        if (error) throw error;
      } else {
        // Update profiles table for members with linked accounts
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: data.full_name || null,
            phone: data.phone || null,
            home_city: data.home_city || null,
            home_state: data.home_state || null,
            status: data.status,
            seniority: data.seniority,
            travel_ready: data.travel_ready,
            preferred_start_time: data.preferred_start_time || null,
            preferred_end_time: data.preferred_end_time || null,
            notes_internal: data.notes_internal || null,
            default_role_id: data.default_role_id || null,
            vehicle_registration: data.vehicle_registration || null,
            dietary_requirements: data.dietary_requirements || null,
            certificates: data.certificates || null,
            assigned_equipment_notes: data.assigned_equipment_notes || null,
            location: data.location || null,
            location_state: data.location_state || null,
            location_postcode: data.location_postcode || null,
            business_name: data.business_name || null,
            abn: data.abn || null,
            address_line1: data.address_line1 || null,
            address_line2: data.address_line2 || null,
            address_city: data.address_city || null,
            address_state: data.address_state || null,
            address_postcode: data.address_postcode || null,
            vehicle_make_model: data.vehicle_make_model || null,
            pli_details: data.pli_details || null,
            pli_expiry: data.pli_expiry || null,
            photography_equipment: data.photography_equipment || null,
          })
          .eq('id', profile.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['staff-profile', profile.id] });
      if (staffId) {
        queryClient.invalidateQueries({ queryKey: ['staff-profile', staffId] });
        queryClient.invalidateQueries({ queryKey: ['staff'] });
      }
      queryClient.invalidateQueries({ queryKey: ['staff-profiles'] });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      // Reset form data when opening
      setFormData({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        home_city: profile.home_city || '',
        home_state: profile.home_state || '',
        status: profile.status || 'active',
        seniority: profile.seniority || 'mid',
        travel_ready: profile.travel_ready ?? false,
        preferred_start_time: profile.preferred_start_time || '',
        preferred_end_time: profile.preferred_end_time || '',
        notes_internal: profile.notes_internal || '',
        default_role_id: profile.default_role_id || '',
        vehicle_registration: profile.vehicle_registration || '',
        dietary_requirements: profile.dietary_requirements || '',
        certificates: profile.certificates || '',
        assigned_equipment_notes: profile.assigned_equipment_notes || '',
        location: profile.location || '',
        location_state: profile.location_state || '',
        location_postcode: profile.location_postcode || '',
        business_name: profile.business_name || '',
        abn: profile.abn || '',
        address_line1: profile.address_line1 || '',
        address_line2: profile.address_line2 || '',
        address_city: profile.address_city || '',
        address_state: profile.address_state || '',
        address_postcode: profile.address_postcode || '',
        vehicle_make_model: profile.vehicle_make_model || '',
        pli_details: profile.pli_details || '',
        pli_expiry: profile.pli_expiry || '',
        photography_equipment: profile.photography_equipment || '',
      });
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b">
          <DialogTitle>Edit Team Member Profile</DialogTitle>
          <DialogDescription>
            Update profile information for {profile.full_name || profile.email}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-6 pb-4">
              {sourceTable === 'staff' && (
                <div className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md">
                  This team member does not have a linked user account.
                </div>
              )}

              {/* Personal Info Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email address"
                  disabled={sourceTable !== 'staff'}
                />
                {sourceTable !== 'staff' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Email is managed through the user account
                  </p>
                )}
              </div>

              <div className="col-span-2">
                <Label htmlFor="business_name">Business Name</Label>
                <Input
                  id="business_name"
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  placeholder="Trading or business name"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <Label htmlFor="abn">ABN</Label>
                <Input
                  id="abn"
                  value={formData.abn}
                  onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
                  placeholder="Australian Business Number"
                />
              </div>
            </div>
          </div>

          {/* Location Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Location</h3>
            <div className="space-y-2">
              <Label htmlFor="location">City/Region</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Sydney, Melbourne"
              />
            </div>
          </div>

          {/* Address Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Address</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="address_line1">Address Line 1</Label>
                <Input
                  id="address_line1"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                  placeholder="Street address"
                />
              </div>
              <div>
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input
                  id="address_line2"
                  value={formData.address_line2}
                  onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                  placeholder="Unit, apartment, etc."
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="address_city">City/Suburb</Label>
                  <Input
                    id="address_city"
                    value={formData.address_city}
                    onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="address_state">State</Label>
                  <Select
                    value={formData.address_state}
                    onValueChange={(value) => setFormData({ ...formData, address_state: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="address_postcode">Postcode</Label>
                  <Input
                    id="address_postcode"
                    value={formData.address_postcode}
                    onChange={(e) => setFormData({ ...formData, address_postcode: e.target.value })}
                    placeholder="0000"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Role & Status */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Role & Status</h3>
            <div className="grid grid-cols-2 gap-4">
              {sourceTable !== 'staff' && (
                <div>
                  <Label htmlFor="default_role_id">Default Role</Label>
                  <Select
                    value={formData.default_role_id}
                    onValueChange={(value) => setFormData({ ...formData, default_role_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className={sourceTable === 'staff' ? 'col-span-2' : ''}>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {(sourceTable === 'staff' ? ['active', 'inactive'] : STATUS_OPTIONS).map((status) => (
                      <SelectItem key={status} value={status}>
                        <span className="capitalize">{status.replace('_', ' ')}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Seniority & Travel - profiles only */}
            {sourceTable !== 'staff' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="seniority">Seniority</Label>
                  <Select
                    value={formData.seniority}
                    onValueChange={(value) => setFormData({ ...formData, seniority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select seniority" />
                    </SelectTrigger>
                    <SelectContent>
                      {SENIORITY_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          <span className="capitalize">{level}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between pt-6">
                  <Label htmlFor="travel_ready" className="cursor-pointer">
                    Travel Ready
                  </Label>
                  <Switch
                    id="travel_ready"
                    checked={formData.travel_ready}
                    onCheckedChange={(checked) => setFormData({ ...formData, travel_ready: checked })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Vehicle Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Vehicle Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vehicle_make_model">Make & Model</Label>
                <Input
                  id="vehicle_make_model"
                  value={formData.vehicle_make_model}
                  onChange={(e) => setFormData({ ...formData, vehicle_make_model: e.target.value })}
                  placeholder="e.g. Toyota Camry"
                />
              </div>
              <div>
                <Label htmlFor="vehicle_registration">Registration</Label>
                <Input
                  id="vehicle_registration"
                  value={formData.vehicle_registration}
                  onChange={(e) => setFormData({ ...formData, vehicle_registration: e.target.value })}
                  placeholder="e.g. ABC123"
                />
              </div>
            </div>
          </div>

          {/* Insurance & Compliance */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Insurance & Compliance</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pli_details">PLI Details</Label>
                <Input
                  id="pli_details"
                  value={formData.pli_details}
                  onChange={(e) => setFormData({ ...formData, pli_details: e.target.value })}
                  placeholder="Insurance provider / policy"
                />
              </div>
              <div>
                <Label htmlFor="pli_expiry">PLI Expiry Date</Label>
                <Input
                  id="pli_expiry"
                  type="date"
                  value={formData.pli_expiry}
                  onChange={(e) => setFormData({ ...formData, pli_expiry: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="certificates">Certificates</Label>
              <Textarea
                id="certificates"
                value={formData.certificates}
                onChange={(e) => setFormData({ ...formData, certificates: e.target.value })}
                placeholder="List certifications (e.g., First Aid, RSA, Working with Children)"
                rows={2}
              />
            </div>
          </div>

          {/* Dietary Requirements */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Other</h3>
            <div>
              <Label htmlFor="dietary_requirements">Dietary Requirements</Label>
              <Input
                id="dietary_requirements"
                value={formData.dietary_requirements}
                onChange={(e) => setFormData({ ...formData, dietary_requirements: e.target.value })}
                placeholder="Any dietary restrictions or requirements"
              />
            </div>
          </div>

          {/* Equipment */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Equipment</h3>
            <div>
              <Label htmlFor="photography_equipment">Photography Equipment</Label>
              <Textarea
                id="photography_equipment"
                value={formData.photography_equipment}
                onChange={(e) => setFormData({ ...formData, photography_equipment: e.target.value })}
                placeholder="List cameras, lenses, lighting, etc."
                rows={3}
              />
            </div>
          </div>

          {/* Internal Notes */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Internal Notes</h3>
            <div>
              <Label htmlFor="notes_internal">Notes</Label>
              <Textarea
                id="notes_internal"
                value={formData.notes_internal}
                onChange={(e) => setFormData({ ...formData, notes_internal: e.target.value })}
                placeholder="Internal notes about this team member..."
                rows={3}
              />
            </div>
          </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 px-6 py-4 border-t bg-background flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={updateMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
