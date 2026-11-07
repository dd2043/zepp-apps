# zepp-apps

Custom Zepp OS apps for my Amazfit Cheetah (Square).

## Hello Cheetah

A hello-world app: greeting text plus a "Tap me" button with a tap counter.
Source is in [`hello-cheetah/`](hello-cheetah/), the ready-to-install package in [`packages/`](packages/).

### Install on the watch

1. In the Zepp app, turn on Developer Mode once: **Profile → Settings → About**, tap the Zepp logo 7 times.
2. Go to **Profile → Amazfit Cheetah (Square) → Developer Mode** (bottom of the page) **→ + → Scan**.
3. Scan this code. On the same phone, save the image and pick it with the gallery button on the Scan screen.

![Install QR](packages/qr-hello-cheetah.png)

If that one fails to download, try the backup code (same file, different host):

![Backup install QR](packages/qr-hello-cheetah-backup.png)

The app then shows up in the watch's app list as **Hello Cheetah**.

### Build notes

- Built with `@zeppos/zeus-cli` 1.9.3 (`zeus build`), Zepp OS API 3.0, square 390 × 450, NXP chipset.
- The package is patched to `packageInfo.mode = "preview"` with a long expiry so it installs from a plain `zpkd1://` link, with no Zepp developer account.
- Square assets must live in `assets/default.s/`.
- Keep code synchronous: Zepp OS 3.x on the Cheetah Square is reported to crash on background async work.
