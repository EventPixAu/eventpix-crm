import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, addDays, subDays, format, parseISO, differenceInDays } from 'date-fns';

export interface DateRange {
  from: Date;
  to: Date;
}

export type DateRangePreset = 'today' | 'last7days' | 'last30days' | 'last90days' | 'custom';

export function getDateRangeForPreset(preset: DateRangePreset, customRange?: DateRange): DateRange {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'last7days':
      return { from: subDays(now, 7), to: now };
    case 'last30days':
      return { from: subDays(now, 30), to: now };
    case 'last90days':
      return { from: subDays(now, 90), to: now };
    case 'custom':
      return customRange || { from: subDays(now, 30), to: now };
    default:
      return { from: subDays(now, 30), to: now };
  }
}

export interface TodaySnapshot {
  eventsToday: number;
  eventsThisWeek: number;
  activeSeriesCount: number;
  photographersWorkingToday: number;
  unassignedRolesToday: number;
  conflictsOrOverridesToday: number;
}

export interface DeliverySLAMetrics {
  deliveredOnTime30Days: number;
  totalDelivered30Days: number;
  onTimePercentage: number;
  overdueEvents: number;
  dueSoon48Hours: number;
  deliveryMethodBreakdown: { method: string; count: number }[];
}

export interface StaffingHealth {
  avgEventsPerPhotographer7Days: number;
  avgEventsPerPhotographer30Days: number;
  heavyLoadPhotographers: number;
  avgStaffRating: number;
  lowRatingEventCount: number;
  newStaffCount: number;
}

export interface CostMetrics {
  costToday: number;
  costThisWeek: number;
  costBySeries: { seriesId: string; seriesName: string; cost: number; eventCount: number }[];
  avgCostPerEvent: number;
  highCostOutliers: { eventId: string; eventName: string; cost: number }[];
  eventsExceedingThreshold: number;
}

export interface ComplianceRisk {
  expiringIn7Days: number;
  expiringIn30Days: number;
  eventsWithOverrides: number;
  missingEquipment: number;
  damagedEquipment: number;
  riskLevel: 'green' | 'amber' | 'red';
}

export interface SeriesPerformance {
  seriesId: string;
  seriesName: string;
  totalEvents: number;
  deliveredEvents: number;
  pendingEvents: number;
  avgDeliveryTimeDays: number;
  avgCostPerEvent: number;
  overrideCount: number;
  staffingCompleteness: number;
}

export interface CityBreakdown {
  city: string;
  state: string;
  totalEvents: number;
  deliveredEvents: number;
  pendingEvents: number;
  overdueEvents: number;
  slaOnTrack: boolean;
}

export interface LocalBusinessAwardsData {
  found: boolean;
  seriesId?: string;
  seriesName?: string;
  totalEvents: number;
  deliveredEvents: number;
  pendingEvents: number;
  overdueEvents: number;
  slaPercentage: number;
  cityBreakdown: CityBreakdown[];
}

export interface ExecutiveDashboardData {
  snapshot: TodaySnapshot;
  delivery: DeliverySLAMetrics;
  staffing: StaffingHealth;
  costs: CostMetrics;
  compliance: ComplianceRisk;
  seriesPerformance: SeriesPerformance[];
  localBusinessAwards: LocalBusinessAwardsData;
  dateRange: DateRange;
}

export interface UseExecutiveDashboardOptions {
  preset: DateRangePreset;
  customRange?: DateRange;
}

