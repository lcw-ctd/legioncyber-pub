'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Key, Eye, EyeOff } from 'lucide-react';

const CREDENTIAL_TYPES = [
  { value: 'bearer_token', label: 'Bearer Token', desc: 'Authorization: Bearer <token>' },
  { value: 'basic_auth', label: 'Basic Auth', desc: 'Username and password' },
  { value: 'cookie', label: 'Cookie', desc: 'Session cookie string' },
  { value: 'api_key', label: 'API Key', desc: 'Custom header or query param' },
  { value: 'form_login', label: 'Form Login', desc: 'Username/password via login form' },
  { value: 'oauth2', label: 'OAuth2 Client', desc: 'Client credentials flow' },
];

const credSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  credential_type: z.enum(['bearer_token', 'basic_auth', 'cookie', 'api_key', 'form_login', 'oauth2']),
  // fields vary by type; stored in credential_data
});

interface CredField {
  key: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
}

const TYPE_FIELDS: Record<string, CredField[]> = {
  bearer_token: [{ key: 'token', label: 'Bearer Token', secret: true, placeholder: 'eyJhbGci...' }],
  basic_auth: [
    { key: 'username', label: 'Username', placeholder: 'admin' },
    { key: 'password', label: 'Password', secret: true, placeholder: '••••••••' },
  ],
  cookie: [{ key: 'cookie_string', label: 'Cookie String', placeholder: 'session=abc123; csrf=xyz' }],
  api_key: [
    { key: 'header_name', label: 'Header Name', placeholder: 'X-API-Key' },
    { key: 'api_key', label: 'API Key Value', secret: true, placeholder: 'sk-...' },
  ],
  form_login: [
    { key: 'login_url', label: 'Login URL', placeholder: 'https://example.com/login' },
    { key: 'username_field', label: 'Username Field Name', placeholder: 'username' },
    { key: 'password_field', label: 'Password Field Name', placeholder: 'password' },
    { key: 'username', label: 'Username', placeholder: 'admin' },
    { key: 'password', label: 'Password', secret: true, placeholder: '••••••••' },
  ],
  oauth2: [
    { key: 'token_url', label: 'Token URL', placeholder: 'https://auth.example.com/oauth/token' },
    { key: 'client_id', label: 'Client ID', placeholder: 'client_123' },
    { key: 'client_secret', label: 'Client Secret', secret: true, placeholder: '••••••••' },
    { key: 'scope', label: 'Scope (optional)', placeholder: 'read write' },
  ],
};

interface Props {
  domainId: string;
  onSaved?: () => void;
}

interface Credential {
  id: string;
  name: string;
  credential_type: string;
  created_at: string;
}

export function CredentialForm({ domainId, onSaved }: Props) {
  const qc = useQueryClient();
  const [credType, setCredType] = useState('bearer_token');
  const [name, setName] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);

  const { data: credsData } = useQuery<{ items: Credential[] }>({
    queryKey: ['domain-credentials', domainId],
    queryFn: () => api.get(`/domains/${domainId}/credentials`).then(r => r.data),
  });

  const addCred = useMutation({
    mutationFn: () => api.post(`/domains/${domainId}/credentials`, {
      name,
      credential_type: credType,
      credential_data: fieldValues,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domain-credentials', domainId] });
      setName('');
      setFieldValues({});
      setAdding(false);
      if (onSaved) onSaved();
    },
  });

  const deleteCred = useMutation({
    mutationFn: (credId: string) => api.delete(`/domains/${domainId}/credentials/${credId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domain-credentials', domainId] }),
  });

  const credentials = credsData?.items ?? [];
  const fields = TYPE_FIELDS[credType] ?? [];
  const allFilled = name.trim() && fields.every(f => !f.secret || fieldValues[f.key]);

  function toggleSecret(key: string) {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-4">
      {/* Existing credentials */}
      {credentials.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Stored Credentials</p>
          {credentials.map(cred => (
            <div
              key={cred.id}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-800 border border-slate-700"
            >
              <div className="flex items-center gap-3">
                <Key className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-sm text-white font-medium">{cred.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs border-slate-600 text-slate-400 capitalize">
                      {cred.credential_type.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-slate-400 hover:text-rose-400"
                onClick={() => deleteCred.mutate(cred.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new form */}
      {!adding ? (
        <Button
          variant="outline"
          className="w-full border-dashed border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-4 w-4 mr-1" /> Add Credential
        </Button>
      ) : (
        <div className="space-y-4 p-4 rounded-lg border border-slate-700 bg-slate-800/50">
          <div>
            <Label className="text-slate-300 mb-1 block">Credential Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Production API Token"
              className="bg-slate-800 border-slate-600"
            />
          </div>

          <div>
            <Label className="text-slate-300 mb-1 block">Type</Label>
            <Select value={credType} onValueChange={v => { setCredType(v); setFieldValues({}); }}>
              <SelectTrigger className="bg-slate-800 border-slate-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {CREDENTIAL_TYPES.map(ct => (
                  <SelectItem key={ct.value} value={ct.value}>
                    <div>
                      <p className="text-sm">{ct.label}</p>
                      <p className="text-xs text-slate-400">{ct.desc}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {fields.map(field => (
            <div key={field.key}>
              <Label className="text-slate-300 mb-1 block">{field.label}</Label>
              <div className="relative">
                <Input
                  type={field.secret && !showSecrets[field.key] ? 'password' : 'text'}
                  value={fieldValues[field.key] ?? ''}
                  onChange={e => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="bg-slate-800 border-slate-600 pr-9"
                />
                {field.secret && (
                  <button
                    type="button"
                    onClick={() => toggleSecret(field.key)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showSecrets[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => addCred.mutate()}
              disabled={!allFilled || addCred.isPending}
            >
              {addCred.isPending ? 'Saving...' : 'Save Credential'}
            </Button>
            <Button
              variant="outline"
              className="border-slate-600"
              onClick={() => { setAdding(false); setFieldValues({}); setName(''); }}
            >
              Cancel
            </Button>
          </div>

          <p className="text-xs text-slate-500">
            Credentials are encrypted at rest using AES-256. They are only used during scans and are never logged.
          </p>
        </div>
      )}
    </div>
  );
}
