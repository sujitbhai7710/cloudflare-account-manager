'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Cloud,
  Server,
  Database,
  FolderKanban,
  HardDrive,
  Plus,
  RefreshCw,
  Settings,
  LogOut,
  User,
  Loader2,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Trash2,
  ExternalLink,
  Search,
  Filter,
  Clock,
  AlertCircle,
} from 'lucide-react';

// Types
interface Account {
  id: string;
  name: string;
  email: string | null;
  accountId: string;
  isActive: boolean;
  lastSync: string | null;
  createdAt: string;
  stats: {
    workers: number;
    databases: number;
    kvNamespaces: number;
    r2Buckets: number;
  };
}

interface Worker {
  id: string;
  workerId: string;
  name: string;
  compatibilityDate: string | null;
  createdAt: string;
  account: { id: string; name: string };
}

interface D1Database {
  id: string;
  databaseId: string;
  name: string;
  version: string | null;
  createdAt: string;
  account: { id: string; name: string };
}

interface KVNamespace {
  id: string;
  namespaceId: string;
  title: string;
  createdAt: string;
  account: { id: string; name: string };
}

interface R2Bucket {
  id: string;
  bucketName: string;
  creationDate: string | null;
  createdAt: string;
  account: { id: string; name: string };
}

export default function Dashboard() {
  const router = useRouter();

  // State
  const [user, setUser] = useState<{ id: string; email: string; name: string | null } | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [databases, setDatabases] = useState<D1Database[]>([]);
  const [kvNamespaces, setKVNamespaces] = useState<KVNamespace[]>([]);
  const [r2Buckets, setR2Buckets] = useState<R2Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAccount, setFilterAccount] = useState<string>('all');

  // Add Account Dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    email: '',
    accountId: '',
    apiToken: '',
  });
  const [addingAccount, setAddingAccount] = useState(false);
  const [addError, setAddError] = useState('');

  // Sync state
  const [syncing, setSyncing] = useState<string | null>(null);

  // Check authentication and fetch data
  const fetchData = useCallback(async () => {
    try {
      // Check auth
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();

      if (!authData.success) {
        router.push('/login');
        return;
      }

      setUser(authData.user);

      // Fetch all data in parallel
      const [accountsRes, workersRes, d1Res, kvRes, r2Res] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/workers'),
        fetch('/api/d1'),
        fetch('/api/kv'),
        fetch('/api/r2'),
      ]);

      const [accountsData, workersData, d1Data, kvData, r2Data] = await Promise.all([
        accountsRes.json(),
        workersRes.json(),
        d1Res.json(),
        kvRes.json(),
        r2Res.json(),
      ]);

      if (accountsData.success) setAccounts(accountsData.accounts);
      if (workersData.success) setWorkers(workersData.workers);
      if (d1Data.success) setDatabases(d1Data.databases);
      if (kvData.success) setKVNamespaces(kvData.namespaces);
      if (r2Data.success) setR2Buckets(r2Data.buckets);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Logout
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // Add account
  const handleAddAccount = async () => {
    if (!newAccount.name || !newAccount.accountId || !newAccount.apiToken) {
      setAddError('Please fill in all required fields');
      return;
    }

    setAddingAccount(true);
    setAddError('');

    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccount),
      });

      const data = await res.json();

      if (data.success) {
        setAddDialogOpen(false);
        setNewAccount({ name: '', email: '', accountId: '', apiToken: '' });
        fetchData();
      } else {
        setAddError(data.error || 'Failed to add account');
      }
    } catch {
      setAddError('Failed to add account');
    } finally {
      setAddingAccount(false);
    }
  };

  // Sync account
  const handleSyncAccount = async (accountId: string) => {
    setSyncing(accountId);
    try {
      const res = await fetch(`/api/accounts/${accountId}/sync`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(null);
    }
  };

  // Delete account
  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this account? All cached data will be removed.')) return;

    try {
      await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  // Filter resources
  const filterResources = <T extends { account: { id: string; name: string }; name?: string; title?: string; workerId?: string; bucketName?: string }>(
    resources: T[]
  ): T[] => {
    return resources.filter((resource) => {
      const matchesSearch = searchQuery === '' ||
        (resource.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.workerId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.bucketName?.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesAccount = filterAccount === 'all' || resource.account.id === filterAccount;

      return matchesSearch && matchesAccount;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg">
                <Cloud className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Cloudflare Manager</h1>
                <p className="text-xs text-slate-400">{accounts.length} account{accounts.length !== 1 ? 's' : ''} connected</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-700">
                    <User className="h-4 w-4 mr-2" />
                    {user?.name || user?.email}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-800 border-slate-700">
                  <DropdownMenuItem onClick={handleLogout} className="text-slate-300 hover:text-white hover:bg-slate-700">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Accounts</p>
                  <p className="text-3xl font-bold text-white">{accounts.length}</p>
                </div>
                <div className="p-3 bg-orange-500/20 rounded-lg">
                  <Cloud className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Workers</p>
                  <p className="text-3xl font-bold text-green-500">{workers.length}</p>
                </div>
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <Server className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">D1 Databases</p>
                  <p className="text-3xl font-bold text-blue-500">{databases.length}</p>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <Database className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">KV + R2</p>
                  <p className="text-3xl font-bold text-purple-500">{kvNamespaces.length + r2Buckets.length}</p>
                </div>
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <FolderKanban className="h-6 w-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-slate-800/50 border border-slate-700 p-1">
              <TabsTrigger value="overview" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-slate-400">
                <Cloud className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="workers" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-slate-400">
                <Server className="h-4 w-4 mr-2" />
                Workers
              </TabsTrigger>
              <TabsTrigger value="d1" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-slate-400">
                <Database className="h-4 w-4 mr-2" />
                D1
              </TabsTrigger>
              <TabsTrigger value="kv" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-slate-400">
                <FolderKanban className="h-4 w-4 mr-2" />
                KV
              </TabsTrigger>
              <TabsTrigger value="r2" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-slate-400">
                <HardDrive className="h-4 w-4 mr-2" />
                R2
              </TabsTrigger>
            </TabsList>

            {/* Add Account Button */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Cloudflare Account</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Connect your Cloudflare account using an API token
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {addError && (
                    <Alert className="bg-red-900/20 border-red-800 text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{addError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label className="text-slate-300">Account Name *</Label>
                    <Input
                      placeholder="Production Account"
                      value={newAccount.name}
                      onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                      className="bg-slate-900/50 border-slate-600 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Email (optional)</Label>
                    <Input
                      type="email"
                      placeholder="admin@example.com"
                      value={newAccount.email}
                      onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                      className="bg-slate-900/50 border-slate-600 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Cloudflare Account ID *</Label>
                    <Input
                      placeholder="abc123def456..."
                      value={newAccount.accountId}
                      onChange={(e) => setNewAccount({ ...newAccount, accountId: e.target.value })}
                      className="bg-slate-900/50 border-slate-600 text-white font-mono text-sm"
                    />
                    <p className="text-xs text-slate-500">Found in Cloudflare Dashboard sidebar</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">API Token *</Label>
                    <Input
                      type="password"
                      placeholder="Enter your API token"
                      value={newAccount.apiToken}
                      onChange={(e) => setNewAccount({ ...newAccount, apiToken: e.target.value })}
                      className="bg-slate-900/50 border-slate-600 text-white font-mono text-sm"
                    />
                    <p className="text-xs text-slate-500">
                      Create token with Workers, D1, KV, R2 read permissions
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAddDialogOpen(false)}
                    className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddAccount}
                    disabled={addingAccount}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    {addingAccount ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Account'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search and Filter */}
          {(activeTab !== 'overview') && (
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Search resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="bg-slate-800/50 border border-slate-700 rounded-md px-3 py-2 text-white"
              >
                <option value="all">All Accounts</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Accounts List */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Cloud className="h-5 w-5 text-orange-500" />
                    Connected Accounts
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    All your Cloudflare accounts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {accounts.length === 0 ? (
                    <div className="py-8 text-center text-slate-500">
                      <Cloud className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No accounts connected yet</p>
                      <Button
                        onClick={() => setAddDialogOpen(true)}
                        className="mt-4 bg-orange-500 hover:bg-orange-600"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Account
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {accounts.map((account) => (
                          <div
                            key={account.id}
                            className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${account.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="font-medium text-white">{account.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSyncAccount(account.id)}
                                  disabled={syncing === account.id}
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                                >
                                  <RefreshCw className={`h-4 w-4 ${syncing === account.id ? 'animate-spin' : ''}`} />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="bg-slate-800 border-slate-700">
                                    <DropdownMenuItem
                                      onClick={() => handleSyncAccount(account.id)}
                                      className="text-slate-300 hover:text-white hover:bg-slate-700"
                                    >
                                      <RefreshCw className="h-4 w-4 mr-2" />
                                      Sync Now
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-slate-700" />
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteAccount(account.id)}
                                      className="text-red-400 hover:text-red-300 hover:bg-slate-700"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Remove Account
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-400">
                              <span className="font-mono">{account.accountId}</span>
                              {account.lastSync && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(account.lastSync).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-3 text-sm">
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                {account.stats.workers} Workers
                              </Badge>
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                {account.stats.databases} D1
                              </Badge>
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                {account.stats.kvNamespaces} KV
                              </Badge>
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                {account.stats.r2Buckets} R2
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Resource Summary</CardTitle>
                  <CardDescription className="text-slate-400">
                    All resources across all accounts
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <Server className="h-8 w-8 text-green-500" />
                        <div>
                          <p className="text-2xl font-bold text-white">{workers.length}</p>
                          <p className="text-sm text-slate-400">Workers</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <Database className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="text-2xl font-bold text-white">{databases.length}</p>
                          <p className="text-sm text-slate-400">D1 Databases</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <FolderKanban className="h-8 w-8 text-purple-500" />
                        <div>
                          <p className="text-2xl font-bold text-white">{kvNamespaces.length}</p>
                          <p className="text-sm text-slate-400">KV Namespaces</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <HardDrive className="h-8 w-8 text-amber-500" />
                        <div>
                          <p className="text-2xl font-bold text-white">{r2Buckets.length}</p>
                          <p className="text-sm text-slate-400">R2 Buckets</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Workers Tab */}
          <TabsContent value="workers">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">All Workers</CardTitle>
                <CardDescription className="text-slate-400">
                  Workers from all connected accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filterResources(workers).length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No workers found</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <table className="w-full">
                      <thead className="bg-slate-900/50 sticky top-0">
                        <tr className="text-left text-slate-400 text-sm">
                          <th className="p-3">Name</th>
                          <th className="p-3">Account</th>
                          <th className="p-3">ID</th>
                          <th className="p-3">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filterResources(workers).map((worker) => (
                          <tr key={worker.id} className="border-t border-slate-700/50 hover:bg-slate-900/30">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Server className="h-4 w-4 text-green-500" />
                                <span className="text-white font-medium">{worker.name}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                {worker.account.name}
                              </Badge>
                            </td>
                            <td className="p-3 font-mono text-xs text-slate-400">{worker.workerId}</td>
                            <td className="p-3 text-sm text-slate-400">
                              {new Date(worker.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* D1 Tab */}
          <TabsContent value="d1">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">D1 Databases</CardTitle>
                <CardDescription className="text-slate-400">
                  SQLite databases from all accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filterResources(databases).length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No databases found</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <table className="w-full">
                      <thead className="bg-slate-900/50 sticky top-0">
                        <tr className="text-left text-slate-400 text-sm">
                          <th className="p-3">Name</th>
                          <th className="p-3">Account</th>
                          <th className="p-3">Database ID</th>
                          <th className="p-3">Version</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filterResources(databases).map((db) => (
                          <tr key={db.id} className="border-t border-slate-700/50 hover:bg-slate-900/30">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Database className="h-4 w-4 text-blue-500" />
                                <span className="text-white font-medium">{db.name}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                {db.account.name}
                              </Badge>
                            </td>
                            <td className="p-3 font-mono text-xs text-slate-400">{db.databaseId}</td>
                            <td className="p-3 text-sm text-slate-400">{db.version || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* KV Tab */}
          <TabsContent value="kv">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">KV Namespaces</CardTitle>
                <CardDescription className="text-slate-400">
                  Key-Value namespaces from all accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filterResources(kvNamespaces).length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No KV namespaces found</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <table className="w-full">
                      <thead className="bg-slate-900/50 sticky top-0">
                        <tr className="text-left text-slate-400 text-sm">
                          <th className="p-3">Title</th>
                          <th className="p-3">Account</th>
                          <th className="p-3">Namespace ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filterResources(kvNamespaces).map((kv) => (
                          <tr key={kv.id} className="border-t border-slate-700/50 hover:bg-slate-900/30">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <FolderKanban className="h-4 w-4 text-purple-500" />
                                <span className="text-white font-medium">{kv.title}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                {kv.account.name}
                              </Badge>
                            </td>
                            <td className="p-3 font-mono text-xs text-slate-400">{kv.namespaceId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* R2 Tab */}
          <TabsContent value="r2">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">R2 Buckets</CardTitle>
                <CardDescription className="text-slate-400">
                  Object storage buckets from all accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filterResources(r2Buckets).length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No R2 buckets found</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <table className="w-full">
                      <thead className="bg-slate-900/50 sticky top-0">
                        <tr className="text-left text-slate-400 text-sm">
                          <th className="p-3">Bucket Name</th>
                          <th className="p-3">Account</th>
                          <th className="p-3">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filterResources(r2Buckets).map((bucket) => (
                          <tr key={bucket.id} className="border-t border-slate-700/50 hover:bg-slate-900/30">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <HardDrive className="h-4 w-4 text-amber-500" />
                                <span className="text-white font-medium">{bucket.bucketName}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                {bucket.account.name}
                              </Badge>
                            </td>
                            <td className="p-3 text-sm text-slate-400">
                              {bucket.creationDate ? new Date(bucket.creationDate).toLocaleDateString() : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-900/50 mt-auto py-4">
        <div className="container mx-auto px-4 text-center text-sm text-slate-500">
          <p>Cloudflare Manager • Multi-Account Dashboard</p>
        </div>
      </footer>
    </div>
  );
}
