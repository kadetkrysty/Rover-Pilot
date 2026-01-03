import { Battery, Zap, Clock, Navigation, AlertTriangle, Info } from "lucide-react";
import { PowerData } from "@/lib/mockData";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PowerPanelProps {
  power: PowerData;
}

export default function PowerPanel({ power }: PowerPanelProps) {
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  const getBatteryColor = () => {
    if (power.batteryPercent > 50) return 'text-secondary';
    if (power.batteryPercent > 20) return 'text-yellow-400';
    return 'text-destructive';
  };
  
  const getBatteryBgColor = () => {
    if (power.batteryPercent > 50) return 'bg-secondary';
    if (power.batteryPercent > 20) return 'bg-yellow-400';
    return 'bg-destructive';
  };

  return (
    <>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h3 className="text-[9px] font-display text-primary/50">POWER STATUS</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-4 w-4 p-0"
            onClick={() => setShowInfoModal(true)}
            data-testid="button-power-info"
          >
            <Info className="w-3 h-3 text-primary/50" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-14 border-2 border-current rounded-sm flex flex-col justify-end overflow-hidden" style={{ borderColor: 'hsl(var(--primary) / 0.5)' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-1 bg-primary/50 rounded-t-sm"></div>
            <div 
              className={`w-full transition-all duration-500 ${getBatteryBgColor()}`}
              style={{ height: `${power.batteryPercent}%` }}
            ></div>
          </div>
          <div className="flex-1">
            <div className={`text-2xl font-mono font-bold ${getBatteryColor()}`} data-testid="text-battery-percent">
              {power.batteryPercent.toFixed(0)}%
            </div>
            <div className="text-[9px] text-muted-foreground font-mono">
              {power.batteryVoltage.toFixed(1)}V / {power.remainingCapacityAh.toFixed(1)}Ah
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          <div className="bg-card/50 border border-border rounded p-1.5">
            <div className="flex items-center gap-1 text-[8px] text-muted-foreground mb-0.5">
              <Zap className="w-2.5 h-2.5" />
              <span>POWER</span>
            </div>
            <div className="text-sm font-mono text-foreground" data-testid="text-power-consumption">
              {power.powerConsumptionW.toFixed(0)}W
            </div>
          </div>
          
          <div className="bg-card/50 border border-border rounded p-1.5">
            <div className="flex items-center gap-1 text-[8px] text-muted-foreground mb-0.5">
              <Battery className="w-2.5 h-2.5" />
              <span>CURRENT</span>
            </div>
            <div className="text-sm font-mono text-foreground" data-testid="text-current">
              {power.batteryCurrent.toFixed(1)}A
            </div>
          </div>
          
          <div className="bg-card/50 border border-border rounded p-1.5">
            <div className="flex items-center gap-1 text-[8px] text-muted-foreground mb-0.5">
              <Navigation className="w-2.5 h-2.5" />
              <span>RANGE</span>
            </div>
            <div className="text-sm font-mono text-secondary" data-testid="text-range">
              {power.estimatedRangeKm.toFixed(1)}km
            </div>
          </div>
          
          <div className="bg-card/50 border border-border rounded p-1.5">
            <div className="flex items-center gap-1 text-[8px] text-muted-foreground mb-0.5">
              <Clock className="w-2.5 h-2.5" />
              <span>RUNTIME</span>
            </div>
            <div className="text-sm font-mono text-secondary" data-testid="text-runtime">
              {power.estimatedRuntimeMin.toFixed(0)}min
            </div>
          </div>
        </div>
        
        {power.batteryPercent < 20 && (
          <div className="flex items-center gap-1.5 bg-destructive/20 border border-destructive/50 rounded px-2 py-1 mt-2">
            <AlertTriangle className="w-3 h-3 text-destructive" />
            <span className="text-[9px] font-mono text-destructive">LOW BATTERY WARNING</span>
          </div>
        )}
      </div>

      <Dialog open={showInfoModal} onOpenChange={setShowInfoModal}>
        <DialogContent className="max-w-2xl bg-card border-primary/30 max-h-[80vh]" data-testid="modal-power-info">
          <DialogHeader>
            <DialogTitle className="text-primary font-display text-xl flex items-center gap-2">
              <Battery className="w-5 h-5" />
              Battery Measurement System
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              How RoverOS measures and estimates battery status
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 py-4 pr-4">
              <div className="p-3 border border-border rounded-lg">
                <h4 className="font-mono text-sm text-primary mb-2">Current Implementation</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The app currently displays simulated battery data for demonstration. To get accurate real-time measurements, 
                  you need to add hardware sensors to your rover system.
                </p>
              </div>

              <div className="p-3 border border-border rounded-lg">
                <h4 className="font-mono text-sm text-primary mb-2">Required Hardware</h4>
                <ul className="text-xs text-muted-foreground space-y-2">
                  <li className="flex gap-2">
                    <span className="text-secondary font-bold">1.</span>
                    <span><strong>INA219/INA226 Current Sensor</strong> - Measures voltage and current draw. Connect between battery and load. I2C interface to Arduino.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-secondary font-bold">2.</span>
                    <span><strong>Battery Management System (BMS)</strong> - Many LiPo/Li-ion BMS boards have UART/I2C output for cell voltages, SOC, and temperature.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-secondary font-bold">3.</span>
                    <span><strong>Voltage Divider</strong> - Simple resistor divider to measure pack voltage if using high-voltage batteries (scale to Arduino 5V ADC range).</span>
                  </li>
                </ul>
              </div>

              <div className="p-3 border border-border rounded-lg">
                <h4 className="font-mono text-sm text-primary mb-2">Measurement Approach</h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p><strong className="text-foreground">Voltage-Based SOC:</strong> Measure battery voltage and map to state-of-charge using a discharge curve. Simple but inaccurate under load.</p>
                  <p><strong className="text-foreground">Coulomb Counting:</strong> Integrate current over time (INA226 has built-in coulomb counter). More accurate but needs calibration.</p>
                  <p><strong className="text-foreground">Combined Method:</strong> Use voltage for initial SOC, coulomb counting during operation, and voltage correction at rest. Best accuracy.</p>
                </div>
              </div>

              <div className="p-3 border border-border rounded-lg">
                <h4 className="font-mono text-sm text-primary mb-2">Range Estimation</h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p><strong className="text-foreground">Energy Model:</strong> Track Wh consumed per km traveled using wheel encoders or GPS odometry.</p>
                  <p><strong className="text-foreground">Formula:</strong> <code className="bg-card px-1 py-0.5 rounded">Range = (Remaining_Ah × Voltage) / (Avg_Wh_per_km)</code></p>
                  <p><strong className="text-foreground">Factors:</strong> Terrain, speed, payload, temperature all affect consumption. Use rolling average for better estimates.</p>
                </div>
              </div>

              <div className="p-3 border border-border rounded-lg">
                <h4 className="font-mono text-sm text-primary mb-2">Runtime Estimation</h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p><strong className="text-foreground">Simple:</strong> <code className="bg-card px-1 py-0.5 rounded">Runtime = Remaining_Ah / Average_Current</code></p>
                  <p><strong className="text-foreground">Better:</strong> Use exponential moving average of current draw for smoother estimates.</p>
                </div>
              </div>

              <div className="p-3 border border-primary/50 rounded-lg bg-primary/5">
                <h4 className="font-mono text-sm text-primary mb-2">Recommended Wiring</h4>
                <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
{`Arduino Mega Pin Assignment (Battery Monitor)
=============================================
I2C:
  Pin 20 (SDA) ───── INA219/226 SDA
  Pin 21 (SCL) ───── INA219/226 SCL

INA219/226 Wiring:
  VIN+ ───── Battery Positive
  VIN- ───── Load Positive (after shunt)
  GND  ───── System Ground
  VCC  ───── 5V (Arduino)

Note: INA219 has 0.1Ω onboard shunt.
For higher currents, use INA226 with external shunt.`}
                </pre>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
