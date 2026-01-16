/**
 * CrewTeamList - Display assigned team members for an event
 * 
 * Shows photographers, assistants, and videographers with their roles.
 * Highlights the current user.
 */

import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  user_id: string | null;
  role_on_event: string | null;
  profile?: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  staff?: {
    name: string;
  } | null;
  staff_role?: {
    name: string;
  } | null;
}

interface CrewTeamListProps {
  assignments: TeamMember[];
}

export function CrewTeamList({ assignments }: CrewTeamListProps) {
  const { user } = useAuth();

  if (assignments.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Team ({assignments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {assignments.map((assignment, index) => {
          const name = assignment.profile?.full_name || assignment.staff?.name || 'Unknown';
          const role = assignment.staff_role?.name || assignment.role_on_event || 'Staff';
          const isMe = assignment.user_id === user?.id;
          const initials = name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

          return (
            <motion.div
              key={assignment.id}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg',
                isMe ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
              )}
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className={cn(
                  isMe && 'bg-primary text-primary-foreground'
                )}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{name}</span>
                  {isMe && (
                    <Badge variant="default" className="text-xs">You</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground capitalize">{role}</p>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
