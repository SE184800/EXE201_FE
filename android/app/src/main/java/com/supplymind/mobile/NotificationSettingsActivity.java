package com.supplymind.mobile;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.widget.*;
import androidx.core.view.*;
import androidx.core.graphics.Insets;
import org.json.*;
import java.time.Instant;

/** Native settings are shipped inside the APK and work even if the hosted site is offline. */
public class NotificationSettingsActivity extends Activity {
    private static final int TEXT_COLOR = 0xff1c3024;
    private static final ColorStateList CONTROL_TEXT = new ColorStateList(
        new int[][]{new int[]{-android.R.attr.state_enabled}, new int[]{}},
        new int[]{0xff526258, TEXT_COLOR});
    private LinearLayout content;
    private boolean syncing;
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    @Override public void onCreate(Bundle state){super.onCreate(state);NotificationCenter.start(this);}
    @Override public void onResume(){super.onResume();render();NotificationCenter.fire(this);}
    private TextView text(String value,int size,boolean bold) {
        TextView v=new TextView(this);v.setText(value);v.setTextSize(size);v.setTextColor(TEXT_COLOR);
        if(bold)v.setTypeface(null,android.graphics.Typeface.BOLD);v.setPadding(0,dp(7),0,dp(7));content.addView(v);return v;
    }
    private Button button(String label,Runnable click) {
        Button b=new Button(this);b.setText(label);b.setTextColor(CONTROL_TEXT);b.setBackgroundTintList(ColorStateList.valueOf(0xffdce8df));b.setAllCaps(false);content.addView(b,new LinearLayout.LayoutParams(-1,-2));b.setOnClickListener(v->click.run());return b;
    }
    private void render() {
        ScrollView scroll=new ScrollView(this);scroll.setBackgroundColor(0xfff4f7ef);
        // This screen has a fixed light surface, including when the phone uses dark mode.
        if(Build.VERSION.SDK_INT>=29)scroll.setForceDarkAllowed(false);
        content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);content.setPadding(dp(22),dp(12),dp(22),dp(28));scroll.addView(content);setContentView(scroll);
        WindowCompat.setDecorFitsSystemWindows(getWindow(),false);
        WindowCompat.getInsetsController(getWindow(),scroll).setAppearanceLightStatusBars(true);
        WindowCompat.getInsetsController(getWindow(),scroll).setAppearanceLightNavigationBars(true);
        ViewCompat.setOnApplyWindowInsetsListener(scroll,(v,insets)->{Insets safe=insets.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.displayCutout());v.setPadding(safe.left,safe.top,safe.right,safe.bottom);return WindowInsetsCompat.CONSUMED;});
        button("‹ Về ứng dụng",this::finish);
        text("Thông báo",30,true);text("Giao hàng, thanh toán và ngày lễ ngay trên thanh thông báo điện thoại.",15,false);
        boolean allowed=NotificationCenter.allowed(this);
        text(allowed?"✓ Đã bật thông báo":"Chưa bật quyền thông báo",18,true);
        button(allowed?"Cài đặt âm thanh và từng loại thông báo":"Bật thông báo",this::permission);
        text(NotificationCenter.exact(this)?"✓ Đã cho phép nhắc đúng giờ":"Nhắc giờ có thể bị trễ nếu điện thoại tiết kiệm pin.",14,false);
        if(Build.VERSION.SDK_INT>=31&&!NotificationCenter.exact(this))button("Cho phép nhắc đúng giờ giao",()->startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getPackageName()))));
        text("Nội dung nhận",20,true);
        String[][] categories={{"delivery","Đơn đang giao và giờ hẹn giao"},{"payment","Đặt cọc và cập nhật thanh toán"},{"holiday","Ngày lễ sắp tới"}};
        for(String[] category:categories){androidx.appcompat.widget.SwitchCompat toggle=new androidx.appcompat.widget.SwitchCompat(this);toggle.setText(category[1]);toggle.setTextColor(CONTROL_TEXT);toggle.setTextSize(16);toggle.setPadding(0,dp(12),0,dp(12));toggle.setChecked(NotificationCenter.enabled(this,category[0]));content.addView(toggle);
            toggle.setOnCheckedChangeListener((v,checked)->{NotificationCenter.prefs(this).edit().putBoolean("enabled_"+category[0],checked).apply();NotificationCenter.fire(this);});}
        text("Nhắc trước giờ giao",18,true);
        RadioGroup leads=new RadioGroup(this);leads.setOrientation(LinearLayout.HORIZONTAL);
        for(int value:new int[]{15,30,60,120}) {RadioButton b=new RadioButton(this);b.setText(value+" phút");b.setTextColor(CONTROL_TEXT);b.setTextSize(12);b.setId(value);leads.addView(b,new RadioGroup.LayoutParams(0,-2,1));}
        leads.check(NotificationCenter.prefs(this).getInt("lead",60));content.addView(leads);
        leads.setOnCheckedChangeListener((group,id)->{NotificationCenter.setLead(this,id);NotificationSync.request(this,true);});
        text("Nhắc thêm lúc đến giờ hẹn. Ngày lễ nhắc lúc 08:00, trước 7 ngày và 1 ngày (giờ Việt Nam).",14,false);
        JSONObject s; synchronized(NotificationCenter.LOCK){s=NotificationCenter.state(this);}
        text("Đồng bộ",20,true);
        if(!s.optString("name").isEmpty())text("Tài khoản: "+s.optString("name"),15,true);
        text(s.optString("message","Đăng nhập ứng dụng để theo dõi đơn và thanh toán."),14,false);
        if(s.optLong("lastSync")>0)text("Lần kiểm tra gần nhất: "+NotificationRules.CLOCK.format(Instant.ofEpochMilli(s.optLong("lastSync"))),13,false);
        text("Khi đóng app, cập nhật mới được kiểm tra định kỳ khoảng 15 phút và có thể trễ hơn do tiết kiệm pin. Cần mạng và phiên đăng nhập còn hiệu lực. Lịch giao đã lưu vẫn nhắc khi không có mạng.",14,false);
        text("Nếu đơn đổi lịch khi máy mất mạng, thông báo có thể theo lịch cũ cho tới lần đồng bộ tiếp theo. Mở app để kiểm tra tiến độ mới nhất.",13,false);
        Button sync=button(syncing?"Đang kiểm tra…":"Cập nhật ngay",()->{syncing=true;render();NotificationSync.EXECUTOR.submit(()->{NotificationSync.sync(getApplicationContext());runOnUiThread(()->{if(!isFinishing()){syncing=false;render();}});});});sync.setEnabled(!syncing);
        text("Thử trên thanh thông báo",20,true);
        for(String[] category:categories)button("Thử: "+category[1],()->{if(!NotificationCenter.channelAllowed(this,category[0])){Toast.makeText(this,"Bật quyền và loại thông báo này trước.",Toast.LENGTH_LONG).show();return;}NotificationCenter.test(this,category[0]);Toast.makeText(this,"Đã gửi thông báo thử. Vuốt từ trên xuống để xem.",Toast.LENGTH_LONG).show();});
        text("Sắp nhắc",20,true);
        JSONArray pending=s.optJSONArray("pending");int count=0;
        if(pending!=null)for(int i=0;i<pending.length()&&count<20;i++){JSONObject n=pending.optJSONObject(i);if(n==null||!NotificationCenter.enabled(this,n.optString("category")))continue;
            text(n.optString("title"),16,true);text(NotificationRules.CLOCK.format(Instant.ofEpochMilli(n.optLong("at")))+" · "+n.optString("body"),14,false);count++;}
        if(count==0)text("Chưa có lịch nhắc sắp tới. Đơn cần có ngày và giờ giao cụ thể.",14,false);
        text("Gần đây",20,true);JSONArray history=s.optJSONArray("history");
        if(history==null||history.length()==0)text("Thông báo đã gửi sẽ xuất hiện ở đây.",14,false);
        else for(int i=history.length()-1;i>=Math.max(0,history.length()-20);i--){JSONObject n=history.optJSONObject(i);if(n==null)continue;text(n.optString("title"),16,true);text(n.optString("body"),14,false);}
        button("Mở VIP demo đã có",()->startActivity(new Intent(this,VipDemoActivity.class)));
    }
    private void permission() {
        if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED
            &&!NotificationCenter.prefs(this).getBoolean("permission_requested",false)) {
            NotificationCenter.prefs(this).edit().putBoolean("permission_requested",true).apply();requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},93);
        }else if(Build.VERSION.SDK_INT>=26)startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()));
        else startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName())));
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);NotificationCenter.fire(this);render();}
}
