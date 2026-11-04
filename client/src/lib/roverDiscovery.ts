import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { RoverServerCandidate } from "./discoveredServer";

interface RoverDiscoveryPlugin {
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  addListener(
    eventName: "serverFound",
    listener: (candidate: RoverServerCandidate) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "discoveryError",
    listener: (error: { message?: string }) => void,
  ): Promise<PluginListenerHandle>;
}

const nativeRoverDiscovery =
  registerPlugin<RoverDiscoveryPlugin>("RoverDiscovery");

export async function startRoverServerDiscovery(
  onServerFound: (candidate: RoverServerCandidate) => void,
  onDiscoveryError: (message: string) => void,
): Promise<() => void> {
  const serverListener = await nativeRoverDiscovery.addListener(
    "serverFound",
    onServerFound,
  );
  let errorListener: PluginListenerHandle | undefined;

  try {
    errorListener = await nativeRoverDiscovery.addListener(
      "discoveryError",
      ({ message }) => onDiscoveryError(message || "Local-network discovery failed."),
    );
    await nativeRoverDiscovery.startDiscovery();
  } catch (error) {
    await serverListener.remove();
    await errorListener?.remove();
    throw error;
  }

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    void serverListener.remove();
    void errorListener?.remove();
    void nativeRoverDiscovery.stopDiscovery().catch(() => undefined);
  };
}
