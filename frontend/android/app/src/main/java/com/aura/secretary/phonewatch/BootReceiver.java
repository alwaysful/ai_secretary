package com.aura.secretary.phonewatch;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 재부팅 후 감시가 켜져 있었으면 다시 시작 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        PhoneWatchConfig c = PhoneWatchConfig.load(ctx);
        if (c.enabled && UsageReader.granted(ctx)) {
            try {
                PhoneWatchService.start(ctx);
            } catch (RuntimeException ignored) {
                // Android 15+: 부팅 시 specialUse 시작 제한될 수 있음
            }
        }
    }
}
