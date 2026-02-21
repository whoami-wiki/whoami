const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

exports.default = async function notarize(context) {
  if (context.electronPlatformName !== "darwin") return;

  const keyId = process.env.ASC_KEY_ID;
  const issuerId = process.env.ASC_ISSUER_ID;
  const privateKeyBase64 = process.env.ASC_PRIVATE_KEY;

  if (!keyId || !issuerId || !privateKeyBase64) {
    console.log("  • skipping notarization  reason=ASC_KEY_ID, ASC_ISSUER_ID, or ASC_PRIVATE_KEY not set");
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  const zipPath = path.join(context.appOutDir, "notarize.zip");
  const keyPath = path.join(context.appOutDir, "notarize.p8");

  console.log(`  • notarizing  app=${appName}.app`);

  execSync(`ditto -c -k --keepParent "${appPath}" "${zipPath}"`);
  fs.writeFileSync(keyPath, Buffer.from(privateKeyBase64, "base64"));

  try {
    const result = execSync(
      `xcrun notarytool submit "${zipPath}" --key "${keyPath}" --key-id "${keyId}" --issuer "${issuerId}"`,
      { stdio: "pipe", encoding: "utf-8" }
    );
    process.stdout.write(result);

    const idMatch = result.match(/id:\s*([0-9a-f-]+)/);
    if (idMatch) {
      console.log(`  • notarization in progress — not waiting for Apple's verdict`);
      console.log(`  • check status: xcrun notarytool info ${idMatch[1]} --key <p8> --key-id ${keyId} --issuer ${issuerId}`);
    }
  } finally {
    fs.rmSync(zipPath, { force: true });
    fs.rmSync(keyPath, { force: true });
  }
};
