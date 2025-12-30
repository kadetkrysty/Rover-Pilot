import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Map, Radar, Cpu, Activity, Wifi, Save, Download } from 'lucide-react';
import { SlamMapViewer } from '@/components/SlamMapViewer';
import { useRoverData } from '@/lib/mockData';

export default function Mapping() {
  const data = useRoverData();
  const [activeTab, setActiveTab] = useState('slam');

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6">
      <header className="mb-8 flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary">SENSOR FUSION & MAPPING</h1>
          <p className="text-muted-foreground font-mono mt-1">LIDAR-based SLAM with Extended Kalman Filter sensor fusion</p>
        </div>
        <Link href="/">
          <Button variant="outline" className="font-mono" data-testid="button-return">
            <ArrowLeft className="w-4 h-4 mr-2" /> RETURN TO HUD
          </Button>
        </Link>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="slam" className="font-mono">
                <Map className="w-4 h-4 mr-2" /> SLAM MAP
              </TabsTrigger>
              <TabsTrigger value="sensors" className="font-mono">
                <Radar className="w-4 h-4 mr-2" /> SENSOR VIEW
              </TabsTrigger>
              <TabsTrigger value="fusion" className="font-mono">
                <Cpu className="w-4 h-4 mr-2" /> FUSION STATUS
              </TabsTrigger>
            </TabsList>

            <TabsContent value="slam" className="hud-panel p-4">
              <h2 className="text-sm font-display text-primary mb-4">OCCUPANCY GRID MAP</h2>
              <SlamMapViewer isSimulating={true} />
            </TabsContent>

            <TabsContent value="sensors" className="hud-panel p-4">
              <h2 className="text-sm font-display text-primary mb-4">RAW SENSOR DATA</h2>
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 bg-card/50">
                  <h3 className="text-xs font-mono text-primary/70 mb-3">LIDAR (TF Mini Pro)</h3>
                  <div className="relative h-48 bg-black/50 rounded flex items-center justify-center">
                    <div className="relative w-40 h-40">
                      <div className="absolute inset-0 border border-primary/30 rounded-full"></div>
                      <div className="absolute inset-4 border border-primary/20 rounded-full"></div>
                      <div className="absolute inset-8 border border-primary/10 rounded-full"></div>
                      <div 
                        className="absolute top-1/2 left-1/2 w-1 h-20 bg-red-500 origin-bottom transform -translate-x-1/2"
                        style={{ 
                          transform: `translateX(-50%) rotate(${data.heading}deg)`,
                          height: `${Math.min(data.lidarDistance / 10, 80)}px`
                        }}
                      ></div>
                      <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-green-500 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    <span className="text-2xl font-mono font-bold text-foreground">{data.lidarDistance.toFixed(0)}</span>
                    <span className="text-sm text-muted-foreground ml-1">cm</span>
                  </div>
                </Card>

                <Card className="p-4 bg-card/50">
                  <h3 className="text-xs font-mono text-primary/70 mb-3">ULTRASONIC ARRAY (5 SENSORS)</h3>
                  <div className="relative h-48 bg-black/50 rounded flex items-center justify-center">
                    <div className="flex gap-2 items-end h-32">
                      {data.sensors.ultrasonic.map((dist, i) => (
                        <div key={i} className="flex flex-col items-center">
                          <div 
                            className="w-8 bg-cyan-500/70 rounded-t transition-all"
                            style={{ height: `${Math.min(dist / 2, 100)}px` }}
                          ></div>
                          <span className="text-[10px] text-muted-foreground mt-1">S{i + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 text-center text-xs font-mono text-muted-foreground">
                    Distances: {data.sensors.ultrasonic.join(' | ')} cm
                  </div>
                </Card>

                <Card className="p-4 bg-card/50">
                  <h3 className="text-xs font-mono text-primary/70 mb-3">IMU (MPU6050)</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground">PITCH</div>
                      <div className="text-xl font-mono font-bold">{data.pitch.toFixed(1)}°</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">ROLL</div>
                      <div className="text-xl font-mono font-bold">{data.roll.toFixed(1)}°</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">YAW</div>
                      <div className="text-xl font-mono font-bold">{data.heading.toFixed(1)}°</div>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 bg-card/50">
                  <h3 className="text-xs font-mono text-primary/70 mb-3">GPS (Neo-6M)</h3>
                  <div className="space-y-2 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground">LATITUDE</div>
                      <div className="text-lg font-mono font-bold">{data.gps.lat.toFixed(6)}°</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">LONGITUDE</div>
                      <div className="text-lg font-mono font-bold">{data.gps.lng.toFixed(6)}°</div>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="fusion" className="hud-panel p-4">
              <h2 className="text-sm font-display text-primary mb-4">EXTENDED KALMAN FILTER STATUS</h2>
              <div className="space-y-4">
                <Card className="p-4 bg-card/50">
                  <h3 className="text-xs font-mono text-primary/70 mb-3">SENSOR FUSION PIPELINE</h3>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 text-center p-3 border border-primary/20 rounded">
                      <Radar className="w-6 h-6 mx-auto mb-1 text-cyan-400" />
                      <div className="text-xs font-mono">LIDAR</div>
                    </div>
                    <div className="text-primary">→</div>
                    <div className="flex-1 text-center p-3 border border-primary/20 rounded">
                      <Activity className="w-6 h-6 mx-auto mb-1 text-yellow-400" />
                      <div className="text-xs font-mono">IMU</div>
                    </div>
                    <div className="text-primary">→</div>
                    <div className="flex-1 text-center p-3 border border-primary/20 rounded">
                      <Wifi className="w-6 h-6 mx-auto mb-1 text-green-400" />
                      <div className="text-xs font-mono">GPS</div>
                    </div>
                    <div className="text-primary">→</div>
                    <div className="flex-1 text-center p-3 border border-secondary bg-secondary/10 rounded">
                      <Cpu className="w-6 h-6 mx-auto mb-1 text-secondary" />
                      <div className="text-xs font-mono font-bold">EKF</div>
                    </div>
                    <div className="text-primary">→</div>
                    <div className="flex-1 text-center p-3 border border-primary bg-primary/10 rounded">
                      <Map className="w-6 h-6 mx-auto mb-1 text-primary" />
                      <div className="text-xs font-mono font-bold">SLAM</div>
                    </div>
                  </div>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4 bg-card/50">
                    <h3 className="text-xs font-mono text-primary/70 mb-3">EKF STATE VECTOR</h3>
                    <div className="font-mono text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">x (position)</span>
                        <span>meters</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">y (position)</span>
                        <span>meters</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">θ (heading)</span>
                        <span>radians</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">v (velocity)</span>
                        <span>m/s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">bias (gyro)</span>
                        <span>rad/s</span>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4 bg-card/50">
                    <h3 className="text-xs font-mono text-primary/70 mb-3">OCCUPANCY GRID PARAMS</h3>
                    <div className="font-mono text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Resolution</span>
                        <span>5 cm/cell</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Grid Size</span>
                        <span>200 × 200</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Coverage</span>
                        <span>10m × 10m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Update Rate</span>
                        <span>20 Hz</span>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="col-span-4 space-y-4">
          <div className="hud-panel p-4">
            <h3 className="font-display text-sm text-primary mb-4">SYSTEM STATUS</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Sensor Fusion</span>
                <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs font-mono rounded">ACTIVE</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">SLAM Engine</span>
                <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs font-mono rounded">MAPPING</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">GPS Lock</span>
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs font-mono rounded">3D FIX</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">IMU Calibration</span>
                <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs font-mono rounded">OK</span>
              </div>
            </div>
          </div>

          <div className="hud-panel p-4">
            <h3 className="font-display text-sm text-primary mb-4">MAP CONTROLS</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full font-mono text-xs h-9" data-testid="button-save-map">
                <Save className="w-3 h-3 mr-2" /> SAVE CURRENT MAP
              </Button>
              <Button variant="outline" className="w-full font-mono text-xs h-9" data-testid="button-export-map">
                <Download className="w-3 h-3 mr-2" /> EXPORT AS IMAGE
              </Button>
            </div>
          </div>

          <div className="hud-panel p-4">
            <h3 className="font-display text-sm text-primary mb-4">QUICK INFO</h3>
            <div className="text-xs text-muted-foreground space-y-2">
              <p>
                <strong className="text-foreground">Sensor Fusion:</strong> The Extended Kalman Filter (EKF) 
                combines noisy GPS, IMU, and LIDAR data to estimate the rover's precise position and orientation.
              </p>
              <p>
                <strong className="text-foreground">SLAM Mapping:</strong> Similar to robotic vacuums, the rover 
                builds a 2D occupancy grid map by processing LIDAR scans as it explores the environment.
              </p>
              <p>
                <strong className="text-foreground">Occupancy Grid:</strong> Each cell stores the probability 
                of being occupied (obstacle) or free space. Red = obstacle, Green = clear.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
