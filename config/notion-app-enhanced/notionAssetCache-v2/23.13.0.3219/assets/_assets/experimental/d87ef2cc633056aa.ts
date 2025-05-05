import "core-js/modules/es.error.cause.js";
import "core-js/modules/esnext.iterator.constructor.js";
import "core-js/modules/esnext.iterator.filter.js";
import "core-js/modules/esnext.iterator.map.js";
import "core-js/modules/web.self.js";
import * as Comlink from "@notionhq/shared/comlink";
import { sanitizeOPFSKey } from "@notionhq/shared/OPFS/helpers";
function mark(name) {
  performance.mark(`OPFS:RecordMapCacheAsyncWorker:${name}`);
}
function measure(name, start, end) {
  return performance.measure(`OPFS:RecordMapCacheAsyncWorker:${name}`, `OPFS:RecordMapCacheAsyncWorker:${start}`, `OPFS:RecordMapCacheAsyncWorker:${end}`);
}

/**
 * Cache implementation using Origin Private File System (OPFS)
 * Provides persistent storage for record maps
 */
class OPFSRecordMapCacheAsyncWorker {
  constructor(dirName, options) {
    this.dirName = void 0;
    this.cacheDirPromise = void 0;
    //cache is an LRU cache for file handles
    this.fileHandleCache = new Map();
    this.maxFileHandleCache = 10_000;
    this.lastAccessedSequence = 0;
    this.abortStatusMap = {};
    this.dirName = dirName;
    this.maxFileHandleCache = (options === null || options === void 0 ? void 0 : options.maxFileHandleCache) ?? this.maxFileHandleCache;
    void this.getCacheDir().catch(error => {});
    void this.cacheFileHandles().catch(error => {});
  }

  /**
   * Abort guard for abortable operations
   * @param fn - The function to execute
   * @param abortId - The ID of the operation to abort
   * @returns The result of the function
   * @throws {Error} If operation is aborted
   */
  async abortGuard(fn, id) {
    if (id && this.abortStatusMap[id] && this.abortStatusMap[id].aborted) {
      throw new Error(this.abortStatusMap[id].reason);
    }
    return await fn();
  }

  /**
   * Abort a running operation that is using the abortId with a reason
   * @param id - The ID of the operation to abort
   * @param reason - The reason for the abort
   */
  abort(id, reason) {
    if (this.abortStatusMap[id]) {
      this.abortStatusMap[id] = {
        aborted: true,
        reason
      };
    }
  }

  /**
   * Get the cache directory
   * @returns The cache directory
   */
  async getCacheDir() {
    if (this.cacheDirPromise) {
      return this.cacheDirPromise;
    }
    this.cacheDirPromise = navigator.storage.getDirectory().then(root => root.getDirectoryHandle(this.dirName, {
      create: true
    }));
    return this.cacheDirPromise;
  }

  /**
   * Adds a file handle to the cache, evicting the least recently used handle if necessary
   * @param key - The key associated with the file handle
   * @param handle - The file handle to add to the cache
   */
  cacheFileHandle(key, handle) {
    // Update or add the entry with current timestamp
    this.fileHandleCache.set(key, {
      handle,
      lastAccessed: ++this.lastAccessedSequence
    });

    // If cache is over capacity, remove the least recently used entry
    if (this.fileHandleCache.size > this.maxFileHandleCache) {
      let leastAccessedKey = key;
      let leastAccessed = this.lastAccessedSequence;
      for (const [key, entry] of this.fileHandleCache.entries()) {
        if (entry.lastAccessed < leastAccessed) {
          leastAccessed = entry.lastAccessed;
          leastAccessedKey = key;
        }
      }
      this.fileHandleCache.delete(leastAccessedKey);
    }
  }

  // TODO (lalit): see if we need to optimize this later: consider leveraging
  // mapAsync
  async cacheFileHandles() {
    mark("cacheFileHandles.start");
    const cacheDir = await this.getCacheDir();
    for await (const [name, handle] of cacheDir.entries()) {
      if (handle.kind === "file") {
        this.cacheFileHandle(name, handle);
      }
    }
    mark("cacheFileHandles.end");
    const measureCacheFileHandles = measure("cacheFileHandles", "cacheFileHandles.start", "cacheFileHandles.end");
  }

