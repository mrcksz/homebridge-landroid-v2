# Changelog
This is the change log for the plugin, all relevant changes will be listed here.

For documentation please see the [README](https://github.com/mrcksz/homebridge-landroid-v2/blob/master/README.md)

## 2.1.1
- The plugin is now **Homebridge Verified** — added the verified badge to the README
- Add donation links (`funding` in `package.json`), which enable the *♥ Donate* button on the plugin tile in the Homebridge UI

## 2.1.0
- New optional **Edge Cut switch** (`edgecut` config option): a momentary trigger button on the mower accessory (short name "Edge Cut") that starts a one-time border/edge cut (`{"sc":{"ots":{"bc":1,"wtm":0}}}`). It works regardless of whether the mower is currently mowing or at home, and auto-resets to off.
- Optional services (rain sensor / home sensor / PartyMode / Edge Cut) are now reconciled on every startup, so enabling or disabling them in the config also works for mowers restored from the HomeKit cache (previously they were only added when a mower was first created).
- The mower on/off switch is marked as the primary service so HomeKit keeps the extra switches grouped under the one mower accessory.
- Fix: `setPartyMode` now calls its HomeKit callback (avoids HomeKit warnings/timeouts).
- Fix: a latent bug in the old-mower cleanup that could skip entries (forEach + splice).

## 2.0.4
- `config.schema.json`: use standard JSON Schema `required` (array at object level, `["email", "pwd"]`) instead of the deprecated per-field `"required": true/false` shorthand

## 2.0.3
- Homebridge Verified check fixes:
  - `engines.node` now also allows Node 24
  - `config.schema.json`: wrap fields in a proper JSON schema (`type: object` + `properties`) and add the required `name` property
  - Convert template-literal `require()` calls to plain strings (removes a "dynamic require" false positive)
  - Remove the unused classic `aws-iot-device-sdk` dependency and bump `uuid` to v11 (fewer dependency vulnerabilities); remaining advisories are transitive dependencies of `aws-crt` (the official AWS IoT SDK required for the Worx MQTT connection)

## 2.0.2
- Harden error handling so plugin errors are caught and logged instead of crashing Homebridge:
  - Guard cloud startup (`onReady`) and the state/object update callbacks
  - Guard the periodic intervals (firmware, devices, token refresh, activity log)
  - Guard the MQTT `message`, `connect` and `resume` handlers and the auto-restart timer
- Remove the inherited (ioBroker) Sentry error-reporting code path; errors are now just logged locally (no analytics/tracking)

## 2.0.1
- Fix Homebridge 2.x crash: use `Service.Battery` instead of the removed `Service.BatteryService` alias

## 2.0.0
- v2 fork of the discontinued `homebridge-landroid`
- Fix broken MQTT connection: Worx removed the `GET /api/v2/users/me` route (now DELETE-only). User id / MQTT endpoint are now read from the `product-items` response instead
- Rename plugin to `homebridge-landroid-v2` (package name and Homebridge plugin identifier)

## 0.12.4
- Remove unneccessary library import

## 0.12.3
- Avoid creating empty [object Object] mower

## 0.12.2
- Update worx endpoint and upstream library

## 0.11.9
- PartyMode switch now properly reflects PartyMode state

## 0.11.8
- Attempt to fix party mode status

## 0.11.7
- Another attempt at fixing error state

## 0.11.6
- Fix reading of error state
- Update from upstream

## 0.11.5
- Better handle multiple mowers (upstream)

## 0.11.4
- Improve adapter to avoid unexpected timer issues

## 0.11.3
- More logging, try to avoid issues with two mowers (upstream)

## 0.11.2
- Fix party mode status

## 0.11.1
- Persist cloud data

## 0.11.0
- Save session data

## 0.10.12
- Fix in value setting (upstream)

## 0.10.11
- Fix in cloud object storage

## 0.10.10
- Add request counter (upstream)

## 0.10.9
- Better compatibility to connector code (store cloud data)

## 0.10.8
- Change client id / username from iobroker to homebridge

## 0.10.7
- Fix removing old mowers

## 0.10.6
- Small fixes in login sequence
- More debug output
- Bump node dependency

## 0.10.5
- Small value reading fixes from upstream (iobroker.worx)

## 0.10.4
- Fix setTimeout error

## 0.10.3
- Fix missing value names in log output

## 0.10.2
- Fix status display

## 0.10.1
- Fix battery display

## 0.10.0
- New cloud connector

## 0.9.9
- Fix cloud login (no data yet)

## 0.9.8
- Update worx library to fix 404 Error

## 0.9.7
- Update worx library

## 0.9.6
- Added optional home sensor

## 0.9.5
- fix for (untested) support for "Party Mode"

## 0.9.4
- cleanup logging (thanks andy-dinger!)
- add (untested) support for "Party Mode"

## 0.9.3
- add cloud parameter to config panel

## 0.9.2
- fix https error
- possibly allow using kress and landxcape models

## 0.9.1
- downgrade/fix version of iobroker.worx library to 1.0.2

## 0.9.0    
- added mowing data option (thanks andy-dinger!)
- small cleanups and UI improvements
- add development infos
## 0.8.1

- fix name of rain sensor

## 0.8.0
- automatic removal of old mowers

## 0.7.3
- add optional leak sensor for rain detection

## 0.7.2
- fix reachable

## 0.7.1
- fix naming

## 0.7.0
- add mower auto-discovery

## 0.6.6
- always show cloud reported mower names by default

## 0.6.5
- add debug mode with additional log output

## 0.6.3
- fix import crash
- README cleanups

## 0.6.2
- fix sending messages
- clean up configuration panel

## 0.6.1
- use iobroker.worx library (Fixes #10)
- use global worx account (Fixes #11)

## 0.6.0
- use global email/pwd (per-mower settings will still work)

## 0.5.3
- support config-ui-x settings panel

## 0.5.2
- update iobroker.Landroid-s library (Fixes Issue #2)

## 0.5.1
- fix contact sensor state issue

## 0.5.0
- update README
- cleanups

## 0.4.3
- fix on/off state update
- searching home == off

## 0.4.2
- add logging for incoming status changes

## 0.4.1
- fix crash when login data is invalid

## 0.4.0
- fix sending commands
- move error status to contact sensor for now

## 0.2.0
- add update callbacks to HomeKit on changes
- fix battery service
- add charging state

