package com.supplymind.mobile;

import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.*;
import java.io.*;
import java.time.Instant;
import java.util.*;
import static org.junit.Assert.*;

/** Exercises the real sync/state/Android-notification pipeline with deterministic API failures. */
public class NotificationSyncTest {
    final Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();
    final NotificationManager manager=c.getSystemService(NotificationManager.class);
    FakeApi api;
    static class FakeApi implements NotificationSync.Api {
        long userId=41;
        String role="STORE_OWNER",cookie="account-41";
        JSONArray orders=new JSONArray(),transactions=new JSONArray(),holidays=new JSONArray();
        String failPath="";int failStatus=500;
        boolean brokenSecondOrderPage,logoutDuringRead;
        Context context;
        public String cookie(){return cookie;}
        public JSONObject get(String path,String ignored)throws Exception {
            if(!failPath.isEmpty()&&path.startsWith(failPath))throw new NotificationSync.ApiError(failStatus);
            if(path.equals("/api/auth/me"))return new JSONObject().put("user",new JSONObject().put("id",userId).put("role",role).put("name","Notification test"));
            if(path.startsWith("/api/orders?")||path.startsWith("/api/supplier/orders?")) {
                if(logoutDuringRead) {
                    NotificationCenter.prefs(context).edit().putBoolean("auth_paused",true).commit();
                    NotificationCenter.clearAccount(context);
                }
                if(brokenSecondOrderPage&&path.endsWith("page=2"))throw new IOException("offline on page two");
                return new JSONObject().put("orders",orders).put("hasMore",brokenSecondOrderPage);
            }
            if(path.startsWith("/api/wallet/transactions?"))return new JSONObject().put("transactions",transactions).put("hasMore",false);
            if(path.equals("/api/advisor/calendar"))return new JSONObject().put("upcomingHolidays",holidays);
            if(path.equals("/api/admin/holidays"))return new JSONObject().put("holidays",holidays);
            throw new AssertionError("Unexpected endpoint: "+path);
        }
    }
    static void shell(String command)throws Exception {
        try(ParcelFileDescriptor fd=InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
            InputStream in=new ParcelFileDescriptor.AutoCloseInputStream(fd)){byte[] buffer=new byte[1024];while(in.read(buffer)!=-1){}}
    }
    @Before public void prepare()throws Exception {
        c.getSystemService(android.app.job.JobScheduler.class).cancel(NotificationCenter.JOB);
        if(Build.VERSION.SDK_INT>=33)shell("pm grant "+c.getPackageName()+" android.permission.POST_NOTIFICATIONS");
        NotificationCenter.prefs(c).edit().clear().putBoolean("introduced",true).commit();
        NotificationCenter.channels(c);manager.cancelAll();api=new FakeApi();api.context=c;
    }
    @After public void cleanup(){NotificationCenter.prefs(c).edit().putBoolean("auth_paused",true).commit();NotificationCenter.clearAccount(c);}
    JSONObject order(String status)throws Exception {
        return new JSONObject().put("id",42).put("status",status).put("total",100000).put("depositStatus","NONE")
            .put("driverInfo",new JSONObject().put("estimatedDeliveryTime",Instant.ofEpochMilli(System.currentTimeMillis()+3*3600000).toString()).put("assignedAt","assignment-1"));
    }
    JSONObject transaction(long id)throws Exception {return new JSONObject().put("id",id).put("direction","CREDIT").put("amount",19000).put("typeLabel","Nạp ví");}
    boolean pendingPrefix(String key) {
        JSONArray pending=NotificationCenter.state(c).optJSONArray("pending");if(pending==null)return false;
        for(int i=0;i<pending.length();i++)if(pending.optJSONObject(i).optString("key").startsWith(key))return true;return false;
    }
    boolean tray(String key) {return Arrays.stream(manager.getActiveNotifications()).anyMatch(n->key.equals(n.getTag()));}
    @Test public void baselineSkipsHistoryThenNewLedgerEventAppearsExactlyOnce()throws Exception {
        api.transactions.put(transaction(10));NotificationSync.sync(c,api);assertFalse(tray("transaction:10"));
        api.transactions=new JSONArray().put(transaction(11)).put(transaction(10));
        NotificationSync.sync(c,api);NotificationSync.sync(c,api);
        assertTrue(tray("transaction:11"));
        JSONArray history=NotificationCenter.state(c).getJSONArray("history");
        int count=0;for(int i=0;i<history.length();i++)if("transaction:11".equals(history.getJSONObject(i).optString("key")))count++;
        assertEquals(1,count);
    }
    @Test public void disabledDeliveryChannelPreservesShippingEventAcrossSyncs()throws Exception {
        NotificationCenter.prefs(c).edit().putBoolean("enabled_delivery",false).commit();
        JSONObject o=order("PREPARING");api.orders.put(o);NotificationSync.sync(c,api);
        o.put("status","SHIPPING");NotificationSync.sync(c,api);NotificationSync.sync(c,api);
        assertTrue(pendingPrefix("shipping:42:"));
        NotificationCenter.prefs(c).edit().putBoolean("enabled_delivery",true).commit();NotificationCenter.fire(c);
        assertTrue(tray("shipping:42:assignment-1"));
    }
    @Test public void completedOrderCancelsCachedAndVisibleDeliveryNotices()throws Exception {
        JSONObject o=order("PREPARING");api.orders.put(o);NotificationSync.sync(c,api);
        o.put("status","SHIPPING");NotificationSync.sync(c,api);assertTrue(tray("shipping:42:assignment-1"));
        o.put("status","DELIVERED");NotificationSync.sync(c,api);
        assertFalse(pendingPrefix("delivery:42:"));assertFalse(tray("shipping:42:assignment-1"));
    }
    @Test public void incompletePaginationPreservesExistingSchedules()throws Exception {
        api.orders.put(order("SHIPPING"));NotificationSync.sync(c,api);assertTrue(pendingPrefix("delivery:42:"));
        api.orders=new JSONArray();api.brokenSecondOrderPage=true;NotificationSync.sync(c,api);
        assertTrue(pendingPrefix("delivery:42:"));assertTrue(NotificationCenter.state(c).optString("message").contains("Chưa tải đủ"));
    }
    @Test public void logoutDuringNetworkReadCannotRestorePrivateData()throws Exception {
        api.orders.put(order("SHIPPING"));api.logoutDuringRead=true;NotificationSync.sync(c,api);
        assertFalse(NotificationCenter.state(c).has("owner"));assertFalse(pendingPrefix("delivery:"));
    }
    @Test public void expiredSessionClearsPrivateSchedulesButTransientErrorKeepsThem()throws Exception {
        api.orders.put(order("SHIPPING"));NotificationSync.sync(c,api);
        api.failPath="/api/auth/me";NotificationSync.sync(c,api);assertTrue(pendingPrefix("delivery:"));
        api.failStatus=401;NotificationSync.sync(c,api);assertFalse(pendingPrefix("delivery:"));assertFalse(NotificationCenter.state(c).has("owner"));
    }
    @Test public void changingAccountDoesNotReplayOtherUsersWalletOrDelivery()throws Exception {
        api.orders.put(order("SHIPPING"));api.transactions.put(transaction(50));NotificationSync.sync(c,api);
        api.userId=77;api.cookie="account-77";api.orders=new JSONArray();api.transactions=new JSONArray().put(transaction(90));NotificationSync.sync(c,api);
        assertEquals("77",NotificationCenter.state(c).optString("owner"));assertFalse(pendingPrefix("delivery:"));assertFalse(tray("transaction:90"));
    }
    @Test public void failedFirstWalletReadDoesNotReplayHistoryOnRecovery()throws Exception {
        api.failPath="/api/wallet/transactions";api.transactions.put(transaction(100));NotificationSync.sync(c,api);
        assertFalse(NotificationCenter.state(c).optBoolean("walletReady"));
        api.failPath="";NotificationSync.sync(c,api);assertFalse(tray("transaction:100"));assertTrue(NotificationCenter.state(c).optBoolean("walletReady"));
    }
    @Test public void outdatedPaymentReviewIsRemovedBeforePermissionIsRestored()throws Exception {
        api.role="SUPPLIER";NotificationCenter.prefs(c).edit().putBoolean("enabled_payment",false).commit();
        JSONObject o=order("ISSUE_HANDLING").put("depositStatus","PAID");api.orders.put(o);NotificationSync.sync(c,api);
        o.getJSONObject("driverInfo").put("paymentInfo",new JSONObject().put("status","PENDING_SUPPLIER_CONFIRM"));NotificationSync.sync(c,api);
        o.getJSONObject("driverInfo").getJSONObject("paymentInfo").put("status","CONFIRMED");NotificationSync.sync(c,api);
        JSONArray pending=NotificationCenter.state(c).getJSONArray("pending");
        for(int i=0;i<pending.length();i++)assertNotEquals("Có thanh toán cần đối chiếu",pending.getJSONObject(i).optString("title"));
        NotificationCenter.prefs(c).edit().putBoolean("enabled_payment",true).commit();NotificationCenter.fire(c);
        assertTrue(Arrays.stream(manager.getActiveNotifications()).anyMatch(n->"Thanh toán đã được xác nhận".contentEquals(n.getNotification().extras.getCharSequence("android.title",""))));
    }
    @Test public void catchUpUsesEnabledCategoryEvenWhenPaymentsAreDisabled()throws Exception {
        NotificationCenter.prefs(c).edit().putBoolean("enabled_payment",false).commit();
        long now=System.currentTimeMillis();JSONArray pending=new JSONArray();
        for(int i=0;i<8;i++)pending.put(new NotificationRules.Notice("batch:"+i,"delivery","Nhắc giao thử","Thử nghiệm","",now,now+60000).json());
        NotificationCenter.save(c,new JSONObject().put("pending",pending));NotificationCenter.fire(c);
        assertTrue(tray("catchup:delivery"));assertEquals(8,NotificationCenter.state(c).getJSONArray("history").length());
    }
}
