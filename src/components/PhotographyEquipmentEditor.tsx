/**
 * PhotographyEquipmentEditor - Kit-based equipment form for photographers
 * 
 * Keeps the familiar category accordion (Camera, Lighting, Backdrop, Other)
 * but allows multiple named kits per category (e.g. Lighting Kit 1, Lighting Kit 2).
 */

import { useState, useEffect } from 'react';
import { Plus, Trash2, Camera, Aperture, Lightbulb, Image, Mic, Loader2, Save, Pencil } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// --- Shared types ---

export interface EquipmentItem {
  id: string;
  name: string;
  brand: string;
  notes: string;
}

/** Legacy flat format */
export interface PhotographyEquipment {
  camera: EquipmentItem[];
  lighting: EquipmentItem[];
  audio: EquipmentItem[];
  backdrop: EquipmentItem[];
  other: EquipmentItem[];
}

export type KitCategory = 'camera' | 'lighting' | 'audio' | 'backdrop' | 'other';

export interface EquipmentKit {
  id: string;
  name: string;
  category: KitCategory;
  items: EquipmentItem[];
}

export interface PhotographyEquipmentV2 {
  version: 2;
  kits: EquipmentKit[];
}

export type StoredEquipment = PhotographyEquipment | PhotographyEquipmentV2;

export const CATEGORY_CONFIG = [
  { key: 'camera' as const, label: 'Camera Kit', icon: Camera, placeholder: 'e.g., Canon EOS R5, RF 24-70mm f/2.8L' },
  { key: 'lighting' as const, label: 'Lighting Kit', icon: Lightbulb, placeholder: 'e.g., Godox AD600 Pro, Softbox' },
  { key: 'audio' as const, label: 'Audio Kit', icon: Mic, placeholder: 'e.g., RØDE Wireless Pro, Sennheiser MKH 416' },
  { key: 'backdrop' as const, label: 'Backdrop Kit', icon: Image, placeholder: 'e.g., Grey Muslin 3x6m, C-Stand' },
  { key: 'other' as const, label: 'Other', icon: Aperture, placeholder: 'e.g., Memory cards, Batteries' },
] as const;

function generateId(): string {
  return crypto.randomUUID?.() || Date.now().toString() + Math.random().toString(36).slice(2);
}

/** Convert legacy flat format → V2 kits */
export function migrateToV2(data: StoredEquipment): PhotographyEquipmentV2 {
  if ('version' in data && data.version === 2) return data as PhotographyEquipmentV2;

  const legacy = data as PhotographyEquipment;
  const normalized: PhotographyEquipment = {
    camera: legacy.camera || (legacy as any).cameras || [],
    lighting: legacy.lighting || (legacy as any).lights || [],
    audio: (legacy as any).audio || [],
    backdrop: legacy.backdrop || (legacy as any).backdrops || [],
    other: legacy.other || (legacy as any).lenses || [],
  };

  const kits: EquipmentKit[] = [];
  for (const cfg of CATEGORY_CONFIG) {
    const items = normalized[cfg.key] || [];
    if (items.length > 0) {
      kits.push({ id: generateId(), name: cfg.label, category: cfg.key, items });
    }
  }

  return { version: 2, kits };
}

// --- Props ---

interface PhotographyEquipmentEditorProps {
  initialData?: StoredEquipment | null;
  onChange?: (data: PhotographyEquipmentV2) => void;
  onSave?: (data: PhotographyEquipmentV2) => Promise<void>;
  isSaving?: boolean;
  readOnly?: boolean;
}

// --- Component ---

