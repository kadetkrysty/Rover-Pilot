import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Video, Play, Pause, Square, Trash2, 
  Download, Clock, HardDrive, Calendar, Film
} from 'lucide-react';

interface VideoRecording {
  id: number;
  name: string;
  description?: string;
  duration: number;
  fileSize: number;
  status: 'recording' | 'completed' | 'failed';
  createdAt: string;
  thumbnailPath?: string;
}

const mockRecordings: VideoRecording[] = [
  {
    id: 1,
    name: 'Mission Alpha - Perimeter Scan',
    description: 'Full perimeter patrol recording',
    duration: 342,
    fileSize: 256000000,
    status: 'completed',
    createdAt: '2025-01-02T10:30:00Z'
  },
  {
    id: 2,
    name: 'Obstacle Course Test',
    description: 'Testing obstacle avoidance in courtyard',
    duration: 180,
    fileSize: 134000000,
    status: 'completed',
    createdAt: '2025-01-02T09:15:00Z'
  },
  {
    id: 3,
    name: 'Current Session',
    description: 'Live recording in progress',
    duration: 45,
    fileSize: 33000000,
    status: 'recording',
    createdAt: '2025-01-02T11:25:00Z'
  }
];

export default function VideoRecordings() {
  const [recordings] = useState<VideoRecording[]>(mockRecordings);
  const [isRecording, setIsRecording] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<number | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1000000000) return `${(bytes / 1000000000).toFixed(1)} GB`;
    if (bytes >= 1000000) return `${(bytes / 1000000).toFixed(0)} MB`;
    return `${(bytes / 1000).toFixed(0)} KB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const handleStartRecording = () => {
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6" data-testid="page-video-recordings">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-primary" data-testid="text-video-title">VIDEO RECORDINGS</h1>
        <p className="text-muted-foreground font-mono mt-1">Mission footage and playback</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Recording Controls */}
        <div className="col-span-4 space-y-4">
          <Card className="hud-panel p-4">
            <h3 className="text-sm font-display text-primary mb-4">RECORDING CONTROLS</h3>
            
            <div className="flex items-center gap-4 mb-4">
              {isRecording ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                  <span className="text-sm font-mono text-destructive">RECORDING</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-muted rounded-full" />
                  <span className="text-sm font-mono text-muted-foreground">STANDBY</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {isRecording ? (
                <>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    data-testid="button-pause-recording"
                  >
                    <Pause className="w-4 h-4 mr-2" /> Pause
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1"
                    onClick={handleStopRecording}
                    data-testid="button-stop-recording"
                  >
                    <Square className="w-4 h-4 mr-2" /> Stop
                  </Button>
                </>
              ) : (
                <Button 
                  className="w-full bg-destructive hover:bg-destructive/90"
                  onClick={handleStartRecording}
                  data-testid="button-start-recording"
                >
                  <Video className="w-4 h-4 mr-2" /> Start Recording
                </Button>
              )}
            </div>

            {isRecording && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded">
                <div className="flex justify-between text-xs font-mono">
                  <span>Duration</span>
                  <span className="text-destructive" data-testid="text-recording-duration">00:45</span>
                </div>
                <div className="flex justify-between text-xs font-mono mt-1">
                  <span>Size</span>
                  <span data-testid="text-recording-size">33 MB</span>
                </div>
              </div>
            )}
          </Card>

          <Card className="hud-panel p-4">
            <h3 className="text-sm font-display text-primary mb-4">STORAGE</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">Used</span>
                <span data-testid="text-storage-used">423 MB</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">Available</span>
                <span className="text-secondary" data-testid="text-storage-available">15.6 GB</span>
              </div>
              <div className="w-full h-2 bg-muted rounded overflow-hidden">
                <div className="h-full bg-primary" style={{ width: '3%' }} />
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">Recordings</span>
                <span data-testid="text-recording-count">{recordings.length}</span>
              </div>
            </div>
          </Card>

          <Card className="hud-panel p-4">
            <h3 className="text-sm font-display text-primary mb-4">SETTINGS</h3>
            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Resolution</span>
                <span>1080p</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frame Rate</span>
                <span>30 fps</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Codec</span>
                <span>H.264</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto-record</span>
                <span className="text-secondary">On Mission</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Recording List */}
        <div className="col-span-8">
          <Card className="hud-panel p-4">
            <h3 className="text-sm font-display text-primary mb-4">SAVED RECORDINGS</h3>
            
            <div className="space-y-3">
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  className={`border rounded p-4 transition-all cursor-pointer ${
                    selectedVideo === recording.id 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedVideo(recording.id)}
                  data-testid={`card-recording-${recording.id}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="w-32 h-20 bg-muted rounded flex items-center justify-center shrink-0">
                      {recording.status === 'recording' ? (
                        <div className="flex flex-col items-center">
                          <div className="w-4 h-4 bg-destructive rounded-full animate-pulse" />
                          <span className="text-xs mt-1 text-destructive">LIVE</span>
                        </div>
                      ) : (
                        <Film className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-mono font-bold text-foreground truncate">
                        {recording.name}
                      </h4>
                      {recording.description && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {recording.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-2 text-xs font-mono text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(recording.duration)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          <span>{formatFileSize(recording.fileSize)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(recording.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      {recording.status === 'completed' && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            data-testid={`button-play-${recording.id}`}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            data-testid={`button-download-${recording.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-destructive hover:bg-destructive/10"
                            data-testid={`button-delete-${recording.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {recording.status === 'recording' && (
                        <span className="px-2 py-1 bg-destructive/20 text-destructive text-xs font-mono rounded">
                          RECORDING
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {recordings.length === 0 && (
                <div className="text-center py-12">
                  <Video className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground font-mono">No recordings yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Start recording to capture mission footage
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
