package com.supplymind.mobile;

import android.app.*;
import android.content.*;
import android.os.*;
import android.service.notification.StatusBarNotification;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.*;
import org.junit.runner.RunWith;
import org.json.*;
import java.util.*;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class NotificationDeviceTest {
    Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();
    void shell(String command)throws Exception {
        try(ParcelFileDescriptor fd=InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
            java.io.InputStream in=new ParcelFileDescriptor.AutoCloseInputStream(fd)){byte[] data=new byte[1024];while(in.read(data)!=-1){}}
    }
    @Before public void prepare()throws Exception {
        if(Build.VERSION.SDK_INT>=33)shell("pm grant "+c.getPackageName()+" android.permission.POST_NOTIFICATIONS");
        NotificationCenter.prefs(c).edit().clear().putBoolean("auth_paused",true).putBoolean("introduced",true).commit();
        NotificationCenter.channels(c);c.getSystemService(NotificationManager.class).cancelAll();
    }
    @After public void cleanup(){NotificationCenter.clearAccount(c);}
    @Test public void actualTrayNotificationHasIconChannelAndTapActionAndDoesNotRepeat()throws Exception {
        long now=System.currentTimeMillis();
        NotificationRules.Notice n=new NotificationRules.Notice("device-test","delivery","Sắp giao đơn thử #42","Thông báo thử trên Android.","/store/orders",now,now+60000);
        JSONObject s=new JSONObject().put("owner","test").put("pending",new JSONArray().put(n.json()));NotificationCenter.save(c,s);
        NotificationCenter.fire(c);NotificationCenter.fire(c);
        StatusBarNotification[] active=c.getSystemService(NotificationManager.class).getActiveNotifications();
        assertEquals(1,active.length);assertNotNull(active[0].getNotification().contentIntent);
        assertNotNull(active[0].getNotification().getSmallIcon());
        if(Build.VERSION.SDK_INT>=26)assertEquals("sm_delivery",active[0].getNotification().getChannelId());
        assertEquals(1,NotificationCenter.state(c).getJSONArray("history").length());
    }
    @Test public void logoutClearsPrivateSchedulesAndVisibleNotifications()throws Exception {
        long now=System.currentTimeMillis();NotificationRules.Notice n=new NotificationRules.Notice("logout-test","payment","Đơn thử","Thanh toán thử","/store/wallet",now,now+60000);
        NotificationCenter.save(c,new JSONObject().put("owner","old-account").put("pending",new JSONArray().put(n.json())));NotificationCenter.fire(c);
        NotificationCenter.clearAccount(c);JSONObject s=NotificationCenter.state(c);
        assertFalse(s.has("owner"));assertFalse(s.has("history"));assertFalse(s.has("orders"));
        assertEquals(0,c.getSystemService(NotificationManager.class).getActiveNotifications().length);
        JSONArray pending=s.getJSONArray("pending");for(int i=0;i<pending.length();i++)assertEquals("holiday",pending.getJSONObject(i).getString("category"));
    }
    @Test public void alarmReceiverPostsWhileSettingsActivityIsClosed()throws Exception {
        if(Build.VERSION.SDK_INT>=31)shell("appops set "+c.getPackageName()+" SCHEDULE_EXACT_ALARM allow");
        long now=System.currentTimeMillis();NotificationRules.Notice n=new NotificationRules.Notice("alarm-test","delivery","Đến giờ giao • Đơn thử #42","Thông báo thử theo lịch trên Android.","/store/orders",now+1500,now+60000);
        JSONObject s=new JSONObject().put("pending",new JSONArray().put(n.json()));NotificationCenter.save(c,s);NotificationCenter.schedule(c,s);
        long deadline=now+15000;while(System.currentTimeMillis()<deadline&&c.getSystemService(NotificationManager.class).getActiveNotifications().length==0)Thread.sleep(250);
        assertEquals(1,c.getSystemService(NotificationManager.class).getActiveNotifications().length);
    }
    @Test public void changingLeadTimeReschedulesCachedReminderWithoutNetwork()throws Exception {
        long delivery=System.currentTimeMillis()+3*3600000;
        NotificationRules.Notice n=new NotificationRules.Notice("delivery:42:"+delivery+":before","delivery","Nhắc giao","Đơn thử","/store/orders",delivery-3600000,delivery);
        NotificationCenter.save(c,new JSONObject().put("pending",new JSONArray().put(n.json())));
        NotificationCenter.setLead(c,30);
        assertEquals(delivery-30*60000L,NotificationCenter.state(c).getJSONArray("pending").getJSONObject(0).getLong("at"));
    }
    @Test public void repeatedSignedOutChecksDoNotRepeatPublicHolidayAlerts()throws Exception {
        JSONObject seen=new JSONObject().put("holiday:2026-11-20:7",System.currentTimeMillis()).put("payment:old",System.currentTimeMillis());
        NotificationCenter.save(c,new JSONObject().put("seen",seen));NotificationCenter.clearAccount(c);NotificationCenter.clearAccount(c);
        JSONObject kept=NotificationCenter.state(c).getJSONObject("seen");assertTrue(kept.has("holiday:2026-11-20:7"));assertFalse(kept.has("payment:old"));
    }
}
