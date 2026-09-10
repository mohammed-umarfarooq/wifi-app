package com.wifiapp.utils

import android.app.AppOpsManager
import android.content.Context
import android.net.VpnService
import android.os.Process
import android.provider.Settings

object PermissionManager {
    fun hasUsageStatsPermission(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    fun isVpnPrepared(context: Context): Boolean {
        // VpnService.prepare returns null if already prepared/authorized,
        // or an Intent to ask for permission if not.
        val intent = VpnService.prepare(context)
        return intent == null
    }
}
