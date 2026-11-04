package com.roverostech.rover;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(name = "RoverDiscovery")
public class RoverDiscoveryPlugin extends Plugin {
    private static final String TAG = "RoverDiscovery";
    private static final String SERVICE_TYPE = "_http._tcp.";
    private static final String SERVICE_NAME = "RoverOS-Server";
    private static final int SERVER_PORT = 5000;

    private NsdManager nsdManager;
    private NsdManager.DiscoveryListener discoveryListener;
    private final Set<String> resolvingServices = new HashSet<>();

    @PluginMethod
    public void startDiscovery(PluginCall call) {
        if (discoveryListener != null) {
            call.resolve();
            return;
        }

        Context context = getContext();
        nsdManager = (NsdManager) context.getSystemService(Context.NSD_SERVICE);
        if (nsdManager == null) {
            call.reject("Android network service discovery is unavailable.");
            return;
        }

        discoveryListener = new NsdManager.DiscoveryListener() {
            @Override
            public void onDiscoveryStarted(String serviceType) {
                Log.d(TAG, "Started discovering RoverOS services.");
            }

            @Override
            public void onServiceFound(NsdServiceInfo service) {
                if (!isTargetService(service)) {
                    return;
                }

                String key = service.getServiceName() + "|" + service.getServiceType();
                if (!resolvingServices.add(key)) {
                    return;
                }

                try {
                    // resolveService remains available on the project's supported Android APIs.
                    nsdManager.resolveService(service, new NsdManager.ResolveListener() {
                        @Override
                        public void onResolveFailed(NsdServiceInfo failedService, int errorCode) {
                            resolvingServices.remove(key);
                            Log.w(TAG, "Could not resolve RoverOS service: " + errorCode);
                        }

                        @Override
                        public void onServiceResolved(NsdServiceInfo resolvedService) {
                            resolvingServices.remove(key);
                            publishIfValid(resolvedService);
                        }
                    });
                } catch (RuntimeException error) {
                    resolvingServices.remove(key);
                    Log.w(TAG, "Could not start RoverOS service resolution.", error);
                }
            }

            @Override
            public void onServiceLost(NsdServiceInfo service) {
                resolvingServices.remove(service.getServiceName() + "|" + service.getServiceType());
            }

            @Override
            public void onDiscoveryStopped(String serviceType) {
                Log.d(TAG, "Stopped discovering RoverOS services.");
            }

            @Override
            public void onStartDiscoveryFailed(String serviceType, int errorCode) {
                notifyDiscoveryError("Android could not start local-network discovery.");
                stopDiscoveryInternal();
            }

            @Override
            public void onStopDiscoveryFailed(String serviceType, int errorCode) {
                Log.w(TAG, "Could not stop service discovery: " + errorCode);
                stopDiscoveryInternal();
            }
        };

        try {
            nsdManager.discoverServices(
                SERVICE_TYPE,
                NsdManager.PROTOCOL_DNS_SD,
                discoveryListener
            );
            call.resolve();
        } catch (RuntimeException error) {
            discoveryListener = null;
            call.reject("Android could not start local-network discovery.", error);
        }
    }

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        stopDiscoveryInternal();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        stopDiscoveryInternal();
        super.handleOnDestroy();
    }

    private boolean isTargetService(NsdServiceInfo service) {
        String serviceType = service.getServiceType();
        String serviceName = service.getServiceName();
        boolean isHttpService = "_http._tcp.".equalsIgnoreCase(serviceType)
            || "_http._tcp".equalsIgnoreCase(serviceType);
        return serviceType != null
            && isHttpService
            && SERVICE_NAME.equalsIgnoreCase(serviceName);
    }

    private void publishIfValid(NsdServiceInfo service) {
        if (!isTargetService(service) || service.getPort() != SERVER_PORT) {
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Map<String, byte[]> attributes = service.getAttributes();
            byte[] marker = attributes == null ? null : attributes.get("roveros");
            if (marker == null || !"1".equals(new String(marker, StandardCharsets.UTF_8))) {
                return;
            }
        }

        InetAddress host = service.getHost();
        if (!(host instanceof Inet4Address) || !isLocalAddress(host)) {
            return;
        }

        JSObject result = new JSObject();
        try {
            result.put("serviceName", service.getServiceName());
            result.put("serviceType", service.getServiceType());
            result.put("host", host.getHostAddress());
            result.put("port", service.getPort());
            result.put("marker", "1");
            notifyListeners("serverFound", result);
        } catch (JSONException error) {
            Log.w(TAG, "Could not report discovered RoverOS service.", error);
        }
    }

    private boolean isLocalAddress(InetAddress address) {
        return !address.isAnyLocalAddress()
            && !address.isLoopbackAddress()
            && !address.isMulticastAddress()
            && (address.isSiteLocalAddress() || address.isLinkLocalAddress());
    }

    private void notifyDiscoveryError(String message) {
        JSObject result = new JSObject();
        try {
            result.put("message", message);
            notifyListeners("discoveryError", result);
        } catch (JSONException error) {
            Log.w(TAG, "Could not report discovery error.", error);
        }
    }

    private void stopDiscoveryInternal() {
        NsdManager.DiscoveryListener activeListener = discoveryListener;
        discoveryListener = null;
        resolvingServices.clear();

        if (nsdManager != null && activeListener != null) {
            try {
                nsdManager.stopServiceDiscovery(activeListener);
            } catch (IllegalArgumentException error) {
                Log.d(TAG, "Service discovery was already stopped.");
            }
        }
    }
}
