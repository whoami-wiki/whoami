const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

exports.default = async function notarize(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appleId = process.env.APPLE_ID;
  const password = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !password || !teamId) {
    console.log("  • skipping notarization  reason=APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID not set");
    return;
  }

  // Prevent electron-builder from also attempting its built-in notarization
  delete process.env.APPLE_TEAM_ID;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  const zipPath = path.join(context.appOutDir, "notarize.zip");

  console.log(`  • notarizing  app=${appName}.app`);

  execSync(`ditto -c -k --keepParent "${appPath}" "${zipPath}"`);

  try {
    execSync(
      `xcrun notarytool submit "${zipPath}" --apple-id "${appleId}" --password "${password}" --team-id "${teamId}" --wait`,
      { stdio: "inherit" }
    );
    execSync(`xcrun stapler staple "${appPath}"`, { stdio: "inherit" });
  } finally {
    fs.rmSync(zipPath, { force: true });
  }
};
