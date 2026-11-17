package com.supplymind.mobile;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/** Serve the versioned UI from the APK, while WebView performs normal HTTPS API
 * requests (including POST bodies and HttpOnly cookies). No custom HTTP proxy. */
public final class MobileWebViewClient extends BridgeWebViewClient {
    public MobileWebViewClient(Bridge bridge) { super(bridge); }

    static boolean isRemoteData(Uri uri) {
        if (!"https".equals(uri.getScheme()) || !"supplymind-demo.vercel.app".equals(uri.getHost())
            || (uri.getPort() != -1 && uri.getPort() != 443)) return false;
        String path = uri.getPath();
        return path != null && (path.equals("/api") || path.startsWith("/api/") || path.startsWith("/uploads/"));
    }

    @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        if (isRemoteData(request.getUrl())) return null;
        return super.shouldInterceptRequest(view, request);
    }
}
