package com.supplymind.mobile;

import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SupplyMindSpeechPlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge != null) {
            WebView webView = bridge.getWebView();
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            WindowCompat.getInsetsController(getWindow(), webView).setAppearanceLightStatusBars(true);
            WindowCompat.getInsetsController(getWindow(), webView).setAppearanceLightNavigationBars(true);
            applyContentInsets(webView);
        }
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
