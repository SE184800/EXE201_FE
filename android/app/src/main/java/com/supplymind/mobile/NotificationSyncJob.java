package com.supplymind.mobile;
import android.app.job.*;
import java.util.concurrent.Future;
public class NotificationSyncJob extends JobService {
    private Future<?> task;
    @Override public boolean onStartJob(JobParameters params) {
        task=NotificationSync.EXECUTOR.submit(()-> {
            synchronized(NotificationCenter.LOCK){NotificationCenter.refreshHolidays(this,NotificationCenter.state(this).optJSONArray("holidays"));}
            NotificationSync.sync(this); if(!Thread.currentThread().isInterrupted())jobFinished(params,false);
        });return true;
    }
    @Override public boolean onStopJob(JobParameters params) {if(task!=null)task.cancel(true);return true;}
}
