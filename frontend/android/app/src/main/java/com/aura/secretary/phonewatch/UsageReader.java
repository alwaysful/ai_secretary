package com.aura.secretary.phonewatch;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Process;

/** UsageStatsManager로 현재 전면 앱 판별 */
public final class UsageReader {
    private UsageReader() {}

    /** 사용 정보 접근 권한 (설정 > 사용 정보 접근 허용) */
    @SuppressWarnings("deprecation")
    public static boolean granted(Context ctx) {
        AppOpsManager ops = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
        int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName())
            : ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName());
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    /**
     * 최근 windowMs 동안 마지막으로 전면에 온 앱. 이벤트 없으면 fallback 유지.
     */
    @SuppressWarnings("deprecation")
    public static String foreground(Context ctx, long windowMs, String fallback) {
        UsageStatsManager usm = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return fallback;
        long now = System.currentTimeMillis();
        UsageEvents events = usm.queryEvents(now - windowMs, now);
        UsageEvents.Event e = new UsageEvents.Event();
        String last = fallback;
        long lastTs = 0;
        while (events.hasNextEvent()) {
            events.getNextEvent(e);
            // MOVE_TO_FOREGROUND == ACTIVITY_RESUMED (1)
            if (e.getEventType() == UsageEvents.Event.MOVE_TO_FOREGROUND && e.getTimeStamp() >= lastTs) {
                last = e.getPackageName();
                lastTs = e.getTimeStamp();
            }
        }
        return last;
    }

    public static String label(Context ctx, String pkg) {
        try {
            PackageManager pm = ctx.getPackageManager();
            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(ai).toString();
        } catch (PackageManager.NameNotFoundException e) {
            return pkg;
        }
    }
}
