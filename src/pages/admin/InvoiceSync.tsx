/**
 * INVOICE STATUS SYNC PAGE (XERO)
 * 
 * Admin-only page for viewing and syncing invoice statuses from Xero.
 */
import { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  DollarSign,
  FileText,
  Link2,
  Link2Off,
  Settings
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { 
  useEventsWithInvoices, 
  useXeroSyncLogs, 
  useSyncInvoiceStatus,
  useXeroConnectionStatus,
  useXeroAuthorize,
  useXeroRefreshToken,
  useXeroDisconnect
} from '@/hooks/useXeroSync';

const STATUS_COLORS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  sent: { label: 'Sent', variant: 'outline' },
  unpaid: { label: 'Unpaid', variant: 'outline' },
  overdue: { label: 'Overdue', variant: 'destructive' },
  paid: { label: 'Paid', variant: 'default' },
  void: { label: 'Void', variant: 'secondary' },
};

export default function InvoiceSync() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { data: events, isLoading: eventsLoading } = useEventsWithInvoices();
  const { data: syncLogs } = useXeroSyncLogs();
  const { data: xeroStatus, isLoading: statusLoading, refetch: refetchStatus } = useXeroConnectionStatus();
  
  const syncInvoices = useSyncInvoiceStatus();
  const xeroAuthorize = useXeroAuthorize();
  const xeroRefresh = useXeroRefreshToken();
  const xeroDisconnect = useXeroDisconnect();

  // Handle OAuth callback params
  useEffect(() => {
    const connected = searchParams.get('xero_connected');
    const error = searchParams.get('xero_error');
    
    if (connected === 'true') {
      toast({ title: 'Xero connected successfully!' });
      refetchStatus();
      setSearchParams({});
    } else if (error) {
      toast({ 
        title: 'Xero connection failed', 
        description: error.replace(/_/g, ' '),
        variant: 'destructive'
      });
      setSearchParams({});
    }
  }, [searchParams, toast, refetchStatus, setSearchParams]);
  
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleSync = () => {
    syncInvoices.mutate();
  };

  const handleConnect = () => {
    xeroAuthorize.mutate();
  };

  const handleRefresh = () => {
    xeroRefresh.mutate();
  };

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect from Xero?')) {
      xeroDisconnect.mutate();
    }
  };

  const lastSync = syncLogs?.[0];
  const paidCount = events?.filter(e => e.invoice_status === 'paid').length || 0;
  const unpaidCount = events?.filter(e => e.invoice_status && e.invoice_status !== 'paid').length || 0;

  const isConnected = xeroStatus?.connected && !xeroStatus?.isExpired;

  return (
    <AppLayout>
      <PageHeader
        title="Xero Status"
        description="View invoice payment status synced from Xero"
      />

      {/* Xero Connection Status */}
      {!statusLoading && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Xero Connection</CardTitle>
                {isConnected ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : xeroStatus?.connected && xeroStatus?.isExpired ? (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Token Expired
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Link2Off className="h-3 w-3 mr-1" />
                    Not Connected
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                {isConnected ? (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleRefresh}
                      disabled={xeroRefresh.isPending}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${xeroRefresh.isPending ? 'animate-spin' : ''}`} />
                      Refresh Token
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleDisconnect}
                      disabled={xeroDisconnect.isPending}
                    >
                      Disconnect
                    </Button>
                  </>
                ) : xeroStatus?.isExpired ? (
                  <Button 
                    size="sm"
                    onClick={handleRefresh}
                    disabled={xeroRefresh.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${xeroRefresh.isPending ? 'animate-spin' : ''}`} />
                    Refresh Token
                  </Button>
                ) : (
                  <Button 
                    size="sm"
                    onClick={handleConnect}
                    disabled={xeroAuthorize.isPending}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Connect to Xero
                  </Button>
                )}
              </div>
            </div>
            {xeroStatus?.tenants && xeroStatus.tenants.length > 0 && (
              <CardDescription>
                Connected to: {xeroStatus.tenants.map(t => t.tenant_name).join(', ')}
              </CardDescription>
            )}
          </CardHeader>
        </Card>
      )}

      {/* Setup Required Alert - only show if not connected */}
      {!isConnected && !statusLoading && (
        <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
          <Settings className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-500">Xero Connection Required</AlertTitle>
          <AlertDescription>
            Connect to Xero above to enable automatic invoice status sync.
            You'll need your Xero credentials configured in the backend.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
                <p className="text-2xl font-bold">{events?.length || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold text-green-600">{paidCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unpaid</p>
                <p className="text-2xl font-bold text-amber-600">{unpaidCount}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Sync</p>
                <p className="text-sm font-medium">
                  {lastSync ? format(new Date(lastSync.started_at), 'MMM d, HH:mm') : 'Never'}
                </p>
              </div>
              <Button 
                size="sm" 
                onClick={handleSync}
                disabled={syncInvoices.isPending || !isConnected}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncInvoices.isPending ? 'animate-spin' : ''}`} />
                Sync
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Event Invoices</CardTitle>
          <CardDescription>Invoice references and payment status from events</CardDescription>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !events?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No events with invoice references</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice Ref</TableHead>
                  <TableHead>Xero Tag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => {
                  const statusConfig = STATUS_COLORS[event.invoice_status || 'draft'] || STATUS_COLORS.draft;
                  return (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.event_name}</TableCell>
                      <TableCell>{format(new Date(event.event_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {event.invoice_reference}
                        </code>
                      </TableCell>
                      <TableCell>
                        {(event as any).xero_tag ? (
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {(event as any).xero_tag}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {event.invoice_paid_at 
                          ? format(new Date(event.invoice_paid_at), 'MMM d, yyyy')
                          : '—'
                        }
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sync History */}
      {syncLogs && syncLogs.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Sync History</CardTitle>
            <CardDescription>Recent sync attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Events Synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{format(new Date(log.started_at), 'MMM d, HH:mm')}</TableCell>
                    <TableCell className="capitalize">{log.sync_type.replace('_', ' ')}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'completed' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.events_synced}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
