/**
 * Company Contacts Management Panel
 * 
 * Displays all contacts linked to a company with full management:
 * - Table of linked contacts (name, email, phone, role)
 * - Link existing contact button
 * - Create new contact and auto-link
 * - Unlink contacts (removes link, not the contact)
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  User, 
  Plus, 
  UserPlus, 
  Unlink, 
  Mail, 
  Phone, 
  ExternalLink,
  Search,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  useCompanyAssociations,
  useDeleteContactAssociation,
  RELATIONSHIP_TYPES,
} from '@/hooks/useContactCompanyAssociations';
import { LinkContactToCompanyDialog } from './LinkContactToCompanyDialog';
import { CreateAndLinkContactDialog } from './CreateAndLinkContactDialog';

interface CompanyContactsPanelProps {
  companyId: string;
  companyName?: string;
}

export function CompanyContactsPanel({ companyId, companyName }: CompanyContactsPanelProps) {
  const { data: associations = [], isLoading } = useCompanyAssociations(companyId);
  const deleteAssociation = useDeleteContactAssociation();
  
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<{
    id: string;
    contactId: string;
    contactName: string;
  } | null>(null);

  const handleUnlink = async () => {
    if (!unlinkTarget) return;
    
    await deleteAssociation.mutateAsync({
      id: unlinkTarget.id,
      contact_id: unlinkTarget.contactId,
      company_id: companyId,
    });
    setUnlinkTarget(null);
  };

  const getRelationshipLabel = (type: string) => {
    return RELATIONSHIP_TYPES.find(t => t.value === type)?.label || type;
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Contacts
              {associations.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {associations.length}
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setLinkDialogOpen(true)}
              >
                <Search className="h-4 w-4 mr-1.5" />
                Link Existing
              </Button>
              <Button 
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-1.5" />
                Create New
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : associations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No contacts linked to this company</p>
              <p className="text-xs mt-1">
                Link existing contacts or create new ones
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {associations.map((assoc) => (
                    <TableRow key={assoc.id}>
                      <TableCell>
                        <Link 
                          to={`/crm/contacts/${assoc.contact_id}`}
                          className="font-medium text-primary hover:underline flex items-center gap-1"
                        >
                          {assoc.contact?.contact_name || 'Unknown'}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </TableCell>
                      <TableCell>
                        {assoc.contact?.email ? (
                          <a 
                            href={`mailto:${assoc.contact.email}`}
                            className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            {assoc.contact.email}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {assoc.contact?.phone_mobile ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {assoc.contact.phone_mobile}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {assoc.job_title?.name || assoc.custom_title || getRelationshipLabel(assoc.relationship_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <Link to={`/crm/contacts/${assoc.contact_id}`}>
                              View
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setUnlinkTarget({
                              id: assoc.id,
                              contactId: assoc.contact_id,
                              contactName: assoc.contact?.contact_name || 'this contact',
                            })}
                          >
                            <Unlink className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link Existing Contact Dialog */}
      <LinkContactToCompanyDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        companyId={companyId}
        companyName={companyName}
        existingContactIds={associations.map(a => a.contact_id)}
      />

      {/* Create New Contact Dialog */}
      <CreateAndLinkContactDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        companyId={companyId}
        companyName={companyName}
      />

      {/* Unlink Confirmation Dialog */}
      <AlertDialog open={!!unlinkTarget} onOpenChange={() => setUnlinkTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unlink "{unlinkTarget?.contactName}" from this company?
              The contact record will not be deleted, only the association will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlink}
              disabled={deleteAssociation.isPending}
            >
              {deleteAssociation.isPending ? 'Unlinking...' : 'Unlink'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
