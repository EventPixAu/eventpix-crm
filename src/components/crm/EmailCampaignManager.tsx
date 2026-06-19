/**
 * EMAIL CAMPAIGN MANAGER
 * 
 * Create and manage email workflow campaigns for different client segments.
 */
import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Users,
  Send,
  Calendar,
  Plus,
  Trash2,
  Eye,
  Play,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import {
  useEmailCampaigns,
  useCreateEmailCampaign,
  useDeleteEmailCampaign,
  usePopulateCampaignRecipients,
  useScheduleCampaign,
  useCancelCampaign,
  useCampaignEngagement,
  CAMPAIGN_TYPE_LABELS,
  TARGET_SEGMENT_LABELS,
  CampaignType,
  TargetSegment,
  CampaignStatus,
  EmailCampaign,
  RecipientEngagementStatus,
} from '@/hooks/useEmailCampaigns';
import { useActiveEmailTemplates } from '@/hooks/useEmailTemplates';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Campaign type descriptions
const CAMPAIGN_TYPE_DESCRIPTIONS: Record<CampaignType, string> = {
  thank_you_2025: 'Send a thank you message to clients for their business in 2025',
  reminder_10_month: 'Remind clients 10 months after their last event to book again',
  reconnection: 'Reconnect with previous clients who haven\'t booked recently',
  event_followup: 'Follow up after events with personalized messages referencing their job',
  edm_custom: 'Custom EDM campaign with your own content',
};

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateCampaignDialog({ open, onOpenChange }: CreateCampaignDialogProps) {
  const [step, setStep] = useState(1);
  const [campaignType, setCampaignType] = useState<CampaignType>('thank_you_2025');
  const [targetSegment, setTargetSegment] = useState<TargetSegment>('existing_clients');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [subjectOverride, setSubjectOverride] = useState('');
  const [bodyOverride, setBodyOverride] = useState('');

  const { data: templates = [] } = useActiveEmailTemplates();
  const createCampaign = useCreateEmailCampaign();
  const populateRecipients = usePopulateCampaignRecipients();

  const resetForm = () => {
    setStep(1);
    setCampaignType('thank_you_2025');
    setTargetSegment('existing_clients');
    setName('');
    setDescription('');
    setTemplateId('');
    setSubjectOverride('');
    setBodyOverride('');
  };

  const handleCreate = async () => {
    try {
      const campaign = await createCampaign.mutateAsync({
        name: name || CAMPAIGN_TYPE_LABELS[campaignType],
        description: description || CAMPAIGN_TYPE_DESCRIPTIONS[campaignType],
        campaign_type: campaignType,
        target_segment: targetSegment,
        template_id: templateId || null,
        subject_override: subjectOverride || null,
        body_override: bodyOverride || null,
      });

      // Populate recipients
      await populateRecipients.mutateAsync({
        campaignId: campaign.id,
        targetSegment,
      });

      resetForm();
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Set defaults based on campaign type
  const handleCampaignTypeChange = (type: CampaignType) => {
    setCampaignType(type);
    setName(CAMPAIGN_TYPE_LABELS[type]);
    setDescription(CAMPAIGN_TYPE_DESCRIPTIONS[type]);
    
    // Set default target segment
    if (type === 'thank_you_2025') {
      setTargetSegment('existing_clients');
    } else if (type === 'reminder_10_month') {
      setTargetSegment('existing_clients');
    } else if (type === 'reconnection') {
      setTargetSegment('previous_clients');
    } else if (type === 'event_followup') {
      setTargetSegment('existing_clients');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Email Campaign</DialogTitle>
          <DialogDescription>
            {step === 1 && 'Choose the type of campaign and target audience'}
            {step === 2 && 'Configure campaign details and content'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label>Campaign Type</Label>
              <div className="grid gap-3">
                {(Object.keys(CAMPAIGN_TYPE_LABELS) as CampaignType[]).map((type) => (
                  <div
                    key={type}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      campaignType === type
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-muted-foreground/50'
                    }`}
                    onClick={() => handleCampaignTypeChange(type)}
                  >
                    <div className="font-medium">{CAMPAIGN_TYPE_LABELS[type]}</div>
                    <div className="text-sm text-muted-foreground">
                      {CAMPAIGN_TYPE_DESCRIPTIONS[type]}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Target Audience</Label>
              <Select value={targetSegment} onValueChange={(v) => setTargetSegment(v as TargetSegment)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="existing_clients">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Existing Clients (Active + Current)
                    </div>
                  </SelectItem>
                  <SelectItem value="previous_clients">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Previous Clients (Inactive &gt;12 months)
                    </div>
                  </SelectItem>
                  <SelectItem value="prospects">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-accent-foreground" />
                      Prospects (No completed events)
                    </div>
                  </SelectItem>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      All Contacts
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Campaign name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email Template (optional)</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Use a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Campaign description"
                rows={2}
              />
            </div>

            {!templateId && (
              <>
                <div className="space-y-2">
                  <Label>Subject Line Override</Label>
                  <Input
                    value={subjectOverride}
                    onChange={(e) => setSubjectOverride(e.target.value)}
                    placeholder="Custom subject line (uses merge fields)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {'{{client.business_name}}'}, {'{{last_event_name}}'}, etc.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Body Content Override</Label>
                  <Textarea
                    value={bodyOverride}
                    onChange={(e) => setBodyOverride(e.target.value)}
                    placeholder="Custom email body (uses merge fields)"
                    rows={6}
                  />
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => setStep(2)}>Next</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createCampaign.isPending || populateRecipients.isPending}
              >
                {createCampaign.isPending || populateRecipients.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Campaign
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CampaignDetailDialogProps {
  campaign: EmailCampaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_BADGE: Record<RecipientEngagementStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground border-border' },
  sent: { label: 'Sent', className: 'bg-muted text-foreground border-border' },
  opened: { label: 'Opened', className: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  bounced: { label: 'Bounced', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  unsubscribed: { label: 'Unsubscribed', className: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  replied: { label: 'Replied', className: 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/30' },
  failed: { label: 'Failed', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  skipped: { label: 'Skipped', className: 'bg-muted text-muted-foreground border-border' },
};

function StatusBadge({ status }: { status: RecipientEngagementStatus }) {
  const cfg = STATUS_BADGE[status];
  return (
    <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
  );
}

function StatTile({
  label, value, pct, tone,
}: {
  label: string;
  value: number;
  pct?: number;
  tone?: 'default' | 'success' | 'destructive' | 'warning' | 'muted' | 'info';
}) {
  const toneClass =
    tone === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
    tone === 'destructive' ? 'text-destructive' :
    tone === 'warning' ? 'text-amber-600 dark:text-amber-400' :
    tone === 'info' ? 'text-sky-600 dark:text-sky-400' :
    tone === 'muted' ? 'text-muted-foreground' :
    'text-foreground';
  return (
    <Card>
      <CardContent className="pt-4">
        <div className={`text-2xl font-bold ${toneClass}`}>
          {value}
          {pct !== undefined && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">{pct}%</span>
          )}
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function CampaignDetailDialog({ campaign, open, onOpenChange }: CampaignDetailDialogProps) {
  const { data: engagement, isLoading, refetch, isFetching } = useCampaignEngagement(campaign?.id);
  const scheduleCampaign = useScheduleCampaign();
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [showSchedule, setShowSchedule] = useState(false);

  const handleSchedule = async () => {
    if (!campaign || !scheduledDate) return;
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    await scheduleCampaign.mutateAsync({ campaignId: campaign.id, scheduledAt });
    setShowSchedule(false);
    setScheduledDate('');
  };

  if (!campaign) return null;

  const summary = engagement?.summary ?? {
    total: campaign.total_recipients, sent: 0, opened: 0, bounced: 0,
    unsubscribed: 0, replied: 0, failed: 0, pending: 0, skipped: 0,
  };
  const contacts = engagement?.contacts ?? [];
  const steps = engagement?.steps ?? [];
  const pct = (n: number) => summary.total > 0 ? Math.round((n / summary.total) * 100) : 0;
  const sentDenom = summary.sent + summary.opened + summary.replied;
  const sentishTotal = sentDenom + summary.bounced + summary.failed;
  const progress = summary.total > 0 ? (sentishTotal / summary.total) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign.name}</DialogTitle>
          <DialogDescription>{campaign.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Last updated */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {engagement?.lastUpdated
                ? `Last updated ${formatDistanceToNow(engagement.lastUpdated, { addSuffix: true })} · auto-refreshes every 5 min`
                : 'Loading engagement data…'}
            </span>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3 w-3 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Top-level stats */}
          <div className="grid gap-4 sm:grid-cols-4">
            <StatTile label="Total Recipients" value={summary.total} />
            <StatTile label="Sent" value={summary.sent + summary.opened + summary.replied} />
            <StatTile label="Pending" value={summary.pending} tone="muted" />
            <StatTile label="Failed" value={summary.failed} tone="destructive" />
          </div>

          {/* Engagement stats */}
          <div className="grid gap-4 sm:grid-cols-4">
            <StatTile label="Opened" value={summary.opened} pct={pct(summary.opened)} tone="success" />
            <StatTile label="Bounced" value={summary.bounced} pct={pct(summary.bounced)} tone="destructive" />
            <StatTile label="Unsubscribed" value={summary.unsubscribed} pct={pct(summary.unsubscribed)} tone="warning" />
            <StatTile label="Replied" value={summary.replied} pct={pct(summary.replied)} tone="info" />
          </div>

          {campaign.status === 'in_progress' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Schedule Section */}
          {campaign.status === 'draft' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Schedule Campaign</CardTitle>
              </CardHeader>
              <CardContent>
                {!showSchedule ? (
                  <Button onClick={() => setShowSchedule(true)}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule for Later
                  </Button>
                ) : (
                  <div className="flex items-end gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={format(new Date(), 'yyyy-MM-dd')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Time</Label>
                      <Input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleSchedule} disabled={!scheduledDate || scheduleCampaign.isPending}>
                      {scheduleCampaign.isPending ? 'Scheduling...' : 'Confirm Schedule'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowSchedule(false)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recipients + per-step reporting */}
          <div>
            <h4 className="font-medium mb-3">Recipients ({contacts.length})</h4>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : steps.length > 0 ? (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="flex-wrap h-auto">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  {steps.map((s) => (
                    <TabsTrigger key={s.id} value={s.id}>
                      Email {s.step_order + 1}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="overview" className="mt-4">
                  <RecipientTable
                    contacts={contacts}
                    columns={steps.map((s) => ({ key: s.id, label: `Email ${s.step_order + 1}` }))}
                  />
                </TabsContent>

                {steps.map((s) => {
                  const ss = engagement?.perStepSummary[s.id];
                  return (
                    <TabsContent key={s.id} value={s.id} className="mt-4 space-y-4">
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{s.subject}</span>
                        {s.delay_days > 0 && <> · sent {s.delay_days} day(s) after Email 1</>}
                      </div>
                      {ss && (
                        <div className="grid gap-3 sm:grid-cols-4">
                          <StatTile label="Sent" value={ss.sent + ss.opened + ss.replied} />
                          <StatTile label="Opened" value={ss.opened} tone="success" />
                          <StatTile label="Bounced" value={ss.bounced} tone="destructive" />
                          <StatTile label="Unsubscribed" value={ss.unsubscribed} tone="warning" />
                        </div>
                      )}
                      <RecipientTable
                        contacts={contacts}
                        stepId={s.id}
                      />
                    </TabsContent>
                  );
                })}
              </Tabs>
            ) : (
              <RecipientTable contacts={contacts} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecipientTable({
  contacts,
  stepId,
  columns,
}: {
  contacts: import('@/hooks/useEmailCampaigns').EngagementContact[];
  stepId?: string;
  columns?: { key: string; label: string }[];
}) {
  return (
    <div className="border rounded-lg max-h-[400px] overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contact</TableHead>
            <TableHead>Last Event</TableHead>
            {columns
              ? columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)
              : <TableHead>Status</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.slice(0, 100).map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <div>
                  <div className="font-medium">{c.recipient_name || 'Unknown'}</div>
                  <div className="text-sm text-muted-foreground">{c.recipient_email}</div>
                </div>
              </TableCell>
              <TableCell>
                {c.last_event_name ? (
                  <div>
                    <div className="text-sm">{c.last_event_name}</div>
                    {c.last_event_date && (
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(c.last_event_date), 'PP')}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              {columns ? (
                columns.map((col) => (
                  <TableCell key={col.key}>
                    <StatusBadge status={c.steps[col.key]?.derived ?? 'pending'} />
                  </TableCell>
                ))
              ) : (
                <TableCell>
                  <StatusBadge
                    status={
                      stepId
                        ? (c.steps[stepId]?.derived ?? 'pending')
                        : c.base_derived
                    }
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
          {contacts.length > 100 && (
            <TableRow>
              <TableCell colSpan={columns ? columns.length + 2 : 3} className="text-center text-muted-foreground">
                ... and {contacts.length - 100} more
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

import { CampaignWizardDialog } from './CampaignWizardDialog';

export function EmailCampaignManager() {
  const { data: campaigns = [], isLoading } = useEmailCampaigns();
  const deleteCampaign = useDeleteEmailCampaign();
  const cancelCampaign = useCancelCampaign();

  const [createOpen, setCreateOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);

  const getStatusBadge = (status: CampaignStatus) => {
    const config: Record<CampaignStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      draft: { variant: 'outline', icon: null },
      scheduled: { variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
      in_progress: { variant: 'default', icon: <RefreshCw className="h-3 w-3 animate-spin" /> },
      completed: { variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
      cancelled: { variant: 'destructive', icon: <X className="h-3 w-3" /> },
    };
    const { variant, icon } = config[status];
    return (
      <Badge variant={variant} className="gap-1">
        {icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Email Campaigns</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage automated email workflows for client segments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Quick Campaign
          </Button>
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No campaigns yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first campaign to start engaging clients
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{campaign.name}</div>
                        {campaign.email_templates && (
                          <div className="text-xs text-muted-foreground">
                            Template: {campaign.email_templates.name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {CAMPAIGN_TYPE_LABELS[campaign.campaign_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {TARGET_SEGMENT_LABELS[campaign.target_segment]}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {campaign.total_recipients}
                        {campaign.sent_count > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ({campaign.sent_count} sent)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell>
                      {campaign.scheduled_at
                        ? format(new Date(campaign.scheduled_at), 'PP p')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedCampaign(campaign)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(campaign.status === 'scheduled' || campaign.status === 'in_progress') && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={campaign.status === 'in_progress' ? 'Stop campaign' : 'Cancel scheduled campaign'}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {campaign.status === 'in_progress' ? 'Stop this campaign?' : 'Cancel scheduled campaign?'}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {campaign.status === 'in_progress'
                                    ? 'This will halt the campaign mid-send. Emails already sent cannot be recalled, but no further emails will go out.'
                                    : 'This will cancel the scheduled send. The campaign will not be dispatched.'}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => cancelCampaign.mutate(campaign.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {campaign.status === 'in_progress' ? 'Stop now' : 'Cancel send'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {campaign.status === 'draft' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the campaign and all its recipients.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteCampaign.mutate(campaign.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CreateCampaignDialog open={createOpen} onOpenChange={setCreateOpen} />
      <CampaignWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />
      <CampaignDetailDialog
        campaign={selectedCampaign}
        open={!!selectedCampaign}
        onOpenChange={(o) => !o && setSelectedCampaign(null)}
      />
    </div>
  );
}
