package com.supplymind.mobile;

import android.app.*;
import android.content.*;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

public class NotificationHostedBridgeTest {
    @Test public void hostedPageShowsBellAndOpensNativeSettings()throws Exception {
        Assume.assumeTrue("true".equals(InstrumentationRegistry.getArguments().getString("hosted")));
        Instrumentation instrument=InstrumentationRegistry.getInstrumentation();Context c=instrument.getTargetContext();
        NotificationCenter.prefs(c).edit().putBoolean("introduced",true).commit();
        MainActivity activity=(MainActivity)instrument.startActivitySync(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        long deadline=System.currentTimeMillis()+40000;boolean found=false;
        while(System.currentTimeMillis()<deadline) {
            CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
            instrument.runOnMainSync(()->activity.getBridge().getWebView().evaluateJavascript("Boolean(document.getElementById('supplymind-native-notifications'))",value->{result.set(value);latch.countDown();}));
            latch.await(3,TimeUnit.SECONDS);if("true".equals(result.get())){found=true;break;}Thread.sleep(500);
        }
        assertTrue("Notification adapter was not mounted in the hosted page",found);
        Instrumentation.ActivityMonitor monitor=instrument.addMonitor(NotificationSettingsActivity.class.getName(),null,false);
        instrument.runOnMainSync(()->activity.getBridge().getWebView().evaluateJavascript("document.getElementById('supplymind-native-notifications').click()",null));
        Activity settings=monitor.waitForActivityWithTimeout(10000);assertNotNull("Bell must open the native settings activity",settings);
        instrument.removeMonitor(monitor);instrument.runOnMainSync(()->{settings.finish();activity.finish();});
    }
}
