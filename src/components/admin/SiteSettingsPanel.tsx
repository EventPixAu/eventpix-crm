/**
 * SITE SETTINGS PANEL
 * 
 * Admin UI for managing business settings (ABN, name, default terms)
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Building2 } from 'lucide-react';
import { useSiteSettings, useUpdateSiteSetting } from '@/hooks/useSiteSettings';

const SETTING_LABELS: Record<string, { label: string; type: 'text' | 'textarea' }> = {
  business_name: { label: 'Business Name', type: 'text' },
  business_abn: { label: 'ABN', type: 'text' },
  business_email: { label: 'Contact Email', type: 'text' },
  default_terms: { label: 'Default Terms & Conditions', type: 'textarea' },
};

export default function SiteSettingsPanel() {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSetting = useUpdateSiteSetting();
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize edited values when settings load
  useEffect(() => {
    if (settings) {
      const initial: Record<string, string> = {};
      settings.forEach((s) => {
        initial[s.key] = s.value || '';
      });
      setEditedValues(initial);
      setHasChanges(false);
    }
  }, [settings]);

  const handleChange = (key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!settings) return;
    
    for (const setting of settings) {
      const newValue = editedValues[setting.key];
      if (newValue !== setting.value) {
        await updateSetting.mutateAsync({ key: setting.key, value: newValue });
      }
    }
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Business Settings
        </CardTitle>
        <CardDescription>
          Configure business details shown on proposals and documents
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings?.map((setting) => {
          const config = SETTING_LABELS[setting.key];
          if (!config) return null;
          
          return (
            <div key={setting.key} className="space-y-2">
              <Label htmlFor={setting.key}>{config.label}</Label>
              {config.type === 'textarea' ? (
                <Textarea
                  id={setting.key}
                  value={editedValues[setting.key] || ''}
                  onChange={(e) => handleChange(setting.key, e.target.value)}
                  rows={5}
                  placeholder={setting.description || undefined}
                />
              ) : (
                <Input
                  id={setting.key}
                  value={editedValues[setting.key] || ''}
                  onChange={(e) => handleChange(setting.key, e.target.value)}
                  placeholder={setting.description || undefined}
                />
              )}
              {setting.description && config.type !== 'textarea' && (
                <p className="text-xs text-muted-foreground">{setting.description}</p>
              )}
            </div>
          );
        })}
        
        <div className="pt-4 flex justify-end">
          <Button onClick={handleSave} disabled={!hasChanges || updateSetting.isPending}>
            {updateSetting.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
