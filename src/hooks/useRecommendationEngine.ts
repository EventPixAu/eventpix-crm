import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format, parseISO, differenceInMinutes } from 'date-fns';

export interface RoleRequirement {
  role: string;
  count: number;
  required_skills?: string[];
}

export interface StaffCandidate {
  userId: string;
  fullName: string;
  email: string;
  seniority: string;
  homeCity: string | null;
  homeState: string | null;
  travelReady: boolean;
  skills: string[];
  defaultRoleId: string | null;
  defaultRoleName: string | null;
}

export interface RecommendationWarning {
  type: 'unavailable' | 'limited' | 'time_conflict' | 'tight_changeover' | 'high_workload';
  message: string;
  severity: 'error' | 'warning';
}

export interface StaffRecommendation {
  candidate: StaffCandidate;
  role: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  rationale: string[];
  warnings: RecommendationWarning[];
}

export interface EventRecommendation {
  eventId: string;
  eventName: string;
  eventDate: string;
  city: string | null;
  state: string | null;
  startAt: string | null;
  endAt: string | null;
  recommendations: StaffRecommendation[];
  roleRequirements: RoleRequirement[];
}

export interface DraftAssignment {
  id?: string;
  scope: 'single_event' | 'bulk' | 'series';
  eventIds: string[];
  eventRecommendations: EventRecommendation[];
  status: 'draft' | 'applied' | 'discarded';
  createdAt?: string;
}

// Scoring weights
const WEIGHTS = {
  availability: 30,
  no_conflict: 25,
  location_match: 15,
  skill_match: 15,
  seniority_match: 10,
  workload_penalty: -10,
  tight_changeover_penalty: -15,
};

async function getStaffAvailability(userIds: string[], date: string) {
  const { data, error } = await supabase
    .from('staff_availability')
    .select('user_id, availability_status, notes')
    .in('user_id', userIds)
    .eq('date', date);
  
  if (error) throw error;
  
  return (data || []).reduce((acc, item) => {
    acc[item.user_id] = item;
    return acc;
  }, {} as Record<string, { availability_status: string; notes: string | null }>);
}

async function getStaffAssignments(userIds: string[], date: string) {
  const dateStart = `${date}T00:00:00`;
  const dateEnd = `${date}T23:59:59`;
  
  const { data, error } = await supabase
    .from('event_assignments')
    .select(`
      user_id,
      event:events(
        id,
        event_name,
        start_at,
        end_at,
        city,
        state
      )
    `)
    .in('user_id', userIds);
  
  if (error) throw error;
  
  // Filter to only events on the target date
  const filtered = (data || []).filter(a => {
    if (!a.event?.start_at) return false;
    const eventDate = format(parseISO(a.event.start_at), 'yyyy-MM-dd');
    return eventDate === date;
  });
  
  // Group by user
  return filtered.reduce((acc, item) => {
    if (!acc[item.user_id]) acc[item.user_id] = [];
    if (item.event) acc[item.user_id].push(item.event);
    return acc;
  }, {} as Record<string, any[]>);
}