  /**
   * Gets a file handle from the cache or creates a new one
   * @param key - The key to get the file handle for
   * @param options - Options for creating the file handle
   * @returns The file handle
   * @public - This method is used for pre-creating file handles during page load
   */
  async getFileHandle(key, options) {
    const sanitizedKey = sanitizeOPFSKey(key);
    mark("getFileHandle.start");
    const cacheEntry = this.fileHandleCache.get(sanitizedKey);
    if (cacheEntry) {
      // Update last used time
      cacheEntry.lastAccessed = ++this.lastAccessedSequence;
      return cacheEntry.handle;
    } else {}

    // if we didn't find a handle in the cache:
    const cacheDir = await this.getCacheDir();
    const handle = await cacheDir.getFileHandle(sanitizedKey, options);

    // Add the handle to the cache
    this.cacheFileHandle(sanitizedKey, handle);
    mark("getFileHandle.end");
    const measureGetFileHandle = measure("getFileHandle", "getFileHandle.start", "getFileHandle.end");
    return handle;
  }

  /**
   * Reads a record map from the cache as a buffer
   * @param key - The key to read the record map from
   * @param id - unique ID for the operation, can be used to abort the operation
   * @returns ArrayBuffer of the file contents
   * @throws {Error} If reading fails or the file doesn't exist
   */
  async readBuffer(key, id) {
    mark("readBuffer.start");
    if (id) {
      this.abortStatusMap[id] = {
        aborted: false,
        reason: undefined
      };
    }
    try {
      const handle = await this.abortGuard(() => this.getFileHandle(key), id);
      mark("readBuffer.got-handle");
      const file = await handle.getFile();
      mark("readBuffer.got-file");
      const buffer = await this.abortGuard(() => file.arrayBuffer(), id);
      mark("readBuffer.got-buffer");
      const measureGetHandle = measure("readBuffer.get-handle", "readBuffer.start", "readBuffer.got-handle");
      const measureGetFile = measure("readBuffer.get-file", "readBuffer.got-handle", "readBuffer.got-file");
      const measureGetBuffer = measure("readBuffer.get-buffer", "readBuffer.got-file", "readBuffer.got-buffer");
      const measureReadBuffer = measure("readBuffer", "readBuffer.start", "readBuffer.got-buffer");
      return {
        buffer: Comlink.transfer(buffer, [buffer]),
        metrics: {
          total: measureReadBuffer.duration,
          getHandle: measureGetHandle.duration,
          getFile: measureGetFile.duration,
          getBuffer: measureGetBuffer.duration
        }
      };
    } finally {
      if (id) {
        delete this.abortStatusMap[id];
      }
    }
  }

  /**
   * Reads a record map from the cache as a JSON object
   * @param key - The key to read the record map from
   * @param id - unique ID for the operation, can be used to abort the operation
   * @returns The recordMapWithRole
   * @throws {Error} If reading fails or the file doesn't exist
   */
  async readJSON(key, id) {
    mark("readJSON.start");
    if (id) {
      this.abortStatusMap[id] = {
        aborted: false,
        reason: undefined
      };
    }
    try {
      const handle = await this.abortGuard(() => this.getFileHandle(key), id);
      mark("readJSON.got-handle");
      const file = await handle.getFile();
      mark("readJSON.got-file");
      const content = await this.abortGuard(() => file.text(), id);
      const contentArray = content ? content.split(/\r?\n/).filter(Boolean) : [];
      mark("readJSON.got-text");
      const recordMapJSONArray = contentArray.map(jsonString => JSON.parse(jsonString));
      mark("readJSON.got-json");
      const measureGetHandle = measure("readJSON.get-handle", "readJSON.start", "readJSON.got-handle");
      const measureGetFile = measure("readJSON.get-file", "readJSON.got-handle", "readJSON.got-file");
      const measureGetText = measure("readJSON.get-text", "readJSON.got-file", "readJSON.got-text");
      const measureParseJSON = measure("readJSON.parse-json", "readJSON.got-text", "readJSON.got-json");
      const measureReadJSON = measure("readJSON", "readJSON.start", "readJSON.got-json");
      return {
        recordMapJSONArray,
        metrics: {
          total: measureReadJSON.duration,
          getHandle: measureGetHandle.duration,
          getFile: measureGetFile.duration,
          getText: measureGetText.duration,
          parseJSON: measureParseJSON.duration
        }
      };
    } finally {
      if (id) {
        delete this.abortStatusMap[id];
      }
    }
  }

