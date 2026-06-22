'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CheckCircle2, Key, Bell, Users, Building2, Shield, AlertTriangle } from 'lucide-react';

const profileSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
});

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password required'),
  new_password: z.string().min(12, 'Minimum 12 characters'),
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

const orgSchema = z.object({
  name: z.string().min(1, 'Organization name required'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;
type OrgForm = z.infer<typeof orgSchema>;

export default function SettingsPage() {
  const qc = useQueryClient();
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);
  const [notifSettings, setNotifSettings] = useState({
    email_new_critical: true,
    email_new_high: true,
    email_scan_complete: true,
    email_weekly_digest: false,
  });

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then(r => r.data),
  });

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: { full_name: me?.full_name ?? '', email: me?.email ?? '' },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

  const updateProfile = useMutation({
    mutationFn: (data: ProfileForm) => api.put('/auth/me', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    },
  });

  const updatePassword = useMutation({
    mutationFn: (data: PasswordForm) => api.post('/auth/change-password', {
      current_password: data.current_password,
      new_password: data.new_password,
    }),
    onSuccess: () => {
      passwordForm.reset();
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
    },
  });

  const updateNotifications = useMutation({
    mutationFn: (settings: typeof notifSettings) =>
      api.put('/auth/me/notifications', settings),
  });

  function handleNotifToggle(key: keyof typeof notifSettings) {
    const updated = { ...notifSettings, [key]: !notifSettings[key] };
    setNotifSettings(updated);
    updateNotifications.mutate(updated);
  }

  const initials = me?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() ?? 'U';

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-0.5">Manage your account and organization preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="bg-slate-900 border border-slate-700">
          <TabsTrigger value="profile"><Users className="h-3.5 w-3.5 mr-1.5" />Profile</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-3.5 w-3.5 mr-1.5" />Security</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-3.5 w-3.5 mr-1.5" />Notifications</TabsTrigger>
          <TabsTrigger value="organization"><Building2 className="h-3.5 w-3.5 mr-1.5" />Organization</TabsTrigger>
          <TabsTrigger value="api-keys"><Key className="h-3.5 w-3.5 mr-1.5" />API Keys</TabsTrigger>
        </TabsList>

        {/* Profile tab */}
        <TabsContent value="profile" className="mt-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader><CardTitle className="text-base text-slate-200">Profile Information</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-blue-600 text-white text-xl font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-white font-medium">{me?.full_name}</p>
                  <p className="text-slate-400 text-sm">{me?.email}</p>
                </div>
              </div>
              <Separator className="bg-slate-700" />
              <form onSubmit={profileForm.handleSubmit(d => updateProfile.mutate(d))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300 mb-1 block">Full Name</Label>
                    <Input {...profileForm.register('full_name')} className="bg-slate-800 border-slate-600" />
                    {profileForm.formState.errors.full_name && (
                      <p className="text-rose-400 text-xs mt-1">{profileForm.formState.errors.full_name.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-slate-300 mb-1 block">Email</Label>
                    <Input {...profileForm.register('email')} type="email" className="bg-slate-800 border-slate-600" />
                    {profileForm.formState.errors.email && (
                      <p className="text-rose-400 text-xs mt-1">{profileForm.formState.errors.email.message}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={updateProfile.isPending}>
                    {profileSaved ? <><CheckCircle2 className="h-4 w-4 mr-1" />Saved</> : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security tab */}
        <TabsContent value="security" className="mt-4 space-y-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader><CardTitle className="text-base text-slate-200">Change Password</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={passwordForm.handleSubmit(d => updatePassword.mutate(d))} className="space-y-4 max-w-sm">
                {['current_password', 'new_password', 'confirm_password'].map(field => (
                  <div key={field}>
                    <Label className="text-slate-300 mb-1 block capitalize">
                      {field.replace(/_/g, ' ')}
                    </Label>
                    <Input
                      {...passwordForm.register(field as any)}
                      type="password"
                      className="bg-slate-800 border-slate-600"
                    />
                    {passwordForm.formState.errors[field as keyof PasswordForm] && (
                      <p className="text-rose-400 text-xs mt-1">
                        {passwordForm.formState.errors[field as keyof PasswordForm]?.message}
                      </p>
                    )}
                  </div>
                ))}
                <Button type="submit" disabled={updatePassword.isPending}>
                  {passwordSaved ? <><CheckCircle2 className="h-4 w-4 mr-1" />Updated</> : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader><CardTitle className="text-base text-slate-200">Active Sessions</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800 border border-slate-700">
                <div>
                  <p className="text-sm text-white font-medium">Current session</p>
                  <p className="text-xs text-slate-400">Browser · {new Date().toLocaleDateString()}</p>
                </div>
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications tab */}
        <TabsContent value="notifications" className="mt-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader><CardTitle className="text-base text-slate-200">Email Notifications</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'email_new_critical', label: 'New critical findings', desc: 'Immediately when a critical vulnerability is discovered' },
                { key: 'email_new_high', label: 'New high findings', desc: 'Immediately when a high severity vulnerability is discovered' },
                { key: 'email_scan_complete', label: 'Scan completed', desc: 'When a scan finishes with a summary of findings' },
                { key: 'email_weekly_digest', label: 'Weekly digest', desc: 'Weekly summary of open findings and remediation progress' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-200 font-medium">{label}</p>
                    <p className="text-xs text-slate-400">{desc}</p>
                  </div>
                  <Switch
                    checked={notifSettings[key as keyof typeof notifSettings]}
                    onCheckedChange={() => handleNotifToggle(key as keyof typeof notifSettings)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization tab */}
        <TabsContent value="organization" className="mt-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader><CardTitle className="text-base text-slate-200">Organization Details</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-sm">
              <div>
                <Label className="text-slate-300 mb-1 block">Organization Name</Label>
                <Input className="bg-slate-800 border-slate-600" defaultValue={me?.organization?.name} />
              </div>
              <div>
                <Label className="text-slate-300 mb-1 block">URL Slug</Label>
                <Input className="bg-slate-800 border-slate-600" defaultValue={me?.organization?.slug} />
                <p className="text-xs text-slate-500 mt-1">Used in your portal URL: shield.legioncyber.com/org/<strong>{me?.organization?.slug}</strong></p>
              </div>
              <Button>{orgSaved ? <><CheckCircle2 className="h-4 w-4 mr-1" />Saved</> : 'Save Organization'}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys tab */}
        <TabsContent value="api-keys" className="mt-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-slate-200">API Keys</CardTitle>
                <Button size="sm" onClick={() => api.post('/auth/api-keys').then(() => qc.invalidateQueries({ queryKey: ['api-keys'] }))}>
                  <Key className="h-3.5 w-3.5 mr-1" /> Generate Key
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Alert className="bg-blue-500/10 border-blue-500/30 text-blue-300 text-sm">
                API keys allow programmatic access to the LegionCyber Shield API. Treat them like passwords — store them securely.
              </Alert>
              <p className="text-slate-500 text-sm mt-4 text-center py-4">No API keys generated yet.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
