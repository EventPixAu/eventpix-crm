/**
 * PhotographyEquipmentEditor - Structured equipment form for photographers
 * 
 * Allows photographers to enter details about their cameras, lenses, lights, and backdrops.
 * Each category supports multiple items with name, brand, and notes fields.
 */

import { useState, useEffect } from 'react';
import { Plus, Trash2, Camera, Aperture, Lightbulb, Image, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export interface EquipmentItem {
  id: string;
  name: string;
  brand: string;
  notes: string;
}

export interface PhotographyEquipment {
  camera: EquipmentItem[];
  lighting: EquipmentItem[];
  backdrop: EquipmentItem[];
  other: EquipmentItem[];
}

interface PhotographyEquipmentEditorProps {
  initialData?: PhotographyEquipment | null;
  onChange?: (data: PhotographyEquipment) => void;
  onSave?: (data: PhotographyEquipment) => Promise<void>;
  isSaving?: boolean;
  readOnly?: boolean;
}

const DEFAULT_EQUIPMENT: PhotographyEquipment = {
  camera: [],
  lighting: [],
  backdrop: [],
  other: [],
};

const CATEGORIES = [
  { key: 'camera' as const, label: 'Camera Kit', icon: Camera, placeholder: 'e.g., Canon EOS R5, RF 24-70mm f/2.8L' },
  { key: 'lighting' as const, label: 'Lighting Kit', icon: Lightbulb, placeholder: 'e.g., Godox AD600 Pro, Softbox' },
  { key: 'backdrop' as const, label: 'Backdrop Kit', icon: Image, placeholder: 'e.g., Grey Muslin 3x6m, C-Stand' },
  { key: 'other' as const, label: 'Other', icon: Aperture, placeholder: 'e.g., Memory cards, Batteries' },
] as const;

function generateId(): string {
  return crypto.randomUUID?.() || Date.now().toString();
}

export function PhotographyEquipmentEditor({
  initialData,
  onChange,
  onSave,
  isSaving = false,
  readOnly = false,
}: PhotographyEquipmentEditorProps) {
  const [equipment, setEquipment] = useState<PhotographyEquipment>(
    initialData || DEFAULT_EQUIPMENT
  );
  const [hasChanges, setHasChanges] = useState(false);

  // Sync with initial data changes - handle both old and new key formats
  useEffect(() => {
    if (initialData) {
      setEquipment({
        camera: initialData.camera || (initialData as any).cameras || [],
        lighting: initialData.lighting || (initialData as any).lights || [],
        backdrop: initialData.backdrop || (initialData as any).backdrops || [],
        other: initialData.other || (initialData as any).lenses || [],
      });
    }
  }, [initialData]);

  const updateEquipment = (newEquipment: PhotographyEquipment) => {
    setEquipment(newEquipment);
    setHasChanges(true);
    onChange?.(newEquipment);
  };

  const addItem = (category: keyof PhotographyEquipment) => {
    const newItem: EquipmentItem = {
      id: generateId(),
      name: '',
      brand: '',
      notes: '',
    };
    updateEquipment({
      ...equipment,
      [category]: [...equipment[category], newItem],
    });
  };

  const updateItem = (
    category: keyof PhotographyEquipment,
    itemId: string,
    field: keyof EquipmentItem,
    value: string
  ) => {
    updateEquipment({
      ...equipment,
      [category]: equipment[category].map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    });
  };

  const removeItem = (category: keyof PhotographyEquipment, itemId: string) => {
    updateEquipment({
      ...equipment,
      [category]: equipment[category].filter((item) => item.id !== itemId),
    });
  };

  const handleSave = async () => {
    if (onSave) {
      await onSave(equipment);
      setHasChanges(false);
    }
  };

  const totalItems = CATEGORIES.reduce(
    (sum, cat) => sum + equipment[cat.key].length,
    0
  );

  return (
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
          {CATEGORIES.map(({ key, label, icon: Icon, placeholder }) => (
            <AccordionItem key={key} value={key} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{label}</span>
                  {equipment[key].length > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({equipment[key].length})
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-3">
                {equipment[key].length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No {label.toLowerCase()} added yet
                  </p>
                ) : (
                  equipment[key].map((item, index) => (
                    <div
                      key={item.id}
                      className="grid gap-3 p-3 bg-muted/30 rounded-lg relative"
                    >
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(key, item.id)}
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
                            onChange={(e) =>
                              updateItem(key, item.id, 'name', e.target.value)
                            }
                            disabled={readOnly}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Brand</Label>
                          <Input
                            placeholder="e.g., Canon, Sony, Nikon"
                            value={item.brand}
                            onChange={(e) =>
                              updateItem(key, item.id, 'brand', e.target.value)
                            }
                            disabled={readOnly}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Notes (optional)</Label>
                        <Input
                          placeholder="Any additional details..."
                          value={item.notes}
                          onChange={(e) =>
                            updateItem(key, item.id, 'notes', e.target.value)
                          }
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  ))
                )}
                {!readOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => addItem(key)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
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
  );
}
