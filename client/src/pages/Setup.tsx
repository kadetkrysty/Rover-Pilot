import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wifi, ArrowLeft, Cpu } from 'lucide-react';
import { useState } from 'react';

export default function Setup() {
    const [connecting, setConnecting] = useState(false);

    const handleConnect = () => {
        setConnecting(true);
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
            <div className="scanline"></div>
            
            <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none"></div>

            <Card className="w-full max-w-md border-primary/50 bg-black/80 backdrop-blur-xl shadow-[0_0_50px_rgba(var(--primary),0.2)]">
                <CardHeader>
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border border-primary animate-pulse">
                            <Wifi className="w-8 h-8 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-center text-2xl font-display tracking-widest text-primary">
                        INITIALIZE CONNECTION
                    </CardTitle>
                    <p className="text-center text-muted-foreground font-mono text-sm">
                        Connect to Rover Access Point to begin telemetry stream.
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-mono uppercase text-primary/70">Rover IP Address</Label>
                        <Input defaultValue="192.168.1.100" className="font-mono bg-background/50 border-primary/30 focus:border-primary text-lg" />
                    </div>
                    <div className="space-y-2">
                         <Label className="text-xs font-mono uppercase text-primary/70">Port</Label>
                        <Input defaultValue="8080" className="font-mono bg-background/50 border-primary/30 focus:border-primary text-lg" />
                    </div>
                    
                    <div className="p-4 rounded bg-primary/5 border border-primary/20 mt-6">
                        <div className="flex items-center gap-2 text-primary text-sm font-bold mb-2">
                            <Cpu className="w-4 h-4" /> AUTO-DETECTED HARDWARE
                        </div>
                        <ul className="text-xs font-mono text-muted-foreground space-y-1">
                            <li>• Raspberry Pi 3 B+ (ARMv8)</li>
                            <li>• Arduino Mega 2560 (Serial USB0)</li>
                            <li>• Hoverboard Controller (FOC Firmware)</li>
                            <li>• HuskyLens AI Camera (I2C)</li>
                        </ul>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button 
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-display tracking-widest h-12"
                        onClick={handleConnect}
                        disabled={connecting}
                    >
                        {connecting ? "ESTABLISHING UPLINK..." : "CONNECT TO SYSTEM"}
                    </Button>
                    <Link href="/">
                        <Button variant="ghost" className="w-full font-mono text-xs">
                            <ArrowLeft className="w-3 h-3 mr-2" /> SKIP SETUP (DEMO MODE)
                        </Button>
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}
