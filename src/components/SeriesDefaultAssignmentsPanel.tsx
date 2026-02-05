 import { useState, useMemo } from 'react';
 import { Users, Plus, Trash2, RefreshCw, UserCheck } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
 } from '@/components/ui/alert-dialog';
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from '@/components/ui/table';
 import {
   useSeriesDefaultAssignments,
   useAddSeriesDefaultAssignment,
   useUpdateSeriesDefaultAssignment,
   useRemoveSeriesDefaultAssignment,
   useSyncDefaultAssignmentsToEvents,
 } from '@/hooks/useSeriesDefaultAssignments';
 import { useStaffDirectory } from '@/hooks/useStaff';
 import { useStaffRoles } from '@/hooks/useLookups';
 import { useSeriesEvents } from '@/hooks/useEventSeries';
 
 interface SeriesDefaultAssignmentsPanelProps {
   seriesId: string;
 }
 
 export function SeriesDefaultAssignmentsPanel({ seriesId }: SeriesDefaultAssignmentsPanelProps) {
   const { data: assignments = [], isLoading } = useSeriesDefaultAssignments(seriesId);
   const { data: events = [] } = useSeriesEvents(seriesId);
   const { data: staffMembers = [] } = useStaffDirectory();
   const { data: staffRoles = [] } = useStaffRoles();
   
   const addAssignment = useAddSeriesDefaultAssignment();
   const updateAssignment = useUpdateSeriesDefaultAssignment();
   const removeAssignment = useRemoveSeriesDefaultAssignment();
   const syncToEvents = useSyncDefaultAssignmentsToEvents();
   
   const [selectedUserId, setSelectedUserId] = useState('');
   const [selectedRoleId, setSelectedRoleId] = useState('');
   const [confirmSyncOpen, setConfirmSyncOpen] = useState(false);
   const [removeId, setRemoveId] = useState<string | null>(null);
   
   // Filter out already assigned staff
   const availableStaff = useMemo(() => {
     const assignedUserIds = new Set(assignments.map(a => a.user_id));
     // StaffDirectoryEntry uses id as the user_id, and source 'profile' means it's a profile
     return staffMembers.filter(s => s.source === 'profile' && !assignedUserIds.has(s.id));
   }, [staffMembers, assignments]);
   
   // Count upcoming events
   const upcomingEventCount = useMemo(() => {
     const today = new Date().toISOString().split('T')[0];
     return events.filter(e => e.event_date >= today).length;
   }, [events]);
   
   const handleAddAssignment = () => {
     if (!selectedUserId) return;
     
     addAssignment.mutate({
       series_id: seriesId,
       user_id: selectedUserId,
       staff_role_id: selectedRoleId || null,
     }, {
       onSuccess: () => {
         setSelectedUserId('');
         setSelectedRoleId('');
       },
     });
   };
   
   const handleRoleChange = (assignmentId: string, newRoleId: string) => {
     updateAssignment.mutate({
       id: assignmentId,
       series_id: seriesId,
       staff_role_id: newRoleId === 'none' ? null : newRoleId,
     });
   };
   
   const handleRemove = (id: string) => {
     removeAssignment.mutate({ id, series_id: seriesId });
     setRemoveId(null);
   };
   
   const handleSyncToEvents = () => {
     const today = new Date().toISOString().split('T')[0];
     const upcomingEventIds = events
       .filter(e => e.event_date >= today)
       .map(e => e.id);
     
     syncToEvents.mutate({
       series_id: seriesId,
       event_ids: upcomingEventIds,
       default_assignments: assignments,
     });
     setConfirmSyncOpen(false);
   };
   
   return (
     <div className="space-y-6">
       {/* Add Default Assignment */}
       <Card>
         <CardHeader>
           <CardTitle className="text-base flex items-center gap-2">
             <Plus className="h-4 w-4" />
             Add Default Staff Assignment
           </CardTitle>
           <CardDescription>
             Staff added here will be automatically assigned to all events in this series
           </CardDescription>
         </CardHeader>
         <CardContent>
           <div className="flex gap-3 items-end">
             <div className="flex-1">
               <label className="text-sm font-medium mb-1.5 block">Staff Member</label>
               <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                 <SelectTrigger>
                   <SelectValue placeholder="Select staff..." />
                 </SelectTrigger>
                 <SelectContent>
                   {availableStaff.map(staff => (
                     <SelectItem key={staff.id} value={staff.id}>
                       {staff.full_name || 'Unknown'}
                     </SelectItem>
                   ))}
                   {availableStaff.length === 0 && (
                     <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                       No available staff
                     </div>
                   )}
                 </SelectContent>
               </Select>
             </div>
             
             <div className="w-48">
               <label className="text-sm font-medium mb-1.5 block">Role</label>
               <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                 <SelectTrigger>
                   <SelectValue placeholder="Select role..." />
                 </SelectTrigger>
                 <SelectContent>
                   {staffRoles.map(role => (
                     <SelectItem key={role.id} value={role.id}>
                       {role.name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             
             <Button 
               onClick={handleAddAssignment}
               disabled={!selectedUserId || addAssignment.isPending}
             >
               <Plus className="h-4 w-4 mr-2" />
               Add
             </Button>
           </div>
         </CardContent>
       </Card>
       
       {/* Current Default Assignments */}
       <Card>
         <CardHeader className="flex flex-row items-center justify-between">
           <div>
             <CardTitle className="text-base flex items-center gap-2">
               <Users className="h-4 w-4" />
               Default Assignments
             </CardTitle>
             <CardDescription>
               {assignments.length} staff member{assignments.length !== 1 ? 's' : ''} assigned by default
             </CardDescription>
           </div>
           
           {assignments.length > 0 && upcomingEventCount > 0 && (
             <Button 
               variant="outline" 
               size="sm"
               onClick={() => setConfirmSyncOpen(true)}
               disabled={syncToEvents.isPending}
             >
               <RefreshCw className="h-4 w-4 mr-2" />
               Sync to {upcomingEventCount} Event{upcomingEventCount !== 1 ? 's' : ''}
             </Button>
           )}
         </CardHeader>
         <CardContent>
           {isLoading ? (
             <div className="py-8 text-center text-muted-foreground">Loading...</div>
           ) : assignments.length === 0 ? (
             <div className="py-8 text-center text-muted-foreground">
               <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
               <p>No default assignments configured</p>
               <p className="text-sm mt-1">Add staff above to auto-assign them to events in this series</p>
             </div>
           ) : (
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Staff Member</TableHead>
                   <TableHead>Role</TableHead>
                   <TableHead className="w-20"></TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {assignments.map(assignment => (
                   <TableRow key={assignment.id}>
                     <TableCell>
                       <div className="flex items-center gap-3">
                         <Avatar className="h-8 w-8">
                           <AvatarImage src={assignment.user?.avatar_url || undefined} />
                           <AvatarFallback>
                             {(assignment.user?.full_name || 'U')[0].toUpperCase()}
                           </AvatarFallback>
                         </Avatar>
                         <div>
                           <p className="font-medium">
                             {assignment.user?.full_name || 'Unknown'}
                           </p>
                           <p className="text-xs text-muted-foreground">
                             {assignment.user?.email}
                           </p>
                         </div>
                       </div>
                     </TableCell>
                     <TableCell>
                       <Select 
                         value={assignment.staff_role_id || 'none'} 
                         onValueChange={(val) => handleRoleChange(assignment.id, val)}
                       >
                         <SelectTrigger className="w-40">
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="none">
                             <span className="text-muted-foreground">No role</span>
                           </SelectItem>
                           {staffRoles.map(role => (
                             <SelectItem key={role.id} value={role.id}>
                               {role.name}
                             </SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     </TableCell>
                     <TableCell>
                       <Button
                         variant="ghost"
                         size="icon"
                         onClick={() => setRemoveId(assignment.id)}
                         className="text-destructive hover:text-destructive"
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           )}
         </CardContent>
       </Card>
       
       {/* Info Card */}
       <Card className="border-primary/20 bg-primary/5">
         <CardContent className="pt-4">
           <div className="flex gap-3">
             <div className="bg-primary/10 rounded-lg p-2 h-fit">
               <Users className="h-5 w-5 text-primary" />
             </div>
             <div>
               <h4 className="font-medium mb-1">How default assignments work</h4>
               <ul className="text-sm text-muted-foreground space-y-1">
                 <li>• Staff listed here will be assigned to new events created in this series</li>
                 <li>• Use "Sync to Events" to apply defaults to existing upcoming events</li>
                 <li>• Individual event assignments can still be changed on each event</li>
               </ul>
             </div>
           </div>
         </CardContent>
       </Card>
       
       {/* Confirm Sync Dialog */}
       <AlertDialog open={confirmSyncOpen} onOpenChange={setConfirmSyncOpen}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Sync Default Assignments?</AlertDialogTitle>
             <AlertDialogDescription>
               This will add {assignments.length} default staff member{assignments.length !== 1 ? 's' : ''} to {upcomingEventCount} upcoming event{upcomingEventCount !== 1 ? 's' : ''}.
               <br /><br />
               Staff who are already assigned to an event will be skipped.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>Cancel</AlertDialogCancel>
             <AlertDialogAction onClick={handleSyncToEvents}>
               Sync Assignments
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
       
       {/* Confirm Remove Dialog */}
       <AlertDialog open={!!removeId} onOpenChange={() => setRemoveId(null)}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Remove Default Assignment?</AlertDialogTitle>
             <AlertDialogDescription>
               This staff member will no longer be automatically assigned to new events in this series.
               Existing event assignments will not be affected.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>Cancel</AlertDialogCancel>
             <AlertDialogAction 
               onClick={() => removeId && handleRemove(removeId)}
               className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
             >
               Remove
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
     </div>
   );
 }