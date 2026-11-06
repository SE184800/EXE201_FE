package com.supplymind.mobile;
import android.content.Context;
import android.app.NotificationManager;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.*;
import org.json.*;
import static org.junit.Assert.*;
public class NotificationPermissionDeniedTest {
    @Test public void missingPermissionDoesNotConsumeOrCrashNotification()throws Exception {
        Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();
        Assume.assumeFalse(NotificationCenter.allowed(c));
        long now=System.currentTimeMillis();
        NotificationRules.Notice n=new NotificationRules.Notice("permission-test","payment","Thông báo thử","Chưa có quyền","",now,now+60000);
        NotificationCenter.save(c,new JSONObject().put("pending",new JSONArray().put(n.json())));
        NotificationCenter.fire(c);
        assertEquals(0,c.getSystemService(NotificationManager.class).getActiveNotifications().length);
        assertEquals(1,NotificationCenter.state(c).getJSONArray("pending").length());
        NotificationCenter.clearAccount(c);
    }
}
