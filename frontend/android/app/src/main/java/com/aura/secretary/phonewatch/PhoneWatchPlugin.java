package com.aura.secretary.phonewatch;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
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
        r.put("batteryUnrestricted", batteryUnrestricted(ctx));
        r.put("samsung", "samsung".equalsIgnoreCase(Build.MANUFACTURER));
        String fg = PhoneWatchService.foreground;
        if (fg == null && UsageReader.granted(ctx)) fg = UsageReader.foreground(ctx, 60_000, null);
        r.put("foreground", fg);
        r.put("foregroundLabel", fg == null ? null : UsageReader.label(ctx, fg));
        call.resolve(r);
    }

    /** 사용 정보 접근: 가능하면 AURA 항목으로 바로 이동 (삼성 One UI 지원) */
    @PluginMethod
    public void openUsageSettings(PluginCall call) {
        Intent direct = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, pkgUri());
        Intent list = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        open(call, direct, list, appDetails());
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        open(call, i, appDetails());
    }

    /** 앱 정보 (삼성: 배터리 → 제한 없음, 사용하지 않는 앱 일시정지 해제) */
    @PluginMethod
    public void openAppDetails(PluginCall call) {
        open(call, appDetails());
    }

    /** 시스템 팝업 한 번으로 배터리 최적화 제외 (삼성: 제한 없음) */
    @PluginMethod
    public void requestBatteryUnrestricted(PluginCall call) {
        if (batteryUnrestricted(getContext())) {
            call.resolve();
            return;
        }
        Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkgUri());
        open(call, i, new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS), appDetails());
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
        // 두 번 거절하면 팝업이 안 뜬다 → 알림 설정으로
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(i);
            } catch (RuntimeException ignored) {
                // 무시
            }
        }
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

    /** PC 화면 QR (aura://setup?api=...) 로 열렸을 때 */
    @Override
    public void load() {
        if (getActivity() != null) handleSetupIntent(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        handleSetupIntent(intent);
    }

    private void handleSetupIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri u = intent.getData();
        if (!"aura".equals(u.getScheme()) || !"setup".equals(u.getHost())) return;
        String api = u.getQueryParameter("api");
        if (api == null || !(api.startsWith("http://") || api.startsWith("https://"))) return;
        PhoneWatchConfig c = PhoneWatchConfig.load(getContext());
        c.backendUrl = api;
        c.save(getContext());
        JSObject r = new JSObject();
        r.put("backendUrl", c.base());
        notifyListeners("setup", r, true);
    }

    private static boolean batteryUnrestricted(Context ctx) {
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
    }

    private Uri pkgUri() {
        return Uri.parse("package:" + getContext().getPackageName());
    }

    /** 앞에서부터 열리는 화면 시도 */
    private void open(PluginCall call, Intent... intents) {
        for (Intent i : intents) {
            i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(i);
                call.resolve();
                return;
            } catch (RuntimeException ignored) {
                // 다음 후보
            }
        }
        call.reject("설정 화면을 열 수 없음");
    }

    private Intent appDetails() {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
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
