package com.roverostech.rover;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RoverDiscoveryPlugin.class);
        registerPlugin(RoverProvisioningPlugin.class);
        registerPlugin(RoverMediaPlugin.class);
        super.onCreate(savedInstanceState);
        String userAgent = getBridge().getWebView().getSettings().getUserAgentString();
        getBridge().getWebView().getSettings().setUserAgentString(userAgent + " RoverOS/1.0");
        getBridge().setWebViewClient(new RoverPinnedWebViewClient(getBridge()));
    }
}
