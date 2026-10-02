const fs = require("node:fs/promises");
const path = require("node:path");
const JSZip = require("jszip");

(async () => {
  const zip = new JSZip();
  const directory = path.join(__dirname, "..", "chrome-extension");
  for (const file of [
    "manifest.json",
    "bridge.js",
    "worker.js",
    "gallery.js",
    "product-network.js",
    "product-data.js",
  ])
    zip.file(
      `mimitoys-chrome-helper/${file}`,
      await fs.readFile(path.join(directory, file)),
    );
  const destination = path.join(
    __dirname,
    "..",
    "public",
    "mimitoys-chrome-helper.zip",
  );
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(
    destination,
    await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
  );
  console.log("Created public/mimitoys-chrome-helper.zip");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
