import { useState, useEffect, ReactNode } from 'react';
import Header from './Header';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Settings, CheckCircle } from 'lucide-react';
import { Link } from 'wouter';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [showConfigModal, setShowConfigModal] = useState(false);

  useEffect(() => {
    const hasSeenConfig = localStorage.getItem('roveros_config_seen');
    if (!hasSeenConfig) {
      setShowConfigModal(true);
    }
  }, []);

  const handleDismissConfig = () => {
    localStorage.setItem('roveros_config_seen', 'true');
    setShowConfigModal(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-14">
        {children}
      </main>

      {/* First Launch Config Modal */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="max-w-lg bg-card border-primary/30" data-testid="modal-first-config">
          <DialogHeader>
            <DialogTitle className="text-primary font-display text-2xl flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Welcome to RoverOS
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Before you begin, please configure your rover settings for optimal performance.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 border border-border rounded-lg">
              <h3 className="font-mono text-sm text-primary mb-2">Quick Setup Checklist</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-secondary" />
                  Configure Google Maps API key for navigation
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-secondary" />
                  Set WebSocket authentication tokens
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-secondary" />
                  Verify Arduino/Mini PC connection
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-secondary" />
                  Test sensor connectivity
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Link href="/setup">
                <Button 
                  className="flex-1" 
                  onClick={handleDismissConfig}
                  data-testid="button-go-to-config"
                >
                  <Settings className="w-4 h-4 mr-2" /> Go to Configuration
                </Button>
              </Link>
              <Button 
                variant="outline" 
                onClick={handleDismissConfig}
                data-testid="button-skip-config"
              >
                Skip for Now
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              You can access configuration anytime from the CONFIG menu.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
