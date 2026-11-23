package com.aura.secretary.phonewatch;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** 폰 감시 설정 (SharedPreferences). 서비스와 플러그인이 공유. */
public final class PhoneWatchConfig {
    private static final String PREFS = "phone_watch";

    /** 기본 딴짓 앱 */
    public static final Set<String> DEFAULT_PACKAGES = new HashSet<>(Arrays.asList(
        "com.google.android.youtube",
        "com.instagram.android",
        "com.zhiliaoapp.musically",
        "com.ss.android.ugc.trill",
        "com.netflix.mediaclient",
        "tv.twitch.android.app",
        "com.facebook.katana",
        "com.twitter.android",
        "com.reddit.frontpage",
        "com.nhn.android.webtoon",
        "com.naver.vapp",
        "tv.chzzk.app",
        "com.afreecatv.mobile"
    ));

    public String backendUrl;
    public Set<String> packages;
    /** true: PC 공부 세션 중에만 감시 */
    public boolean pcOnly;
    /** 사용자가 감시를 켰는지 (재부팅·재시작 복구용) */
    public boolean enabled;

    public static PhoneWatchConfig load(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        PhoneWatchConfig c = new PhoneWatchConfig();
        c.backendUrl = p.getString("backendUrl", "");
        c.packages = new HashSet<>(p.getStringSet("packages", DEFAULT_PACKAGES));
        c.pcOnly = p.getBoolean("pcOnly", true);
        c.enabled = p.getBoolean("enabled", false);
        return c;
    }

    public void save(Context ctx) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString("backendUrl", backendUrl == null ? "" : backendUrl)
            .putStringSet("packages", new HashSet<>(packages))
            .putBoolean("pcOnly", pcOnly)
            .putBoolean("enabled", enabled)
            .apply();
    }

    /** 끝 슬래시 제거한 백엔드 주소 */
    public String base() {
        String b = backendUrl == null ? "" : backendUrl.trim();
        while (b.endsWith("/")) b = b.substring(0, b.length() - 1);
        return b;
    }
}
