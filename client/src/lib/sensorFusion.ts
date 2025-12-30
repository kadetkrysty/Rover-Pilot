import type { SensorFusionState, LidarScan } from "@shared/schema";

export class ExtendedKalmanFilter {
  private state: number[];
  private covariance: number[][];
  private processNoise: number[][];
  private measurementNoise: number[][];

  constructor() {
    this.state = [0, 0, 0, 0, 0];
    this.covariance = this.identity(5).map(row => row.map(v => v * 0.1));
    this.processNoise = this.identity(5).map(row => row.map(v => v * 0.01));
    this.measurementNoise = this.identity(3).map(row => row.map(v => v * 0.1));
  }

  private identity(n: number): number[][] {
    return Array(n).fill(0).map((_, i) => 
      Array(n).fill(0).map((_, j) => i === j ? 1 : 0)
    );
  }

  private matrixMultiply(a: number[][], b: number[][]): number[][] {
    const rowsA = a.length;
    const colsA = a[0].length;
    const colsB = b[0].length;
    const result: number[][] = Array(rowsA).fill(0).map(() => Array(colsB).fill(0));
    
    for (let i = 0; i < rowsA; i++) {
      for (let j = 0; j < colsB; j++) {
        for (let k = 0; k < colsA; k++) {
          result[i][j] += a[i][k] * b[k][j];
        }
      }
    }
    return result;
  }

  private matrixAdd(a: number[][], b: number[][]): number[][] {
    return a.map((row, i) => row.map((val, j) => val + b[i][j]));
  }

  private matrixSubtract(a: number[][], b: number[][]): number[][] {
    return a.map((row, i) => row.map((val, j) => val - b[i][j]));
  }

  private transpose(m: number[][]): number[][] {
    return m[0].map((_, i) => m.map(row => row[i]));
  }

  predict(dt: number, angularVelocity: number, acceleration: number): void {
    const [x, y, theta, v, bias] = this.state;
    
    const newTheta = theta + (angularVelocity - bias) * dt;
    const newV = v + acceleration * dt;
    const newX = x + v * Math.cos(theta) * dt;
    const newY = y + v * Math.sin(theta) * dt;
    
    this.state = [newX, newY, newTheta, newV, bias];
    
    const F = [
      [1, 0, -v * Math.sin(theta) * dt, Math.cos(theta) * dt, 0],
      [0, 1, v * Math.cos(theta) * dt, Math.sin(theta) * dt, 0],
      [0, 0, 1, 0, -dt],
      [0, 0, 0, 1, 0],
      [0, 0, 0, 0, 1]
    ];
    
    const FP = this.matrixMultiply(F, this.covariance);
    const FPFt = this.matrixMultiply(FP, this.transpose(F));
    this.covariance = this.matrixAdd(FPFt, this.processNoise);
  }

  updateWithGPS(gpsX: number, gpsY: number, accuracy: number): void {
    const H = [
      [1, 0, 0, 0, 0],
      [0, 1, 0, 0, 0]
    ];
    
    const R = [
      [accuracy * accuracy, 0],
      [0, accuracy * accuracy]
    ];
    
    const z = [gpsX, gpsY];
    const hx = [this.state[0], this.state[1]];
    const y = [z[0] - hx[0], z[1] - hx[1]];
    
    const PHt = this.matrixMultiply(this.covariance, this.transpose(H));
    const HPHt = this.matrixMultiply(H, PHt);
    const S = this.matrixAdd(HPHt, R);
    
    const SInv = this.invert2x2(S);
    const K = this.matrixMultiply(PHt, SInv);
    
    for (let i = 0; i < 5; i++) {
      this.state[i] += K[i][0] * y[0] + K[i][1] * y[1];
    }
    
    const KH = this.matrixMultiply(K, H);
    const I = this.identity(5);
    const IMinusKH = this.matrixSubtract(I, KH);
    this.covariance = this.matrixMultiply(IMinusKH, this.covariance);
  }

  private invert2x2(m: number[][]): number[][] {
    const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    if (Math.abs(det) < 1e-10) return [[1, 0], [0, 1]];
    return [
      [m[1][1] / det, -m[0][1] / det],
      [-m[1][0] / det, m[0][0] / det]
    ];
  }

  updateWithIMU(heading: number): void {
    const H = [0, 0, 1, 0, 0];
    const R = 0.05;
    
    let innovation = heading - this.state[2];
    while (innovation > Math.PI) innovation -= 2 * Math.PI;
    while (innovation < -Math.PI) innovation += 2 * Math.PI;
    
    const PHt: number[] = this.covariance.map(row => row[2]);
    const S = this.covariance[2][2] + R;
    const SInv = 1 / S;
    
    const K: number[] = PHt.map(v => v * SInv);
    
    for (let i = 0; i < 5; i++) {
      this.state[i] += K[i] * innovation;
    }
    
    const I_KH: number[][] = this.identity(5);
    for (let i = 0; i < 5; i++) {
      I_KH[i][2] -= K[i];
    }
    
    const I_KH_P = this.matrixMultiply(I_KH, this.covariance);
    const I_KH_P_IKHt = this.matrixMultiply(I_KH_P, this.transpose(I_KH));
    
    const KRKt: number[][] = this.identity(5).map(() => Array(5).fill(0));
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        KRKt[i][j] = K[i] * R * K[j];
      }
    }
    
    this.covariance = this.matrixAdd(I_KH_P_IKHt, KRKt);
    
    this.ensureSymmetric();
  }

  private ensureSymmetric(): void {
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        const avg = (this.covariance[i][j] + this.covariance[j][i]) / 2;
        this.covariance[i][j] = avg;
        this.covariance[j][i] = avg;
      }
    }
  }

  getState(): SensorFusionState {
    return {
      x: this.state[0],
      y: this.state[1],
      theta: this.state[2],
      velocity: this.state[3],
      angularVelocity: 0,
      covariance: this.covariance,
      confidence: this.calculateConfidence()
    };
  }

  private calculateConfidence(): number {
    const trace = this.covariance.reduce((sum, row, i) => sum + row[i], 0);
    return Math.max(0, Math.min(1, 1 - trace / 10));
  }

  reset(): void {
    this.state = [0, 0, 0, 0, 0];
    this.covariance = this.identity(5).map(row => row.map(v => v * 0.1));
  }
}

