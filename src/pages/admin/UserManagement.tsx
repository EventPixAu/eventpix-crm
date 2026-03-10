import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  UserPlus, 
  Mail, 
  MoreHorizontal, 
  RefreshCw, 
  XCircle,
  Check,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  useUsers,
  useInvitations,
  useInviteUser,
  useResendInvitation,
  useRevokeInvitation,
  useSetUserActive,
  useSetUserRole,
  type UserProfile,
  type UserInvitation,
} from '@/hooks/useUserManagement';
import { useAllStaffRoles } from '@/hooks/useAdminStaffRoles';

function getRoleBadgeVariant(role: string | null) {
  switch (role) {
    case 'admin': return 'destructive';
    case 'sales': return 'default';
    case 'operations': return 'secondary';
    case 'photographer': return 'outline';
    case 'assistant': return 'outline';
    default: return 'outline';
  }
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'pending': return 'secondary';
    case 'provisioned': return 'secondary';
    case 'emailed': return 'default';
    case 'accepted': return 'outline';
    case 'failed': return 'destructive';
    case 'revoked': return 'destructive';
    default: return 'outline';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'pending': return <Clock className="h-3 w-3" />;
    case 'provisioned': return <Clock className="h-3 w-3" />;
    case 'emailed': return <Mail className="h-3 w-3" />;
    case 'accepted': return <Check className="h-3 w-3" />;
    case 'failed': return <AlertTriangle className="h-3 w-3" />;
    case 'revoked': return <AlertCircle className="h-3 w-3" />;
    default: return null;
  }
}

function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('photographer');
  const { data: staffRoles = [] } = useAllStaffRoles();
  const ROLES = staffRoles.filter(r => r.is_active).map(r => ({ value: r.name.toLowerCase(), label: r.name, description: r.description || '' }));
  
  const inviteUser = useInviteUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await inviteUser.mutateAsync({ email, role });
    
    setOpen(false);
    setEmail('');
    setRole('photographer');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
          <DialogDescription>
            Create an account and send an invitation email. The user will be able to set their password when they click the link.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div>
                        <div className="font-medium">{r.label}</div>
                        <div className="text-xs text-muted-foreground">{r.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={inviteUser.isPending}>
              {inviteUser.isPending ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UsersTable({ users }: { users: UserProfile[] }) {
  const { toast } = useToast();
  const setUserActive = useSetUserActive();
  const setUserRole = useSetUserRole();
  const { data: staffRoles = [] } = useAllStaffRoles();
  const ROLES = staffRoles.filter(r => r.is_active).map(r => ({ value: r.name.toLowerCase(), label: r.name, description: r.description || '' }));
  const [sendingAccessEmail, setSendingAccessEmail] = useState<string | null>(null);

  const handleSendAccessEmail = async (user: UserProfile) => {
    if (!user.email) {
      toast({
        title: 'No email address',
        description: 'This user does not have an email address.',
        variant: 'destructive',
      });
      return;
    }

    setSendingAccessEmail(user.id);
    try {
      // Call edge function to generate and send access link
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { resend_access_for_user_id: user.id, email: user.email },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to send access email');

      toast({
        title: 'Access email sent',
        description: `An access email has been sent to ${user.email}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Failed to send access email',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSendingAccessEmail(null);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              No users found
            </TableCell>
          </TableRow>
        ) : (
          users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">
                {user.full_name || 'Unnamed'}
              </TableCell>
              <TableCell>{user.email || '-'}</TableCell>
              <TableCell>
                <Select
                  value={user.role || ''}
                  onValueChange={(newRole) => setUserRole.mutate({ userId: user.id, role: newRole })}
                  disabled={setUserRole.isPending}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="No role">
                      {user.role && (
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {user.role}
                        </Badge>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {user.registration_status === 'pending' ? (
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      Pending
                    </Badge>
                  ) : user.registration_status === 'inactive' ? (
                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                      <XCircle className="h-3 w-3" />
                      Inactive
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-green-500/30 text-green-500">
                      <CheckCircle className="h-3 w-3" />
                      Active
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {user.created_at 
                  ? formatDistanceToNow(new Date(user.created_at), { addSuffix: true })
                  : '-'
                }
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => handleSendAccessEmail(user)}
                      disabled={sendingAccessEmail === user.id}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {sendingAccessEmail === user.id ? 'Sending...' : 'Send Access Email'}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setUserActive.mutate({ userId: user.id, isActive: !user.is_active })}
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function InvitationsTable({ invitations }: { invitations: UserInvitation[] }) {
  const { toast } = useToast();
  const resendInvitation = useResendInvitation();
  const revokeInvitation = useRevokeInvitation();

  const canResend = (status: string) =>
    status === 'pending' || status === 'provisioned' || status === 'failed' || status === 'emailed';
  const canRevoke = (status: string) => status === 'pending' || status === 'emailed';

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Invited By</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              No invitations
            </TableCell>
          </TableRow>
        ) : (
          invitations.map((invite) => (
            <TableRow key={invite.id}>
              <TableCell className="font-medium">{invite.email}</TableCell>
              <TableCell>
                <Badge variant={getRoleBadgeVariant(invite.role)}>
                  {invite.role}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge variant={getStatusBadgeVariant(invite.status)} className="gap-1 w-fit">
                    {getStatusIcon(invite.status)}
                    {invite.status}
                  </Badge>
                  {invite.error && (
                    <span className="text-xs text-destructive">{invite.error}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {invite.inviter?.full_name || invite.inviter?.email || 'Unknown'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canResend(invite.status) && (
                      <DropdownMenuItem 
                        onClick={() => resendInvitation.mutate(invite.id)}
                        disabled={resendInvitation.isPending}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                         {invite.status === 'failed'
                           ? 'Retry'
                           : invite.status === 'emailed'
                           ? 'Resend Email'
                           : 'Send Email'}
                      </DropdownMenuItem>
                    )}
                    {canRevoke(invite.status) && (
                      <DropdownMenuItem 
                        onClick={() => revokeInvitation.mutate(invite.id)}
                        disabled={revokeInvitation.isPending}
                        className="text-destructive"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Revoke
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export default function UserManagement() {
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: invitations = [], isLoading: invitationsLoading } = useInvitations();

  const pendingInvites = invitations.filter(i => 
    i.status === 'pending' || i.status === 'emailed' || i.status === 'provisioned'
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="User Management"
          description="Manage team members and their access levels"
          actions={<InviteUserDialog />}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Users</CardDescription>
              <CardTitle className="text-2xl">{users.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Users</CardDescription>
              <CardTitle className="text-2xl">
                {users.filter(u => u.is_active).length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Invites</CardDescription>
              <CardTitle className="text-2xl">{pendingInvites.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Admins</CardDescription>
              <CardTitle className="text-2xl">
                {users.filter(u => u.role === 'admin').length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">
              Users ({users.length})
            </TabsTrigger>
            <TabsTrigger value="invitations">
              Invitations ({invitations.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="users" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <UsersTable users={users} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="invitations" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {invitationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <InvitationsTable invitations={invitations} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
