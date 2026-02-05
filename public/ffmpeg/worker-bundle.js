/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Inline all dependencies to avoid relative import issues

// const.js content
const CORE_URL = "";
const FFMessageType = {
    LOAD: "load",
    EXEC: "exec",
    WRITE_FILE: "writeFile",
    READ_FILE: "readFile",
    DELETE_FILE: "deleteFile",
};

// errors.js content
const ERROR_UNKNOWN_MESSAGE_TYPE = "Unknown message type";
const ERROR_NOT_LOADED = "FFmpeg is not loaded, call load() first";
const ERROR_IMPORT_FAILURE = "Failed to import ffmpeg-core";

// Original worker code with imports replaced
let ffmpeg;
const load = async ({ coreURL: _coreURL, wasmURL: _wasmURL, workerURL: _workerURL }) => {
    const first = !ffmpeg;
    try {
        if (!_coreURL)
            _coreURL = CORE_URL || "/ffmpeg/ffmpeg-core.js";
        // when web worker type is `classic`.
        importScripts(_coreURL);
    }
    catch {
        if (!_coreURL)
            _coreURL = CORE_URL || "/ffmpeg/ffmpeg-core.js";
        // when web worker type is `module`.
        self.createFFmpegCore = (await import(
        /* webpackIgnore: true */ /* @vite-ignore */ _coreURL)).default;
        if (!self.createFFmpegCore) {
            throw ERROR_IMPORT_FAILURE;
        }
    }
    const coreURL = _coreURL;
    const wasmURL = _wasmURL ? _wasmURL : _coreURL.replace(/.js$/g, ".wasm");
    const workerURL_param = _workerURL
        ? _workerURL
        : _coreURL.replace(/.js$/g, ".worker.js");
    ffmpeg = await self.createFFmpegCore({
        coreURL,
        wasmURL,
        workerURL: workerURL_param,
    });
    return first;
};
const exec = async ({ args, timeout = _timeout }) => {
    if (!ffmpeg)
        throw ERROR_NOT_LOADED;
    let timeoutId;
    const Promise_race = [
        new Promise((resolve) => {
            timeoutId = setTimeout(() => resolve({ status: "timeout" }), timeout);
        }),
        ffmpeg.exec(...args),
    ];
    const result = await Promise.race(Promise_race);
    clearTimeout(timeoutId);
    return result;
};
self.addEventListener("message", async ({ data: { id, type, data } }) => {
    try {
        if (type === FFMessageType.LOAD)
            await load(data);
        else if (type === FFMessageType.EXEC)
            await exec(data);
        else if (type === FFMessageType.WRITE_FILE)
            ffmpeg.writeFile(data.fileName, data.data);
        else if (type === FFMessageType.READ_FILE)
            ffmpeg.readFile(data.fileName);
        else if (type === FFMessageType.DELETE_FILE)
            ffmpeg.deleteFile(data.fileName);
        else
            throw ERROR_UNKNOWN_MESSAGE_TYPE;
        self.postMessage({ id, type });
    }
    catch (e) {
        self.postMessage({ id, error: e.message || e.toString() });
    }
});
