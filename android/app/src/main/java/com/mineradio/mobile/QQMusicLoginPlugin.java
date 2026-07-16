package com.mineradio.mobile;

import android.app.Activity;
import android.content.Intent;
import android.webkit.CookieManager;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Android counterpart of Mineradio Desktop's isolated QQ Music login window.
 * The official QQ Music page owns the QR-code flow; this plugin only returns
 * the resulting QQ Music cookie header to the existing server-side importer.
 */
@CapacitorPlugin(name = "QQMusicLogin")
public class QQMusicLoginPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        Intent intent = new Intent(getActivity(), QQMusicLoginActivity.class);
        startActivityForResult(call, intent, "handleLoginResult");
    }

    @PluginMethod
    public void clear(PluginCall call) {
        CookieManager manager = CookieManager.getInstance();
        manager.removeAllCookies(value -> {
            manager.flush();
            call.resolve();
        });
    }

    @ActivityCallback
    private void handleLoginResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() == Activity.RESULT_OK && data != null) {
            String cookie = data.getStringExtra(QQMusicLoginActivity.EXTRA_COOKIE);
            if (cookie != null && !cookie.trim().isEmpty()) {
                JSObject value = new JSObject();
                value.put("ok", true);
                value.put("cookie", cookie);
                value.put("partial", data.getBooleanExtra(QQMusicLoginActivity.EXTRA_PARTIAL, false));
                value.put("reused", data.getBooleanExtra(QQMusicLoginActivity.EXTRA_REUSED, false));
                call.resolve(value);
                return;
            }
        }
        String message = data == null ? "QQ 音乐登录已取消" : data.getStringExtra(QQMusicLoginActivity.EXTRA_MESSAGE);
        call.reject(message == null || message.trim().isEmpty() ? "QQ 音乐登录已取消" : message, "QQ_LOGIN_CANCELLED");
    }
}
