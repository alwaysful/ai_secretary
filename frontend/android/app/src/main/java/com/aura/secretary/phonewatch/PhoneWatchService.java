package com.aura.secretary.phonewatch;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Random;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * 폰 감시 포그라운드 서비스.
 * 5초마다 전면 앱 확인 → 딴짓 앱이면 폰 알림 + 백엔드에 위반 기록.
 */
public class PhoneWatchService extends Service {
    public static final String ACTION_STOP = "com.aura.secretary.phonewatch.STOP";
    private static final String CH_WATCH = "phone_watch";
    private static final String CH_ALERT = "phone_alert";
    private static final int ID_WATCH = 1001;
    private static final int ID_ALERT = 1002;
    private static final long POLL_MS = 5_000;
    private static final long LIVE_MS = 30_000;
    /** 같은 앱 계속 쓰면 이 간격으로 다시 알림 */
    private static final long REPEAT_MS = 60_000;

    private static final String[] MESSAGES = {
        "%s 켜짐. 공부 중임. 끄셈.",
        "%s 보는 거 다 보임. 책 펴라.",
        "지금 %s 할 때 아님.",
        "%s 닫고 돌아와라. 기록됨.",
    };

    public static volatile boolean running = false;
    public static volatile String foreground = null;
    /** PC 공부 세션 진행 중 (백엔드 /study/live) */
    public static volatile boolean live = false;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Random random = new Random();
    private long liveCheckedAt = 0;
    private String flagged = null;
    private long lastAlertAt = 0;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            try {
                poll();
            } catch (RuntimeException ignored) {
                // 다음 주기에 재시도
            }
            handler.postDelayed(this, POLL_MS);
        }
    };

    public static void start(Context ctx) {
        Intent i = new Intent(ctx, PhoneWatchService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i);
        else ctx.startService(i);
    }

    public static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, PhoneWatchService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannels();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            PhoneWatchConfig c = PhoneWatchConfig.load(this);
            c.enabled = false;
            c.save(this);
            stopSelf();
            return START_NOT_STICKY;
        }
        int type = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
        ServiceCompat.startForeground(this, ID_WATCH, watchNotification(), type);
        if (!running) {
            running = true;
            liveCheckedAt = 0;
            handler.post(tick);
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        foreground = null;
        handler.removeCallbacks(tick);
        io.shutdownNow();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void poll() {
        PhoneWatchConfig cfg = PhoneWatchConfig.load(this);
        long now = System.currentTimeMillis();
        if (cfg.pcOnly && now - liveCheckedAt >= LIVE_MS) {
            liveCheckedAt = now;
            final String base = cfg.base();
            io.execute(() -> live = fetchLive(base));
        }

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        boolean screenOn = pm == null || pm.isInteractive();
        String pkg = screenOn && UsageReader.granted(this) ? UsageReader.foreground(this, 60_000, foreground) : null;
        foreground = pkg;

        boolean active = !cfg.pcOnly || live;
        if (pkg == null || !active || !cfg.packages.contains(pkg)) {
            flagged = null;
            return;
        }
        if (!pkg.equals(flagged)) {
            flagged = pkg;
            lastAlertAt = now;
            alert(cfg, pkg, true);
        } else if (now - lastAlertAt >= REPEAT_MS) {
            lastAlertAt = now;
            alert(cfg, pkg, false);
        }
    }

    /** 폰 알림. record=true 면 백엔드에 위반 1회 기록 */
    private void alert(PhoneWatchConfig cfg, String pkg, boolean record) {
        String label = UsageReader.label(this, pkg);
        String msg = String.format(MESSAGES[random.nextInt(MESSAGES.length)], label);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CH_ALERT)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("AURA 꼽")
            .setContentText(msg)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVibrate(new long[] {0, 300, 150, 300})
            .setAutoCancel(true)
            .setContentIntent(openApp());
        try {
            NotificationManagerCompat.from(this).notify(ID_ALERT, b.build());
        } catch (SecurityException ignored) {
            // 알림 권한 없음
        }
        if (!record) return;
        final String base = cfg.base();
        if (base.isEmpty()) return;
        io.execute(() -> postEvent(base, pkg, label));
    }

    private static boolean fetchLive(String base) {
        if (base.isEmpty()) return false;
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(base + "/study/live").openConnection();
            c.setConnectTimeout(5_000);
            c.setReadTimeout(5_000);
            if (c.getResponseCode() != 200) return false;
            try (InputStream in = c.getInputStream()) {
                byte[] buf = new byte[1024];
                int n = in.read(buf);
                String body = n > 0 ? new String(buf, 0, n, StandardCharsets.UTF_8) : "{}";
                return new JSONObject(body).optBoolean("active", false);
            }
        } catch (Exception e) {
            return false;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static void postEvent(String base, String pkg, String label) {
        HttpURLConnection c = null;
        try {
            JSONObject body = new JSONObject();
            body.put("package", pkg);
            body.put("label", label);
            c = (HttpURLConnection) new URL(base + "/study/phone-events").openConnection();
            c.setConnectTimeout(5_000);
            c.setReadTimeout(5_000);
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            try (OutputStream out = c.getOutputStream()) {
                out.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            c.getResponseCode();
        } catch (Exception ignored) {
            // 백엔드 꺼짐: 폰 알림만
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private PendingIntent openApp() {
        Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
        return PendingIntent.getActivity(this, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private android.app.Notification watchNotification() {
        Intent stop = new Intent(this, PhoneWatchService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 1, stop, PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CH_WATCH)
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setContentTitle("AURA 폰 감시 중")
            .setContentText("딴짓 앱 열면 꼽줌")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openApp())
            .addAction(0, "끄기", stopPi)
            .build();
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CH_WATCH, "폰 감시 상태", NotificationManager.IMPORTANCE_LOW));
        NotificationChannel alert = new NotificationChannel(CH_ALERT, "딴짓 경고", NotificationManager.IMPORTANCE_HIGH);
        alert.enableVibration(true);
        alert.setVibrationPattern(new long[] {0, 300, 150, 300});
        nm.createNotificationChannel(alert);
    }
}
