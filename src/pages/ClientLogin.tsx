import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Mail, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import eventpixLogo from '@/assets/eventpix-logo.png';

export default function ClientLogin() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // If already logged in, redirect to portal
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/portal');
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/portal`,
        },
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Unable to send login link',
          description: error.message,
        });
      } else {
        setLinkSent(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-accent/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6"
          >
            <img src={eventpixLogo} alt="Eventpixii" className="h-12 mx-auto" />
          </motion.div>
          <h1 className="text-2xl font-display font-bold text-foreground">Client Portal</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            View your events, budgets and project details
          </p>
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border rounded-xl p-6 shadow-card">
          {linkSent ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-4 space-y-4"
            >
              <CheckCircle className="h-12 w-12 text-primary mx-auto" />
              <h2 className="text-lg font-semibold text-foreground">Check your email</h2>
              <p className="text-muted-foreground text-sm">
                We've sent a login link to <strong className="text-foreground">{email}</strong>. 
                Click the link in the email to access your portal.
              </p>
              <Button
                variant="outline"
                onClick={() => setLinkSent(false)}
                className="mt-4"
              >
                Use a different email
              </Button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-secondary/50 border-border focus:border-primary focus:ring-primary"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-glow gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Send me a login link
                  </>
                )}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          No password needed — we'll email you a secure login link
        </p>

        <div className="text-center mt-4">
          <button
            onClick={() => navigate('/auth')}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Team member? Sign in here →
          </button>
        </div>
      </motion.div>
    </div>
  );
}
