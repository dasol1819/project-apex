// SPDX-License-Identifier: MIT
// Basis Universal transcoder, vendored with Three.js r180 (Apache-2.0 / MIT).
// One worker lives only while the shared Su-35 surface atlas is transcoded.
importScripts("./vendor/basis/basis_transcoder.js");
let ready;
self.onmessage = async ({ data }) => {
  let file;
  try {
    const module = await (ready ??= BASIS({
      locateFile: (name) =>
        new URL("./vendor/basis/" + name, self.location.href).href,
    }).then((m) => {
      m.initializeBasis();
      return m;
    }));
    file = new module.KTX2File(new Uint8Array(data.buffer));
    if (
      !file.isValid() ||
      !file.isUASTC() ||
      file.getWidth() !== 4096 ||
      file.getHeight() !== 4096 ||
      file.getFaces() !== 1 ||
      !file.getHasAlpha()
    )
      throw Error("Invalid Su-35 surface atlas");
    if (!file.startTranscoding())
      throw Error("Surface transcoder could not start");
    const mipmaps = [],
      buffers = [];
    for (let level = 0; level < file.getLevels(); level++) {
      const info = file.getImageLevelInfo(level, 0, 0);
      const pixels = new Uint8Array(
        file.getImageTranscodedSizeInBytes(level, 0, 0, data.transcoder),
      );
      if (!file.transcodeImage(pixels, level, 0, 0, data.transcoder, 0, -1, -1))
        throw Error("Surface mip transcode failed");
      mipmaps.push({
        data: pixels,
        width: info.origWidth,
        height: info.origHeight,
      });
      buffers.push(pixels.buffer);
    }
    self.postMessage(
      { mipmaps, width: file.getWidth(), height: file.getHeight() },
      buffers,
    );
  } catch (error) {
    self.postMessage({ error: error.message });
  } finally {
    file?.close();
    file?.delete();
  }
};
