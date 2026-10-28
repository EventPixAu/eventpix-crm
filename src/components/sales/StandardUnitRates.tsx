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
  const [saving, setSaving] = useState(false);
  if (!product) return null;
  const save = async () => {
    const clientRate = Number(client);
    if (!Number.isFinite(clientRate) || clientRate <= 0) {
      toast.error('Enter a positive client unit rate'); return;
    }
    setSaving(true);
    const { error } = await supabase.from('products').update({ unit_price: clientRate }).eq('id', product.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ['products'] });
    toast.success('Client unit rate saved'); setOpen(false);
  };
  return <section className="border-b border-border pb-4 flex flex-wrap items-center gap-4">
    <h2 className="font-semibold">Standard client unit rate</h2>
    <span className="text-sm">Client (ex GST): <strong>${Number(product.unit_price).toFixed(2)}</strong></span>
    {isAdmin && <Button variant="outline" size="sm" onClick={() => {
      setClient(String(product.unit_price)); setOpen(true);
    }}><Pencil className="h-3.5 w-3.5 mr-2" />Edit client rate</Button>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent>
      <DialogHeader><DialogTitle>Client unit rate — new budgets</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label htmlFor="client-unit-rate">Client unit rate (ex GST)</Label><Input id="client-unit-rate" type="number" min="0.01" step="0.01" value={client} onChange={e => setClient(e.target.value)} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving} onClick={save}>Save rate</Button></DialogFooter>
    </DialogContent></Dialog>
  </section>;
}