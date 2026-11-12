package com.supplymind.mobile;

import android.app.*;
import android.content.*;
import android.graphics.Bitmap;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.*;
import java.io.File;
import java.io.FileOutputStream;

/** Explicit opt-in visual/background fixture, only included in the instrumentation APK. */
public class NotificationPreviewTest {
    @Test public void captureSettingsAndLeaveBackgroundAlarm()throws Exception {
        Assume.assumeTrue("true".equals(InstrumentationRegistry.getArguments().getString("preview")));
        Instrumentation instrument=InstrumentationRegistry.getInstrumentation();Context c=instrument.getTargetContext();
        NotificationCenter.prefs(c).edit().clear().putBoolean("auth_paused",true).putBoolean("introduced",true).commit();
        NotificationCenter.clearAccount(c);long now=System.currentTimeMillis();
        long delay=Long.parseLong(InstrumentationRegistry.getArguments().getString("delayMs","20000"));
        JSONObject s=NotificationCenter.state(c);
        NotificationRules.Notice alarm=new NotificationRules.Notice("background-preview","delivery","Đến giờ giao • Đơn thử #42",
            "Thông báo thử: nhắc giờ giao khi app đã đóng.","/store/orders",now+delay,now+delay+300000);
        NotificationCenter.put(s,"pending",new JSONArray().put(alarm.json()));NotificationCenter.put(s,"message","Dữ liệu thử để kiểm tra thông báo Android.");NotificationCenter.save(c,s);NotificationCenter.start(c);
        Intent intent=new Intent(c,NotificationSettingsActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Activity activity=instrument.startActivitySync(intent);instrument.waitForIdleSync();Thread.sleep(1000);
        Bitmap screenshot=instrument.getUiAutomation().takeScreenshot();
        try(FileOutputStream out=new FileOutputStream(new File(c.getExternalFilesDir(null),"notification-settings.png"))){screenshot.compress(Bitmap.CompressFormat.PNG,100,out);}
        instrument.runOnMainSync(activity::finish);instrument.waitForIdleSync();
    }
    @Test public void verifyBackgroundAlarmAndCaptureTray()throws Exception {
        Assume.assumeTrue("true".equals(InstrumentationRegistry.getArguments().getString("verifyBackground")));
        Instrumentation instrument=InstrumentationRegistry.getInstrumentation();Context c=instrument.getTargetContext();
        org.junit.Assert.assertTrue(java.util.Arrays.stream(c.getSystemService(NotificationManager.class).getActiveNotifications()).anyMatch(n->"background-preview".equals(n.getTag())));
        JSONObject s=NotificationCenter.state(c);
        org.junit.Assert.assertTrue(s.getJSONObject("seen").has("background-preview"));
        NotificationSyncTest.shell("cmd statusbar expand-notifications");Thread.sleep(700);
        Bitmap screenshot=instrument.getUiAutomation().takeScreenshot();
        try(FileOutputStream out=new FileOutputStream(new File(c.getExternalFilesDir(null),"notification-background.png"))){screenshot.compress(Bitmap.CompressFormat.PNG,100,out);}
        NotificationSyncTest.shell("cmd statusbar collapse");
    }
}