export function useExecutiveDashboard(options: UseExecutiveDashboardOptions = { preset: 'last30days' }) {
  const { preset, customRange } = options;
  const dateRange = getDateRangeForPreset(preset, customRange);
  
  return useQuery({
    queryKey: ['executive-dashboard', preset, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async (): Promise<ExecutiveDashboardData> => {
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const rangeStart = dateRange.from;
      const rangeEnd = dateRange.to;
      const sevenDaysAgo = subDays(now, 7);
      const fortyEightHoursFromNow = addDays(now, 2);

      // Parallel fetch all data
      const [
        todayEventsResult,
        weekEventsResult,
        seriesResult,
        todayAssignmentsResult,
        allEventsResult,
        deliveryRecordsResult,
        staffFeedbackResult,
        profilesResult,
        complianceDocsResult,
        equipmentResult,
        auditLogsResult,
        assignmentCostsResult,
      ] = await Promise.all([
        // Events today
        supabase
          .from('events')
          .select('id, event_name, start_at, end_at, ops_status, event_series_id')
          .gte('event_date', format(todayStart, 'yyyy-MM-dd'))
          .lte('event_date', format(todayEnd, 'yyyy-MM-dd')),
        
        // Events this week
        supabase
          .from('events')
          .select('id')
          .gte('event_date', format(weekStart, 'yyyy-MM-dd'))
          .lte('event_date', format(weekEnd, 'yyyy-MM-dd')),
        
        // Active series
        supabase
          .from('event_series')
          .select('id, name')
          .eq('is_active', true),
        
        // Today's assignments
        supabase
          .from('event_assignments')
          .select(`
            id,
            user_id,
            event_id,
            staff_role_id,
            events:event_id (event_date, event_name)
          `)
          .not('events', 'is', null),
        
        // All recent events for delivery analysis
        supabase
          .from('events')
          .select(`
            id,
            event_name,
            event_date,
            event_series_id,
            delivery_deadline,
            ops_status,
            cost_threshold,
            event_series:event_series_id (name)
          `)
          .gte('event_date', format(rangeStart, 'yyyy-MM-dd'))
          .lte('event_date', format(rangeEnd, 'yyyy-MM-dd'))
          .order('event_date', { ascending: false }),
        
        // Delivery records
        supabase
          .from('delivery_records')
          .select(`
            id,
            event_id,
            delivered_at,
            delivery_method,
            events:event_id (event_date, delivery_deadline)
          `)
          .gte('delivered_at', rangeStart.toISOString())
          .lte('delivered_at', rangeEnd.toISOString()),
        
        // Staff feedback
        supabase
          .from('staff_event_feedback')
          .select('rating, user_id, event_id')
          .gte('created_at', rangeStart.toISOString())
          .lte('created_at', rangeEnd.toISOString()),
        
        // Profiles for staff counts
        supabase
          .from('profiles')
          .select('id, created_at, onboarding_status'),
        
        // Compliance documents
        supabase
          .from('staff_compliance_documents')
          .select('id, expiry_date, status'),
        
        // Equipment allocations
        supabase
          .from('equipment_allocations')
          .select('id, status')
          .in('status', ['missing', 'damaged']),
        
        // Audit logs for overrides
        supabase
          .from('audit_log')
          .select('id, action, event_id, created_at')
          .in('action', ['assignment_override', 'compliance_override'])
          .gte('created_at', format(todayStart, 'yyyy-MM-dd')),
        
        // Assignment costs for this week
        supabase
          .from('event_assignments')
          .select(`
            id,
            estimated_cost,
            event_id,
            events:event_id (
              event_date,
              event_name,
              event_series_id,
              cost_threshold,
              event_series:event_series_id (name)
            )
          `)
          .not('estimated_cost', 'is', null),
      ]);

      const todayEvents = todayEventsResult.data || [];
      const weekEvents = weekEventsResult.data || [];
      const series = seriesResult.data || [];
      const allAssignments = todayAssignmentsResult.data || [];
      const recentEvents = allEventsResult.data || [];
      const deliveryRecords = deliveryRecordsResult.data || [];
      const staffFeedback = staffFeedbackResult.data || [];
      const profiles = profilesResult.data || [];
      const complianceDocs = complianceDocsResult.data || [];
      const equipment = equipmentResult.data || [];
      const auditLogs = auditLogsResult.data || [];
      const assignmentCosts = assignmentCostsResult.data || [];

      // Calculate Today Snapshot
      const todayEventIds = new Set(todayEvents.map(e => e.id));
      const todayAssignments = allAssignments.filter(a => {
        const events = a.events as { event_date: string } | null;
        return events && events.event_date === format(now, 'yyyy-MM-dd');
      });
      const photographersWorkingToday = new Set(todayAssignments.map(a => a.user_id).filter(Boolean)).size;
      const unassignedRolesToday = todayAssignments.filter(a => !a.user_id).length;
      const conflictsOrOverridesToday = auditLogs.filter(l => 
        l.action === 'assignment_override' || l.action === 'compliance_override'
      ).length;

      const snapshot: TodaySnapshot = {
        eventsToday: todayEvents.length,
        eventsThisWeek: weekEvents.length,
        activeSeriesCount: series.length,
        photographersWorkingToday,
        unassignedRolesToday,
        conflictsOrOverridesToday,
      };

      // Calculate Delivery SLA Metrics
      const deliveredEvents = new Set(deliveryRecords.map(d => d.event_id));
      let onTimeCount = 0;
      
      deliveryRecords.forEach(record => {
        const events = record.events as { event_date: string; delivery_deadline: string | null } | null;
        if (events?.delivery_deadline && record.delivered_at) {
          const deadline = parseISO(events.delivery_deadline);
          const deliveredAt = parseISO(record.delivered_at);
          if (deliveredAt <= deadline) {
            onTimeCount++;
          }
        }
      });

      const overdueEvents = recentEvents.filter(e => {
        if (!e.delivery_deadline) return false;
        const deadline = parseISO(e.delivery_deadline);
        return deadline < now && !deliveredEvents.has(e.id);
      }).length;

      const dueSoon48Hours = recentEvents.filter(e => {
        if (!e.delivery_deadline) return false;
        const deadline = parseISO(e.delivery_deadline);
        return deadline >= now && deadline <= fortyEightHoursFromNow && !deliveredEvents.has(e.id);
      }).length;

      const methodCounts: Record<string, number> = {};
      deliveryRecords.forEach(d => {
        const method = d.delivery_method || 'unknown';
        methodCounts[method] = (methodCounts[method] || 0) + 1;
      });

      const delivery: DeliverySLAMetrics = {
        deliveredOnTime30Days: onTimeCount,
        totalDelivered30Days: deliveryRecords.length,
        onTimePercentage: deliveryRecords.length > 0 ? (onTimeCount / deliveryRecords.length) * 100 : 100,
        overdueEvents,
        dueSoon48Hours,
        deliveryMethodBreakdown: Object.entries(methodCounts).map(([method, count]) => ({ method, count })),
      };

      // Calculate Staffing Health
      const sevenDayAssignments = allAssignments.filter(a => {
        const events = a.events as { event_date: string } | null;
        if (!events) return false;
        const eventDate = parseISO(events.event_date);
        return eventDate >= sevenDaysAgo && eventDate <= now;
      });

      const rangeAssignments = allAssignments.filter(a => {
        const events = a.events as { event_date: string } | null;
        if (!events) return false;
        const eventDate = parseISO(events.event_date);
        return eventDate >= rangeStart && eventDate <= rangeEnd;
      });

      const uniquePhotographers7 = new Set(sevenDayAssignments.map(a => a.user_id).filter(Boolean));
      const uniquePhotographersRange = new Set(rangeAssignments.map(a => a.user_id).filter(Boolean));

      // Heavy load: 3+ events in one day
      const dailyLoadMap = new Map<string, Map<string, number>>();
      allAssignments.forEach(a => {
        const events = a.events as { event_date: string } | null;
        if (!events || !a.user_id) return;
        const key = `${a.user_id}-${events.event_date}`;
        if (!dailyLoadMap.has(a.user_id)) {
          dailyLoadMap.set(a.user_id, new Map());
        }
        const userMap = dailyLoadMap.get(a.user_id)!;
        userMap.set(events.event_date, (userMap.get(events.event_date) || 0) + 1);
      });

      let heavyLoadCount = 0;
      dailyLoadMap.forEach(userMap => {
        userMap.forEach(count => {
          if (count >= 3) heavyLoadCount++;
        });
      });

      const ratings = staffFeedback.map(f => f.rating);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      const lowRatingCount = ratings.filter(r => r <= 2).length;

      const newStaffCount = profiles.filter(p => {
        const created = parseISO(p.created_at || '');
        return differenceInDays(now, created) <= 30;
      }).length;

      const staffing: StaffingHealth = {
        avgEventsPerPhotographer7Days: uniquePhotographers7.size > 0 
          ? sevenDayAssignments.length / uniquePhotographers7.size 
          : 0,
        avgEventsPerPhotographer30Days: uniquePhotographersRange.size > 0 
          ? rangeAssignments.length / uniquePhotographersRange.size 
          : 0,
        heavyLoadPhotographers: heavyLoadCount,
        avgStaffRating: avgRating,
        lowRatingEventCount: lowRatingCount,
        newStaffCount,
      };

      // Calculate Cost Metrics
      const todayCosts = assignmentCosts.filter(a => {
        const events = a.events as { event_date: string } | null;
        return events && events.event_date === format(now, 'yyyy-MM-dd');
      });

      const weekCosts = assignmentCosts.filter(a => {
        const events = a.events as { event_date: string } | null;
        if (!events) return false;
        const eventDate = parseISO(events.event_date);
        return eventDate >= weekStart && eventDate <= weekEnd;
      });

      const costToday = todayCosts.reduce((sum, a) => sum + (a.estimated_cost || 0), 0);
      const costThisWeek = weekCosts.reduce((sum, a) => sum + (a.estimated_cost || 0), 0);

      // Group by series
      const seriesCostMap = new Map<string, { name: string; cost: number; eventIds: Set<string> }>();
      assignmentCosts.forEach(a => {
        const events = a.events as { 
          event_series_id: string | null; 
          event_series: { name: string } | null;
          event_date: string;
        } | null;
        if (!events?.event_series_id) return;
        
        const existing = seriesCostMap.get(events.event_series_id) || {
          name: (events.event_series as any)?.name || 'Unknown',
          cost: 0,
          eventIds: new Set<string>(),
        };
        existing.cost += a.estimated_cost || 0;
        existing.eventIds.add(a.event_id);
        seriesCostMap.set(events.event_series_id, existing);
      });

      const costBySeries = Array.from(seriesCostMap.entries()).map(([seriesId, data]) => ({
        seriesId,
        seriesName: data.name,
        cost: data.cost,
        eventCount: data.eventIds.size,
      }));

      // Event-level costs for outliers
      const eventCostMap = new Map<string, { name: string; cost: number }>();
      assignmentCosts.forEach(a => {
        const events = a.events as { event_name: string } | null;
        if (!events) return;
        const existing = eventCostMap.get(a.event_id) || { name: events.event_name, cost: 0 };
        existing.cost += a.estimated_cost || 0;
        eventCostMap.set(a.event_id, existing);
      });

      const allCosts = Array.from(eventCostMap.entries())
        .map(([eventId, data]) => ({ eventId, eventName: data.name, cost: data.cost }))
        .sort((a, b) => b.cost - a.cost);

      const top10PercentIndex = Math.ceil(allCosts.length * 0.1);
      const highCostOutliers = allCosts.slice(0, Math.max(top10PercentIndex, 5));

      const avgCostPerEvent = allCosts.length > 0 
        ? allCosts.reduce((sum, e) => sum + e.cost, 0) / allCosts.length 
        : 0;

      const eventsExceedingThreshold = recentEvents.filter(e => {
        if (!e.cost_threshold) return false;
        const eventCost = eventCostMap.get(e.id)?.cost || 0;
        return eventCost > e.cost_threshold;
      }).length;

      const costs: CostMetrics = {
        costToday,
        costThisWeek,
        costBySeries,
        avgCostPerEvent,
        highCostOutliers,
        eventsExceedingThreshold,
      };

      // Calculate Compliance Risk
      const in7Days = addDays(now, 7);
      const in30Days = addDays(now, 30);

      const expiringIn7Days = complianceDocs.filter(d => {
        if (!d.expiry_date || d.status !== 'valid') return false;
        const expiry = parseISO(d.expiry_date);
        return expiry >= now && expiry <= in7Days;
      }).length;

      const expiringIn30Days = complianceDocs.filter(d => {
        if (!d.expiry_date || d.status !== 'valid') return false;
        const expiry = parseISO(d.expiry_date);
        return expiry >= now && expiry <= in30Days;
      }).length;

      const eventsWithOverrides = new Set(
        auditLogs
          .filter(l => l.action === 'assignment_override' || l.action === 'compliance_override')
          .map(l => l.event_id)
          .filter(Boolean)
      ).size;

      const missingEquipment = equipment.filter(e => e.status === 'missing').length;
      const damagedEquipment = equipment.filter(e => e.status === 'damaged').length;

      let riskLevel: 'green' | 'amber' | 'red' = 'green';
      if (overdueEvents > 0 || expiringIn7Days > 2 || missingEquipment > 0) {
        riskLevel = 'red';
      } else if (dueSoon48Hours > 5 || expiringIn30Days > 5 || eventsWithOverrides > 3) {
        riskLevel = 'amber';
      }

      const compliance: ComplianceRisk = {
        expiringIn7Days,
        expiringIn30Days,
        eventsWithOverrides,
        missingEquipment,
        damagedEquipment,
        riskLevel,
      };

      // Calculate Series Performance
      const seriesPerformance: SeriesPerformance[] = series.map(s => {
        const seriesEvents = recentEvents.filter(e => e.event_series_id === s.id);
        const delivered = seriesEvents.filter(e => deliveredEvents.has(e.id));
        const pending = seriesEvents.filter(e => !deliveredEvents.has(e.id));
        
        const seriesCost = costBySeries.find(c => c.seriesId === s.id);
        const avgCost = seriesCost && seriesCost.eventCount > 0 
          ? seriesCost.cost / seriesCost.eventCount 
          : 0;

        const seriesAssignments = allAssignments.filter(a => {
          const events = a.events as { event_date: string } | null;
          return seriesEvents.some(e => e.id === a.event_id);
        });
        
        const totalSlots = seriesAssignments.length;
        const filledSlots = seriesAssignments.filter(a => a.user_id).length;
        const staffingCompleteness = totalSlots > 0 ? (filledSlots / totalSlots) * 100 : 100;

        const seriesOverrides = auditLogs.filter(l => 
          seriesEvents.some(e => e.id === l.event_id)
        ).length;

        // Avg delivery time
        let totalDeliveryDays = 0;
        let deliveredCount = 0;
        delivered.forEach(e => {
          const record = deliveryRecords.find(d => d.event_id === e.id);
          if (record?.delivered_at) {
            const eventDate = parseISO(e.event_date);
            const deliveredAt = parseISO(record.delivered_at);
            totalDeliveryDays += differenceInDays(deliveredAt, eventDate);
            deliveredCount++;
          }
        });

        return {
          seriesId: s.id,
          seriesName: s.name,
          totalEvents: seriesEvents.length,
          deliveredEvents: delivered.length,
          pendingEvents: pending.length,
          avgDeliveryTimeDays: deliveredCount > 0 ? totalDeliveryDays / deliveredCount : 0,
          avgCostPerEvent: avgCost,
          overrideCount: seriesOverrides,
          staffingCompleteness,
        };
      });

      // Calculate Local Business Awards Spotlight
      const lbaSeries = series.find(s => 
        s.name.toLowerCase().includes('local business awards') ||
        s.name.toLowerCase().includes('business awards')
      );

      let localBusinessAwards: LocalBusinessAwardsData;

      if (lbaSeries) {
        // Fetch LBA events with city info
        const { data: lbaEvents } = await supabase
          .from('events')
          .select('id, event_name, event_date, city, state, delivery_deadline')
          .eq('event_series_id', lbaSeries.id);

        const lbaEventList = lbaEvents || [];
        const lbaDelivered = lbaEventList.filter(e => deliveredEvents.has(e.id));
        const lbaPending = lbaEventList.filter(e => !deliveredEvents.has(e.id));
        const lbaOverdue = lbaEventList.filter(e => {
          if (!e.delivery_deadline) return false;
          const deadline = parseISO(e.delivery_deadline);
          return deadline < now && !deliveredEvents.has(e.id);
        });

        // Group by city
        const cityMap = new Map<string, { 
          city: string; 
          state: string; 
          events: typeof lbaEventList;
        }>();

        lbaEventList.forEach(e => {
          const city = e.city || 'Unknown';
          const state = e.state || '';
          const key = `${city}-${state}`;
          const existing = cityMap.get(key) || { city, state, events: [] };
          existing.events.push(e);
          cityMap.set(key, existing);
        });

        const cityBreakdown: CityBreakdown[] = Array.from(cityMap.values())
          .map(({ city, state, events }) => {
            const delivered = events.filter(e => deliveredEvents.has(e.id)).length;
            const pending = events.filter(e => !deliveredEvents.has(e.id)).length;
            const overdue = events.filter(e => {
              if (!e.delivery_deadline) return false;
              const deadline = parseISO(e.delivery_deadline);
              return deadline < now && !deliveredEvents.has(e.id);
            }).length;

            return {
              city,
              state,
              totalEvents: events.length,
              deliveredEvents: delivered,
              pendingEvents: pending,
              overdueEvents: overdue,
              slaOnTrack: overdue === 0,
            };
          })
          .sort((a, b) => b.totalEvents - a.totalEvents);

        const slaPercentage = lbaEventList.length > 0 
          ? ((lbaEventList.length - lbaOverdue.length) / lbaEventList.length) * 100
          : 100;

        localBusinessAwards = {
          found: true,
          seriesId: lbaSeries.id,
          seriesName: lbaSeries.name,
          totalEvents: lbaEventList.length,
          deliveredEvents: lbaDelivered.length,
          pendingEvents: lbaPending.length,
          overdueEvents: lbaOverdue.length,
          slaPercentage,
          cityBreakdown,
        };
      } else {
        localBusinessAwards = {
          found: false,
          totalEvents: 0,
          deliveredEvents: 0,
          pendingEvents: 0,
          overdueEvents: 0,
          slaPercentage: 100,
          cityBreakdown: [],
        };
      }

      return {
        snapshot,
        delivery,
        staffing,
        costs,
        compliance,
        seriesPerformance,
        localBusinessAwards,
        dateRange,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 5, // Auto-refresh every 5 minutes
  });
}
