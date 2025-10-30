// Runs after code signing. If Apple credentials are provided as env vars,
// notarize the app. Safe to no-op if not configured.

const { notarize } = require('@electron/notarize');

exports.default = async function notarizeHook(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const appleId = process.env.APPLE_ID;
  const appleIdPass = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPass || !teamId) {
    console.log('Skipping notarization: APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID not set');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`Notarizing ${appPath} ...`);
  await notarize({
    appBundleId: context.packager.appInfo.bundleId,
    appPath,
    appleId,
    appleIdPassword: appleIdPass,
    teamId,
    tool: 'notarytool',
  });
  console.log('Notarization complete.');
};