function calculateScore(
  candidate: StaffCandidate,
  event: { city: string | null; state: string | null; startAt: string | null; endAt: string | null },
  roleRequirement: RoleRequirement,
  availability: { availability_status: string; notes: string | null } | undefined,
  existingAssignments: any[]
): { score: number; rationale: string[]; warnings: RecommendationWarning[] } {
  let score = 0;
  const rationale: string[] = [];
  const warnings: RecommendationWarning[] = [];
  
  // Availability check
  const availStatus = availability?.availability_status || 'available';
  if (availStatus === 'available') {
    score += WEIGHTS.availability;
    rationale.push('Available');
  } else if (availStatus === 'limited') {
    score += WEIGHTS.availability * 0.5;
    rationale.push('Limited availability');
    warnings.push({
      type: 'limited',
      message: availability?.notes || 'Limited availability for this day',
      severity: 'warning',
    });
  } else {
    warnings.push({
      type: 'unavailable',
      message: 'Marked as unavailable',
      severity: 'error',
    });
  }
  
  // Check for time conflicts
  let hasConflict = false;
  let hasTightChangeover = false;
  
  if (event.startAt && event.endAt) {
    const eventStart = parseISO(event.startAt);
    const eventEnd = parseISO(event.endAt);
    
    for (const existing of existingAssignments) {
      if (!existing.start_at) continue;
      
      const existingStart = parseISO(existing.start_at);
      const existingEnd = existing.end_at ? parseISO(existing.end_at) : new Date(existingStart.getTime() + 2 * 60 * 60 * 1000);
      
      // Check overlap
      if (eventStart < existingEnd && eventEnd > existingStart) {
        hasConflict = true;
        warnings.push({
          type: 'time_conflict',
          message: `Conflicts with "${existing.event_name}"`,
          severity: 'error',
        });
      } else {
        // Check tight changeover
        const gapMinutes = Math.min(
          Math.abs(differenceInMinutes(eventStart, existingEnd)),
          Math.abs(differenceInMinutes(existingStart, eventEnd))
        );
        
        if (gapMinutes < 45) {
          hasTightChangeover = true;
          warnings.push({
            type: 'tight_changeover',
            message: `Only ${gapMinutes} min gap with "${existing.event_name}"`,
            severity: 'warning',
          });
        }
      }
    }
  }
  
  if (!hasConflict) {
    score += WEIGHTS.no_conflict;
    if (existingAssignments.length === 0) {
      rationale.push('No conflicts');
    }
  }
  
  if (hasTightChangeover) {
    score += WEIGHTS.tight_changeover_penalty;
  }
  
  // Location match
  if (event.city && candidate.homeCity) {
    if (candidate.homeCity.toLowerCase() === event.city.toLowerCase()) {
      score += WEIGHTS.location_match;
      rationale.push(`Same city: ${candidate.homeCity}`);
    } else if (candidate.travelReady) {
      score += WEIGHTS.location_match * 0.5;
      rationale.push('Travel ready');
    }
  } else if (event.state && candidate.homeState) {
    if (candidate.homeState.toLowerCase() === event.state.toLowerCase()) {
      score += WEIGHTS.location_match * 0.7;
      rationale.push(`Same state: ${candidate.homeState}`);
    }
  }
  
  // Skill match
  const requiredSkills = roleRequirement.required_skills || [];
  if (requiredSkills.length > 0) {
    const matchedSkills = candidate.skills.filter(s => 
      requiredSkills.some(rs => rs.toLowerCase() === s.toLowerCase())
    );
    const skillMatchRatio = matchedSkills.length / requiredSkills.length;
    score += WEIGHTS.skill_match * skillMatchRatio;
    
    if (matchedSkills.length > 0) {
      rationale.push(`Matched skills: ${matchedSkills.join(', ')}`);
    }
  } else {
    // No specific skills required, give partial points
    score += WEIGHTS.skill_match * 0.5;
  }
  
  // Seniority match
  const roleLower = roleRequirement.role.toLowerCase();
  if (roleLower.includes('lead') && candidate.seniority === 'lead') {
    score += WEIGHTS.seniority_match;
    rationale.push('Lead photographer');
  } else if (roleLower.includes('second') && candidate.seniority !== 'lead') {
    score += WEIGHTS.seniority_match;
  } else if (!roleLower.includes('lead') && !roleLower.includes('second')) {
    score += WEIGHTS.seniority_match * 0.5;
  }
  
  // Workload penalty
  if (existingAssignments.length >= 2) {
    score += WEIGHTS.workload_penalty * (existingAssignments.length - 1);
    warnings.push({
      type: 'high_workload',
      message: `Already assigned to ${existingAssignments.length} events today`,
      severity: 'warning',
    });
  } else if (existingAssignments.length === 1) {
    rationale.push('Already assigned to 1 event today');
  }
  
  return { score: Math.max(0, score), rationale, warnings };
}

function getConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

