# Changelog

## 1.3.1

- Add a configurable PO₄ color gradient to the Multimate history chart.
- Smooth compact history sparklines while keeping detailed charts tied to the original measurement points.

## 1.3.0

- Warn when a measurement's latest history point is older than 24 hours.
- Show measurement values and timestamps when hovering over detailed chart points.
- Fit detailed charts to mobile screens and enlarge axis and hover labels on narrow displays.
- Make measurement tiles the same width and add a full-build preview with simulated device data.
- Replace the README screenshot with a desktop view of the full build.

## 1.2.0

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
