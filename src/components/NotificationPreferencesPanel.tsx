import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Loader2, Mail, Save, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface NotificationPreferences {
  email_on_assignment: boolean;
  email_on_changes: boolean;
  in_app_notifications: boolean;
}

interface NotificationPreferencesPanelProps {
  preferences: NotificationPreferences | null;
  userId: string;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  email_on_assignment: true,
  email_on_changes: true,
  in_app_notifications: true,
};

function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, preferences }: { userId: string; preferences: NotificationPreferences }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ notification_preferences: JSON.parse(JSON.stringify(preferences)) })
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      toast.success('Notification preferences saved');
    },
    onError: (error) => {
      toast.error('Failed to save preferences: ' + error.message);
    },
  });
}

export function NotificationPreferencesPanel({ preferences, userId }: NotificationPreferencesPanelProps) {
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences>(preferences || DEFAULT_PREFERENCES);
  const [hasChanges, setHasChanges] = useState(false);
  const updatePreferences = useUpdateNotificationPreferences();
  
  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
    }
  }, [preferences]);
  
  const handleChange = (key: keyof NotificationPreferences, value: boolean) => {
    setLocalPrefs(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };
  
  const handleSave = async () => {
    await updatePreferences.mutateAsync({ userId, preferences: localPrefs });
    setHasChanges(false);
  };
  
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Configurable Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Your Preferences
          </CardTitle>
          <CardDescription>
            Control which notifications you receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="email_on_assignment" className="text-sm font-medium">
                    Email on Assignment
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Receive an email when you're assigned to an event
                  </p>
                </div>
              </div>
              <Switch
                id="email_on_assignment"
                checked={localPrefs.email_on_assignment}
                onCheckedChange={(checked) => handleChange('email_on_assignment', checked)}
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="email_on_changes" className="text-sm font-medium">
                    Email on Changes
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Receive an email when event details change
                  </p>
                </div>
              </div>
              <Switch
                id="email_on_changes"
                checked={localPrefs.email_on_changes}
                onCheckedChange={(checked) => handleChange('email_on_changes', checked)}
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="in_app_notifications" className="text-sm font-medium">
                    In-App Notifications
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show notifications in the app
                  </p>
                </div>
              </div>
              <Switch
                id="in_app_notifications"
                checked={localPrefs.in_app_notifications}
                onCheckedChange={(checked) => handleChange('in_app_notifications', checked)}
              />
            </div>
          </div>
          
          {hasChanges && (
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={updatePreferences.isPending}>
                {updatePreferences.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Preferences
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Non-Configurable Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5 text-muted-foreground" />
            Always Enabled
          </CardTitle>
          <CardDescription>
            These notifications cannot be disabled for safety and compliance reasons
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Compliance Expiry Alerts</p>
                <p className="text-xs text-muted-foreground">
                  Reminders when your documents are about to expire
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Day-of Event Reminders</p>
                <p className="text-xs text-muted-foreground">
                  Morning reminders on days you're working
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Critical Assignment Notifications</p>
                <p className="text-xs text-muted-foreground">
                  Urgent changes that affect your upcoming work
                </p>
              </div>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground pt-2">
            These notifications ensure you never miss critical information about your work or compliance requirements.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
