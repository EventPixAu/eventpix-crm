import { useMemo, useState } from 'react';
import { Package, Plus, Trash2, RefreshCw, Boxes, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  useSeriesDefaultEquipment,
  useAddSeriesDefaultEquipment,
  useRemoveSeriesDefaultEquipment,
  useSyncDefaultEquipmentToEvents,
} from '@/hooks/useSeriesDefaultEquipment';
import { useEquipmentItems } from '@/hooks/useEquipment';
import { useActiveEquipmentKits } from '@/hooks/useEquipmentKits';
import { useSeriesEvents } from '@/hooks/useEventSeries';

interface Props { seriesId: string; }

export function SeriesDefaultEquipmentPanel({ seriesId }: Props) {
  const { data: defaults = [], isLoading } = useSeriesDefaultEquipment(seriesId);
  const { data: events = [] } = useSeriesEvents(seriesId);
  const { data: items = [] } = useEquipmentItems();
  const { data: kits = [] } = useActiveEquipmentKits();

  const addDefault = useAddSeriesDefaultEquipment();
  const removeDefault = useRemoveSeriesDefaultEquipment();
  const syncToEvents = useSyncDefaultEquipmentToEvents();

  const [tab, setTab] = useState<'item' | 'kit'>('item');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedKitId, setSelectedKitId] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmSyncOpen, setConfirmSyncOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const assignedItemIds = useMemo(
    () => new Set(defaults.filter(d => d.equipment_item_id).map(d => d.equipment_item_id!)),
    [defaults]
  );
  const assignedKitIds = useMemo(
    () => new Set(defaults.filter(d => d.kit_id).map(d => d.kit_id!)),
    [defaults]
  );

  const availableItems = useMemo(
    () => items.filter(i => !assignedItemIds.has(i.id)),
    [items, assignedItemIds]
  );
  const availableKits = useMemo(
    () => kits.filter(k => !assignedKitIds.has(k.id)),
    [kits, assignedKitIds]
  );

  const upcomingEventCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return events.filter(e => e.event_date >= today).length;
  }, [events]);

  const handleAdd = () => {
    if (tab === 'item' && !selectedItemId) return;
    if (tab === 'kit' && !selectedKitId) return;

    addDefault.mutate(
      {
        series_id: seriesId,
        equipment_item_id: tab === 'item' ? selectedItemId : null,
        kit_id: tab === 'kit' ? selectedKitId : null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          setSelectedItemId('');
          setSelectedKitId('');
          setNotes('');
        },
      }
    );
  };

  const handleSync = () => {
    const today = new Date().toISOString().split('T')[0];
    const upcomingIds = events.filter(e => e.event_date >= today).map(e => e.id);
    syncToEvents.mutate({ series_id: seriesId, event_ids: upcomingIds, defaults });
    setConfirmSyncOpen(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Default Equipment
          </CardTitle>
          <CardDescription>
            Equipment added here will be allocated to events in this series when you sync.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'item' | 'kit')}>
            <TabsList>
              <TabsTrigger value="item" className="flex items-center gap-2">
                <Package className="h-4 w-4" /> Individual Item
              </TabsTrigger>
              <TabsTrigger value="kit" className="flex items-center gap-2">
                <Boxes className="h-4 w-4" /> Kit
              </TabsTrigger>
            </TabsList>

            <TabsContent value="item" className="pt-4">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1.5 block">Equipment Item</label>
                  <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableItems.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                          {item.brand ? ` — ${item.brand}` : ''}
                          {item.category ? ` (${item.category})` : ''}
                        </SelectItem>
                      ))}
                      {availableItems.length === 0 && (
                        <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                          No available items
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-64">
                  <label className="text-sm font-medium mb-1.5 block">Notes (optional)</label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
                </div>
                <Button onClick={handleAdd} disabled={!selectedItemId || addDefault.isPending}>
                  {addDefault.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Add
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="kit" className="pt-4">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1.5 block">Equipment Kit</label>
                  <Select value={selectedKitId} onValueChange={setSelectedKitId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a kit..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableKits.map(kit => (
                        <SelectItem key={kit.id} value={kit.id}>
                          {kit.name}
                        </SelectItem>
                      ))}
                      {availableKits.length === 0 && (
                        <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                          No available kits
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-64">
                  <label className="text-sm font-medium mb-1.5 block">Notes (optional)</label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
                </div>
                <Button onClick={handleAdd} disabled={!selectedKitId || addDefault.isPending}>
                  {addDefault.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Add
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Default Equipment
            </CardTitle>
            <CardDescription>
              {defaults.length} entr{defaults.length === 1 ? 'y' : 'ies'} configured
            </CardDescription>
          </div>
          {defaults.length > 0 && upcomingEventCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmSyncOpen(true)}
              disabled={syncToEvents.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync to {upcomingEventCount} Event{upcomingEventCount !== 1 ? 's' : ''}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : defaults.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No default equipment configured</p>
              <p className="text-sm mt-1">Add items or kits above to allocate them to events in this series</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defaults.map(d => (
                  <TableRow key={d.id}>
                    <TableCell>
                      {d.kit_id ? (
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <Boxes className="h-3 w-3" /> Kit
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Package className="h-3 w-3" /> Item
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {d.kit?.name || d.equipment_item?.name || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.equipment_item
                        ? [d.equipment_item.brand, d.equipment_item.model, d.equipment_item.category]
                            .filter(Boolean)
                            .join(' · ')
                        : d.kit?.description || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.notes || '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRemoveId(d.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <div className="bg-primary/10 rounded-lg p-2 h-fit">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium mb-1">How default equipment works</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Items and kits listed here define the standard equipment for events in this series</li>
                <li>• Use "Sync to Events" to allocate to all upcoming events in this series</li>
                <li>• Already-allocated items are skipped automatically</li>
                <li>• Individual event allocations can still be adjusted on each event</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmSyncOpen} onOpenChange={setConfirmSyncOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sync Default Equipment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will allocate the {defaults.length} default equipment entr{defaults.length === 1 ? 'y' : 'ies'} to {upcomingEventCount} upcoming event{upcomingEventCount !== 1 ? 's' : ''}.
              <br /><br />
              Items already allocated to an event will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSync}>Sync Equipment</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeId} onOpenChange={() => setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Default Equipment?</AlertDialogTitle>
            <AlertDialogDescription>
              This entry will no longer be part of the series defaults. Existing event allocations are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeId && removeDefault.mutate({ id: removeId, series_id: seriesId }, { onSettled: () => setRemoveId(null) })}
              disabled={removeDefault.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeDefault.isPending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
