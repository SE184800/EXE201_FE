package com.supplymind.mobile;

import android.Manifest;
import android.app.*;
import android.app.job.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import org.json.*;
import java.util.*;

/** A single durable snapshot + one next alarm; cancellation replaces the whole schedule. */
public final class NotificationCenter {
    static final Object LOCK=new Object();
    static final String PREFS="supplymind_notifications_v1";
    static final int JOB=7401, ALARM=7402;
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS,Context.MODE_PRIVATE); }
    static JSONObject state(Context c) {
        try{return new JSONObject(prefs(c).getString("state","{}"));}catch(Exception e){return new JSONObject();}
    }
    static void put(JSONObject o,String key,Object value) {try{o.put(key,value);}catch(JSONException e){throw new IllegalArgumentException(e);}}
    static void save(Context c,JSONObject s) {
        if(!prefs(c).edit().putString("state",s.toString()).commit())throw new IllegalStateException("Không lưu được lịch thông báo.");
    }
    static boolean enabled(Context c,String category) {return prefs(c).getBoolean("enabled_"+category,true);}
    static boolean allowed(Context c) {
        return (Build.VERSION.SDK_INT<33 || ContextCompat.checkSelfPermission(c,Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED)
            && NotificationManagerCompat.from(c).areNotificationsEnabled();
    }
    static void channels(Context c) {
        if(Build.VERSION.SDK_INT<26)return;
        NotificationManager m=c.getSystemService(NotificationManager.class);
        String[][] types={{"delivery","Giao hàng"},{"payment","Thanh toán"},{"holiday","Ngày lễ"}};
        for(String[] t:types) {
            NotificationChannel ch=new NotificationChannel("sm_"+t[0],t[1],NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Thông báo "+t[1].toLowerCase(new Locale("vi","VN"))+" của SupplyMind AI");
            ch.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE); m.createNotificationChannel(ch);
        }
    }
    static boolean channelAllowed(Context c,String category) {
        if(!allowed(c)||!enabled(c,category))return false;
        if(Build.VERSION.SDK_INT<26)return true;
        NotificationChannel ch=c.getSystemService(NotificationManager.class).getNotificationChannel("sm_"+category);
        return ch!=null && ch.getImportance()!=NotificationManager.IMPORTANCE_NONE;
    }
    static void start(Context c) {
        channels(c);
        JobScheduler jobs=c.getSystemService(JobScheduler.class);
        if(jobs.getAllPendingJobs().stream().noneMatch(job->job.getId()==JOB))jobs.schedule(new JobInfo.Builder(JOB,new ComponentName(c,NotificationSyncJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).setPeriodic(15*60000L).build());
        synchronized(LOCK) {
            JSONObject s=state(c);
            if(!s.has("pending"))put(s,"pending",new JSONArray());
            replaceCategory(s,"holiday",NotificationRules.holidays(s.optJSONArray("holidays"),System.currentTimeMillis()));
            save(c,s); fire(c);
        }
    }
    static void replaceCategory(JSONObject s,String category,List<NotificationRules.Notice> next) {
        JSONArray out=new JSONArray(), old=s.optJSONArray("pending");
        if(old!=null)for(int i=0;i<old.length();i++) {
            JSONObject item=old.optJSONObject(i); if(item!=null && !category.equals(item.optString("category")))out.put(item);
        }
        for(NotificationRules.Notice n:next)if(category.equals(n.category))out.put(n.json());
        put(s,"pending",out);
    }
    static void clearAccount(Context c) {
        synchronized(LOCK) {
            JSONObject s=state(c); long generation=s.optLong("generation")+1;
            JSONObject oldSeen=NotificationRules.object(s,"seen"),holidaySeen=new JSONObject();
            Iterator<String> keys=oldSeen.keys();while(keys.hasNext()){String key=keys.next();if(key.startsWith("holiday:"))put(holidaySeen,key,oldSeen.optLong(key));}
            s=new JSONObject(); put(s,"generation",generation);
            put(s,"seen",holidaySeen);
            replaceCategory(s,"holiday",NotificationRules.holidays(null,System.currentTimeMillis()));
            put(s,"message","Đăng nhập app để theo dõi đơn và thanh toán.");
            save(c,s); NotificationManagerCompat.from(c).cancelAll(); schedule(c,s);
        }
    }
    static void refreshHolidays(Context c,JSONArray holidays) {
        synchronized(LOCK){JSONObject s=state(c);replaceCategory(s,"holiday",NotificationRules.holidays(holidays,System.currentTimeMillis()));save(c,s);fire(c);}
    }
    static void retireDeliveryNotifications(Context c,JSONArray orders,List<NotificationRules.Notice> next) {
        Set<String> valid=new HashSet<>();for(NotificationRules.Notice n:next)valid.add(n.key);
        Set<String> shipping=new HashSet<>();for(int i=0;i<orders.length();i++){JSONObject o=orders.optJSONObject(i);if(o!=null&&"SHIPPING".equals(o.optString("status")))shipping.add("shipping:"+o.optString("id")+":");}
        for(android.service.notification.StatusBarNotification active:c.getSystemService(NotificationManager.class).getActiveNotifications()) {
            String key=active.getTag();if(key==null)continue;
            if(key.startsWith("delivery:")&&!valid.contains(key))NotificationManagerCompat.from(c).cancel(key,1);
            if(key.startsWith("shipping:")&&shipping.stream().noneMatch(key::startsWith))NotificationManagerCompat.from(c).cancel(key,1);
        }
    }
    static PendingIntent alarmIntent(Context c) {
        return PendingIntent.getBroadcast(c,ALARM,new Intent(c,NotificationAlarmReceiver.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    static boolean exact(Context c) {return Build.VERSION.SDK_INT<31||c.getSystemService(AlarmManager.class).canScheduleExactAlarms();}
    static void setLead(Context c,int minutes) {
        if(!Arrays.asList(15,30,60,120).contains(minutes))return;
        synchronized(LOCK) {
            prefs(c).edit().putInt("lead",minutes).apply();JSONObject s=state(c);JSONArray rows=s.optJSONArray("pending");
            if(rows!=null)for(int i=0;i<rows.length();i++){JSONObject n=rows.optJSONObject(i);if(n==null)continue;
                String key=n.optString("key");if(key.startsWith("delivery:")&&key.endsWith(":before"))
                    put(n,"at",Math.max(System.currentTimeMillis(),n.optLong("expires")-minutes*60000L));
            }
            save(c,s);fire(c);
        }
    }
    static void schedule(Context c,JSONObject s) {
        AlarmManager alarms=c.getSystemService(AlarmManager.class);
        PendingIntent intent=alarmIntent(c); alarms.cancel(intent);
        if(!allowed(c))return;
        JSONArray rows=s.optJSONArray("pending"); JSONObject seen=NotificationRules.object(s,"seen");
        long next=Long.MAX_VALUE,now=System.currentTimeMillis();
        if(rows!=null)for(int i=0;i<rows.length();i++) {
            JSONObject o=rows.optJSONObject(i); if(o==null)continue;
            if(!seen.has(o.optString("key")) && o.optLong("expires")>now && channelAllowed(c,o.optString("category")))
                next=Math.min(next,o.optLong("at"));
        }
        if(next==Long.MAX_VALUE)return;
        next=Math.max(now+1000,next);
        try {if(exact(c))alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,intent);
            else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,intent);}
        catch(SecurityException denied) {alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,intent);}
    }
    static void fire(Context c) {
        synchronized(LOCK) {
            channels(c); JSONObject s=state(c),seen=NotificationRules.object(s,"seen");
            JSONArray rows=s.optJSONArray("pending"),history=s.optJSONArray("history"),keep=new JSONArray();
            if(history==null)history=new JSONArray();
            long now=System.currentTimeMillis(); int posted=0;
            if(rows!=null)for(int i=0;i<rows.length();i++) {
                JSONObject o=rows.optJSONObject(i);if(o==null)continue;
                String key=o.optString("key");
                if(o.optLong("expires")<=now||seen.has(key))continue;
                if(o.optLong("at")<=now&&channelAllowed(c,o.optString("category"))) {
                    NotificationRules.Notice n=NotificationRules.Notice.read(o);
                    // Keep all items in the history, coalesce a large catch-up into five tray entries.
                    if(posted<5)post(c,n); posted++;
                    put(seen,key,now); put(o,"shownAt",now); history.put(o);
                } else keep.put(o);
            }
            if(posted>5)post(c,new NotificationRules.Notice("catchup","payment","Có "+posted+" cập nhật mới",
                "Mở Thông báo để xem đầy đủ cập nhật giao hàng và thanh toán.","",now,now+NotificationRules.DAY));
            JSONArray recent=new JSONArray();for(int i=Math.max(0,history.length()-100);i<history.length();i++)recent.put(history.opt(i));
            List<String> remove=new ArrayList<>();Iterator<String> keys=seen.keys();while(keys.hasNext()){String k=keys.next();if(seen.optLong(k)<now-30*NotificationRules.DAY)remove.add(k);}
            for(String k:remove)seen.remove(k);
            put(s,"seen",seen);put(s,"pending",keep);put(s,"history",recent);save(c,s);schedule(c,s);
        }
    }
    static void post(Context c,NotificationRules.Notice n) {
        if(!channelAllowed(c,n.category))return;
        Intent open;
        if(n.path.isEmpty())open=new Intent(c,NotificationSettingsActivity.class);
        else open=new Intent(c,MainActivity.class).putExtra("notification_path",n.path);
        open.setData(Uri.parse("supplymind://notification/"+Uri.encode(n.key)));
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap=PendingIntent.getActivity(c,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification notification=new NotificationCompat.Builder(c,"sm_"+n.category).setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(n.title).setContentText(n.body).setStyle(new NotificationCompat.BigTextStyle().bigText(n.body))
            .setContentIntent(tap).setAutoCancel(true).setOnlyAlertOnce(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setColor(0xff287245).setCategory("delivery".equals(n.category)?NotificationCompat.CATEGORY_REMINDER:NotificationCompat.CATEGORY_STATUS).build();
        try{NotificationManagerCompat.from(c).notify(n.key,1,notification);}catch(SecurityException ignored){}
    }
    static void test(Context c,String category) {
        String title="Thông báo thử • "+("delivery".equals(category)?"Giao hàng":"payment".equals(category)?"Thanh toán":"Ngày lễ");
        long now=System.currentTimeMillis();post(c,new NotificationRules.Notice("test:"+category,category,title,
            "Thông báo thử của SupplyMind AI. Đây không phải giao dịch hay đơn hàng thật.","",now,now+60000));
    }
}
