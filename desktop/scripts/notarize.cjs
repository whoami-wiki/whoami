const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const https = require("https");
const aws4 = require("aws4");

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

  console.log(`  • notarizing  app=${appName}.app`);

  execSync(`ditto -c -k --keepParent "${appPath}" "${zipPath}"`);

  try {
    const privateKey = crypto.createPrivateKey({
      key: Buffer.from(privateKeyBase64, "base64"),
      format: "pem",
    });

    const jwt = signJWT(keyId, issuerId, privateKey);
    const zipData = fs.readFileSync(zipPath);
    const sha256 = crypto.createHash("sha256").update(zipData).digest("hex");

    // Submit to Apple Notary API
    const submission = await apiRequest("POST", "/notary/v2/submissions", jwt, {
      submissionName: `${appName}.zip`,
      sha256,
    });

    const { id } = submission.data;
    const { bucket, object, accessKeyId, secretAccessKey, sessionToken } =
      submission.data.attributes;

    console.log(`  • notarization submitted  id=${id}`);

    // Upload zip to S3
    await s3Upload(zipData, {
      bucket,
      key: object,
      accessKeyId,
      secretAccessKey,
      sessionToken,
    });

    console.log(`  • uploaded to S3  submission=${id}`);
    console.log(`  • notarization in progress — not waiting for Apple's verdict`);
    console.log(`  • check status: xcrun notarytool info ${id} --key <p8> --key-id ${keyId} --issuer ${issuerId}`);
  } finally {
    fs.rmSync(zipPath, { force: true });
  }
};

// --- JWT ---

function signJWT(keyId, issuerId, privateKey) {
  const header = Buffer.from(
    JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" })
  ).toString("base64url");

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iss: issuerId, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" })
  ).toString("base64url");

  const sig = crypto
    .sign("SHA256", Buffer.from(`${header}.${payload}`), {
      key: privateKey,
      dsaEncoding: "ieee-p1363",
    })
    .toString("base64url");

  return `${header}.${payload}.${sig}`;
}

// --- Apple Notary REST API ---

function apiRequest(method, apiPath, jwt, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: "appstoreconnect.apple.com",
        path: apiPath,
        method,
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString();
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Notary API ${res.statusCode}: ${text}`));
            return;
          }
          resolve(JSON.parse(text));
        });
      }
    );
    req.on("error", reject);
    req.end(data);
  });
}

// --- S3 upload ---

function s3Upload(body, { bucket, key, accessKeyId, secretAccessKey, sessionToken }) {
  return new Promise((resolve, reject) => {
    const signed = aws4.sign(
      {
        service: "s3",
        region: "us-west-2",
        method: "PUT",
        path: `/${key}`,
        host: `${bucket}.s3.us-west-2.amazonaws.com`,
        headers: {
          "Content-Length": body.length,
          "Content-Type": "application/zip",
        },
        body,
      },
      { accessKeyId, secretAccessKey, sessionToken }
    );

    const req = https.request(
      {
        hostname: signed.host,
        path: signed.path,
        method: "PUT",
        headers: signed.headers,
      },
      (res) => {
        let chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`S3 upload ${res.statusCode}: ${Buffer.concat(chunks).toString()}`));
            return;
          }
          resolve();
        });
      }
    );
    req.on("error", reject);
    req.end(body);
  });
}
