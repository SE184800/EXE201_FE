package com.supplymind.mobile;

import android.content.Context;
import android.webkit.CookieManager;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/** Reads the existing authenticated API. Cookies never cross into page JavaScript or logs. */
public final class NotificationSync {
    static final String ORIGIN="https://supplymind-demo.vercel.app";
    interface Api {
        JSONObject get(String path,String cookie) throws Exception;
        String cookie();
    }
    private static final Api API=new Api() {
        public JSONObject get(String path,String cookie)throws Exception {return NotificationSync.get(path,cookie);}
        public String cookie(){return CookieManager.getInstance().getCookie(ORIGIN);}
    };
    static final ExecutorService EXECUTOR=Executors.newSingleThreadExecutor();
    private static long lastRequested;
    static synchronized void request(Context context, boolean force) {
        long now=System.currentTimeMillis(); if(!force&&now-lastRequested<10000)return;
        lastRequested=now;Context app=context.getApplicationContext();EXECUTOR.submit(()->sync(app));
    }
    static final class ApiError extends IOException {
        final int status;ApiError(int status){super("API "+status);this.status=status;}
    }
    static JSONObject get(String path,String cookie) throws Exception {
        if(Thread.currentThread().isInterrupted())throw new InterruptedException();
        HttpURLConnection connection=(HttpURLConnection)new URL(ORIGIN+path).openConnection();
        connection.setConnectTimeout(10000);connection.setReadTimeout(12000);connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Cookie",cookie);connection.setRequestProperty("Accept","application/json");
        try {
            int code=connection.getResponseCode(); if(code!=200)throw new ApiError(code);
            try(InputStream in=connection.getInputStream(); ByteArrayOutputStream out=new ByteArrayOutputStream()) {
                byte[] buffer=new byte[8192];int n;
                while((n=in.read(buffer))!=-1) {if(Thread.currentThread().isInterrupted())throw new InterruptedException();out.write(buffer,0,n);if(out.size()>4*1024*1024)throw new IOException("Dữ liệu quá lớn.");}
                return new JSONObject(out.toString(StandardCharsets.UTF_8.name()));
            }
        }finally{connection.disconnect();}
    }
    static JSONArray pages(Api api,String path,String key,String cookie,long afterId,boolean firstOnly) throws Exception {
        JSONArray out=new JSONArray();long deadline=System.currentTimeMillis()+90000;
        for(int page=1;page<=100;page++) {
            if(System.currentTimeMillis()>deadline)throw new IOException("Chưa tải đủ danh sách; thử đồng bộ lại.");
            JSONObject response=api.get(path+"?page="+page,cookie);JSONArray rows=response.optJSONArray(key);
            if(rows==null)throw new IOException("Dữ liệu chưa đúng định dạng.");
            boolean reached=false;
            for(int i=0;i<rows.length();i++) {JSONObject row=rows.getJSONObject(i);out.put(row);if(afterId>0&&row.optLong("id")<=afterId)reached=true;}
            if(!response.optBoolean("hasMore")||firstOnly||reached)return out;
        }
        throw new IOException("Danh sách quá dài; lịch cũ được giữ lại."); // Never replace schedules with a truncated page.
    }
    static void sync(Context c) {
        sync(c,API);
    }
    static void sync(Context c,Api api) {
        if(NotificationCenter.prefs(c).getBoolean("auth_paused",false))return;
        long generation;
        synchronized(NotificationCenter.LOCK){generation=NotificationCenter.state(c).optLong("generation");}
        String cookie=api.cookie();
        if(cookie==null||cookie.isEmpty()) {clearIfCurrent(c,generation);return;}
        try {
            JSONObject user=api.get("/api/auth/me",cookie).optJSONObject("user");
            if(user==null||user.optLong("id")<=0)throw new IOException("Chưa lấy được tài khoản.");
            String owner=user.optString("id"),role=user.optString("role");
            if(!Arrays.asList("STORE_OWNER","SUPPLIER","ADMIN").contains(role))throw new IOException("Vai trò chưa được hỗ trợ.");
            JSONObject initial;boolean baseline;long after;
            synchronized(NotificationCenter.LOCK) {
                initial=NotificationCenter.state(c);if(initial.optLong("generation")!=generation)return;
                baseline=!owner.equals(initial.optString("owner"))||!role.equals(initial.optString("role"))||!initial.optBoolean("walletReady");after=baseline?0:initial.optLong("transactionId");
            }
            JSONArray orders=null,transactions=null,holidays=null;
            List<String> warnings=new ArrayList<>();
            if(!"ADMIN".equals(role)) {
                try {orders=pages(api,"SUPPLIER".equals(role)?"/api/supplier/orders":"/api/orders","orders",cookie,0,false);}
                catch(ApiError e){if(e.status==401)throw e;warnings.add("Chưa cập nhật được đơn hàng");}
                catch(IOException e){warnings.add("Chưa tải đủ đơn hàng");}
                try {transactions=pages(api,"/api/wallet/transactions","transactions",cookie,after,baseline);}
                catch(ApiError e){if(e.status==401)throw e;warnings.add("Chưa cập nhật được ví");}
                catch(IOException e){warnings.add("Chưa tải đủ giao dịch ví");}
            }
            try {
                if("STORE_OWNER".equals(role))holidays=api.get("/api/advisor/calendar",cookie).optJSONArray("upcomingHolidays");
                else if("ADMIN".equals(role)) {
                    JSONArray all=api.get("/api/admin/holidays",cookie).optJSONArray("holidays");
                    if(all==null)throw new IOException("Dữ liệu ngày lễ chưa đúng định dạng.");
                    holidays=new JSONArray();
                    if(all!=null)for(int i=0;i<all.length();i++){JSONObject h=all.getJSONObject(i);if(h.optBoolean("isActive")){String date=h.optString("startDate");if(date.length()>=10)h.put("startDate",date.substring(0,10));holidays.put(h);}}
                }
            }catch(ApiError e){if(e.status==401)throw e;warnings.add("Ngày lễ đang dùng lịch dương có sẵn");}
            catch(IOException e){warnings.add("Ngày lễ đang dùng lịch đã lưu");}
            // A logout/login may have happened while network requests were in flight.
            if(!cookie.equals(api.cookie()))return;
            synchronized(NotificationCenter.LOCK) {
                JSONObject s=NotificationCenter.state(c);if(s.optLong("generation")!=generation)return;
                if(!owner.equals(s.optString("owner"))||!role.equals(s.optString("role"))) {
                    NotificationCenter.clearAccount(c);s=NotificationCenter.state(c);
                    NotificationCenter.put(s,"owner",owner);NotificationCenter.put(s,"role",role);
                }
                long now=System.currentTimeMillis();
                if(orders!=null) {
                    List<NotificationRules.Notice> notices=NotificationRules.orders(orders,NotificationRules.object(s,"orders"),!s.optBoolean("ordersReady"),role,NotificationCenter.prefs(c).getInt("lead",60),now);
                    NotificationCenter.retireDeliveryNotifications(c,orders,notices);
                    NotificationCenter.put(s,"pending",NotificationRules.mergeOrderNotices(s.optJSONArray("pending"),orders,notices));
                    NotificationCenter.put(s,"orders",NotificationRules.orderState(orders));NotificationCenter.put(s,"ordersReady",true);
                }
                if(transactions!=null) {
                    JSONArray pending=s.optJSONArray("pending");if(pending==null)pending=new JSONArray();
                    long high=s.optLong("transactionId");
                    for(NotificationRules.Notice n:NotificationRules.transactions(transactions,high,!s.optBoolean("walletReady"),role,now))pending.put(n.json());
                    for(int i=0;i<transactions.length();i++)high=Math.max(high,transactions.getJSONObject(i).optLong("id"));
                    NotificationCenter.put(s,"pending",pending);NotificationCenter.put(s,"transactionId",high);NotificationCenter.put(s,"walletReady",true);
                }
                if(holidays!=null) {NotificationCenter.put(s,"holidays",holidays);NotificationCenter.replaceCategory(s,"holiday",NotificationRules.holidays(holidays,now));}
                NotificationCenter.put(s,"initialized",true);NotificationCenter.put(s,"name",user.optString("name"));NotificationCenter.put(s,"lastSync",now);
                NotificationCenter.put(s,"message",warnings.isEmpty()?"Đã cập nhật lịch và giao dịch.":String.join(". ",warnings)+".");
                NotificationCenter.save(c,s);NotificationCenter.fire(c);
            }
        }catch(ApiError e) {
            if(e.status==401)clearIfCurrent(c,generation);else message(c,generation,"Chưa kết nối được máy chủ. Lịch đã lưu vẫn được giữ.");
        }catch(InterruptedException e){Thread.currentThread().interrupt();}
        catch(Exception e){message(c,generation,"Chưa đồng bộ được. Kiểm tra mạng và đăng nhập app; lịch đã lưu vẫn được giữ.");}
    }
    static void clearIfCurrent(Context c,long generation) {synchronized(NotificationCenter.LOCK){if(NotificationCenter.state(c).optLong("generation")==generation)NotificationCenter.clearAccount(c);}}
    static void message(Context c,long generation,String text) {synchronized(NotificationCenter.LOCK){JSONObject s=NotificationCenter.state(c);if(s.optLong("generation")==generation){NotificationCenter.put(s,"message",text);NotificationCenter.save(c,s);}}}
}
