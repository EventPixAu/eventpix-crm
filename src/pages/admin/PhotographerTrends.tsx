import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Star,
  Camera,
  AlertCircle,
  Calendar,
  Clock,
  ChevronRight,
  Info,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePhotographerTrends } from '@/hooks/usePhotographerTrends';

function RatingTrendBadge({ trend }: { trend: 'up' | 'flat' | 'down' | 'insufficient' }) {
  switch (trend) {
    case 'up':
      return (
        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
          <TrendingUp className="h-3 w-3 mr-1" />
          Improving
        </Badge>
      );
    case 'down':
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
          <TrendingDown className="h-3 w-3 mr-1" />
          Declining
        </Badge>
      );
    case 'flat':
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <Minus className="h-3 w-3 mr-1" />
          Stable
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Limited data
        </Badge>
      );
  }
}

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1">
      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
      <span className="font-medium">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function PhotographerTrends() {
  const { data: trends, isLoading } = usePhotographerTrends();

  return (
    <AppLayout>
      <PageHeader
        title="Photographer Trends"
        description="Performance insights (Admin only)"
      />

      {/* Privacy Notice */}
      <Alert className="mb-6 border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          This data is for internal operations only. Performance trends are aggregated and non-punitive. 
          Individual ratings are private and not shared publicly or used for rankings.
        </AlertDescription>
      </Alert>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Active Photographers</p>
              <p className="text-2xl font-bold">{trends?.photographers.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">With events worked</p>
            </div>
            <div className="p-3 rounded-xl bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Average Rating</p>
              <p className="text-2xl font-bold">{trends?.averageRatingOverall !== null ? trends.averageRatingOverall.toFixed(1) : '—'}</p>
              <p className="text-xs text-muted-foreground">Across all feedback</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-100">
              <Star className="h-5 w-5 text-amber-500" />
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Events</p>
              <p className="text-2xl font-bold">{trends?.totalEventsCompleted ?? 0}</p>
              <p className="text-xs text-muted-foreground">Completed this year</p>
            </div>
            <div className="p-3 rounded-xl bg-green-100">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Avg. Delivery Issues</p>
              <p className="text-2xl font-bold">{trends ? `${trends.averageDeliveryIssueRate}%` : '—'}</p>
              <p className="text-xs text-muted-foreground">Late delivery rate</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-100">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
          </div>
        </Card>
      </div>

      {/* Photographer Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Performance Overview</CardTitle>
          <CardDescription>
            Aggregated metrics per photographer. No rankings - data for operational planning only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              Loading trends...
            </div>
          ) : !trends || trends.photographers.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              No photographer data available
            </div>
          ) : (
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Photographer</TableHead>
                    <TableHead className="text-center">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          Events
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Total events worked (3m / 6m shown below)
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="text-center">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          Rating
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Average feedback rating (out of 5)
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="text-center">Trend</TableHead>
                    <TableHead className="text-center">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          Delivery Issues
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Percentage of late deliveries
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="text-center">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          Availability
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Days marked unavailable / limited (last 6 months)
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="text-right">Profile</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trends.photographers.map(photographer => (
                    <TableRow key={photographer.userId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{photographer.fullName}</p>
                          <p className="text-sm text-muted-foreground">{photographer.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div>
                          <p className="font-semibold">{photographer.totalEventsWorked}</p>
                          <p className="text-xs text-muted-foreground">
                            {photographer.eventsLast3Months} / {photographer.eventsLast6Months}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <StarRating rating={photographer.averageRating} />
                          {photographer.totalFeedbackCount > 0 && (
                            <p className="text-xs text-muted-foreground">
                              ({photographer.totalFeedbackCount} reviews)
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <RatingTrendBadge trend={photographer.ratingTrend} />
                      </TableCell>
                      <TableCell className="text-center">
                        {photographer.totalDeliveries > 0 ? (
                          <div>
                            <Badge 
                              variant={photographer.deliveryIssueRate > 20 ? 'destructive' : 'outline'}
                              className={photographer.deliveryIssueRate === 0 ? 'text-green-600 border-green-200' : ''}
                            >
                              {photographer.deliveryIssueRate}%
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {photographer.lateDeliveries}/{photographer.totalDeliveries}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="text-sm">
                          <span className="text-red-600">{photographer.unavailableDaysCount}</span>
                          {' / '}
                          <span className="text-amber-600">{photographer.limitedDaysCount}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/staff/${photographer.userId}`}>
                            View <ChevronRight className="h-4 w-4 ml-1" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
