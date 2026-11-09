# AquaGrow Sentinel (Frontend, Phase 1)

React + Vite UI prototype. All data lives in browser localStorage (key `aqs_db_v1`) and a timer simulates ESP32 readings.

```
npm install
npm run dev      # http://localhost:5173
npm run build
```

Demo logins: owner@aquagrow.ph / Owner123 · staff@aquagrow.ph / Staff123 · viewer@aquagrow.ph / Viewer123

Structure: `src/data` (constants, seed data, status logic) · `src/hooks/useDB.js` (storage + live simulation) · `src/components` (Login, Dashboard, Chart, ComingSoon).

## Phase 2 – Farm Management
Add / edit / view / delete farms, gardens and ponds; crop or species; ESP32 and sensor assignment (an ESP32 can serve up to 2 areas in this prototype); per-area thresholds. Owner: everything. Staff: areas only (no farm edit, no delete). Viewer: view only. Every change is written to `logs` in localStorage for the Phase 6 activity log.

## Phase 3 – Devices & Sensors
Tabs: Devices (ID, status, last seen, battery/voltage, Wi-Fi, firmware, uptime, areas, maintenance), Sensors (registry, GPIO pin, connection, live reading, calibration, last reading) and Pin map (occupied / available / reserved GPIOs per board). Register/edit: Owner + Staff. Delete: Owner. "Simulate" buttons stand in for real hardware.

## Phase 4 – Alerts & Notifications
The engine (`runEngine` in `src/data/db.js`) runs on every simulated reading and every data change. It creates one incident per ongoing problem (reading out of range, device offline, sensor fault), escalates unacknowledged critical alerts to the owner (2 min demo timer), auto-resolves on recovery and sends recovery notices. Alerts page: acknowledge, assign, remarks/actions, resolve (5-minute quiet period), reopen. Notifications page: filters, mark as read, delivery status, per-user preferences. Push is simulated with an on-screen banner. Staff-per-farm routing arrives with Phase 7.

## Phase 5 – Irrigation & Pump Control
One pump per garden. ON/OFF always goes through a confirmation dialog and stays "pending" until the (simulated) ESP32 confirms it; if the device is offline the command fails after 8 s and owners/staff are notified. Manual run with duration, automatic mode (starts below the area's warning level, stops at a target), schedules, maximum runtime cut-off, emergency stop with lock (Owner resets), session and command history. Owner + Staff only.

## Phase 6 – History, Activity Logs, Reports
History: sensor readings (filter by sensor type, area and date, chart + table, CSV), alert history (severity, status, area, date; times, handler, actions taken) and an Owner-only activity log. Reports: soil moisture, water quality, alerts, device performance, maintenance and farm summary for daily / weekly / monthly / yearly / custom periods, with average/min/max, charts, and PDF, Excel and CSV export. Readings are stored as hourly (31 days) and daily (400 days) summaries; data from before first use is generated sample data.

## Phase 7 – Users, Account, Settings
**My Account:** profile (name, email, phone), picture upload, password change (policy: 8+ chars, letter + number), notification preferences, your access summary.
**Users & Access (Owner):** add / disable / remove users, roles, farm assignment (staff and viewers only see their assigned farms), per-user permissions for staff, temporary passwords that must be changed at first sign-in, per-user activity log, protection against removing the last owner.
**Settings:** application settings (escalation time, confirmation before hardware commands), default and per-area thresholds with a history of previous settings, sensor calibration, maintenance mode and maintenance records (battery, cleaning, calibration, repair), sync status with manual sync, database backup (JSON download) and restore, app and firmware versions.
Passwords are stored as salted SHA-256 hashes in localStorage for the prototype. A real backend must use bcrypt/argon2 and server-side sessions.

## Phase 8 – System reliability and data validation
All readings pass the pipeline in `src/data/ingest.js`: device authentication (per-device key), duplicate blocking, format / range checks, sudden-change flagging, stale-sensor detection and timestamp checks. Rejected and flagged readings are listed on **System Health**. Devices that lose Wi-Fi retry automatically with back-off; firmware 1.2.0+ keeps readings in a local buffer and sends them (with their original timestamps) after reconnecting, older firmware loses data. Key rotation and provisioning show device authentication end to end. Last received reading time appears on the Dashboard and on the Sensors tab.
