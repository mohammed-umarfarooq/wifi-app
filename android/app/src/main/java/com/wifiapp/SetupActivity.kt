package com.wifiapp

import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.wifiapp.utils.PermissionManager

class SetupActivity : AppCompatActivity() {
    private lateinit var tvVpnStatus: TextView
    private lateinit var tvUsageStatus: TextView
    private lateinit var btnFinishSetup: Button

    private val vpnLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        updateUI()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        tvVpnStatus = findViewById(R.id.tvVpnStatus)
        tvUsageStatus = findViewById(R.id.tvUsageStatus)
        btnFinishSetup = findViewById(R.id.btnFinishSetup)

        findViewById<Button>(R.id.btnRequestVpn).setOnClickListener {
            val intent = VpnService.prepare(this)
            if (intent != null) {
                vpnLauncher.launch(intent)
            }
        }

        findViewById<Button>(R.id.btnRequestUsage).setOnClickListener {
            startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        }

        btnFinishSetup.setOnClickListener {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }
    }

    override fun onResume() {
        super.onResume()
        updateUI()
    }

    private fun updateUI() {
        val vpnOk = PermissionManager.isVpnPrepared(this)
        val usageOk = PermissionManager.hasUsageStatsPermission(this)

        tvVpnStatus.text = "VPN Authorization: ${if (vpnOk) "OK" else "Missing"}"
        tvUsageStatus.text = "Usage Stats Access: ${if (usageOk) "OK" else "Missing"}"

        btnFinishSetup.isEnabled = vpnOk && usageOk
    }
}