export function useGenerateRecommendations() {
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      eventIds,
      roleRequirements,
      scope = 'single_event',
    }: {
      eventIds: string[];
      roleRequirements?: RoleRequirement[];
      scope?: 'single_event' | 'bulk' | 'series';
    }): Promise<DraftAssignment> => {
      // Fetch events
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          event_name,
          event_date,
          start_at,
          end_at,
          city,
          state,
          event_series:event_series(
            id,
            name,
            default_roles_json,
            default_photographers_required
          )
        `)
        .in('id', eventIds);
      
      if (eventsError) throw eventsError;
      
      // Fetch all active staff with skills
      const { data: staffData, error: staffError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          status,
          home_city,
          home_state,
          travel_ready,
          seniority,
          default_role_id,
          staff_role:staff_roles(id, name)
        `)
        .eq('status', 'active');
      
      if (staffError) throw staffError;
      
      // Get user roles to filter only photographers
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'photographer');
      
      if (rolesError) throw rolesError;
      
      const photographerIds = new Set((userRoles || []).map(r => r.user_id));
      const photographers = (staffData || []).filter(s => photographerIds.has(s.id));
      
      // Get all staff skills
      const { data: skillsData, error: skillsError } = await supabase
        .from('staff_skills')
        .select(`
          user_id,
          skill:skills(name)
        `);
      
      if (skillsError) throw skillsError;
      
      const skillsByUser = (skillsData || []).reduce((acc, item) => {
        if (!acc[item.user_id]) acc[item.user_id] = [];
        if (item.skill?.name) acc[item.user_id].push(item.skill.name);
        return acc;
      }, {} as Record<string, string[]>);
      
      const candidates: StaffCandidate[] = photographers.map(p => ({
        userId: p.id,
        fullName: p.full_name || p.email,
        email: p.email,
        seniority: p.seniority || 'mid',
        homeCity: p.home_city,
        homeState: p.home_state,
        travelReady: p.travel_ready || false,
        skills: skillsByUser[p.id] || [],
        defaultRoleId: p.default_role_id,
        defaultRoleName: (p.staff_role as any)?.name || null,
      }));
      
      const eventRecommendations: EventRecommendation[] = [];
      
      for (const event of events || []) {
        const eventDate = event.event_date;
        
        // Determine role requirements
        let roles: RoleRequirement[] = roleRequirements || [];
        
        if (roles.length === 0) {
          // Check series defaults
          const series = event.event_series as any;
          if (series?.default_roles_json) {
            roles = series.default_roles_json as RoleRequirement[];
          } else {
            // Default to single photographer
            const required = series?.default_photographers_required || 1;
            roles = [{ role: 'Photographer', count: required }];
          }
        }
        
        // Get availability and assignments for this date
        const userIds = candidates.map(c => c.userId);
        const [availabilityMap, assignmentsMap] = await Promise.all([
          getStaffAvailability(userIds, eventDate),
          getStaffAssignments(userIds, eventDate),
        ]);
        
        const recommendations: StaffRecommendation[] = [];
        const assignedUsers = new Set<string>();
        
        // For each role requirement
        for (const role of roles) {
          const roleRecommendations: { candidate: StaffCandidate; score: number; rationale: string[]; warnings: RecommendationWarning[] }[] = [];
          
          for (const candidate of candidates) {
            // Skip already assigned for this event
            if (assignedUsers.has(candidate.userId)) continue;
            
            const availability = availabilityMap[candidate.userId];
            const assignments = assignmentsMap[candidate.userId] || [];
            
            const { score, rationale, warnings } = calculateScore(
              candidate,
              {
                city: event.city,
                state: event.state,
                startAt: event.start_at,
                endAt: event.end_at,
              },
              role,
              availability,
              assignments
            );
            
            roleRecommendations.push({ candidate, score, rationale, warnings });
          }
          
          // Sort by score descending
          roleRecommendations.sort((a, b) => b.score - a.score);
          
          // Take top candidates for this role
          for (let i = 0; i < role.count && i < roleRecommendations.length; i++) {
            const rec = roleRecommendations[i];
            assignedUsers.add(rec.candidate.userId);
            
            recommendations.push({
              candidate: rec.candidate,
              role: role.role,
              score: rec.score,
              confidence: getConfidence(rec.score),
              rationale: rec.rationale,
              warnings: rec.warnings,
            });
          }
        }
        
        eventRecommendations.push({
          eventId: event.id,
          eventName: event.event_name,
          eventDate: event.event_date,
          city: event.city,
          state: event.state,
          startAt: event.start_at,
          endAt: event.end_at,
          recommendations,
          roleRequirements: roles,
        });
      }
      
      return {
        scope,
        eventIds,
        eventRecommendations,
        status: 'draft',
      };
    },
  });
}

export function useSaveAssignmentDraft() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (draft: DraftAssignment) => {
      const { data, error } = await supabase
        .from('assignment_drafts')
        .insert({
          created_by: user?.id,
          scope: draft.scope,
          event_ids: draft.eventIds,
          draft_json: draft.eventRecommendations as any,
          status: draft.status,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-drafts'] });
    },
  });
}

export function useApplyAssignmentDraft() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      draft,
      draftId,
      overrideWarnings,
    }: {
      draft: DraftAssignment;
      draftId?: string;
      overrideWarnings?: { unavailable: boolean; conflicts: boolean; tight: boolean };
    }) => {
      const assignments: { event_id: string; user_id: string; staff_role_id?: string; assignment_notes?: string }[] = [];
      const auditEntries: { eventId: string; warnings: any[]; userId: string }[] = [];
      
      for (const eventRec of draft.eventRecommendations) {
        for (const rec of eventRec.recommendations) {
          // Check if we should skip based on warnings
          const hasError = rec.warnings.some(w => w.severity === 'error');
          if (hasError && !overrideWarnings?.unavailable && !overrideWarnings?.conflicts) {
            continue;
          }
          
          assignments.push({
            event_id: eventRec.eventId,
            user_id: rec.candidate.userId,
            staff_role_id: rec.candidate.defaultRoleId || undefined,
            assignment_notes: `Auto-assigned: ${rec.role} (${rec.confidence} confidence)`,
          });
          
          if (rec.warnings.length > 0) {
            auditEntries.push({
              eventId: eventRec.eventId,
              warnings: rec.warnings,
              userId: rec.candidate.userId,
            });
          }
        }
      }
      
      // Insert assignments
      if (assignments.length > 0) {
        const { error } = await supabase
          .from('event_assignments')
          .insert(assignments);
        
        if (error) throw error;
      }
      
      // Log overrides to audit
      for (const entry of auditEntries) {
        await supabase.from('audit_log').insert({
          actor_user_id: user?.id,
          event_id: entry.eventId,
          action: 'assignment_override',
          after: {
            user_id: entry.userId,
            warnings: entry.warnings,
            applied_from: 'recommendation_draft',
          },
        });
      }
      
      // Update draft status if saved
      if (draftId) {
        await supabase
          .from('assignment_drafts')
          .update({ status: 'applied' })
          .eq('id', draftId);
      }
      
      return { assignmentsCreated: assignments.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-drafts'] });
    },
  });
}
