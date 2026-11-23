package com.aura.secretary;

import android.os.Bundle;
import com.aura.secretary.phonewatch.PhoneWatchPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PhoneWatchPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