export function PhotographyEquipmentEditor({
  initialData,
  onChange,
  onSave,
  isSaving = false,
  readOnly = false,
}: PhotographyEquipmentEditorProps) {
  const [data, setData] = useState<PhotographyEquipmentV2>({ version: 2, kits: [] });
  const [hasChanges, setHasChanges] = useState(false);

  // Rename kit dialog
  const [renameKitId, setRenameKitId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');

  useEffect(() => {
    if (initialData) {
      setData(migrateToV2(initialData));
    }
  }, [initialData]);

  const update = (newData: PhotographyEquipmentV2) => {
    setData(newData);
    setHasChanges(true);
    onChange?.(newData);
  };

  const kitsForCategory = (cat: KitCategory) => data.kits.filter(k => k.category === cat);

  const addKit = (cat: KitCategory) => {
    const existing = kitsForCategory(cat);
    const cfg = CATEGORY_CONFIG.find(c => c.key === cat)!;
    const name = existing.length === 0 ? cfg.label : `${cfg.label} ${existing.length + 1}`;
    update({
      ...data,
      kits: [...data.kits, { id: generateId(), name, category: cat, items: [] }],
    });
  };

  const removeKit = (kitId: string) => {
    update({ ...data, kits: data.kits.filter(k => k.id !== kitId) });
  };

  const openRenameKit = (kit: EquipmentKit) => {
    setRenameKitId(kit.id);
    setRenameName(kit.name);
  };

  const saveRename = () => {
    if (!renameKitId || !renameName.trim()) return;
    update({
      ...data,
      kits: data.kits.map(k => k.id === renameKitId ? { ...k, name: renameName.trim() } : k),
    });
    setRenameKitId(null);
  };

  const addItem = (kitId: string) => {
    const newItem: EquipmentItem = { id: generateId(), name: '', brand: '', notes: '' };
    update({
      ...data,
      kits: data.kits.map(k => k.id === kitId ? { ...k, items: [...k.items, newItem] } : k),
    });
  };

  const updateItem = (kitId: string, itemId: string, field: keyof EquipmentItem, value: string) => {
    update({
      ...data,
      kits: data.kits.map(k =>
        k.id === kitId
          ? { ...k, items: k.items.map(i => i.id === itemId ? { ...i, [field]: value } : i) }
          : k
      ),
    });
  };

  const removeItem = (kitId: string, itemId: string) => {
    update({
      ...data,
      kits: data.kits.map(k =>
        k.id === kitId ? { ...k, items: k.items.filter(i => i.id !== itemId) } : k
      ),
    });
  };

  const handleSave = async () => {
    if (onSave) {
      await onSave(data);
      setHasChanges(false);
    }
  };

  const totalItems = data.kits.reduce((sum, k) => sum + k.items.length, 0);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Photography Equipment
              </CardTitle>
              <CardDescription>
                {readOnly
                  ? 'Your registered photography gear'
                  : 'Add details about your cameras, lenses, lights, and backdrops'}
              </CardDescription>
            </div>
            {totalItems > 0 && (
              <span className="text-sm text-muted-foreground">
                {totalItems} item{totalItems !== 1 && 's'}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Accordion type="multiple" defaultValue={['camera', 'lighting']} className="space-y-2">
            {CATEGORY_CONFIG.map(({ key, label, icon: Icon, placeholder }) => {
              const kits = kitsForCategory(key);
              const totalCatItems = kits.reduce((s, k) => s + k.items.length, 0);

              return (
                <AccordionItem key={key} value={key} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{label}</span>
                      {totalCatItems > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({totalCatItems})
                        </span>
                      )}
                      {kits.length > 1 && (
                        <span className="text-xs text-muted-foreground">
                          · {kits.length} kits
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4 space-y-4">
                    {kits.length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground py-2">
                          No {label.toLowerCase()} added yet
                        </p>
                        {!readOnly && (
                          <Button variant="outline" size="sm" className="w-full" onClick={() => addKit(key)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add {label}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        {kits.map((kit, kitIdx) => (
                          <div key={kit.id} className="space-y-3">
                            {/* Kit header - only show if multiple kits in this category */}
                            {kits.length > 1 && (
                              <div className="flex items-center gap-2 pt-1">
                                <span className="text-sm font-medium">{kit.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({kit.items.length} item{kit.items.length !== 1 && 's'})
                                </span>
                                {!readOnly && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => openRenameKit(kit)}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                                      onClick={() => removeKit(kit.id)}
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Remove
                                    </Button>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Items */}
                            {kit.items.length === 0 && kits.length <= 1 ? (
                              <p className="text-sm text-muted-foreground py-2">
                                No {label.toLowerCase()} added yet
                              </p>
                            ) : (
                              kit.items.map(item => (
                                <div key={item.id} className="grid gap-3 p-3 bg-muted/30 rounded-lg relative">
                                  {!readOnly && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="absolute top-2 right-2 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => removeItem(kit.id, item.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <div className="grid sm:grid-cols-2 gap-3 pr-8">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Name / Model</Label>
                                      <Input
                                        placeholder={placeholder}
                                        value={item.name}
                                        onChange={e => updateItem(kit.id, item.id, 'name', e.target.value)}
                                        disabled={readOnly}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Brand</Label>
                                      <Input
                                        placeholder="e.g., Canon, Sony, Nikon"
                                        value={item.brand}
                                        onChange={e => updateItem(kit.id, item.id, 'brand', e.target.value)}
                                        disabled={readOnly}
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Notes (optional)</Label>
                                    <Input
                                      placeholder="Any additional details..."
                                      value={item.notes}
                                      onChange={e => updateItem(kit.id, item.id, 'notes', e.target.value)}
                                      disabled={readOnly}
                                    />
                                  </div>
                                </div>
                              ))
                            )}

                            {!readOnly && (
                              <Button variant="outline" size="sm" className="w-full" onClick={() => addItem(kit.id)}>
                                <Plus className="h-4 w-4 mr-1" />
                                Add Item
                              </Button>
                            )}

                            {/* Separator between kits */}
                            {kits.length > 1 && kitIdx < kits.length - 1 && (
                              <div className="border-t border-border/50 mt-2" />
                            )}
                          </div>
                        ))}

                        {/* Add another kit button */}
                        {!readOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-muted-foreground"
                            onClick={() => addKit(key)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Another {label}
                          </Button>
                        )}
                      </>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {/* Save button */}
          {!readOnly && onSave && hasChanges && (
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Equipment
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rename Kit dialog */}
      <Dialog open={!!renameKitId} onOpenChange={open => { if (!open) setRenameKitId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Kit</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Kit Name</Label>
            <Input value={renameName} onChange={e => setRenameName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameKitId(null)}>Cancel</Button>
            <Button onClick={saveRename} disabled={!renameName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
