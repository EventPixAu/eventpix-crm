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
  Users, 
  UserPlus, 
  Mail, 
  MoreHorizontal, 
  Copy, 
  RefreshCw, 
  XCircle,
  Check,
  Clock,
  AlertCircle
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  useUsers,
  useInvitations,
  useCreateInvitation,
  useResendInvitation,
  useRevokeInvitation,
  useSetUserActive,
  useSetUserRole,
  type UserProfile,
  type UserInvitation,
} from '@/hooks/useUserManagement';

const ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full access to all features' },
  { value: 'sales', label: 'Sales', description: 'Access to clients, leads, quotes' },
  { value: 'operations', label: 'Operations', description: 'Access to events, assignments, delivery' },
  { value: 'crew', label: 'Crew', description: 'Access to assigned events only' },
];

function getRoleBadgeVariant(role: string | null) {
  switch (role) {
    case 'admin': return 'destructive';
    case 'sales': return 'default';
    case 'operations': return 'secondary';
    case 'crew': return 'outline';
    default: return 'outline';
  }
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'pending': return 'secondary';
    case 'sent': return 'default';
    case 'accepted': return 'outline';
    case 'expired': return 'destructive';
    case 'revoked': return 'destructive';
    default: return 'outline';
  }
}

function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('crew');
  const { toast } = useToast();
  
  const createInvitation = useCreateInvitation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await createInvitation.mutateAsync({ email, role });
    
    if (result.token) {
      // Copy invite link to clipboard
      const inviteUrl = `${window.location.origin}/accept-invite?token=${encodeURIComponent(result.token)}`;
      await navigator.clipboard.writeText(inviteUrl);
      toast({
        title: 'Invite link copied!',
        description: 'Send this link to the user to complete their registration.',
      });
    }
    
    setOpen(false);
    setEmail('');
    setRole('crew');
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
            Send an invitation to add a new team member. They'll receive a link to create their account.
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
            <Button type="submit" disabled={createInvitation.isPending}>
              {createInvitation.isPending ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UsersTable({ users }: { users: UserProfile[] }) {
  const setUserActive = useSetUserActive();
  const setUserRole = useSetUserRole();

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
                  <Switch
                    checked={user.is_active ?? true}
                    onCheckedChange={(checked) => 
                      setUserActive.mutate({ userId: user.id, isActive: checked })
                    }
                    disabled={setUserActive.isPending}
                  />
                  <span className={user.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
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

  const copyInviteLink = async (token: string) => {
    const inviteUrl = `${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}`;
    await navigator.clipboard.writeText(inviteUrl);
    toast({
      title: 'Link copied',
      description: 'Invitation link copied to clipboard.',
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Invited By</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              No pending invitations
            </TableCell>
          </TableRow>
        ) : (
          invitations.map((invite) => {
            const isExpired = isPast(new Date(invite.expires_at));
            const canResend = invite.status === 'pending' || invite.status === 'sent' || invite.status === 'expired';
            const canRevoke = invite.status === 'pending' || invite.status === 'sent';

            return (
              <TableRow key={invite.id}>
                <TableCell className="font-medium">{invite.email}</TableCell>
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(invite.role)}>
                    {invite.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(invite.status)} className="gap-1">
                    {invite.status === 'pending' && <Clock className="h-3 w-3" />}
                    {invite.status === 'sent' && <Mail className="h-3 w-3" />}
                    {invite.status === 'accepted' && <Check className="h-3 w-3" />}
                    {(invite.status === 'expired' || invite.status === 'revoked') && <AlertCircle className="h-3 w-3" />}
                    {invite.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {invite.inviter?.full_name || invite.inviter?.email || 'Unknown'}
                </TableCell>
                <TableCell className={isExpired ? 'text-destructive' : 'text-muted-foreground'}>
                  {format(new Date(invite.expires_at), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canResend && (
                        <DropdownMenuItem onClick={() => copyInviteLink(invite.token)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Link
                        </DropdownMenuItem>
                      )}
                      {canResend && (
                        <DropdownMenuItem 
                          onClick={() => resendInvitation.mutate(invite.id)}
                          disabled={resendInvitation.isPending}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Resend
                        </DropdownMenuItem>
                      )}
                      {canRevoke && (
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
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

export default function UserManagement() {
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: invitations = [], isLoading: invitationsLoading } = useInvitations();

  const pendingInvites = invitations.filter(i => i.status === 'pending' || i.status === 'sent');

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
