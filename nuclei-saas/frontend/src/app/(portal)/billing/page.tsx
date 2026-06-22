'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  CheckCircle2, Download, ExternalLink, Zap, Shield,
  Building2, AlertTriangle, Crown
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  price_monthly: number | null;
  price_annual: number | null;
  price_one_time: number | null;
  features: Record<string, any>;
}

interface Subscription {
  plan_id: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  usage: { scans_used: number; domains_used: number; scans_limit: number; domains_limit: number };
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: string;
  pdf_url: string;
}

const PLAN_ICONS: Record<string, any> = {
  free: Zap, starter: Shield, professional: Crown, enterprise: Building2,
};

const PLAN_HIGHLIGHTS: Record<string, string[]> = {
  free: ['1 domain', '2 scans/month', 'Quick scan only', 'Community support'],
  onetime: ['3 domains', '5 scans total', 'Full + OWASP Top 10 scans', 'PDF reports', '30-day access'],
  starter: ['5 domains', '20 scans/month', 'OWASP + API scans', 'PDF reports', 'Scheduled scans', 'API access'],
  professional: ['25 domains', '100 scans/month', 'All scan types', 'Compliance reports', 'All integrations', 'Authenticated scans'],
  enterprise: ['Unlimited domains', 'Unlimited scans', 'Custom templates', 'Dedicated CSM', 'SSO + white-label', '99.9% SLA'],
};

export default function BillingPage() {
  const { data: plans } = useQuery<Plan[]>({
    queryKey: ['billing-plans'],
    queryFn: () => api.get('/billing/plans').then(r => r.data),
  });

  const { data: subscription } = useQuery<Subscription>({
    queryKey: ['subscription'],
    queryFn: () => api.get('/billing/subscription').then(r => r.data),
  });

  const { data: invoicesData } = useQuery<{ items: Invoice[] }>({
    queryKey: ['invoices'],
    queryFn: () => api.get('/billing/invoices').then(r => r.data),
  });

  const checkout = useMutation({
    mutationFn: (planId: string) => api.post('/billing/checkout', { plan_id: planId }).then(r => r.data),
    onSuccess: (data) => {
      if (data.checkout_url) window.location.href = data.checkout_url;
    },
  });

  const cancelSubscription = useMutation({
    mutationFn: () => api.post('/billing/subscription/cancel'),
  });

  const invoices = invoicesData?.items ?? [];
  const currentPlanId = subscription?.plan_id;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Billing & Plans</h1>
        <p className="text-slate-400 text-sm mt-0.5">Manage your subscription and payment history</p>
      </div>

      {/* Current plan / usage */}
      {subscription && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-slate-200">Current Plan</CardTitle>
              <Badge className={`capitalize ${subscription.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                {subscription.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-semibold text-white capitalize">{currentPlanId} Plan</p>
                {subscription.current_period_end && (
                  <p className="text-sm text-slate-400">
                    {subscription.cancel_at_period_end ? 'Cancels' : 'Renews'} {formatDate(subscription.current_period_end)}
                  </p>
                )}
              </div>
              {subscription.cancel_at_period_end && (
                <div className="flex items-center gap-2 text-sm text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Cancels at period end
                </div>
              )}
            </div>

            {subscription.usage && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Scans this month</span>
                    <span className="text-white">
                      {subscription.usage.scans_used}
                      {subscription.usage.scans_limit > 0 && ` / ${subscription.usage.scans_limit}`}
                    </span>
                  </div>
                  {subscription.usage.scans_limit > 0 && (
                    <Progress
                      value={(subscription.usage.scans_used / subscription.usage.scans_limit) * 100}
                      className="h-1.5"
                    />
                  )}
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Domains</span>
                    <span className="text-white">
                      {subscription.usage.domains_used}
                      {subscription.usage.domains_limit > 0 && ` / ${subscription.usage.domains_limit}`}
                    </span>
                  </div>
                  {subscription.usage.domains_limit > 0 && (
                    <Progress
                      value={(subscription.usage.domains_used / subscription.usage.domains_limit) * 100}
                      className="h-1.5"
                    />
                  )}
                </div>
              </div>
            )}

            {!subscription.cancel_at_period_end && currentPlanId !== 'enterprise' && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-rose-400 border-rose-400/30"
                  onClick={() => cancelSubscription.mutate()}
                >
                  Cancel Subscription
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan comparison */}
      <div>
        <h2 className="text-lg font-medium text-white mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {(plans ?? []).map(plan => {
            const Icon = PLAN_ICONS[plan.id] ?? Shield;
            const isCurrent = plan.id === currentPlanId;
            const highlights = PLAN_HIGHLIGHTS[plan.id] ?? [];

            return (
              <Card
                key={plan.id}
                className={`bg-slate-900 border-slate-700 flex flex-col ${
                  plan.id === 'professional' ? 'ring-1 ring-blue-500' : ''
                } ${isCurrent ? 'ring-1 ring-emerald-500' : ''}`}
              >
                {plan.id === 'professional' && (
                  <div className="bg-blue-600 text-white text-xs text-center py-1 rounded-t-lg font-medium">
                    Most Popular
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 text-blue-400" />
                    <CardTitle className="text-base text-white capitalize">{plan.name}</CardTitle>
                  </div>
                  <div>
                    {plan.price_monthly != null ? (
                      <>
                        <span className="text-2xl font-bold text-white">${plan.price_monthly}</span>
                        <span className="text-slate-400 text-sm">/mo</span>
                      </>
                    ) : plan.price_one_time != null ? (
                      <>
                        <span className="text-2xl font-bold text-white">${plan.price_one_time}</span>
                        <span className="text-slate-400 text-sm"> once</span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold text-white">Free</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3">
                  <ul className="space-y-1.5 flex-1">
                    {highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        {h}
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    className="w-full"
                    variant={isCurrent ? 'outline' : plan.id === 'professional' ? 'default' : 'outline'}
                    disabled={isCurrent || checkout.isPending}
                    onClick={() => !isCurrent && checkout.mutate(plan.id)}
                  >
                    {isCurrent ? 'Current Plan' : plan.price_monthly === 0 ? 'Downgrade' : 'Upgrade'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Invoice history */}
      <div>
        <h2 className="text-lg font-medium text-white mb-4">Invoice History</h2>
        <Card className="bg-slate-900 border-slate-700">
          {invoices.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">No invoices yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-400">Date</TableHead>
                  <TableHead className="text-slate-400">Amount</TableHead>
                  <TableHead className="text-slate-400 w-24">Status</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(invoice => (
                  <TableRow key={invoice.id} className="border-slate-700 hover:bg-slate-800/50">
                    <TableCell className="text-slate-300">{formatDate(invoice.date)}</TableCell>
                    <TableCell className="text-white font-medium">${(invoice.amount / 100).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs capitalize ${
                        invoice.status === 'paid'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invoice.pdf_url && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400" asChild>
                          <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
