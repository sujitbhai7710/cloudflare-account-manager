'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Cloud, 
  Database, 
  FolderKanban, 
  HardDrive,
  Server,
  Eye,
  EyeOff,
  AlertCircle,
  LogOut,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

// Types
interface Account {
  id: string;
  name: string;
  email: string;
  accountId: string;
  apiToken: string;
  isActive: boolean;
  lastSync?: string;
  workers: WorkerItem[];
  databases: D1Item[];
  namespaces: KVItem[];
  buckets: R2Item[];
}

interface WorkerItem {
  id: string;
  name: string;
  modified_on?: string;
}

interface D1Item {
  uuid: string;
  name: string;
  version?: string;
  created_at?: string;
}

interface KVItem {
  id: string;
  title: string;
}

interface R2Item {
  name: string;
  creation_date?: string;
}

const STORAGE_KEY = 'cf_manager_accounts';

// Cloudflare API functions
async function fetchWithAuth(url: string, apiToken: string) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.errors?.[0]?.message || 'API Error');
  }
  return data.result;
}

export default function HomePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Modal state
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    email: '',
    accountId: '',
    apiToken: '',
  });
  const [showToken, setShowToken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Load accounts from localStorage
  useEffect(() => {
    const savedPassword = localStorage.getItem('cf_manager_password');
    if (savedPassword) {
      setIsLoggedIn(true);
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setAccounts(JSON.parse(saved));
      }
    }
    setIsLoading(false);
  }, []);

  // Save accounts to localStorage
  useEffect(() => {
    if (accounts.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    }
  }, [accounts]);

  const handleSetPassword = () => {
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    localStorage.setItem('cf_manager_password', password);
    setIsLoggedIn(true);
    toast.success('Password set successfully');
  };

  const handleLogin = () => {
    const savedPassword = localStorage.getItem('cf_manager_password');
    if (loginPassword === savedPassword) {
      setIsLoggedIn(true);
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setAccounts(JSON.parse(saved));
      }
      toast.success('Welcome back!');
    } else {
      toast.error('Incorrect password');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoginPassword('');
  };

  const handleAddAccount = async () => {
    if (!newAccount.name || !newAccount.accountId || !newAccount.apiToken) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Verify token by fetching account info
      const accountInfo = await fetchWithAuth(
        `https://api.cloudflare.com/client/v4/accounts/${newAccount.accountId}`,
        newAccount.apiToken
      );

      const account: Account = {
        id: crypto.randomUUID(),
        name: newAccount.name,
        email: newAccount.email,
        accountId: newAccount.accountId,
        apiToken: newAccount.apiToken,
        isActive: true,
        workers: [],
        databases: [],
        namespaces: [],
        buckets: [],
      };

      // Initial sync
      try {
        const [workers, databases, namespaces, buckets] = await Promise.all([
          fetchWithAuth(
            `https://api.cloudflare.com/client/v4/accounts/${newAccount.accountId}/workers/scripts`,
            newAccount.apiToken
          ).catch(() => []),
          fetchWithAuth(
            `https://api.cloudflare.com/client/v4/accounts/${newAccount.accountId}/d1/database`,
            newAccount.apiToken
          ).catch(() => []),
          fetchWithAuth(
            `https://api.cloudflare.com/client/v4/accounts/${newAccount.accountId}/storage/kv/namespaces`,
            newAccount.apiToken
          ).catch(() => []),
          fetchWithAuth(
            `https://api.cloudflare.com/client/v4/accounts/${newAccount.accountId}/r2/buckets`,
            newAccount.apiToken
          ).catch(() => []),
        ]);

        account.workers = workers.map((w: WorkerItem) => ({ id: w.id, name: w.id, modified_on: w.modified_on }));
        account.databases = databases.map((d: D1Item) => ({ uuid: d.uuid, name: d.name, version: d.version, created_at: d.created_at }));
        account.namespaces = namespaces.map((n: KVItem) => ({ id: n.id, title: n.title }));
        account.buckets = buckets.map((b: R2Item) => ({ name: b.name, creation_date: b.creation_date }));
        account.lastSync = new Date().toISOString();
      } catch (syncError) {
        console.error('Sync error:', syncError);
      }

      setAccounts(prev => [...prev, account]);
      toast.success(`Account "${accountInfo.name}" added successfully!`);
      setShowAddAccount(false);
      setNewAccount({ name: '', email: '', accountId: '', apiToken: '' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to add account';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSync = async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    setSyncingAccountId(accountId);
    try {
      const [workers, databases, namespaces, buckets] = await Promise.all([
        fetchWithAuth(
          `https://api.cloudflare.com/client/v4/accounts/${account.accountId}/workers/scripts`,
          account.apiToken
        ).catch(() => []),
        fetchWithAuth(
          `https://api.cloudflare.com/client/v4/accounts/${account.accountId}/d1/database`,
          account.apiToken
        ).catch(() => []),
        fetchWithAuth(
          `https://api.cloudflare.com/client/v4/accounts/${account.accountId}/storage/kv/namespaces`,
          account.apiToken
        ).catch(() => []),
        fetchWithAuth(
          `https://api.cloudflare.com/client/v4/accounts/${account.accountId}/r2/buckets`,
          account.apiToken
        ).catch(() => []),
      ]);

      setAccounts(prev => prev.map(a => {
        if (a.id === accountId) {
          return {
            ...a,
            workers: workers.map((w: WorkerItem) => ({ id: w.id, name: w.id, modified_on: w.modified_on })),
            databases: databases.map((d: D1Item) => ({ uuid: d.uuid, name: d.name, version: d.version, created_at: d.created_at })),
            namespaces: namespaces.map((n: KVItem) => ({ id: n.id, title: n.title })),
            buckets: buckets.map((b: R2Item) => ({ name: b.name, creation_date: b.creation_date })),
            lastSync: new Date().toISOString(),
          };
        }
        return a;
      }));

      toast.success(`Synced: ${workers.length} workers, ${databases.length} databases, ${namespaces.length} KV, ${buckets.length} R2`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to sync';
      toast.error(message);
    } finally {
      setSyncingAccountId(null);
    }
  };

  const handleDeleteAccount = (id: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return;
    setAccounts(prev => prev.filter(a => a.id !== id));
    toast.success('Account deleted');
  };

  // Get all resources across accounts
  const allWorkers = accounts.flatMap(a => a.workers.map(w => ({ ...w, accountName: a.name, accountId: a.id })));
  const allDatabases = accounts.flatMap(a => a.databases.map(d => ({ ...d, accountName: a.name, accountId: a.id })));
  const allNamespaces = accounts.flatMap(a => a.namespaces.map(n => ({ ...n, accountName: a.name, accountId: a.id })));
  const allBuckets = accounts.flatMap(a => a.buckets.map(b => ({ ...b, accountName: a.name, accountId: a.id })));

  const stats = {
    accounts: accounts.length,
    workers: allWorkers.length,
    databases: allDatabases.length,
    namespaces: allNamespaces.length,
    buckets: allBuckets.length,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // Login/Setup screen
  if (!isLoggedIn) {
    const hasPassword = !!localStorage.getItem('cf_manager_password');
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <Card className="w-full max-w-md border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-gradient-to-br from-orange-500 to-red-500">
                <Cloud className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-white">Cloudflare Manager</CardTitle>
            <CardDescription className="text-slate-400">
              {hasPassword ? 'Enter your password to continue' : 'Set a password to protect your accounts'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasPassword ? (
              <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-200">Password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
                  Unlock
                </Button>
              </form>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); handleSetPassword(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-200">Set Password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <p className="text-xs text-slate-400">This password protects your account data</p>
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
                  Set Password
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-red-500">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Cloudflare Manager</h1>
              <p className="text-xs text-slate-400">{stats.accounts} accounts connected</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem(STORAGE_KEY); setAccounts([]); toast.success('All data cleared'); }} className="text-slate-300 hover:text-white">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Data
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-300 hover:text-white">
              <LogOut className="w-4 h-4 mr-2" />
              Lock
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Server className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.accounts}</p>
                  <p className="text-xs text-slate-400">Accounts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <Cloud className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.workers}</p>
                  <p className="text-xs text-slate-400">Workers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <Database className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.databases}</p>
                  <p className="text-xs text-slate-400">D1 Databases</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <FolderKanban className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.namespaces}</p>
                  <p className="text-xs text-slate-400">KV Namespaces</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/20">
                  <HardDrive className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.buckets}</p>
                  <p className="text-xs text-slate-400">R2 Buckets</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border border-slate-700 mb-4">
            <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700">Accounts</TabsTrigger>
            <TabsTrigger value="workers" className="data-[state=active]:bg-slate-700">Workers</TabsTrigger>
            <TabsTrigger value="d1" className="data-[state=active]:bg-slate-700">D1</TabsTrigger>
            <TabsTrigger value="kv" className="data-[state=active]:bg-slate-700">KV</TabsTrigger>
            <TabsTrigger value="r2" className="data-[state=active]:bg-slate-700">R2</TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Add Account Button */}
              <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
                <DialogTrigger asChild>
                  <Card className="bg-slate-800/50 border-slate-700 border-dashed cursor-pointer hover:bg-slate-700/50 transition-colors">
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <Plus className="w-10 h-10 text-slate-500 mb-2" />
                      <p className="text-slate-400">Add Cloudflare Account</p>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Cloudflare Account</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Add a Cloudflare account to manage its resources
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-slate-200">Account Name *</Label>
                      <Input
                        placeholder="My Production Account"
                        value={newAccount.name}
                        onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-200">Cloudflare Account ID *</Label>
                      <Input
                        placeholder="abc123def456..."
                        value={newAccount.accountId}
                        onChange={(e) => setNewAccount({ ...newAccount, accountId: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                      <p className="text-xs text-slate-400">Find in Cloudflare Dashboard → Overview</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-200">API Token *</Label>
                      <div className="relative">
                        <Input
                          type={showToken ? 'text' : 'password'}
                          placeholder="••••••••••••••••"
                          value={newAccount.apiToken}
                          onChange={(e) => setNewAccount({ ...newAccount, apiToken: e.target.value })}
                          className="bg-slate-700 border-slate-600 text-white pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-400">
                        <a 
                          href="https://dash.cloudflare.com/profile/api-tokens"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-400 hover:text-orange-300 underline inline-flex items-center gap-1"
                        >
                          Go to API Tokens page
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <span className="block mt-1">Click "Create Token" → "Create Custom Token" and add these permissions:</span>
                      </p>
                      <div className="mt-2 p-2 bg-slate-900/50 rounded text-xs font-mono space-y-1">
                        <p className="text-green-400">Account permissions:</p>
                        <p className="text-slate-300 ml-2">• Account Settings: Read</p>
                        <p className="text-slate-300 ml-2">• Workers Scripts: Read</p>
                        <p className="text-slate-300 ml-2">• Workers KV Storage: Read</p>
                        <p className="text-slate-300 ml-2">• D1: Read</p>
                        <p className="text-slate-300 ml-2">• R2: Read</p>
                        <p className="text-blue-400 mt-2">Zone permissions:</p>
                        <p className="text-slate-300 ml-2">• Zone: Read</p>
                        <p className="text-slate-300 ml-2">• Workers Routes: Read</p>
                        <p className="text-yellow-400 mt-2">Scope: All accounts & All zones</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-200">Email (optional)</Label>
                      <Input
                        type="email"
                        placeholder="admin@example.com"
                        value={newAccount.email}
                        onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddAccount(false)} className="border-slate-600 text-slate-300">
                      Cancel
                    </Button>
                    <Button onClick={handleAddAccount} disabled={isSubmitting} className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Add Account
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {/* Account Cards */}
              {accounts.map((account) => (
                <Card key={account.id} className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg text-white">{account.name}</CardTitle>
                      <Badge variant="outline" className="text-green-400 border-green-400">Active</Badge>
                    </div>
                    <CardDescription className="text-slate-400">
                      ID: {account.accountId.slice(0, 12)}...
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                      <div className="bg-slate-700/50 rounded p-2">
                        <p className="text-slate-400">Workers</p>
                        <p className="text-xl font-semibold text-white">{account.workers.length}</p>
                      </div>
                      <div className="bg-slate-700/50 rounded p-2">
                        <p className="text-slate-400">D1</p>
                        <p className="text-xl font-semibold text-white">{account.databases.length}</p>
                      </div>
                      <div className="bg-slate-700/50 rounded p-2">
                        <p className="text-slate-400">KV</p>
                        <p className="text-xl font-semibold text-white">{account.namespaces.length}</p>
                      </div>
                      <div className="bg-slate-700/50 rounded p-2">
                        <p className="text-slate-400">R2</p>
                        <p className="text-xl font-semibold text-white">{account.buckets.length}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleSync(account.id)}
                        disabled={syncingAccountId === account.id}
                        className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        {syncingAccountId === account.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-1" />
                        )}
                        Sync
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleDeleteAccount(account.id)}
                        className="border-red-600/50 text-red-400 hover:bg-red-600/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {account.lastSync && (
                      <p className="text-xs text-slate-500 mt-2 text-center">
                        Last sync: {new Date(account.lastSync).toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {accounts.length === 0 && (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">No Cloudflare accounts added yet</p>
                <p className="text-sm text-slate-500">Click the card above to add your first account</p>
              </div>
            )}
          </TabsContent>
          
          {/* Workers Tab */}
          <TabsContent value="workers">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-orange-400" />
                  All Workers ({allWorkers.length})
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Workers from all connected accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allWorkers.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 hover:bg-slate-700/50">
                          <TableHead className="text-slate-300">Name</TableHead>
                          <TableHead className="text-slate-300">Account</TableHead>
                          <TableHead className="text-slate-300">Modified</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allWorkers.map((worker, i) => (
                          <TableRow key={worker.id + i} className="border-slate-700 hover:bg-slate-700/50">
                            <TableCell className="font-medium text-white">{worker.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                {worker.accountName}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">
                              {worker.modified_on ? new Date(worker.modified_on).toLocaleDateString() : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    No workers found. Add a Cloudflare account to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* D1 Tab */}
          <TabsContent value="d1">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-green-400" />
                  All D1 Databases ({allDatabases.length})
                </CardTitle>
                <CardDescription className="text-slate-400">
                  D1 databases from all connected accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allDatabases.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 hover:bg-slate-700/50">
                          <TableHead className="text-slate-300">Name</TableHead>
                          <TableHead className="text-slate-300">ID</TableHead>
                          <TableHead className="text-slate-300">Version</TableHead>
                          <TableHead className="text-slate-300">Account</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allDatabases.map((db, i) => (
                          <TableRow key={db.uuid + i} className="border-slate-700 hover:bg-slate-700/50">
                            <TableCell className="font-medium text-white">{db.name}</TableCell>
                            <TableCell className="text-slate-400 font-mono text-sm">{db.uuid.slice(0, 8)}...</TableCell>
                            <TableCell>
                              {db.version && (
                                <Badge variant="outline" className="border-green-600/50 text-green-400">
                                  v{db.version}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                {db.accountName}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    No D1 databases found. Add a Cloudflare account to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* KV Tab */}
          <TabsContent value="kv">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-purple-400" />
                  All KV Namespaces ({allNamespaces.length})
                </CardTitle>
                <CardDescription className="text-slate-400">
                  KV namespaces from all connected accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allNamespaces.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 hover:bg-slate-700/50">
                          <TableHead className="text-slate-300">Title</TableHead>
                          <TableHead className="text-slate-300">ID</TableHead>
                          <TableHead className="text-slate-300">Account</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allNamespaces.map((ns, i) => (
                          <TableRow key={ns.id + i} className="border-slate-700 hover:bg-slate-700/50">
                            <TableCell className="font-medium text-white">{ns.title}</TableCell>
                            <TableCell className="text-slate-400 font-mono text-sm">{ns.id}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                {ns.accountName}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    No KV namespaces found. Add a Cloudflare account to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* R2 Tab */}
          <TabsContent value="r2">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-cyan-400" />
                  All R2 Buckets ({allBuckets.length})
                </CardTitle>
                <CardDescription className="text-slate-400">
                  R2 buckets from all connected accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allBuckets.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 hover:bg-slate-700/50">
                          <TableHead className="text-slate-300">Bucket Name</TableHead>
                          <TableHead className="text-slate-300">Account</TableHead>
                          <TableHead className="text-slate-300">Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allBuckets.map((bucket, i) => (
                          <TableRow key={bucket.name + i} className="border-slate-700 hover:bg-slate-700/50">
                            <TableCell className="font-medium text-white">{bucket.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                {bucket.accountName}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">
                              {bucket.creation_date ? new Date(bucket.creation_date).toLocaleDateString() : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    No R2 buckets found. Add a Cloudflare account to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
