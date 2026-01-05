import { useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useWebSocket } from '@/lib/useWebSocket';

interface HaloHudOverlayProps {
  recordingTime: number;
  detectedObjects: Array<{
    id: string;
    type: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  isDemoMode: boolean;
}

export function HaloHudOverlay({ recordingTime, detectedObjects, isDemoMode }: HaloHudOverlayProps) {
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg 
        className="absolute top-0 left-0 w-full" 
        viewBox="0 0 1925.5 121.58"
        preserveAspectRatio="xMidYMin slice"
        style={{ height: 'auto', maxHeight: '15%' }}
      >
        <defs>
          <filter id="headerGlow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <polygon 
          points="2.5 19.83 249.62 50.07 290.33 83.93 707.97 119 775.3 60.15 1171.17 60.55 1241.71 119 1659.36 82.32 1693.62 52.09 1923 23.46 1923 2.5 2.5 2.5 2.5 19.83"
          fill="#161d2d"
          fillOpacity="0.9"
          stroke="aqua"
          strokeWidth="5"
          strokeMiterlimit="10"
          filter="url(#headerGlow)"
        />
      </svg>

      <svg 
        className="absolute bottom-0 left-0 w-full" 
        viewBox="0 0 1930 335.41"
        preserveAspectRatio="xMidYMax slice"
        style={{ height: 'auto', maxHeight: '35%' }}
      >
        <defs>
          <filter id="footerGlow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <g opacity="0.9" filter="url(#footerGlow)">
          <path 
            fill="#161d2d"
            d="M2.5,332.91V2.71L156.91,15l41.38,30.76-1.13,1.94A180.85,180.85,0,0,0,183,81.33l-.06.15a141,141,0,0,0-9.45,50.93c0,78,63.48,141.5,141.5,141.5a140.89,140.89,0,0,0,52.67-10.13c56.95-22.16,82.79-79.79,83-80.37l.79-1.8,302,53.18,97.8-55.88h224.31l102.78,56.88,300-54.17.83,1.68a159.64,159.64,0,0,0,9.28,15.59l.07.11.06.11A141.52,141.52,0,0,0,1708,239.2l.11-.1.58-.4,1.68-1.17c1-1.07,1.92-2.13,2.85-3.2l.12-.13a140.86,140.86,0,0,0,39.17-71.54c15.63-64.15-22-112.21-22.42-112.69l-1.54-1.92L1771,13,1927.5,2.74V332.91Z"
          />
          <path 
            fill="aqua"
            d="M1925,5.41v325H5V5.41l151,12,39,29s-7.84,13.38-14.38,34.17a144.08,144.08,0,0,0,188,185.52c58.61-22.81,84.4-81.69,84.4-81.69l301,53,98-56h223l103,57,299-54a160.15,160.15,0,0,0,9.44,15.86,144,144,0,0,0,223.18,40.8c.79-.55,1.58-1.09,2.38-1.66q1.56-1.71,3.06-3.43a143.67,143.67,0,0,0,39.85-72.81C1771,97.16,1732,48.41,1732,48.41l40-33,153-10M0,0V335.41H1930V.08l-5.33.34-153,10-1.61.11-1.24,1-40,33-3.8,3.13,3.08,3.85c.09.11,9.49,12.05,16.84,31.62,6.73,17.91,13.08,46.13,5.12,78.83l0,.07,0,.08a138.31,138.31,0,0,1-38.47,70.28l-.13.13-.12.14c-1,1.11-1.83,2.06-2.63,2.95-.5.36-1,.7-1.51,1.05l-.38.27-.25.17-.23.2A139,139,0,0,1,1490.87,198l-.12-.23-.14-.21a159.21,159.21,0,0,1-9.13-15.31l-1.67-3.37-3.7.66-297.25,53.69L1077.42,177l-1.13-.63H850.67l-1.15.66-96.43,55.11L453.87,179.49l-3.87-.68-1.58,3.6c-.06.14-6.46,14.54-19.76,31.44-12.16,15.46-32.76,36.26-61.88,47.59h0a138.35,138.35,0,0,1-51.73,10c-76.64,0-139-62.35-139-139a138.18,138.18,0,0,1,9.29-50l.05-.15,0-.15a179,179,0,0,1,13.93-33.14l2.25-3.87L198,42.4l-39-29-1.15-.86-1.43-.11L5.4.43,0,0Z"
          />
        </g>
      </svg>

      <svg 
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        viewBox="0 0 500 500"
        style={{ width: '45%', height: '80%', maxWidth: '400px', maxHeight: '400px' }}
      >
        <defs>
          <filter id="targetGlow">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <g fill="#97FFFA" filter="url(#targetGlow)" opacity="0.85">
          <path d="M250.3,445.9l-196-196l196-196l196,196L250.3,445.9z M55.7,249.9l194.6,194.6l194.6-194.6L250.3,55.3L55.7,249.9z"/>
          <path d="M250.3,419.3c-93.4,0-169.4-76-169.4-169.4s76-169.4,169.4-169.4s169.4,76,169.4,169.4S343.7,419.3,250.3,419.3z M250.3,83.5c-91.7,0-166.4,74.6-166.4,166.4c0,91.7,74.6,166.4,166.4,166.4s166.4-74.6,166.4-166.4C416.7,158.2,342,83.5,250.3,83.5z"/>
          <path d="M250.3,332.9c-45.7,0-82.9-37.2-82.9-82.9s37.2-82.9,82.9-82.9s82.9,37.2,82.9,82.9S296,332.9,250.3,332.9z M250.3,172c-43,0-77.9,35-77.9,77.9c0,43,35,77.9,77.9,77.9s77.9-35,77.9-77.9C328.2,206.9,293.3,172,250.3,172z"/>
          <path d="M250.3,318.8c-38,0-68.9-30.9-68.9-68.9c0-38,30.9-68.9,68.9-68.9c38,0,68.9,30.9,68.9,68.9C319.2,287.9,288.3,318.8,250.3,318.8z M250.3,182.1c-37.4,0-67.9,30.4-67.9,67.9c0,37.4,30.4,67.9,67.9,67.9s67.9-30.4,67.9-67.9C318.2,212.5,287.7,182.1,250.3,182.1z"/>
          <polygon points="151.9,246.7 151.8,249.9 139,249.9 139.1,246.3"/>
          <polygon points="152.3,239.9 152.1,243.1 139.3,242.3 139.6,238.6"/>
          <polygon points="153.3,233.2 153,234.8 152.8,236.4 140.1,234.7 140.3,232.8 140.7,231"/>
          <polygon points="154.6,226.6 153.9,229.7 141.4,227.1 142.2,223.5"/>
          <path d="M156.5,220c-0.4,1-0.6,2.1-0.9,3.1l-12.3-3.5c0.3-1.2,0.6-2.4,1-3.5L156.5,220z"/>
          <path d="M158.8,213.7c-0.4,1-0.8,2-1.2,3l-12-4.3c0.4-1.2,0.9-2.3,1.3-3.4L158.8,213.7z"/>
          <polygon points="161.4,207.5 160.1,210.4 148.4,205.3 149.9,201.9"/>
          <polygon points="164.6,201.5 163.8,202.9 163,204.3 151.7,198.4 152.6,196.7 153.5,195.2"/>
          <polygon points="168.1,195.7 166.4,198.4 155.5,191.7 157.5,188.6"/>
          <path d="M172.1,190.2c-0.7,0.8-1.3,1.7-1.9,2.6l-10.4-7.4c0.7-1,1.4-2,2.2-3L172.1,190.2z"/>
          <polygon points="176.4,184.9 174.2,187.4 164.4,179.3 166.8,176.5"/>
          <path d="M181,180c-0.8,0.8-1.5,1.6-2.3,2.3l-9.3-8.8c0.9-0.9,1.7-1.8,2.6-2.6L181,180z"/>
          <path d="M186,175.4c-0.8,0.7-1.7,1.4-2.4,2.2l-8.7-9.4c0.9-0.9,1.8-1.6,2.7-2.4L186,175.4z"/>
          <polygon points="191.2,171.1 188.7,173.1 180.7,163.2 183.6,160.9"/>
          <path d="M196.8,167.3c-0.9,0.6-1.8,1.2-2.7,1.8l-7.3-10.5c1-0.7,2-1.4,3.1-2L196.8,167.3z"/>
          <polygon points="202.6,163.8 199.8,165.4 193.2,154.4 196.4,152.6"/>
          <path d="M208.7,160.7c-1,0.4-2,0.9-2.9,1.4l-5.8-11.4c1.1-0.6,2.2-1.1,3.3-1.6L208.7,160.7z"/>
          <polygon points="214.9,158 211.9,159.2 206.9,147.5 210.3,146.1"/>
          <path d="M221.3,155.8c-1,0.3-2.1,0.7-3.1,1l-4.2-12.1c1.2-0.4,2.3-0.8,3.5-1.2L221.3,155.8z"/>
          <path d="M227.8,154.1c-1.1,0.3-2.1,0.5-3.2,0.8l-3.3-12.4c1.2-0.4,2.4-0.6,3.6-0.9L227.8,154.1z"/>
          <polygon points="234.5,152.7 231.3,153.3 228.8,140.8 232.4,140.1"/>
          <path d="M241.2,151.9c-1.1,0.1-2.2,0.2-3.2,0.4l-1.6-12.7c1.2-0.1,2.4-0.3,3.7-0.4L241.2,151.9z"/>
          <path d="M247.9,151.5c-1.1,0-2.2,0-3.3,0.1l-0.7-12.8c1.2-0.1,2.4-0.1,3.7-0.1L247.9,151.5z"/>
          <polygon points="254.7,151.6 251.5,151.5 251.6,138.7 255.3,138.8"/>
          <path d="M261.5,152.1c-1.1-0.2-2.2-0.2-3.2-0.3l1-12.8c1.2,0.1,2.4,0.2,3.7,0.3L261.5,152.1z"/>
          <path d="M268.2,153.1c-1.1-0.2-2.1-0.4-3.2-0.6l1.9-12.7c1.2,0.2,2.4,0.4,3.6,0.6L268.2,153.1z"/>
          <polygon points="274.8,154.5 271.6,153.8 274.4,141.3 278,142.1"/>
          <path d="M281.3,156.5c-1-0.4-2.1-0.7-3.1-1l3.6-12.3c1.2,0.3,2.3,0.7,3.5,1.1L281.3,156.5z"/>
          <polygon points="287.6,158.8 284.6,157.6 289.1,145.6 292.5,147"/>
          <path d="M293.8,161.6c-1-0.5-2-0.9-2.9-1.4l5.3-11.7c1.1,0.5,2.2,1,3.3,1.6L293.8,161.6z"/>
          <path d="M299.8,164.8c-0.9-0.5-1.9-1.1-2.8-1.6l6.1-11.3c1.1,0.6,2.1,1.2,3.2,1.8L299.8,164.8z"/>
          <path d="M305.5,168.4l-2.7-1.8l6.8-10.8c1,0.7,2.1,1.3,3.1,2L305.5,168.4z"/>
          <path d="M311,172.4c-0.9-0.7-1.7-1.4-2.6-2l7.6-10.3c1,0.7,2,1.5,2.9,2.2L311,172.4z"/>
          <polygon points="316.2,176.8 313.7,174.6 322,164.8 324.7,167.3"/>
          <polygon points="321,181.5 319.9,180.3 318.7,179.2 327.6,170 329,171.3 330.2,172.6"/>
          <polygon points="325.6,186.5 323.5,184 333,175.5 335.4,178.3"/>
          <path d="M329.8,191.8c-0.6-0.9-1.3-1.7-2-2.6l10.1-7.9c0.7,1,1.5,1.9,2.2,2.9L329.8,191.8z"/>
          <path d="M333.6,197.4l-1.8-2.7l10.6-7.2c0.7,1,1.3,2.1,2,3.1L333.6,197.4z"/>
          <path d="M337,203.3c-0.5-1-1.1-1.9-1.6-2.8l11.1-6.4c0.6,1.1,1.2,2.1,1.8,3.2L337,203.3z"/>
          <path d="M340,209.3c-0.5-1-0.9-2-1.4-2.9l11.5-5.7c0.6,1.1,1,2.2,1.6,3.3L340,209.3z"/>
          <polygon points="342.6,215.6 341.4,212.6 353.2,207.7 354.6,211.1"/>
          <path d="M344.7,222c-0.3-1-0.6-2.1-1-3.1l12.1-4c0.4,1.2,0.8,2.3,1.1,3.5L344.7,222z"/>
          <polygon points="346.4,228.6 345.7,225.4 358.1,222.2 358.9,225.8"/>
          <path d="M347.7,235.2c-0.2-1.1-0.4-2.1-0.6-3.2l12.6-2.3c0.2,1.2,0.4,2.4,0.6,3.6L347.7,235.2z"/>
          <path d="M348.4,242c-0.1-1.1-0.1-2.2-0.3-3.2l12.7-1.4c0.2,1.2,0.2,2.4,0.3,3.7L348.4,242z"/>
          <polygon points="348.7,248.7 348.6,245.5 361.4,244.9 361.5,248.6"/>
          <path d="M348.6,255.5c0.1-1.1,0.1-2.2,0.1-3.3l12.8,0.3c0,1.2,0,2.4-0.1,3.7L348.6,255.5z"/>
          <path d="M348,262.3c0.1-1.1,0.3-2.1,0.4-3.2l12.7,1.2c-0.1,1.2-0.3,2.4-0.4,3.7L348,262.3z"/>
          <polygon points="346.9,269 347.5,265.8 360.1,267.8 359.5,271.4"/>
          <path d="M345.4,275.6c0.3-1,0.5-2.1,0.8-3.2l12.5,2.9c-0.3,1.2-0.5,2.4-0.9,3.6L345.4,275.6z"/>
          <path d="M343.4,282c0.3-1,0.7-2,1-3.1l12.2,3.8c-0.4,1.2-0.8,2.3-1.2,3.5L343.4,282z"/>
          <polygon points="341,288.4 342.2,285.3 354.1,289.9 352.7,293.4"/>
          <path d="M338.1,294.5c0.5-1,1-1.9,1.4-2.9l11.6,5.4c-0.5,1.1-1.1,2.2-1.6,3.3L338.1,294.5z"/>
          <polygon points="334.8,300.4 336.4,297.6 347.6,303.8 345.8,307"/>
          <path d="M331.1,306.1c0.6-0.9,1.2-1.8,1.8-2.7l10.7,7c-0.7,1-1.3,2.1-2,3.1L331.1,306.1z"/>
          <polygon points="327.1,311.5 329.1,309 339.3,316.6 337.1,319.5"/>
          <path d="M322.7,316.7c0.8-0.8,1.4-1.6,2.2-2.4l9.7,8.4c-0.8,0.9-1.6,1.9-2.4,2.7L322.7,316.7z"/>
          <path d="M317.9,321.5c0.8-0.8,1.6-1.5,2.3-2.3l9.1,9c-0.9,0.9-1.8,1.7-2.6,2.6L317.9,321.5z"/>
          <polygon points="312.8,326 315.3,323.9 323.7,333.5 321,335.9"/>
          <path d="M307.4,330.1c0.9-0.6,1.8-1.2,2.6-1.9l7.8,10.2c-0.9,0.8-2,1.5-3,2.2L307.4,330.1z"/>
          <polygon points="301.8,333.8 304.5,332.1 311.6,342.8 308.5,344.7"/>
          <polygon points="295.9,337.2 297.3,336.4 298.8,335.6 305.1,346.7 303.5,347.7 301.8,348.5"/>
          <polygon points="289.8,340.1 292.8,338.8 298.3,350.3 294.9,351.8"/>
          <path d="M283.5,342.6c1-0.3,2-0.8,3-1.2l4.7,11.9c-1.1,0.4-2.3,0.9-3.4,1.3L283.5,342.6z"/>
          <path d="M277.1,344.7c1-0.3,2.1-0.6,3.1-0.9l3.9,12.2c-1.2,0.4-2.4,0.7-3.5,1L277.1,344.7z"/>
          <polygon points="270.5,346.3 273.7,345.6 276.7,358 273.1,358.8"/>
          <polygon points="263.8,347.4 265.4,347.2 267,346.9 269.2,359.5 267.4,359.9 265.6,360.1"/>
          <polygon points="257.1,348.1 260.3,347.9 261.6,360.6 257.9,360.9"/>
          <polygon points="250.3,348.4 253.6,348.3 254,361.1 250.3,361.2"/>
          <polygon points="249.2,348.4 250.3,348.4 250.3,361.2 249.1,361.1"/>
          <polygon points="247,348.3 248,348.3 247.7,361.1 246.5,361.1"/>
          <path d="M244.7,348.2c0.4,0,0.7,0.1,1.1,0.1l-0.6,12.8c-0.4,0-0.8,0-1.2-0.1L244.7,348.2z"/>
          <polygon points="242.4,348 243.5,348.1 242.7,360.9 241.4,360.8"/>
          <polygon points="240.2,347.9 241.3,348 240.1,360.7 238.9,360.6"/>
          <polygon points="237.9,347.6 239,347.7 237.6,360.4 236.4,360.3"/>
          <polygon points="235.7,347.3 236.8,347.4 235,360.1 233.8,360"/>
          <polygon points="233.5,346.9 234.5,347.1 232.5,359.7 231.3,359.5"/>
          <polygon points="231.3,346.5 232.3,346.7 230,359.3 228.8,359.1"/>
          <polygon points="229,346.1 230.1,346.3 227.5,358.8 226.3,358.6"/>
          <polygon points="226.8,345.6 227.9,345.8 225,358.3 223.8,358"/>
          <polygon points="224.7,345 225.7,345.3 222.5,357.7 221.3,357.3"/>
          <polygon points="222.5,344.4 223.5,344.7 220.1,357 218.9,356.6"/>
          <path d="M220.3,343.7c0.3,0.1,0.7,0.2,1,0.3l-3.8,12.2c-0.4-0.1-0.8-0.2-1.2-0.4L220.3,343.7z"/>
          <polygon points="218.2,343 219.2,343.3 215.2,355.5 214,355.1"/>
          <path d="M216.1,342.3c0.3,0.1,0.7,0.3,1,0.4l-4.3,12c-0.4-0.1-0.8-0.3-1.2-0.4L216.1,342.3z"/>
          <polygon points="214,341.4 215,341.8 210.4,353.8 209.2,353.3"/>
          <path d="M211.9,340.6c0.3,0.1,0.7,0.3,1,0.4l-4.9,11.8c-0.4-0.2-0.8-0.3-1.1-0.5L211.9,340.6z"/>
          <polygon points="209.8,339.7 210.8,340.1 205.7,351.8 204.5,351.3"/>
          <polygon points="207.7,338.7 208.7,339.2 203.3,350.8 202.2,350.3"/>
          <polygon points="205.7,337.7 206.7,338.2 201,349.7 199.9,349.1"/>
          <polygon points="203.7,336.7 204.7,337.2 198.8,348.5 197.7,347.9"/>
          <polygon points="201.8,335.6 202.7,336.1 196.5,347.3 195.4,346.7"/>
          <polygon points="199.8,334.4 200.7,335 194.3,346 193.2,345.4"/>
          <polygon points="197.9,333.3 198.8,333.8 192.1,344.7 191.1,344.1"/>
          <polygon points="196,332 196.9,332.6 189.9,343.4 188.9,342.7"/>
          <polygon points="194.1,330.8 195,331.4 187.8,342 186.8,341.3"/>
          <polygon points="192.3,329.5 193.2,330.1 185.7,340.5 184.7,339.8"/>
          <polygon points="190.5,328.1 191.3,328.8 183.6,339 182.7,338.3"/>
          <polygon points="188.7,326.7 189.5,327.4 181.6,337.4 180.7,336.7"/>
          <path d="M186.9,325.3c0.3,0.2,0.5,0.5,0.8,0.7l-8.1,9.9c-0.3-0.3-0.6-0.5-0.9-0.8L186.9,325.3z"/>
          <polygon points="185.2,323.8 186.1,324.5 177.7,334.2 176.8,333.4"/>
          <path d="M183.6,322.3c0.3,0.2,0.5,0.5,0.8,0.7l-8.6,9.5c-0.3-0.3-0.6-0.6-0.9-0.8L183.6,322.3z"/>
          <polygon points="181.9,320.7 182.7,321.5 173.9,330.8 173,329.9"/>
          <path d="M180.3,319.2c0.2,0.3,0.5,0.5,0.8,0.8l-9,9.1c-0.3-0.3-0.6-0.6-0.9-0.9L180.3,319.2z"/>
          <polygon points="178.7,317.5 179.5,318.3 170.3,327.2 169.4,326.3"/>
          <path d="M177.2,315.9c0.2,0.3,0.5,0.5,0.7,0.8l-9.4,8.7c-0.3-0.3-0.6-0.6-0.8-0.9L177.2,315.9z"/>
          <polygon points="175.7,314.2 176.4,315 166.8,323.4 166,322.5"/>
          <path d="M174.2,312.5c0.2,0.3,0.5,0.5,0.7,0.8l-9.8,8.2c-0.3-0.3-0.5-0.6-0.8-0.9L174.2,312.5z"/>
          <polygon points="172.8,310.7 173.5,311.5 163.5,319.5 162.8,318.6"/>
          <polygon points="171.4,308.9 172.1,309.7 162,317.5 161.2,316.6"/>
          <polygon points="170.1,307.1 170.8,307.9 160.4,315.5 159.7,314.5"/>
          <polygon points="168.8,305.2 169.5,306.1 159,313.4 158.2,312.4"/>
          <polygon points="167.6,303.3 168.2,304.2 157.5,311.3 156.9,310.3"/>
          <polygon points="166.4,301.4 167,302.3 156.1,309.2 155.5,308.1"/>
          <polygon points="165.2,299.5 165.8,300.4 154.8,307 154.2,305.9"/>
          <polygon points="164.1,297.5 164.6,298.5 153.5,304.8 152.9,303.7"/>
          <polygon points="163,295.5 163.5,296.5 152.3,302.6 151.7,301.5"/>
          <polygon points="162,293.5 162.5,294.5 151.1,300.3 150.5,299.2"/>
          <polygon points="161,291.5 161.5,292.5 149.9,298 149.4,296.9"/>
          <polygon points="160.1,289.4 160.6,290.4 148.9,295.7 148.4,294.6"/>
          <path d="M159.2,287.3c0.1,0.3,0.3,0.7,0.4,1l-11.8,5c-0.2-0.4-0.3-0.8-0.5-1.1L159.2,287.3z"/>
          <polygon points="158.4,285.2 158.8,286.3 146.9,291 146.5,289.8"/>
          <path d="M157.6,283.1c0.1,0.3,0.2,0.7,0.4,1l-12,4.4c-0.2-0.4-0.3-0.8-0.4-1.2L157.6,283.1z"/>
          <polygon points="156.9,281 157.2,282 145.1,286.2 144.7,285"/>
          <path d="M156.2,278.9c0.1,0.4,0.2,0.7,0.3,1l-12.2,3.9c-0.1-0.4-0.3-0.8-0.4-1.2L156.2,278.9z"/>
          <polygon points="155.5,276.7 155.8,277.7 143.6,281.3 143.2,280.2"/>
          <polygon points="154.9,274.5 155.2,275.6 142.9,278.9 142.5,277.7"/>
          <polygon points="154.4,272.3 154.7,273.4 142.2,276.4 142,275.2"/>
          <polygon points="153.9,270.1 154.2,271.2 141.7,273.9 141.4,272.7"/>
          <polygon points="153.5,267.9 153.7,269 141.1,271.4 140.9,270.2"/>
          <polygon points="153.1,265.7 153.3,266.7 140.7,268.9 140.5,267.7"/>
          <polygon points="152.8,263.4 152.9,264.5 140.3,266.4 140.1,265.2"/>
          <polygon points="152.5,261.2 152.6,262.3 139.9,263.9 139.8,262.6"/>
          <polygon points="152.3,258.9 152.3,260 139.6,261.3 139.5,260.1"/>
          <polygon points="152.1,256.7 152.2,257.8 139.4,258.8 139.3,257.6"/>
          <path d="M151.9,254.4c0,0.4,0,0.7,0.1,1.1l-12.8,0.7c0-0.4-0.1-0.8-0.1-1.2L151.9,254.4z"/>
          <polygon points="151.9,252.2 151.9,253.3 139.1,253.7 139.1,252.5"/>
          <polygon points="151.8,249.9 151.9,251 139.1,251.1 139,249.9"/>
          <rect x="140.5" y="99.9" transform="matrix(0.7071 -0.7071 0.7071 0.7071 -58.1458 140.9047)" width="1" height="81.5"/>
          <rect x="359.1" y="318.4" transform="matrix(0.7071 -0.7071 0.7071 0.7071 -148.6754 359.4604)" width="1" height="81.5"/>
          <rect x="100.3" y="358.7" transform="matrix(0.7072 -0.7071 0.7071 0.7072 -212.6788 204.8956)" width="81.5" height="1"/>
          <rect x="318.8" y="140.1" transform="matrix(0.7072 -0.7071 0.7071 0.7072 5.8576 295.4257)" width="81.5" height="1"/>
        </g>
      </svg>

      <div className="absolute top-[2%] left-1/2 -translate-x-1/2 pointer-events-auto z-10">
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
            <span className="text-red-400 font-bold">REC</span>
            <span className="text-cyan-300">{formatTime(recordingTime)}</span>
          </div>
          <span className="text-cyan-400/40">|</span>
          <span className="text-cyan-300/90">CAM: HUSKY_LENS</span>
          <span className="text-cyan-400/40">|</span>
          <span className="text-cyan-300/90">1080p</span>
        </div>
      </div>

      {isDemoMode && (
        <div className="absolute top-[12%] right-[8%] bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 rounded text-[9px] font-mono text-cyan-300 pointer-events-auto">
          DEMO
        </div>
      )}

      {detectedObjects.map((obj) => (
        <motion.div
          key={obj.id}
          className="absolute"
          style={{
            left: `${obj.x}%`,
            top: `${obj.y}%`,
            width: `${obj.width}%`,
            height: `${obj.height}%`
          }}
          initial={{ opacity: 0.6, scale: 1 }}
          animate={{
            opacity: [0.6, 0.9, 0.6],
            scale: [1, 1.02, 1]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className={`w-full h-full border-2 ${
            obj.type.includes('HAZARD') ? 'border-red-500/80' : 'border-cyan-400/70'
          }`} style={{ boxShadow: obj.type.includes('HAZARD') ? '0 0 10px rgba(239,68,68,0.6)' : '0 0 10px rgba(103,199,255,0.6)' }}>
            <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-inherit" />
            <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-inherit" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-inherit" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-inherit" />
            
            <div className={`absolute -top-6 left-0 text-[10px] px-2 py-0.5 font-mono font-bold ${
              obj.type.includes('HAZARD') ? 'bg-red-500/90 text-white' : 'bg-cyan-500/90 text-white'
            }`}>
              {obj.type} {Math.round(obj.confidence)}%
            </div>
            <div className="absolute -bottom-5 left-0 text-[8px] text-cyan-400/70 font-mono">
              {obj.id}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

interface CircularCameraControlProps {
  className?: string;
}

export function CircularCameraControl({ className = '' }: CircularCameraControlProps) {
  const { sendCommand } = useWebSocket();
  const [pan, setPan] = useState(0);
  const [tilt, setTilt] = useState(0);

  const handlePanChange = (newPan: number) => {
    const clampedPan = Math.max(-180, Math.min(180, newPan));
    setPan(clampedPan);
    sendCommand({ 
      type: 'command', 
      action: 'CAMERA_PAN', 
      value: clampedPan,
      timestamp: Date.now() 
    });
  };

  const handleTiltChange = (newTilt: number) => {
    const clampedTilt = Math.max(-90, Math.min(90, newTilt));
    setTilt(clampedTilt);
    sendCommand({ 
      type: 'command', 
      action: 'CAMERA_TILT', 
      value: clampedTilt,
      timestamp: Date.now() 
    });
  };

  const handleCenter = () => {
    setPan(0);
    setTilt(0);
    sendCommand({ type: 'command', action: 'CAMERA_CENTER', timestamp: Date.now() });
  };

  const indicatorX = 50 + (pan / 180) * 35;
  const indicatorY = 50 - (tilt / 90) * 35;

  return (
    <div className={`relative pointer-events-auto ${className}`}>
      <div className="relative w-[100px] h-[100px]">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <defs>
            <radialGradient id="cameraControlBg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00ffff" stopOpacity="0.15" />
              <stop offset="70%" stopColor="#0A192F" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0A192F" stopOpacity="0.6" />
            </radialGradient>
            <filter id="cameraGlow">
              <feGaussianBlur stdDeviation="2" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <circle cx="50" cy="50" r="46" fill="url(#cameraControlBg)" stroke="#00ffff" strokeWidth="2" filter="url(#cameraGlow)" />
          <circle cx="50" cy="50" r="35" fill="none" stroke="#00ffff" strokeWidth="0.8" strokeOpacity="0.4" />
          <circle cx="50" cy="50" r="24" fill="none" stroke="#00ffff" strokeWidth="0.6" strokeOpacity="0.3" />

          <line x1="50" y1="6" x2="50" y2="94" stroke="#00ffff" strokeWidth="0.8" strokeOpacity="0.4" />
          <line x1="6" y1="50" x2="94" y2="50" stroke="#00ffff" strokeWidth="0.8" strokeOpacity="0.4" />

          <polygon points="50,8 47,16 53,16" fill="#00ffff" opacity="0.9" />
          <polygon points="50,92 47,84 53,84" fill="#00ffff" opacity="0.9" />
          <polygon points="8,50 16,47 16,53" fill="#00ffff" opacity="0.9" />
          <polygon points="92,50 84,47 84,53" fill="#00ffff" opacity="0.9" />

          <circle cx={indicatorX} cy={indicatorY} r="6" fill="#00ffff" fillOpacity="0.3" filter="url(#cameraGlow)" />
          <circle cx={indicatorX} cy={indicatorY} r="4" fill="#00ffff" />
          <circle cx={indicatorX} cy={indicatorY} r="2" fill="#00ffff" />
        </svg>

        <button
          onClick={() => handleTiltChange(tilt + 15)}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-5 flex items-center justify-center text-cyan-400/60 hover:text-cyan-400 transition-colors"
          data-testid="button-cam-tilt-up"
        >
          <svg width="12" height="8" viewBox="0 0 12 8"><path d="M6 0 L12 8 L0 8 Z" fill="currentColor" /></svg>
        </button>

        <button
          onClick={() => handleTiltChange(tilt - 15)}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-5 flex items-center justify-center text-cyan-400/60 hover:text-cyan-400 transition-colors"
          data-testid="button-cam-tilt-down"
        >
          <svg width="12" height="8" viewBox="0 0 12 8"><path d="M6 8 L0 0 L12 0 Z" fill="currentColor" /></svg>
        </button>

        <button
          onClick={() => handlePanChange(pan - 30)}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-8 flex items-center justify-center text-cyan-400/60 hover:text-cyan-400 transition-colors"
          data-testid="button-cam-pan-left"
        >
          <svg width="8" height="12" viewBox="0 0 8 12"><path d="M0 6 L8 0 L8 12 Z" fill="currentColor" /></svg>
        </button>

        <button
          onClick={() => handlePanChange(pan + 30)}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-8 flex items-center justify-center text-cyan-400/60 hover:text-cyan-400 transition-colors"
          data-testid="button-cam-pan-right"
        >
          <svg width="8" height="12" viewBox="0 0 8 12"><path d="M8 6 L0 0 L0 12 Z" fill="currentColor" /></svg>
        </button>

        <button
          onClick={handleCenter}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-cyan-500/20 hover:bg-cyan-500/40 flex items-center justify-center transition-colors border border-cyan-400/40"
          data-testid="button-cam-center"
        >
          <RotateCcw className="w-3 h-3 text-cyan-400" />
        </button>
      </div>

      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex gap-3 text-[9px] font-mono text-cyan-400/70 bg-slate-900/50 px-2 py-0.5 rounded backdrop-blur-sm">
        <span>P:{pan}°</span>
        <span>T:{tilt}°</span>
      </div>
    </div>
  );
}

interface ProximityRadarProps {
  className?: string;
}

export function ProximityRadar({ className = '' }: ProximityRadarProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="relative w-[100px] h-[100px]">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <defs>
            <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00ffff" stopOpacity="0.1" />
              <stop offset="70%" stopColor="#0A192F" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0A192F" stopOpacity="0.6" />
            </radialGradient>
            <filter id="radarGlow">
              <feGaussianBlur stdDeviation="2" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <circle cx="50" cy="50" r="46" fill="url(#radarBg)" stroke="#00ffff" strokeWidth="2" filter="url(#radarGlow)" />
          <circle cx="50" cy="50" r="35" fill="none" stroke="#00ffff" strokeWidth="0.8" strokeOpacity="0.4" />
          <circle cx="50" cy="50" r="24" fill="none" stroke="#00ffff" strokeWidth="0.6" strokeOpacity="0.3" />
          <circle cx="50" cy="50" r="12" fill="none" stroke="#00ffff" strokeWidth="0.4" strokeOpacity="0.2" />

          <line x1="50" y1="4" x2="50" y2="96" stroke="#00ffff" strokeWidth="0.6" strokeOpacity="0.3" />
          <line x1="4" y1="50" x2="96" y2="50" stroke="#00ffff" strokeWidth="0.6" strokeOpacity="0.3" />
          <line x1="17" y1="17" x2="83" y2="83" stroke="#00ffff" strokeWidth="0.4" strokeOpacity="0.2" />
          <line x1="83" y1="17" x2="17" y2="83" stroke="#00ffff" strokeWidth="0.4" strokeOpacity="0.2" />

          <text x="50" y="10" fill="#00ffff" fontSize="6" textAnchor="middle" opacity="0.7">N</text>
          <text x="50" y="96" fill="#00ffff" fontSize="6" textAnchor="middle" opacity="0.7">S</text>
          <text x="8" y="52" fill="#00ffff" fontSize="6" textAnchor="middle" opacity="0.7">W</text>
          <text x="92" y="52" fill="#00ffff" fontSize="6" textAnchor="middle" opacity="0.7">E</text>

          <circle cx="50" cy="50" r="3" fill="#00ffff" opacity="0.9" />
          
          <circle cx="38" cy="35" r="2.5" fill="#00ff00" opacity="0.8" />
          <circle cx="62" cy="42" r="2.5" fill="#00ff00" opacity="0.8" />
          <circle cx="55" cy="68" r="2.5" fill="#00ff00" opacity="0.8" />
          <circle cx="30" cy="55" r="2.5" fill="#00ff00" opacity="0.8" />
          <circle cx="70" cy="60" r="2.5" fill="#00ff00" opacity="0.8" />
        </svg>
      </div>
    </div>
  );
}
