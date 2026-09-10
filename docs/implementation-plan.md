# Family Android Network Access Management System

This project implements a secure, server-authoritative Wi-Fi access management system. The system provisions Airtel Xstream Wi-Fi to family members' Android devices without revealing the password, and enforces configurable quotas (Data, Time, or both).

## Technical Feasibility & Android API Constraints

### 1. Usage Measurement vs Enforcement

**Authoritative Usage Reconciliation (`NetworkStatsManager`):**
Android's `NetworkStatsManager` API (API 23+) provides historical, bucketed usage statistics. We treat it as our **sole authoritative reconciliation source** for device-wide Wi-Fi accounting via `querySummaryForDevice(ConnectivityManager.TYPE_WIFI, ...)`. 
- **Standard Mode:** Requires `PACKAGE_USAGE_STATS` permission.
- **Device Owner Mode:** Provides stronger, seamless access.

**Accounting Model (Baseline/Delta):**
At session start, the device records a baseline Wi-Fi cumulative usage value. Subsequent `NetworkStatsManager` readings are converted into session usage by calculating the delta from the baseline. The app handles reboot resets by establishing a new baseline and adding future deltas to the ongoing session total. The backend receives these session usage reports and safely maintains an authoritative monotonic usage total, explicitly ignoring duplicate, overlapping, or out-of-order samples. We prioritize correctness over real-time artificial precision.

**Traffic Enforcement (Blackhole VPN):**
The `VpnService` is strictly the local blocking layer. When the quota is active, the VPN is disabled (or running in pass-through mode for DO lockdown). When exhausted, it drops all traffic (`0.0.0.0/0`).
- **VPN Authorization:** In Standard Mode, `VpnService.prepare()` authorization is explicitly requested during initial device setup, *before* any session is allowed. We do not assume it can be silently obtained later. Devices without VPN authorization are flagged as unprotected. In Device Owner mode, we utilize always-on and lockdown capabilities where supported.

### 2. Time Quota Enforcement

Time limits are server-authoritative but enforced locally via monotonic clocks. The backend issues `serverNow` and `expiresAt` timestamps. The Android client calculates the remaining duration and anchors the local deadline to Android's `SystemClock.elapsedRealtime()`. This guarantees time enforcement is completely immune to the user manually changing the device wall clock. The deadline is re-synchronized periodically during heartbeats.

### 3. Wi-Fi Provisioning

We use `WifiNetworkSuggestion` (API 29+) to provision the Wi-Fi credentials. 
> [!WARNING]
> **Limitations of WifiNetworkSuggestion**
> This mechanism does **not** grant unrestricted control over the user's saved Wi-Fi list. Removing a suggestion does not reliably disconnect an active connection. The **primary enforcement mechanism remains the Blackhole VPN**.

### 4. Background Execution & Persistence

- **Standard Mode:** We use a Foreground Service to maintain tracking. If a user explicitly force-stops the app from Settings, the service dies and won't restart automatically. FCM acts purely as a wake-up mechanism.
- **Device Owner Mode (Optional):** Provides strong anti-tampering via `DevicePolicyManager` (e.g., `setUninstallBlocked`, `DISALLOW_CONFIG_WIFI`).

### 5. Multiple Device Policy

Enforce a **1 USER -> 1 ACTIVE DEVICE** policy. If a user logs into a new device, the backend automatically revokes the session on the previous device, registers the new device, and logs the event.

## System Architecture

```mermaid
flowchart TD
    subgraph Backend [Backend & API]
        DB[(PostgreSQL)]
        API[Next.js API Routes]
        API <--> DB
        FCM_Server[Firebase Admin]
        API --> FCM_Server
    end

    subgraph Android App
        FCM_Client[FCM Receiver]
        FCM_Client -.-> |Wake-up / Command| Sync[Sync Service]
        Sync <--> |HTTPS Auth/State| API
        
        SessionManager[Session Manager]
        Sync --> SessionManager
        
        WifiManager[WifiManagerService]
        SessionManager --> |Suggest Credentials| WifiManager
        
        UsageTracker[UsageTrackerService\nNetworkStatsManager]
        UsageTracker --> |Periodic Heartbeat / Local Sync| Sync
        SessionManager -.-> |Check elapsedRealtime & Auth. Data| SessionManager
        
        VPN[EnforcementVpnService]
        SessionManager --> |Quota Exhausted| VPN
    end
    
    subgraph Device Owner Mode (Optional)
        DPM[DevicePolicyManager]
        DPM -.-> |Anti-Tampering / Usage Perms| Android App
    end
```

### Component Interactions (Final Review)
1. **Setup:** The app obtains `VpnService.prepare()` and `PACKAGE_USAGE_STATS` upfront. Without these, standard mode refuses to authorize the device.
2. **Wi-Fi Connection:** The app retrieves the encrypted Wi-Fi configuration from the backend, decrypts it locally, and uses `WifiNetworkSuggestion` to connect.
3. **Usage Measurement:** The Foreground Service takes an initial baseline reading from `NetworkStatsManager`. It periodically polls and calculates the cumulative session delta, accommodating device reboots. This delta is sent to the backend.
4. **Quota Calculation:** The backend applies the received delta to the authoritative monotonic usage total, rejecting overlaps/duplicates. Time quotas calculate duration relative to `SystemClock.elapsedRealtime()`.
5. **FCM Commands:** The backend sends wake-up commands via FCM. The app securely polls the backend for authoritative state.
6. **VPN Blocking:** The app starts the `EnforcementVpnService` to blackhole all traffic immediately when `NetworkStatsManager` reveals the data limit is breached, when `elapsedRealtime()` hits the calculated expiration, or when explicitly revoked.
7. **Offline Grace Period:** If the server is unreachable, the device relies on its local cached quota and remaining time. If the offline period exceeds a predefined threshold (e.g., 5 minutes), the session is suspended and the VPN block is engaged.
8. **Reboot Recovery:** Upon reboot (via `BOOT_COMPLETED`), the app reconstructs its state, establishes a new usage baseline, verifies authorization, and reapplies the Wi-Fi suggestion and VPN state.

## Proposed Changes

### Backend (Next.js / Prisma)
- **Database Schema:** Admin, User, Device, WifiCredential, Quota, Session, UsageSample, DeviceCommand, AuditLog.
- **API Routes:** 
  - `POST /api/auth/login`
  - `POST /api/device/heartbeat` (Handles usage deltas, returns `serverNow` & `expiresAt`)
  - Admin management endpoints.

### Android Application
- **`WifiManagerService`**: `WifiNetworkSuggestion`.
- **`UsageTrackerService`**: Handles baseline/delta model with `NetworkStatsManager`.
- **`EnforcementVpnService`**: Blackhole VPN. Authorized during setup.
- **`DeviceAdminReceiver`**: Optional receiver for Device Owner anti-tampering.

## Verification Plan

### Automated Tests
- Backend quota engine: Tests verifying delta processing, monotonic cumulative totals, duplicate rejection, and `serverNow`/`expiresAt` calculations.

### Manual Verification
1. Physical device testing of `WifiNetworkSuggestion` API.
2. Test Android upfront permission flow (`PACKAGE_USAGE_STATS` and `VpnService.prepare()`).
3. Verify time expiration triggers reliably relative to `elapsedRealtime()`, even if the device wall clock is altered.
4. Verify the baseline/delta usage engine: Stream video, reboot device, stream more video. Confirm the final byte count sent to the backend accurately sums both segments.
5. Verify the 1-device policy logic.
