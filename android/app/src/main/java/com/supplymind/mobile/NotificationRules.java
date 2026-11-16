package com.supplymind.mobile;

import org.json.JSONArray;
import org.json.JSONObject;
import java.text.NumberFormat;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.ResolverStyle;
import java.util.*;

/** Pure rules: only confirmed delivery times and server-confirmed payment states. */
public final class NotificationRules {
    static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    static final long DAY = 86400000L;
    static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm dd/MM").withZone(VN);
    static final Set<String> ACTIVE = new HashSet<>(Arrays.asList("APPROVED", "PREPARING", "SHIPPING"));

    public static final class Notice {
        public final String key, category, title, body, path;
        public final long at, expires;
        public Notice(String key, String category, String title, String body, String path, long at, long expires) {
            this.key=key; this.category=category; this.title=title; this.body=body; this.path=path; this.at=at; this.expires=expires;
        }
        JSONObject json() {
            try { return new JSONObject().put("key",key).put("category",category).put("title",title).put("body",body)
                .put("path",path).put("at",at).put("expires",expires); }
            catch (Exception e) { throw new IllegalArgumentException(e); }
        }
        static Notice read(JSONObject o) {
            return new Notice(o.optString("key"),o.optString("category"),o.optString("title"),o.optString("body"),
                o.optString("path"),o.optLong("at"),o.optLong("expires"));
        }
    }

    static JSONObject object(JSONObject parent, String key) {
        JSONObject value=parent.optJSONObject(key); return value==null ? new JSONObject() : value;
    }
    static long instant(String text) { try { return Instant.parse(text).toEpochMilli(); } catch(Exception e) { return 0; } }
    public static long deliveryAt(String text) {
        if (text==null || text.isEmpty()) return 0;
        // Both formats are emitted by the current supplier dispatch / accepted reschedule flows.
        for (String format : new String[]{"'Ngày 'dd/MM/uuuu' lúc 'HH:mm", "HH:mm' ngày 'dd/MM/uuuu"}) {
            try { return LocalDateTime.parse(text.trim(),DateTimeFormatter.ofPattern(format).withResolverStyle(ResolverStyle.STRICT)).atZone(VN).toInstant().toEpochMilli(); }
            catch(Exception ignored) {}
        }
        return instant(text); // Never guess a relative string such as '30–45 minutes'.
    }
    static String money(double value) { return NumberFormat.getIntegerInstance(new Locale("vi","VN")).format(value)+"đ"; }
    static boolean paid(JSONObject o) {
        JSONObject wallet=object(o,"walletPayment"), payment=object(object(o,"driverInfo"),"paymentInfo");
        return "CONFIRMED".equals(payment.optString("status")) ||
            (!wallet.optBoolean("refunded") && Arrays.asList("PAID","SETTLED").contains(wallet.optString("status"))
                && wallet.optDouble("amount",0)>=Math.max(0,o.optDouble("total",0)-("PAID".equals(o.optString("depositStatus"))?o.optDouble("depositAmount",0):0)) && o.optDouble("total",0)>0);
    }
    static String fingerprint(JSONObject o) {
        return o.optString("depositStatus")+":"+object(object(o,"driverInfo"),"paymentInfo").optString("status")+":"+
            object(o,"walletPayment").optString("status")+":"+object(o,"walletPayment").optBoolean("refunded");
    }

