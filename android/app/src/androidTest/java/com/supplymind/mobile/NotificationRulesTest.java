package com.supplymind.mobile;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.*;
import java.time.Instant;
import java.util.*;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class NotificationRulesTest {
    long now=Instant.parse("2026-11-06T01:00:00Z").toEpochMilli();
    JSONObject order(String status,String time)throws Exception {
        return new JSONObject().put("id",42).put("status",status).put("total",100000).put("depositAmount",20000).put("depositStatus","NONE")
            .put("driverInfo",new JSONObject().put("estimatedDeliveryTime",time));
    }
    @Test public void parsesBothServerFormatsInVietnamTimeAndRejectsGuesses() {
        long expected=Instant.parse("2026-11-06T03:00:00Z").toEpochMilli();
        assertEquals(expected,NotificationRules.deliveryAt("Ngày 06/11/2026 lúc 10:00"));
        assertEquals(expected,NotificationRules.deliveryAt("10:00 ngày 06/11/2026"));
        assertEquals(0,NotificationRules.deliveryAt("10:00 ngày 31/02/2026"));
        assertEquals(0,NotificationRules.deliveryAt("Trong 30 - 45 phút tới"));
    }
    @Test public void schedulesBeforeAndAtConfirmedDeliveryAndUsesNewAcceptedTime()throws Exception {
        JSONArray rows=new JSONArray().put(order("SHIPPING","10:00 ngày 06/11/2026"));
        List<NotificationRules.Notice> result=NotificationRules.orders(rows,new JSONObject(),true,"STORE_OWNER",60,now);
        assertEquals(2,result.size());assertEquals(now+3600000,result.get(0).at);assertEquals(now+7200000,result.get(1).at);
        JSONArray changed=new JSONArray().put(order("SHIPPING","12:00 ngày 06/11/2026"));
        List<NotificationRules.Notice> later=NotificationRules.orders(changed,NotificationRules.orderState(rows),false,"STORE_OWNER",60,now);
        assertEquals(2,later.size());assertNotEquals(result.get(0).key,later.get(0).key);
    }
    @Test public void completedRejectedAndIssueOrdersNeverKeepDeliveryAlarms()throws Exception {
        for(String status:new String[]{"DELIVERED","COMPLETED","REJECTED","ISSUE_HANDLING"}) {
            assertTrue(NotificationRules.orders(new JSONArray().put(order(status,"10:00 ngày 06/11/2026")),new JSONObject(),true,"STORE_OWNER",60,now).isEmpty());
        }
    }
    @Test public void pendingRescheduleDoesNotReplaceConfirmedTime()throws Exception {
        JSONObject o=order("SHIPPING","10:00 ngày 06/11/2026");o.getJSONObject("driverInfo").put("rescheduleRequest",new JSONObject().put("status","PENDING").put("requestedTime","12:00 ngày 06/11/2026"));
        assertEquals(now+7200000,NotificationRules.orders(new JSONArray().put(o),new JSONObject(),true,"STORE_OWNER",60,now).get(1).at);
    }
    @Test public void firstSyncDoesNotAnnounceOldWalletHistoryAndRetriesUseSameKey()throws Exception {
        JSONArray rows=new JSONArray().put(new JSONObject().put("id",11).put("direction","CREDIT").put("amount",19000).put("typeLabel","Nạp ví"));
        assertTrue(NotificationRules.transactions(rows,0,true,"STORE_OWNER",now).isEmpty());
        assertTrue(NotificationRules.transactions(rows,11,false,"STORE_OWNER",now).isEmpty());
        assertEquals("transaction:11",NotificationRules.transactions(rows,10,false,"STORE_OWNER",now).get(0).key);
    }
    @Test public void onlyServerConfirmedPaymentAnnouncesSuccess()throws Exception {
        JSONObject old=order("SHIPPING","10:00 ngày 06/11/2026");old.put("depositStatus","PENDING");
        JSONObject state=NotificationRules.orderState(new JSONArray().put(old));
        JSONObject pending=new JSONObject(old.toString()).put("depositStatus","SUBMITTED");
        assertEquals(2,NotificationRules.orders(new JSONArray().put(pending),state,false,"STORE_OWNER",60,now).size());
        JSONObject paid=new JSONObject(old.toString()).put("depositStatus","PAID");
        List<NotificationRules.Notice> result=NotificationRules.orders(new JSONArray().put(paid),state,false,"STORE_OWNER",60,now);
        assertTrue(result.stream().anyMatch(n->"Tiền cọc đã được xác nhận".equals(n.title)));
    }
    @Test public void holidayReminderUsesEightAmVietnamAndServerDate()throws Exception {
        JSONArray holidays=new JSONArray().put(new JSONObject().put("name","Lễ thử từ máy chủ").put("startDate","2026-11-16"));
        List<NotificationRules.Notice> result=NotificationRules.holidays(holidays,now);
        NotificationRules.Notice n=result.stream().filter(x->x.key.equals("holiday:2026-11-16:7")).findFirst().get();
        assertEquals(Instant.parse("2026-11-09T01:00:00Z").toEpochMilli(),n.at);
    }
    @Test public void categoryReplacementRemovesCancelledOrderAlarms()throws Exception {
        JSONObject state=new JSONObject();
        List<NotificationRules.Notice> result=NotificationRules.orders(new JSONArray().put(order("SHIPPING","10:00 ngày 06/11/2026")),new JSONObject(),true,"STORE_OWNER",60,now);
        NotificationCenter.replaceCategory(state,"delivery",result);assertEquals(2,state.getJSONArray("pending").length());
        NotificationCenter.replaceCategory(state,"delivery",Collections.emptyList());assertEquals(0,state.getJSONArray("pending").length());
    }
}
