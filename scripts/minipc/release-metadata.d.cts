export declare const ASSETS: string[];
export declare function compareVersions(a: string, b: string): number;
export declare function selectRelease(releases: unknown, repository: string): {
  tag: string;
  version: string;
  urls: Record<string, string>;
};
export declare function verifyManifest(manifest: unknown, version: string, installedVersion?: string): void;
