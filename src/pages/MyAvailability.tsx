import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AvailabilityCalendar } from '@/components/AvailabilityCalendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MyAvailability() {
  return (
    <AppLayout>
      <PageHeader
        title="My Availability"
        description="Set your availability for upcoming dates"
      />
      
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Availability Calendar</CardTitle>
              <CardDescription>
                Click on a date to set your availability. Dates without a status are considered available.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AvailabilityCalendar />
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About Availability</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-1">Available</h4>
                <p>You can be assigned to any number of events on this day.</p>
              </div>
              
              <div>
                <h4 className="font-medium text-foreground mb-1">Limited</h4>
                <p>
                  You have restricted availability. Use notes to specify times or conditions.
                  You may be assigned one event, but admins will see a warning before adding more.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-foreground mb-1">Unavailable</h4>
                <p>
                  You cannot work on this day. Admins will need to override this status
                  to assign you, and the override will be logged.
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tips</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Set unavailability as early as possible</p>
              <p>• Use notes to explain limitations</p>
              <p>• Check regularly for assignment updates</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
