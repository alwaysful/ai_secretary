package com.aura.secretary.phonewatch;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.json.JSONException;

/** JS ↔ 폰 감시 서비스 */
@CapacitorPlugin(
    name = "PhoneWatch",
    permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications") }
)
public class PhoneWatchPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        Context ctx = getContext();
        JSObject r = new JSObject();
        r.put("usageGranted", UsageReader.granted(ctx));
        r.put("notificationsGranted", NotificationManagerCompat.from(ctx).areNotificationsEnabled());
        r.put("running", PhoneWatchService.running);
        r.put("live", PhoneWatchService.live);
        String fg = PhoneWatchService.foreground;
        if (fg == null && UsageReader.granted(ctx)) fg = UsageReader.foreground(ctx, 60_000, null);
        r.put("foreground", fg);
        r.put("foregroundLabel", fg == null ? null : UsageReader.label(ctx, fg));
        call.resolve(r);
    }

    @PluginMethod
    public void openUsageSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
        } catch (RuntimeException e) {
            getContext().startActivity(appDetails());
        }
        call.resolve();
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
        } catch (RuntimeException e) {
            getContext().startActivity(appDetails());
        }
        call.resolve();
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
            resolveNotif(call);
            return;
        }
        requestPermissionForAlias("notifications", call, "notifCallback");
    }

    @PermissionCallback
    private void notifCallback(PluginCall call) {
        resolveNotif(call);
    }

    private void resolveNotif(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        call.resolve(r);
    }

    @PluginMethod
    public void getConfig(PluginCall call) {
        call.resolve(toJs(PhoneWatchConfig.load(getContext())));
    }

    @PluginMethod
    public void setConfig(PluginCall call) {
        PhoneWatchConfig c = PhoneWatchConfig.load(getContext());
        if (call.hasOption("backendUrl")) c.backendUrl = call.getString("backendUrl", "");
        if (call.hasOption("pcOnly")) c.pcOnly = Boolean.TRUE.equals(call.getBoolean("pcOnly", true));
        JSArray arr = call.getArray("packages", null);
        if (arr != null) {
            try {
                Set<String> s = new HashSet<>();
                for (String p : arr.<String>toList()) {
                    if (p != null && !p.trim().isEmpty()) s.add(p.trim());
                }
                c.packages = s;
            } catch (JSONException e) {
                call.reject("packages 형식 오류");
                return;
            }
        }
        c.save(getContext());
        call.resolve(toJs(c));
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (!UsageReader.granted(getContext())) {
            call.reject("사용 정보 접근 권한 필요", "NO_USAGE_PERMISSION");
            return;
        }
        PhoneWatchConfig c = PhoneWatchConfig.load(getContext());
        c.enabled = true;
        c.save(getContext());
        PhoneWatchService.start(getContext());
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        PhoneWatchConfig c = PhoneWatchConfig.load(getContext());
        c.enabled = false;
        c.save(getContext());
        PhoneWatchService.stop(getContext());
        call.resolve();
    }

    /** 실행 가능한 설치 앱 목록 */
    @PluginMethod
    public void listApps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        Intent main = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> infos = pm.queryIntentActivities(main, 0);
        Set<String> seen = new HashSet<>();
        List<JSObject> apps = new ArrayList<>();
        String self = getContext().getPackageName();
        for (ResolveInfo ri : infos) {
            String pkg = ri.activityInfo.packageName;
            if (pkg.equals(self) || !seen.add(pkg)) continue;
            JSObject a = new JSObject();
            a.put("package", pkg);
            a.put("label", ri.loadLabel(pm).toString());
            apps.add(a);
        }
        apps.sort((x, y) -> x.getString("label", "").compareToIgnoreCase(y.getString("label", "")));
        JSObject r = new JSObject();
        r.put("apps", new JSArray(apps));
        call.resolve(r);
    }

    private Intent appDetails() {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return i;
    }

    private static JSObject toJs(PhoneWatchConfig c) {
        JSObject r = new JSObject();
        r.put("backendUrl", c.backendUrl);
        r.put("packages", new JSArray(new ArrayList<>(c.packages)));
        r.put("pcOnly", c.pcOnly);
        r.put("enabled", c.enabled);
        return r;
    }
}
