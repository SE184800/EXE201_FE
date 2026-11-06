package com.supplymind.mobile;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name="SupplyMindNotifications")
public class SupplyMindNotificationsPlugin extends Plugin {
    @Override public void load() {bridge.injectScriptBeforeLoad("supplymind-notifications.js");}
    private boolean trusted(PluginCall call) {
        Uri uri=Uri.parse(bridge.getWebView().getUrl()==null?"":bridge.getWebView().getUrl());
        if(!"https".equals(uri.getScheme())||!"supplymind-demo.vercel.app".equals(uri.getHost())) {call.reject("Trang không được phép.");return false;}return true;
    }
    @PluginMethod public void open(PluginCall call) {
        getActivity().runOnUiThread(()->{if(!trusted(call))return;getActivity().startActivity(new Intent(getContext(),NotificationSettingsActivity.class));call.resolve();});
    }
    @PluginMethod public void sync(PluginCall call) {
        getActivity().runOnUiThread(()->{if(!trusted(call))return;NotificationSync.request(getContext(),false);call.resolve();});
    }
    @PluginMethod public void session(PluginCall call) {
        getActivity().runOnUiThread(()->{
            if(!trusted(call))return;
            String action=call.getString("action","");
            if("logout".equals(action)) {
                NotificationCenter.prefs(getContext()).edit().putBoolean("auth_paused",true).apply();NotificationCenter.clearAccount(getContext());
            } else if("login".equals(action)||"ready".equals(action)) {
                NotificationCenter.prefs(getContext()).edit().putBoolean("auth_paused",false).apply();
                if("login".equals(action))NotificationCenter.clearAccount(getContext());
                NotificationSync.request(getContext(),true);
            }
            call.resolve();
        });
    }
    @PluginMethod public void target(PluginCall call) {
        getActivity().runOnUiThread(()->{if(!trusted(call))return;
            String path=getActivity() instanceof MainActivity?((MainActivity)getActivity()).consumeNotificationPath():"";
            call.resolve(new JSObject().put("path",path));
        });
    }
}
