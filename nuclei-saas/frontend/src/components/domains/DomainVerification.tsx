'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Domain } from '@/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert } from '@/components/ui/alert';
import { CheckCircle2, Copy, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';

interface Props {
  domain: Domain;
  onVerified?: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
    >
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="relative rounded-lg bg-slate-950 border border-slate-700 overflow-hidden">
      {label && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700 bg-slate-900">
          <span className="text-xs text-slate-400 font-mono">{label}</span>
          <CopyButton text={code} />
        </div>
      )}
      <pre className="p-3 text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
      {!label && (
        <div className="absolute top-2 right-2">
          <CopyButton text={code} />
        </div>
      )}
    </div>
  );
}

export function DomainVerification({ domain, onVerified }: Props) {
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: instructions } = useQuery<{
    dns_record: { type: string; name: string; value: string };
    http_file: { path: string; content: string };
    meta_tag: { tag: string };
    token: string;
  }>({
    queryKey: ['domain-verification', domain.id],
    queryFn: () => api.get(`/domains/${domain.id}/verification`).then(r => r.data),
  });

  const verify = useMutation({
    mutationFn: () => api.post(`/domains/${domain.id}/verify`).then(r => r.data),
    onSuccess: (data) => {
      setVerifyResult(data);
      if (data.verified && onVerified) {
        onVerified();
      }
    },
    onError: () => {
      setVerifyResult({ success: false, message: 'Verification failed. Make sure the record is deployed and try again.' });
    },
  });

  if (!instructions) {
    return <div className="animate-pulse h-48 bg-slate-800 rounded-lg" />;
  }

  const method = domain.verification_method;

  return (
    <div className="space-y-4">
      <p className="text-slate-300 text-sm">
        To verify ownership of <strong className="text-white font-mono">{domain.fqdn}</strong>, complete one of the
        verification methods below, then click the verify button.
      </p>

      <Tabs defaultValue={method}>
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="dns_txt">DNS TXT Record</TabsTrigger>
          <TabsTrigger value="http_file">HTTP File</TabsTrigger>
          <TabsTrigger value="meta_tag">Meta Tag</TabsTrigger>
        </TabsList>

        <TabsContent value="dns_txt" className="mt-4 space-y-3">
          <p className="text-sm text-slate-400">Add the following DNS TXT record to your domain&apos;s DNS settings:</p>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-slate-500 mb-1">Record Type</p>
              <CodeBlock code="TXT" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Name / Host</p>
              <CodeBlock code={instructions.dns_record?.name ?? `_legioncyber-verify.${domain.fqdn}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Value</p>
              <CodeBlock code={instructions.dns_record?.value ?? `legioncyber-verify=${instructions.token}`} />
            </div>
          </div>
          <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-300 text-sm">
            DNS changes can take up to 48 hours to propagate, though most providers update within a few minutes.
          </Alert>
        </TabsContent>

        <TabsContent value="http_file" className="mt-4 space-y-3">
          <p className="text-sm text-slate-400">
            Upload a file to your web server at the following path:
          </p>
          <div>
            <p className="text-xs text-slate-500 mb-1">File Path</p>
            <CodeBlock
              code={instructions.http_file?.path ?? `/.well-known/legioncyber-verify.txt`}
            />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">File Contents</p>
            <CodeBlock code={instructions.http_file?.content ?? instructions.token} />
          </div>
          <p className="text-sm text-slate-400">
            The file must be accessible at:{' '}
            <code className="text-blue-400 font-mono text-xs">
              https://{domain.fqdn}/.well-known/legioncyber-verify.txt
            </code>
          </p>
        </TabsContent>

        <TabsContent value="meta_tag" className="mt-4 space-y-3">
          <p className="text-sm text-slate-400">
            Add the following meta tag to the <code className="text-blue-400">&lt;head&gt;</code> section of your homepage:
          </p>
          <CodeBlock
            code={instructions.meta_tag?.tag ?? `<meta name="legioncyber-verification" content="${instructions.token}" />`}
            label="HTML"
          />
          <p className="text-sm text-slate-400">
            Deploy the change, then click verify below.
          </p>
        </TabsContent>
      </Tabs>

      {verifyResult && (
        <div className={`flex items-start gap-2 p-3 rounded-lg border ${
          verifyResult.success
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {verifyResult.success
            ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          }
          <p className="text-sm">{verifyResult.message}</p>
        </div>
      )}

      <Button
        className="w-full"
        onClick={() => verify.mutate()}
        disabled={verify.isPending}
      >
        {verify.isPending ? (
          <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Checking...</>
        ) : (
          <><CheckCircle2 className="h-4 w-4 mr-2" /> Verify Domain</>
        )}
      </Button>
    </div>
  );
}