export class OccupancyGridMap {
  private grid: number[][];
  private width: number;
  private height: number;
  private resolution: number;
  private originX: number;
  private originY: number;
  private logOddsFree: number = -0.4;
  private logOddsOccupied: number = 0.85;
  private logOddsMax: number = 2.0;
  private logOddsMin: number = -2.0;

  constructor(width: number = 400, height: number = 400, resolution: number = 0.05) {
    this.width = width;
    this.height = height;
    this.resolution = resolution;
    this.originX = -width * resolution / 2;
    this.originY = -height * resolution / 2;
    this.grid = Array(height).fill(0).map(() => Array(width).fill(0));
  }

  updateWithLidarScan(
    robotX: number,
    robotY: number,
    robotTheta: number,
    scans: LidarScan[]
  ): { x: number; y: number; probability: number }[] {
    const updatedCells: { x: number; y: number; probability: number }[] = [];

    for (const scan of scans) {
      const worldAngle = robotTheta + (scan.angle * Math.PI / 180);
      const hitX = robotX + scan.distance * Math.cos(worldAngle);
      const hitY = robotY + scan.distance * Math.sin(worldAngle);

      const cellsAlongRay = this.bresenham(
        robotX, robotY, hitX, hitY
      );

      for (let i = 0; i < cellsAlongRay.length - 1; i++) {
        const { gx, gy } = cellsAlongRay[i];
        if (this.isValidCell(gx, gy)) {
          this.grid[gy][gx] = Math.max(
            this.logOddsMin,
            this.grid[gy][gx] + this.logOddsFree
          );
          updatedCells.push({
            x: gx,
            y: gy,
            probability: this.logOddsToProbability(this.grid[gy][gx])
          });
        }
      }

      if (cellsAlongRay.length > 0) {
        const hit = cellsAlongRay[cellsAlongRay.length - 1];
        if (this.isValidCell(hit.gx, hit.gy) && scan.distance < 10) {
          this.grid[hit.gy][hit.gx] = Math.min(
            this.logOddsMax,
            this.grid[hit.gy][hit.gx] + this.logOddsOccupied
          );
          updatedCells.push({
            x: hit.gx,
            y: hit.gy,
            probability: this.logOddsToProbability(this.grid[hit.gy][hit.gx])
          });
        }
      }
    }

    return updatedCells;
  }

  private bresenham(x0: number, y0: number, x1: number, y1: number): { gx: number; gy: number }[] {
    const cells: { gx: number; gy: number }[] = [];
    
    const gx0 = this.worldToGrid(x0, 'x');
    const gy0 = this.worldToGrid(y0, 'y');
    const gx1 = this.worldToGrid(x1, 'x');
    const gy1 = this.worldToGrid(y1, 'y');

    if (gx0 === gx1 && gy0 === gy1) {
      cells.push({ gx: gx0, gy: gy0 });
      return cells;
    }

    let x = gx0;
    let y = gy0;
    const dx = Math.abs(gx1 - gx0);
    const dy = Math.abs(gy1 - gy0);
    const sx = gx0 < gx1 ? 1 : -1;
    const sy = gy0 < gy1 ? 1 : -1;
    let err = dx - dy;
    
    const maxIterations = Math.max(dx, dy) * 2 + 10;
    let iterations = 0;

    while (iterations < maxIterations) {
      cells.push({ gx: x, gy: y });
      iterations++;
      
      if (x === gx1 && y === gy1) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return cells;
  }

  private worldToGrid(coord: number, axis: 'x' | 'y'): number {
    const origin = axis === 'x' ? this.originX : this.originY;
    const size = axis === 'x' ? this.width : this.height;
    return Math.floor((coord - origin) / this.resolution);
  }

  private isValidCell(gx: number, gy: number): boolean {
    return gx >= 0 && gx < this.width && gy >= 0 && gy < this.height;
  }

  private logOddsToProbability(logOdds: number): number {
    return 1 - 1 / (1 + Math.exp(logOdds));
  }

  getGrid(): number[][] {
    return this.grid.map(row => row.map(v => this.logOddsToProbability(v)));
  }

  getGridAsImageData(): Uint8ClampedArray {
    const data = new Uint8ClampedArray(this.width * this.height * 4);
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const prob = this.logOddsToProbability(this.grid[y][x]);
        const idx = (y * this.width + x) * 4;
        
        if (prob > 0.65) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 255;
        } else if (prob < 0.35) {
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = 255;
        } else {
          data[idx] = 128;
          data[idx + 1] = 128;
          data[idx + 2] = 128;
          data[idx + 3] = 255;
        }
      }
    }
    
    return data;
  }

  getDimensions() {
    return {
      width: this.width,
      height: this.height,
      resolution: this.resolution,
      originX: this.originX,
      originY: this.originY
    };
  }

  reset(): void {
    this.grid = Array(this.height).fill(0).map(() => Array(this.width).fill(0));
  }
}
