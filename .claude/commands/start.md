# Start Application

Run this Electron application with the following steps:

## Prerequisites Check

First, check if `node_modules` exists:
- If `node_modules` does NOT exist, follow the **Fresh Install** steps
- If `node_modules` exists, skip to **Run the App**

## Fresh Install

The `electron-rebuild` postinstall script has issues on Windows. Follow these exact steps:

1. **Install dependencies without running postinstall scripts:**
   ```bash
   npm install --ignore-scripts
   ```

2. **Manually run the Electron install script:**
   ```bash
   node node_modules/electron/install.js
   ```

3. **Build and run:**
   ```bash
   npm run start
   ```

## Run the App

If dependencies are already installed:
```bash
npm run start
```

## Troubleshooting

### "Electron failed to install correctly"
Run: `node node_modules/electron/install.js`

### node-pty build errors
The `postinstall` script runs `electron-rebuild -f -w node-pty` which can fail on Windows due to winpty build issues. Using `--ignore-scripts` during install bypasses this. The prebuilt node-pty binaries work fine without rebuilding.

### GPU cache errors
The errors about "Unable to move the cache" are non-fatal Chromium warnings and can be ignored. The app will still work.
