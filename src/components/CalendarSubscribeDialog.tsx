import { useState, useEffect } from 'react';
import { Copy, Calendar, RefreshCw, ExternalLink, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export function CalendarSubscribeDialog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && user?.id) {
      loadFeedUrl();
    }
  }, [open, user?.id]);

  const loadFeedUrl = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('calendar_feed_token')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (profile?.calendar_feed_token) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const url = `${supabaseUrl}/functions/v1/calendar-feed?user_id=${user.id}&token=${profile.calendar_feed_token}`;
        setFeedUrl(url);
      }
    } catch (error) {
      console.error('Error loading feed URL:', error);
      toast({
        title: 'Error',
        description: 'Failed to load calendar feed URL',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Calendar URL copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleRegenerate = async () => {
    if (!user?.id) return;
    
    setIsRegenerating(true);
    try {
      const { data, error } = await supabase.rpc('regenerate_calendar_feed_token', {
        p_user_id: user.id,
      });

      if (error) throw error;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/functions/v1/calendar-feed?user_id=${user.id}&token=${data}`;
      setFeedUrl(url);

      toast({
        title: 'URL Regenerated',
        description: 'Your calendar URL has been updated. Old subscriptions will stop working.',
      });
    } catch (error) {
      console.error('Error regenerating token:', error);
      toast({
        title: 'Error',
        description: 'Failed to regenerate calendar URL',
        variant: 'destructive',
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const openGoogleCalendar = () => {
    // Google Calendar subscription URL
    const googleUrl = `https://calendar.google.com/calendar/r/settings/addbyurl?url=${encodeURIComponent(feedUrl)}`;
    window.open(googleUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Calendar className="h-4 w-4" />
          Subscribe to Calendar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Subscribe to Your Calendar</DialogTitle>
          <DialogDescription>
            Add your Eventpix events to Google Calendar or any calendar app that supports iCal feeds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="feed-url">Calendar Feed URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="feed-url"
                    value={feedUrl}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    title="Copy URL"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={openGoogleCalendar} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Add to Google Calendar
                </Button>
                
                <p className="text-xs text-muted-foreground text-center">
                  Or paste the URL into any calendar app (Apple Calendar, Outlook, etc.)
                </p>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Regenerate URL</p>
                    <p>Generate a new URL if you want to revoke access to old subscriptions.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="gap-2 shrink-0"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                    Regenerate
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
