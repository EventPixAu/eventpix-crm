import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

export function StandardUnitRates({ isAdmin }: { isAdmin: boolean }) {
  const { data: products = [] } = useProducts();
  const product = products.find(p => p.id === '22222222-0001-0001-0001-000000000004');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState('');
  const [photographer, setPhotographer] = useState('');
  const [saving, setSaving] = useState(false);
  if (!product) return null;
  const photographerRate = Number(product.photographer_unit_rate ?? 0);
  const save = async () => {
    const clientRate = Number(client), teamRate = Number(photographer);
    if (!Number.isFinite(clientRate) || !Number.isFinite(teamRate) || clientRate <= 0 || teamRate <= 0) {
      toast.error('Enter positive unit rates'); return;
    }
    setSaving(true);
    const { error } = await supabase.from('products').update({ unit_price: clientRate, photographer_unit_rate: teamRate }).eq('id', product.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['pay-rate-card'] });
    toast.success('Standard unit rates saved'); setOpen(false);
  };
  return <section className="border-b border-border pb-4 flex flex-wrap items-center gap-4">
    <h2 className="font-semibold">Standard unit rates</h2>
    <span className="text-sm">Client (ex GST): <strong>${Number(product.unit_price).toFixed(2)}</strong></span>
    <span className="text-sm">Photographer: <strong>${photographerRate.toFixed(2)}</strong></span>
    {isAdmin && <Button variant="outline" size="sm" onClick={() => {
      setClient(String(product.unit_price)); setPhotographer(String(photographerRate)); setOpen(true);
    }}><Pencil className="h-3.5 w-3.5 mr-2" />Edit unit rates</Button>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent>
      <DialogHeader><DialogTitle>Standard unit rates — new work</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label htmlFor="client-unit-rate">Client unit rate (ex GST)</Label><Input id="client-unit-rate" type="number" min="0.01" step="0.01" value={client} onChange={e => setClient(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="photographer-unit-rate">Photographer unit rate</Label><Input id="photographer-unit-rate" type="number" min="0.01" step="0.01" value={photographer} onChange={e => setPhotographer(e.target.value)} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving} onClick={save}>Save rates</Button></DialogFooter>
    </DialogContent></Dialog>
  </section>;
}