  /**
   * Writes data to a record map in the cache
   * @param key - The key to store the data under
   * @param JSONString - The JSON string to store
   * @throws {Error} If writing fails
   */
  async write(key, JSONStrings) {
    let writable;
    try {
      mark("write.start");
      const handle = await this.getFileHandle(key, {
        create: true
      });
      mark("write.got-handle");
      const buffer = new TextEncoder().encode(JSONStrings.join("\n"));
      mark("write.encoded-json");
      writable = await handle.createWritable();
      await writable.write(buffer);
      mark("write.wrote-json");
      const measureGetHandle = measure("write.get-handle", "write.start", "write.got-handle");
      const measureEncodeJSON = measure("write.encode-json", "write.got-handle", "write.encoded-json");
      const measureWriteJSON = measure("write.write-json", "write.encoded-json", "write.wrote-json");
      const measureWrite = measure("write", "write.start", "write.wrote-json");
      return {
        metrics: {
          total: measureWrite.duration,
          getHandle: measureGetHandle.duration,
          encodeJSON: measureEncodeJSON.duration,
          writeJSON: measureWriteJSON.duration
        }
      };
    } finally {
      if (writable) {
        await writable.close();
      }
    }
  }

  /**
   * Checks if a key exists in the cache
   * @param key - The key to check for
   * @returns True if the key exists, false if does not exist
   */
  async checkIfExists(key) {
    mark("checkIfExists.start");
    try {
      await this.getFileHandle(key);
      mark("checkIfExists.success");
      const measureCheckIfExistsSuccess = measure("checkIfExists", "checkIfExists.start", "checkIfExists.success");
      return true;
    } catch {
      mark("checkIfExists.failure");
      const measureCheckIfExistsFailure = measure("checkIfExists", "checkIfExists.start", "checkIfExists.failure");
      return false;
    }
  }

  /**
   * Deletes a record map from the cache
   * @param key - The key to delete
   * @throws {Error} If deleting fails or the file doesn't exist
   */
  async delete(key) {
    const sanitizedKey = sanitizeOPFSKey(key);
    const cacheDir = await this.getCacheDir();
    await cacheDir.removeEntry(sanitizedKey);
    // Remove from cache if exists
    this.fileHandleCache.delete(sanitizedKey);
  }

  /**
   * Deletes all record maps from the cache
   * @throws {Error} If deleting fails
   */
  async deleteAll() {
    const cacheDir = await this.getCacheDir();
    for await (const handle of cacheDir.values()) {
      await cacheDir.removeEntry(handle.name);
    }
    this.fileHandleCache.clear();
  }
}
const instances = new Map();
const factory = {
  getInstance(dirName) {
    const instance = instances.get(dirName);
    if (instance) {
      return Comlink.proxy(instance);
    }
    const newInstance = new OPFSRecordMapCacheAsyncWorker(dirName);
    instances.set(dirName, newInstance);
    return Comlink.proxy(newInstance);
  }
};
function handleMessage(event) {
  switch (event.data.name) {
    case "debug":
      break;
    default:
      break;
  }
}

// Detect worker type
const isSharedWorker = "onconnect" in self;
if (isSharedWorker) {
  // This is for the case where the worker is created via a SharedWorker constructor
  self.addEventListener("connect", event => {
    /** SAFETY: This is safe because this is a SharedWorker */
    const messageEvent = event;
    const port = messageEvent.ports[0];
    port.addEventListener("message", handleMessage);
    port.start();
    Comlink.expose(factory, port);
  });
} else {
  // This is for the case where the worker is created via a Worker constructor
  self.addEventListener("message", handleMessage);
  Comlink.expose(factory);
}