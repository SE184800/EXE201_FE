package com.supplymind.mobile;

import android.os.Bundle;
import android.content.Intent;
import android.app.AlertDialog;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private String notificationPath = "";
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SupplyMindSpeechPlugin.class);
        registerPlugin(SupplyMindNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
        readNotificationIntent(getIntent());
        NotificationCenter.start(this);
        if (!NotificationCenter.prefs(this).getBoolean("introduced", false)) {
            NotificationCenter.prefs(this).edit().putBoolean("introduced", true).apply();
            new AlertDialog.Builder(this).setTitle("Nhận thông báo SupplyMind")
                .setMessage("Nhắc giờ giao đơn, cập nhật thanh toán và ngày lễ trên thanh thông báo điện thoại.")
                .setPositiveButton("Thiết lập", (dialog, which) -> startActivity(new Intent(this, NotificationSettingsActivity.class)))
                .setNegativeButton("Để sau", null).show();
        }
        if (bridge != null) {
            WebView webView = bridge.getWebView();
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            WindowCompat.getInsetsController(getWindow(), webView).setAppearanceLightStatusBars(true);
            WindowCompat.getInsetsController(getWindow(), webView).setAppearanceLightNavigationBars(true);
            applyContentInsets(webView);
        }
    }

    private void readNotificationIntent(Intent intent) {
        String path = intent == null ? null : intent.getStringExtra("notification_path");
        if (java.util.Arrays.asList("/store/orders", "/supplier/orders", "/store/wallet", "/supplier/wallet").contains(path)) notificationPath = path;
    }
    public String consumeNotificationPath() { String path = notificationPath; notificationPath = ""; return path; }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent); readNotificationIntent(intent);
        if (bridge != null) bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('supplymind:notification-target'))", null);
    }
    @Override public void onResume() {
        super.onResume(); NotificationCenter.fire(this); NotificationSync.request(this, false);
    }

    /** Resize the entire web viewport, including dialogs and fixed footers, above the IME.
     * Capacitor 7's built-in edge-to-edge handler only accounts for system bars, then
     * consumes the keyboard insets. Handle both here so every hosted form benefits.
     */
    private void applyContentInsets(WebView webView) {
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            // getInsets takes the maximum per edge, not keyboard + navigation bar twice.
            Insets safe = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout()
                    | WindowInsetsCompat.Type.ime()
            );
            ViewGroup.MarginLayoutParams layout = (ViewGroup.MarginLayoutParams) view.getLayoutParams();
            if (layout.leftMargin != safe.left || layout.topMargin != safe.top
                || layout.rightMargin != safe.right || layout.bottomMargin != safe.bottom) {
                layout.setMargins(safe.left, safe.top, safe.right, safe.bottom);
                view.setLayoutParams(layout);
            }
            // The WebView already occupies only the usable area: avoid double insets.
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(webView);
    }
}
