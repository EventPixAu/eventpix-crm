/**
 * SALES DASHBOARD
 * 
 * Sales-focused dashboard for lead tracking and conversion:
 * - Lead pipeline summary
 * - Quotes needing follow-up
 * - Contracts awaiting signature
 * - Recent activity
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { differenceInDays, parseISO, subDays } from 'date-fns';
import { motion } from 'framer-motion';
import { 
  Target, 
  DollarSign,
  FileSignature,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateLeadDialog } from '@/components/CreateLeadDialog';

export default function SalesDashboard() {
  // Fetch leads
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['sales-dashboard-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch quotes
  const { data: quotes = [] } = useQuery({
    queryKey: ['sales-dashboard-quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, leads(lead_name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch contracts
  const { data: contracts = [] } = useQuery({
    queryKey: ['sales-dashboard-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*, clients(business_name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Calculate stats
  const stats = useMemo(() => {
    const activeLeads = leads.filter(l => 
      l.status !== 'won' && l.status !== 'lost'
    );
    
    const pendingQuotes = quotes.filter(q => 
      q.status === 'draft' || q.status === 'sent'
    );
    
    const awaitingSignature = contracts.filter(c => 
      c.contract_status === 'sent' || c.status === 'sent'
    );

    // Stale leads (no update in 7+ days)
    const sevenDaysAgo = subDays(new Date(), 7);
    const staleLeads = activeLeads.filter(l => {
      const updatedAt = l.updated_at ? parseISO(l.updated_at) : parseISO(l.created_at);
      return updatedAt < sevenDaysAgo;
    });

    // Quote values
    const pendingQuoteValue = pendingQuotes.reduce((sum, q) => sum + ((q as any).grand_total || 0), 0);

    return {
      activeLeads: activeLeads.length,
      staleLeads: staleLeads.length,
      pendingQuotes: pendingQuotes.length,
      pendingQuoteValue,
      awaitingSignature: awaitingSignature.length,
      wonThisMonth: leads.filter(l => {
        if (l.status !== 'won') return false;
        const wonDate = l.updated_at ? parseISO(l.updated_at) : null;
        if (!wonDate) return false;
        const now = new Date();
        return wonDate.getMonth() === now.getMonth() && wonDate.getFullYear() === now.getFullYear();
      }).length,
      lostThisMonth: leads.filter(l => {
        if (l.status !== 'lost') return false;
        const lostDate = l.updated_at ? parseISO(l.updated_at) : null;
        if (!lostDate) return false;
        const now = new Date();
        return lostDate.getMonth() === now.getMonth() && lostDate.getFullYear() === now.getFullYear();
      }).length
    };
  }, [leads, quotes, contracts]);

  // Get leads needing follow-up (stale or no activity)
  const leadsNeedingAttention = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    return leads
      .filter(l => {
        if (l.status === 'won' || l.status === 'lost') return false;
        const updatedAt = l.updated_at ? parseISO(l.updated_at) : parseISO(l.created_at);
        return updatedAt < sevenDaysAgo;
      })
      .slice(0, 5);
  }, [leads]);

  // Get quotes awaiting response
  const quotesAwaitingResponse = useMemo(() => {
    return quotes
      .filter(q => q.status === 'sent')
      .slice(0, 5);
  }, [quotes]);

  // Get contracts awaiting signature
  const contractsAwaitingSignature = useMemo(() => {
    return contracts
      .filter(c => c.contract_status === 'sent' || c.status === 'sent')
      .slice(0, 5);
  }, [contracts]);

  const getDaysAgo = (dateStr: string) => {
    return differenceInDays(new Date(), parseISO(dateStr));
  };

  return (
    <AppLayout>
      <PageHeader
        title="Sales Dashboard"
        description="Track leads, quotes, and conversions"
        actions={<CreateLeadDialog />}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatCard
            title="Active Leads"
            value={stats.activeLeads}
            icon={Target}
            variant="primary"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatCard
            title="Stale Leads (7d+)"
            value={stats.staleLeads}
            icon={AlertTriangle}
            variant={stats.staleLeads > 0 ? "warning" : "default"}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StatCard
            title="Pending Quotes"
            value={stats.pendingQuotes}
            icon={DollarSign}
            variant="default"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <StatCard
            title="Awaiting Signature"
            value={stats.awaitingSignature}
            icon={FileSignature}
            variant="default"
          />
        </motion.div>
      </div>

      {/* Conversion Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-success/30 bg-success/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-success">{stats.wonThisMonth}</p>
                  <p className="text-sm text-muted-foreground">Won this month</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{stats.lostThisMonth}</p>
                  <p className="text-sm text-muted-foreground">Lost this month</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Leads Needing Attention */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Leads Need Follow-up
              </CardTitle>
              <Link to="/sales/leads" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {leadsLoading ? (
                <div className="text-center text-muted-foreground py-8">Loading...</div>
              ) : leadsNeedingAttention.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-10 w-10 mx-auto text-success mb-2" />
                  <p className="text-sm text-muted-foreground">All leads up to date!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leadsNeedingAttention.map((lead) => (
                    <Link
                      key={lead.id}
                      to={`/sales/leads/${lead.id}`}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{lead.lead_name}</p>
                      </div>
                      <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10">
                        {getDaysAgo(lead.updated_at || lead.created_at)}d ago
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quotes Awaiting Response */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-5 w-5 text-primary" />
                Quotes Sent
              </CardTitle>
              <Link to="/sales/quotes" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {quotesAwaitingResponse.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No pending quotes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {quotesAwaitingResponse.map((quote) => (
                    <Link
                      key={quote.id}
                      to={`/sales/quotes/${quote.id}`}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">
                          {(quote as any).leads?.lead_name || 'Budget'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ${((quote as any).grand_total || 0).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {getDaysAgo(quote.sent_at || quote.created_at)}d
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Contracts Awaiting Signature */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSignature className="h-5 w-5 text-primary" />
                Awaiting Signature
              </CardTitle>
              <Link to="/sales/contracts" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {contractsAwaitingSignature.length === 0 ? (
                <div className="text-center py-8">
                  <FileSignature className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No pending contracts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contractsAwaitingSignature.map((contract) => (
                    <Link
                      key={contract.id}
                      to={`/sales/contracts/${contract.id}`}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{contract.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {(contract as any).clients?.business_name}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10">
                        Sent
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
