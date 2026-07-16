package com.mineradio.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Opens QQ Music's real HTTPS login page in an app-owned WebView. This mirrors
 * the Electron implementation in XxHuberrr/Mineradio: wait for a QQ account
 * cookie, then warm up the player page until a QQ Music playback ticket exists.
 */
public class QQMusicLoginActivity extends Activity {
    public static final String EXTRA_COOKIE = "cookie";
    public static final String EXTRA_PARTIAL = "partial";
    public static final String EXTRA_REUSED = "reused";
    public static final String EXTRA_MESSAGE = "message";

    private static final String QQ_LOGIN_URL = "https://y.qq.com/n/ryqq/profile";
    private static final String QQ_PLAYER_URL = "https://y.qq.com/n/ryqq/player";
    private static final long POLL_INTERVAL_MS = 1200L;
    private static final long WARMUP_DELAY_MS = 900L;
    private static final List<String> COOKIE_URLS = Arrays.asList(
        "https://y.qq.com/",
        "https://u.y.qq.com/",
        "https://c.y.qq.com/",
        "https://ptlogin2.qq.com/",
        "https://qq.com/"
    );
    private static final List<String> COOKIE_PRIORITY = Arrays.asList(
        "uin", "qqmusic_uin", "wxuin", "p_uin", "qm_keyst", "qqmusic_key", "music_key", "wxskey",
        "p_skey", "skey", "psrf_qqaccess_token", "psrf_qqrefresh_token", "wxrefresh_token"
    );

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private ProgressBar progress;
    private boolean finished;
    private boolean warmupStarted;
    private final Runnable pollCookies = new Runnable() {
        @Override
        public void run() {
            checkLoginCookies(false);
            if (!finished) handler.postDelayed(this, POLL_INTERVAL_MS);
        }
    };

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(18, 18, 18));

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(8), dp(6), dp(8), dp(6));
        toolbar.setBackgroundColor(Color.rgb(28, 28, 28));

        Button cancel = new Button(this);
        cancel.setText("取消");
        cancel.setTextColor(Color.WHITE);
        cancel.setAllCaps(false);
        cancel.setOnClickListener(view -> finishWithCurrentCookie());
        toolbar.addView(cancel, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        TextView title = new TextView(this);
        title.setText("QQ 音乐扫码登录");
        title.setTextColor(Color.WHITE);
        title.setTextSize(17);
        title.setGravity(Gravity.CENTER);
        toolbar.addView(title, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        TextView hint = new TextView(this);
        hint.setText("登录后会自动返回 Mineradio");
        hint.setTextColor(Color.rgb(174, 198, 127));
        hint.setTextSize(12);
        hint.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.addView(hint, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        root.addView(toolbar, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        webView = new WebView(this);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        progress.setVisibility(View.VISIBLE);
        content.addView(progress, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(3)));
        content.addView(webView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        root.addView(content, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        // QQ Music's desktop page is the same official QR-login page used by
        // the Electron implementation we are mirroring here.
        webView.getSettings().setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        webView.getSettings().setSupportZoom(false);
        webView.getSettings().setLoadWithOverviewMode(true);
        webView.getSettings().setUseWideViewPort(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(true);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                progress.setVisibility(View.VISIBLE);
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                checkLoginCookies(false);
                openVisibleLoginEntry(view);
                super.onPageFinished(view, url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Keep QQ's HTTPS login redirects inside this isolated WebView.
                return false;
            }
        });

        String initial = getQQCookieHeader();
        if (hasPlaybackLogin(initial)) {
            finishLogin(initial, false, true);
            return;
        }
        handler.post(pollCookies);
        webView.loadUrl(QQ_LOGIN_URL);
    }

    @Override
    public void onBackPressed() {
        finishWithCurrentCookie();
    }

    @Override
    protected void onDestroy() {
        finished = true;
        handler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private void checkLoginCookies(boolean closing) {
        if (finished) return;
        String cookie = getQQCookieHeader();
        if (hasPlaybackLogin(cookie)) {
            finishLogin(cookie, false, false);
        } else if (hasLogin(cookie) && !warmupStarted && !closing) {
            warmupStarted = true;
            handler.postDelayed(() -> {
                if (!finished && webView != null) webView.loadUrl(QQ_PLAYER_URL);
            }, WARMUP_DELAY_MS);
        }
    }

    private void finishWithCurrentCookie() {
        if (finished) return;
        String cookie = getQQCookieHeader();
        if (hasLogin(cookie)) {
            finishLogin(cookie, !hasPlaybackLogin(cookie), false);
        } else {
            Intent data = new Intent();
            data.putExtra(EXTRA_MESSAGE, "QQ 音乐登录已取消");
            finished = true;
            setResult(Activity.RESULT_CANCELED, data);
            finish();
        }
    }

    /** Mirrors the reference Electron window: reveal QQ Music's QR-login UI
     * immediately when the landing page exposes a visible 登录/登陆 entry. */
    private void openVisibleLoginEntry(WebView view) {
        String script = "setTimeout(function(){" +
            "var nodes=Array.prototype.slice.call(document.querySelectorAll('a,button,span,div'));" +
            "var node=nodes.find(function(item){var text=(item.textContent||'').trim();" +
            "if(!/登录|登陆/.test(text))return false;var rect=item.getBoundingClientRect();" +
            "return rect.width>0&&rect.height>0;});if(node)node.click();},700);";
        view.evaluateJavascript(script, null);
    }

    private void finishLogin(String cookie, boolean partial, boolean reused) {
        if (finished) return;
        finished = true;
        handler.removeCallbacksAndMessages(null);
        CookieManager.getInstance().flush();
        Intent data = new Intent();
        data.putExtra(EXTRA_COOKIE, cookie);
        data.putExtra(EXTRA_PARTIAL, partial);
        data.putExtra(EXTRA_REUSED, reused);
        setResult(Activity.RESULT_OK, data);
        finish();
    }

    private String getQQCookieHeader() {
        CookieManager manager = CookieManager.getInstance();
        LinkedHashMap<String, String> cookies = new LinkedHashMap<>();
        for (String url : COOKIE_URLS) {
            String header = manager.getCookie(url);
            if (header == null || header.trim().isEmpty()) continue;
            for (String part : header.split(";")) {
                int separator = part.indexOf('=');
                if (separator <= 0) continue;
                String name = part.substring(0, separator).trim();
                String value = part.substring(separator + 1).trim();
                if (!name.isEmpty() && !value.isEmpty()) cookies.put(name, value);
            }
        }
        StringBuilder header = new StringBuilder();
        for (String name : COOKIE_PRIORITY) {
            if (cookies.containsKey(name)) appendCookie(header, name, cookies.remove(name));
        }
        for (Map.Entry<String, String> entry : cookies.entrySet()) appendCookie(header, entry.getKey(), entry.getValue());
        return header.toString();
    }

    private static void appendCookie(StringBuilder target, String name, String value) {
        if (target.length() > 0) target.append("; ");
        target.append(name).append('=').append(value);
    }

    private static Map<String, String> parseCookies(String header) {
        LinkedHashMap<String, String> values = new LinkedHashMap<>();
        if (header == null) return values;
        for (String part : header.split(";")) {
            int separator = part.indexOf('=');
            if (separator <= 0) continue;
            values.put(part.substring(0, separator).trim(), part.substring(separator + 1).trim());
        }
        return values;
    }

    private static String firstValue(Map<String, String> values, String... names) {
        for (String name : names) {
            String value = values.get(name);
            if (value != null && !value.trim().isEmpty()) return value;
        }
        return "";
    }

    private static boolean hasLogin(String header) {
        Map<String, String> values = parseCookies(header);
        String uin = "2".equals(values.get("login_type"))
            ? firstValue(values, "wxuin", "uin", "p_uin")
            : firstValue(values, "uin", "qqmusic_uin", "wxuin", "p_uin");
        String normalizedUin = uin.replaceAll("\\D", "");
        String key = firstValue(values, "qm_keyst", "qqmusic_key", "music_key", "p_skey", "skey", "psrf_qqaccess_token", "psrf_qqrefresh_token", "wxrefresh_token", "wxskey");
        return !normalizedUin.isEmpty() && !key.isEmpty();
    }

    private static boolean hasPlaybackLogin(String header) {
        Map<String, String> values = parseCookies(header);
        String uin = "2".equals(values.get("login_type"))
            ? firstValue(values, "wxuin", "uin", "p_uin")
            : firstValue(values, "uin", "qqmusic_uin", "wxuin", "p_uin");
        String normalizedUin = uin.replaceAll("\\D", "");
        String key = firstValue(values, "qm_keyst", "qqmusic_key", "music_key", "wxskey");
        return !normalizedUin.isEmpty() && !key.isEmpty();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
