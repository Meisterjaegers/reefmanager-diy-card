# Changelog

## Unreleased

- Add pH history to the Multimate card from `/api/kh/history`; entries with `p` values are shown as a separate pH sparkline and averages.
- Add the Reefmanager pH history from `/api/ph/history.bin` with a separate sparkline and averages; the pH gradient is configurable on both cards.
- Add detailed, axis-labeled chart popups for temperature, KH, pH, and PO₄; load PO₄ history from `/api/po4/history` using its `po4` field.

## 1.1.0

- Show Multimate pH only when enabled and greater than zero; show PO4 only when greater than zero.
- Show Reefmanager pH only when the live status is successful and the value is greater than zero.
- Add configurable KH history range and display up to four consumption containers per row on mobile.
- Ignore zero-valued temperature and KH readings in the displays and histories.
- Document direct HACS-store installation and manual testing.

## 1.0.0

- Add separate Reefmanager and Multimate Lovelace cards.
- Display temperature and KH history with configurable color gradients.
- Show 24-hour and 7-day averages.
- Display reagent, waste, and dosing-container levels with fill gauges.
- Add visual-editor configuration, refresh interval, and history range options.
