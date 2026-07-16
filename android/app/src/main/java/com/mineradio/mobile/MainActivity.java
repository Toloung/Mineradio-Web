package com.mineradio.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register before BridgeActivity creates its Capacitor bridge.
        registerPlugin(QQMusicLoginPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
