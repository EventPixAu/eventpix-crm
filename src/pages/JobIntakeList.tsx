/**
 * DEPRECATED: Job Intake List
 * 
 * This page is deprecated in favor of the unified Sales workflow (Clients → Leads → Quotes).
 * Kept for backward compatibility with legacy intake records.
 * 
 * For new workflows, use:
 * - /sales/leads for pipeline management
 * - /sales/quotes for proposals
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, FileText, ArrowRight, Mail, Calendar, Building2, Search, CheckCircle2, Clock, XCircle, ArrowRightCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useJobIntakes, useCreateJobIntake, JobIntake, HandoffStatus } from '@/hooks/useJobIntake';

export default function JobIntakeList() {
  const navigate = useNavigate();
  const { data: intakes, isLoading } = useJobIntakes();
  const createIntake = useCreateJobIntake();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    job_name: '',
    proposed_event_date: '',
    external_job_id: '',
    notes: '',
  });

  const filteredIntakes = intakes?.filter(intake => {
    const matchesSearch = 
      intake.client_name.toLowerCase().includes(search.toLowerCase()) ||
      intake.job_name.toLowerCase().includes(search.toLowerCase());
    // Use handoff_status as authoritative filter
    const matchesStatus = statusFilter === 'all' || intake.handoff_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = async () => {
    await createIntake.mutateAsync({
      ...formData,
      source: 'studio_ninja',
      status: 'proposed', // Legacy field
      handoff_status: 'draft', // New authoritative field - starts as draft
      proposed_event_date: formData.proposed_event_date || null,
      external_job_id: formData.external_job_id || null,
      notes: formData.notes || null,
      client_email: formData.client_email || null,
    });
    setDialogOpen(false);
    setFormData({
      client_name: '',
      client_email: '',
      job_name: '',
      proposed_event_date: '',
      external_job_id: '',
      notes: '',
    });
  };

  const getHandoffStatusBadge = (status: HandoffStatus) => {
    switch (status) {
      case 'draft':
        return { label: 'Draft', icon: Clock, className: 'bg-muted text-muted-foreground border-muted' };
      case 'ready_for_ops':
        return { label: 'Ready for Ops', icon: ArrowRightCircle, className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/50' };
      case 'converted':
        return { label: 'Converted', icon: CheckCircle2, className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/50' };
      case 'cancelled':
        return { label: 'Cancelled', icon: XCircle, className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/50' };
      default:
        return { label: status, icon: Clock, className: '' };
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Job Intake"
        description="Sales handoff and job proposals"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>New Job Intake</DialogTitle>
                <DialogDescription>
                  Record a new job from Studio Ninja or other sources
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="job_name">Job Name *</Label>
                  <Input
                    id="job_name"
                    value={formData.job_name}
                    onChange={(e) => setFormData({ ...formData, job_name: e.target.value })}
                    placeholder="Smith Wedding"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client_name">Client Name *</Label>
                  <Input
                    id="client_name"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client_email">Client Email</Label>
                  <Input
                    id="client_email"
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposed_event_date">Proposed Date</Label>
                  <Input
                    id="proposed_event_date"
                    type="date"
                    value={formData.proposed_event_date}
                    onChange={(e) => setFormData({ ...formData, proposed_event_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="external_job_id">External Reference (Studio Ninja ID)</Label>
                  <Input
                    id="external_job_id"
                    value={formData.external_job_id}
                    onChange={(e) => setFormData({ ...formData, external_job_id: e.target.value })}
                    placeholder="SN-12345"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional details..."
                    rows={3}
                  />
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={!formData.job_name || !formData.client_name || createIntake.isPending}
                  className="w-full"
                >
                  Create Job Intake
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="ready_for_ops">Ready for Ops</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats - Using handoff_status as authoritative */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-muted-foreground">
              {intakes?.filter(i => i.handoff_status === 'draft').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Draft</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">
              {intakes?.filter(i => i.handoff_status === 'ready_for_ops').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Ready for Ops</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">
              {intakes?.filter(i => i.handoff_status === 'converted').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Converted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">
              {intakes?.filter(i => i.handoff_status === 'cancelled').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Cancelled</p>
          </CardContent>
        </Card>
      </div>

      {/* Job List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24" />
            </Card>
          ))}
        </div>
      ) : filteredIntakes?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No jobs found</h3>
            <p className="text-muted-foreground mb-4">
              Create a new job intake to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredIntakes?.map((intake) => (
            <Card
              key={intake.id}
              className="hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/job-intake/${intake.id}`)}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{intake.job_name}</h3>
                      {(() => {
                        const badge = getHandoffStatusBadge(intake.handoff_status);
                        const IconComponent = badge.icon;
                        return (
                          <Badge variant="secondary" className={badge.className}>
                            <IconComponent className="h-3 w-3 mr-1" />
                            {badge.label}
                          </Badge>
                        );
                      })()}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {intake.client_name}
                      </span>
                      {intake.client_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {intake.client_email}
                        </span>
                      )}
                      {intake.proposed_event_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(intake.proposed_event_date), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                    {intake.external_job_id && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        {intake.source}: {intake.external_job_id}
                      </Badge>
                    )}
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
