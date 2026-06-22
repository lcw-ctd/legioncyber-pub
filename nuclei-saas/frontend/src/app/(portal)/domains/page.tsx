'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Domain } from '@/types';
import { DomainVerification } from '@/components/domains/DomainVerification';
import { CredentialForm } from '@/components/domains/CredentialForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Globe, Plus, CheckCircle2, Clock, AlertCircle,
  Key, MoreHorizontal, Trash2, RefreshCw, Shield
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

const addDomainSchema = z.object({
  fqdn: z.string().min(1).regex(/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/, 'Enter a valid domain'),
  verification_method: z.enum(['dns_txt', 'http_file', 'meta_tag']),
});

type AddDomainForm = z.infer<typeof addDomainSchema>;

function VerificationStatusBadge({ status }: { status: string }) {
  const map = {
    verified: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', label: 'Verified' },
    pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', label: 'Pending' },
    failed: { icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30', label: 'Failed' },
  };
  const cfg = map[status as keyof typeof map] ?? map.pending;
  const Icon = cfg.icon;
  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

export default function DomainsPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [verifyDomain, setVerifyDomain] = useState<Domain | null>(null);
  const [credDomain, setCredDomain] = useState<Domain | null>(null);

  const { data: domainsData, isLoading } = useQuery<{ items: Domain[]; total: number }>({
    queryKey: ['domains'],
    queryFn: () => api.get('/domains').then(r => r.data),
  });

  const domains = domainsData?.items ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AddDomainForm>({
    resolver: zodResolver(addDomainSchema),
    defaultValues: { verification_method: 'dns_txt' },
  });

  const addDomain = useMutation({
    mutationFn: (data: AddDomainForm) => api.post('/domains', data).then(r => r.data),
    onSuccess: (newDomain) => {
      qc.invalidateQueries({ queryKey: ['domains'] });
      reset();
      setAddOpen(false);
      setVerifyDomain(newDomain);
    },
  });

  const deleteDomain = useMutation({
    mutationFn: (id: string) => api.delete(`/domains/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });

  const retryVerify = useMutation({
    mutationFn: (id: string) => api.post(`/domains/${id}/verify`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Domains</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage and verify the domains you are authorized to scan</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add Domain</Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Add Domain</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(data => addDomain.mutate(data))} className="space-y-4">
              <div>
                <Label className="text-slate-300">Domain</Label>
                <Input
                  {...register('fqdn')}
                  placeholder="example.com"
                  className="bg-slate-800 border-slate-600 mt-1"
                />
                {errors.fqdn && <p className="text-rose-400 text-xs mt-1">{errors.fqdn.message}</p>}
              </div>
              <div>
                <Label className="text-slate-300 mb-2 block">Verification Method</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'dns_txt', label: 'DNS TXT', desc: 'Add a TXT record' },
                    { value: 'http_file', label: 'HTTP File', desc: 'Upload a file' },
                    { value: 'meta_tag', label: 'Meta Tag', desc: 'Add to HTML' },
                  ].map(opt => (
                    <label
                      key={opt.value}
                      className="flex flex-col gap-1 p-3 rounded-lg border border-slate-600 cursor-pointer hover:border-blue-500 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-500/10 transition-all"
                    >
                      <input type="radio" value={opt.value} {...register('verification_method')} className="sr-only" />
                      <span className="text-sm font-medium text-slate-200">{opt.label}</span>
                      <span className="text-xs text-slate-400">{opt.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={addDomain.isPending}>
                {addDomain.isPending ? 'Adding...' : 'Add Domain'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Domain verification modal */}
      {verifyDomain && (
        <Dialog open={!!verifyDomain} onOpenChange={() => setVerifyDomain(null)}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">Verify Domain Ownership</DialogTitle>
            </DialogHeader>
            <DomainVerification
              domain={verifyDomain}
              onVerified={() => {
                qc.invalidateQueries({ queryKey: ['domains'] });
                setVerifyDomain(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Credential form modal */}
      {credDomain && (
        <Dialog open={!!credDomain} onOpenChange={() => setCredDomain(null)}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-white">Add Scan Credentials — {credDomain.fqdn}</DialogTitle>
            </DialogHeader>
            <CredentialForm
              domainId={credDomain.id}
              onSaved={() => setCredDomain(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Domains list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : domains.length === 0 ? (
        <Card className="bg-slate-900 border-slate-700 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Shield className="h-10 w-10 text-slate-600" />
            <p className="text-slate-400 text-center">
              No domains added yet. Add a domain to start scanning.
            </p>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Your First Domain
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {domains.map(domain => (
            <Card key={domain.id} className="bg-slate-900 border-slate-700">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Globe className="h-5 w-5 text-slate-400 shrink-0" />
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium font-mono">{domain.fqdn}</span>
                        <VerificationStatusBadge status={domain.verification_status} />
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        <span>Added {formatDate(domain.created_at)}</span>
                        {domain.verified_at && <span>Verified {formatDate(domain.verified_at)}</span>}
                        <span className="capitalize">{domain.verification_method.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {domain.verification_status !== 'verified' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-slate-300"
                        onClick={() => setVerifyDomain(domain)}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Verify
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-slate-800 border-slate-700" align="end">
                        <DropdownMenuItem
                          onClick={() => setCredDomain(domain)}
                          className="text-slate-300 cursor-pointer"
                        >
                          <Key className="h-3.5 w-3.5 mr-2" /> Manage Credentials
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setVerifyDomain(domain)}
                          className="text-slate-300 cursor-pointer"
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-2" /> Re-verify
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteDomain.mutate(domain.id)}
                          className="text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove Domain
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
