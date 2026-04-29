/**
 * EMBEDDABLE ENQUIRY FORM
 * 
 * Minimal version of the enquiry form designed to be embedded in iframes.
 * No header/footer, compact styling.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';

const enquirySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').max(255),
  phone: z.string().min(8, 'Phone number must be at least 8 digits').max(20),
  company: z.string().max(200).optional(),
  event_type_id: z.string().optional(),
  event_date: z.string().optional(),
  location: z.string().max(500).optional(),
  budget: z.string().optional(),
  lead_source: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
});

type EnquiryFormData = z.infer<typeof enquirySchema>;

const EVENT_TYPES = [
  { id: '33090e88-c242-4d76-8cc4-4089f14d3e23', name: 'Corporate Event' },
  { id: '91bab5b9-bf81-4006-8959-ef3f1eec30c5', name: 'Conference' },
  { id: '8afb00a3-03d0-48ac-b385-02ea40f37cbf', name: 'Awards Night' },
  { id: 'e982af1e-f231-4f23-82c5-60c895a997f9', name: 'School Formal' },
  { id: '83eea1ae-9746-4528-8aeb-f190568dac0a', name: 'Festival' },
  { id: 'eee8e74c-26a3-4d5a-8c43-42c1efa57f42', name: 'Headshots' },
];

const BUDGET_OPTIONS = [
  '$1,000 - $2,500',
  '$2,500 - $5,000',
  '$5,000 - $10,000',
  '$10,000 - $20,000',
  '$20,000+',
  'Not sure yet',
];

const LEAD_SOURCES = [
  'Referral',
  'Search',
  'Social Media',
  'Saw us at another event',
  'Website',
  'Other',
];

export default function EnquiryEmbed() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<EnquiryFormData>({
    resolver: zodResolver(enquirySchema),
  });

  const onSubmit = async (data: EnquiryFormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { data: result, error } = await supabase.functions.invoke('public-enquiry', {
        body: data,
      });

      if (error) {
        throw new Error(error.message || 'Failed to submit enquiry');
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit enquiry');
      }

      setIsSuccess(true);
      
      // Notify parent window of success (for iframe communication)
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'eventpix-enquiry-success' }, '*');
      }
    } catch (err) {
      console.error('Enquiry submission error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="p-6 text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold mb-2">Thank You!</h2>
        <p className="text-muted-foreground text-sm">
          Your enquiry has been received. We'll be in touch soon.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Contact Details */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="name" className="text-sm">Name *</Label>
            <Input
              id="name"
              placeholder="Your name"
              {...register('name')}
              className={`h-9 ${errors.name ? 'border-destructive' : ''}`}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="company" className="text-sm">Company</Label>
            <Input
              id="company"
              placeholder="Company name"
              {...register('company')}
              className="h-9"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="email" className="text-sm">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              {...register('email')}
              className={`h-9 ${errors.email ? 'border-destructive' : ''}`}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="phone" className="text-sm">Phone *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="0400 000 000"
              {...register('phone')}
              className={`h-9 ${errors.phone ? 'border-destructive' : ''}`}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>
        </div>

        {/* Event Details */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-sm">Event Type</Label>
            <Select onValueChange={(value) => setValue('event_type_id', value)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="event_date" className="text-sm">Event Date</Label>
            <Input
              id="event_date"
              type="date"
              {...register('event_date')}
              className="h-9"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="location" className="text-sm">Location</Label>
            <Input
              id="location"
              placeholder="City, State"
              {...register('location')}
              className="h-9"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm">Budget</Label>
            <Select onValueChange={(value) => setValue('budget', value)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select budget" />
              </SelectTrigger>
              <SelectContent>
                {BUDGET_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-sm">How did you hear about us?</Label>
          <Select onValueChange={(value) => setValue('lead_source', value)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {LEAD_SOURCES.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="message" className="text-sm">Message *</Label>
          <Textarea
            id="message"
            placeholder="Tell us about your event..."
            rows={4}
            {...register('message')}
            className={errors.message ? 'border-destructive' : ''}
          />
          {errors.message && (
            <p className="text-xs text-destructive">{errors.message.message}</p>
          )}
        </div>

        {errorMessage && (
          <div className="bg-destructive/10 text-destructive px-3 py-2 rounded text-sm">
            {errorMessage}
          </div>
        )}

        <Button 
          type="submit" 
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Submit Enquiry
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
