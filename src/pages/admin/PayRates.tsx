import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Plus, Pencil, Trash2, Info, Car, Wrench } from 'lucide-react';
import { usePayRateCard, useUpsertPayRate, useDeletePayRate, calculatePayFromRateCard, usePayAllowances, useUpsertPayAllowance, useDeletePayAllowance } from '@/hooks/usePayRateCard';
import { useStaffRoles } from '@/hooks/useStaff';

export default function PayRates() {
  const { data: rateCard = [], isLoading } = usePayRateCard();
  const { data: staffRoles = [] } = useStaffRoles();
  const upsertRate = useUpsertPayRate();
  const deleteRate = useDeletePayRate();
  const { data: allowances = [], isLoading: allowancesLoading } = usePayAllowances();
  const upsertAllowance = useUpsertPayAllowance();
  const deleteAllowance = useDeletePayAllowance();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<{
    id?: string;
    staff_role_id: string;
    hourly_rate: number;
    minimum_paid_hours: number;
    notes: string;
  } | null>(null);

  const [allowanceDialogOpen, setAllowanceDialogOpen] = useState(false);
  const [editAllowance, setEditAllowance] = useState<{
    id?: string;
    name: string;
    amount: number;
    unit: string;
    notes: string;
  } | null>(null);

  const usedRoleIds = new Set(rateCard.map(r => r.staff_role_id));
  const availableRoles = staffRoles.filter(r => !usedRoleIds.has(r.id) || editEntry?.staff_role_id === r.id);

  const openAdd = () => {
    setEditEntry({ staff_role_id: '', hourly_rate: 0, minimum_paid_hours: 3, notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (entry: typeof rateCard[number]) => {
    setEditEntry({
      id: entry.id,
      staff_role_id: entry.staff_role_id,
      hourly_rate: entry.hourly_rate,
      minimum_paid_hours: entry.minimum_paid_hours,
      notes: entry.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editEntry || !editEntry.staff_role_id) return;
    upsertRate.mutate(editEntry, { onSuccess: () => setDialogOpen(false) });
  };

  const openAddAllowance = () => {
    setEditAllowance({ name: '', amount: 0, unit: 'flat', notes: '' });
    setAllowanceDialogOpen(true);
  };

  const openEditAllowance = (a: typeof allowances[number]) => {
    setEditAllowance({ id: a.id, name: a.name, amount: a.amount, unit: a.unit, notes: a.notes || '' });
    setAllowanceDialogOpen(true);
  };

  const handleSaveAllowance = () => {
    if (!editAllowance || !editAllowance.name) return;
    upsertAllowance.mutate(editAllowance, { onSuccess: () => setAllowanceDialogOpen(false) });
  };

  // Example calculations for the info section
  const exampleHourlyRate = rateCard.length > 0 ? rateCard[0].hourly_rate : 75;
  const exampleMinHours = rateCard.length > 0 ? rateCard[0].minimum_paid_hours : 3;

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <PageHeader title="Pay Rates" description="Manage global rate card and pay calculation rules" />

        {/* Formula explanation */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-foreground">Pay Calculation Formula</p>
                <p className="text-muted-foreground">
                  Each role has an <strong>hourly rate</strong> and a <strong>minimum paid hours</strong> value.
                  The minimum covers setup, travel, and pack-down time.
                </p>
                <p className="text-muted-foreground">
                  <strong>Example:</strong> If hourly rate = ${exampleHourlyRate} and minimum = {exampleMinHours}hrs:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                  <li>2hr session → paid {exampleMinHours}hrs = <strong>${calculatePayFromRateCard(exampleHourlyRate, exampleMinHours, 2).toFixed(2)}</strong></li>
                  <li>4hr session → paid 4hrs = <strong>${calculatePayFromRateCard(exampleHourlyRate, exampleMinHours, 4).toFixed(2)}</strong></li>
                  <li>8hr session → paid 8hrs = <strong>${calculatePayFromRateCard(exampleHourlyRate, exampleMinHours, 8).toFixed(2)}</strong></li>
                </ul>
                <p className="text-muted-foreground text-xs">
                  Event Series (e.g. LBA) can override this with a fixed per-job rate — configured on the series page.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rate Card Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Global Rate Card
              </CardTitle>
              <CardDescription>Hourly rates per role — applied to all standard events</CardDescription>
            </div>
            <Button onClick={openAdd} size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Add Role Rate
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : rateCard.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                No rates configured yet. Click "Add Role Rate" to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Hourly Rate</TableHead>
                    <TableHead className="text-right">Min Paid Hours</TableHead>
                    <TableHead className="text-right">Min Pay</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rateCard.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.staff_roles?.name || '—'}</TableCell>
                      <TableCell className="text-right">${entry.hourly_rate.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{entry.minimum_paid_hours}hrs</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">
                          ${(entry.hourly_rate * entry.minimum_paid_hours).toFixed(2)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                        {entry.notes || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(entry)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { if (confirm('Remove this rate?')) deleteRate.mutate(entry.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editEntry?.id ? 'Edit Rate' : 'Add Role Rate'}</DialogTitle>
            </DialogHeader>
            {editEntry && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={editEntry.staff_role_id}
                    onValueChange={v => setEditEntry({ ...editEntry, staff_role_id: v })}
                    disabled={!!editEntry.id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hourly Rate ($)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={editEntry.hourly_rate || ''}
                      onChange={e => setEditEntry({ ...editEntry, hourly_rate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Minimum Paid Hours</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={editEntry.minimum_paid_hours || ''}
                      onChange={e => setEditEntry({ ...editEntry, minimum_paid_hours: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      e.g. 3 = first 2hrs are paid as 3hrs (covers travel/setup)
                    </p>
                  </div>
                </div>
                {editEntry.hourly_rate > 0 && (
                  <div className="bg-secondary/50 rounded-lg p-3 text-sm">
                    <p className="text-muted-foreground">
                      Minimum pay: <strong className="text-foreground">
                        ${(editEntry.hourly_rate * editEntry.minimum_paid_hours).toFixed(2)}
                      </strong> ({editEntry.minimum_paid_hours}hrs × ${editEntry.hourly_rate.toFixed(2)})
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={editEntry.notes}
                    onChange={e => setEditEntry({ ...editEntry, notes: e.target.value })}
                    placeholder="e.g. Includes travel allowance..."
                    rows={2}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={upsertRate.isPending || !editEntry?.staff_role_id}>
                {editEntry?.id ? 'Save Changes' : 'Add Rate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
