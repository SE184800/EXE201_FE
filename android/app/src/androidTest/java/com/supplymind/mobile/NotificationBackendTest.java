package com.supplymind.mobile;

import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.*;
import java.io.*;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.junit.Assert.*;

/** Opt-in test against the loopback-only BE+SQL fixture via adb reverse tcp:18765. */
public class NotificationBackendTest {
    final Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();
    final NotificationManager manager=c.getSystemService(NotificationManager.class);
    JSONObject request(String path)throws Exception {
        // Test-only socket transport: no cleartext or alternate host is enabled in the APK.
        try(Socket socket=new Socket("127.0.0.1",18765)) {
            socket.setSoTimeout(20000);
            socket.getOutputStream().write(("GET "+path+" HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int size;
            while((size=socket.getInputStream().read(buffer))!=-1)out.write(buffer,0,size);
            String text=out.toString("UTF-8");int status=Integer.parseInt(text.split(" ")[1]);
            if(status!=200)throw new NotificationSync.ApiError(status);
            return new JSONObject(text.substring(text.indexOf("\r\n\r\n")+4));
        }
    }
    @Test public void realSqlAndApiChangesReachAndroidNotifications()throws Exception {
        Assume.assumeTrue("true".equals(InstrumentationRegistry.getArguments().getString("localBackend")));
        c.getSystemService(android.app.job.JobScheduler.class).cancel(NotificationCenter.JOB);
        if(Build.VERSION.SDK_INT>=33)NotificationSyncTest.shell("pm grant "+c.getPackageName()+" android.permission.POST_NOTIFICATIONS");
        NotificationCenter.prefs(c).edit().clear().putBoolean("introduced",true).commit();NotificationCenter.channels(c);manager.cancelAll();
        NotificationSync.Api api=new NotificationSync.Api() {
            public String cookie(){return "local-test-session";}
            public JSONObject get(String path,String ignored)throws Exception{return request(path);}
        };
        try {
            JSONObject info=request("/fixture/info");String id=info.getString("orderId");
            NotificationSync.sync(c,api);assertTrue(NotificationCenter.state(c).toString(),NotificationCenter.state(c).optBoolean("ordersReady"));
            assertTrue(NotificationCenter.state(c).optBoolean("walletReady"));
            assertTrue(NotificationCenter.state(c).toString().contains(info.getString("holidayName")));
            request("/fixture/shipping");NotificationSync.sync(c,api);
            assertTrue(Arrays.stream(manager.getActiveNotifications()).anyMatch(n->n.getTag().startsWith("shipping:"+id+":")));
            long tx=request("/fixture/topup").getLong("transactionId");NotificationSync.sync(c,api);NotificationSync.sync(c,api);
            assertTrue(Arrays.stream(manager.getActiveNotifications()).anyMatch(n->n.getTag().equals("transaction:"+tx)));
            JSONArray history=NotificationCenter.state(c).getJSONArray("history");int count=0;
            for(int i=0;i<history.length();i++)if(history.getJSONObject(i).optString("key").equals("transaction:"+tx))count++;
            assertEquals(1,count);
            request("/fixture/received");NotificationSync.sync(c,api);
            JSONArray pending=NotificationCenter.state(c).getJSONArray("pending");
            for(int i=0;i<pending.length();i++)assertFalse(pending.getJSONObject(i).optString("key").startsWith("delivery:"+id+":"));
            request("/fixture/logout");NotificationSync.sync(c,api);assertFalse(NotificationCenter.state(c).has("owner"));
        } finally {NotificationCenter.prefs(c).edit().putBoolean("auth_paused",true).commit();NotificationCenter.clearAccount(c);request("/fixture/cleanup");}
    }
}
