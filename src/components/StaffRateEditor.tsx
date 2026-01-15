import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { useStaffRatesByUser, useCreateStaffRate, useUpdateStaffRate, useDeleteStaffRate, RateType, StaffRate } from '@/hooks/useStaffRates';
import { format } from 'date-fns';

interface StaffRateEditorProps {
  userId: string;
  userName: string;
}

export function StaffRateEditor({ userId, userName }: StaffRateEditorProps) {
  const { data: rates, isLoading } = useStaffRatesByUser(userId);
  const createRate = useCreateStaffRate();
  const updateRate = useUpdateStaffRate();
  const deleteRate = useDeleteStaffRate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<StaffRate | null>(null);
  const [formData, setFormData] = useState({
    rate_type: 'event' as RateType,
    base_rate: '',
    currency: 'AUD',
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      rate_type: 'event',
      base_rate: '',
      currency: 'AUD',
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: '',
      notes: '',
    });
    setEditingRate(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const rateData = {
      user_id: userId,
      rate_type: formData.rate_type,
      base_rate: parseFloat(formData.base_rate),
      currency: formData.currency,
      effective_from: formData.effective_from,
      effective_to: formData.effective_to || null,
      notes: formData.notes || null,
    };

    if (editingRate) {
      await updateRate.mutateAsync({ id: editingRate.id, ...rateData });
    } else {
      await createRate.mutateAsync(rateData);
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleEdit = (rate: StaffRate) => {
    setEditingRate(rate);
    setFormData({
      rate_type: rate.rate_type,
      base_rate: rate.base_rate.toString(),
      currency: rate.currency,
      effective_from: rate.effective_from,
      effective_to: rate.effective_to || '',
      notes: rate.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this rate?')) {
      await deleteRate.mutateAsync(id);
    }
  };

  const formatRateType = (type: RateType) => {
    switch (type) {
      case 'hourly': return 'Hourly';
      case 'half_day': return 'Half Day';
      case 'full_day': return 'Full Day';
      case 'event': return 'Per Event';
    }
  };

  const isActive = (rate: StaffRate) => {
    const today = new Date().toISOString().split('T')[0];
    return rate.effective_from <= today && (!rate.effective_to || rate.effective_to >= today);
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading rates...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Rates</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add Rate
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRate ? 'Edit Rate' : 'Add Rate'} for {userName}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rate Type</Label>
                  <Select
                    value={formData.rate_type}
                    onValueChange={(v) => setFormData({ ...formData, rate_type: v as RateType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="half_day">Half Day</SelectItem>
                      <SelectItem value="full_day">Full Day</SelectItem>
                      <SelectItem value="event">Per Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Base Rate ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.base_rate}
                    onChange={(e) => setFormData({ ...formData, base_rate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Effective From</Label>
                  <Input
                    type="date"
                    value={formData.effective_from}
                    onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Effective To (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.effective_to}
                    onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Internal notes about this rate..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRate.isPending || updateRate.isPending}>
                  {editingRate ? 'Update' : 'Add'} Rate
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rates && rates.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell>{formatRateType(rate.rate_type)}</TableCell>
                  <TableCell>${rate.base_rate.toFixed(2)}</TableCell>
                  <TableCell>
                    {format(new Date(rate.effective_from), 'dd MMM yyyy')}
                    {rate.effective_to && ` - ${format(new Date(rate.effective_to), 'dd MMM yyyy')}`}
                  </TableCell>
                  <TableCell>
                    {isActive(rate) ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(rate)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(rate.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No rates configured.</p>
        )}
      </CardContent>
    </Card>
  );
}
