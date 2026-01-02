import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  ArrowLeft, Cloud, CloudOff, Upload, Download, RefreshCw, 
  CheckCircle, AlertCircle, Clock, Database, Map, Activity
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface SyncItem {
  id: string;
  type: 'routes' | 'waypoints' | 'telemetry' | 'maps';
  name: string;
  lastSynced: string | null;
  status: 'synced' | 'pending' | 'conflict' | 'local_only';
  localChanges: number;
  cloudChanges: number;
}

const mockSyncItems: SyncItem[] = [
  {
    id: '1',
    type: 'routes',
    name: 'Navigation Routes',
    lastSynced: '2025-01-02T10:30:00Z',
    status: 'synced',
    localChanges: 0,
    cloudChanges: 0
  },
  {
    id: '2',
    type: 'waypoints',
    name: 'Waypoints',
    lastSynced: '2025-01-02T10:30:00Z',
    status: 'pending',
    localChanges: 3,
    cloudChanges: 0
  },
  {
    id: '3',
    type: 'telemetry',
    name: 'Telemetry Logs',
    lastSynced: null,
    status: 'local_only',
    localChanges: 156,
    cloudChanges: 0
  },
  {
    id: '4',
    type: 'maps',
    name: 'SLAM Maps',
    lastSynced: '2025-01-01T15:45:00Z',
    status: 'conflict',
    localChanges: 2,
    cloudChanges: 1
  }
];

export default function CloudSync() {
  const [syncItems] = useState<SyncItem[]>(mockSyncItems);
  const [isConnected] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="w-4 h-4 text-secondary" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-accent" />;
      case 'conflict':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'local_only':
        return <CloudOff className="w-4 h-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'routes':
        return <Map className="w-5 h-5" />;
      case 'waypoints':
        return <Map className="w-5 h-5" />;
      case 'telemetry':
        return <Activity className="w-5 h-5" />;
      case 'maps':
        return <Database className="w-5 h-5" />;
      default:
        return <Cloud className="w-5 h-5" />;
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    // Simulate sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSyncing(false);
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/export/all');
      const data = await response.json();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roveros-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const parsedBackup = JSON.parse(event.target?.result as string);
            // Wrap the data object as expected by the server
            await fetch('/api/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: parsedBackup.data })
            });
            queryClient.invalidateQueries();
          } catch (error) {
            console.error('Import failed:', error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const syncedCount = syncItems.filter(i => i.status === 'synced').length;
  const pendingCount = syncItems.filter(i => i.status === 'pending').length;
  const conflictCount = syncItems.filter(i => i.status === 'conflict').length;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6" data-testid="page-cloud-sync">
      <header className="mb-8 flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary" data-testid="text-sync-title">CLOUD SYNC</h1>
          <p className="text-muted-foreground font-mono mt-1">Synchronize data with cloud storage</p>
        </div>
        <Link href="/">
          <Button variant="outline" className="font-mono" data-testid="button-return-hud">
            <ArrowLeft className="w-4 h-4 mr-2" /> RETURN
          </Button>
        </Link>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Sync Controls */}
        <div className="col-span-4 space-y-4">
          <Card className="hud-panel p-4">
            <h3 className="text-sm font-display text-primary mb-4">SYNC STATUS</h3>
            
            <div className="flex items-center gap-3 mb-4">
              {isConnected ? (
                <>
                  <Cloud className="w-6 h-6 text-secondary" />
                  <div>
                    <div className="text-sm font-mono text-secondary">Connected</div>
                    <div className="text-xs text-muted-foreground">Last sync: 5 min ago</div>
                  </div>
                </>
              ) : (
                <>
                  <CloudOff className="w-6 h-6 text-destructive" />
                  <div>
                    <div className="text-sm font-mono text-destructive">Disconnected</div>
                    <div className="text-xs text-muted-foreground">Check network</div>
                  </div>
                </>
              )}
            </div>

            <Button 
              className="w-full"
              onClick={handleSync}
              disabled={isSyncing || !isConnected}
              data-testid="button-sync-all"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" /> Sync Now
                </>
              )}
            </Button>
          </Card>

          <Card className="hud-panel p-4">
            <h3 className="text-sm font-display text-primary mb-4">SUMMARY</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-secondary" />
                  <span className="text-sm font-mono">Synced</span>
                </div>
                <span className="text-sm font-bold" data-testid="text-synced-count">{syncedCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent" />
                  <span className="text-sm font-mono">Pending</span>
                </div>
                <span className="text-sm font-bold text-accent" data-testid="text-pending-count">{pendingCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-mono">Conflicts</span>
                </div>
                <span className="text-sm font-bold text-destructive" data-testid="text-conflict-count">{conflictCount}</span>
              </div>
            </div>
          </Card>

          <Card className="hud-panel p-4">
            <h3 className="text-sm font-display text-primary mb-4">BACKUP / RESTORE</h3>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleExport}
                data-testid="button-export"
              >
                <Download className="w-4 h-4 mr-2" /> Export All Data
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleImport}
                data-testid="button-import"
              >
                <Upload className="w-4 h-4 mr-2" /> Import Backup
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Export creates a JSON backup of all routes, waypoints, and settings.
            </p>
          </Card>
        </div>

        {/* Sync Items List */}
        <div className="col-span-8">
          <Card className="hud-panel p-4">
            <h3 className="text-sm font-display text-primary mb-4">DATA CATEGORIES</h3>
            
            <div className="space-y-3">
              {syncItems.map((item) => (
                <div
                  key={item.id}
                  className={`border rounded p-4 transition-all cursor-pointer ${
                    selectedItems.has(item.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => toggleItem(item.id)}
                  data-testid={`card-sync-item-${item.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-primary">{getTypeIcon(item.type)}</div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-mono font-bold">{item.name}</h4>
                        {getStatusIcon(item.status)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Last synced: {formatDate(item.lastSynced)}
                      </div>
                    </div>

                    <div className="text-right text-xs font-mono">
                      {item.localChanges > 0 && (
                        <div className="text-accent">
                          {item.localChanges} local changes
                        </div>
                      )}
                      {item.cloudChanges > 0 && (
                        <div className="text-primary">
                          {item.cloudChanges} cloud changes
                        </div>
                      )}
                      {item.status === 'synced' && (
                        <div className="text-secondary">Up to date</div>
                      )}
                    </div>
                  </div>

                  {item.status === 'conflict' && (
                    <div className="mt-3 p-2 bg-destructive/10 border border-destructive/30 rounded text-xs">
                      <span className="text-destructive font-bold">Conflict detected:</span>
                      <span className="text-muted-foreground ml-2">
                        Local and cloud versions differ. Choose which to keep.
                      </span>
                      <div className="flex gap-2 mt-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-xs"
                          data-testid={`button-keep-local-${item.id}`}
                        >
                          Keep Local
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-xs"
                          data-testid={`button-keep-cloud-${item.id}`}
                        >
                          Keep Cloud
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-xs"
                          data-testid={`button-merge-${item.id}`}
                        >
                          Merge
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
