/**
 * PUBLIC ENQUIRY FORM
 * 
 * Standalone public page for event photography enquiries.
 * No authentication required - accessible to anyone.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, Send, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import eventpixLogo from '@/assets/eventpix-logo.png';

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
  { id: 'e6721723-4b81-40a6-affe-7d69e8ea7a15', name: 'Editorial' },
  { id: '60d08491-96da-4fd6-9ac4-deb272347976', name: 'Video Production' },
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
  'Partner',
  'Website',
  'Other',
];

export default function PublicEnquiry() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EnquiryFormData>({
    resolver: zodResolver(enquirySchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      company: '',
      message: '',
    },
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
    } catch (err) {
      console.error('Enquiry submission error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
            <p className="text-muted-foreground mb-6">
              Your enquiry has been received. Our team will be in touch with you shortly.
            </p>
            <Button onClick={() => window.location.href = 'https://www.eventpix.com.au'}>
              Return to Website
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src={eventpixLogo} 
            alt="EventPix" 
            className="h-12 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold mb-2">Event Photography Enquiry</h1>
          <p className="text-muted-foreground">
            Tell us about your event and we'll get back to you with a tailored quote.
          </p>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Your Details
            </CardTitle>
            <CardDescription>
              Please fill in your details and we'll be in touch within 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Contact Details */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Smith"
                    {...register('name')}
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Company / Organisation</Label>
                  <Input
                    id="company"
                    placeholder="Acme Corp"
                    {...register('company')}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    {...register('email')}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="0400 000 000"
                    {...register('phone')}
                    className={errors.phone ? 'border-destructive' : ''}
                  />
                  {errors.phone && (
                    <p className="text-sm text-destructive">{errors.phone.message}</p>
                  )}
                </div>
              </div>

              {/* Event Details */}
              <div className="border-t pt-6">
                <h3 className="font-medium mb-4">Event Details</h3>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="event_type">Type of Event</Label>
                    <Select onValueChange={(value) => setValue('event_type_id', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select event type" />
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

                  <div className="space-y-2">
                    <Label htmlFor="event_date">Event Date</Label>
                    <Input
                      id="event_date"
                      type="date"
                      {...register('event_date')}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Event Location</Label>
                    <Input
                      id="location"
                      placeholder="Sydney, NSW"
                      {...register('location')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="budget">Budget Range</Label>
                    <Select onValueChange={(value) => setValue('budget', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select budget range" />
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
              </div>

              {/* How did you hear about us */}
              <div className="space-y-2">
                <Label htmlFor="lead_source">How did you hear about us?</Label>
                <Select onValueChange={(value) => setValue('lead_source', value)}>
                  <SelectTrigger>
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

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="message">Tell us about your event *</Label>
                <Textarea
                  id="message"
                  placeholder="Please describe your event, what you're looking for, and any specific requirements..."
                  rows={5}
                  {...register('message')}
                  className={errors.message ? 'border-destructive' : ''}
                />
                {errors.message && (
                  <p className="text-sm text-destructive">{errors.message.message}</p>
                )}
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
                  {errorMessage}
                </div>
              )}

              {/* Submit Button */}
              <Button 
                type="submit" 
                size="lg" 
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

              <p className="text-xs text-muted-foreground text-center">
                By submitting this form, you agree to be contacted about your enquiry.
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} EventPix. Corporate and event photography Australia-wide.</p>
        </div>
      </div>
    </div>
  );
}
