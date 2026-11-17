package com.supplymind.mobile;

import android.app.Instrumentation;
import android.content.Intent;
import android.net.Uri;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

public class MobileAppTest {
    @Test public void onlyTrustedDataPathsBypassLocalAssets() {
        assertTrue(MobileWebViewClient.isRemoteData(Uri.parse("https://supplymind-demo.vercel.app/api/health")));
        assertTrue(MobileWebViewClient.isRemoteData(Uri.parse("https://supplymind-demo.vercel.app:443/uploads/invoice.png")));
        for (String url : new String[] {"http://supplymind-demo.vercel.app/api/health",
                "https://supplymind-demo.vercel.app.evil.test/api/health",
                "https://supplymind-demo.vercel.app:444/api/health",
                "https://supplymind-demo.vercel.app/apiculture", "https://supplymind-demo.vercel.app/assets/index.js",
                "https://supplymind-demo.vercel.app/store/quick-sale"}) {
            assertFalse(url, MobileWebViewClient.isRemoteData(Uri.parse(url)));
        }
    }

    private String evaluate(Instrumentation instrument, MainActivity activity, String js) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        instrument.runOnMainSync(() -> activity.getBridge().getWebView().evaluateJavascript(js, value -> {
            result.set(value); latch.countDown();
        }));
        assertTrue(latch.await(5, TimeUnit.SECONDS));
        return result.get();
    }

    @Test public void bundledAppLoadsAndHttpsGetPostReachBackend() throws Exception {
        Instrumentation instrument = InstrumentationRegistry.getInstrumentation();
        NotificationCenter.prefs(instrument.getTargetContext()).edit().putBoolean("introduced", true).commit();
        MainActivity activity = (MainActivity) instrument.startActivitySync(new Intent(instrument.getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        try {
            long deadline = System.currentTimeMillis() + 45000;
            boolean ready = false;
            while (System.currentTimeMillis() < deadline) {
                if ("true".equals(evaluate(instrument, activity, "Boolean(window.Capacitor?.isNativePlatform() && document.querySelector('#root')?.childElementCount && document.querySelector('script[src*=\"/assets/index-\"]'))"))) { ready = true; break; }
                Thread.sleep(400);
            }
            assertTrue("Bundled React application must render", ready);
            assertNull("APK must not use a remote server.url", activity.getBridge().getConfig().getServerUrl());
            evaluate(instrument, activity, "window.__mobileNetworkTest=null; (async()=>{try { const h=await fetch('/api/health'); const health=await h.json(); const p=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Protection':'sg-restock-web'},body:JSON.stringify({username:'nonexistent_mobile_smoke_'+Date.now(),password:'invalid-smoke-only'})}); const body=await p.json(); window.__mobileNetworkTest={healthStatus:h.status,healthJson:!!health,postStatus:p.status,postJson:!!body}; } catch(e) {window.__mobileNetworkTest={error:String(e)};} })();");
            String result = "null";
            deadline = System.currentTimeMillis() + 60000;
            while (System.currentTimeMillis() < deadline) {
                result = evaluate(instrument, activity, "window.__mobileNetworkTest");
                if (!"null".equals(result)) break;
                Thread.sleep(500);
            }
            assertTrue("Health API must return JSON, not bundled HTML: " + result, result.contains("\"healthStatus\":200") && result.contains("\"healthJson\":true"));
            assertTrue("Invalid login POST must reach auth handler: " + result, result.contains("\"postStatus\":401") && result.contains("\"postJson\":true"));
        } finally { instrument.runOnMainSync(activity::finish); }
    }
}
