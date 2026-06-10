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
import { DollarSign, Plus, Pencil, Trash2, Info, Car } from 'lucide-react';
import {
  usePayRateCard, useUpsertPayRate, useDeletePayRate, calculatePayFromRateCard,
  usePayAllowances, useUpsertPayAllowance, useDeletePayAllowance,
  type RateMode,
} from '@/hooks/usePayRateCard';
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
    rate_mode: RateMode;
    hourly_rate: number;
    minimum_paid_hours: number;
    fixed_rate: number;
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
    setEditEntry({ staff_role_id: '', rate_mode: 'hourly', hourly_rate: 0, minimum_paid_hours: 3, fixed_rate: 0, notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (entry: typeof rateCard[number]) => {
    setEditEntry({
      id: entry.id,
      staff_role_id: entry.staff_role_id,
      rate_mode: (entry.rate_mode || 'hourly') as RateMode,
      hourly_rate: entry.hourly_rate ?? 0,
      minimum_paid_hours: entry.minimum_paid_hours ?? 3,
      fixed_rate: entry.fixed_rate ?? 0,
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

  const firstHourly = rateCard.find(r => r.rate_mode === 'hourly' && r.hourly_rate);
  const exampleHourlyRate = firstHourly?.hourly_rate ?? 75;
  const exampleMinHours = firstHourly?.minimum_paid_hours ?? 3;

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <PageHeader title="Pay Rates" description="Manage global rate card and pay calculation rules" />

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-foreground">Rate Modes</p>
                <p className="text-muted-foreground">
                  Each role uses one of two modes:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                  <li><strong>Hourly</strong> — pay = (ceil(session hours) + 1) × hourly rate. The +1hr covers setup, travel, pack-down.</li>
                  <li><strong>Set Rate</strong> — flat amount paid per event regardless of session length (e.g. LBA Stage Photographer = $650).</li>
                </ul>
                <p className="text-muted-foreground">
                  <strong>Hourly example:</strong> ${exampleHourlyRate}/hr →
                  2hr → <strong>${calculatePayFromRateCard(exampleHourlyRate, exampleMinHours as number, 2).toFixed(2)}</strong>,
                  4hr → <strong>${calculatePayFromRateCard(exampleHourlyRate, exampleMinHours as number, 4).toFixed(2)}</strong>,
                  8hr → <strong>${calculatePayFromRateCard(exampleHourlyRate, exampleMinHours as number, 8).toFixed(2)}</strong>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Rate Card
              </CardTitle>
              <CardDescription>One rate per role — choose Hourly or Set Rate per event</CardDescription>
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
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rateCard.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.staff_roles?.name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={entry.rate_mode === 'fixed' ? 'default' : 'outline'}>
                          {entry.rate_mode === 'fixed' ? 'Set Rate' : 'Hourly'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.rate_mode === 'fixed'
                          ? <Badge variant="secondary">${Number(entry.fixed_rate ?? 0).toFixed(2)} / event</Badge>
                          : <>${Number(entry.hourly_rate ?? 0).toFixed(2)} / hr</>
                        }
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
                            disabled={deleteRate.isPending}
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

                <div className="space-y-2">
                  <Label>Rate Mode</Label>
                  <Select
                    value={editEntry.rate_mode}
                    onValueChange={v => setEditEntry({ ...editEntry, rate_mode: v as RateMode })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="fixed">Set Rate (flat per event)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editEntry.rate_mode === 'hourly' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hourly Rate ($)</Label>
                      <Input
                        type="number" min={0} step={0.01}
                        value={editEntry.hourly_rate || ''}
                        onChange={e => setEditEntry({ ...editEntry, hourly_rate: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Minimum Paid Hours</Label>
                      <Input
                        type="number" min={0} step={0.5}
                        value={editEntry.minimum_paid_hours || ''}
                        onChange={e => setEditEntry({ ...editEntry, minimum_paid_hours: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Set Rate Amount ($ per event)</Label>
                    <Input
                      type="number" min={0} step={0.01}
                      value={editEntry.fixed_rate || ''}
                      onChange={e => setEditEntry({ ...editEntry, fixed_rate: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">Flat amount paid per event regardless of session length.</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={editEntry.notes}
                    onChange={e => setEditEntry({ ...editEntry, notes: e.target.value })}
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Allowances & Surcharges
              </CardTitle>
              <CardDescription>Travel, equipment, and other add-on charges (all ex GST)</CardDescription>
            </div>
            <Button onClick={openAddAllowance} size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Add Allowance
            </Button>
          </CardHeader>
          <CardContent>
            {allowancesLoading ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : allowances.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No allowances configured yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Amount (ex GST)</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allowances.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-right">${a.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {a.unit === 'per_hour' ? 'Per Hour' : 'Flat Rate'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                        {a.notes || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEditAllowance(a)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm('Remove this allowance?')) deleteAllowance.mutate(a.id); }} disabled={deleteAllowance.isPending}>
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

        <Dialog open={allowanceDialogOpen} onOpenChange={setAllowanceDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editAllowance?.id ? 'Edit Allowance' : 'Add Allowance'}</DialogTitle>
            </DialogHeader>
            {editAllowance && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editAllowance.name}
                    onChange={e => setEditAllowance({ ...editAllowance, name: e.target.value })}
                    placeholder="e.g. Travel Allowance, Studio Lighting Kit..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount ($ ex GST)</Label>
                    <Input
                      type="number" min={0} step={0.01}
                      value={editAllowance.amount || ''}
                      onChange={e => setEditAllowance({ ...editAllowance, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Charge Type</Label>
                    <Select
                      value={editAllowance.unit}
                      onValueChange={v => setEditAllowance({ ...editAllowance, unit: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat Rate (per assignment)</SelectItem>
                        <SelectItem value="per_hour">Per Hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={editAllowance.notes}
                    onChange={e => setEditAllowance({ ...editAllowance, notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAllowanceDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveAllowance} disabled={upsertAllowance.isPending || !editAllowance?.name}>
                {editAllowance?.id ? 'Save Changes' : 'Add Allowance'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <p className="text-xs text-muted-foreground text-center">All rates are ex GST</p>
      </div>
    </AppLayout>
  );
}
