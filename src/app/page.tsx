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
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  LogOut, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Cloud, 
  Database, 
  FolderKanban, 
  HardDrive,
  Server,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';

// Types
interface User {
  id: string;
  email: string;
  accountsCount: number;
}

interface Account {
  id: string;
  name: string;
  email?: string;
  accountId: string;
  isActive: boolean;
  lastSync?: string;
  stats: {
    workers: number;
    d1Databases: number;
    kvNamespaces: number;
    r2Buckets: number;
  };
  createdAt: string;
}

interface Worker {
  id: string;
  workerId: string;
  name: string;
  accountId: string;
  accountName: string;
  createdAt: string;
}

interface D1Database {
  id: string;
  databaseId: string;
  name: string;
  version?: string;
  accountId: string;
  accountName: string;
  createdAt: string;
}

interface KVNamespace {
  id: string;
  namespaceId: string;
  title: string;
  accountId: string;
  accountName: string;
  createdAt: string;
}

interface R2Bucket {
  id: string;
  bucketName: string;
  creationDate?: string;
  accountId: string;
  accountName: string;
  createdAt: string;
}

export default function HomePage() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  // Data state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [databases, setDatabases] = useState<D1Database[]>([]);
  const [namespaces, setNamespaces] = useState<KVNamespace[]>([]);
  const [buckets, setBuckets] = useState<R2Bucket[]>([]);
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
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  
  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);
  
  // Fetch data when user logs in
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);
  
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {
      // Not logged in
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchData = async () => {
    try {
      const [accountsRes, workersRes, d1Res, kvRes, r2Res] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/workers'),
        fetch('/api/d1'),
        fetch('/api/kv'),
        fetch('/api/r2'),
      ]);
      
      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(data.accounts);
      }
      if (workersRes.ok) {
        const data = await workersRes.json();
        setWorkers(data.workers);
      }
      if (d1Res.ok) {
        const data = await d1Res.json();
        setDatabases(data.databases);
      }
      if (kvRes.ok) {
        const data = await kvRes.json();
        setNamespaces(data.namespaces);
      }
      if (r2Res.ok) {
        const data = await r2Res.json();
        setBuckets(data.buckets);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };
  
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const body = authMode === 'login' 
        ? { email, password }
        : { email, password, confirmPassword };
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || 'Authentication failed');
        return;
      }
      
      toast.success(authMode === 'login' ? 'Welcome back!' : 'Account created!');
      checkAuth();
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setAccounts([]);
      setWorkers([]);
      setDatabases([]);
      setNamespaces([]);
      setBuckets([]);
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to logout');
    }
  };
  
  const handleAddAccount = async () => {
    if (!newAccount.name || !newAccount.accountId || !newAccount.apiToken) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccount),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || 'Failed to add account');
        return;
      }
      
      toast.success('Account added successfully!');
      setShowAddAccount(false);
      setNewAccount({ name: '', email: '', accountId: '', apiToken: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to add account');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account? This will remove all cached data.')) {
      return;
    }
    
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
      
      if (!res.ok) {
        toast.error('Failed to delete account');
        return;
      }
      
      toast.success('Account deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete account');
    }
  };
  
  const handleSync = async (id: string) => {
    setSyncingAccountId(id);
    try {
      const res = await fetch(`/api/accounts/${id}/sync`, { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || 'Failed to sync');
        return;
      }
      
      toast.success(`Synced: ${data.stats.workers} workers, ${data.stats.databases} databases, ${data.stats.namespaces} KV, ${data.stats.buckets} R2`);
      fetchData();
    } catch (error) {
      toast.error('Failed to sync account');
    } finally {
      setSyncingAccountId(null);
    }
  };
  
  // Stats
  const stats = {
    accounts: accounts.length,
    workers: workers.length,
    databases: databases.length,
    namespaces: namespaces.length,
    buckets: buckets.length,
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }
  
  // Auth form
  if (!user) {
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
              Manage multiple Cloudflare accounts in one place
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as 'login' | 'signup')}>
              <TabsList className="grid w-full grid-cols-2 bg-slate-700">
                <TabsTrigger value="login" className="data-[state=active]:bg-slate-600">Login</TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-slate-600">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="mt-4">
                <form onSubmit={handleAuth} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-200">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-200">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Sign In
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="mt-4">
                <form onSubmit={handleAuth} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-slate-200">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-slate-200">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-slate-200">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Create Account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
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
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchData} className="text-slate-300 hover:text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-300 hover:text-white">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
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
            <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700">Overview</TabsTrigger>
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
                      <p className="text-xs text-slate-400">Create token with Workers, D1, KV, R2 read permissions</p>
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
                      <div className="flex items-center gap-1">
                        {account.isActive ? (
                          <Badge variant="outline" className="text-green-400 border-green-400">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 border-slate-400">Inactive</Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription className="text-slate-400">
                      ID: {account.accountId.slice(0, 8)}...
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                      <div className="bg-slate-700/50 rounded p-2">
                        <p className="text-slate-400">Workers</p>
                        <p className="text-xl font-semibold text-white">{account.stats.workers}</p>
                      </div>
                      <div className="bg-slate-700/50 rounded p-2">
                        <p className="text-slate-400">D1</p>
                        <p className="text-xl font-semibold text-white">{account.stats.d1Databases}</p>
                      </div>
                      <div className="bg-slate-700/50 rounded p-2">
                        <p className="text-slate-400">KV</p>
                        <p className="text-xl font-semibold text-white">{account.stats.kvNamespaces}</p>
                      </div>
                      <div className="bg-slate-700/50 rounded p-2">
                        <p className="text-slate-400">R2</p>
                        <p className="text-xl font-semibold text-white">{account.stats.r2Buckets}</p>
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
                  All Workers
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Workers from all connected accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {workers.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 hover:bg-slate-700/50">
                          <TableHead className="text-slate-300">Name</TableHead>
                          <TableHead className="text-slate-300">Worker ID</TableHead>
                          <TableHead className="text-slate-300">Account</TableHead>
                          <TableHead className="text-slate-300">Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workers.map((worker) => (
                          <TableRow key={worker.id} className="border-slate-700 hover:bg-slate-700/50">
                            <TableCell className="font-medium text-white">{worker.name}</TableCell>
                            <TableCell className="text-slate-400 font-mono text-sm">{worker.workerId}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                {worker.accountName}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">
                              {new Date(worker.createdAt).toLocaleDateString()}
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
                  All D1 Databases
                </CardTitle>
                <CardDescription className="text-slate-400">
                  D1 databases from all connected accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {databases.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 hover:bg-slate-700/50">
                          <TableHead className="text-slate-300">Name</TableHead>
                          <TableHead className="text-slate-300">Database ID</TableHead>
                          <TableHead className="text-slate-300">Version</TableHead>
                          <TableHead className="text-slate-300">Account</TableHead>
                          <TableHead className="text-slate-300">Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {databases.map((db) => (
                          <TableRow key={db.id} className="border-slate-700 hover:bg-slate-700/50">
                            <TableCell className="font-medium text-white">{db.name}</TableCell>
                            <TableCell className="text-slate-400 font-mono text-sm">{db.databaseId}</TableCell>
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
                            <TableCell className="text-slate-400 text-sm">
                              {new Date(db.createdAt).toLocaleDateString()}
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
                  All KV Namespaces
                </CardTitle>
                <CardDescription className="text-slate-400">
                  KV namespaces from all connected accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {namespaces.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 hover:bg-slate-700/50">
                          <TableHead className="text-slate-300">Title</TableHead>
                          <TableHead className="text-slate-300">Namespace ID</TableHead>
                          <TableHead className="text-slate-300">Account</TableHead>
                          <TableHead className="text-slate-300">Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {namespaces.map((ns) => (
                          <TableRow key={ns.id} className="border-slate-700 hover:bg-slate-700/50">
                            <TableCell className="font-medium text-white">{ns.title}</TableCell>
                            <TableCell className="text-slate-400 font-mono text-sm">{ns.namespaceId}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                {ns.accountName}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">
                              {new Date(ns.createdAt).toLocaleDateString()}
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
                  All R2 Buckets
                </CardTitle>
                <CardDescription className="text-slate-400">
                  R2 buckets from all connected accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {buckets.length > 0 ? (
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
                        {buckets.map((bucket) => (
                          <TableRow key={bucket.id} className="border-slate-700 hover:bg-slate-700/50">
                            <TableCell className="font-medium text-white">{bucket.bucketName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                {bucket.accountName}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">
                              {bucket.creationDate ? new Date(bucket.creationDate).toLocaleDateString() : '-'}
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