    public static List<Notice> orders(JSONArray orders, JSONObject previous, boolean baseline, String role, int leadMinutes, long now) {
        List<Notice> result=new ArrayList<>();
        boolean supplier="SUPPLIER".equals(role);
        String path=supplier?"/supplier/orders":"/store/orders";
        for(int i=0;i<orders.length();i++) {
            JSONObject o=orders.optJSONObject(i); if(o==null)continue;
            String id=o.optString("id"), status=o.optString("status"), order="Đơn #"+id;
            JSONObject old=previous.optJSONObject(id), driver=object(o,"driverInfo");
            long delivery=deliveryAt(driver.optString("estimatedDeliveryTime"));
            if(ACTIVE.contains(status) && delivery>0 && delivery+2*3600000>now && delivery<now+91*DAY) {
                long before=delivery-leadMinutes*60000L;
                if(delivery>now)result.add(new Notice("delivery:"+id+":"+delivery+":before","delivery","Sắp đến giờ giao • "+order,
                    "Dự kiến "+CLOCK.format(Instant.ofEpochMilli(delivery))+". "+(supplier?"Chuẩn bị giao hàng đúng lịch.":"Chuẩn bị nhận và kiểm tra hàng."),path,Math.max(now,before),delivery));
                result.add(new Notice("delivery:"+id+":"+delivery+":due","delivery","Đến giờ giao • "+order,
                    "Giờ hẹn "+CLOCK.format(Instant.ofEpochMilli(delivery))+". Mở đơn để kiểm tra tiến độ thực tế.",path,delivery,delivery+2*3600000));
            }
            if(!baseline && "SHIPPING".equals(status) && (old==null || !status.equals(old.optString("status"))))
                result.add(new Notice("shipping:"+id+":"+driver.optString("assignedAt"),"delivery",order+" đang được giao",
                    supplier?"Đơn đã chuyển sang trạng thái đang giao.":"Chủ vựa đã bàn giao đơn cho vận chuyển.",path,now,now+DAY));
            if(!baseline && (old==null || !fingerprint(o).equals(old.optString("payment")))) {
                String[] prior=(old==null?"":old.optString("payment")).split(":",-1);
                String previousDeposit=prior.length>0?prior[0]:"";
                String previousPayment=prior.length>1?prior[1]:"";
                String previousWallet=prior.length>2?prior[2]:"";
                boolean previousRefund=prior.length>3&&"true".equals(prior[3]);
                JSONObject payment=object(driver,"paymentInfo"),wallet=object(o,"walletPayment");
                String message=null;
                if(("REFUNDED".equals(o.optString("depositStatus"))&&!"REFUNDED".equals(previousDeposit)) || (wallet.optBoolean("refunded")&&!previousRefund)) message="Khoản thanh toán đã được hoàn";
                else if(paid(o) && (("CONFIRMED".equals(payment.optString("status"))&&!"CONFIRMED".equals(previousPayment)) || (!Arrays.asList("PAID","SETTLED").contains(previousWallet)&&Arrays.asList("PAID","SETTLED").contains(wallet.optString("status"))))) message="Thanh toán đã được xác nhận";
                else if(supplier && (("SUBMITTED".equals(o.optString("depositStatus"))&&!"SUBMITTED".equals(previousDeposit)) || ("PENDING_SUPPLIER_CONFIRM".equals(payment.optString("status"))&&!"PENDING_SUPPLIER_CONFIRM".equals(previousPayment)))) message="Có thanh toán cần đối chiếu";
                else if("PAID".equals(o.optString("depositStatus"))&&!"PAID".equals(previousDeposit)) message="Tiền cọc đã được xác nhận";
                if(message!=null) result.add(new Notice("payment:"+id+":"+fingerprint(o)+":"+o.optString("updatedAt"),"payment",message,
                    order+" • Mở đơn để xem chi tiết.",path,now,now+DAY));
            }
            if(!supplier && !paid(o) && "PENDING".equals(status) && "PENDING".equals(o.optString("depositStatus")) && o.optDouble("depositAmount",0)>0)
                result.add(new Notice("deposit-due:"+id,"payment",order+" đang chờ đặt cọc","Cần đặt cọc "+money(o.optDouble("depositAmount"))+" để tiếp tục đơn hàng.",path,now,now+DAY));
        }
        return result;
    }
    static JSONObject orderState(JSONArray orders) {
        JSONObject state=new JSONObject();
        try { for(int i=0;i<orders.length();i++) { JSONObject o=orders.getJSONObject(i);
            state.put(o.optString("id"),new JSONObject().put("status",o.optString("status")).put("payment",fingerprint(o))); } }
        catch(Exception e) { throw new IllegalArgumentException(e); }
        return state;
    }
    // Event notices must survive a sync while notification permission is disabled.
    // Scheduled reminders and action-required notices are rebuilt from the current snapshot.
    static JSONArray mergeOrderNotices(JSONArray pending,JSONArray orders,List<Notice> notices) {
        Set<String> shipping=new HashSet<>(),payments=new HashSet<>();
        for(int i=0;i<orders.length();i++) {
            JSONObject o=orders.optJSONObject(i);if(o==null)continue;
            String id=o.optString("id");
            if("SHIPPING".equals(o.optString("status")))shipping.add("shipping:"+id+":"+object(o,"driverInfo").optString("assignedAt"));
            payments.add("payment:"+id+":"+fingerprint(o)+":");
        }
        Map<String,JSONObject> merged=new LinkedHashMap<>();
        if(pending!=null)for(int i=0;i<pending.length();i++) {
            JSONObject n=pending.optJSONObject(i);if(n==null)continue;String key=n.optString("key");
            if(key.startsWith("delivery:")||key.startsWith("deposit-due:"))continue;
            if(key.startsWith("shipping:")&&!shipping.contains(key))continue;
            if(key.startsWith("payment:")&&payments.stream().noneMatch(key::startsWith))continue;
            merged.put(key,n);
        }
        for(Notice n:notices)merged.put(n.key,n.json());
        JSONArray out=new JSONArray();for(JSONObject n:merged.values())out.put(n);return out;
    }
    static List<Notice> transactions(JSONArray rows, long afterId, boolean baseline, String role, long now) {
        List<Notice> out=new ArrayList<>(); if(baseline)return out;
        for(int i=rows.length()-1;i>=0;i--) {
            JSONObject t=rows.optJSONObject(i); if(t==null || t.optLong("id")<=afterId)continue;
            String path="SUPPLIER".equals(role)?"/supplier/wallet":"/store/wallet";
            if("SUBSCRIPTION_PAYMENT".equals(t.optString("type")) && "DEBIT".equals(t.optString("direction"))) {
                out.add(new Notice("transaction:"+t.optString("id"), "payment", "Đã mua gói Basic",
                    "Đã trừ "+money(t.optDouble("amount"))+" từ ví. Mở ví để xem giao dịch.", path, now, now+DAY));
                continue;
            }
            String sign="CREDIT".equals(t.optString("direction"))?"+":"−";
            out.add(new Notice("transaction:"+t.optString("id"),"payment",t.optString("typeLabel","Cập nhật ví"),
                sign+money(t.optDouble("amount"))+" • "+("SANDBOX".equals(t.optString("method"))?"Giao dịch thử nghiệm. ":"")+"Mở ví để xem chi tiết.",
                path,now,now+DAY));
        }
        return out;
    }
    static List<Notice> holidays(JSONArray server, long now) {
        Map<String,String> dates=new TreeMap<>();
        int year=Instant.ofEpochMilli(now).atZone(VN).getYear();
        // Fixed solar dates only. Lunar events come from the store's configured server calendar.
        for(int y=year;y<=year+1;y++) {
            dates.put(y+"-01-01","Tết Dương lịch"); dates.put(y+"-04-30","Ngày 30/4");
            dates.put(y+"-05-01","Quốc tế Lao động"); dates.put(y+"-09-02","Quốc khánh");
            dates.put(y+"-11-20","Ngày Nhà giáo Việt Nam"); dates.put(y+"-12-25","Giáng sinh");
        }
        if(server!=null)for(int i=0;i<server.length();i++) {
            JSONObject h=server.optJSONObject(i);if(h==null)continue;
            String date=h.optString("startDate"),name=h.optString("name").trim();
            if(date.length()>=10)date=date.substring(0,10);
            if(name.isEmpty())continue;
            final String title=name;
            dates.merge(date,title,(existing,added)->Arrays.asList(existing.split(" / ")).contains(added)?existing:existing+" / "+added);
        }
        List<Notice> out=new ArrayList<>();
        for(Map.Entry<String,String> row:dates.entrySet())try {
            LocalDate day=LocalDate.parse(row.getKey());
            long dayEnd=day.plusDays(1).atStartOfDay(VN).toInstant().toEpochMilli();
            if(dayEnd<now || dayEnd>now+70*DAY)continue;
            for(int lead:new int[]{7,1}) {
                long at=day.minusDays(lead).atTime(8,0).atZone(VN).toInstant().toEpochMilli();
                if(at+DAY<now)continue;
                out.add(new Notice("holiday:"+row.getKey()+":"+lead,"holiday","Sắp tới "+row.getValue(),
                    "Ngày "+day.format(DateTimeFormatter.ofPattern("dd/MM"))+" • Kiểm tra tồn kho và kế hoạch nhập hàng.","",Math.max(now,at),at+DAY));
            }
        }catch(Exception ignored){}
        return out;
    }
}
