package com.supplymind.mobile;
import android.content.*;
public class NotificationAlarmReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent) { NotificationCenter.fire(context); }
}
