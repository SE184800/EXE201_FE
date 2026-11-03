package com.supplymind.mobile;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import java.io.ByteArrayInputStream;
import org.json.JSONObject;

/** Offline demonstration only. Its wallet never touches the hosted account or API. */
public class VipDemoActivity extends Activity {
    private WebView webView;
    private SharedPreferences preferences;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        preferences = getSharedPreferences("supplymind_vip_local_demo", MODE_PRIVATE);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(246, 248, 242));
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowCompat.getInsetsController(getWindow(), root).setAppearanceLightStatusBars(true);
        WindowCompat.getInsetsController(getWindow(), root).setAppearanceLightNavigationBars(true);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            Insets safe = insets.getInsets(WindowInsetsCompat.Type.systemBars()
                | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime());
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(root);
        webView.setBackgroundColor(Color.rgb(246, 248, 242));
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setBlockNetworkLoads(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.setWebViewClient(new WebViewClient() {
            private boolean local(Uri uri) {
                return "file".equals(uri.getScheme())
                    && uri.getPath() != null
                    && uri.getPath().startsWith("/android_asset/vip-demo/");
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !local(request.getUrl());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (local(request.getUrl())) return null;
                return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
            }
        });
        webView.addJavascriptInterface(new DemoStorage(), "DemoStorage");
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        webView.loadUrl("file:///android_asset/vip-demo/index.html");
    }

    private final class DemoStorage {
        @JavascriptInterface public synchronized String read() {
            return preferences.getString("state", "");
        }
        @JavascriptInterface public synchronized boolean write(String value) {
            try {
                if (value == null || value.length() > 100000) return false;
                new JSONObject(value);
                // One durable snapshot contains balance, plan and history together.
                return preferences.edit().putString("state", value).commit();
            } catch (Exception ignored) { return false; }
        }
        @JavascriptInterface public void openMain() {
            runOnUiThread(() -> startActivity(new Intent(VipDemoActivity.this, MainActivity.class)));
        }
    }

    @Override protected void onDestroy() {
        if (webView != null) { webView.removeJavascriptInterface("DemoStorage"); webView.destroy(); }
        super.onDestroy();
    }
}
