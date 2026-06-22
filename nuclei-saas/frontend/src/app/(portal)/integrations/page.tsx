'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { Integration } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2, AlertCircle, RefreshCw, Trash2,
  ExternalLink, Webhook, Plus
} from 'lucide-react';
import { timeAgo } from '@/lib/utils';

const INTEGRATION_CATALOG = [
  {
    id: 'vanta',
    name: 'Vanta',
    description: 'Sync findings to Vanta for automated compliance evidence collection. Findings appear as vulnerability evidence in your Vanta dashboard.',
    category: 'Compliance',
    logo: '🔒',
    fields: [{ key: 'api_key', label: 'API Key', type: 'password' }],
    docs: 'https://help.vanta.com',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    description: 'Correlate scan findings with your Cloudflare WAF rules and firewall events. Get context on which threats are already being blocked.',
    category: 'WAF / CDN',
    logo: '🔶',
    fields: [
      { key: 'api_token', label: 'API Token', type: 'password' },
      { key: 'zone_id', label: 'Zone ID', type: 'text' },
    ],
    docs: 'https://developers.cloudflare.com',
  },
  {
    id: 'akamai',
    name: 'Akamai',
    description: 'Integrate with Akamai Edge Security to correlate findings with your App & API Protector policies and alert on unmitigated vulnerabilities.',
    category: 'WAF / CDN',
    logo: '🌊',
    fields: [
      { key: 'client_token', label: 'Client Token', type: 'password' },
      { key: 'client_secret', label: 'Client Secret', type: 'password' },
      { key: 'access_token', label: 'Access Token', type: 'password' },
      { key: 'base_url', label: 'Base URL', type: 'text' },
    ],
    docs: 'https://techdocs.akamai.com',
  },
  {
    id: 'imperva',
    name: 'Imperva',
    description: 'Connect with Imperva Cloud WAF to understand which vulnerabilities in your scan results have compensating controls in place.',
    category: 'WAF / CDN',
    logo: '🛡️',
    fields: [
      { key: 'api_id', label: 'API ID', type: 'text' },
      { key: 'api_key', label: 'API Key', type: 'password' },
    ],
    docs: 'https://docs.imperva.com',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Receive instant notifications for new critical and high severity findings in your Slack workspace.',
    category: 'Notifications',
    logo: '💬',
    fields: [{ key: 'webhook_url', label: 'Webhook URL', type: 'url' }],
    docs: 'https://api.slack.com/messaging/webhooks',
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Automatically create Jira issues for new findings. Track remediation progress alongside your development workflow.',
    category: 'Ticketing',
    logo: '🎯',
    fields: [
      { key: 'base_url', label: 'Jira Base URL', type: 'url' },
      { key: 'email', label: 'Account Email', type: 'email' },
      { key: 'api_token', label: 'API Token', type: 'password' },
      { key: 'project_key', label: 'Project Key', type: 'text' },
    ],
    docs: 'https://developer.atlassian.com/cloud/jira',
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty',
    description: 'Trigger PagerDuty incidents for critical vulnerabilities discovered during scans.',
    category: 'Notifications',
    logo: '🚨',
    fields: [{ key: 'routing_key', label: 'Events API v2 Routing Key', type: 'password' }],
    docs: 'https://developer.pagerduty.com',
  },
  {
    id: 'webhook',
    name: 'Custom Webhook',
    description: 'Send finding events to any HTTP endpoint. Integrate with any platform using our JSON webhook payload.',
    category: 'Developer',
    logo: '🔗',
    fields: [
      { key: 'url', label: 'Webhook URL', type: 'url' },
      { key: 'secret', label: 'HMAC Secret (optional)', type: 'password' },
    ],
    docs: '#',
  },
];

const CATEGORIES = ['All', 'Compliance', 'WAF / CDN', 'Notifications', 'Ticketing', 'Developer'];

export default function IntegrationsPage() {
  const qc = useQueryClient();
  const [category, setCategory] = useState('All');
  const [configuring, setConfiguring] = useState<typeof INTEGRATION_CATALOG[number] | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const { data: integrationsData } = useQuery<{ items: Integration[] }>({
    queryKey: ['integrations'],
    queryFn: () => api.get('/integrations').then(r => r.data),
  });

  const integrations = integrationsData?.items ?? [];
  const connectedProviders = new Set(integrations.filter(i => i.is_active).map(i => i.provider));

  const addIntegration = useMutation({
    mutationFn: () => api.post('/integrations', {
      provider: configuring?.id,
      config: formValues,
      is_active: true,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      setConfiguring(null);
      setFormValues({});
    },
  });

  const deleteIntegration = useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const syncIntegration = useMutation({
    mutationFn: (id: string) => api.post(`/integrations/${id}/sync`),
  });

  const toggleIntegration = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.put(`/integrations/${id}`, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const filtered = category === 'All'
    ? INTEGRATION_CATALOG
    : INTEGRATION_CATALOG.filter(i => i.category === category);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Integrations</h1>
        <p className="text-slate-400 text-sm mt-0.5">Connect LegionCyber Shield with your security and operations tools</p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
              category === cat
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Integration cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(integration => {
          const connected = connectedProviders.has(integration.id);
          const existing = integrations.find(i => i.provider === integration.id);
          return (
            <Card key={integration.id} className={`bg-slate-900 border-slate-700 flex flex-col ${connected ? 'ring-1 ring-blue-500/30' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{integration.logo}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-medium">{integration.name}</h3>
                        {connected && (
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Connected
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs border-slate-600 text-slate-400 mt-0.5">
                        {integration.category}
                      </Badge>
                    </div>
                  </div>
                  {existing && (
                    <Switch
                      checked={existing.is_active}
                      onCheckedChange={active => toggleIntegration.mutate({ id: existing.id, active })}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-3">
                <p className="text-sm text-slate-400 leading-relaxed flex-1">{integration.description}</p>
                <div className="flex items-center gap-2">
                  {connected && existing ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-slate-600 text-slate-300"
                        onClick={() => syncIntegration.mutate(existing.id)}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Sync Now
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-400 hover:text-rose-300"
                        onClick={() => deleteIntegration.mutate(existing.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setConfiguring(integration);
                        setFormValues({});
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Connect
                    </Button>
                  )}
                  {integration.docs !== '#' && (
                    <Button size="sm" variant="ghost" className="text-slate-400" asChild>
                      <a href={integration.docs} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
                {existing?.last_sync_at && (
                  <p className="text-xs text-slate-500">Last sync: {timeAgo(existing.last_sync_at)}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Configure dialog */}
      <Dialog open={!!configuring} onOpenChange={() => setConfiguring(null)}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <span>{configuring?.logo}</span> Connect {configuring?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {configuring?.fields.map(field => (
              <div key={field.key}>
                <Label className="text-slate-300 mb-1 block">{field.label}</Label>
                <Input
                  type={field.type === 'password' ? 'password' : 'text'}
                  value={formValues[field.key] ?? ''}
                  onChange={e => setFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            ))}
            <Button
              className="w-full"
              onClick={() => addIntegration.mutate()}
              disabled={addIntegration.isPending}
            >
              {addIntegration.isPending ? 'Connecting...' : 'Save & Connect'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
