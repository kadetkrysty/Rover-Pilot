package com.roverostech.rover;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RoverDiscoveryPlugin.class);
        registerPlugin(RoverProvisioningPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
