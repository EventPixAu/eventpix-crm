/**
 * PhotographyEquipmentEditor - Kit-based equipment form for photographers
 * 
 * Photographers organize gear into named kits (e.g. "Camera Kit", "Lighting Kit 1").
 * Supports backward compatibility with the old flat category-based format.
 */

import { useState, useEffect } from 'react';
import { Plus, Trash2, Camera, Aperture, Lightbulb, Image, Loader2, Save, GripVertical, Pencil } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// --- Shared types (exported for use in StaffEquipmentPreview, etc.) ---

export interface EquipmentItem {
  id: string;
  name: string;
  brand: string;
  notes: string;
}

/** Legacy flat format kept for backward compat */
export interface PhotographyEquipment {
  camera: EquipmentItem[];
  lighting: EquipmentItem[];
  backdrop: EquipmentItem[];
  other: EquipmentItem[];
}

export type KitCategory = 'camera' | 'lighting' | 'backdrop' | 'other';

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

// Union type for what can be stored in the JSON column
export type StoredEquipment = PhotographyEquipment | PhotographyEquipmentV2;

// --- Category config ---

export const CATEGORY_CONFIG: { key: KitCategory; label: string; icon: typeof Camera; defaultKitName: string }[] = [
  { key: 'camera', label: 'Camera', icon: Camera, defaultKitName: 'Camera Kit' },
  { key: 'lighting', label: 'Lighting', icon: Lightbulb, defaultKitName: 'Lighting Kit' },
  { key: 'backdrop', label: 'Backdrop', icon: Image, defaultKitName: 'Backdrop Kit' },
  { key: 'other', label: 'Other', icon: Aperture, defaultKitName: 'Other Kit' },
];

const categoryIcon = (cat: KitCategory) => CATEGORY_CONFIG.find(c => c.key === cat)?.icon ?? Aperture;

// --- Helpers ---

function generateId(): string {
  return crypto.randomUUID?.() || Date.now().toString() + Math.random().toString(36).slice(2);
}

/** Convert legacy flat format → V2 kits format */
export function migrateToV2(data: StoredEquipment): PhotographyEquipmentV2 {
  if ('version' in data && data.version === 2) return data as PhotographyEquipmentV2;

  const legacy = data as PhotographyEquipment;
  const kits: EquipmentKit[] = [];

  // Normalize old key formats
  const normalized: PhotographyEquipment = {
    camera: legacy.camera || (legacy as any).cameras || [],
    lighting: legacy.lighting || (legacy as any).lights || [],
    backdrop: legacy.backdrop || (legacy as any).backdrops || [],
    other: legacy.other || (legacy as any).lenses || [],
  };

  for (const cfg of CATEGORY_CONFIG) {
    const items = normalized[cfg.key] || [];
    if (items.length > 0) {
      kits.push({ id: generateId(), name: cfg.defaultKitName, category: cfg.key, items });
    }
  }

  return { version: 2, kits };
}

/** Convert V2 back to legacy flat format (for consumers that still expect it) */
export function v2ToLegacy(data: PhotographyEquipmentV2): PhotographyEquipment {
  const result: PhotographyEquipment = { camera: [], lighting: [], backdrop: [], other: [] };
  for (const kit of data.kits) {
    result[kit.category].push(...kit.items);
  }
  return result;
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

  // Kit add/rename dialog
  const [kitDialogOpen, setKitDialogOpen] = useState(false);
  const [editingKitId, setEditingKitId] = useState<string | null>(null);
  const [kitName, setKitName] = useState('');
  const [kitCategory, setKitCategory] = useState<KitCategory>('camera');

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

  // --- Kit CRUD ---

  const openAddKit = () => {
    setEditingKitId(null);
    setKitName('');
    setKitCategory('camera');
    setKitDialogOpen(true);
  };

  const openEditKit = (kit: EquipmentKit) => {
    setEditingKitId(kit.id);
    setKitName(kit.name);
    setKitCategory(kit.category);
    setKitDialogOpen(true);
  };

  const saveKit = () => {
    if (!kitName.trim()) return;
    if (editingKitId) {
      // Update existing
      update({
        ...data,
        kits: data.kits.map(k =>
          k.id === editingKitId ? { ...k, name: kitName.trim(), category: kitCategory } : k
        ),
      });
    } else {
      // Add new
      update({
        ...data,
        kits: [...data.kits, { id: generateId(), name: kitName.trim(), category: kitCategory, items: [] }],
      });
    }
    setKitDialogOpen(false);
  };

  const removeKit = (kitId: string) => {
    update({ ...data, kits: data.kits.filter(k => k.id !== kitId) });
  };

  // --- Item CRUD within a kit ---

  const addItem = (kitId: string) => {
    const newItem: EquipmentItem = { id: generateId(), name: '', brand: '', notes: '' };
    update({
      ...data,
      kits: data.kits.map(k => (k.id === kitId ? { ...k, items: [...k.items, newItem] } : k)),
    });
  };

  const updateItem = (kitId: string, itemId: string, field: keyof EquipmentItem, value: string) => {
    update({
      ...data,
      kits: data.kits.map(k =>
        k.id === kitId
          ? { ...k, items: k.items.map(i => (i.id === itemId ? { ...i, [field]: value } : i)) }
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
                Photography Equipment Kits
              </CardTitle>
              <CardDescription>
                {readOnly
                  ? 'Registered equipment kits'
                  : 'Organise your gear into named kits (e.g. Camera Kit, Lighting Kit 1, Lighting Kit 2)'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {totalItems > 0 && (
                <span className="text-sm text-muted-foreground">
                  {data.kits.length} kit{data.kits.length !== 1 && 's'} · {totalItems} item{totalItems !== 1 && 's'}
                </span>
              )}
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={openAddKit}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Kit
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {data.kits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground space-y-2">
              <p className="text-sm">No equipment kits created yet</p>
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={openAddKit}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Your First Kit
                </Button>
              )}
            </div>
          ) : (
            <Accordion
              type="multiple"
              defaultValue={data.kits.map(k => k.id)}
              className="space-y-2"
            >
              {data.kits.map(kit => {
                const Icon = categoryIcon(kit.category);
                return (
                  <AccordionItem key={kit.id} value={kit.id} className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2 flex-1">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{kit.name}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({kit.items.length} item{kit.items.length !== 1 && 's'})
                        </span>
                        {!readOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-2"
                            onClick={e => { e.stopPropagation(); openEditKit(kit); }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4 space-y-3">
                      {kit.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          No items in this kit yet
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
                                  placeholder="e.g., Canon EOS R5"
                                  value={item.name}
                                  onChange={e => updateItem(kit.id, item.id, 'name', e.target.value)}
                                  disabled={readOnly}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Brand</Label>
                                <Input
                                  placeholder="e.g., Canon, Sony"
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

                      <div className="flex items-center gap-2">
                        {!readOnly && (
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => addItem(kit.id)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Item
                          </Button>
                        )}
                        {!readOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeKit(kit.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove Kit
                          </Button>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}

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

      {/* Add / Edit Kit dialog */}
      <Dialog open={kitDialogOpen} onOpenChange={setKitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingKitId ? 'Edit Kit' : 'Add Equipment Kit'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Kit Name</Label>
              <Input
                placeholder="e.g., Lighting Kit 1"
                value={kitName}
                onChange={e => setKitName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={kitCategory} onValueChange={v => setKitCategory(v as KitCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_CONFIG.map(c => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKitDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveKit} disabled={!kitName.trim()}>
              {editingKitId ? 'Update Kit' : 'Create Kit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
