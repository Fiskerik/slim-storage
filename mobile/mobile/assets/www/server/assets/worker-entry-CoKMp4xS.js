import { EventEmitter } from "node:events";
import { AsyncLocalStorage } from "node:async_hooks";
import { ReadableStream as ReadableStream$1 } from "node:stream/web";
import { Readable, PassThrough } from "node:stream";
function _mergeNamespaces(n2, m2) {
  for (var i = 0; i < m2.length; i++) {
    const e = m2[i];
    if (typeof e !== "string" && !Array.isArray(e)) {
      for (const k2 in e) {
        if (k2 !== "default" && !(k2 in n2)) {
          const d = Object.getOwnPropertyDescriptor(e, k2);
          if (d) {
            Object.defineProperty(n2, k2, d.get ? d : {
              enumerable: true,
              get: () => e[k2]
            });
          }
        }
      }
    }
  }
  return Object.freeze(Object.defineProperty(n2, Symbol.toStringTag, { value: "Module" }));
}
const hrtime$1 = /* @__PURE__ */ Object.assign(function hrtime(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, { bigint: function bigint() {
  return BigInt(Date.now() * 1e6);
} });
class ReadStream {
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
}
class WriteStream {
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x3, y2, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
}
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn2 = () => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  };
  return Object.assign(fn2, { __unenv__: true });
}
const NODE_VERSION = "22.14.0";
class Process extends EventEmitter {
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw /* @__PURE__ */ createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw /* @__PURE__ */ createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw /* @__PURE__ */ createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw /* @__PURE__ */ createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw /* @__PURE__ */ createNotImplementedError("process.kill");
  }
  abort() {
    throw /* @__PURE__ */ createNotImplementedError("process.abort");
  }
  dlopen() {
    throw /* @__PURE__ */ createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw /* @__PURE__ */ createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw /* @__PURE__ */ createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw /* @__PURE__ */ createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw /* @__PURE__ */ createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw /* @__PURE__ */ createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw /* @__PURE__ */ createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw /* @__PURE__ */ createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw /* @__PURE__ */ createNotImplementedError("process.openStdin");
  }
  assert() {
    throw /* @__PURE__ */ createNotImplementedError("process.assert");
  }
  binding() {
    throw /* @__PURE__ */ createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: () => 0 });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
}
const globalProcess = globalThis["process"];
const getBuiltinModule = globalProcess.getBuiltinModule;
const workerdProcess = getBuiltinModule("node:process");
const unenvProcess = new Process({
  env: globalProcess.env,
  hrtime: hrtime$1,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
const { exit, features, platform } = workerdProcess;
const {
  _channel,
  _debugEnd,
  _debugProcess,
  _disconnect,
  _events,
  _eventsCount,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _handleQueue,
  _kill,
  _linkedBinding,
  _maxListeners,
  _pendingMessage,
  _preload_modules,
  _rawDebug,
  _send,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  assert,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  disconnect,
  dlopen,
  domain,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  hrtime: hrtime2,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  mainModule,
  memoryUsage,
  moduleLoadList,
  nextTick,
  off,
  on: on$1,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = unenvProcess;
const _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime2,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on: on$1,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
globalThis.process = _process;
const _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
const _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
const nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
class PerformanceEntry {
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
}
const PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
class PerformanceMeasure extends PerformanceEntry {
  entryType = "measure";
}
class PerformanceResourceTiming extends PerformanceEntry {
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
}
class PerformanceObserverEntryList {
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
}
class Performance {
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw /* @__PURE__ */ createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw /* @__PURE__ */ createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw /* @__PURE__ */ createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw /* @__PURE__ */ createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
}
class PerformanceObserver {
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw /* @__PURE__ */ createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw /* @__PURE__ */ createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn2) {
    return fn2;
  }
  runInAsyncScope(fn2, thisArg, ...args) {
    return fn2.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
}
const performance$1 = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();
if (!("__unenv__" in performance$1)) {
  const proto = Performance.prototype;
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key !== "constructor" && !(key in performance$1)) {
      const desc = Object.getOwnPropertyDescriptor(proto, key);
      if (desc) {
        Object.defineProperty(performance$1, key, desc);
      }
    }
  }
}
globalThis.performance = performance$1;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;
function getDefaultExportFromCjs(x3) {
  return x3 && x3.__esModule && Object.prototype.hasOwnProperty.call(x3, "default") ? x3["default"] : x3;
}
var react = { exports: {} };
var react_production_min = {};
var hasRequiredReact_production_min;
function requireReact_production_min() {
  if (hasRequiredReact_production_min) return react_production_min;
  hasRequiredReact_production_min = 1;
  var l = /* @__PURE__ */ Symbol.for("react.element"), n2 = /* @__PURE__ */ Symbol.for("react.portal"), p2 = /* @__PURE__ */ Symbol.for("react.fragment"), q2 = /* @__PURE__ */ Symbol.for("react.strict_mode"), r = /* @__PURE__ */ Symbol.for("react.profiler"), t = /* @__PURE__ */ Symbol.for("react.provider"), u = /* @__PURE__ */ Symbol.for("react.context"), v2 = /* @__PURE__ */ Symbol.for("react.forward_ref"), w3 = /* @__PURE__ */ Symbol.for("react.suspense"), x3 = /* @__PURE__ */ Symbol.for("react.memo"), y2 = /* @__PURE__ */ Symbol.for("react.lazy"), z2 = Symbol.iterator;
  function A2(a) {
    if (null === a || "object" !== typeof a) return null;
    a = z2 && a[z2] || a["@@iterator"];
    return "function" === typeof a ? a : null;
  }
  var B2 = { isMounted: function() {
    return false;
  }, enqueueForceUpdate: function() {
  }, enqueueReplaceState: function() {
  }, enqueueSetState: function() {
  } }, C2 = Object.assign, D2 = {};
  function E2(a, b2, e) {
    this.props = a;
    this.context = b2;
    this.refs = D2;
    this.updater = e || B2;
  }
  E2.prototype.isReactComponent = {};
  E2.prototype.setState = function(a, b2) {
    if ("object" !== typeof a && "function" !== typeof a && null != a) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
    this.updater.enqueueSetState(this, a, b2, "setState");
  };
  E2.prototype.forceUpdate = function(a) {
    this.updater.enqueueForceUpdate(this, a, "forceUpdate");
  };
  function F2() {
  }
  F2.prototype = E2.prototype;
  function G2(a, b2, e) {
    this.props = a;
    this.context = b2;
    this.refs = D2;
    this.updater = e || B2;
  }
  var H = G2.prototype = new F2();
  H.constructor = G2;
  C2(H, E2.prototype);
  H.isPureReactComponent = true;
  var I2 = Array.isArray, J2 = Object.prototype.hasOwnProperty, K = { current: null }, L2 = { key: true, ref: true, __self: true, __source: true };
  function M2(a, b2, e) {
    var d, c2 = {}, k2 = null, h2 = null;
    if (null != b2) for (d in void 0 !== b2.ref && (h2 = b2.ref), void 0 !== b2.key && (k2 = "" + b2.key), b2) J2.call(b2, d) && !L2.hasOwnProperty(d) && (c2[d] = b2[d]);
    var g = arguments.length - 2;
    if (1 === g) c2.children = e;
    else if (1 < g) {
      for (var f2 = Array(g), m2 = 0; m2 < g; m2++) f2[m2] = arguments[m2 + 2];
      c2.children = f2;
    }
    if (a && a.defaultProps) for (d in g = a.defaultProps, g) void 0 === c2[d] && (c2[d] = g[d]);
    return { $$typeof: l, type: a, key: k2, ref: h2, props: c2, _owner: K.current };
  }
  function N2(a, b2) {
    return { $$typeof: l, type: a.type, key: b2, ref: a.ref, props: a.props, _owner: a._owner };
  }
  function O2(a) {
    return "object" === typeof a && null !== a && a.$$typeof === l;
  }
  function escape(a) {
    var b2 = { "=": "=0", ":": "=2" };
    return "$" + a.replace(/[=:]/g, function(a2) {
      return b2[a2];
    });
  }
  var P2 = /\/+/g;
  function Q2(a, b2) {
    return "object" === typeof a && null !== a && null != a.key ? escape("" + a.key) : b2.toString(36);
  }
  function R2(a, b2, e, d, c2) {
    var k2 = typeof a;
    if ("undefined" === k2 || "boolean" === k2) a = null;
    var h2 = false;
    if (null === a) h2 = true;
    else switch (k2) {
      case "string":
      case "number":
        h2 = true;
        break;
      case "object":
        switch (a.$$typeof) {
          case l:
          case n2:
            h2 = true;
        }
    }
    if (h2) return h2 = a, c2 = c2(h2), a = "" === d ? "." + Q2(h2, 0) : d, I2(c2) ? (e = "", null != a && (e = a.replace(P2, "$&/") + "/"), R2(c2, b2, e, "", function(a2) {
      return a2;
    })) : null != c2 && (O2(c2) && (c2 = N2(c2, e + (!c2.key || h2 && h2.key === c2.key ? "" : ("" + c2.key).replace(P2, "$&/") + "/") + a)), b2.push(c2)), 1;
    h2 = 0;
    d = "" === d ? "." : d + ":";
    if (I2(a)) for (var g = 0; g < a.length; g++) {
      k2 = a[g];
      var f2 = d + Q2(k2, g);
      h2 += R2(k2, b2, e, f2, c2);
    }
    else if (f2 = A2(a), "function" === typeof f2) for (a = f2.call(a), g = 0; !(k2 = a.next()).done; ) k2 = k2.value, f2 = d + Q2(k2, g++), h2 += R2(k2, b2, e, f2, c2);
    else if ("object" === k2) throw b2 = String(a), Error("Objects are not valid as a React child (found: " + ("[object Object]" === b2 ? "object with keys {" + Object.keys(a).join(", ") + "}" : b2) + "). If you meant to render a collection of children, use an array instead.");
    return h2;
  }
  function S(a, b2, e) {
    if (null == a) return a;
    var d = [], c2 = 0;
    R2(a, d, "", "", function(a2) {
      return b2.call(e, a2, c2++);
    });
    return d;
  }
  function T2(a) {
    if (-1 === a._status) {
      var b2 = a._result;
      b2 = b2();
      b2.then(function(b3) {
        if (0 === a._status || -1 === a._status) a._status = 1, a._result = b3;
      }, function(b3) {
        if (0 === a._status || -1 === a._status) a._status = 2, a._result = b3;
      });
      -1 === a._status && (a._status = 0, a._result = b2);
    }
    if (1 === a._status) return a._result.default;
    throw a._result;
  }
  var U2 = { current: null }, V2 = { transition: null }, W2 = { ReactCurrentDispatcher: U2, ReactCurrentBatchConfig: V2, ReactCurrentOwner: K };
  react_production_min.Children = { map: S, forEach: function(a, b2, e) {
    S(a, function() {
      b2.apply(this, arguments);
    }, e);
  }, count: function(a) {
    var b2 = 0;
    S(a, function() {
      b2++;
    });
    return b2;
  }, toArray: function(a) {
    return S(a, function(a2) {
      return a2;
    }) || [];
  }, only: function(a) {
    if (!O2(a)) throw Error("React.Children.only expected to receive a single React element child.");
    return a;
  } };
  react_production_min.Component = E2;
  react_production_min.Fragment = p2;
  react_production_min.Profiler = r;
  react_production_min.PureComponent = G2;
  react_production_min.StrictMode = q2;
  react_production_min.Suspense = w3;
  react_production_min.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = W2;
  react_production_min.cloneElement = function(a, b2, e) {
    if (null === a || void 0 === a) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + a + ".");
    var d = C2({}, a.props), c2 = a.key, k2 = a.ref, h2 = a._owner;
    if (null != b2) {
      void 0 !== b2.ref && (k2 = b2.ref, h2 = K.current);
      void 0 !== b2.key && (c2 = "" + b2.key);
      if (a.type && a.type.defaultProps) var g = a.type.defaultProps;
      for (f2 in b2) J2.call(b2, f2) && !L2.hasOwnProperty(f2) && (d[f2] = void 0 === b2[f2] && void 0 !== g ? g[f2] : b2[f2]);
    }
    var f2 = arguments.length - 2;
    if (1 === f2) d.children = e;
    else if (1 < f2) {
      g = Array(f2);
      for (var m2 = 0; m2 < f2; m2++) g[m2] = arguments[m2 + 2];
      d.children = g;
    }
    return { $$typeof: l, type: a.type, key: c2, ref: k2, props: d, _owner: h2 };
  };
  react_production_min.createContext = function(a) {
    a = { $$typeof: u, _currentValue: a, _currentValue2: a, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null };
    a.Provider = { $$typeof: t, _context: a };
    return a.Consumer = a;
  };
  react_production_min.createElement = M2;
  react_production_min.createFactory = function(a) {
    var b2 = M2.bind(null, a);
    b2.type = a;
    return b2;
  };
  react_production_min.createRef = function() {
    return { current: null };
  };
  react_production_min.forwardRef = function(a) {
    return { $$typeof: v2, render: a };
  };
  react_production_min.isValidElement = O2;
  react_production_min.lazy = function(a) {
    return { $$typeof: y2, _payload: { _status: -1, _result: a }, _init: T2 };
  };
  react_production_min.memo = function(a, b2) {
    return { $$typeof: x3, type: a, compare: void 0 === b2 ? null : b2 };
  };
  react_production_min.startTransition = function(a) {
    var b2 = V2.transition;
    V2.transition = {};
    try {
      a();
    } finally {
      V2.transition = b2;
    }
  };
  react_production_min.unstable_act = function() {
    throw Error("act(...) is not supported in production builds of React.");
  };
  react_production_min.useCallback = function(a, b2) {
    return U2.current.useCallback(a, b2);
  };
  react_production_min.useContext = function(a) {
    return U2.current.useContext(a);
  };
  react_production_min.useDebugValue = function() {
  };
  react_production_min.useDeferredValue = function(a) {
    return U2.current.useDeferredValue(a);
  };
  react_production_min.useEffect = function(a, b2) {
    return U2.current.useEffect(a, b2);
  };
  react_production_min.useId = function() {
    return U2.current.useId();
  };
  react_production_min.useImperativeHandle = function(a, b2, e) {
    return U2.current.useImperativeHandle(a, b2, e);
  };
  react_production_min.useInsertionEffect = function(a, b2) {
    return U2.current.useInsertionEffect(a, b2);
  };
  react_production_min.useLayoutEffect = function(a, b2) {
    return U2.current.useLayoutEffect(a, b2);
  };
  react_production_min.useMemo = function(a, b2) {
    return U2.current.useMemo(a, b2);
  };
  react_production_min.useReducer = function(a, b2, e) {
    return U2.current.useReducer(a, b2, e);
  };
  react_production_min.useRef = function(a) {
    return U2.current.useRef(a);
  };
  react_production_min.useState = function(a) {
    return U2.current.useState(a);
  };
  react_production_min.useSyncExternalStore = function(a, b2, e) {
    return U2.current.useSyncExternalStore(a, b2, e);
  };
  react_production_min.useTransition = function() {
    return U2.current.useTransition();
  };
  react_production_min.version = "18.2.0";
  return react_production_min;
}
var hasRequiredReact;
function requireReact() {
  if (hasRequiredReact) return react.exports;
  hasRequiredReact = 1;
  {
    react.exports = requireReact_production_min();
  }
  return react.exports;
}
var reactExports = requireReact();
const React2 = /* @__PURE__ */ getDefaultExportFromCjs(reactExports);
const React = /* @__PURE__ */ _mergeNamespaces({
  __proto__: null,
  default: React2
}, [reactExports]);
var isServer = true;
function invariant$1() {
  throw new Error("Invariant failed");
}
function isNotFound$1(obj) {
  return obj?.isNotFound === true;
}
var rootRouteId$1 = "__root__";
function redirect(opts) {
  opts.statusCode = opts.statusCode || opts.code || 307;
  if (!opts._builtLocation && !opts.reloadDocument && typeof opts.href === "string") try {
    new URL(opts.href);
    opts.reloadDocument = true;
  } catch {
  }
  const headers = new Headers(opts.headers);
  if (opts.href && headers.get("Location") === null) headers.set("Location", opts.href);
  const response = new Response(null, {
    status: opts.statusCode,
    headers
  });
  response.options = opts;
  if (opts.throw) throw response;
  return response;
}
function isRedirect$1(obj) {
  return obj instanceof Response && !!obj.options;
}
var stateIndexKey = "__TSR_index";
function createHistory(opts) {
  let location = opts.getLocation();
  const subscribers = /* @__PURE__ */ new Set();
  const notify = (action) => {
    location = opts.getLocation();
    subscribers.forEach((subscriber) => subscriber({
      location,
      action
    }));
  };
  const handleIndexChange = (action) => {
    if (opts.notifyOnIndexChange ?? true) notify(action);
    else location = opts.getLocation();
  };
  const tryNavigation = async ({ task, navigateOpts, ...actionInfo }) => {
    if (navigateOpts?.ignoreBlocker ?? false) {
      task();
      return;
    }
    const blockers = opts.getBlockers?.() ?? [];
    const isPushOrReplace = actionInfo.type === "PUSH" || actionInfo.type === "REPLACE";
    if (typeof document !== "undefined" && blockers.length && isPushOrReplace) for (const blocker of blockers) {
      const nextLocation = parseHref(actionInfo.path, actionInfo.state);
      if (await blocker.blockerFn({
        currentLocation: location,
        nextLocation,
        action: actionInfo.type
      })) {
        opts.onBlocked?.();
        return;
      }
    }
    task();
  };
  return {
    get location() {
      return location;
    },
    get length() {
      return opts.getLength();
    },
    subscribers,
    subscribe: (cb) => {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    push: (path, state, navigateOpts) => {
      const currentIndex = location.state[stateIndexKey];
      state = assignKeyAndIndex(currentIndex + 1, state);
      tryNavigation({
        task: () => {
          opts.pushState(path, state);
          notify({ type: "PUSH" });
        },
        navigateOpts,
        type: "PUSH",
        path,
        state
      });
    },
    replace: (path, state, navigateOpts) => {
      const currentIndex = location.state[stateIndexKey];
      state = assignKeyAndIndex(currentIndex, state);
      tryNavigation({
        task: () => {
          opts.replaceState(path, state);
          notify({ type: "REPLACE" });
        },
        navigateOpts,
        type: "REPLACE",
        path,
        state
      });
    },
    go: (index, navigateOpts) => {
      tryNavigation({
        task: () => {
          opts.go(index);
          handleIndexChange({
            type: "GO",
            index
          });
        },
        navigateOpts,
        type: "GO"
      });
    },
    back: (navigateOpts) => {
      tryNavigation({
        task: () => {
          opts.back(navigateOpts?.ignoreBlocker ?? false);
          handleIndexChange({ type: "BACK" });
        },
        navigateOpts,
        type: "BACK"
      });
    },
    forward: (navigateOpts) => {
      tryNavigation({
        task: () => {
          opts.forward(navigateOpts?.ignoreBlocker ?? false);
          handleIndexChange({ type: "FORWARD" });
        },
        navigateOpts,
        type: "FORWARD"
      });
    },
    canGoBack: () => location.state[stateIndexKey] !== 0,
    createHref: (str) => opts.createHref(str),
    block: (blocker) => {
      if (!opts.setBlockers) return () => {
      };
      const blockers = opts.getBlockers?.() ?? [];
      opts.setBlockers([...blockers, blocker]);
      return () => {
        const blockers2 = opts.getBlockers?.() ?? [];
        opts.setBlockers?.(blockers2.filter((b2) => b2 !== blocker));
      };
    },
    flush: () => opts.flush?.(),
    destroy: () => opts.destroy?.(),
    notify
  };
}
function assignKeyAndIndex(index, state) {
  if (!state) state = {};
  const key = createRandomKey();
  return {
    ...state,
    key,
    __TSR_key: key,
    [stateIndexKey]: index
  };
}
function createMemoryHistory(opts = { initialEntries: ["/"] }) {
  const entries = opts.initialEntries;
  let index = opts.initialIndex ? Math.min(Math.max(opts.initialIndex, 0), entries.length - 1) : entries.length - 1;
  const states = entries.map((_entry, index2) => assignKeyAndIndex(index2, void 0));
  const getLocation = () => parseHref(entries[index], states[index]);
  let blockers = [];
  const _getBlockers = () => blockers;
  const _setBlockers = (newBlockers) => blockers = newBlockers;
  return createHistory({
    getLocation,
    getLength: () => entries.length,
    pushState: (path, state) => {
      if (index < entries.length - 1) {
        entries.splice(index + 1);
        states.splice(index + 1);
      }
      states.push(state);
      entries.push(path);
      index = Math.max(entries.length - 1, 0);
    },
    replaceState: (path, state) => {
      states[index] = state;
      entries[index] = path;
    },
    back: () => {
      index = Math.max(index - 1, 0);
    },
    forward: () => {
      index = Math.min(index + 1, entries.length - 1);
    },
    go: (n2) => {
      index = Math.min(Math.max(index + n2, 0), entries.length - 1);
    },
    createHref: (path) => path,
    getBlockers: _getBlockers,
    setBlockers: _setBlockers
  });
}
function sanitizePath(path) {
  let sanitized = path.replace(/[\x00-\x1f\x7f]/g, "");
  if (sanitized.startsWith("//")) sanitized = "/" + sanitized.replace(/^\/+/, "");
  return sanitized;
}
function parseHref(href, state) {
  const sanitizedHref = sanitizePath(href);
  const hashIndex = sanitizedHref.indexOf("#");
  const searchIndex = sanitizedHref.indexOf("?");
  const addedKey = createRandomKey();
  return {
    href: sanitizedHref,
    pathname: sanitizedHref.substring(0, hashIndex > 0 ? searchIndex > 0 ? Math.min(hashIndex, searchIndex) : hashIndex : searchIndex > 0 ? searchIndex : sanitizedHref.length),
    hash: hashIndex > -1 ? sanitizedHref.substring(hashIndex) : "",
    search: searchIndex > -1 ? sanitizedHref.slice(searchIndex, hashIndex === -1 ? void 0 : hashIndex) : "",
    state: state || {
      [stateIndexKey]: 0,
      key: addedKey,
      __TSR_key: addedKey
    }
  };
}
function createRandomKey() {
  return (Math.random() + 1).toString(36).substring(7);
}
var L = ((i) => (i[i.AggregateError = 1] = "AggregateError", i[i.ArrowFunction = 2] = "ArrowFunction", i[i.ErrorPrototypeStack = 4] = "ErrorPrototypeStack", i[i.ObjectAssign = 8] = "ObjectAssign", i[i.BigIntTypedArray = 16] = "BigIntTypedArray", i[i.RegExp = 32] = "RegExp", i))(L || {});
var v = Symbol.asyncIterator, mr = Symbol.hasInstance, R = Symbol.isConcatSpreadable, C = Symbol.iterator, pr = Symbol.match, dr = Symbol.matchAll, gr = Symbol.replace, yr = Symbol.search, Nr = Symbol.species, br = Symbol.split, vr = Symbol.toPrimitive, P$1 = Symbol.toStringTag, Cr = Symbol.unscopables;
var rt = { 0: "Symbol.asyncIterator", 1: "Symbol.hasInstance", 2: "Symbol.isConcatSpreadable", 3: "Symbol.iterator", 4: "Symbol.match", 5: "Symbol.matchAll", 6: "Symbol.replace", 7: "Symbol.search", 8: "Symbol.species", 9: "Symbol.split", 10: "Symbol.toPrimitive", 11: "Symbol.toStringTag", 12: "Symbol.unscopables" }, ve = { [v]: 0, [mr]: 1, [R]: 2, [C]: 3, [pr]: 4, [dr]: 5, [gr]: 6, [yr]: 7, [Nr]: 8, [br]: 9, [vr]: 10, [P$1]: 11, [Cr]: 12 }, tt = { 0: v, 1: mr, 2: R, 3: C, 4: pr, 5: dr, 6: gr, 7: yr, 8: Nr, 9: br, 10: vr, 11: P$1, 12: Cr }, nt = { 2: "!0", 3: "!1", 1: "void 0", 0: "null", 4: "-0", 5: "1/0", 6: "-1/0", 7: "0/0" }, o = void 0, ot = { 2: true, 3: false, 1: o, 0: null, 4: -0, 5: Number.POSITIVE_INFINITY, 6: Number.NEGATIVE_INFINITY, 7: Number.NaN };
var Ce = { 0: "Error", 1: "EvalError", 2: "RangeError", 3: "ReferenceError", 4: "SyntaxError", 5: "TypeError", 6: "URIError" }, at = { 0: Error, 1: EvalError, 2: RangeError, 3: ReferenceError, 4: SyntaxError, 5: TypeError, 6: URIError };
function c(e, r, t, n2, a, s, i, u, l, g, S, d) {
  return { t: e, i: r, s: t, c: n2, m: a, p: s, e: i, a: u, f: l, b: g, o: S, l: d };
}
function B(e) {
  return c(2, o, e, o, o, o, o, o, o, o, o, o);
}
var J = B(2), Z = B(3), Ae = B(1), Ee = B(0), st = B(4), it = B(5), ut = B(6), lt = B(7);
function fn(e) {
  switch (e) {
    case '"':
      return '\\"';
    case "\\":
      return "\\\\";
    case `
`:
      return "\\n";
    case "\r":
      return "\\r";
    case "\b":
      return "\\b";
    case "	":
      return "\\t";
    case "\f":
      return "\\f";
    case "<":
      return "\\x3C";
    case "\u2028":
      return "\\u2028";
    case "\u2029":
      return "\\u2029";
    default:
      return o;
  }
}
function y(e) {
  let r = "", t = 0, n2;
  for (let a = 0, s = e.length; a < s; a++) n2 = fn(e[a]), n2 && (r += e.slice(t, a) + n2, t = a + 1);
  return t === 0 ? r = e : r += e.slice(t), r;
}
function Sn(e) {
  switch (e) {
    case "\\\\":
      return "\\";
    case '\\"':
      return '"';
    case "\\n":
      return `
`;
    case "\\r":
      return "\r";
    case "\\b":
      return "\b";
    case "\\t":
      return "	";
    case "\\f":
      return "\f";
    case "\\x3C":
      return "<";
    case "\\u2028":
      return "\u2028";
    case "\\u2029":
      return "\u2029";
    default:
      return e;
  }
}
function D(e) {
  return e.replace(/(\\\\|\\"|\\n|\\r|\\b|\\t|\\f|\\u2028|\\u2029|\\x3C)/g, Sn);
}
var U = "__SEROVAL_REFS__", ce = "$R", Ie = `self.${ce}`;
function mn(e) {
  return e == null ? `${Ie}=${Ie}||[]` : `(${Ie}=${Ie}||{})["${y(e)}"]=[]`;
}
var Ar = /* @__PURE__ */ new Map(), j = /* @__PURE__ */ new Map();
function Er(e) {
  return Ar.has(e);
}
function dn(e) {
  return j.has(e);
}
function ct(e) {
  if (Er(e)) return Ar.get(e);
  throw new Re(e);
}
function ft(e) {
  if (dn(e)) return j.get(e);
  throw new Pe(e);
}
typeof globalThis != "undefined" ? Object.defineProperty(globalThis, U, { value: j, configurable: true, writable: false, enumerable: false }) : typeof window != "undefined" ? Object.defineProperty(window, U, { value: j, configurable: true, writable: false, enumerable: false }) : typeof self != "undefined" ? Object.defineProperty(self, U, { value: j, configurable: true, writable: false, enumerable: false }) : typeof global != "undefined" && Object.defineProperty(global, U, { value: j, configurable: true, writable: false, enumerable: false });
function xe(e) {
  return e instanceof EvalError ? 1 : e instanceof RangeError ? 2 : e instanceof ReferenceError ? 3 : e instanceof SyntaxError ? 4 : e instanceof TypeError ? 5 : e instanceof URIError ? 6 : 0;
}
function gn(e) {
  let r = Ce[xe(e)];
  return e.name !== r ? { name: e.name } : e.constructor.name !== r ? { name: e.constructor.name } : {};
}
function $(e, r) {
  let t = gn(e), n2 = Object.getOwnPropertyNames(e);
  for (let a = 0, s = n2.length, i; a < s; a++) i = n2[a], i !== "name" && i !== "message" && (i === "stack" ? r & 4 && (t = t || {}, t[i] = e[i]) : (t = t || {}, t[i] = e[i]));
  return t;
}
function Oe(e) {
  return Object.isFrozen(e) ? 3 : Object.isSealed(e) ? 2 : Object.isExtensible(e) ? 0 : 1;
}
function Te(e) {
  switch (e) {
    case Number.POSITIVE_INFINITY:
      return it;
    case Number.NEGATIVE_INFINITY:
      return ut;
  }
  return e !== e ? lt : Object.is(e, -0) ? st : c(0, o, e, o, o, o, o, o, o, o, o, o);
}
function X(e) {
  return c(1, o, y(e), o, o, o, o, o, o, o, o, o);
}
function we(e) {
  return c(3, o, "" + e, o, o, o, o, o, o, o, o, o);
}
function mt(e) {
  return c(4, e, o, o, o, o, o, o, o, o, o, o);
}
function he(e, r) {
  let t = r.valueOf();
  return c(5, e, t !== t ? "" : r.toISOString(), o, o, o, o, o, o, o, o, o);
}
function ze(e, r) {
  return c(6, e, o, y(r.source), r.flags, o, o, o, o, o, o, o);
}
function pt(e, r) {
  return c(17, e, ve[r], o, o, o, o, o, o, o, o, o);
}
function dt(e, r) {
  return c(18, e, y(ct(r)), o, o, o, o, o, o, o, o, o);
}
function fe(e, r, t) {
  return c(25, e, t, y(r), o, o, o, o, o, o, o, o);
}
function _e(e, r, t) {
  return c(9, e, o, o, o, o, o, t, o, o, Oe(r), o);
}
function ke(e, r) {
  return c(21, e, o, o, o, o, o, o, r, o, o, o);
}
function De(e, r, t) {
  return c(15, e, o, r.constructor.name, o, o, o, o, t, r.byteOffset, o, r.length);
}
function Fe(e, r, t) {
  return c(16, e, o, r.constructor.name, o, o, o, o, t, r.byteOffset, o, r.byteLength);
}
function Be(e, r, t) {
  return c(20, e, o, o, o, o, o, o, t, r.byteOffset, o, r.byteLength);
}
function Ve(e, r, t) {
  return c(13, e, xe(r), o, y(r.message), t, o, o, o, o, o, o);
}
function Me(e, r, t) {
  return c(14, e, xe(r), o, y(r.message), t, o, o, o, o, o, o);
}
function Le(e, r) {
  return c(7, e, o, o, o, o, o, r, o, o, o, o);
}
function Ue(e, r) {
  return c(28, o, o, o, o, o, o, [e, r], o, o, o, o);
}
function je(e, r) {
  return c(30, o, o, o, o, o, o, [e, r], o, o, o, o);
}
function Ye(e, r, t) {
  return c(31, e, o, o, o, o, o, t, r, o, o, o);
}
function qe(e, r) {
  return c(32, e, o, o, o, o, o, o, r, o, o, o);
}
function We(e, r) {
  return c(33, e, o, o, o, o, o, o, r, o, o, o);
}
function Ge(e, r) {
  return c(34, e, o, o, o, o, o, o, r, o, o, o);
}
function Ke(e, r, t, n2) {
  return c(35, e, t, o, o, o, o, r, o, o, o, n2);
}
var yn = { parsing: 1, serialization: 2, deserialization: 3 };
function Nn(e) {
  return `Seroval Error (step: ${yn[e]})`;
}
var bn = (e, r) => Nn(e), Se = class extends Error {
  constructor(t, n2) {
    super(bn(t));
    this.cause = n2;
  }
}, z = class extends Se {
  constructor(r) {
    super("parsing", r);
  }
}, He = class extends Se {
  constructor(r) {
    super("deserialization", r);
  }
};
function _(e) {
  return `Seroval Error (specific: ${e})`;
}
var x$1 = class x extends Error {
  constructor(t) {
    super(_(1));
    this.value = t;
  }
}, w$1 = class w extends Error {
  constructor(r) {
    super(_(2));
  }
}, Q = class extends Error {
  constructor(r) {
    super(_(3));
  }
}, V = class extends Error {
  constructor(r) {
    super(_(4));
  }
}, Re = class extends Error {
  constructor(t) {
    super(_(5));
    this.value = t;
  }
}, Pe = class extends Error {
  constructor(r) {
    super(_(6));
  }
}, Je = class extends Error {
  constructor(r) {
    super(_(7));
  }
}, h = class extends Error {
  constructor(r) {
    super(_(8));
  }
}, ee$1 = class ee extends Error {
  constructor(r) {
    super(_(9));
  }
};
var Y = class {
  constructor(r, t) {
    this.value = r;
    this.replacement = t;
  }
};
var re = () => {
  let e = { p: 0, s: 0, f: 0 };
  return e.p = new Promise((r, t) => {
    e.s = r, e.f = t;
  }), e;
}, vn = (e, r) => {
  e.s(r), e.p.s = 1, e.p.v = r;
}, Cn = (e, r) => {
  e.f(r), e.p.s = 2, e.p.v = r;
}, yt = re.toString(), Nt = vn.toString(), bt = Cn.toString(), Rr = () => {
  let e = [], r = [], t = true, n2 = false, a = 0, s = (l, g, S) => {
    for (S = 0; S < a; S++) r[S] && r[S][g](l);
  }, i = (l, g, S, d) => {
    for (g = 0, S = e.length; g < S; g++) d = e[g], !t && g === S - 1 ? l[n2 ? "return" : "throw"](d) : l.next(d);
  }, u = (l, g) => (t && (g = a++, r[g] = l), i(l), () => {
    t && (r[g] = r[a], r[a--] = void 0);
  });
  return { __SEROVAL_STREAM__: true, on: (l) => u(l), next: (l) => {
    t && (e.push(l), s(l, "next"));
  }, throw: (l) => {
    t && (e.push(l), s(l, "throw"), t = false, n2 = false, r.length = 0);
  }, return: (l) => {
    t && (e.push(l), s(l, "return"), t = false, n2 = true, r.length = 0);
  } };
}, vt = Rr.toString(), Pr = (e) => (r) => () => {
  let t = 0, n2 = { [e]: () => n2, next: () => {
    if (t > r.d) return { done: true, value: void 0 };
    let a = t++, s = r.v[a];
    if (a === r.t) throw s;
    return { done: a === r.d, value: s };
  } };
  return n2;
}, Ct = Pr.toString(), xr = (e, r) => (t) => () => {
  let n2 = 0, a = -1, s = false, i = [], u = [], l = (S = 0, d = u.length) => {
    for (; S < d; S++) u[S].s({ done: true, value: void 0 });
  };
  t.on({ next: (S) => {
    let d = u.shift();
    d && d.s({ done: false, value: S }), i.push(S);
  }, throw: (S) => {
    let d = u.shift();
    d && d.f(S), l(), a = i.length, s = true, i.push(S);
  }, return: (S) => {
    let d = u.shift();
    d && d.s({ done: true, value: S }), l(), a = i.length, i.push(S);
  } });
  let g = { [e]: () => g, next: () => {
    if (a === -1) {
      let K = n2++;
      if (K >= i.length) {
        let et = r();
        return u.push(et), et.p;
      }
      return { done: false, value: i[K] };
    }
    if (n2 > a) return { done: true, value: void 0 };
    let S = n2++, d = i[S];
    if (S !== a) return { done: false, value: d };
    if (s) throw d;
    return { done: true, value: d };
  } };
  return g;
}, At = xr.toString(), Or = (e) => {
  let r = atob(e), t = r.length, n2 = new Uint8Array(t);
  for (let a = 0; a < t; a++) n2[a] = r.charCodeAt(a);
  return n2.buffer;
}, Et = Or.toString();
function Ze(e) {
  return "__SEROVAL_SEQUENCE__" in e;
}
function Tr(e, r, t) {
  return { __SEROVAL_SEQUENCE__: true, v: e, t: r, d: t };
}
function $e(e) {
  let r = [], t = -1, n2 = -1, a = e[C]();
  for (; ; ) try {
    let s = a.next();
    if (r.push(s.value), s.done) {
      n2 = r.length - 1;
      break;
    }
  } catch (s) {
    t = r.length, r.push(s);
  }
  return Tr(r, t, n2);
}
var An = Pr(C);
function It(e) {
  return An(e);
}
var Rt = {}, Pt = {};
var xt = { 0: {}, 1: {}, 2: {}, 3: {}, 4: {}, 5: {} }, Ot = { 0: "[]", 1: yt, 2: Nt, 3: bt, 4: vt, 5: Et };
function M(e) {
  return "__SEROVAL_STREAM__" in e;
}
function te() {
  return Rr();
}
function Xe(e) {
  let r = te(), t = e[v]();
  async function n2() {
    try {
      let a = await t.next();
      a.done ? r.return(a.value) : (r.next(a.value), await n2());
    } catch (a) {
      r.throw(a);
    }
  }
  return n2().catch(() => {
  }), r;
}
var En = xr(v, re);
function Tt(e) {
  return En(e);
}
async function wr(e) {
  try {
    return [1, await e];
  } catch (r) {
    return [0, r];
  }
}
function pe(e, r) {
  return { plugins: r.plugins, mode: e, marked: /* @__PURE__ */ new Set(), features: 63 ^ (r.disabledFeatures || 0), refs: r.refs || /* @__PURE__ */ new Map(), depthLimit: r.depthLimit || 1e3 };
}
function de(e, r) {
  e.marked.add(r);
}
function hr(e, r) {
  let t = e.refs.size;
  return e.refs.set(r, t), t;
}
function Qe(e, r) {
  let t = e.refs.get(r);
  return t != null ? (de(e, t), { type: 1, value: mt(t) }) : { type: 0, value: hr(e, r) };
}
function q(e, r) {
  let t = Qe(e, r);
  return t.type === 1 ? t : Er(r) ? { type: 2, value: dt(t.value, r) } : t;
}
function I(e, r) {
  let t = q(e, r);
  if (t.type !== 0) return t.value;
  if (r in ve) return pt(t.value, r);
  throw new x$1(r);
}
function k(e, r) {
  let t = Qe(e, xt[r]);
  return t.type === 1 ? t.value : c(26, t.value, r, o, o, o, o, o, o, o, o, o);
}
function er(e) {
  let r = Qe(e, Rt);
  return r.type === 1 ? r.value : c(27, r.value, o, o, o, o, o, o, I(e, C), o, o, o);
}
function rr(e) {
  let r = Qe(e, Pt);
  return r.type === 1 ? r.value : c(29, r.value, o, o, o, o, o, [k(e, 1), I(e, v)], o, o, o, o);
}
function tr(e, r, t, n2) {
  return c(t ? 11 : 10, e, o, o, o, n2, o, o, o, o, Oe(r), o);
}
function nr(e, r, t, n2) {
  return c(8, r, o, o, o, o, { k: t, v: n2 }, o, k(e, 0), o, o, o);
}
function ht(e, r, t) {
  return c(22, r, t, o, o, o, o, o, k(e, 1), o, o, o);
}
function or(e, r, t) {
  let n2 = new Uint8Array(t), a = "";
  for (let s = 0, i = n2.length; s < i; s++) a += String.fromCharCode(n2[s]);
  return c(19, r, y(btoa(a)), o, o, o, o, o, k(e, 5), o, o, o);
}
function ne(e, r) {
  return { base: pe(e, r), child: void 0 };
}
var _r = class {
  constructor(r, t) {
    this._p = r;
    this.depth = t;
  }
  parse(r) {
    return N(this._p, this.depth, r);
  }
};
async function Rn(e, r, t) {
  let n2 = [];
  for (let a = 0, s = t.length; a < s; a++) a in t ? n2[a] = await N(e, r, t[a]) : n2[a] = 0;
  return n2;
}
async function Pn(e, r, t, n2) {
  return _e(t, n2, await Rn(e, r, n2));
}
async function kr(e, r, t) {
  let n2 = Object.entries(t), a = [], s = [];
  for (let i = 0, u = n2.length; i < u; i++) a.push(y(n2[i][0])), s.push(await N(e, r, n2[i][1]));
  return C in t && (a.push(I(e.base, C)), s.push(Ue(er(e.base), await N(e, r, $e(t))))), v in t && (a.push(I(e.base, v)), s.push(je(rr(e.base), await N(e, r, Xe(t))))), P$1 in t && (a.push(I(e.base, P$1)), s.push(X(t[P$1]))), R in t && (a.push(I(e.base, R)), s.push(t[R] ? J : Z)), { k: a, v: s };
}
async function zr(e, r, t, n2, a) {
  return tr(t, n2, a, await kr(e, r, n2));
}
async function xn(e, r, t, n2) {
  return ke(t, await N(e, r, n2.valueOf()));
}
async function On(e, r, t, n2) {
  return De(t, n2, await N(e, r, n2.buffer));
}
async function Tn(e, r, t, n2) {
  return Fe(t, n2, await N(e, r, n2.buffer));
}
async function wn(e, r, t, n2) {
  return Be(t, n2, await N(e, r, n2.buffer));
}
async function zt(e, r, t, n2) {
  let a = $(n2, e.base.features);
  return Ve(t, n2, a ? await kr(e, r, a) : o);
}
async function hn(e, r, t, n2) {
  let a = $(n2, e.base.features);
  return Me(t, n2, a ? await kr(e, r, a) : o);
}
async function zn(e, r, t, n2) {
  let a = [], s = [];
  for (let [i, u] of n2.entries()) a.push(await N(e, r, i)), s.push(await N(e, r, u));
  return nr(e.base, t, a, s);
}
async function _n(e, r, t, n2) {
  let a = [];
  for (let s of n2.keys()) a.push(await N(e, r, s));
  return Le(t, a);
}
async function _t(e, r, t, n2) {
  let a = e.base.plugins;
  if (a) for (let s = 0, i = a.length; s < i; s++) {
    let u = a[s];
    if (u.parse.async && u.test(n2)) return fe(t, u.tag, await u.parse.async(n2, new _r(e, r), { id: t }));
  }
  return o;
}
async function kn(e, r, t, n2) {
  let [a, s] = await wr(n2);
  return c(12, t, a, o, o, o, o, o, await N(e, r, s), o, o, o);
}
function Dn(e, r, t, n2, a) {
  let s = [], i = t.on({ next: (u) => {
    de(this.base, r), N(this, e, u).then((l) => {
      s.push(qe(r, l));
    }, (l) => {
      a(l), i();
    });
  }, throw: (u) => {
    de(this.base, r), N(this, e, u).then((l) => {
      s.push(We(r, l)), n2(s), i();
    }, (l) => {
      a(l), i();
    });
  }, return: (u) => {
    de(this.base, r), N(this, e, u).then((l) => {
      s.push(Ge(r, l)), n2(s), i();
    }, (l) => {
      a(l), i();
    });
  } });
}
async function Fn(e, r, t, n2) {
  return Ye(t, k(e.base, 4), await new Promise(Dn.bind(e, r, t, n2)));
}
async function Bn(e, r, t, n2) {
  let a = [];
  for (let s = 0, i = n2.v.length; s < i; s++) a[s] = await N(e, r, n2.v[s]);
  return Ke(t, a, n2.t, n2.d);
}
async function Vn(e, r, t, n2) {
  if (Array.isArray(n2)) return Pn(e, r, t, n2);
  if (M(n2)) return Fn(e, r, t, n2);
  if (Ze(n2)) return Bn(e, r, t, n2);
  let a = n2.constructor;
  if (a === Y) return N(e, r, n2.replacement);
  let s = await _t(e, r, t, n2);
  if (s) return s;
  switch (a) {
    case Object:
      return zr(e, r, t, n2, false);
    case o:
      return zr(e, r, t, n2, true);
    case Date:
      return he(t, n2);
    case Error:
    case EvalError:
    case RangeError:
    case ReferenceError:
    case SyntaxError:
    case TypeError:
    case URIError:
      return zt(e, r, t, n2);
    case Number:
    case Boolean:
    case String:
    case BigInt:
      return xn(e, r, t, n2);
    case ArrayBuffer:
      return or(e.base, t, n2);
    case Int8Array:
    case Int16Array:
    case Int32Array:
    case Uint8Array:
    case Uint16Array:
    case Uint32Array:
    case Uint8ClampedArray:
    case Float32Array:
    case Float64Array:
      return On(e, r, t, n2);
    case DataView:
      return wn(e, r, t, n2);
    case Map:
      return zn(e, r, t, n2);
    case Set:
      return _n(e, r, t, n2);
  }
  if (a === Promise || n2 instanceof Promise) return kn(e, r, t, n2);
  let i = e.base.features;
  if (i & 32 && a === RegExp) return ze(t, n2);
  if (i & 16) switch (a) {
    case BigInt64Array:
    case BigUint64Array:
      return Tn(e, r, t, n2);
  }
  if (i & 1 && typeof AggregateError != "undefined" && (a === AggregateError || n2 instanceof AggregateError)) return hn(e, r, t, n2);
  if (n2 instanceof Error) return zt(e, r, t, n2);
  if (C in n2 || v in n2) return zr(e, r, t, n2, !!a);
  throw new x$1(n2);
}
async function Mn(e, r, t) {
  let n2 = q(e.base, t);
  if (n2.type !== 0) return n2.value;
  let a = await _t(e, r, n2.value, t);
  if (a) return a;
  throw new x$1(t);
}
async function N(e, r, t) {
  switch (typeof t) {
    case "boolean":
      return t ? J : Z;
    case "undefined":
      return Ae;
    case "string":
      return X(t);
    case "number":
      return Te(t);
    case "bigint":
      return we(t);
    case "object": {
      if (t) {
        let n2 = q(e.base, t);
        return n2.type === 0 ? await Vn(e, r + 1, n2.value, t) : n2.value;
      }
      return Ee;
    }
    case "symbol":
      return I(e.base, t);
    case "function":
      return Mn(e, r, t);
    default:
      throw new x$1(t);
  }
}
async function oe(e, r) {
  try {
    return await N(e, 0, r);
  } catch (t) {
    throw t instanceof z ? t : new z(t);
  }
}
var ae = ((t) => (t[t.Vanilla = 1] = "Vanilla", t[t.Cross = 2] = "Cross", t))(ae || {});
function ni(e) {
  return e;
}
function kt(e, r) {
  for (let t = 0, n2 = r.length; t < n2; t++) {
    let a = r[t];
    e.has(a) || (e.add(a), a.extends && kt(e, a.extends));
  }
}
function A(e) {
  if (e) {
    let r = /* @__PURE__ */ new Set();
    return kt(r, e), [...r];
  }
}
function Dt(e) {
  switch (e) {
    case "Int8Array":
      return Int8Array;
    case "Int16Array":
      return Int16Array;
    case "Int32Array":
      return Int32Array;
    case "Uint8Array":
      return Uint8Array;
    case "Uint16Array":
      return Uint16Array;
    case "Uint32Array":
      return Uint32Array;
    case "Uint8ClampedArray":
      return Uint8ClampedArray;
    case "Float32Array":
      return Float32Array;
    case "Float64Array":
      return Float64Array;
    case "BigInt64Array":
      return BigInt64Array;
    case "BigUint64Array":
      return BigUint64Array;
    default:
      throw new Je(e);
  }
}
var Ln = 1e6, Un = 1e4, jn = 2e4;
function Bt(e, r) {
  switch (r) {
    case 3:
      return Object.freeze(e);
    case 1:
      return Object.preventExtensions(e);
    case 2:
      return Object.seal(e);
    default:
      return e;
  }
}
var Yn = 1e3;
function Vt(e, r) {
  var t;
  return { mode: e, plugins: r.plugins, refs: r.refs || /* @__PURE__ */ new Map(), features: (t = r.features) != null ? t : 63 ^ (r.disabledFeatures || 0), depthLimit: r.depthLimit || Yn };
}
function Mt(e) {
  return { mode: 1, base: Vt(1, e), child: o, state: { marked: new Set(e.markedRefs) } };
}
var Dr = class {
  constructor(r, t) {
    this._p = r;
    this.depth = t;
  }
  deserialize(r) {
    return p$1(this._p, this.depth, r);
  }
};
function Ut(e, r) {
  if (r < 0 || !Number.isFinite(r) || !Number.isInteger(r)) throw new h({ t: 4, i: r });
  if (e.refs.has(r)) throw new Error("Conflicted ref id: " + r);
}
function qn(e, r, t) {
  return Ut(e.base, r), e.state.marked.has(r) && e.base.refs.set(r, t), t;
}
function Wn(e, r, t) {
  return Ut(e.base, r), e.base.refs.set(r, t), t;
}
function b(e, r, t) {
  return e.mode === 1 ? qn(e, r, t) : Wn(e, r, t);
}
function Fr(e, r, t) {
  if (Object.hasOwn(r, t)) return r[t];
  throw new h(e);
}
function Gn(e, r) {
  return b(e, r.i, ft(D(r.s)));
}
function Kn(e, r, t) {
  let n2 = t.a, a = n2.length, s = b(e, t.i, new Array(a));
  for (let i = 0, u; i < a; i++) u = n2[i], u && (s[i] = p$1(e, r, u));
  return Bt(s, t.o), s;
}
function Hn(e) {
  switch (e) {
    case "constructor":
    case "__proto__":
    case "prototype":
    case "__defineGetter__":
    case "__defineSetter__":
    case "__lookupGetter__":
    case "__lookupSetter__":
      return false;
    default:
      return true;
  }
}
function Jn(e) {
  switch (e) {
    case v:
    case R:
    case P$1:
    case C:
      return true;
    default:
      return false;
  }
}
function Ft(e, r, t) {
  Hn(r) ? e[r] = t : Object.defineProperty(e, r, { value: t, configurable: true, enumerable: true, writable: true });
}
function Zn(e, r, t, n2, a) {
  if (typeof n2 == "string") Ft(t, D(n2), p$1(e, r, a));
  else {
    let s = p$1(e, r, n2);
    switch (typeof s) {
      case "string":
        Ft(t, s, p$1(e, r, a));
        break;
      case "symbol":
        Jn(s) && (t[s] = p$1(e, r, a));
        break;
      default:
        throw new h(n2);
    }
  }
}
function jt(e, r, t, n2) {
  let a = t.k;
  if (a.length > 0) for (let i = 0, u = t.v, l = a.length; i < l; i++) Zn(e, r, n2, a[i], u[i]);
  return n2;
}
function $n(e, r, t) {
  let n2 = b(e, t.i, t.t === 10 ? {} : /* @__PURE__ */ Object.create(null));
  return jt(e, r, t.p, n2), Bt(n2, t.o), n2;
}
function Xn(e, r) {
  return b(e, r.i, new Date(r.s));
}
function Qn(e, r) {
  if (e.base.features & 32) {
    let t = D(r.c);
    if (t.length > jn) throw new h(r);
    return b(e, r.i, new RegExp(t, r.m));
  }
  throw new w$1(r);
}
function eo(e, r, t) {
  let n2 = b(e, t.i, /* @__PURE__ */ new Set());
  for (let a = 0, s = t.a, i = s.length; a < i; a++) n2.add(p$1(e, r, s[a]));
  return n2;
}
function ro(e, r, t) {
  let n2 = b(e, t.i, /* @__PURE__ */ new Map());
  for (let a = 0, s = t.e.k, i = t.e.v, u = s.length; a < u; a++) n2.set(p$1(e, r, s[a]), p$1(e, r, i[a]));
  return n2;
}
function to(e, r) {
  if (r.s.length > Ln) throw new h(r);
  return b(e, r.i, Or(D(r.s)));
}
function no(e, r, t) {
  var u;
  let n2 = Dt(t.c), a = p$1(e, r, t.f), s = (u = t.b) != null ? u : 0;
  if (s < 0 || s > a.byteLength) throw new h(t);
  return b(e, t.i, new n2(a, s, t.l));
}
function oo(e, r, t) {
  var i;
  let n2 = p$1(e, r, t.f), a = (i = t.b) != null ? i : 0;
  if (a < 0 || a > n2.byteLength) throw new h(t);
  return b(e, t.i, new DataView(n2, a, t.l));
}
function Yt(e, r, t, n2) {
  if (t.p) {
    let a = jt(e, r, t.p, {});
    Object.defineProperties(n2, Object.getOwnPropertyDescriptors(a));
  }
  return n2;
}
function ao(e, r, t) {
  let n2 = b(e, t.i, new AggregateError([], D(t.m)));
  return Yt(e, r, t, n2);
}
function so(e, r, t) {
  let n2 = Fr(t, at, t.s), a = b(e, t.i, new n2(D(t.m)));
  return Yt(e, r, t, a);
}
function io(e, r, t) {
  let n2 = re(), a = b(e, t.i, n2.p), s = p$1(e, r, t.f);
  return t.s ? n2.s(s) : n2.f(s), a;
}
function uo(e, r, t) {
  return b(e, t.i, Object(p$1(e, r, t.f)));
}
function lo(e, r, t) {
  let n2 = e.base.plugins;
  if (n2) {
    let a = D(t.c);
    for (let s = 0, i = n2.length; s < i; s++) {
      let u = n2[s];
      if (u.tag === a) return b(e, t.i, u.deserialize(t.s, new Dr(e, r), { id: t.i }));
    }
  }
  throw new Q(t.c);
}
function co(e, r) {
  return b(e, r.i, b(e, r.s, re()).p);
}
function fo(e, r, t) {
  let n2 = e.base.refs.get(t.i);
  if (n2) return n2.s(p$1(e, r, t.a[1])), o;
  throw new V("Promise");
}
function So(e, r, t) {
  let n2 = e.base.refs.get(t.i);
  if (n2) return n2.f(p$1(e, r, t.a[1])), o;
  throw new V("Promise");
}
function mo(e, r, t) {
  p$1(e, r, t.a[0]);
  let n2 = p$1(e, r, t.a[1]);
  return It(n2);
}
function po(e, r, t) {
  p$1(e, r, t.a[0]);
  let n2 = p$1(e, r, t.a[1]);
  return Tt(n2);
}
function go(e, r, t) {
  let n2 = b(e, t.i, te()), a = t.a, s = a.length;
  if (s) for (let i = 0; i < s; i++) p$1(e, r, a[i]);
  return n2;
}
function yo(e, r, t) {
  let n2 = e.base.refs.get(t.i);
  if (n2 && M(n2)) return n2.next(p$1(e, r, t.f)), o;
  throw new V("Stream");
}
function No(e, r, t) {
  let n2 = e.base.refs.get(t.i);
  if (n2 && M(n2)) return n2.throw(p$1(e, r, t.f)), o;
  throw new V("Stream");
}
function bo(e, r, t) {
  let n2 = e.base.refs.get(t.i);
  if (n2 && M(n2)) return n2.return(p$1(e, r, t.f)), o;
  throw new V("Stream");
}
function vo(e, r, t) {
  return p$1(e, r, t.f), o;
}
function Co(e, r, t) {
  return p$1(e, r, t.a[1]), o;
}
function Ao(e, r, t) {
  let n2 = b(e, t.i, Tr([], t.s, t.l));
  for (let a = 0, s = t.a.length; a < s; a++) n2.v[a] = p$1(e, r, t.a[a]);
  return n2;
}
function p$1(e, r, t) {
  if (r > e.base.depthLimit) throw new ee$1(e.base.depthLimit);
  switch (r += 1, t.t) {
    case 2:
      return Fr(t, ot, t.s);
    case 0:
      return Number(t.s);
    case 1:
      return D(String(t.s));
    case 3:
      if (String(t.s).length > Un) throw new h(t);
      return BigInt(t.s);
    case 4:
      return e.base.refs.get(t.i);
    case 18:
      return Gn(e, t);
    case 9:
      return Kn(e, r, t);
    case 10:
    case 11:
      return $n(e, r, t);
    case 5:
      return Xn(e, t);
    case 6:
      return Qn(e, t);
    case 7:
      return eo(e, r, t);
    case 8:
      return ro(e, r, t);
    case 19:
      return to(e, t);
    case 16:
    case 15:
      return no(e, r, t);
    case 20:
      return oo(e, r, t);
    case 14:
      return ao(e, r, t);
    case 13:
      return so(e, r, t);
    case 12:
      return io(e, r, t);
    case 17:
      return Fr(t, tt, t.s);
    case 21:
      return uo(e, r, t);
    case 25:
      return lo(e, r, t);
    case 22:
      return co(e, t);
    case 23:
      return fo(e, r, t);
    case 24:
      return So(e, r, t);
    case 28:
      return mo(e, r, t);
    case 30:
      return po(e, r, t);
    case 31:
      return go(e, r, t);
    case 32:
      return yo(e, r, t);
    case 33:
      return No(e, r, t);
    case 34:
      return bo(e, r, t);
    case 27:
      return vo(e, r, t);
    case 29:
      return Co(e, r, t);
    case 35:
      return Ao(e, r, t);
    default:
      throw new w$1(t);
  }
}
function ar(e, r) {
  try {
    return p$1(e, 0, r);
  } catch (t) {
    throw new He(t);
  }
}
var Eo = () => T, Io = Eo.toString(), qt = /=>/.test(Io);
function sr(e, r) {
  return qt ? (e.length === 1 ? e[0] : "(" + e.join(",") + ")") + "=>" + (r.startsWith("{") ? "(" + r + ")" : r) : "function(" + e.join(",") + "){return " + r + "}";
}
function Wt(e, r) {
  return qt ? (e.length === 1 ? e[0] : "(" + e.join(",") + ")") + "=>{" + r + "}" : "function(" + e.join(",") + "){" + r + "}";
}
var Ht = "hjkmoquxzABCDEFGHIJKLNPQRTUVWXYZ$_", Gt = Ht.length, Jt = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$_", Kt = Jt.length;
function Br(e) {
  let r = e % Gt, t = Ht[r];
  for (e = (e - r) / Gt; e > 0; ) r = e % Kt, t += Jt[r], e = (e - r) / Kt;
  return t;
}
var Ro = /^[$A-Z_][0-9A-Z_$]*$/i;
function Vr(e) {
  let r = e[0];
  return (r === "$" || r === "_" || r >= "A" && r <= "Z" || r >= "a" && r <= "z") && Ro.test(e);
}
function ye(e) {
  switch (e.t) {
    case 0:
      return e.s + "=" + e.v;
    case 2:
      return e.s + ".set(" + e.k + "," + e.v + ")";
    case 1:
      return e.s + ".add(" + e.v + ")";
    case 3:
      return e.s + ".delete(" + e.k + ")";
  }
}
function Po(e) {
  let r = [], t = e[0];
  for (let n2 = 1, a = e.length, s, i = t; n2 < a; n2++) s = e[n2], s.t === 0 && s.v === i.v ? t = { t: 0, s: s.s, k: o, v: ye(t) } : s.t === 2 && s.s === i.s ? t = { t: 2, s: ye(t), k: s.k, v: s.v } : s.t === 1 && s.s === i.s ? t = { t: 1, s: ye(t), k: o, v: s.v } : s.t === 3 && s.s === i.s ? t = { t: 3, s: ye(t), k: s.k, v: o } : (r.push(t), t = s), i = s;
  return r.push(t), r;
}
function tn(e) {
  if (e.length) {
    let r = "", t = Po(e);
    for (let n2 = 0, a = t.length; n2 < a; n2++) r += ye(t[n2]) + ",";
    return r;
  }
  return o;
}
var xo = "Object.create(null)", Oo = "new Set", To = "new Map", wo = "Promise.resolve", ho = "Promise.reject", zo = { 3: "Object.freeze", 2: "Object.seal", 1: "Object.preventExtensions", 0: o };
function nn(e, r) {
  return { mode: e, plugins: r.plugins, features: r.features, marked: new Set(r.markedRefs), stack: [], flags: [], assignments: [] };
}
function ur(e) {
  return { mode: 2, base: nn(2, e), state: e, child: o };
}
var Mr = class {
  constructor(r) {
    this._p = r;
  }
  serialize(r) {
    return f(this._p, r);
  }
};
function ko(e, r) {
  let t = e.valid.get(r);
  t == null && (t = e.valid.size, e.valid.set(r, t));
  let n2 = e.vars[t];
  return n2 == null && (n2 = Br(t), e.vars[t] = n2), n2;
}
function Do(e) {
  return ce + "[" + e + "]";
}
function m(e, r) {
  return e.mode === 1 ? ko(e.state, r) : Do(r);
}
function O(e, r) {
  e.marked.add(r);
}
function Lr(e, r) {
  return e.marked.has(r);
}
function jr(e, r, t) {
  r !== 0 && (O(e.base, t), e.base.flags.push({ type: r, value: m(e, t) }));
}
function Fo(e) {
  let r = "";
  for (let t = 0, n2 = e.flags, a = n2.length; t < a; t++) {
    let s = n2[t];
    r += zo[s.type] + "(" + s.value + "),";
  }
  return r;
}
function on(e) {
  let r = tn(e.assignments), t = Fo(e);
  return r ? t ? r + t : r : t;
}
function Yr(e, r, t) {
  e.assignments.push({ t: 0, s: r, k: o, v: t });
}
function Bo(e, r, t) {
  e.base.assignments.push({ t: 1, s: m(e, r), k: o, v: t });
}
function ge(e, r, t, n2) {
  e.base.assignments.push({ t: 2, s: m(e, r), k: t, v: n2 });
}
function Zt(e, r, t) {
  e.base.assignments.push({ t: 3, s: m(e, r), k: t, v: o });
}
function Ne(e, r, t, n2) {
  Yr(e.base, m(e, r) + "[" + t + "]", n2);
}
function Ur(e, r, t, n2) {
  Yr(e.base, m(e, r) + "." + t, n2);
}
function Vo(e, r, t, n2) {
  Yr(e.base, m(e, r) + ".v[" + t + "]", n2);
}
function F(e, r) {
  return r.t === 4 && e.stack.includes(r.i);
}
function se(e, r, t) {
  return e.mode === 1 && !Lr(e.base, r) ? t : m(e, r) + "=" + t;
}
function Mo(e) {
  return U + '.get("' + e.s + '")';
}
function $t(e, r, t, n2) {
  return t ? F(e.base, t) ? (O(e.base, r), Ne(e, r, n2, m(e, t.i)), "") : f(e, t) : "";
}
function Lo(e, r) {
  let t = r.i, n2 = r.a, a = n2.length;
  if (a > 0) {
    e.base.stack.push(t);
    let s = $t(e, t, n2[0], 0), i = s === "";
    for (let u = 1, l; u < a; u++) l = $t(e, t, n2[u], u), s += "," + l, i = l === "";
    return e.base.stack.pop(), jr(e, r.o, r.i), "[" + s + (i ? ",]" : "]");
  }
  return "[]";
}
function Xt(e, r, t, n2) {
  if (typeof t == "string") {
    let a = Number(t), s = a >= 0 && a.toString() === t || Vr(t);
    if (F(e.base, n2)) {
      let i = m(e, n2.i);
      return O(e.base, r.i), s && a !== a ? Ur(e, r.i, t, i) : Ne(e, r.i, s ? t : '"' + t + '"', i), "";
    }
    return (s ? t : '"' + t + '"') + ":" + f(e, n2);
  }
  return "[" + f(e, t) + "]:" + f(e, n2);
}
function an(e, r, t) {
  let n2 = t.k, a = n2.length;
  if (a > 0) {
    let s = t.v;
    e.base.stack.push(r.i);
    let i = Xt(e, r, n2[0], s[0]);
    for (let u = 1, l = i; u < a; u++) l = Xt(e, r, n2[u], s[u]), i += (l && i && ",") + l;
    return e.base.stack.pop(), "{" + i + "}";
  }
  return "{}";
}
function Uo(e, r) {
  return jr(e, r.o, r.i), an(e, r, r.p);
}
function jo(e, r, t, n2) {
  let a = an(e, r, t);
  return a !== "{}" ? "Object.assign(" + n2 + "," + a + ")" : n2;
}
function Yo(e, r, t, n2, a) {
  let s = e.base, i = f(e, a), u = Number(n2), l = u >= 0 && u.toString() === n2 || Vr(n2);
  if (F(s, a)) l && u !== u ? Ur(e, r.i, n2, i) : Ne(e, r.i, l ? n2 : '"' + n2 + '"', i);
  else {
    let g = s.assignments;
    s.assignments = t, l && u !== u ? Ur(e, r.i, n2, i) : Ne(e, r.i, l ? n2 : '"' + n2 + '"', i), s.assignments = g;
  }
}
function qo(e, r, t, n2, a) {
  if (typeof n2 == "string") Yo(e, r, t, n2, a);
  else {
    let s = e.base, i = s.stack;
    s.stack = [];
    let u = f(e, a);
    s.stack = i;
    let l = s.assignments;
    s.assignments = t, Ne(e, r.i, f(e, n2), u), s.assignments = l;
  }
}
function Wo(e, r, t) {
  let n2 = t.k, a = n2.length;
  if (a > 0) {
    let s = [], i = t.v;
    e.base.stack.push(r.i);
    for (let u = 0; u < a; u++) qo(e, r, s, n2[u], i[u]);
    return e.base.stack.pop(), tn(s);
  }
  return o;
}
function qr(e, r, t) {
  if (r.p) {
    let n2 = e.base;
    if (n2.features & 8) t = jo(e, r, r.p, t);
    else {
      O(n2, r.i);
      let a = Wo(e, r, r.p);
      if (a) return "(" + se(e, r.i, t) + "," + a + m(e, r.i) + ")";
    }
  }
  return t;
}
function Go(e, r) {
  return jr(e, r.o, r.i), qr(e, r, xo);
}
function Ko(e) {
  return 'new Date("' + e.s + '")';
}
function Ho(e, r) {
  if (e.base.features & 32) return "/" + r.c + "/" + r.m;
  throw new w$1(r);
}
function Qt(e, r, t) {
  let n2 = e.base;
  return F(n2, t) ? (O(n2, r), Bo(e, r, m(e, t.i)), "") : f(e, t);
}
function Jo(e, r) {
  let t = Oo, n2 = r.a, a = n2.length, s = r.i;
  if (a > 0) {
    e.base.stack.push(s);
    let i = Qt(e, s, n2[0]);
    for (let u = 1, l = i; u < a; u++) l = Qt(e, s, n2[u]), i += (l && i && ",") + l;
    e.base.stack.pop(), i && (t += "([" + i + "])");
  }
  return t;
}
function en(e, r, t, n2, a) {
  let s = e.base;
  if (F(s, t)) {
    let i = m(e, t.i);
    if (O(s, r), F(s, n2)) {
      let l = m(e, n2.i);
      return ge(e, r, i, l), "";
    }
    if (n2.t !== 4 && n2.i != null && Lr(s, n2.i)) {
      let l = "(" + f(e, n2) + ",[" + a + "," + a + "])";
      return ge(e, r, i, m(e, n2.i)), Zt(e, r, a), l;
    }
    let u = s.stack;
    return s.stack = [], ge(e, r, i, f(e, n2)), s.stack = u, "";
  }
  if (F(s, n2)) {
    let i = m(e, n2.i);
    if (O(s, r), t.t !== 4 && t.i != null && Lr(s, t.i)) {
      let l = "(" + f(e, t) + ",[" + a + "," + a + "])";
      return ge(e, r, m(e, t.i), i), Zt(e, r, a), l;
    }
    let u = s.stack;
    return s.stack = [], ge(e, r, f(e, t), i), s.stack = u, "";
  }
  return "[" + f(e, t) + "," + f(e, n2) + "]";
}
function Zo(e, r) {
  let t = To, n2 = r.e.k, a = n2.length, s = r.i, i = r.f, u = m(e, i.i), l = e.base;
  if (a > 0) {
    let g = r.e.v;
    l.stack.push(s);
    let S = en(e, s, n2[0], g[0], u);
    for (let d = 1, K = S; d < a; d++) K = en(e, s, n2[d], g[d], u), S += (K && S && ",") + K;
    l.stack.pop(), S && (t += "([" + S + "])");
  }
  return i.t === 26 && (O(l, i.i), t = "(" + f(e, i) + "," + t + ")"), t;
}
function $o(e, r) {
  return W(e, r.f) + '("' + r.s + '")';
}
function Xo(e, r) {
  return "new " + r.c + "(" + f(e, r.f) + "," + r.b + "," + r.l + ")";
}
function Qo(e, r) {
  return "new DataView(" + f(e, r.f) + "," + r.b + "," + r.l + ")";
}
function ea(e, r) {
  let t = r.i;
  e.base.stack.push(t);
  let n2 = qr(e, r, 'new AggregateError([],"' + r.m + '")');
  return e.base.stack.pop(), n2;
}
function ra(e, r) {
  return qr(e, r, "new " + Ce[r.s] + '("' + r.m + '")');
}
function ta(e, r) {
  let t, n2 = r.f, a = r.i, s = r.s ? wo : ho, i = e.base;
  if (F(i, n2)) {
    let u = m(e, n2.i);
    t = s + (r.s ? "().then(" + sr([], u) + ")" : "().catch(" + Wt([], "throw " + u) + ")");
  } else {
    i.stack.push(a);
    let u = f(e, n2);
    i.stack.pop(), t = s + "(" + u + ")";
  }
  return t;
}
function na(e, r) {
  return "Object(" + f(e, r.f) + ")";
}
function W(e, r) {
  let t = f(e, r);
  return r.t === 4 ? t : "(" + t + ")";
}
function oa(e, r) {
  if (e.mode === 1) throw new w$1(r);
  return "(" + se(e, r.s, W(e, r.f) + "()") + ").p";
}
function aa(e, r) {
  if (e.mode === 1) throw new w$1(r);
  return W(e, r.a[0]) + "(" + m(e, r.i) + "," + f(e, r.a[1]) + ")";
}
function sa(e, r) {
  if (e.mode === 1) throw new w$1(r);
  return W(e, r.a[0]) + "(" + m(e, r.i) + "," + f(e, r.a[1]) + ")";
}
function ia(e, r) {
  let t = e.base.plugins;
  if (t) for (let n2 = 0, a = t.length; n2 < a; n2++) {
    let s = t[n2];
    if (s.tag === r.c) return e.child == null && (e.child = new Mr(e)), s.serialize(r.s, e.child, { id: r.i });
  }
  throw new Q(r.c);
}
function ua(e, r) {
  let t = "", n2 = false;
  return r.f.t !== 4 && (O(e.base, r.f.i), t = "(" + f(e, r.f) + ",", n2 = true), t += se(e, r.i, "(" + Ct + ")(" + m(e, r.f.i) + ")"), n2 && (t += ")"), t;
}
function la(e, r) {
  return W(e, r.a[0]) + "(" + f(e, r.a[1]) + ")";
}
function ca(e, r) {
  let t = r.a[0], n2 = r.a[1], a = e.base, s = "";
  t.t !== 4 && (O(a, t.i), s += "(" + f(e, t)), n2.t !== 4 && (O(a, n2.i), s += (s ? "," : "(") + f(e, n2)), s && (s += ",");
  let i = se(e, r.i, "(" + At + ")(" + m(e, n2.i) + "," + m(e, t.i) + ")");
  return s ? s + i + ")" : i;
}
function fa(e, r) {
  return W(e, r.a[0]) + "(" + f(e, r.a[1]) + ")";
}
function Sa(e, r) {
  let t = se(e, r.i, W(e, r.f) + "()"), n2 = r.a.length;
  if (n2) {
    let a = f(e, r.a[0]);
    for (let s = 1; s < n2; s++) a += "," + f(e, r.a[s]);
    return "(" + t + "," + a + "," + m(e, r.i) + ")";
  }
  return t;
}
function ma(e, r) {
  return m(e, r.i) + ".next(" + f(e, r.f) + ")";
}
function pa(e, r) {
  return m(e, r.i) + ".throw(" + f(e, r.f) + ")";
}
function da(e, r) {
  return m(e, r.i) + ".return(" + f(e, r.f) + ")";
}
function rn(e, r, t, n2) {
  let a = e.base;
  return F(a, n2) ? (O(a, r), Vo(e, r, t, m(e, n2.i)), "") : f(e, n2);
}
function ga(e, r) {
  let t = r.a, n2 = t.length, a = r.i;
  if (n2 > 0) {
    e.base.stack.push(a);
    let s = rn(e, a, 0, t[0]);
    for (let i = 1, u = s; i < n2; i++) u = rn(e, a, i, t[i]), s += (u && s && ",") + u;
    if (e.base.stack.pop(), s) return "{__SEROVAL_SEQUENCE__:!0,v:[" + s + "],t:" + r.s + ",d:" + r.l + "}";
  }
  return "{__SEROVAL_SEQUENCE__:!0,v:[],t:-1,d:0}";
}
function ya(e, r) {
  switch (r.t) {
    case 17:
      return rt[r.s];
    case 18:
      return Mo(r);
    case 9:
      return Lo(e, r);
    case 10:
      return Uo(e, r);
    case 11:
      return Go(e, r);
    case 5:
      return Ko(r);
    case 6:
      return Ho(e, r);
    case 7:
      return Jo(e, r);
    case 8:
      return Zo(e, r);
    case 19:
      return $o(e, r);
    case 16:
    case 15:
      return Xo(e, r);
    case 20:
      return Qo(e, r);
    case 14:
      return ea(e, r);
    case 13:
      return ra(e, r);
    case 12:
      return ta(e, r);
    case 21:
      return na(e, r);
    case 22:
      return oa(e, r);
    case 25:
      return ia(e, r);
    case 26:
      return Ot[r.s];
    case 35:
      return ga(e, r);
    default:
      throw new w$1(r);
  }
}
function f(e, r) {
  switch (r.t) {
    case 2:
      return nt[r.s];
    case 0:
      return "" + r.s;
    case 1:
      return '"' + r.s + '"';
    case 3:
      return r.s + "n";
    case 4:
      return m(e, r.i);
    case 23:
      return aa(e, r);
    case 24:
      return sa(e, r);
    case 27:
      return ua(e, r);
    case 28:
      return la(e, r);
    case 29:
      return ca(e, r);
    case 30:
      return fa(e, r);
    case 31:
      return Sa(e, r);
    case 32:
      return ma(e, r);
    case 33:
      return pa(e, r);
    case 34:
      return da(e, r);
    default:
      return se(e, r.i, ya(e, r));
  }
}
function cr(e, r) {
  let t = f(e, r), n2 = r.i;
  if (n2 == null) return t;
  let a = on(e.base), s = m(e, n2), i = e.state.scopeId, u = i == null ? "" : ce, l = a ? "(" + t + "," + a + s + ")" : t;
  if (u === "") return r.t === 10 && !a ? "(" + l + ")" : l;
  let g = i == null ? "()" : "(" + ce + '["' + y(i) + '"])';
  return "(" + sr([u], l) + ")" + g;
}
var Gr = class {
  constructor(r, t) {
    this._p = r;
    this.depth = t;
  }
  parse(r) {
    return E(this._p, this.depth, r);
  }
}, Kr = class {
  constructor(r, t) {
    this._p = r;
    this.depth = t;
  }
  parse(r) {
    return E(this._p, this.depth, r);
  }
  parseWithError(r) {
    return G(this._p, this.depth, r);
  }
  isAlive() {
    return this._p.state.alive;
  }
  pushPendingState() {
    Xr(this._p);
  }
  popPendingState() {
    be(this._p);
  }
  onParse(r) {
    ie(this._p, r);
  }
  onError(r) {
    Zr(this._p, r);
  }
};
function Na(e) {
  return { alive: true, pending: 0, initial: true, buffer: [], onParse: e.onParse, onError: e.onError, onDone: e.onDone };
}
function Hr(e) {
  return { type: 2, base: pe(2, e), state: Na(e) };
}
function ba(e, r, t) {
  let n2 = [];
  for (let a = 0, s = t.length; a < s; a++) a in t ? n2[a] = E(e, r, t[a]) : n2[a] = 0;
  return n2;
}
function va(e, r, t, n2) {
  return _e(t, n2, ba(e, r, n2));
}
function Jr(e, r, t) {
  let n2 = Object.entries(t), a = [], s = [];
  for (let i = 0, u = n2.length; i < u; i++) a.push(y(n2[i][0])), s.push(E(e, r, n2[i][1]));
  return C in t && (a.push(I(e.base, C)), s.push(Ue(er(e.base), E(e, r, $e(t))))), v in t && (a.push(I(e.base, v)), s.push(je(rr(e.base), E(e, r, e.type === 1 ? te() : Xe(t))))), P$1 in t && (a.push(I(e.base, P$1)), s.push(X(t[P$1]))), R in t && (a.push(I(e.base, R)), s.push(t[R] ? J : Z)), { k: a, v: s };
}
function Wr(e, r, t, n2, a) {
  return tr(t, n2, a, Jr(e, r, n2));
}
function Ca(e, r, t, n2) {
  return ke(t, E(e, r, n2.valueOf()));
}
function Aa(e, r, t, n2) {
  return De(t, n2, E(e, r, n2.buffer));
}
function Ea(e, r, t, n2) {
  return Fe(t, n2, E(e, r, n2.buffer));
}
function Ia(e, r, t, n2) {
  return Be(t, n2, E(e, r, n2.buffer));
}
function sn(e, r, t, n2) {
  let a = $(n2, e.base.features);
  return Ve(t, n2, a ? Jr(e, r, a) : o);
}
function Ra(e, r, t, n2) {
  let a = $(n2, e.base.features);
  return Me(t, n2, a ? Jr(e, r, a) : o);
}
function Pa(e, r, t, n2) {
  let a = [], s = [];
  for (let [i, u] of n2.entries()) a.push(E(e, r, i)), s.push(E(e, r, u));
  return nr(e.base, t, a, s);
}
function xa(e, r, t, n2) {
  let a = [];
  for (let s of n2.keys()) a.push(E(e, r, s));
  return Le(t, a);
}
function Oa(e, r, t, n2) {
  let a = Ye(t, k(e.base, 4), []);
  return e.type === 1 || (Xr(e), n2.on({ next: (s) => {
    if (e.state.alive) {
      let i = G(e, r, s);
      i && ie(e, qe(t, i));
    }
  }, throw: (s) => {
    if (e.state.alive) {
      let i = G(e, r, s);
      i && ie(e, We(t, i));
    }
    be(e);
  }, return: (s) => {
    if (e.state.alive) {
      let i = G(e, r, s);
      i && ie(e, Ge(t, i));
    }
    be(e);
  } })), a;
}
function Ta(e, r, t) {
  if (this.state.alive) {
    let n2 = G(this, r, t);
    n2 && ie(this, c(23, e, o, o, o, o, o, [k(this.base, 2), n2], o, o, o, o)), be(this);
  }
}
function wa(e, r, t) {
  if (this.state.alive) {
    let n2 = G(this, r, t);
    n2 && ie(this, c(24, e, o, o, o, o, o, [k(this.base, 3), n2], o, o, o, o));
  }
  be(this);
}
function ha(e, r, t, n2) {
  let a = hr(e.base, {});
  return e.type === 2 && (Xr(e), n2.then(Ta.bind(e, a, r), wa.bind(e, a, r))), ht(e.base, t, a);
}
function za(e, r, t, n2, a) {
  for (let s = 0, i = a.length; s < i; s++) {
    let u = a[s];
    if (u.parse.sync && u.test(n2)) return fe(t, u.tag, u.parse.sync(n2, new Gr(e, r), { id: t }));
  }
  return o;
}
function _a(e, r, t, n2, a) {
  for (let s = 0, i = a.length; s < i; s++) {
    let u = a[s];
    if (u.parse.stream && u.test(n2)) return fe(t, u.tag, u.parse.stream(n2, new Kr(e, r), { id: t }));
  }
  return o;
}
function un(e, r, t, n2) {
  let a = e.base.plugins;
  return a ? e.type === 1 ? za(e, r, t, n2, a) : _a(e, r, t, n2, a) : o;
}
function ka(e, r, t, n2) {
  let a = [];
  for (let s = 0, i = n2.v.length; s < i; s++) a[s] = E(e, r, n2.v[s]);
  return Ke(t, a, n2.t, n2.d);
}
function Da(e, r, t, n2, a) {
  switch (a) {
    case Object:
      return Wr(e, r, t, n2, false);
    case o:
      return Wr(e, r, t, n2, true);
    case Date:
      return he(t, n2);
    case Error:
    case EvalError:
    case RangeError:
    case ReferenceError:
    case SyntaxError:
    case TypeError:
    case URIError:
      return sn(e, r, t, n2);
    case Number:
    case Boolean:
    case String:
    case BigInt:
      return Ca(e, r, t, n2);
    case ArrayBuffer:
      return or(e.base, t, n2);
    case Int8Array:
    case Int16Array:
    case Int32Array:
    case Uint8Array:
    case Uint16Array:
    case Uint32Array:
    case Uint8ClampedArray:
    case Float32Array:
    case Float64Array:
      return Aa(e, r, t, n2);
    case DataView:
      return Ia(e, r, t, n2);
    case Map:
      return Pa(e, r, t, n2);
    case Set:
      return xa(e, r, t, n2);
  }
  if (a === Promise || n2 instanceof Promise) return ha(e, r, t, n2);
  let s = e.base.features;
  if (s & 32 && a === RegExp) return ze(t, n2);
  if (s & 16) switch (a) {
    case BigInt64Array:
    case BigUint64Array:
      return Ea(e, r, t, n2);
  }
  if (s & 1 && typeof AggregateError != "undefined" && (a === AggregateError || n2 instanceof AggregateError)) return Ra(e, r, t, n2);
  if (n2 instanceof Error) return sn(e, r, t, n2);
  if (C in n2 || v in n2) return Wr(e, r, t, n2, !!a);
  throw new x$1(n2);
}
function Fa(e, r, t, n2) {
  if (Array.isArray(n2)) return va(e, r, t, n2);
  if (M(n2)) return Oa(e, r, t, n2);
  if (Ze(n2)) return ka(e, r, t, n2);
  let a = n2.constructor;
  if (a === Y) return E(e, r, n2.replacement);
  let s = un(e, r, t, n2);
  return s || Da(e, r, t, n2, a);
}
function Ba(e, r, t) {
  let n2 = q(e.base, t);
  if (n2.type !== 0) return n2.value;
  let a = un(e, r, n2.value, t);
  if (a) return a;
  throw new x$1(t);
}
function E(e, r, t) {
  if (r >= e.base.depthLimit) throw new ee$1(e.base.depthLimit);
  switch (typeof t) {
    case "boolean":
      return t ? J : Z;
    case "undefined":
      return Ae;
    case "string":
      return X(t);
    case "number":
      return Te(t);
    case "bigint":
      return we(t);
    case "object": {
      if (t) {
        let n2 = q(e.base, t);
        return n2.type === 0 ? Fa(e, r + 1, n2.value, t) : n2.value;
      }
      return Ee;
    }
    case "symbol":
      return I(e.base, t);
    case "function":
      return Ba(e, r, t);
    default:
      throw new x$1(t);
  }
}
function ie(e, r) {
  e.state.initial ? e.state.buffer.push(r) : $r(e, r, false);
}
function Zr(e, r) {
  if (e.state.onError) e.state.onError(r);
  else throw r instanceof z ? r : new z(r);
}
function ln(e) {
  e.state.onDone && e.state.onDone();
}
function $r(e, r, t) {
  try {
    e.state.onParse(r, t);
  } catch (n2) {
    Zr(e, n2);
  }
}
function Xr(e) {
  e.state.pending++;
}
function be(e) {
  --e.state.pending <= 0 && ln(e);
}
function G(e, r, t) {
  try {
    return E(e, r, t);
  } catch (n2) {
    return Zr(e, n2), o;
  }
}
function Qr(e, r) {
  let t = G(e, 0, r);
  t && ($r(e, t, true), e.state.initial = false, Va(e, e.state), e.state.pending <= 0 && fr(e));
}
function Va(e, r) {
  for (let t = 0, n2 = r.buffer.length; t < n2; t++) $r(e, r.buffer[t], false);
}
function fr(e) {
  e.state.alive && (ln(e), e.state.alive = false);
}
async function ou(e, r = {}) {
  let t = A(r.plugins), n2 = ne(2, { plugins: t, disabledFeatures: r.disabledFeatures, refs: r.refs });
  return await oe(n2, e);
}
function cn(e, r) {
  let t = A(r.plugins), n2 = Hr({ plugins: t, refs: r.refs, disabledFeatures: r.disabledFeatures, onParse(a, s) {
    let i = ur({ plugins: t, features: n2.base.features, scopeId: r.scopeId, markedRefs: n2.base.marked }), u;
    try {
      u = cr(i, a);
    } catch (l) {
      r.onError && r.onError(l);
      return;
    }
    r.onSerialize(u, s);
  }, onError: r.onError, onDone: r.onDone });
  return Qr(n2, e), fr.bind(null, n2);
}
function au(e, r) {
  let t = A(r.plugins), n2 = Hr({ plugins: t, refs: r.refs, disabledFeatures: r.disabledFeatures, depthLimit: r.depthLimit, onParse: r.onParse, onError: r.onError, onDone: r.onDone });
  return Qr(n2, e), fr.bind(null, n2);
}
function Iu(e, r = {}) {
  var i;
  let t = A(r.plugins), n2 = r.disabledFeatures || 0, a = (i = e.f) != null ? i : 63, s = Mt({ plugins: t, markedRefs: e.m, features: a & ~n2, disabledFeatures: n2 });
  return ar(s, e.t);
}
var n = {}, P = (e) => new ReadableStream({ start: (r) => {
  e.on({ next: (a) => {
    try {
      r.enqueue(a);
    } catch (t) {
    }
  }, throw: (a) => {
    r.error(a);
  }, return: () => {
    try {
      r.close();
    } catch (a) {
    }
  } });
} }), x2 = ni({ tag: "seroval-plugins/web/ReadableStreamFactory", test(e) {
  return e === n;
}, parse: { sync() {
  return n;
}, async async() {
  return await Promise.resolve(n);
}, stream() {
  return n;
} }, serialize() {
  return P.toString();
}, deserialize() {
  return n;
} });
function w2(e) {
  let r = te(), a = e.getReader();
  async function t() {
    try {
      let s = await a.read();
      s.done ? r.return(s.value) : (r.next(s.value), await t());
    } catch (s) {
      r.throw(s);
    }
  }
  return t().catch(() => {
  }), r;
}
var ee2 = ni({ tag: "seroval/plugins/web/ReadableStream", extends: [x2], test(e) {
  return typeof ReadableStream == "undefined" ? false : e instanceof ReadableStream;
}, parse: { sync(e, r) {
  return { factory: r.parse(n), stream: r.parse(te()) };
}, async async(e, r) {
  return { factory: await r.parse(n), stream: await r.parse(w2(e)) };
}, stream(e, r) {
  return { factory: r.parse(n), stream: r.parse(w2(e)) };
} }, serialize(e, r) {
  return "(" + r.serialize(e.factory) + ")(" + r.serialize(e.stream) + ")";
}, deserialize(e, r) {
  let a = r.deserialize(e.stream);
  return P(a);
} }), p = ee2;
var jsxRuntime = { exports: {} };
var reactJsxRuntime_production_min = {};
var hasRequiredReactJsxRuntime_production_min;
function requireReactJsxRuntime_production_min() {
  if (hasRequiredReactJsxRuntime_production_min) return reactJsxRuntime_production_min;
  hasRequiredReactJsxRuntime_production_min = 1;
  var f2 = requireReact(), k2 = /* @__PURE__ */ Symbol.for("react.element"), l = /* @__PURE__ */ Symbol.for("react.fragment"), m2 = Object.prototype.hasOwnProperty, n2 = f2.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, p2 = { key: true, ref: true, __self: true, __source: true };
  function q2(c2, a, g) {
    var b2, d = {}, e = null, h2 = null;
    void 0 !== g && (e = "" + g);
    void 0 !== a.key && (e = "" + a.key);
    void 0 !== a.ref && (h2 = a.ref);
    for (b2 in a) m2.call(a, b2) && !p2.hasOwnProperty(b2) && (d[b2] = a[b2]);
    if (c2 && c2.defaultProps) for (b2 in a = c2.defaultProps, a) void 0 === d[b2] && (d[b2] = a[b2]);
    return { $$typeof: k2, type: c2, key: e, ref: h2, props: d, _owner: n2.current };
  }
  reactJsxRuntime_production_min.Fragment = l;
  reactJsxRuntime_production_min.jsx = q2;
  reactJsxRuntime_production_min.jsxs = q2;
  return reactJsxRuntime_production_min;
}
var hasRequiredJsxRuntime;
function requireJsxRuntime() {
  if (hasRequiredJsxRuntime) return jsxRuntime.exports;
  hasRequiredJsxRuntime = 1;
  {
    jsxRuntime.exports = requireReactJsxRuntime_production_min();
  }
  return jsxRuntime.exports;
}
var jsxRuntimeExports = requireJsxRuntime();
function CatchBoundary(props) {
  const errorComponent = props.errorComponent ?? ErrorComponent;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(CatchBoundaryImpl, {
    getResetKey: props.getResetKey,
    onCatch: props.onCatch,
    children: ({ error, reset }) => {
      if (error) return reactExports.createElement(errorComponent, {
        error,
        reset
      });
      return props.children;
    }
  });
}
var CatchBoundaryImpl = class extends reactExports.Component {
  constructor(..._args) {
    super(..._args);
    this.state = { error: null };
  }
  static getDerivedStateFromProps(props, state) {
    const resetKey = props.getResetKey();
    if (state.error && state.resetKey !== resetKey) return {
      resetKey,
      error: null
    };
    return { resetKey };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  reset() {
    this.setState({ error: null });
  }
  componentDidCatch(error, errorInfo) {
    if (this.props.onCatch) this.props.onCatch(error, errorInfo);
  }
  render() {
    return this.props.children({
      error: this.state.error,
      reset: () => {
        this.reset();
      }
    });
  }
};
function ErrorComponent({ error }) {
  const [show, setShow] = reactExports.useState(false);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", {
    style: {
      padding: ".5rem",
      maxWidth: "100%"
    },
    children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: ".5rem"
        },
        children: [/* @__PURE__ */ jsxRuntimeExports.jsx("strong", {
          style: { fontSize: "1rem" },
          children: "Something went wrong!"
        }), /* @__PURE__ */ jsxRuntimeExports.jsx("button", {
          style: {
            appearance: "none",
            fontSize: ".6em",
            border: "1px solid currentColor",
            padding: ".1rem .2rem",
            fontWeight: "bold",
            borderRadius: ".25rem"
          },
          onClick: () => setShow((d) => !d),
          children: show ? "Hide Error" : "Show Error"
        })]
      }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: ".25rem" } }),
      show ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("pre", {
        style: {
          fontSize: ".7em",
          border: "1px solid red",
          borderRadius: ".25rem",
          padding: ".3rem",
          color: "red",
          overflow: "auto"
        },
        children: error.message ? /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: error.message }) : null
      }) }) : null
    ]
  });
}
function ClientOnly({ children, fallback = null }) {
  return useHydrated() ? /* @__PURE__ */ jsxRuntimeExports.jsx(React2.Fragment, { children }) : /* @__PURE__ */ jsxRuntimeExports.jsx(React2.Fragment, { children: fallback });
}
function useHydrated() {
  return React2.useSyncExternalStore(subscribe, () => true, () => false);
}
function subscribe() {
  return () => {
  };
}
var routerContext = reactExports.createContext(null);
function useRouter(opts) {
  const value = reactExports.useContext(routerContext);
  return value;
}
var matchContext = reactExports.createContext(void 0);
var dummyMatchContext = reactExports.createContext(void 0);
function CatchNotFound(props) {
  const router = useRouter();
  {
    const resetKey = `not-found-${router.stores.location.get().pathname}-${router.stores.status.get()}`;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(CatchBoundary, {
      getResetKey: () => resetKey,
      onCatch: (error, errorInfo) => {
        if (isNotFound$1(error)) props.onCatch?.(error, errorInfo);
        else throw error;
      },
      errorComponent: ({ error }) => {
        if (isNotFound$1(error)) return props.fallback?.(error);
        else throw error;
      },
      children: props.children
    });
  }
}
function DefaultGlobalNotFound() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Not Found" });
}
function SafeFragment(props) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children: props.children });
}
function renderRouteNotFound(router, route, data) {
  if (!route.options.notFoundComponent) {
    if (router.options.defaultNotFoundComponent) return /* @__PURE__ */ jsxRuntimeExports.jsx(router.options.defaultNotFoundComponent, { ...data });
    return /* @__PURE__ */ jsxRuntimeExports.jsx(DefaultGlobalNotFound, {});
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx(route.options.notFoundComponent, { ...data });
}
function getScrollRestorationScriptForRouter(_router) {
  return null;
}
function ScrollRestoration() {
  getScrollRestorationScriptForRouter(useRouter());
  return null;
}
var Match = reactExports.memo(function MatchImpl({ matchId }) {
  const router = useRouter();
  {
    const match2 = router.stores.matchStores.get(matchId)?.get();
    if (!match2) {
      invariant$1();
    }
    const routeId = match2.routeId;
    const parentRouteId = router.routesById[routeId].parentRoute?.id;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(MatchView, {
      router,
      matchId,
      resetKey: router.stores.loadedAt.get(),
      matchState: {
        routeId,
        ssr: match2.ssr,
        _displayPending: match2._displayPending,
        parentRouteId
      }
    });
  }
});
function MatchView({ router, matchId, resetKey, matchState }) {
  const route = router.routesById[matchState.routeId];
  const PendingComponent = route.options.pendingComponent ?? router.options.defaultPendingComponent;
  const pendingElement = PendingComponent ? /* @__PURE__ */ jsxRuntimeExports.jsx(PendingComponent, {}) : null;
  const routeErrorComponent = route.options.errorComponent ?? router.options.defaultErrorComponent;
  const routeOnCatch = route.options.onCatch ?? router.options.defaultOnCatch;
  const routeNotFoundComponent = route.isRoot ? route.options.notFoundComponent ?? router.options.notFoundRoute?.options.component : route.options.notFoundComponent;
  const resolvedNoSsr = matchState.ssr === false || matchState.ssr === "data-only";
  const ResolvedSuspenseBoundary = (!route.isRoot || route.options.wrapInSuspense || resolvedNoSsr) && (route.options.wrapInSuspense ?? PendingComponent ?? (route.options.errorComponent?.preload || resolvedNoSsr)) ? reactExports.Suspense : SafeFragment;
  const ResolvedCatchBoundary = routeErrorComponent ? CatchBoundary : SafeFragment;
  const ResolvedNotFoundBoundary = routeNotFoundComponent ? CatchNotFound : SafeFragment;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(route.isRoot ? route.options.shellComponent ?? SafeFragment : SafeFragment, { children: [/* @__PURE__ */ jsxRuntimeExports.jsx(matchContext.Provider, {
    value: matchId,
    children: /* @__PURE__ */ jsxRuntimeExports.jsx(ResolvedSuspenseBoundary, {
      fallback: pendingElement,
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(ResolvedCatchBoundary, {
        getResetKey: () => resetKey,
        errorComponent: routeErrorComponent || ErrorComponent,
        onCatch: (error, errorInfo) => {
          if (isNotFound$1(error)) {
            error.routeId ??= matchState.routeId;
            throw error;
          }
          routeOnCatch?.(error, errorInfo);
        },
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(ResolvedNotFoundBoundary, {
          fallback: (error) => {
            error.routeId ??= matchState.routeId;
            if (!routeNotFoundComponent || error.routeId && error.routeId !== matchState.routeId || !error.routeId && !route.isRoot) throw error;
            return reactExports.createElement(routeNotFoundComponent, error);
          },
          children: resolvedNoSsr || matchState._displayPending ? /* @__PURE__ */ jsxRuntimeExports.jsx(ClientOnly, {
            fallback: pendingElement,
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(MatchInner, { matchId })
          }) : /* @__PURE__ */ jsxRuntimeExports.jsx(MatchInner, { matchId })
        })
      })
    })
  }), matchState.parentRouteId === rootRouteId$1 ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [/* @__PURE__ */ jsxRuntimeExports.jsx(OnRendered, { resetKey }), router.options.scrollRestoration && isServer ? /* @__PURE__ */ jsxRuntimeExports.jsx(ScrollRestoration, {}) : null] }) : null] });
}
function OnRendered({ resetKey }) {
  useRouter();
  return null;
}
var MatchInner = reactExports.memo(function MatchInnerImpl({ matchId }) {
  const router = useRouter();
  const getMatchPromise = (match2, key2) => {
    return router.getMatch(match2.id)?._nonReactive[key2] ?? match2._nonReactive[key2];
  };
  {
    const match2 = router.stores.matchStores.get(matchId)?.get();
    if (!match2) {
      invariant$1();
    }
    const routeId2 = match2.routeId;
    const route2 = router.routesById[routeId2];
    const remountDeps = (router.routesById[routeId2].options.remountDeps ?? router.options.defaultRemountDeps)?.({
      routeId: routeId2,
      loaderDeps: match2.loaderDeps,
      params: match2._strictParams,
      search: match2._strictSearch
    });
    const key2 = remountDeps ? JSON.stringify(remountDeps) : void 0;
    const Comp = route2.options.component ?? router.options.defaultComponent;
    const out2 = Comp ? /* @__PURE__ */ jsxRuntimeExports.jsx(Comp, {}, key2) : /* @__PURE__ */ jsxRuntimeExports.jsx(Outlet, {});
    if (match2._displayPending) throw getMatchPromise(match2, "displayPendingPromise");
    if (match2._forcePending) throw getMatchPromise(match2, "minPendingPromise");
    if (match2.status === "pending") throw getMatchPromise(match2, "loadPromise");
    if (match2.status === "notFound") {
      if (!isNotFound$1(match2.error)) {
        invariant$1();
      }
      return renderRouteNotFound(router, route2, match2.error);
    }
    if (match2.status === "redirected") {
      if (!isRedirect$1(match2.error)) {
        invariant$1();
      }
      throw getMatchPromise(match2, "loadPromise");
    }
    if (match2.status === "error") return /* @__PURE__ */ jsxRuntimeExports.jsx((route2.options.errorComponent ?? router.options.defaultErrorComponent) || ErrorComponent, {
      error: match2.error,
      reset: void 0,
      info: { componentStack: "" }
    });
    return out2;
  }
});
var Outlet = reactExports.memo(function OutletImpl() {
  const router = useRouter();
  const matchId = reactExports.useContext(matchContext);
  let routeId;
  let parentGlobalNotFound = false;
  let childMatchId;
  {
    const matches = router.stores.matches.get();
    const parentIndex = matchId ? matches.findIndex((match) => match.id === matchId) : -1;
    const parentMatch = parentIndex >= 0 ? matches[parentIndex] : void 0;
    routeId = parentMatch?.routeId;
    parentGlobalNotFound = parentMatch?.globalNotFound ?? false;
    childMatchId = parentIndex >= 0 ? matches[parentIndex + 1]?.id : void 0;
  }
  const route = routeId ? router.routesById[routeId] : void 0;
  const pendingElement = router.options.defaultPendingComponent ? /* @__PURE__ */ jsxRuntimeExports.jsx(router.options.defaultPendingComponent, {}) : null;
  if (parentGlobalNotFound) {
    if (!route) {
      invariant$1();
    }
    return renderRouteNotFound(router, route, void 0);
  }
  if (!childMatchId) return null;
  const nextMatch = /* @__PURE__ */ jsxRuntimeExports.jsx(Match, { matchId: childMatchId });
  if (routeId === rootRouteId$1) return /* @__PURE__ */ jsxRuntimeExports.jsx(reactExports.Suspense, {
    fallback: pendingElement,
    children: nextMatch
  });
  return nextMatch;
});
function Matches() {
  const router = useRouter();
  const PendingComponent = router.routesById[rootRouteId$1].options.pendingComponent ?? router.options.defaultPendingComponent;
  const pendingElement = PendingComponent ? /* @__PURE__ */ jsxRuntimeExports.jsx(PendingComponent, {}) : null;
  const inner = /* @__PURE__ */ jsxRuntimeExports.jsxs(SafeFragment, {
    fallback: pendingElement,
    children: [false, /* @__PURE__ */ jsxRuntimeExports.jsx(MatchesInner, {})]
  });
  return router.options.InnerWrap ? /* @__PURE__ */ jsxRuntimeExports.jsx(router.options.InnerWrap, { children: inner }) : inner;
}
function MatchesInner() {
  const router = useRouter();
  const matchId = router.stores.firstId.get();
  const resetKey = router.stores.loadedAt.get();
  const matchComponent = matchId ? /* @__PURE__ */ jsxRuntimeExports.jsx(Match, { matchId }) : null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(matchContext.Provider, {
    value: matchId,
    children: router.options.disableGlobalCatchBoundary ? matchComponent : /* @__PURE__ */ jsxRuntimeExports.jsx(CatchBoundary, {
      getResetKey: () => resetKey,
      errorComponent: ErrorComponent,
      onCatch: void 0,
      children: matchComponent
    })
  });
}
function RouterContextProvider({ router, children, ...rest }) {
  if (Object.keys(rest).length > 0) router.update({
    ...router.options,
    ...rest,
    context: {
      ...router.options.context,
      ...rest.context
    }
  });
  const provider = /* @__PURE__ */ jsxRuntimeExports.jsx(routerContext.Provider, {
    value: router,
    children
  });
  if (router.options.Wrap) return /* @__PURE__ */ jsxRuntimeExports.jsx(router.options.Wrap, { children: provider });
  return provider;
}
function RouterProvider({ router, ...rest }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(RouterContextProvider, {
    router,
    ...rest,
    children: /* @__PURE__ */ jsxRuntimeExports.jsx(Matches, {})
  });
}
function StartServer(props) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(RouterProvider, { router: props.router });
}
var server_browser = {};
var reactDomServerLegacy_browser_production_min = {};
var hasRequiredReactDomServerLegacy_browser_production_min;
function requireReactDomServerLegacy_browser_production_min() {
  if (hasRequiredReactDomServerLegacy_browser_production_min) return reactDomServerLegacy_browser_production_min;
  hasRequiredReactDomServerLegacy_browser_production_min = 1;
  var aa2 = requireReact();
  function l(a) {
    for (var b2 = "https://reactjs.org/docs/error-decoder.html?invariant=" + a, c2 = 1; c2 < arguments.length; c2++) b2 += "&args[]=" + encodeURIComponent(arguments[c2]);
    return "Minified React error #" + a + "; visit " + b2 + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  var p2 = Object.prototype.hasOwnProperty, fa2 = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/, ha2 = {}, ia2 = {};
  function ja(a) {
    if (p2.call(ia2, a)) return true;
    if (p2.call(ha2, a)) return false;
    if (fa2.test(a)) return ia2[a] = true;
    ha2[a] = true;
    return false;
  }
  function r(a, b2, c2, d, f2, e, g) {
    this.acceptsBooleans = 2 === b2 || 3 === b2 || 4 === b2;
    this.attributeName = d;
    this.attributeNamespace = f2;
    this.mustUseProperty = c2;
    this.propertyName = a;
    this.type = b2;
    this.sanitizeURL = e;
    this.removeEmptyString = g;
  }
  var t = {};
  "children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(a) {
    t[a] = new r(a, 0, false, a, null, false, false);
  });
  [["acceptCharset", "accept-charset"], ["className", "class"], ["htmlFor", "for"], ["httpEquiv", "http-equiv"]].forEach(function(a) {
    var b2 = a[0];
    t[b2] = new r(b2, 1, false, a[1], null, false, false);
  });
  ["contentEditable", "draggable", "spellCheck", "value"].forEach(function(a) {
    t[a] = new r(a, 2, false, a.toLowerCase(), null, false, false);
  });
  ["autoReverse", "externalResourcesRequired", "focusable", "preserveAlpha"].forEach(function(a) {
    t[a] = new r(a, 2, false, a, null, false, false);
  });
  "allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(a) {
    t[a] = new r(a, 3, false, a.toLowerCase(), null, false, false);
  });
  ["checked", "multiple", "muted", "selected"].forEach(function(a) {
    t[a] = new r(a, 3, true, a, null, false, false);
  });
  ["capture", "download"].forEach(function(a) {
    t[a] = new r(a, 4, false, a, null, false, false);
  });
  ["cols", "rows", "size", "span"].forEach(function(a) {
    t[a] = new r(a, 6, false, a, null, false, false);
  });
  ["rowSpan", "start"].forEach(function(a) {
    t[a] = new r(a, 5, false, a.toLowerCase(), null, false, false);
  });
  var ka2 = /[\-:]([a-z])/g;
  function la2(a) {
    return a[1].toUpperCase();
  }
  "accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(a) {
    var b2 = a.replace(
      ka2,
      la2
    );
    t[b2] = new r(b2, 1, false, a, null, false, false);
  });
  "xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(a) {
    var b2 = a.replace(ka2, la2);
    t[b2] = new r(b2, 1, false, a, "http://www.w3.org/1999/xlink", false, false);
  });
  ["xml:base", "xml:lang", "xml:space"].forEach(function(a) {
    var b2 = a.replace(ka2, la2);
    t[b2] = new r(b2, 1, false, a, "http://www.w3.org/XML/1998/namespace", false, false);
  });
  ["tabIndex", "crossOrigin"].forEach(function(a) {
    t[a] = new r(a, 1, false, a.toLowerCase(), null, false, false);
  });
  t.xlinkHref = new r("xlinkHref", 1, false, "xlink:href", "http://www.w3.org/1999/xlink", true, false);
  ["src", "href", "action", "formAction"].forEach(function(a) {
    t[a] = new r(a, 1, false, a.toLowerCase(), null, true, true);
  });
  var u = {
    animationIterationCount: true,
    aspectRatio: true,
    borderImageOutset: true,
    borderImageSlice: true,
    borderImageWidth: true,
    boxFlex: true,
    boxFlexGroup: true,
    boxOrdinalGroup: true,
    columnCount: true,
    columns: true,
    flex: true,
    flexGrow: true,
    flexPositive: true,
    flexShrink: true,
    flexNegative: true,
    flexOrder: true,
    gridArea: true,
    gridRow: true,
    gridRowEnd: true,
    gridRowSpan: true,
    gridRowStart: true,
    gridColumn: true,
    gridColumnEnd: true,
    gridColumnSpan: true,
    gridColumnStart: true,
    fontWeight: true,
    lineClamp: true,
    lineHeight: true,
    opacity: true,
    order: true,
    orphans: true,
    tabSize: true,
    widows: true,
    zIndex: true,
    zoom: true,
    fillOpacity: true,
    floodOpacity: true,
    stopOpacity: true,
    strokeDasharray: true,
    strokeDashoffset: true,
    strokeMiterlimit: true,
    strokeOpacity: true,
    strokeWidth: true
  }, ma2 = ["Webkit", "ms", "Moz", "O"];
  Object.keys(u).forEach(function(a) {
    ma2.forEach(function(b2) {
      b2 = b2 + a.charAt(0).toUpperCase() + a.substring(1);
      u[b2] = u[a];
    });
  });
  var na2 = /["'&<>]/;
  function v2(a) {
    if ("boolean" === typeof a || "number" === typeof a) return "" + a;
    a = "" + a;
    var b2 = na2.exec(a);
    if (b2) {
      var c2 = "", d, f2 = 0;
      for (d = b2.index; d < a.length; d++) {
        switch (a.charCodeAt(d)) {
          case 34:
            b2 = "&quot;";
            break;
          case 38:
            b2 = "&amp;";
            break;
          case 39:
            b2 = "&#x27;";
            break;
          case 60:
            b2 = "&lt;";
            break;
          case 62:
            b2 = "&gt;";
            break;
          default:
            continue;
        }
        f2 !== d && (c2 += a.substring(f2, d));
        f2 = d + 1;
        c2 += b2;
      }
      a = f2 !== d ? c2 + a.substring(f2, d) : c2;
    }
    return a;
  }
  var oa2 = /([A-Z])/g, pa2 = /^ms-/, qa = Array.isArray;
  function w3(a, b2) {
    return { insertionMode: a, selectedValue: b2 };
  }
  function ra2(a, b2, c2) {
    switch (b2) {
      case "select":
        return w3(1, null != c2.value ? c2.value : c2.defaultValue);
      case "svg":
        return w3(2, null);
      case "math":
        return w3(3, null);
      case "foreignObject":
        return w3(1, null);
      case "table":
        return w3(4, null);
      case "thead":
      case "tbody":
      case "tfoot":
        return w3(5, null);
      case "colgroup":
        return w3(7, null);
      case "tr":
        return w3(6, null);
    }
    return 4 <= a.insertionMode || 0 === a.insertionMode ? w3(1, null) : a;
  }
  var sa2 = /* @__PURE__ */ new Map();
  function ta2(a, b2, c2) {
    if ("object" !== typeof c2) throw Error(l(62));
    b2 = true;
    for (var d in c2) if (p2.call(c2, d)) {
      var f2 = c2[d];
      if (null != f2 && "boolean" !== typeof f2 && "" !== f2) {
        if (0 === d.indexOf("--")) {
          var e = v2(d);
          f2 = v2(("" + f2).trim());
        } else {
          e = d;
          var g = sa2.get(e);
          void 0 !== g ? e = g : (g = v2(e.replace(oa2, "-$1").toLowerCase().replace(pa2, "-ms-")), sa2.set(e, g), e = g);
          f2 = "number" === typeof f2 ? 0 === f2 || p2.call(u, d) ? "" + f2 : f2 + "px" : v2(("" + f2).trim());
        }
        b2 ? (b2 = false, a.push(' style="', e, ":", f2)) : a.push(";", e, ":", f2);
      }
    }
    b2 || a.push('"');
  }
  function x3(a, b2, c2, d) {
    switch (c2) {
      case "style":
        ta2(a, b2, d);
        return;
      case "defaultValue":
      case "defaultChecked":
      case "innerHTML":
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
        return;
    }
    if (!(2 < c2.length) || "o" !== c2[0] && "O" !== c2[0] || "n" !== c2[1] && "N" !== c2[1]) {
      if (b2 = t.hasOwnProperty(c2) ? t[c2] : null, null !== b2) {
        switch (typeof d) {
          case "function":
          case "symbol":
            return;
          case "boolean":
            if (!b2.acceptsBooleans) return;
        }
        c2 = b2.attributeName;
        switch (b2.type) {
          case 3:
            d && a.push(" ", c2, '=""');
            break;
          case 4:
            true === d ? a.push(" ", c2, '=""') : false !== d && a.push(" ", c2, '="', v2(d), '"');
            break;
          case 5:
            isNaN(d) || a.push(" ", c2, '="', v2(d), '"');
            break;
          case 6:
            !isNaN(d) && 1 <= d && a.push(" ", c2, '="', v2(d), '"');
            break;
          default:
            b2.sanitizeURL && (d = "" + d), a.push(" ", c2, '="', v2(d), '"');
        }
      } else if (ja(c2)) {
        switch (typeof d) {
          case "function":
          case "symbol":
            return;
          case "boolean":
            if (b2 = c2.toLowerCase().slice(0, 5), "data-" !== b2 && "aria-" !== b2) return;
        }
        a.push(" ", c2, '="', v2(d), '"');
      }
    }
  }
  function y2(a, b2, c2) {
    if (null != b2) {
      if (null != c2) throw Error(l(60));
      if ("object" !== typeof b2 || !("__html" in b2)) throw Error(l(61));
      b2 = b2.__html;
      null !== b2 && void 0 !== b2 && a.push("" + b2);
    }
  }
  function ua2(a) {
    var b2 = "";
    aa2.Children.forEach(a, function(a2) {
      null != a2 && (b2 += a2);
    });
    return b2;
  }
  function va2(a, b2, c2, d) {
    a.push(A2(c2));
    var f2 = c2 = null, e;
    for (e in b2) if (p2.call(b2, e)) {
      var g = b2[e];
      if (null != g) switch (e) {
        case "children":
          c2 = g;
          break;
        case "dangerouslySetInnerHTML":
          f2 = g;
          break;
        default:
          x3(a, d, e, g);
      }
    }
    a.push(">");
    y2(a, f2, c2);
    return "string" === typeof c2 ? (a.push(v2(c2)), null) : c2;
  }
  var wa2 = /^[a-zA-Z][a-zA-Z:_\.\-\d]*$/, xa2 = /* @__PURE__ */ new Map();
  function A2(a) {
    var b2 = xa2.get(a);
    if (void 0 === b2) {
      if (!wa2.test(a)) throw Error(l(65, a));
      b2 = "<" + a;
      xa2.set(a, b2);
    }
    return b2;
  }
  function ya2(a, b2, c2, d, f2) {
    switch (b2) {
      case "select":
        a.push(A2("select"));
        var e = null, g = null;
        for (n2 in c2) if (p2.call(c2, n2)) {
          var h2 = c2[n2];
          if (null != h2) switch (n2) {
            case "children":
              e = h2;
              break;
            case "dangerouslySetInnerHTML":
              g = h2;
              break;
            case "defaultValue":
            case "value":
              break;
            default:
              x3(a, d, n2, h2);
          }
        }
        a.push(">");
        y2(a, g, e);
        return e;
      case "option":
        g = f2.selectedValue;
        a.push(A2("option"));
        var k2 = h2 = null, m2 = null;
        var n2 = null;
        for (e in c2) if (p2.call(c2, e)) {
          var q2 = c2[e];
          if (null != q2) switch (e) {
            case "children":
              h2 = q2;
              break;
            case "selected":
              m2 = q2;
              break;
            case "dangerouslySetInnerHTML":
              n2 = q2;
              break;
            case "value":
              k2 = q2;
            default:
              x3(a, d, e, q2);
          }
        }
        if (null != g) if (c2 = null !== k2 ? "" + k2 : ua2(h2), qa(g)) for (d = 0; d < g.length; d++) {
          if ("" + g[d] === c2) {
            a.push(' selected=""');
            break;
          }
        }
        else "" + g === c2 && a.push(' selected=""');
        else m2 && a.push(' selected=""');
        a.push(">");
        y2(a, n2, h2);
        return h2;
      case "textarea":
        a.push(A2("textarea"));
        n2 = g = e = null;
        for (h2 in c2) if (p2.call(c2, h2) && (k2 = c2[h2], null != k2)) switch (h2) {
          case "children":
            n2 = k2;
            break;
          case "value":
            e = k2;
            break;
          case "defaultValue":
            g = k2;
            break;
          case "dangerouslySetInnerHTML":
            throw Error(l(91));
          default:
            x3(
              a,
              d,
              h2,
              k2
            );
        }
        null === e && null !== g && (e = g);
        a.push(">");
        if (null != n2) {
          if (null != e) throw Error(l(92));
          if (qa(n2) && 1 < n2.length) throw Error(l(93));
          e = "" + n2;
        }
        "string" === typeof e && "\n" === e[0] && a.push("\n");
        null !== e && a.push(v2("" + e));
        return null;
      case "input":
        a.push(A2("input"));
        k2 = n2 = h2 = e = null;
        for (g in c2) if (p2.call(c2, g) && (m2 = c2[g], null != m2)) switch (g) {
          case "children":
          case "dangerouslySetInnerHTML":
            throw Error(l(399, "input"));
          case "defaultChecked":
            k2 = m2;
            break;
          case "defaultValue":
            h2 = m2;
            break;
          case "checked":
            n2 = m2;
            break;
          case "value":
            e = m2;
            break;
          default:
            x3(a, d, g, m2);
        }
        null !== n2 ? x3(a, d, "checked", n2) : null !== k2 && x3(a, d, "checked", k2);
        null !== e ? x3(a, d, "value", e) : null !== h2 && x3(a, d, "value", h2);
        a.push("/>");
        return null;
      case "menuitem":
        a.push(A2("menuitem"));
        for (var C2 in c2) if (p2.call(c2, C2) && (e = c2[C2], null != e)) switch (C2) {
          case "children":
          case "dangerouslySetInnerHTML":
            throw Error(l(400));
          default:
            x3(a, d, C2, e);
        }
        a.push(">");
        return null;
      case "title":
        a.push(A2("title"));
        e = null;
        for (q2 in c2) if (p2.call(c2, q2) && (g = c2[q2], null != g)) switch (q2) {
          case "children":
            e = g;
            break;
          case "dangerouslySetInnerHTML":
            throw Error(l(434));
          default:
            x3(a, d, q2, g);
        }
        a.push(">");
        return e;
      case "listing":
      case "pre":
        a.push(A2(b2));
        g = e = null;
        for (k2 in c2) if (p2.call(c2, k2) && (h2 = c2[k2], null != h2)) switch (k2) {
          case "children":
            e = h2;
            break;
          case "dangerouslySetInnerHTML":
            g = h2;
            break;
          default:
            x3(a, d, k2, h2);
        }
        a.push(">");
        if (null != g) {
          if (null != e) throw Error(l(60));
          if ("object" !== typeof g || !("__html" in g)) throw Error(l(61));
          c2 = g.__html;
          null !== c2 && void 0 !== c2 && ("string" === typeof c2 && 0 < c2.length && "\n" === c2[0] ? a.push("\n", c2) : a.push("" + c2));
        }
        "string" === typeof e && "\n" === e[0] && a.push("\n");
        return e;
      case "area":
      case "base":
      case "br":
      case "col":
      case "embed":
      case "hr":
      case "img":
      case "keygen":
      case "link":
      case "meta":
      case "param":
      case "source":
      case "track":
      case "wbr":
        a.push(A2(b2));
        for (var D2 in c2) if (p2.call(c2, D2) && (e = c2[D2], null != e)) switch (D2) {
          case "children":
          case "dangerouslySetInnerHTML":
            throw Error(l(399, b2));
          default:
            x3(a, d, D2, e);
        }
        a.push("/>");
        return null;
      case "annotation-xml":
      case "color-profile":
      case "font-face":
      case "font-face-src":
      case "font-face-uri":
      case "font-face-format":
      case "font-face-name":
      case "missing-glyph":
        return va2(
          a,
          c2,
          b2,
          d
        );
      case "html":
        return 0 === f2.insertionMode && a.push("<!DOCTYPE html>"), va2(a, c2, b2, d);
      default:
        if (-1 === b2.indexOf("-") && "string" !== typeof c2.is) return va2(a, c2, b2, d);
        a.push(A2(b2));
        g = e = null;
        for (m2 in c2) if (p2.call(c2, m2) && (h2 = c2[m2], null != h2)) switch (m2) {
          case "children":
            e = h2;
            break;
          case "dangerouslySetInnerHTML":
            g = h2;
            break;
          case "style":
            ta2(a, d, h2);
            break;
          case "suppressContentEditableWarning":
          case "suppressHydrationWarning":
            break;
          default:
            ja(m2) && "function" !== typeof h2 && "symbol" !== typeof h2 && a.push(" ", m2, '="', v2(h2), '"');
        }
        a.push(">");
        y2(a, g, e);
        return e;
    }
  }
  function za2(a, b2, c2) {
    a.push('<!--$?--><template id="');
    if (null === c2) throw Error(l(395));
    a.push(c2);
    return a.push('"></template>');
  }
  function Aa2(a, b2, c2, d) {
    switch (c2.insertionMode) {
      case 0:
      case 1:
        return a.push('<div hidden id="'), a.push(b2.segmentPrefix), b2 = d.toString(16), a.push(b2), a.push('">');
      case 2:
        return a.push('<svg aria-hidden="true" style="display:none" id="'), a.push(b2.segmentPrefix), b2 = d.toString(16), a.push(b2), a.push('">');
      case 3:
        return a.push('<math aria-hidden="true" style="display:none" id="'), a.push(b2.segmentPrefix), b2 = d.toString(16), a.push(b2), a.push('">');
      case 4:
        return a.push('<table hidden id="'), a.push(b2.segmentPrefix), b2 = d.toString(16), a.push(b2), a.push('">');
      case 5:
        return a.push('<table hidden><tbody id="'), a.push(b2.segmentPrefix), b2 = d.toString(16), a.push(b2), a.push('">');
      case 6:
        return a.push('<table hidden><tr id="'), a.push(b2.segmentPrefix), b2 = d.toString(16), a.push(b2), a.push('">');
      case 7:
        return a.push('<table hidden><colgroup id="'), a.push(b2.segmentPrefix), b2 = d.toString(16), a.push(b2), a.push('">');
      default:
        throw Error(l(397));
    }
  }
  function Ba2(a, b2) {
    switch (b2.insertionMode) {
      case 0:
      case 1:
        return a.push("</div>");
      case 2:
        return a.push("</svg>");
      case 3:
        return a.push("</math>");
      case 4:
        return a.push("</table>");
      case 5:
        return a.push("</tbody></table>");
      case 6:
        return a.push("</tr></table>");
      case 7:
        return a.push("</colgroup></table>");
      default:
        throw Error(l(397));
    }
  }
  var Ca2 = /[<\u2028\u2029]/g;
  function Da2(a) {
    return JSON.stringify(a).replace(Ca2, function(a2) {
      switch (a2) {
        case "<":
          return "\\u003c";
        case "\u2028":
          return "\\u2028";
        case "\u2029":
          return "\\u2029";
        default:
          throw Error("escapeJSStringsForInstructionScripts encountered a match it does not know how to replace. this means the match regex and the replacement characters are no longer in sync. This is a bug in React");
      }
    });
  }
  function Ea2(a, b2) {
    b2 = void 0 === b2 ? "" : b2;
    return { bootstrapChunks: [], startInlineScript: "<script>", placeholderPrefix: b2 + "P:", segmentPrefix: b2 + "S:", boundaryPrefix: b2 + "B:", idPrefix: b2, nextSuspenseID: 0, sentCompleteSegmentFunction: false, sentCompleteBoundaryFunction: false, sentClientRenderFunction: false, generateStaticMarkup: a };
  }
  function Fa2(a, b2, c2, d) {
    if (c2.generateStaticMarkup) return a.push(v2(b2)), false;
    "" === b2 ? a = d : (d && a.push("<!-- -->"), a.push(v2(b2)), a = true);
    return a;
  }
  var B2 = Object.assign, Ga = /* @__PURE__ */ Symbol.for("react.element"), Ha = /* @__PURE__ */ Symbol.for("react.portal"), Ia2 = /* @__PURE__ */ Symbol.for("react.fragment"), Ja = /* @__PURE__ */ Symbol.for("react.strict_mode"), Ka = /* @__PURE__ */ Symbol.for("react.profiler"), La = /* @__PURE__ */ Symbol.for("react.provider"), Ma = /* @__PURE__ */ Symbol.for("react.context"), Na2 = /* @__PURE__ */ Symbol.for("react.forward_ref"), Oa2 = /* @__PURE__ */ Symbol.for("react.suspense"), Pa2 = /* @__PURE__ */ Symbol.for("react.suspense_list"), Qa = /* @__PURE__ */ Symbol.for("react.memo"), Ra2 = /* @__PURE__ */ Symbol.for("react.lazy"), Sa2 = /* @__PURE__ */ Symbol.for("react.scope"), Ta2 = /* @__PURE__ */ Symbol.for("react.debug_trace_mode"), Ua = /* @__PURE__ */ Symbol.for("react.legacy_hidden"), Va2 = /* @__PURE__ */ Symbol.for("react.default_value"), Wa = Symbol.iterator;
  function Xa(a) {
    if (null == a) return null;
    if ("function" === typeof a) return a.displayName || a.name || null;
    if ("string" === typeof a) return a;
    switch (a) {
      case Ia2:
        return "Fragment";
      case Ha:
        return "Portal";
      case Ka:
        return "Profiler";
      case Ja:
        return "StrictMode";
      case Oa2:
        return "Suspense";
      case Pa2:
        return "SuspenseList";
    }
    if ("object" === typeof a) switch (a.$$typeof) {
      case Ma:
        return (a.displayName || "Context") + ".Consumer";
      case La:
        return (a._context.displayName || "Context") + ".Provider";
      case Na2:
        var b2 = a.render;
        a = a.displayName;
        a || (a = b2.displayName || b2.name || "", a = "" !== a ? "ForwardRef(" + a + ")" : "ForwardRef");
        return a;
      case Qa:
        return b2 = a.displayName || null, null !== b2 ? b2 : Xa(a.type) || "Memo";
      case Ra2:
        b2 = a._payload;
        a = a._init;
        try {
          return Xa(a(b2));
        } catch (c2) {
        }
    }
    return null;
  }
  var Ya = {};
  function Za(a, b2) {
    a = a.contextTypes;
    if (!a) return Ya;
    var c2 = {}, d;
    for (d in a) c2[d] = b2[d];
    return c2;
  }
  var E2 = null;
  function F2(a, b2) {
    if (a !== b2) {
      a.context._currentValue2 = a.parentValue;
      a = a.parent;
      var c2 = b2.parent;
      if (null === a) {
        if (null !== c2) throw Error(l(401));
      } else {
        if (null === c2) throw Error(l(401));
        F2(a, c2);
      }
      b2.context._currentValue2 = b2.value;
    }
  }
  function $a(a) {
    a.context._currentValue2 = a.parentValue;
    a = a.parent;
    null !== a && $a(a);
  }
  function ab(a) {
    var b2 = a.parent;
    null !== b2 && ab(b2);
    a.context._currentValue2 = a.value;
  }
  function bb(a, b2) {
    a.context._currentValue2 = a.parentValue;
    a = a.parent;
    if (null === a) throw Error(l(402));
    a.depth === b2.depth ? F2(a, b2) : bb(a, b2);
  }
  function cb(a, b2) {
    var c2 = b2.parent;
    if (null === c2) throw Error(l(402));
    a.depth === c2.depth ? F2(a, c2) : cb(a, c2);
    b2.context._currentValue2 = b2.value;
  }
  function G2(a) {
    var b2 = E2;
    b2 !== a && (null === b2 ? ab(a) : null === a ? $a(b2) : b2.depth === a.depth ? F2(b2, a) : b2.depth > a.depth ? bb(b2, a) : cb(b2, a), E2 = a);
  }
  var db = { isMounted: function() {
    return false;
  }, enqueueSetState: function(a, b2) {
    a = a._reactInternals;
    null !== a.queue && a.queue.push(b2);
  }, enqueueReplaceState: function(a, b2) {
    a = a._reactInternals;
    a.replace = true;
    a.queue = [b2];
  }, enqueueForceUpdate: function() {
  } };
  function eb(a, b2, c2, d) {
    var f2 = void 0 !== a.state ? a.state : null;
    a.updater = db;
    a.props = c2;
    a.state = f2;
    var e = { queue: [], replace: false };
    a._reactInternals = e;
    var g = b2.contextType;
    a.context = "object" === typeof g && null !== g ? g._currentValue2 : d;
    g = b2.getDerivedStateFromProps;
    "function" === typeof g && (g = g(c2, f2), f2 = null === g || void 0 === g ? f2 : B2({}, f2, g), a.state = f2);
    if ("function" !== typeof b2.getDerivedStateFromProps && "function" !== typeof a.getSnapshotBeforeUpdate && ("function" === typeof a.UNSAFE_componentWillMount || "function" === typeof a.componentWillMount)) if (b2 = a.state, "function" === typeof a.componentWillMount && a.componentWillMount(), "function" === typeof a.UNSAFE_componentWillMount && a.UNSAFE_componentWillMount(), b2 !== a.state && db.enqueueReplaceState(a, a.state, null), null !== e.queue && 0 < e.queue.length) if (b2 = e.queue, g = e.replace, e.queue = null, e.replace = false, g && 1 === b2.length) a.state = b2[0];
    else {
      e = g ? b2[0] : a.state;
      f2 = true;
      for (g = g ? 1 : 0; g < b2.length; g++) {
        var h2 = b2[g];
        h2 = "function" === typeof h2 ? h2.call(a, e, c2, d) : h2;
        null != h2 && (f2 ? (f2 = false, e = B2({}, e, h2)) : B2(e, h2));
      }
      a.state = e;
    }
    else e.queue = null;
  }
  var fb = { id: 1, overflow: "" };
  function gb(a, b2, c2) {
    var d = a.id;
    a = a.overflow;
    var f2 = 32 - H(d) - 1;
    d &= ~(1 << f2);
    c2 += 1;
    var e = 32 - H(b2) + f2;
    if (30 < e) {
      var g = f2 - f2 % 5;
      e = (d & (1 << g) - 1).toString(32);
      d >>= g;
      f2 -= g;
      return { id: 1 << 32 - H(b2) + f2 | c2 << f2 | d, overflow: e + a };
    }
    return { id: 1 << e | c2 << f2 | d, overflow: a };
  }
  var H = Math.clz32 ? Math.clz32 : hb, ib = Math.log, jb = Math.LN2;
  function hb(a) {
    a >>>= 0;
    return 0 === a ? 32 : 31 - (ib(a) / jb | 0) | 0;
  }
  function kb(a, b2) {
    return a === b2 && (0 !== a || 1 / a === 1 / b2) || a !== a && b2 !== b2;
  }
  var lb = "function" === typeof Object.is ? Object.is : kb, I2 = null, ob = null, J2 = null, K = null, L2 = false, M2 = false, N2 = 0, O2 = null, P2 = 0;
  function Q2() {
    if (null === I2) throw Error(l(321));
    return I2;
  }
  function pb() {
    if (0 < P2) throw Error(l(312));
    return { memoizedState: null, queue: null, next: null };
  }
  function qb() {
    null === K ? null === J2 ? (L2 = false, J2 = K = pb()) : (L2 = true, K = J2) : null === K.next ? (L2 = false, K = K.next = pb()) : (L2 = true, K = K.next);
    return K;
  }
  function rb() {
    ob = I2 = null;
    M2 = false;
    J2 = null;
    P2 = 0;
    K = O2 = null;
  }
  function sb(a, b2) {
    return "function" === typeof b2 ? b2(a) : b2;
  }
  function tb(a, b2, c2) {
    I2 = Q2();
    K = qb();
    if (L2) {
      var d = K.queue;
      b2 = d.dispatch;
      if (null !== O2 && (c2 = O2.get(d), void 0 !== c2)) {
        O2.delete(d);
        d = K.memoizedState;
        do
          d = a(d, c2.action), c2 = c2.next;
        while (null !== c2);
        K.memoizedState = d;
        return [d, b2];
      }
      return [K.memoizedState, b2];
    }
    a = a === sb ? "function" === typeof b2 ? b2() : b2 : void 0 !== c2 ? c2(b2) : b2;
    K.memoizedState = a;
    a = K.queue = { last: null, dispatch: null };
    a = a.dispatch = ub.bind(null, I2, a);
    return [K.memoizedState, a];
  }
  function vb(a, b2) {
    I2 = Q2();
    K = qb();
    b2 = void 0 === b2 ? null : b2;
    if (null !== K) {
      var c2 = K.memoizedState;
      if (null !== c2 && null !== b2) {
        var d = c2[1];
        a: if (null === d) d = false;
        else {
          for (var f2 = 0; f2 < d.length && f2 < b2.length; f2++) if (!lb(b2[f2], d[f2])) {
            d = false;
            break a;
          }
          d = true;
        }
        if (d) return c2[0];
      }
    }
    a = a();
    K.memoizedState = [a, b2];
    return a;
  }
  function ub(a, b2, c2) {
    if (25 <= P2) throw Error(l(301));
    if (a === I2) if (M2 = true, a = { action: c2, next: null }, null === O2 && (O2 = /* @__PURE__ */ new Map()), c2 = O2.get(b2), void 0 === c2) O2.set(b2, a);
    else {
      for (b2 = c2; null !== b2.next; ) b2 = b2.next;
      b2.next = a;
    }
  }
  function wb() {
    throw Error(l(394));
  }
  function R2() {
  }
  var xb = { readContext: function(a) {
    return a._currentValue2;
  }, useContext: function(a) {
    Q2();
    return a._currentValue2;
  }, useMemo: vb, useReducer: tb, useRef: function(a) {
    I2 = Q2();
    K = qb();
    var b2 = K.memoizedState;
    return null === b2 ? (a = { current: a }, K.memoizedState = a) : b2;
  }, useState: function(a) {
    return tb(sb, a);
  }, useInsertionEffect: R2, useLayoutEffect: function() {
  }, useCallback: function(a, b2) {
    return vb(function() {
      return a;
    }, b2);
  }, useImperativeHandle: R2, useEffect: R2, useDebugValue: R2, useDeferredValue: function(a) {
    Q2();
    return a;
  }, useTransition: function() {
    Q2();
    return [
      false,
      wb
    ];
  }, useId: function() {
    var a = ob.treeContext;
    var b2 = a.overflow;
    a = a.id;
    a = (a & ~(1 << 32 - H(a) - 1)).toString(32) + b2;
    var c2 = S;
    if (null === c2) throw Error(l(404));
    b2 = N2++;
    a = ":" + c2.idPrefix + "R" + a;
    0 < b2 && (a += "H" + b2.toString(32));
    return a + ":";
  }, useMutableSource: function(a, b2) {
    Q2();
    return b2(a._source);
  }, useSyncExternalStore: function(a, b2, c2) {
    if (void 0 === c2) throw Error(l(407));
    return c2();
  } }, S = null, yb = aa2.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
  function zb(a) {
    console.error(a);
    return null;
  }
  function T2() {
  }
  function Ab(a, b2, c2, d, f2, e, g, h2, k2) {
    var m2 = [], n2 = /* @__PURE__ */ new Set();
    b2 = { destination: null, responseState: b2, progressiveChunkSize: void 0 === d ? 12800 : d, status: 0, fatalError: null, nextSegmentId: 0, allPendingTasks: 0, pendingRootTasks: 0, completedRootSegment: null, abortableTasks: n2, pingedTasks: m2, clientRenderedBoundaries: [], completedBoundaries: [], partialBoundaries: [], onError: void 0 === f2 ? zb : f2, onAllReady: T2, onShellReady: void 0 === g ? T2 : g, onShellError: T2, onFatalError: T2 };
    c2 = U2(b2, 0, null, c2, false, false);
    c2.parentFlushed = true;
    a = Bb(b2, a, null, c2, n2, Ya, null, fb);
    m2.push(a);
    return b2;
  }
  function Bb(a, b2, c2, d, f2, e, g, h2) {
    a.allPendingTasks++;
    null === c2 ? a.pendingRootTasks++ : c2.pendingTasks++;
    var k2 = { node: b2, ping: function() {
      var b3 = a.pingedTasks;
      b3.push(k2);
      1 === b3.length && Cb(a);
    }, blockedBoundary: c2, blockedSegment: d, abortSet: f2, legacyContext: e, context: g, treeContext: h2 };
    f2.add(k2);
    return k2;
  }
  function U2(a, b2, c2, d, f2, e) {
    return { status: 0, id: -1, index: b2, parentFlushed: false, chunks: [], children: [], formatContext: d, boundary: c2, lastPushedText: f2, textEmbedded: e };
  }
  function V2(a, b2) {
    a = a.onError(b2);
    if (null != a && "string" !== typeof a) throw Error('onError returned something with a type other than "string". onError should return a string and may return null or undefined but must not return anything else. It received something of type "' + typeof a + '" instead');
    return a;
  }
  function W2(a, b2) {
    var c2 = a.onShellError;
    c2(b2);
    c2 = a.onFatalError;
    c2(b2);
    null !== a.destination ? (a.status = 2, a.destination.destroy(b2)) : (a.status = 1, a.fatalError = b2);
  }
  function Db(a, b2, c2, d, f2) {
    I2 = {};
    ob = b2;
    N2 = 0;
    for (a = c2(d, f2); M2; ) M2 = false, N2 = 0, P2 += 1, K = null, a = c2(d, f2);
    rb();
    return a;
  }
  function Eb(a, b2, c2, d) {
    var f2 = c2.render(), e = d.childContextTypes;
    if (null !== e && void 0 !== e) {
      var g = b2.legacyContext;
      if ("function" !== typeof c2.getChildContext) d = g;
      else {
        c2 = c2.getChildContext();
        for (var h2 in c2) if (!(h2 in e)) throw Error(l(108, Xa(d) || "Unknown", h2));
        d = B2({}, g, c2);
      }
      b2.legacyContext = d;
      X2(a, b2, f2);
      b2.legacyContext = g;
    } else X2(a, b2, f2);
  }
  function Fb(a, b2) {
    if (a && a.defaultProps) {
      b2 = B2({}, b2);
      a = a.defaultProps;
      for (var c2 in a) void 0 === b2[c2] && (b2[c2] = a[c2]);
      return b2;
    }
    return b2;
  }
  function Gb(a, b2, c2, d, f2) {
    if ("function" === typeof c2) if (c2.prototype && c2.prototype.isReactComponent) {
      f2 = Za(c2, b2.legacyContext);
      var e = c2.contextType;
      e = new c2(d, "object" === typeof e && null !== e ? e._currentValue2 : f2);
      eb(e, c2, d, f2);
      Eb(a, b2, e, c2);
    } else {
      e = Za(c2, b2.legacyContext);
      f2 = Db(a, b2, c2, d, e);
      var g = 0 !== N2;
      if ("object" === typeof f2 && null !== f2 && "function" === typeof f2.render && void 0 === f2.$$typeof) eb(f2, c2, d, e), Eb(a, b2, f2, c2);
      else if (g) {
        d = b2.treeContext;
        b2.treeContext = gb(d, 1, 0);
        try {
          X2(a, b2, f2);
        } finally {
          b2.treeContext = d;
        }
      } else X2(a, b2, f2);
    }
    else if ("string" === typeof c2) {
      f2 = b2.blockedSegment;
      e = ya2(f2.chunks, c2, d, a.responseState, f2.formatContext);
      f2.lastPushedText = false;
      g = f2.formatContext;
      f2.formatContext = ra2(g, c2, d);
      Hb(a, b2, e);
      f2.formatContext = g;
      switch (c2) {
        case "area":
        case "base":
        case "br":
        case "col":
        case "embed":
        case "hr":
        case "img":
        case "input":
        case "keygen":
        case "link":
        case "meta":
        case "param":
        case "source":
        case "track":
        case "wbr":
          break;
        default:
          f2.chunks.push("</", c2, ">");
      }
      f2.lastPushedText = false;
    } else {
      switch (c2) {
        case Ua:
        case Ta2:
        case Ja:
        case Ka:
        case Ia2:
          X2(a, b2, d.children);
          return;
        case Pa2:
          X2(a, b2, d.children);
          return;
        case Sa2:
          throw Error(l(343));
        case Oa2:
          a: {
            c2 = b2.blockedBoundary;
            f2 = b2.blockedSegment;
            e = d.fallback;
            d = d.children;
            g = /* @__PURE__ */ new Set();
            var h2 = { id: null, rootSegmentID: -1, parentFlushed: false, pendingTasks: 0, forceClientRender: false, completedSegments: [], byteSize: 0, fallbackAbortableTasks: g, errorDigest: null }, k2 = U2(a, f2.chunks.length, h2, f2.formatContext, false, false);
            f2.children.push(k2);
            f2.lastPushedText = false;
            var m2 = U2(a, 0, null, f2.formatContext, false, false);
            m2.parentFlushed = true;
            b2.blockedBoundary = h2;
            b2.blockedSegment = m2;
            try {
              if (Hb(
                a,
                b2,
                d
              ), a.responseState.generateStaticMarkup || m2.lastPushedText && m2.textEmbedded && m2.chunks.push("<!-- -->"), m2.status = 1, Y2(h2, m2), 0 === h2.pendingTasks) break a;
            } catch (n2) {
              m2.status = 4, h2.forceClientRender = true, h2.errorDigest = V2(a, n2);
            } finally {
              b2.blockedBoundary = c2, b2.blockedSegment = f2;
            }
            b2 = Bb(a, e, c2, k2, g, b2.legacyContext, b2.context, b2.treeContext);
            a.pingedTasks.push(b2);
          }
          return;
      }
      if ("object" === typeof c2 && null !== c2) switch (c2.$$typeof) {
        case Na2:
          d = Db(a, b2, c2.render, d, f2);
          if (0 !== N2) {
            c2 = b2.treeContext;
            b2.treeContext = gb(c2, 1, 0);
            try {
              X2(a, b2, d);
            } finally {
              b2.treeContext = c2;
            }
          } else X2(a, b2, d);
          return;
        case Qa:
          c2 = c2.type;
          d = Fb(c2, d);
          Gb(a, b2, c2, d, f2);
          return;
        case La:
          f2 = d.children;
          c2 = c2._context;
          d = d.value;
          e = c2._currentValue2;
          c2._currentValue2 = d;
          g = E2;
          E2 = d = { parent: g, depth: null === g ? 0 : g.depth + 1, context: c2, parentValue: e, value: d };
          b2.context = d;
          X2(a, b2, f2);
          a = E2;
          if (null === a) throw Error(l(403));
          d = a.parentValue;
          a.context._currentValue2 = d === Va2 ? a.context._defaultValue : d;
          a = E2 = a.parent;
          b2.context = a;
          return;
        case Ma:
          d = d.children;
          d = d(c2._currentValue2);
          X2(a, b2, d);
          return;
        case Ra2:
          f2 = c2._init;
          c2 = f2(c2._payload);
          d = Fb(c2, d);
          Gb(
            a,
            b2,
            c2,
            d,
            void 0
          );
          return;
      }
      throw Error(l(130, null == c2 ? c2 : typeof c2, ""));
    }
  }
  function X2(a, b2, c2) {
    b2.node = c2;
    if ("object" === typeof c2 && null !== c2) {
      switch (c2.$$typeof) {
        case Ga:
          Gb(a, b2, c2.type, c2.props, c2.ref);
          return;
        case Ha:
          throw Error(l(257));
        case Ra2:
          var d = c2._init;
          c2 = d(c2._payload);
          X2(a, b2, c2);
          return;
      }
      if (qa(c2)) {
        Ib(a, b2, c2);
        return;
      }
      null === c2 || "object" !== typeof c2 ? d = null : (d = Wa && c2[Wa] || c2["@@iterator"], d = "function" === typeof d ? d : null);
      if (d && (d = d.call(c2))) {
        c2 = d.next();
        if (!c2.done) {
          var f2 = [];
          do
            f2.push(c2.value), c2 = d.next();
          while (!c2.done);
          Ib(a, b2, f2);
        }
        return;
      }
      a = Object.prototype.toString.call(c2);
      throw Error(l(31, "[object Object]" === a ? "object with keys {" + Object.keys(c2).join(", ") + "}" : a));
    }
    "string" === typeof c2 ? (d = b2.blockedSegment, d.lastPushedText = Fa2(b2.blockedSegment.chunks, c2, a.responseState, d.lastPushedText)) : "number" === typeof c2 && (d = b2.blockedSegment, d.lastPushedText = Fa2(b2.blockedSegment.chunks, "" + c2, a.responseState, d.lastPushedText));
  }
  function Ib(a, b2, c2) {
    for (var d = c2.length, f2 = 0; f2 < d; f2++) {
      var e = b2.treeContext;
      b2.treeContext = gb(e, d, f2);
      try {
        Hb(a, b2, c2[f2]);
      } finally {
        b2.treeContext = e;
      }
    }
  }
  function Hb(a, b2, c2) {
    var d = b2.blockedSegment.formatContext, f2 = b2.legacyContext, e = b2.context;
    try {
      return X2(a, b2, c2);
    } catch (k2) {
      if (rb(), "object" === typeof k2 && null !== k2 && "function" === typeof k2.then) {
        c2 = k2;
        var g = b2.blockedSegment, h2 = U2(a, g.chunks.length, null, g.formatContext, g.lastPushedText, true);
        g.children.push(h2);
        g.lastPushedText = false;
        a = Bb(a, b2.node, b2.blockedBoundary, h2, b2.abortSet, b2.legacyContext, b2.context, b2.treeContext).ping;
        c2.then(a, a);
        b2.blockedSegment.formatContext = d;
        b2.legacyContext = f2;
        b2.context = e;
        G2(e);
      } else throw b2.blockedSegment.formatContext = d, b2.legacyContext = f2, b2.context = e, G2(e), k2;
    }
  }
  function Jb(a) {
    var b2 = a.blockedBoundary;
    a = a.blockedSegment;
    a.status = 3;
    Kb(this, b2, a);
  }
  function Lb(a, b2, c2) {
    var d = a.blockedBoundary;
    a.blockedSegment.status = 3;
    null === d ? (b2.allPendingTasks--, 2 !== b2.status && (b2.status = 2, null !== b2.destination && b2.destination.push(null))) : (d.pendingTasks--, d.forceClientRender || (d.forceClientRender = true, a = void 0 === c2 ? Error(l(432)) : c2, d.errorDigest = b2.onError(a), d.parentFlushed && b2.clientRenderedBoundaries.push(d)), d.fallbackAbortableTasks.forEach(function(a2) {
      return Lb(a2, b2, c2);
    }), d.fallbackAbortableTasks.clear(), b2.allPendingTasks--, 0 === b2.allPendingTasks && (d = b2.onAllReady, d()));
  }
  function Y2(a, b2) {
    if (0 === b2.chunks.length && 1 === b2.children.length && null === b2.children[0].boundary) {
      var c2 = b2.children[0];
      c2.id = b2.id;
      c2.parentFlushed = true;
      1 === c2.status && Y2(a, c2);
    } else a.completedSegments.push(b2);
  }
  function Kb(a, b2, c2) {
    if (null === b2) {
      if (c2.parentFlushed) {
        if (null !== a.completedRootSegment) throw Error(l(389));
        a.completedRootSegment = c2;
      }
      a.pendingRootTasks--;
      0 === a.pendingRootTasks && (a.onShellError = T2, b2 = a.onShellReady, b2());
    } else b2.pendingTasks--, b2.forceClientRender || (0 === b2.pendingTasks ? (c2.parentFlushed && 1 === c2.status && Y2(b2, c2), b2.parentFlushed && a.completedBoundaries.push(b2), b2.fallbackAbortableTasks.forEach(Jb, a), b2.fallbackAbortableTasks.clear()) : c2.parentFlushed && 1 === c2.status && (Y2(b2, c2), 1 === b2.completedSegments.length && b2.parentFlushed && a.partialBoundaries.push(b2)));
    a.allPendingTasks--;
    0 === a.allPendingTasks && (a = a.onAllReady, a());
  }
  function Cb(a) {
    if (2 !== a.status) {
      var b2 = E2, c2 = yb.current;
      yb.current = xb;
      var d = S;
      S = a.responseState;
      try {
        var f2 = a.pingedTasks, e;
        for (e = 0; e < f2.length; e++) {
          var g = f2[e];
          var h2 = a, k2 = g.blockedSegment;
          if (0 === k2.status) {
            G2(g.context);
            try {
              X2(h2, g, g.node), h2.responseState.generateStaticMarkup || k2.lastPushedText && k2.textEmbedded && k2.chunks.push("<!-- -->"), g.abortSet.delete(g), k2.status = 1, Kb(h2, g.blockedBoundary, k2);
            } catch (z2) {
              if (rb(), "object" === typeof z2 && null !== z2 && "function" === typeof z2.then) {
                var m2 = g.ping;
                z2.then(m2, m2);
              } else {
                g.abortSet.delete(g);
                k2.status = 4;
                var n2 = g.blockedBoundary, q2 = z2, C2 = V2(h2, q2);
                null === n2 ? W2(h2, q2) : (n2.pendingTasks--, n2.forceClientRender || (n2.forceClientRender = true, n2.errorDigest = C2, n2.parentFlushed && h2.clientRenderedBoundaries.push(n2)));
                h2.allPendingTasks--;
                if (0 === h2.allPendingTasks) {
                  var D2 = h2.onAllReady;
                  D2();
                }
              }
            } finally {
            }
          }
        }
        f2.splice(0, e);
        null !== a.destination && Mb(a, a.destination);
      } catch (z2) {
        V2(a, z2), W2(a, z2);
      } finally {
        S = d, yb.current = c2, c2 === xb && G2(b2);
      }
    }
  }
  function Z2(a, b2, c2) {
    c2.parentFlushed = true;
    switch (c2.status) {
      case 0:
        var d = c2.id = a.nextSegmentId++;
        c2.lastPushedText = false;
        c2.textEmbedded = false;
        a = a.responseState;
        b2.push('<template id="');
        b2.push(a.placeholderPrefix);
        a = d.toString(16);
        b2.push(a);
        return b2.push('"></template>');
      case 1:
        c2.status = 2;
        var f2 = true;
        d = c2.chunks;
        var e = 0;
        c2 = c2.children;
        for (var g = 0; g < c2.length; g++) {
          for (f2 = c2[g]; e < f2.index; e++) b2.push(d[e]);
          f2 = Nb(a, b2, f2);
        }
        for (; e < d.length - 1; e++) b2.push(d[e]);
        e < d.length && (f2 = b2.push(d[e]));
        return f2;
      default:
        throw Error(l(390));
    }
  }
  function Nb(a, b2, c2) {
    var d = c2.boundary;
    if (null === d) return Z2(a, b2, c2);
    d.parentFlushed = true;
    if (d.forceClientRender) return a.responseState.generateStaticMarkup || (d = d.errorDigest, b2.push("<!--$!-->"), b2.push("<template"), d && (b2.push(' data-dgst="'), d = v2(d), b2.push(d), b2.push('"')), b2.push("></template>")), Z2(a, b2, c2), a = a.responseState.generateStaticMarkup ? true : b2.push("<!--/$-->"), a;
    if (0 < d.pendingTasks) {
      d.rootSegmentID = a.nextSegmentId++;
      0 < d.completedSegments.length && a.partialBoundaries.push(d);
      var f2 = a.responseState;
      var e = f2.nextSuspenseID++;
      f2 = f2.boundaryPrefix + e.toString(16);
      d = d.id = f2;
      za2(b2, a.responseState, d);
      Z2(a, b2, c2);
      return b2.push("<!--/$-->");
    }
    if (d.byteSize > a.progressiveChunkSize) return d.rootSegmentID = a.nextSegmentId++, a.completedBoundaries.push(d), za2(b2, a.responseState, d.id), Z2(a, b2, c2), b2.push("<!--/$-->");
    a.responseState.generateStaticMarkup || b2.push("<!--$-->");
    c2 = d.completedSegments;
    if (1 !== c2.length) throw Error(l(391));
    Nb(a, b2, c2[0]);
    a = a.responseState.generateStaticMarkup ? true : b2.push("<!--/$-->");
    return a;
  }
  function Ob(a, b2, c2) {
    Aa2(b2, a.responseState, c2.formatContext, c2.id);
    Nb(a, b2, c2);
    return Ba2(b2, c2.formatContext);
  }
  function Pb(a, b2, c2) {
    for (var d = c2.completedSegments, f2 = 0; f2 < d.length; f2++) Qb(a, b2, c2, d[f2]);
    d.length = 0;
    a = a.responseState;
    d = c2.id;
    c2 = c2.rootSegmentID;
    b2.push(a.startInlineScript);
    a.sentCompleteBoundaryFunction ? b2.push('$RC("') : (a.sentCompleteBoundaryFunction = true, b2.push('function $RC(a,b){a=document.getElementById(a);b=document.getElementById(b);b.parentNode.removeChild(b);if(a){a=a.previousSibling;var f=a.parentNode,c=a.nextSibling,e=0;do{if(c&&8===c.nodeType){var d=c.data;if("/$"===d)if(0===e)break;else e--;else"$"!==d&&"$?"!==d&&"$!"!==d||e++}d=c.nextSibling;f.removeChild(c);c=d}while(c);for(;b.firstChild;)f.insertBefore(b.firstChild,c);a.data="$";a._reactRetry&&a._reactRetry()}};$RC("'));
    if (null === d) throw Error(l(395));
    c2 = c2.toString(16);
    b2.push(d);
    b2.push('","');
    b2.push(a.segmentPrefix);
    b2.push(c2);
    return b2.push('")<\/script>');
  }
  function Qb(a, b2, c2, d) {
    if (2 === d.status) return true;
    var f2 = d.id;
    if (-1 === f2) {
      if (-1 === (d.id = c2.rootSegmentID)) throw Error(l(392));
      return Ob(a, b2, d);
    }
    Ob(a, b2, d);
    a = a.responseState;
    b2.push(a.startInlineScript);
    a.sentCompleteSegmentFunction ? b2.push('$RS("') : (a.sentCompleteSegmentFunction = true, b2.push('function $RS(a,b){a=document.getElementById(a);b=document.getElementById(b);for(a.parentNode.removeChild(a);a.firstChild;)b.parentNode.insertBefore(a.firstChild,b);b.parentNode.removeChild(b)};$RS("'));
    b2.push(a.segmentPrefix);
    f2 = f2.toString(16);
    b2.push(f2);
    b2.push('","');
    b2.push(a.placeholderPrefix);
    b2.push(f2);
    return b2.push('")<\/script>');
  }
  function Mb(a, b2) {
    try {
      var c2 = a.completedRootSegment;
      if (null !== c2 && 0 === a.pendingRootTasks) {
        Nb(a, b2, c2);
        a.completedRootSegment = null;
        var d = a.responseState.bootstrapChunks;
        for (c2 = 0; c2 < d.length - 1; c2++) b2.push(d[c2]);
        c2 < d.length && b2.push(d[c2]);
      }
      var f2 = a.clientRenderedBoundaries, e;
      for (e = 0; e < f2.length; e++) {
        var g = f2[e];
        d = b2;
        var h2 = a.responseState, k2 = g.id, m2 = g.errorDigest, n2 = g.errorMessage, q2 = g.errorComponentStack;
        d.push(h2.startInlineScript);
        h2.sentClientRenderFunction ? d.push('$RX("') : (h2.sentClientRenderFunction = true, d.push('function $RX(b,c,d,e){var a=document.getElementById(b);a&&(b=a.previousSibling,b.data="$!",a=a.dataset,c&&(a.dgst=c),d&&(a.msg=d),e&&(a.stck=e),b._reactRetry&&b._reactRetry())};$RX("'));
        if (null === k2) throw Error(l(395));
        d.push(k2);
        d.push('"');
        if (m2 || n2 || q2) {
          d.push(",");
          var C2 = Da2(m2 || "");
          d.push(C2);
        }
        if (n2 || q2) {
          d.push(",");
          var D2 = Da2(n2 || "");
          d.push(D2);
        }
        if (q2) {
          d.push(",");
          var z2 = Da2(q2);
          d.push(z2);
        }
        if (!d.push(")<\/script>")) {
          a.destination = null;
          e++;
          f2.splice(0, e);
          return;
        }
      }
      f2.splice(0, e);
      var ba2 = a.completedBoundaries;
      for (e = 0; e < ba2.length; e++) if (!Pb(a, b2, ba2[e])) {
        a.destination = null;
        e++;
        ba2.splice(0, e);
        return;
      }
      ba2.splice(0, e);
      var ca2 = a.partialBoundaries;
      for (e = 0; e < ca2.length; e++) {
        var mb = ca2[e];
        a: {
          f2 = a;
          g = b2;
          var da2 = mb.completedSegments;
          for (h2 = 0; h2 < da2.length; h2++) if (!Qb(f2, g, mb, da2[h2])) {
            h2++;
            da2.splice(0, h2);
            var nb = false;
            break a;
          }
          da2.splice(0, h2);
          nb = true;
        }
        if (!nb) {
          a.destination = null;
          e++;
          ca2.splice(0, e);
          return;
        }
      }
      ca2.splice(0, e);
      var ea2 = a.completedBoundaries;
      for (e = 0; e < ea2.length; e++) if (!Pb(a, b2, ea2[e])) {
        a.destination = null;
        e++;
        ea2.splice(0, e);
        return;
      }
      ea2.splice(0, e);
    } finally {
      0 === a.allPendingTasks && 0 === a.pingedTasks.length && 0 === a.clientRenderedBoundaries.length && 0 === a.completedBoundaries.length && b2.push(null);
    }
  }
  function Rb(a, b2) {
    try {
      var c2 = a.abortableTasks;
      c2.forEach(function(c3) {
        return Lb(c3, a, b2);
      });
      c2.clear();
      null !== a.destination && Mb(a, a.destination);
    } catch (d) {
      V2(a, d), W2(a, d);
    }
  }
  function Sb() {
  }
  function Tb(a, b2, c2, d) {
    var f2 = false, e = null, g = "", h2 = { push: function(a2) {
      null !== a2 && (g += a2);
      return true;
    }, destroy: function(a2) {
      f2 = true;
      e = a2;
    } }, k2 = false;
    a = Ab(a, Ea2(c2, b2 ? b2.identifierPrefix : void 0), { insertionMode: 1, selectedValue: null }, Infinity, Sb, void 0, function() {
      k2 = true;
    });
    Cb(a);
    Rb(a, d);
    if (1 === a.status) a.status = 2, h2.destroy(a.fatalError);
    else if (2 !== a.status && null === a.destination) {
      a.destination = h2;
      try {
        Mb(a, h2);
      } catch (m2) {
        V2(a, m2), W2(a, m2);
      }
    }
    if (f2) throw e;
    if (!k2) throw Error(l(426));
    return g;
  }
  reactDomServerLegacy_browser_production_min.renderToNodeStream = function() {
    throw Error(l(207));
  };
  reactDomServerLegacy_browser_production_min.renderToStaticMarkup = function(a, b2) {
    return Tb(a, b2, true, 'The server used "renderToStaticMarkup" which does not support Suspense. If you intended to have the server wait for the suspended component please switch to "renderToReadableStream" which supports Suspense on the server');
  };
  reactDomServerLegacy_browser_production_min.renderToStaticNodeStream = function() {
    throw Error(l(208));
  };
  reactDomServerLegacy_browser_production_min.renderToString = function(a, b2) {
    return Tb(a, b2, false, 'The server used "renderToString" which does not support Suspense. If you intended for this Suspense boundary to render the fallback content on the server consider throwing an Error somewhere within the Suspense boundary. If you intended to have the server wait for the suspended component please switch to "renderToReadableStream" which supports Suspense on the server');
  };
  reactDomServerLegacy_browser_production_min.version = "18.2.0";
  return reactDomServerLegacy_browser_production_min;
}
var reactDomServer_browser_production_min = {};
var hasRequiredReactDomServer_browser_production_min;
function requireReactDomServer_browser_production_min() {
  if (hasRequiredReactDomServer_browser_production_min) return reactDomServer_browser_production_min;
  hasRequiredReactDomServer_browser_production_min = 1;
  var aa2 = requireReact();
  function k2(a) {
    for (var b2 = "https://reactjs.org/docs/error-decoder.html?invariant=" + a, c2 = 1; c2 < arguments.length; c2++) b2 += "&args[]=" + encodeURIComponent(arguments[c2]);
    return "Minified React error #" + a + "; visit " + b2 + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  var l = null, n2 = 0;
  function p2(a, b2) {
    if (0 !== b2.length) if (512 < b2.length) 0 < n2 && (a.enqueue(new Uint8Array(l.buffer, 0, n2)), l = new Uint8Array(512), n2 = 0), a.enqueue(b2);
    else {
      var c2 = l.length - n2;
      c2 < b2.length && (0 === c2 ? a.enqueue(l) : (l.set(b2.subarray(0, c2), n2), a.enqueue(l), b2 = b2.subarray(c2)), l = new Uint8Array(512), n2 = 0);
      l.set(b2, n2);
      n2 += b2.length;
    }
  }
  function t(a, b2) {
    p2(a, b2);
    return true;
  }
  function ba2(a) {
    l && 0 < n2 && (a.enqueue(new Uint8Array(l.buffer, 0, n2)), l = null, n2 = 0);
  }
  var ca2 = new TextEncoder();
  function u(a) {
    return ca2.encode(a);
  }
  function w3(a) {
    return ca2.encode(a);
  }
  function da2(a, b2) {
    "function" === typeof a.error ? a.error(b2) : a.close();
  }
  var x3 = Object.prototype.hasOwnProperty, ea2 = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/, fa2 = {}, ha2 = {};
  function ia2(a) {
    if (x3.call(ha2, a)) return true;
    if (x3.call(fa2, a)) return false;
    if (ea2.test(a)) return ha2[a] = true;
    fa2[a] = true;
    return false;
  }
  function y2(a, b2, c2, d, f2, e, g) {
    this.acceptsBooleans = 2 === b2 || 3 === b2 || 4 === b2;
    this.attributeName = d;
    this.attributeNamespace = f2;
    this.mustUseProperty = c2;
    this.propertyName = a;
    this.type = b2;
    this.sanitizeURL = e;
    this.removeEmptyString = g;
  }
  var z2 = {};
  "children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(a) {
    z2[a] = new y2(a, 0, false, a, null, false, false);
  });
  [["acceptCharset", "accept-charset"], ["className", "class"], ["htmlFor", "for"], ["httpEquiv", "http-equiv"]].forEach(function(a) {
    var b2 = a[0];
    z2[b2] = new y2(b2, 1, false, a[1], null, false, false);
  });
  ["contentEditable", "draggable", "spellCheck", "value"].forEach(function(a) {
    z2[a] = new y2(a, 2, false, a.toLowerCase(), null, false, false);
  });
  ["autoReverse", "externalResourcesRequired", "focusable", "preserveAlpha"].forEach(function(a) {
    z2[a] = new y2(a, 2, false, a, null, false, false);
  });
  "allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(a) {
    z2[a] = new y2(a, 3, false, a.toLowerCase(), null, false, false);
  });
  ["checked", "multiple", "muted", "selected"].forEach(function(a) {
    z2[a] = new y2(a, 3, true, a, null, false, false);
  });
  ["capture", "download"].forEach(function(a) {
    z2[a] = new y2(a, 4, false, a, null, false, false);
  });
  ["cols", "rows", "size", "span"].forEach(function(a) {
    z2[a] = new y2(a, 6, false, a, null, false, false);
  });
  ["rowSpan", "start"].forEach(function(a) {
    z2[a] = new y2(a, 5, false, a.toLowerCase(), null, false, false);
  });
  var ja = /[\-:]([a-z])/g;
  function ka2(a) {
    return a[1].toUpperCase();
  }
  "accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(a) {
    var b2 = a.replace(
      ja,
      ka2
    );
    z2[b2] = new y2(b2, 1, false, a, null, false, false);
  });
  "xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(a) {
    var b2 = a.replace(ja, ka2);
    z2[b2] = new y2(b2, 1, false, a, "http://www.w3.org/1999/xlink", false, false);
  });
  ["xml:base", "xml:lang", "xml:space"].forEach(function(a) {
    var b2 = a.replace(ja, ka2);
    z2[b2] = new y2(b2, 1, false, a, "http://www.w3.org/XML/1998/namespace", false, false);
  });
  ["tabIndex", "crossOrigin"].forEach(function(a) {
    z2[a] = new y2(a, 1, false, a.toLowerCase(), null, false, false);
  });
  z2.xlinkHref = new y2("xlinkHref", 1, false, "xlink:href", "http://www.w3.org/1999/xlink", true, false);
  ["src", "href", "action", "formAction"].forEach(function(a) {
    z2[a] = new y2(a, 1, false, a.toLowerCase(), null, true, true);
  });
  var B2 = {
    animationIterationCount: true,
    aspectRatio: true,
    borderImageOutset: true,
    borderImageSlice: true,
    borderImageWidth: true,
    boxFlex: true,
    boxFlexGroup: true,
    boxOrdinalGroup: true,
    columnCount: true,
    columns: true,
    flex: true,
    flexGrow: true,
    flexPositive: true,
    flexShrink: true,
    flexNegative: true,
    flexOrder: true,
    gridArea: true,
    gridRow: true,
    gridRowEnd: true,
    gridRowSpan: true,
    gridRowStart: true,
    gridColumn: true,
    gridColumnEnd: true,
    gridColumnSpan: true,
    gridColumnStart: true,
    fontWeight: true,
    lineClamp: true,
    lineHeight: true,
    opacity: true,
    order: true,
    orphans: true,
    tabSize: true,
    widows: true,
    zIndex: true,
    zoom: true,
    fillOpacity: true,
    floodOpacity: true,
    stopOpacity: true,
    strokeDasharray: true,
    strokeDashoffset: true,
    strokeMiterlimit: true,
    strokeOpacity: true,
    strokeWidth: true
  }, la2 = ["Webkit", "ms", "Moz", "O"];
  Object.keys(B2).forEach(function(a) {
    la2.forEach(function(b2) {
      b2 = b2 + a.charAt(0).toUpperCase() + a.substring(1);
      B2[b2] = B2[a];
    });
  });
  var oa2 = /["'&<>]/;
  function C2(a) {
    if ("boolean" === typeof a || "number" === typeof a) return "" + a;
    a = "" + a;
    var b2 = oa2.exec(a);
    if (b2) {
      var c2 = "", d, f2 = 0;
      for (d = b2.index; d < a.length; d++) {
        switch (a.charCodeAt(d)) {
          case 34:
            b2 = "&quot;";
            break;
          case 38:
            b2 = "&amp;";
            break;
          case 39:
            b2 = "&#x27;";
            break;
          case 60:
            b2 = "&lt;";
            break;
          case 62:
            b2 = "&gt;";
            break;
          default:
            continue;
        }
        f2 !== d && (c2 += a.substring(f2, d));
        f2 = d + 1;
        c2 += b2;
      }
      a = f2 !== d ? c2 + a.substring(f2, d) : c2;
    }
    return a;
  }
  var pa2 = /([A-Z])/g, qa = /^ms-/, ra2 = Array.isArray, sa2 = w3("<script>"), ta2 = w3("<\/script>"), ua2 = w3('<script src="'), va2 = w3('<script type="module" src="'), wa2 = w3('" async=""><\/script>'), xa2 = /(<\/|<)(s)(cript)/gi;
  function ya2(a, b2, c2, d) {
    return "" + b2 + ("s" === c2 ? "\\u0073" : "\\u0053") + d;
  }
  function za2(a, b2, c2, d, f2) {
    a = void 0 === a ? "" : a;
    b2 = void 0 === b2 ? sa2 : w3('<script nonce="' + C2(b2) + '">');
    var e = [];
    void 0 !== c2 && e.push(b2, u(("" + c2).replace(xa2, ya2)), ta2);
    if (void 0 !== d) for (c2 = 0; c2 < d.length; c2++) e.push(ua2, u(C2(d[c2])), wa2);
    if (void 0 !== f2) for (d = 0; d < f2.length; d++) e.push(va2, u(C2(f2[d])), wa2);
    return { bootstrapChunks: e, startInlineScript: b2, placeholderPrefix: w3(a + "P:"), segmentPrefix: w3(a + "S:"), boundaryPrefix: a + "B:", idPrefix: a, nextSuspenseID: 0, sentCompleteSegmentFunction: false, sentCompleteBoundaryFunction: false, sentClientRenderFunction: false };
  }
  function D2(a, b2) {
    return { insertionMode: a, selectedValue: b2 };
  }
  function Aa2(a) {
    return D2("http://www.w3.org/2000/svg" === a ? 2 : "http://www.w3.org/1998/Math/MathML" === a ? 3 : 0, null);
  }
  function Ba2(a, b2, c2) {
    switch (b2) {
      case "select":
        return D2(1, null != c2.value ? c2.value : c2.defaultValue);
      case "svg":
        return D2(2, null);
      case "math":
        return D2(3, null);
      case "foreignObject":
        return D2(1, null);
      case "table":
        return D2(4, null);
      case "thead":
      case "tbody":
      case "tfoot":
        return D2(5, null);
      case "colgroup":
        return D2(7, null);
      case "tr":
        return D2(6, null);
    }
    return 4 <= a.insertionMode || 0 === a.insertionMode ? D2(1, null) : a;
  }
  var Ca2 = w3("<!-- -->");
  function Da2(a, b2, c2, d) {
    if ("" === b2) return d;
    d && a.push(Ca2);
    a.push(u(C2(b2)));
    return true;
  }
  var Ea2 = /* @__PURE__ */ new Map(), Fa2 = w3(' style="'), Ga = w3(":"), Ha = w3(";");
  function Ia2(a, b2, c2) {
    if ("object" !== typeof c2) throw Error(k2(62));
    b2 = true;
    for (var d in c2) if (x3.call(c2, d)) {
      var f2 = c2[d];
      if (null != f2 && "boolean" !== typeof f2 && "" !== f2) {
        if (0 === d.indexOf("--")) {
          var e = u(C2(d));
          f2 = u(C2(("" + f2).trim()));
        } else {
          e = d;
          var g = Ea2.get(e);
          void 0 !== g ? e = g : (g = w3(C2(e.replace(pa2, "-$1").toLowerCase().replace(qa, "-ms-"))), Ea2.set(e, g), e = g);
          f2 = "number" === typeof f2 ? 0 === f2 || x3.call(B2, d) ? u("" + f2) : u(f2 + "px") : u(C2(("" + f2).trim()));
        }
        b2 ? (b2 = false, a.push(Fa2, e, Ga, f2)) : a.push(Ha, e, Ga, f2);
      }
    }
    b2 || a.push(E2);
  }
  var H = w3(" "), I2 = w3('="'), E2 = w3('"'), Ja = w3('=""');
  function J2(a, b2, c2, d) {
    switch (c2) {
      case "style":
        Ia2(a, b2, d);
        return;
      case "defaultValue":
      case "defaultChecked":
      case "innerHTML":
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
        return;
    }
    if (!(2 < c2.length) || "o" !== c2[0] && "O" !== c2[0] || "n" !== c2[1] && "N" !== c2[1]) {
      if (b2 = z2.hasOwnProperty(c2) ? z2[c2] : null, null !== b2) {
        switch (typeof d) {
          case "function":
          case "symbol":
            return;
          case "boolean":
            if (!b2.acceptsBooleans) return;
        }
        c2 = u(b2.attributeName);
        switch (b2.type) {
          case 3:
            d && a.push(H, c2, Ja);
            break;
          case 4:
            true === d ? a.push(H, c2, Ja) : false !== d && a.push(H, c2, I2, u(C2(d)), E2);
            break;
          case 5:
            isNaN(d) || a.push(H, c2, I2, u(C2(d)), E2);
            break;
          case 6:
            !isNaN(d) && 1 <= d && a.push(H, c2, I2, u(C2(d)), E2);
            break;
          default:
            b2.sanitizeURL && (d = "" + d), a.push(H, c2, I2, u(C2(d)), E2);
        }
      } else if (ia2(c2)) {
        switch (typeof d) {
          case "function":
          case "symbol":
            return;
          case "boolean":
            if (b2 = c2.toLowerCase().slice(0, 5), "data-" !== b2 && "aria-" !== b2) return;
        }
        a.push(H, u(c2), I2, u(C2(d)), E2);
      }
    }
  }
  var K = w3(">"), Ka = w3("/>");
  function L2(a, b2, c2) {
    if (null != b2) {
      if (null != c2) throw Error(k2(60));
      if ("object" !== typeof b2 || !("__html" in b2)) throw Error(k2(61));
      b2 = b2.__html;
      null !== b2 && void 0 !== b2 && a.push(u("" + b2));
    }
  }
  function La(a) {
    var b2 = "";
    aa2.Children.forEach(a, function(a2) {
      null != a2 && (b2 += a2);
    });
    return b2;
  }
  var Ma = w3(' selected=""');
  function Na2(a, b2, c2, d) {
    a.push(M2(c2));
    var f2 = c2 = null, e;
    for (e in b2) if (x3.call(b2, e)) {
      var g = b2[e];
      if (null != g) switch (e) {
        case "children":
          c2 = g;
          break;
        case "dangerouslySetInnerHTML":
          f2 = g;
          break;
        default:
          J2(a, d, e, g);
      }
    }
    a.push(K);
    L2(a, f2, c2);
    return "string" === typeof c2 ? (a.push(u(C2(c2))), null) : c2;
  }
  var Oa2 = w3("\n"), Pa2 = /^[a-zA-Z][a-zA-Z:_\.\-\d]*$/, Qa = /* @__PURE__ */ new Map();
  function M2(a) {
    var b2 = Qa.get(a);
    if (void 0 === b2) {
      if (!Pa2.test(a)) throw Error(k2(65, a));
      b2 = w3("<" + a);
      Qa.set(a, b2);
    }
    return b2;
  }
  var Ra2 = w3("<!DOCTYPE html>");
  function Sa2(a, b2, c2, d, f2) {
    switch (b2) {
      case "select":
        a.push(M2("select"));
        var e = null, g = null;
        for (r in c2) if (x3.call(c2, r)) {
          var h2 = c2[r];
          if (null != h2) switch (r) {
            case "children":
              e = h2;
              break;
            case "dangerouslySetInnerHTML":
              g = h2;
              break;
            case "defaultValue":
            case "value":
              break;
            default:
              J2(a, d, r, h2);
          }
        }
        a.push(K);
        L2(a, g, e);
        return e;
      case "option":
        g = f2.selectedValue;
        a.push(M2("option"));
        var m2 = h2 = null, q2 = null;
        var r = null;
        for (e in c2) if (x3.call(c2, e)) {
          var v2 = c2[e];
          if (null != v2) switch (e) {
            case "children":
              h2 = v2;
              break;
            case "selected":
              q2 = v2;
              break;
            case "dangerouslySetInnerHTML":
              r = v2;
              break;
            case "value":
              m2 = v2;
            default:
              J2(a, d, e, v2);
          }
        }
        if (null != g) if (c2 = null !== m2 ? "" + m2 : La(h2), ra2(g)) for (d = 0; d < g.length; d++) {
          if ("" + g[d] === c2) {
            a.push(Ma);
            break;
          }
        }
        else "" + g === c2 && a.push(Ma);
        else q2 && a.push(Ma);
        a.push(K);
        L2(a, r, h2);
        return h2;
      case "textarea":
        a.push(M2("textarea"));
        r = g = e = null;
        for (h2 in c2) if (x3.call(c2, h2) && (m2 = c2[h2], null != m2)) switch (h2) {
          case "children":
            r = m2;
            break;
          case "value":
            e = m2;
            break;
          case "defaultValue":
            g = m2;
            break;
          case "dangerouslySetInnerHTML":
            throw Error(k2(91));
          default:
            J2(a, d, h2, m2);
        }
        null === e && null !== g && (e = g);
        a.push(K);
        if (null != r) {
          if (null != e) throw Error(k2(92));
          if (ra2(r) && 1 < r.length) throw Error(k2(93));
          e = "" + r;
        }
        "string" === typeof e && "\n" === e[0] && a.push(Oa2);
        null !== e && a.push(u(C2("" + e)));
        return null;
      case "input":
        a.push(M2("input"));
        m2 = r = h2 = e = null;
        for (g in c2) if (x3.call(c2, g) && (q2 = c2[g], null != q2)) switch (g) {
          case "children":
          case "dangerouslySetInnerHTML":
            throw Error(k2(399, "input"));
          case "defaultChecked":
            m2 = q2;
            break;
          case "defaultValue":
            h2 = q2;
            break;
          case "checked":
            r = q2;
            break;
          case "value":
            e = q2;
            break;
          default:
            J2(a, d, g, q2);
        }
        null !== r ? J2(
          a,
          d,
          "checked",
          r
        ) : null !== m2 && J2(a, d, "checked", m2);
        null !== e ? J2(a, d, "value", e) : null !== h2 && J2(a, d, "value", h2);
        a.push(Ka);
        return null;
      case "menuitem":
        a.push(M2("menuitem"));
        for (var A2 in c2) if (x3.call(c2, A2) && (e = c2[A2], null != e)) switch (A2) {
          case "children":
          case "dangerouslySetInnerHTML":
            throw Error(k2(400));
          default:
            J2(a, d, A2, e);
        }
        a.push(K);
        return null;
      case "title":
        a.push(M2("title"));
        e = null;
        for (v2 in c2) if (x3.call(c2, v2) && (g = c2[v2], null != g)) switch (v2) {
          case "children":
            e = g;
            break;
          case "dangerouslySetInnerHTML":
            throw Error(k2(434));
          default:
            J2(a, d, v2, g);
        }
        a.push(K);
        return e;
      case "listing":
      case "pre":
        a.push(M2(b2));
        g = e = null;
        for (m2 in c2) if (x3.call(c2, m2) && (h2 = c2[m2], null != h2)) switch (m2) {
          case "children":
            e = h2;
            break;
          case "dangerouslySetInnerHTML":
            g = h2;
            break;
          default:
            J2(a, d, m2, h2);
        }
        a.push(K);
        if (null != g) {
          if (null != e) throw Error(k2(60));
          if ("object" !== typeof g || !("__html" in g)) throw Error(k2(61));
          c2 = g.__html;
          null !== c2 && void 0 !== c2 && ("string" === typeof c2 && 0 < c2.length && "\n" === c2[0] ? a.push(Oa2, u(c2)) : a.push(u("" + c2)));
        }
        "string" === typeof e && "\n" === e[0] && a.push(Oa2);
        return e;
      case "area":
      case "base":
      case "br":
      case "col":
      case "embed":
      case "hr":
      case "img":
      case "keygen":
      case "link":
      case "meta":
      case "param":
      case "source":
      case "track":
      case "wbr":
        a.push(M2(b2));
        for (var F2 in c2) if (x3.call(c2, F2) && (e = c2[F2], null != e)) switch (F2) {
          case "children":
          case "dangerouslySetInnerHTML":
            throw Error(k2(399, b2));
          default:
            J2(a, d, F2, e);
        }
        a.push(Ka);
        return null;
      case "annotation-xml":
      case "color-profile":
      case "font-face":
      case "font-face-src":
      case "font-face-uri":
      case "font-face-format":
      case "font-face-name":
      case "missing-glyph":
        return Na2(a, c2, b2, d);
      case "html":
        return 0 === f2.insertionMode && a.push(Ra2), Na2(a, c2, b2, d);
      default:
        if (-1 === b2.indexOf("-") && "string" !== typeof c2.is) return Na2(a, c2, b2, d);
        a.push(M2(b2));
        g = e = null;
        for (q2 in c2) if (x3.call(c2, q2) && (h2 = c2[q2], null != h2)) switch (q2) {
          case "children":
            e = h2;
            break;
          case "dangerouslySetInnerHTML":
            g = h2;
            break;
          case "style":
            Ia2(a, d, h2);
            break;
          case "suppressContentEditableWarning":
          case "suppressHydrationWarning":
            break;
          default:
            ia2(q2) && "function" !== typeof h2 && "symbol" !== typeof h2 && a.push(H, u(q2), I2, u(C2(h2)), E2);
        }
        a.push(K);
        L2(a, g, e);
        return e;
    }
  }
  var Ta2 = w3("</"), Ua = w3(">"), Va2 = w3('<template id="'), Wa = w3('"></template>'), Xa = w3("<!--$-->"), Ya = w3('<!--$?--><template id="'), Za = w3('"></template>'), $a = w3("<!--$!-->"), ab = w3("<!--/$-->"), bb = w3("<template"), cb = w3('"'), db = w3(' data-dgst="');
  w3(' data-msg="');
  w3(' data-stck="');
  var eb = w3("></template>");
  function fb(a, b2, c2) {
    p2(a, Ya);
    if (null === c2) throw Error(k2(395));
    p2(a, c2);
    return t(a, Za);
  }
  var gb = w3('<div hidden id="'), hb = w3('">'), ib = w3("</div>"), jb = w3('<svg aria-hidden="true" style="display:none" id="'), kb = w3('">'), lb = w3("</svg>"), mb = w3('<math aria-hidden="true" style="display:none" id="'), nb = w3('">'), ob = w3("</math>"), pb = w3('<table hidden id="'), qb = w3('">'), rb = w3("</table>"), sb = w3('<table hidden><tbody id="'), tb = w3('">'), ub = w3("</tbody></table>"), vb = w3('<table hidden><tr id="'), wb = w3('">'), xb = w3("</tr></table>"), yb = w3('<table hidden><colgroup id="'), zb = w3('">'), Ab = w3("</colgroup></table>");
  function Bb(a, b2, c2, d) {
    switch (c2.insertionMode) {
      case 0:
      case 1:
        return p2(a, gb), p2(a, b2.segmentPrefix), p2(a, u(d.toString(16))), t(a, hb);
      case 2:
        return p2(a, jb), p2(a, b2.segmentPrefix), p2(a, u(d.toString(16))), t(a, kb);
      case 3:
        return p2(a, mb), p2(a, b2.segmentPrefix), p2(a, u(d.toString(16))), t(a, nb);
      case 4:
        return p2(a, pb), p2(a, b2.segmentPrefix), p2(a, u(d.toString(16))), t(a, qb);
      case 5:
        return p2(a, sb), p2(a, b2.segmentPrefix), p2(a, u(d.toString(16))), t(a, tb);
      case 6:
        return p2(a, vb), p2(a, b2.segmentPrefix), p2(a, u(d.toString(16))), t(a, wb);
      case 7:
        return p2(
          a,
          yb
        ), p2(a, b2.segmentPrefix), p2(a, u(d.toString(16))), t(a, zb);
      default:
        throw Error(k2(397));
    }
  }
  function Cb(a, b2) {
    switch (b2.insertionMode) {
      case 0:
      case 1:
        return t(a, ib);
      case 2:
        return t(a, lb);
      case 3:
        return t(a, ob);
      case 4:
        return t(a, rb);
      case 5:
        return t(a, ub);
      case 6:
        return t(a, xb);
      case 7:
        return t(a, Ab);
      default:
        throw Error(k2(397));
    }
  }
  var Db = w3('function $RS(a,b){a=document.getElementById(a);b=document.getElementById(b);for(a.parentNode.removeChild(a);a.firstChild;)b.parentNode.insertBefore(a.firstChild,b);b.parentNode.removeChild(b)};$RS("'), Eb = w3('$RS("'), Gb = w3('","'), Hb = w3('")<\/script>'), Ib = w3('function $RC(a,b){a=document.getElementById(a);b=document.getElementById(b);b.parentNode.removeChild(b);if(a){a=a.previousSibling;var f=a.parentNode,c=a.nextSibling,e=0;do{if(c&&8===c.nodeType){var d=c.data;if("/$"===d)if(0===e)break;else e--;else"$"!==d&&"$?"!==d&&"$!"!==d||e++}d=c.nextSibling;f.removeChild(c);c=d}while(c);for(;b.firstChild;)f.insertBefore(b.firstChild,c);a.data="$";a._reactRetry&&a._reactRetry()}};$RC("'), Jb = w3('$RC("'), Kb = w3('","'), Lb = w3('")<\/script>'), Mb = w3('function $RX(b,c,d,e){var a=document.getElementById(b);a&&(b=a.previousSibling,b.data="$!",a=a.dataset,c&&(a.dgst=c),d&&(a.msg=d),e&&(a.stck=e),b._reactRetry&&b._reactRetry())};$RX("'), Nb = w3('$RX("'), Ob = w3('"'), Pb = w3(")<\/script>"), Qb = w3(","), Rb = /[<\u2028\u2029]/g;
  function Sb(a) {
    return JSON.stringify(a).replace(Rb, function(a2) {
      switch (a2) {
        case "<":
          return "\\u003c";
        case "\u2028":
          return "\\u2028";
        case "\u2029":
          return "\\u2029";
        default:
          throw Error("escapeJSStringsForInstructionScripts encountered a match it does not know how to replace. this means the match regex and the replacement characters are no longer in sync. This is a bug in React");
      }
    });
  }
  var N2 = Object.assign, Tb = /* @__PURE__ */ Symbol.for("react.element"), Ub = /* @__PURE__ */ Symbol.for("react.portal"), Vb = /* @__PURE__ */ Symbol.for("react.fragment"), Wb = /* @__PURE__ */ Symbol.for("react.strict_mode"), Xb = /* @__PURE__ */ Symbol.for("react.profiler"), Yb = /* @__PURE__ */ Symbol.for("react.provider"), Zb = /* @__PURE__ */ Symbol.for("react.context"), $b = /* @__PURE__ */ Symbol.for("react.forward_ref"), ac = /* @__PURE__ */ Symbol.for("react.suspense"), bc = /* @__PURE__ */ Symbol.for("react.suspense_list"), cc = /* @__PURE__ */ Symbol.for("react.memo"), dc = /* @__PURE__ */ Symbol.for("react.lazy"), ec = /* @__PURE__ */ Symbol.for("react.scope"), fc = /* @__PURE__ */ Symbol.for("react.debug_trace_mode"), gc = /* @__PURE__ */ Symbol.for("react.legacy_hidden"), hc = /* @__PURE__ */ Symbol.for("react.default_value"), ic = Symbol.iterator;
  function jc(a) {
    if (null == a) return null;
    if ("function" === typeof a) return a.displayName || a.name || null;
    if ("string" === typeof a) return a;
    switch (a) {
      case Vb:
        return "Fragment";
      case Ub:
        return "Portal";
      case Xb:
        return "Profiler";
      case Wb:
        return "StrictMode";
      case ac:
        return "Suspense";
      case bc:
        return "SuspenseList";
    }
    if ("object" === typeof a) switch (a.$$typeof) {
      case Zb:
        return (a.displayName || "Context") + ".Consumer";
      case Yb:
        return (a._context.displayName || "Context") + ".Provider";
      case $b:
        var b2 = a.render;
        a = a.displayName;
        a || (a = b2.displayName || b2.name || "", a = "" !== a ? "ForwardRef(" + a + ")" : "ForwardRef");
        return a;
      case cc:
        return b2 = a.displayName || null, null !== b2 ? b2 : jc(a.type) || "Memo";
      case dc:
        b2 = a._payload;
        a = a._init;
        try {
          return jc(a(b2));
        } catch (c2) {
        }
    }
    return null;
  }
  var kc = {};
  function lc(a, b2) {
    a = a.contextTypes;
    if (!a) return kc;
    var c2 = {}, d;
    for (d in a) c2[d] = b2[d];
    return c2;
  }
  var O2 = null;
  function P2(a, b2) {
    if (a !== b2) {
      a.context._currentValue = a.parentValue;
      a = a.parent;
      var c2 = b2.parent;
      if (null === a) {
        if (null !== c2) throw Error(k2(401));
      } else {
        if (null === c2) throw Error(k2(401));
        P2(a, c2);
      }
      b2.context._currentValue = b2.value;
    }
  }
  function mc(a) {
    a.context._currentValue = a.parentValue;
    a = a.parent;
    null !== a && mc(a);
  }
  function nc(a) {
    var b2 = a.parent;
    null !== b2 && nc(b2);
    a.context._currentValue = a.value;
  }
  function oc(a, b2) {
    a.context._currentValue = a.parentValue;
    a = a.parent;
    if (null === a) throw Error(k2(402));
    a.depth === b2.depth ? P2(a, b2) : oc(a, b2);
  }
  function pc(a, b2) {
    var c2 = b2.parent;
    if (null === c2) throw Error(k2(402));
    a.depth === c2.depth ? P2(a, c2) : pc(a, c2);
    b2.context._currentValue = b2.value;
  }
  function Q2(a) {
    var b2 = O2;
    b2 !== a && (null === b2 ? nc(a) : null === a ? mc(b2) : b2.depth === a.depth ? P2(b2, a) : b2.depth > a.depth ? oc(b2, a) : pc(b2, a), O2 = a);
  }
  var qc = { isMounted: function() {
    return false;
  }, enqueueSetState: function(a, b2) {
    a = a._reactInternals;
    null !== a.queue && a.queue.push(b2);
  }, enqueueReplaceState: function(a, b2) {
    a = a._reactInternals;
    a.replace = true;
    a.queue = [b2];
  }, enqueueForceUpdate: function() {
  } };
  function rc(a, b2, c2, d) {
    var f2 = void 0 !== a.state ? a.state : null;
    a.updater = qc;
    a.props = c2;
    a.state = f2;
    var e = { queue: [], replace: false };
    a._reactInternals = e;
    var g = b2.contextType;
    a.context = "object" === typeof g && null !== g ? g._currentValue : d;
    g = b2.getDerivedStateFromProps;
    "function" === typeof g && (g = g(c2, f2), f2 = null === g || void 0 === g ? f2 : N2({}, f2, g), a.state = f2);
    if ("function" !== typeof b2.getDerivedStateFromProps && "function" !== typeof a.getSnapshotBeforeUpdate && ("function" === typeof a.UNSAFE_componentWillMount || "function" === typeof a.componentWillMount)) if (b2 = a.state, "function" === typeof a.componentWillMount && a.componentWillMount(), "function" === typeof a.UNSAFE_componentWillMount && a.UNSAFE_componentWillMount(), b2 !== a.state && qc.enqueueReplaceState(a, a.state, null), null !== e.queue && 0 < e.queue.length) if (b2 = e.queue, g = e.replace, e.queue = null, e.replace = false, g && 1 === b2.length) a.state = b2[0];
    else {
      e = g ? b2[0] : a.state;
      f2 = true;
      for (g = g ? 1 : 0; g < b2.length; g++) {
        var h2 = b2[g];
        h2 = "function" === typeof h2 ? h2.call(a, e, c2, d) : h2;
        null != h2 && (f2 ? (f2 = false, e = N2({}, e, h2)) : N2(e, h2));
      }
      a.state = e;
    }
    else e.queue = null;
  }
  var sc = { id: 1, overflow: "" };
  function tc(a, b2, c2) {
    var d = a.id;
    a = a.overflow;
    var f2 = 32 - uc(d) - 1;
    d &= ~(1 << f2);
    c2 += 1;
    var e = 32 - uc(b2) + f2;
    if (30 < e) {
      var g = f2 - f2 % 5;
      e = (d & (1 << g) - 1).toString(32);
      d >>= g;
      f2 -= g;
      return { id: 1 << 32 - uc(b2) + f2 | c2 << f2 | d, overflow: e + a };
    }
    return { id: 1 << e | c2 << f2 | d, overflow: a };
  }
  var uc = Math.clz32 ? Math.clz32 : vc, wc = Math.log, xc = Math.LN2;
  function vc(a) {
    a >>>= 0;
    return 0 === a ? 32 : 31 - (wc(a) / xc | 0) | 0;
  }
  function yc(a, b2) {
    return a === b2 && (0 !== a || 1 / a === 1 / b2) || a !== a && b2 !== b2;
  }
  var zc = "function" === typeof Object.is ? Object.is : yc, R2 = null, Ac = null, Bc = null, S = null, T2 = false, Cc = false, U2 = 0, V2 = null, Dc = 0;
  function W2() {
    if (null === R2) throw Error(k2(321));
    return R2;
  }
  function Ec() {
    if (0 < Dc) throw Error(k2(312));
    return { memoizedState: null, queue: null, next: null };
  }
  function Fc() {
    null === S ? null === Bc ? (T2 = false, Bc = S = Ec()) : (T2 = true, S = Bc) : null === S.next ? (T2 = false, S = S.next = Ec()) : (T2 = true, S = S.next);
    return S;
  }
  function Gc() {
    Ac = R2 = null;
    Cc = false;
    Bc = null;
    Dc = 0;
    S = V2 = null;
  }
  function Hc(a, b2) {
    return "function" === typeof b2 ? b2(a) : b2;
  }
  function Ic(a, b2, c2) {
    R2 = W2();
    S = Fc();
    if (T2) {
      var d = S.queue;
      b2 = d.dispatch;
      if (null !== V2 && (c2 = V2.get(d), void 0 !== c2)) {
        V2.delete(d);
        d = S.memoizedState;
        do
          d = a(d, c2.action), c2 = c2.next;
        while (null !== c2);
        S.memoizedState = d;
        return [d, b2];
      }
      return [S.memoizedState, b2];
    }
    a = a === Hc ? "function" === typeof b2 ? b2() : b2 : void 0 !== c2 ? c2(b2) : b2;
    S.memoizedState = a;
    a = S.queue = { last: null, dispatch: null };
    a = a.dispatch = Jc.bind(null, R2, a);
    return [S.memoizedState, a];
  }
  function Kc(a, b2) {
    R2 = W2();
    S = Fc();
    b2 = void 0 === b2 ? null : b2;
    if (null !== S) {
      var c2 = S.memoizedState;
      if (null !== c2 && null !== b2) {
        var d = c2[1];
        a: if (null === d) d = false;
        else {
          for (var f2 = 0; f2 < d.length && f2 < b2.length; f2++) if (!zc(b2[f2], d[f2])) {
            d = false;
            break a;
          }
          d = true;
        }
        if (d) return c2[0];
      }
    }
    a = a();
    S.memoizedState = [a, b2];
    return a;
  }
  function Jc(a, b2, c2) {
    if (25 <= Dc) throw Error(k2(301));
    if (a === R2) if (Cc = true, a = { action: c2, next: null }, null === V2 && (V2 = /* @__PURE__ */ new Map()), c2 = V2.get(b2), void 0 === c2) V2.set(b2, a);
    else {
      for (b2 = c2; null !== b2.next; ) b2 = b2.next;
      b2.next = a;
    }
  }
  function Lc() {
    throw Error(k2(394));
  }
  function Mc() {
  }
  var Oc = { readContext: function(a) {
    return a._currentValue;
  }, useContext: function(a) {
    W2();
    return a._currentValue;
  }, useMemo: Kc, useReducer: Ic, useRef: function(a) {
    R2 = W2();
    S = Fc();
    var b2 = S.memoizedState;
    return null === b2 ? (a = { current: a }, S.memoizedState = a) : b2;
  }, useState: function(a) {
    return Ic(Hc, a);
  }, useInsertionEffect: Mc, useLayoutEffect: function() {
  }, useCallback: function(a, b2) {
    return Kc(function() {
      return a;
    }, b2);
  }, useImperativeHandle: Mc, useEffect: Mc, useDebugValue: Mc, useDeferredValue: function(a) {
    W2();
    return a;
  }, useTransition: function() {
    W2();
    return [false, Lc];
  }, useId: function() {
    var a = Ac.treeContext;
    var b2 = a.overflow;
    a = a.id;
    a = (a & ~(1 << 32 - uc(a) - 1)).toString(32) + b2;
    var c2 = Nc;
    if (null === c2) throw Error(k2(404));
    b2 = U2++;
    a = ":" + c2.idPrefix + "R" + a;
    0 < b2 && (a += "H" + b2.toString(32));
    return a + ":";
  }, useMutableSource: function(a, b2) {
    W2();
    return b2(a._source);
  }, useSyncExternalStore: function(a, b2, c2) {
    if (void 0 === c2) throw Error(k2(407));
    return c2();
  } }, Nc = null, Pc = aa2.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
  function Qc(a) {
    console.error(a);
    return null;
  }
  function X2() {
  }
  function Rc(a, b2, c2, d, f2, e, g, h2, m2) {
    var q2 = [], r = /* @__PURE__ */ new Set();
    b2 = { destination: null, responseState: b2, progressiveChunkSize: void 0 === d ? 12800 : d, status: 0, fatalError: null, nextSegmentId: 0, allPendingTasks: 0, pendingRootTasks: 0, completedRootSegment: null, abortableTasks: r, pingedTasks: q2, clientRenderedBoundaries: [], completedBoundaries: [], partialBoundaries: [], onError: void 0 === f2 ? Qc : f2, onAllReady: void 0 === e ? X2 : e, onShellReady: void 0 === g ? X2 : g, onShellError: void 0 === h2 ? X2 : h2, onFatalError: void 0 === m2 ? X2 : m2 };
    c2 = Sc(b2, 0, null, c2, false, false);
    c2.parentFlushed = true;
    a = Tc(b2, a, null, c2, r, kc, null, sc);
    q2.push(a);
    return b2;
  }
  function Tc(a, b2, c2, d, f2, e, g, h2) {
    a.allPendingTasks++;
    null === c2 ? a.pendingRootTasks++ : c2.pendingTasks++;
    var m2 = { node: b2, ping: function() {
      var b3 = a.pingedTasks;
      b3.push(m2);
      1 === b3.length && Uc(a);
    }, blockedBoundary: c2, blockedSegment: d, abortSet: f2, legacyContext: e, context: g, treeContext: h2 };
    f2.add(m2);
    return m2;
  }
  function Sc(a, b2, c2, d, f2, e) {
    return { status: 0, id: -1, index: b2, parentFlushed: false, chunks: [], children: [], formatContext: d, boundary: c2, lastPushedText: f2, textEmbedded: e };
  }
  function Y2(a, b2) {
    a = a.onError(b2);
    if (null != a && "string" !== typeof a) throw Error('onError returned something with a type other than "string". onError should return a string and may return null or undefined but must not return anything else. It received something of type "' + typeof a + '" instead');
    return a;
  }
  function Vc(a, b2) {
    var c2 = a.onShellError;
    c2(b2);
    c2 = a.onFatalError;
    c2(b2);
    null !== a.destination ? (a.status = 2, da2(a.destination, b2)) : (a.status = 1, a.fatalError = b2);
  }
  function Wc(a, b2, c2, d, f2) {
    R2 = {};
    Ac = b2;
    U2 = 0;
    for (a = c2(d, f2); Cc; ) Cc = false, U2 = 0, Dc += 1, S = null, a = c2(d, f2);
    Gc();
    return a;
  }
  function Xc(a, b2, c2, d) {
    var f2 = c2.render(), e = d.childContextTypes;
    if (null !== e && void 0 !== e) {
      var g = b2.legacyContext;
      if ("function" !== typeof c2.getChildContext) d = g;
      else {
        c2 = c2.getChildContext();
        for (var h2 in c2) if (!(h2 in e)) throw Error(k2(108, jc(d) || "Unknown", h2));
        d = N2({}, g, c2);
      }
      b2.legacyContext = d;
      Z2(a, b2, f2);
      b2.legacyContext = g;
    } else Z2(a, b2, f2);
  }
  function Yc(a, b2) {
    if (a && a.defaultProps) {
      b2 = N2({}, b2);
      a = a.defaultProps;
      for (var c2 in a) void 0 === b2[c2] && (b2[c2] = a[c2]);
      return b2;
    }
    return b2;
  }
  function Zc(a, b2, c2, d, f2) {
    if ("function" === typeof c2) if (c2.prototype && c2.prototype.isReactComponent) {
      f2 = lc(c2, b2.legacyContext);
      var e = c2.contextType;
      e = new c2(d, "object" === typeof e && null !== e ? e._currentValue : f2);
      rc(e, c2, d, f2);
      Xc(a, b2, e, c2);
    } else {
      e = lc(c2, b2.legacyContext);
      f2 = Wc(a, b2, c2, d, e);
      var g = 0 !== U2;
      if ("object" === typeof f2 && null !== f2 && "function" === typeof f2.render && void 0 === f2.$$typeof) rc(f2, c2, d, e), Xc(a, b2, f2, c2);
      else if (g) {
        d = b2.treeContext;
        b2.treeContext = tc(d, 1, 0);
        try {
          Z2(a, b2, f2);
        } finally {
          b2.treeContext = d;
        }
      } else Z2(a, b2, f2);
    }
    else if ("string" === typeof c2) {
      f2 = b2.blockedSegment;
      e = Sa2(f2.chunks, c2, d, a.responseState, f2.formatContext);
      f2.lastPushedText = false;
      g = f2.formatContext;
      f2.formatContext = Ba2(g, c2, d);
      $c(a, b2, e);
      f2.formatContext = g;
      switch (c2) {
        case "area":
        case "base":
        case "br":
        case "col":
        case "embed":
        case "hr":
        case "img":
        case "input":
        case "keygen":
        case "link":
        case "meta":
        case "param":
        case "source":
        case "track":
        case "wbr":
          break;
        default:
          f2.chunks.push(Ta2, u(c2), Ua);
      }
      f2.lastPushedText = false;
    } else {
      switch (c2) {
        case gc:
        case fc:
        case Wb:
        case Xb:
        case Vb:
          Z2(a, b2, d.children);
          return;
        case bc:
          Z2(a, b2, d.children);
          return;
        case ec:
          throw Error(k2(343));
        case ac:
          a: {
            c2 = b2.blockedBoundary;
            f2 = b2.blockedSegment;
            e = d.fallback;
            d = d.children;
            g = /* @__PURE__ */ new Set();
            var h2 = { id: null, rootSegmentID: -1, parentFlushed: false, pendingTasks: 0, forceClientRender: false, completedSegments: [], byteSize: 0, fallbackAbortableTasks: g, errorDigest: null }, m2 = Sc(a, f2.chunks.length, h2, f2.formatContext, false, false);
            f2.children.push(m2);
            f2.lastPushedText = false;
            var q2 = Sc(a, 0, null, f2.formatContext, false, false);
            q2.parentFlushed = true;
            b2.blockedBoundary = h2;
            b2.blockedSegment = q2;
            try {
              if ($c(
                a,
                b2,
                d
              ), q2.lastPushedText && q2.textEmbedded && q2.chunks.push(Ca2), q2.status = 1, ad(h2, q2), 0 === h2.pendingTasks) break a;
            } catch (r) {
              q2.status = 4, h2.forceClientRender = true, h2.errorDigest = Y2(a, r);
            } finally {
              b2.blockedBoundary = c2, b2.blockedSegment = f2;
            }
            b2 = Tc(a, e, c2, m2, g, b2.legacyContext, b2.context, b2.treeContext);
            a.pingedTasks.push(b2);
          }
          return;
      }
      if ("object" === typeof c2 && null !== c2) switch (c2.$$typeof) {
        case $b:
          d = Wc(a, b2, c2.render, d, f2);
          if (0 !== U2) {
            c2 = b2.treeContext;
            b2.treeContext = tc(c2, 1, 0);
            try {
              Z2(a, b2, d);
            } finally {
              b2.treeContext = c2;
            }
          } else Z2(a, b2, d);
          return;
        case cc:
          c2 = c2.type;
          d = Yc(c2, d);
          Zc(a, b2, c2, d, f2);
          return;
        case Yb:
          f2 = d.children;
          c2 = c2._context;
          d = d.value;
          e = c2._currentValue;
          c2._currentValue = d;
          g = O2;
          O2 = d = { parent: g, depth: null === g ? 0 : g.depth + 1, context: c2, parentValue: e, value: d };
          b2.context = d;
          Z2(a, b2, f2);
          a = O2;
          if (null === a) throw Error(k2(403));
          d = a.parentValue;
          a.context._currentValue = d === hc ? a.context._defaultValue : d;
          a = O2 = a.parent;
          b2.context = a;
          return;
        case Zb:
          d = d.children;
          d = d(c2._currentValue);
          Z2(a, b2, d);
          return;
        case dc:
          f2 = c2._init;
          c2 = f2(c2._payload);
          d = Yc(c2, d);
          Zc(a, b2, c2, d, void 0);
          return;
      }
      throw Error(k2(
        130,
        null == c2 ? c2 : typeof c2,
        ""
      ));
    }
  }
  function Z2(a, b2, c2) {
    b2.node = c2;
    if ("object" === typeof c2 && null !== c2) {
      switch (c2.$$typeof) {
        case Tb:
          Zc(a, b2, c2.type, c2.props, c2.ref);
          return;
        case Ub:
          throw Error(k2(257));
        case dc:
          var d = c2._init;
          c2 = d(c2._payload);
          Z2(a, b2, c2);
          return;
      }
      if (ra2(c2)) {
        bd(a, b2, c2);
        return;
      }
      null === c2 || "object" !== typeof c2 ? d = null : (d = ic && c2[ic] || c2["@@iterator"], d = "function" === typeof d ? d : null);
      if (d && (d = d.call(c2))) {
        c2 = d.next();
        if (!c2.done) {
          var f2 = [];
          do
            f2.push(c2.value), c2 = d.next();
          while (!c2.done);
          bd(a, b2, f2);
        }
        return;
      }
      a = Object.prototype.toString.call(c2);
      throw Error(k2(31, "[object Object]" === a ? "object with keys {" + Object.keys(c2).join(", ") + "}" : a));
    }
    "string" === typeof c2 ? (d = b2.blockedSegment, d.lastPushedText = Da2(b2.blockedSegment.chunks, c2, a.responseState, d.lastPushedText)) : "number" === typeof c2 && (d = b2.blockedSegment, d.lastPushedText = Da2(b2.blockedSegment.chunks, "" + c2, a.responseState, d.lastPushedText));
  }
  function bd(a, b2, c2) {
    for (var d = c2.length, f2 = 0; f2 < d; f2++) {
      var e = b2.treeContext;
      b2.treeContext = tc(e, d, f2);
      try {
        $c(a, b2, c2[f2]);
      } finally {
        b2.treeContext = e;
      }
    }
  }
  function $c(a, b2, c2) {
    var d = b2.blockedSegment.formatContext, f2 = b2.legacyContext, e = b2.context;
    try {
      return Z2(a, b2, c2);
    } catch (m2) {
      if (Gc(), "object" === typeof m2 && null !== m2 && "function" === typeof m2.then) {
        c2 = m2;
        var g = b2.blockedSegment, h2 = Sc(a, g.chunks.length, null, g.formatContext, g.lastPushedText, true);
        g.children.push(h2);
        g.lastPushedText = false;
        a = Tc(a, b2.node, b2.blockedBoundary, h2, b2.abortSet, b2.legacyContext, b2.context, b2.treeContext).ping;
        c2.then(a, a);
        b2.blockedSegment.formatContext = d;
        b2.legacyContext = f2;
        b2.context = e;
        Q2(e);
      } else throw b2.blockedSegment.formatContext = d, b2.legacyContext = f2, b2.context = e, Q2(e), m2;
    }
  }
  function cd(a) {
    var b2 = a.blockedBoundary;
    a = a.blockedSegment;
    a.status = 3;
    dd(this, b2, a);
  }
  function ed(a, b2, c2) {
    var d = a.blockedBoundary;
    a.blockedSegment.status = 3;
    null === d ? (b2.allPendingTasks--, 2 !== b2.status && (b2.status = 2, null !== b2.destination && b2.destination.close())) : (d.pendingTasks--, d.forceClientRender || (d.forceClientRender = true, a = void 0 === c2 ? Error(k2(432)) : c2, d.errorDigest = b2.onError(a), d.parentFlushed && b2.clientRenderedBoundaries.push(d)), d.fallbackAbortableTasks.forEach(function(a2) {
      return ed(a2, b2, c2);
    }), d.fallbackAbortableTasks.clear(), b2.allPendingTasks--, 0 === b2.allPendingTasks && (d = b2.onAllReady, d()));
  }
  function ad(a, b2) {
    if (0 === b2.chunks.length && 1 === b2.children.length && null === b2.children[0].boundary) {
      var c2 = b2.children[0];
      c2.id = b2.id;
      c2.parentFlushed = true;
      1 === c2.status && ad(a, c2);
    } else a.completedSegments.push(b2);
  }
  function dd(a, b2, c2) {
    if (null === b2) {
      if (c2.parentFlushed) {
        if (null !== a.completedRootSegment) throw Error(k2(389));
        a.completedRootSegment = c2;
      }
      a.pendingRootTasks--;
      0 === a.pendingRootTasks && (a.onShellError = X2, b2 = a.onShellReady, b2());
    } else b2.pendingTasks--, b2.forceClientRender || (0 === b2.pendingTasks ? (c2.parentFlushed && 1 === c2.status && ad(b2, c2), b2.parentFlushed && a.completedBoundaries.push(b2), b2.fallbackAbortableTasks.forEach(cd, a), b2.fallbackAbortableTasks.clear()) : c2.parentFlushed && 1 === c2.status && (ad(b2, c2), 1 === b2.completedSegments.length && b2.parentFlushed && a.partialBoundaries.push(b2)));
    a.allPendingTasks--;
    0 === a.allPendingTasks && (a = a.onAllReady, a());
  }
  function Uc(a) {
    if (2 !== a.status) {
      var b2 = O2, c2 = Pc.current;
      Pc.current = Oc;
      var d = Nc;
      Nc = a.responseState;
      try {
        var f2 = a.pingedTasks, e;
        for (e = 0; e < f2.length; e++) {
          var g = f2[e];
          var h2 = a, m2 = g.blockedSegment;
          if (0 === m2.status) {
            Q2(g.context);
            try {
              Z2(h2, g, g.node), m2.lastPushedText && m2.textEmbedded && m2.chunks.push(Ca2), g.abortSet.delete(g), m2.status = 1, dd(h2, g.blockedBoundary, m2);
            } catch (G2) {
              if (Gc(), "object" === typeof G2 && null !== G2 && "function" === typeof G2.then) {
                var q2 = g.ping;
                G2.then(q2, q2);
              } else {
                g.abortSet.delete(g);
                m2.status = 4;
                var r = g.blockedBoundary, v2 = G2, A2 = Y2(h2, v2);
                null === r ? Vc(h2, v2) : (r.pendingTasks--, r.forceClientRender || (r.forceClientRender = true, r.errorDigest = A2, r.parentFlushed && h2.clientRenderedBoundaries.push(r)));
                h2.allPendingTasks--;
                if (0 === h2.allPendingTasks) {
                  var F2 = h2.onAllReady;
                  F2();
                }
              }
            } finally {
            }
          }
        }
        f2.splice(0, e);
        null !== a.destination && fd(a, a.destination);
      } catch (G2) {
        Y2(a, G2), Vc(a, G2);
      } finally {
        Nc = d, Pc.current = c2, c2 === Oc && Q2(b2);
      }
    }
  }
  function gd(a, b2, c2) {
    c2.parentFlushed = true;
    switch (c2.status) {
      case 0:
        var d = c2.id = a.nextSegmentId++;
        c2.lastPushedText = false;
        c2.textEmbedded = false;
        a = a.responseState;
        p2(b2, Va2);
        p2(b2, a.placeholderPrefix);
        a = u(d.toString(16));
        p2(b2, a);
        return t(b2, Wa);
      case 1:
        c2.status = 2;
        var f2 = true;
        d = c2.chunks;
        var e = 0;
        c2 = c2.children;
        for (var g = 0; g < c2.length; g++) {
          for (f2 = c2[g]; e < f2.index; e++) p2(b2, d[e]);
          f2 = hd(a, b2, f2);
        }
        for (; e < d.length - 1; e++) p2(b2, d[e]);
        e < d.length && (f2 = t(b2, d[e]));
        return f2;
      default:
        throw Error(k2(390));
    }
  }
  function hd(a, b2, c2) {
    var d = c2.boundary;
    if (null === d) return gd(a, b2, c2);
    d.parentFlushed = true;
    if (d.forceClientRender) d = d.errorDigest, t(b2, $a), p2(b2, bb), d && (p2(b2, db), p2(b2, u(C2(d))), p2(b2, cb)), t(b2, eb), gd(a, b2, c2);
    else if (0 < d.pendingTasks) {
      d.rootSegmentID = a.nextSegmentId++;
      0 < d.completedSegments.length && a.partialBoundaries.push(d);
      var f2 = a.responseState;
      var e = f2.nextSuspenseID++;
      f2 = w3(f2.boundaryPrefix + e.toString(16));
      d = d.id = f2;
      fb(b2, a.responseState, d);
      gd(a, b2, c2);
    } else if (d.byteSize > a.progressiveChunkSize) d.rootSegmentID = a.nextSegmentId++, a.completedBoundaries.push(d), fb(b2, a.responseState, d.id), gd(a, b2, c2);
    else {
      t(b2, Xa);
      c2 = d.completedSegments;
      if (1 !== c2.length) throw Error(k2(391));
      hd(a, b2, c2[0]);
    }
    return t(b2, ab);
  }
  function id(a, b2, c2) {
    Bb(b2, a.responseState, c2.formatContext, c2.id);
    hd(a, b2, c2);
    return Cb(b2, c2.formatContext);
  }
  function jd(a, b2, c2) {
    for (var d = c2.completedSegments, f2 = 0; f2 < d.length; f2++) kd(a, b2, c2, d[f2]);
    d.length = 0;
    a = a.responseState;
    d = c2.id;
    c2 = c2.rootSegmentID;
    p2(b2, a.startInlineScript);
    a.sentCompleteBoundaryFunction ? p2(b2, Jb) : (a.sentCompleteBoundaryFunction = true, p2(b2, Ib));
    if (null === d) throw Error(k2(395));
    c2 = u(c2.toString(16));
    p2(b2, d);
    p2(b2, Kb);
    p2(b2, a.segmentPrefix);
    p2(b2, c2);
    return t(b2, Lb);
  }
  function kd(a, b2, c2, d) {
    if (2 === d.status) return true;
    var f2 = d.id;
    if (-1 === f2) {
      if (-1 === (d.id = c2.rootSegmentID)) throw Error(k2(392));
      return id(a, b2, d);
    }
    id(a, b2, d);
    a = a.responseState;
    p2(b2, a.startInlineScript);
    a.sentCompleteSegmentFunction ? p2(b2, Eb) : (a.sentCompleteSegmentFunction = true, p2(b2, Db));
    p2(b2, a.segmentPrefix);
    f2 = u(f2.toString(16));
    p2(b2, f2);
    p2(b2, Gb);
    p2(b2, a.placeholderPrefix);
    p2(b2, f2);
    return t(b2, Hb);
  }
  function fd(a, b2) {
    l = new Uint8Array(512);
    n2 = 0;
    try {
      var c2 = a.completedRootSegment;
      if (null !== c2 && 0 === a.pendingRootTasks) {
        hd(a, b2, c2);
        a.completedRootSegment = null;
        var d = a.responseState.bootstrapChunks;
        for (c2 = 0; c2 < d.length - 1; c2++) p2(b2, d[c2]);
        c2 < d.length && t(b2, d[c2]);
      }
      var f2 = a.clientRenderedBoundaries, e;
      for (e = 0; e < f2.length; e++) {
        var g = f2[e];
        d = b2;
        var h2 = a.responseState, m2 = g.id, q2 = g.errorDigest, r = g.errorMessage, v2 = g.errorComponentStack;
        p2(d, h2.startInlineScript);
        h2.sentClientRenderFunction ? p2(d, Nb) : (h2.sentClientRenderFunction = true, p2(
          d,
          Mb
        ));
        if (null === m2) throw Error(k2(395));
        p2(d, m2);
        p2(d, Ob);
        if (q2 || r || v2) p2(d, Qb), p2(d, u(Sb(q2 || "")));
        if (r || v2) p2(d, Qb), p2(d, u(Sb(r || "")));
        v2 && (p2(d, Qb), p2(d, u(Sb(v2))));
        if (!t(d, Pb)) ;
      }
      f2.splice(0, e);
      var A2 = a.completedBoundaries;
      for (e = 0; e < A2.length; e++) if (!jd(a, b2, A2[e])) ;
      A2.splice(0, e);
      ba2(b2);
      l = new Uint8Array(512);
      n2 = 0;
      var F2 = a.partialBoundaries;
      for (e = 0; e < F2.length; e++) {
        var G2 = F2[e];
        a: {
          f2 = a;
          g = b2;
          var ma2 = G2.completedSegments;
          for (h2 = 0; h2 < ma2.length; h2++) if (!kd(
            f2,
            g,
            G2,
            ma2[h2]
          )) {
            h2++;
            ma2.splice(0, h2);
            var Fb = false;
            break a;
          }
          ma2.splice(0, h2);
          Fb = true;
        }
        if (!Fb) {
          a.destination = null;
          e++;
          F2.splice(0, e);
          return;
        }
      }
      F2.splice(0, e);
      var na2 = a.completedBoundaries;
      for (e = 0; e < na2.length; e++) if (!jd(a, b2, na2[e])) ;
      na2.splice(0, e);
    } finally {
      ba2(b2), 0 === a.allPendingTasks && 0 === a.pingedTasks.length && 0 === a.clientRenderedBoundaries.length && 0 === a.completedBoundaries.length && b2.close();
    }
  }
  function ld(a, b2) {
    try {
      var c2 = a.abortableTasks;
      c2.forEach(function(c3) {
        return ed(c3, a, b2);
      });
      c2.clear();
      null !== a.destination && fd(a, a.destination);
    } catch (d) {
      Y2(a, d), Vc(a, d);
    }
  }
  reactDomServer_browser_production_min.renderToReadableStream = function(a, b2) {
    return new Promise(function(c2, d) {
      var f2, e, g = new Promise(function(a2, b3) {
        e = a2;
        f2 = b3;
      }), h2 = Rc(a, za2(b2 ? b2.identifierPrefix : void 0, b2 ? b2.nonce : void 0, b2 ? b2.bootstrapScriptContent : void 0, b2 ? b2.bootstrapScripts : void 0, b2 ? b2.bootstrapModules : void 0), Aa2(b2 ? b2.namespaceURI : void 0), b2 ? b2.progressiveChunkSize : void 0, b2 ? b2.onError : void 0, e, function() {
        var a2 = new ReadableStream({ type: "bytes", pull: function(a3) {
          if (1 === h2.status) h2.status = 2, da2(a3, h2.fatalError);
          else if (2 !== h2.status && null === h2.destination) {
            h2.destination = a3;
            try {
              fd(h2, a3);
            } catch (A2) {
              Y2(h2, A2), Vc(h2, A2);
            }
          }
        }, cancel: function() {
          ld(h2);
        } }, { highWaterMark: 0 });
        a2.allReady = g;
        c2(a2);
      }, function(a2) {
        g.catch(function() {
        });
        d(a2);
      }, f2);
      if (b2 && b2.signal) {
        var m2 = b2.signal, q2 = function() {
          ld(h2, m2.reason);
          m2.removeEventListener("abort", q2);
        };
        m2.addEventListener("abort", q2);
      }
      Uc(h2);
    });
  };
  reactDomServer_browser_production_min.version = "18.2.0";
  return reactDomServer_browser_production_min;
}
var hasRequiredServer_browser;
function requireServer_browser() {
  if (hasRequiredServer_browser) return server_browser;
  hasRequiredServer_browser = 1;
  var l, s;
  {
    l = requireReactDomServerLegacy_browser_production_min();
    s = requireReactDomServer_browser_production_min();
  }
  server_browser.version = l.version;
  server_browser.renderToString = l.renderToString;
  server_browser.renderToStaticMarkup = l.renderToStaticMarkup;
  server_browser.renderToNodeStream = l.renderToNodeStream;
  server_browser.renderToStaticNodeStream = l.renderToStaticNodeStream;
  server_browser.renderToReadableStream = s.renderToReadableStream;
  return server_browser;
}
var server_browserExports = requireServer_browser();
const ReactDOMServer = /* @__PURE__ */ getDefaultExportFromCjs(server_browserExports);
function splitSetCookieString(cookiesString) {
  if (Array.isArray(cookiesString)) return cookiesString.flatMap((c2) => splitSetCookieString(c2));
  if (typeof cookiesString !== "string") return [];
  const cookiesStrings = [];
  let pos = 0;
  let start;
  let ch;
  let lastComma;
  let nextStart;
  let cookiesSeparatorFound;
  const skipWhitespace = () => {
    while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) pos += 1;
    return pos < cookiesString.length;
  };
  const notSpecialChar = () => {
    ch = cookiesString.charAt(pos);
    return ch !== "=" && ch !== ";" && ch !== ",";
  };
  while (pos < cookiesString.length) {
    start = pos;
    cookiesSeparatorFound = false;
    while (skipWhitespace()) {
      ch = cookiesString.charAt(pos);
      if (ch === ",") {
        lastComma = pos;
        pos += 1;
        skipWhitespace();
        nextStart = pos;
        while (pos < cookiesString.length && notSpecialChar()) pos += 1;
        if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
          cookiesSeparatorFound = true;
          pos = nextStart;
          cookiesStrings.push(cookiesString.slice(start, lastComma));
          start = pos;
        } else pos = lastComma + 1;
      } else pos += 1;
    }
    if (!cookiesSeparatorFound || pos >= cookiesString.length) cookiesStrings.push(cookiesString.slice(start));
  }
  return cookiesStrings;
}
function defineHandlerCallback(handler) {
  return handler;
}
function transformReadableStreamWithRouter(router, routerStream) {
  return transformStreamWithRouter(router, routerStream);
}
function transformPipeableStreamWithRouter(router, routerStream) {
  return Readable.fromWeb(transformStreamWithRouter(router, Readable.toWeb(routerStream)));
}
var BODY_END_TAG = "</body>";
var HTML_END_TAG = "</html>";
var MIN_CLOSING_TAG_LENGTH = 4;
var DEFAULT_SERIALIZATION_TIMEOUT_MS = 6e4;
var DEFAULT_LIFETIME_TIMEOUT_MS = 6e4;
var textEncoder$1 = new TextEncoder();
function findLastClosingTagEnd(str) {
  const len = str.length;
  if (len < MIN_CLOSING_TAG_LENGTH) return -1;
  let i = len - 1;
  while (i >= MIN_CLOSING_TAG_LENGTH - 1) {
    if (str.charCodeAt(i) === 62) {
      let j2 = i - 1;
      while (j2 >= 1) {
        const code = str.charCodeAt(j2);
        if (code >= 97 && code <= 122 || code >= 65 && code <= 90 || code >= 48 && code <= 57 || code === 95 || code === 58 || code === 46 || code === 45) j2--;
        else break;
      }
      const tagNameStart = j2 + 1;
      if (tagNameStart < i) {
        const startCode = str.charCodeAt(tagNameStart);
        if (startCode >= 97 && startCode <= 122 || startCode >= 65 && startCode <= 90) {
          if (j2 >= 1 && str.charCodeAt(j2) === 47 && str.charCodeAt(j2 - 1) === 60) return i + 1;
        }
      }
    }
    i--;
  }
  return -1;
}
function transformStreamWithRouter(router, appStream, opts) {
  const serializationAlreadyFinished = router.serverSsr?.isSerializationFinished() ?? false;
  const initialBufferedHtml = router.serverSsr?.takeBufferedHtml();
  if (serializationAlreadyFinished && !initialBufferedHtml) {
    let cleanedUp2 = false;
    let controller2;
    let isStreamClosed2 = false;
    let lifetimeTimeoutHandle2;
    const cleanup2 = () => {
      if (cleanedUp2) return;
      cleanedUp2 = true;
      if (lifetimeTimeoutHandle2 !== void 0) {
        clearTimeout(lifetimeTimeoutHandle2);
        lifetimeTimeoutHandle2 = void 0;
      }
      router.serverSsr?.cleanup();
    };
    const safeClose2 = () => {
      if (isStreamClosed2) return;
      isStreamClosed2 = true;
      try {
        controller2?.close();
      } catch {
      }
    };
    const safeError2 = (error) => {
      if (isStreamClosed2) return;
      isStreamClosed2 = true;
      try {
        controller2?.error(error);
      } catch {
      }
    };
    const lifetimeMs2 = DEFAULT_LIFETIME_TIMEOUT_MS;
    lifetimeTimeoutHandle2 = setTimeout(() => {
      if (!cleanedUp2 && !isStreamClosed2) {
        console.warn(`SSR stream transform exceeded maximum lifetime (${lifetimeMs2}ms), forcing cleanup`);
        safeError2(/* @__PURE__ */ new Error("Stream lifetime exceeded"));
        cleanup2();
      }
    }, lifetimeMs2);
    const stream2 = new ReadableStream$1({
      start(c2) {
        controller2 = c2;
      },
      cancel() {
        isStreamClosed2 = true;
        cleanup2();
      }
    });
    (async () => {
      const reader = appStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (cleanedUp2 || isStreamClosed2) return;
          controller2?.enqueue(value);
        }
        if (cleanedUp2 || isStreamClosed2) return;
        router.serverSsr?.setRenderFinished();
        safeClose2();
        cleanup2();
      } catch (error) {
        if (cleanedUp2) return;
        console.error("Error reading appStream:", error);
        router.serverSsr?.setRenderFinished();
        safeError2(error);
        cleanup2();
      } finally {
        reader.releaseLock();
      }
    })().catch((error) => {
      if (cleanedUp2) return;
      console.error("Error in stream transform:", error);
      safeError2(error);
      cleanup2();
    });
    return stream2;
  }
  let stopListeningToInjectedHtml;
  let stopListeningToSerializationFinished;
  let serializationTimeoutHandle;
  let lifetimeTimeoutHandle;
  let cleanedUp = false;
  let controller;
  let isStreamClosed = false;
  const textDecoder = new TextDecoder();
  let pendingRouterHtml = initialBufferedHtml ?? "";
  let leftover = "";
  let pendingClosingTags = "";
  const MAX_LEFTOVER_CHARS = 2048;
  let isAppRendering = true;
  let streamBarrierLifted = false;
  let serializationFinished = serializationAlreadyFinished;
  function safeEnqueue(chunk) {
    if (isStreamClosed) return;
    if (typeof chunk === "string") controller.enqueue(textEncoder$1.encode(chunk));
    else controller.enqueue(chunk);
  }
  function safeClose() {
    if (isStreamClosed) return;
    isStreamClosed = true;
    try {
      controller.close();
    } catch {
    }
  }
  function safeError(error) {
    if (isStreamClosed) return;
    isStreamClosed = true;
    try {
      controller.error(error);
    } catch {
    }
  }
  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      stopListeningToInjectedHtml?.();
      stopListeningToSerializationFinished?.();
    } catch {
    }
    stopListeningToInjectedHtml = void 0;
    stopListeningToSerializationFinished = void 0;
    if (serializationTimeoutHandle !== void 0) {
      clearTimeout(serializationTimeoutHandle);
      serializationTimeoutHandle = void 0;
    }
    if (lifetimeTimeoutHandle !== void 0) {
      clearTimeout(lifetimeTimeoutHandle);
      lifetimeTimeoutHandle = void 0;
    }
    pendingRouterHtml = "";
    leftover = "";
    pendingClosingTags = "";
    router.serverSsr?.cleanup();
  }
  const stream = new ReadableStream$1({
    start(c2) {
      controller = c2;
    },
    cancel() {
      isStreamClosed = true;
      cleanup();
    }
  });
  function flushPendingRouterHtml() {
    if (!pendingRouterHtml) return;
    safeEnqueue(pendingRouterHtml);
    pendingRouterHtml = "";
  }
  function appendRouterHtml(html) {
    if (!html) return;
    pendingRouterHtml += html;
  }
  function tryFinish() {
    if (isAppRendering || !serializationFinished) return;
    if (cleanedUp || isStreamClosed) return;
    if (serializationTimeoutHandle !== void 0) {
      clearTimeout(serializationTimeoutHandle);
      serializationTimeoutHandle = void 0;
    }
    const decoderRemainder = textDecoder.decode();
    if (leftover) safeEnqueue(leftover);
    if (decoderRemainder) safeEnqueue(decoderRemainder);
    flushPendingRouterHtml();
    if (pendingClosingTags) safeEnqueue(pendingClosingTags);
    safeClose();
    cleanup();
  }
  const lifetimeMs = DEFAULT_LIFETIME_TIMEOUT_MS;
  lifetimeTimeoutHandle = setTimeout(() => {
    if (!cleanedUp && !isStreamClosed) {
      console.warn(`SSR stream transform exceeded maximum lifetime (${lifetimeMs}ms), forcing cleanup`);
      safeError(/* @__PURE__ */ new Error("Stream lifetime exceeded"));
      cleanup();
    }
  }, lifetimeMs);
  if (!serializationAlreadyFinished) {
    stopListeningToInjectedHtml = router.subscribe("onInjectedHtml", () => {
      if (cleanedUp || isStreamClosed) return;
      const html = router.serverSsr?.takeBufferedHtml();
      if (!html) return;
      if (isAppRendering || leftover || pendingClosingTags) appendRouterHtml(html);
      else {
        flushPendingRouterHtml();
        safeEnqueue(html);
      }
    });
    stopListeningToSerializationFinished = router.subscribe("onSerializationFinished", () => {
      serializationFinished = true;
      tryFinish();
    });
  }
  (async () => {
    const reader = appStream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (cleanedUp || isStreamClosed) return;
        const text = value instanceof Uint8Array ? textDecoder.decode(value, { stream: true }) : String(value);
        const chunkString = leftover ? leftover + text : text;
        if (!streamBarrierLifted) {
          if (chunkString.includes("$tsr-stream-barrier")) {
            streamBarrierLifted = true;
            router.serverSsr?.liftScriptBarrier();
          }
        }
        if (pendingClosingTags) {
          pendingClosingTags += chunkString;
          leftover = "";
          continue;
        }
        const bodyEndIndex = chunkString.indexOf(BODY_END_TAG);
        const htmlEndIndex = chunkString.indexOf(HTML_END_TAG);
        if (bodyEndIndex !== -1 && htmlEndIndex !== -1 && bodyEndIndex < htmlEndIndex) {
          pendingClosingTags = chunkString.slice(bodyEndIndex);
          safeEnqueue(chunkString.slice(0, bodyEndIndex));
          flushPendingRouterHtml();
          leftover = "";
          continue;
        }
        const lastClosingTagEnd = findLastClosingTagEnd(chunkString);
        if (lastClosingTagEnd > 0) {
          safeEnqueue(chunkString.slice(0, lastClosingTagEnd));
          flushPendingRouterHtml();
          leftover = chunkString.slice(lastClosingTagEnd);
          if (leftover.length > MAX_LEFTOVER_CHARS) {
            safeEnqueue(leftover.slice(0, leftover.length - MAX_LEFTOVER_CHARS));
            leftover = leftover.slice(-MAX_LEFTOVER_CHARS);
          }
        } else {
          const combined = chunkString;
          if (combined.length > MAX_LEFTOVER_CHARS) {
            const flushUpto = combined.length - MAX_LEFTOVER_CHARS;
            safeEnqueue(combined.slice(0, flushUpto));
            leftover = combined.slice(flushUpto);
          } else leftover = combined;
        }
      }
      if (cleanedUp || isStreamClosed) return;
      isAppRendering = false;
      router.serverSsr?.setRenderFinished();
      if (serializationFinished) tryFinish();
      else {
        const timeoutMs = opts?.timeoutMs ?? DEFAULT_SERIALIZATION_TIMEOUT_MS;
        serializationTimeoutHandle = setTimeout(() => {
          if (!cleanedUp && !isStreamClosed) {
            console.error("Serialization timeout after app render finished");
            safeError(/* @__PURE__ */ new Error("Serialization timeout after app render finished"));
            cleanup();
          }
        }, timeoutMs);
      }
    } catch (error) {
      if (cleanedUp) return;
      console.error("Error reading appStream:", error);
      isAppRendering = false;
      router.serverSsr?.setRenderFinished();
      safeError(error);
      cleanup();
    } finally {
      reader.releaseLock();
    }
  })().catch((error) => {
    if (cleanedUp) return;
    console.error("Error in stream transform:", error);
    safeError(error);
    cleanup();
  });
  return stream;
}
var fullPattern = " daum[ /]| deusu/|(?:^|[^g])news(?!sapphire)|(?<! (?:channel/|google/))google(?!(app|/google| pixel))|(?<! cu)bots?(?:\\b|_)|(?<!(?:lib))http|(?<!cam)scan|24x7|@[a-z][\\w-]+\\.|\\(\\)|\\.com\\b|\\b\\w+\\.ai|\\bcursor/|\\bmanus-user/|\\bort/|\\bperl\\b|\\bplaywright\\b|\\bsecurityheaders\\b|\\bselenium\\b|\\btime/|\\||^[\\w \\.\\-\\(?:\\):%]+(?:/v?\\d+(?:\\.\\d+)?(?:\\.\\d{1,10})*?)?(?:,|$)|^[\\w\\-]+/[\\w]+$|^[^ ]{50,}$|^\\d+\\b|^\\W|^\\w*search\\b|^\\w+/[\\w\\(\\)]*$|^\\w+/\\d\\.\\d\\s\\([\\w@]+\\)$|^active|^ad muncher|^amaya|^apache/|^avsdevicesdk/|^azure|^biglotron|^bot|^bw/|^clamav[ /]|^claude-code/|^client/|^cobweb/|^custom|^ddg[_-]android|^discourse|^dispatch/\\d|^downcast/|^duckduckgo|^email|^facebook|^getright/|^gozilla/|^hobbit|^hotzonu|^hwcdn/|^igetter/|^jeode/|^jetty/|^jigsaw|^microsoft bits|^movabletype|^mozilla/\\d\\.\\d\\s[\\w\\.-]+$|^mozilla/\\d\\.\\d\\s\\((?:compatible;)?(?:\\s?[\\w\\d-.]+\\/\\d+\\.\\d+)?\\)$|^navermailapp|^netsurf|^offline|^openai/|^owler|^php|^postman|^python|^rank|^read|^reed|^rest|^rss|^snapchat|^space bison|^svn|^swcd |^taringa|^thumbor/|^track|^w3c|^webbandit/|^webcopier|^wget|^whatsapp|^wordpress|^xenu link sleuth|^yahoo|^yandex|^zdm/\\d|^zoom marketplace/|advisor|agent\\b|analyzer|archive|ask jeeves/teoma|audit|bit\\.ly/|bluecoat drtr|browsex|burpcollaborator|capture|catch|check\\b|checker|chrome-lighthouse|chromeframe|classifier|cloudflare|convertify|crawl|cypress/|dareboost|datanyze|dejaclick|detect|dmbrowser|download|exaleadcloudview|feed|fetcher|firephp|functionize|grab|headless|httrack|hubspot marketing grader|ibisbrowser|infrawatch|insight|inspect|iplabel|java(?!;)|library|linkcheck|mail\\.ru/|manager|measure|monitor\\b|neustar wpm|node\\b|nutch|offbyone|onetrust|optimize|pageburst|pagespeed|parser|phantomjs|pingdom|powermarks|preview|proxy|ptst[ /]\\d|retriever|rexx;|rigor|rss\\b|scrape|server|sogou|sparkler/|speedcurve|spider|splash|statuscake|supercleaner|synapse|synthetic|tools|torrent|transcoder|url|validator|virtuoso|wappalyzer|webglance|webkit2png|whatcms/|xtate/";
var naivePattern = /bot|crawl|http|lighthouse|scan|search|spider/i;
var pattern;
function getPattern() {
  if (pattern instanceof RegExp) {
    return pattern;
  }
  try {
    pattern = new RegExp(fullPattern, "i");
  } catch (error) {
    pattern = naivePattern;
  }
  return pattern;
}
var isNonEmptyString = (value) => typeof value === "string" && value !== "";
function isbot(userAgent) {
  return isNonEmptyString(userAgent) && getPattern().test(userAgent);
}
var renderRouterToStream = async ({ request, router, responseHeaders, children }) => {
  if (typeof ReactDOMServer.renderToReadableStream === "function") {
    const stream = await ReactDOMServer.renderToReadableStream(children, {
      signal: request.signal,
      nonce: router.options.ssr?.nonce,
      progressiveChunkSize: Number.POSITIVE_INFINITY
    });
    if (isbot(request.headers.get("User-Agent"))) await stream.allReady;
    const responseStream = transformReadableStreamWithRouter(router, stream);
    return new Response(responseStream, {
      status: router.stores.statusCode.get(),
      headers: responseHeaders
    });
  }
  if (typeof ReactDOMServer.renderToPipeableStream === "function") {
    const reactAppPassthrough = new PassThrough();
    try {
      const pipeable = ReactDOMServer.renderToPipeableStream(children, {
        nonce: router.options.ssr?.nonce,
        progressiveChunkSize: Number.POSITIVE_INFINITY,
        ...isbot(request.headers.get("User-Agent")) ? { onAllReady() {
          pipeable.pipe(reactAppPassthrough);
        } } : { onShellReady() {
          pipeable.pipe(reactAppPassthrough);
        } },
        onError: (error, info) => {
          console.error("Error in renderToPipeableStream:", error, info);
          if (!reactAppPassthrough.destroyed) reactAppPassthrough.destroy(error instanceof Error ? error : new Error(String(error)));
        }
      });
    } catch (e) {
      console.error("Error in renderToPipeableStream:", e);
      reactAppPassthrough.destroy(e instanceof Error ? e : new Error(String(e)));
    }
    const responseStream = transformPipeableStreamWithRouter(router, reactAppPassthrough);
    return new Response(responseStream, {
      status: router.stores.statusCode.get(),
      headers: responseHeaders
    });
  }
  throw new Error("No renderToReadableStream or renderToPipeableStream found in react-dom/server. Ensure you are using a version of react-dom that supports streaming.");
};
var defaultStreamHandler = defineHandlerCallback(({ request, router, responseHeaders }) => renderRouterToStream({
  request,
  router,
  responseHeaders,
  children: /* @__PURE__ */ jsxRuntimeExports.jsx(StartServer, { router })
}));
const NullProtoObj = /* @__PURE__ */ (() => {
  const e = function() {
  };
  return e.prototype = /* @__PURE__ */ Object.create(null), Object.freeze(e.prototype), e;
})();
const FastURL = URL;
const FastResponse = Response;
function decodePathname(pathname) {
  return decodeURI(pathname.includes("%25") ? pathname.replace(/%25/g, "%2525") : pathname);
}
const kEventNS = "h3.internal.event.";
const kEventRes = /* @__PURE__ */ Symbol.for(`${kEventNS}res`);
const kEventResHeaders = /* @__PURE__ */ Symbol.for(`${kEventNS}res.headers`);
const kEventResErrHeaders = /* @__PURE__ */ Symbol.for(`${kEventNS}res.err.headers`);
var H3Event = class {
  app;
  req;
  url;
  context;
  static __is_event__ = true;
  constructor(req, context, app) {
    this.context = context || req.context || new NullProtoObj();
    this.req = req;
    this.app = app;
    const _url = req._url;
    const url = _url && _url instanceof URL ? _url : new FastURL(req.url);
    if (url.pathname.includes("%")) url.pathname = decodePathname(url.pathname);
    this.url = url;
  }
  get res() {
    return this[kEventRes] ||= new H3EventResponse();
  }
  get runtime() {
    return this.req.runtime;
  }
  waitUntil(promise) {
    this.req.waitUntil?.(promise);
  }
  toString() {
    return `[${this.req.method}] ${this.req.url}`;
  }
  toJSON() {
    return this.toString();
  }
  get node() {
    return this.req.runtime?.node;
  }
  get headers() {
    return this.req.headers;
  }
  get path() {
    return this.url.pathname + this.url.search;
  }
  get method() {
    return this.req.method;
  }
};
var H3EventResponse = class {
  status;
  statusText;
  get headers() {
    return this[kEventResHeaders] ||= new Headers();
  }
  get errHeaders() {
    return this[kEventResErrHeaders] ||= new Headers();
  }
};
const DISALLOWED_STATUS_CHARS = /[^\u0009\u0020-\u007E]/g;
function sanitizeStatusMessage(statusMessage = "") {
  return statusMessage.replace(DISALLOWED_STATUS_CHARS, "");
}
function sanitizeStatusCode(statusCode, defaultStatusCode = 200) {
  if (!statusCode) return defaultStatusCode;
  if (typeof statusCode === "string") statusCode = +statusCode;
  if (statusCode < 100 || statusCode > 599) return defaultStatusCode;
  return statusCode;
}
var HTTPError = class HTTPError2 extends Error {
  get name() {
    return "HTTPError";
  }
  status;
  statusText;
  headers;
  cause;
  data;
  body;
  unhandled;
  static isError(input) {
    return input instanceof Error && input?.name === "HTTPError";
  }
  static status(status, statusText, details) {
    return new HTTPError2({
      ...details,
      statusText,
      status
    });
  }
  constructor(arg1, arg2) {
    let messageInput;
    let details;
    if (typeof arg1 === "string") {
      messageInput = arg1;
      details = arg2;
    } else details = arg1;
    const status = sanitizeStatusCode(details?.status || details?.statusCode || details?.cause?.status || details?.cause?.statusCode, 500);
    const statusText = sanitizeStatusMessage(details?.statusText || details?.statusMessage || details?.cause?.statusText || details?.cause?.statusMessage);
    const message = messageInput || details?.message || details?.cause?.message || details?.statusText || details?.statusMessage || [
      "HTTPError",
      status,
      statusText
    ].filter(Boolean).join(" ");
    super(message, { cause: details });
    this.cause = details;
    this.status = status;
    this.statusText = statusText || void 0;
    const rawHeaders = details?.headers || details?.cause?.headers;
    this.headers = rawHeaders ? new Headers(rawHeaders) : void 0;
    this.unhandled = details?.unhandled ?? details?.cause?.unhandled ?? void 0;
    this.data = details?.data;
    this.body = details?.body;
  }
  get statusCode() {
    return this.status;
  }
  get statusMessage() {
    return this.statusText;
  }
  toJSON() {
    const unhandled = this.unhandled;
    return {
      status: this.status,
      statusText: this.statusText,
      unhandled,
      message: unhandled ? "HTTPError" : this.message,
      data: unhandled ? void 0 : this.data,
      ...unhandled ? void 0 : this.body
    };
  }
};
function isJSONSerializable(value, _type) {
  if (value === null || value === void 0) return true;
  if (_type !== "object") return _type === "boolean" || _type === "number" || _type === "string";
  if (typeof value.toJSON === "function") return true;
  if (Array.isArray(value)) return true;
  if (typeof value.pipe === "function" || typeof value.pipeTo === "function") return false;
  if (value instanceof NullProtoObj) return true;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
const kNotFound = /* @__PURE__ */ Symbol.for("h3.notFound");
const kHandled = /* @__PURE__ */ Symbol.for("h3.handled");
function toResponse(val, event, config2 = {}) {
  if (typeof val?.then === "function") return (val.catch?.((error) => error) || Promise.resolve(val)).then((resolvedVal) => toResponse(resolvedVal, event, config2));
  const response = prepareResponse(val, event, config2);
  if (typeof response?.then === "function") return toResponse(response, event, config2);
  const { onResponse } = config2;
  return onResponse ? Promise.resolve(onResponse(response, event)).then(() => response) : response;
}
var HTTPResponse = class {
  #headers;
  #init;
  body;
  constructor(body, init) {
    this.body = body;
    this.#init = init;
  }
  get status() {
    return this.#init?.status || 200;
  }
  get statusText() {
    return this.#init?.statusText || "OK";
  }
  get headers() {
    return this.#headers ||= new Headers(this.#init?.headers);
  }
};
function prepareResponse(val, event, config2, nested) {
  if (val === kHandled) return new FastResponse(null);
  if (val === kNotFound) val = new HTTPError({
    status: 404,
    message: `Cannot find any route matching [${event.req.method}] ${event.url}`
  });
  if (val && val instanceof Error) {
    const isHTTPError = HTTPError.isError(val);
    const error = isHTTPError ? val : new HTTPError(val);
    if (!isHTTPError) {
      error.unhandled = true;
      if (val?.stack) error.stack = val.stack;
    }
    if (error.unhandled && !config2.silent) console.error(error);
    const { onError } = config2;
    const errHeaders = event[kEventRes]?.[kEventResErrHeaders];
    return onError && !nested ? Promise.resolve(onError(error, event)).catch((error2) => error2).then((newVal) => prepareResponse(newVal ?? val, event, config2, true)) : errorResponse(error, config2.debug, errHeaders);
  }
  const preparedRes = event[kEventRes];
  const preparedHeaders = preparedRes?.[kEventResHeaders];
  event[kEventRes] = void 0;
  if (!(val instanceof Response)) {
    const res = prepareResponseBody(val, event, config2);
    const status = res.status || preparedRes?.status;
    return new FastResponse(nullBody(event.req.method, status) ? null : res.body, {
      status,
      statusText: res.statusText || preparedRes?.statusText,
      headers: res.headers && preparedHeaders ? mergeHeaders$1(res.headers, preparedHeaders) : res.headers || preparedHeaders
    });
  }
  if (!preparedHeaders || nested || !val.ok) return val;
  try {
    mergeHeaders$1(val.headers, preparedHeaders, val.headers);
    return val;
  } catch {
    return new FastResponse(nullBody(event.req.method, val.status) ? null : val.body, {
      status: val.status,
      statusText: val.statusText,
      headers: mergeHeaders$1(val.headers, preparedHeaders)
    });
  }
}
function mergeHeaders$1(base, overrides, target = new Headers(base)) {
  for (const [name, value] of overrides) if (name === "set-cookie") target.append(name, value);
  else target.set(name, value);
  return target;
}
const frozen = (name) => (...args) => {
  throw new Error(`Headers are frozen (${name} ${args.join(", ")})`);
};
var FrozenHeaders = class extends Headers {
  set = frozen("set");
  append = frozen("append");
  delete = frozen("delete");
};
const emptyHeaders = /* @__PURE__ */ new FrozenHeaders({ "content-length": "0" });
const jsonHeaders = /* @__PURE__ */ new FrozenHeaders({ "content-type": "application/json;charset=UTF-8" });
function prepareResponseBody(val, event, config2) {
  if (val === null || val === void 0) return {
    body: "",
    headers: emptyHeaders
  };
  const valType = typeof val;
  if (valType === "string") return { body: val };
  if (val instanceof Uint8Array) {
    event.res.headers.set("content-length", val.byteLength.toString());
    return { body: val };
  }
  if (val instanceof HTTPResponse || val?.constructor?.name === "HTTPResponse") return val;
  if (isJSONSerializable(val, valType)) return {
    body: JSON.stringify(val, void 0, config2.debug ? 2 : void 0),
    headers: jsonHeaders
  };
  if (valType === "bigint") return {
    body: val.toString(),
    headers: jsonHeaders
  };
  if (val instanceof Blob) {
    const headers = new Headers({
      "content-type": val.type,
      "content-length": val.size.toString()
    });
    let filename = val.name;
    if (filename) {
      filename = encodeURIComponent(filename);
      headers.set("content-disposition", `filename="${filename}"; filename*=UTF-8''${filename}`);
    }
    return {
      body: val.stream(),
      headers
    };
  }
  if (valType === "symbol") return { body: val.toString() };
  if (valType === "function") return { body: `${val.name}()` };
  return { body: val };
}
function nullBody(method, status) {
  return method === "HEAD" || status === 100 || status === 101 || status === 102 || status === 204 || status === 205 || status === 304;
}
function errorResponse(error, debug, errHeaders) {
  let headers = error.headers ? mergeHeaders$1(jsonHeaders, error.headers) : new Headers(jsonHeaders);
  if (errHeaders) headers = mergeHeaders$1(headers, errHeaders);
  return new FastResponse(JSON.stringify({
    ...error.toJSON(),
    stack: debug && error.stack ? error.stack.split("\n").map((l) => l.trim()) : void 0
  }, void 0, debug ? 2 : void 0), {
    status: error.status,
    statusText: error.statusText,
    headers
  });
}
var GLOBAL_EVENT_STORAGE_KEY = /* @__PURE__ */ Symbol.for("tanstack-start:event-storage");
var globalObj$1 = globalThis;
if (!globalObj$1[GLOBAL_EVENT_STORAGE_KEY]) globalObj$1[GLOBAL_EVENT_STORAGE_KEY] = new AsyncLocalStorage();
var eventStorage = globalObj$1[GLOBAL_EVENT_STORAGE_KEY];
function isPromiseLike(value) {
  return typeof value.then === "function";
}
function getSetCookieValues(headers) {
  const headersWithSetCookie = headers;
  if (typeof headersWithSetCookie.getSetCookie === "function") return headersWithSetCookie.getSetCookie();
  const value = headers.get("set-cookie");
  return value ? [value] : [];
}
function mergeEventResponseHeaders(response, event) {
  if (response.ok) return;
  const eventSetCookies = getSetCookieValues(event.res.headers);
  if (eventSetCookies.length === 0) return;
  const responseSetCookies = getSetCookieValues(response.headers);
  response.headers.delete("set-cookie");
  for (const cookie of responseSetCookies) response.headers.append("set-cookie", cookie);
  for (const cookie of eventSetCookies) response.headers.append("set-cookie", cookie);
}
function attachResponseHeaders(value, event) {
  if (isPromiseLike(value)) return value.then((resolved) => {
    if (resolved instanceof Response) mergeEventResponseHeaders(resolved, event);
    return resolved;
  });
  if (value instanceof Response) mergeEventResponseHeaders(value, event);
  return value;
}
function requestHandler(handler) {
  return (request, requestOpts) => {
    let h3Event;
    try {
      h3Event = new H3Event(request);
    } catch (error) {
      if (error instanceof URIError) return new Response(null, {
        status: 400,
        statusText: "Bad Request"
      });
      throw error;
    }
    return toResponse(attachResponseHeaders(eventStorage.run({ h3Event }, () => handler(request, requestOpts)), h3Event), h3Event);
  };
}
function getH3Event() {
  const event = eventStorage.getStore();
  if (!event) throw new Error(`No StartEvent found in AsyncLocalStorage. Make sure you are using the function within the server runtime.`);
  return event.h3Event;
}
function getResponse() {
  return getH3Event().res;
}
var HEADERS = { TSS_SHELL: "X-TSS_SHELL" };
function sanitizePathSegment(segment) {
  return segment.replace(/[\x00-\x1f\x7f]/g, "");
}
function decodeSegment(segment) {
  let decoded;
  try {
    decoded = decodeURI(segment);
  } catch {
    decoded = segment.replaceAll(/%[0-9A-F]{2}/gi, (match) => {
      try {
        return decodeURI(match);
      } catch {
        return match;
      }
    });
  }
  return sanitizePathSegment(decoded);
}
function decodePath(path) {
  if (!path) return {
    path,
    handledProtocolRelativeURL: false
  };
  if (!/[%\\\x00-\x1f\x7f]/.test(path) && !path.startsWith("//")) return {
    path,
    handledProtocolRelativeURL: false
  };
  const re2 = /%25|%5C/gi;
  let cursor = 0;
  let result = "";
  let match;
  while (null !== (match = re2.exec(path))) {
    result += decodeSegment(path.slice(cursor, match.index)) + match[0];
    cursor = re2.lastIndex;
  }
  result = result + decodeSegment(cursor ? path.slice(cursor) : path);
  let handledProtocolRelativeURL = false;
  if (result.startsWith("//")) {
    handledProtocolRelativeURL = true;
    result = "/" + result.replace(/^\/+/, "");
  }
  return {
    path: result,
    handledProtocolRelativeURL
  };
}
function invariant() {
  throw new Error("Invariant failed");
}
function createLRUCache(max) {
  const cache = /* @__PURE__ */ new Map();
  let oldest;
  let newest;
  const touch = (entry) => {
    if (!entry.next) return;
    if (!entry.prev) {
      entry.next.prev = void 0;
      oldest = entry.next;
      entry.next = void 0;
      if (newest) {
        entry.prev = newest;
        newest.next = entry;
      }
    } else {
      entry.prev.next = entry.next;
      entry.next.prev = entry.prev;
      entry.next = void 0;
      if (newest) {
        newest.next = entry;
        entry.prev = newest;
      }
    }
    newest = entry;
  };
  return {
    get(key) {
      const entry = cache.get(key);
      if (!entry) return void 0;
      touch(entry);
      return entry.value;
    },
    set(key, value) {
      if (cache.size >= max && oldest) {
        const toDelete = oldest;
        cache.delete(toDelete.key);
        if (toDelete.next) {
          oldest = toDelete.next;
          toDelete.next.prev = void 0;
        }
        if (toDelete === newest) newest = void 0;
      }
      const existing = cache.get(key);
      if (existing) {
        existing.value = value;
        touch(existing);
      } else {
        const entry = {
          key,
          value,
          prev: newest
        };
        if (newest) newest.next = entry;
        newest = entry;
        if (!oldest) oldest = entry;
        cache.set(key, entry);
      }
    },
    clear() {
      cache.clear();
      oldest = void 0;
      newest = void 0;
    }
  };
}
function isNotFound(obj) {
  return obj?.isNotFound === true;
}
var rootRouteId = "__root__";
function isRedirect(obj) {
  return obj instanceof Response && !!obj.options;
}
function isResolvedRedirect(obj) {
  return isRedirect(obj) && !!obj.options.href;
}
function executeRewriteInput(rewrite, url) {
  const res = rewrite?.input?.({ url });
  if (res) {
    if (typeof res === "string") return new URL(res);
    else if (res instanceof URL) return res;
  }
  return url;
}
function resolveManifestAssetLink(link) {
  if (typeof link === "string") return {
    href: link,
    crossOrigin: void 0
  };
  return link;
}
var GLOBAL_TSR = "$_TSR";
var TSR_SCRIPT_BARRIER_ID = "$tsr-stream-barrier";
function createSerializationAdapter(opts) {
  return opts;
}
// @__NO_SIDE_EFFECTS__
function makeSsrSerovalPlugin(serializationAdapter, options) {
  return /* @__PURE__ */ ni({
    tag: "$TSR/t/" + serializationAdapter.key,
    test: serializationAdapter.test,
    parse: { stream(value, ctx, _data) {
      return { v: ctx.parse(serializationAdapter.toSerializable(value)) };
    } },
    serialize(node, ctx, _data) {
      options.didRun = true;
      return GLOBAL_TSR + '.t.get("' + serializationAdapter.key + '")(' + ctx.serialize(node.v) + ")";
    },
    deserialize: void 0
  });
}
// @__NO_SIDE_EFFECTS__
function makeSerovalPlugin(serializationAdapter) {
  return /* @__PURE__ */ ni({
    tag: "$TSR/t/" + serializationAdapter.key,
    test: serializationAdapter.test,
    parse: {
      sync(value, ctx, _data) {
        return { v: ctx.parse(serializationAdapter.toSerializable(value)) };
      },
      async async(value, ctx, _data) {
        return { v: await ctx.parse(serializationAdapter.toSerializable(value)) };
      },
      stream(value, ctx, _data) {
        return { v: ctx.parse(serializationAdapter.toSerializable(value)) };
      }
    },
    serialize: void 0,
    deserialize(node, ctx, _data) {
      return serializationAdapter.fromSerializable(ctx.deserialize(node.v));
    }
  });
}
var RawStream = class {
  constructor(stream, options) {
    this.stream = stream;
    this.hint = options?.hint ?? "binary";
  }
};
var BufferCtor = globalThis.Buffer;
var hasNodeBuffer = !!BufferCtor && typeof BufferCtor.from === "function";
function uint8ArrayToBase64(bytes) {
  if (bytes.length === 0) return "";
  if (hasNodeBuffer) return BufferCtor.from(bytes).toString("base64");
  const CHUNK_SIZE = 32768;
  const chunks = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    chunks.push(String.fromCharCode.apply(null, chunk));
  }
  return btoa(chunks.join(""));
}
function base64ToUint8Array(base64) {
  if (base64.length === 0) return new Uint8Array(0);
  if (hasNodeBuffer) {
    const buf = BufferCtor.from(base64, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
var RAW_STREAM_FACTORY_BINARY = /* @__PURE__ */ Object.create(null);
var RAW_STREAM_FACTORY_TEXT = /* @__PURE__ */ Object.create(null);
var RAW_STREAM_FACTORY_CONSTRUCTOR_BINARY = (stream) => new ReadableStream({ start(controller) {
  stream.on({
    next(base64) {
      try {
        controller.enqueue(base64ToUint8Array(base64));
      } catch {
      }
    },
    throw(error) {
      controller.error(error);
    },
    return() {
      try {
        controller.close();
      } catch {
      }
    }
  });
} });
var textEncoderForFactory = new TextEncoder();
var RAW_STREAM_FACTORY_CONSTRUCTOR_TEXT = (stream) => {
  return new ReadableStream({ start(controller) {
    stream.on({
      next(value) {
        try {
          if (typeof value === "string") controller.enqueue(textEncoderForFactory.encode(value));
          else controller.enqueue(base64ToUint8Array(value.$b64));
        } catch {
        }
      },
      throw(error) {
        controller.error(error);
      },
      return() {
        try {
          controller.close();
        } catch {
        }
      }
    });
  } });
};
var FACTORY_BINARY = `(s=>new ReadableStream({start(c){s.on({next(b){try{const d=atob(b),a=new Uint8Array(d.length);for(let i=0;i<d.length;i++)a[i]=d.charCodeAt(i);c.enqueue(a)}catch(_){}},throw(e){c.error(e)},return(){try{c.close()}catch(_){}}})}}))`;
var FACTORY_TEXT = `(s=>{const e=new TextEncoder();return new ReadableStream({start(c){s.on({next(v){try{if(typeof v==='string'){c.enqueue(e.encode(v))}else{const d=atob(v.$b64),a=new Uint8Array(d.length);for(let i=0;i<d.length;i++)a[i]=d.charCodeAt(i);c.enqueue(a)}}catch(_){}},throw(x){c.error(x)},return(){try{c.close()}catch(_){}}})}})})`;
function toBinaryStream(readable) {
  const stream = te();
  const reader = readable.getReader();
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          stream.return(void 0);
          break;
        }
        stream.next(uint8ArrayToBase64(value));
      }
    } catch (error) {
      stream.throw(error);
    } finally {
      reader.releaseLock();
    }
  })();
  return stream;
}
function toTextStream(readable) {
  const stream = te();
  const reader = readable.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          try {
            const remaining = decoder.decode();
            if (remaining.length > 0) stream.next(remaining);
          } catch {
          }
          stream.return(void 0);
          break;
        }
        try {
          const text = decoder.decode(value, { stream: true });
          if (text.length > 0) stream.next(text);
        } catch {
          stream.next({ $b64: uint8ArrayToBase64(value) });
        }
      }
    } catch (error) {
      stream.throw(error);
    } finally {
      reader.releaseLock();
    }
  })();
  return stream;
}
var RawStreamSSRPlugin = /* @__PURE__ */ ni({
  tag: "tss/RawStream",
  extends: [/* @__PURE__ */ ni({
    tag: "tss/RawStreamFactory",
    test(value) {
      return value === RAW_STREAM_FACTORY_BINARY;
    },
    parse: {
      sync(_value, _ctx, _data) {
        return {};
      },
      async async(_value, _ctx, _data) {
        return {};
      },
      stream(_value, _ctx, _data) {
        return {};
      }
    },
    serialize(_node, _ctx, _data) {
      return FACTORY_BINARY;
    },
    deserialize(_node, _ctx, _data) {
      return RAW_STREAM_FACTORY_BINARY;
    }
  }), /* @__PURE__ */ ni({
    tag: "tss/RawStreamFactoryText",
    test(value) {
      return value === RAW_STREAM_FACTORY_TEXT;
    },
    parse: {
      sync(_value, _ctx, _data) {
        return {};
      },
      async async(_value, _ctx, _data) {
        return {};
      },
      stream(_value, _ctx, _data) {
        return {};
      }
    },
    serialize(_node, _ctx, _data) {
      return FACTORY_TEXT;
    },
    deserialize(_node, _ctx, _data) {
      return RAW_STREAM_FACTORY_TEXT;
    }
  })],
  test(value) {
    return value instanceof RawStream;
  },
  parse: {
    sync(value, ctx, _data) {
      const factory = value.hint === "text" ? RAW_STREAM_FACTORY_TEXT : RAW_STREAM_FACTORY_BINARY;
      return {
        hint: ctx.parse(value.hint),
        factory: ctx.parse(factory),
        stream: ctx.parse(te())
      };
    },
    async async(value, ctx, _data) {
      const factory = value.hint === "text" ? RAW_STREAM_FACTORY_TEXT : RAW_STREAM_FACTORY_BINARY;
      const encodedStream = value.hint === "text" ? toTextStream(value.stream) : toBinaryStream(value.stream);
      return {
        hint: await ctx.parse(value.hint),
        factory: await ctx.parse(factory),
        stream: await ctx.parse(encodedStream)
      };
    },
    stream(value, ctx, _data) {
      const factory = value.hint === "text" ? RAW_STREAM_FACTORY_TEXT : RAW_STREAM_FACTORY_BINARY;
      const encodedStream = value.hint === "text" ? toTextStream(value.stream) : toBinaryStream(value.stream);
      return {
        hint: ctx.parse(value.hint),
        factory: ctx.parse(factory),
        stream: ctx.parse(encodedStream)
      };
    }
  },
  serialize(node, ctx, _data) {
    return "(" + ctx.serialize(node.factory) + ")(" + ctx.serialize(node.stream) + ")";
  },
  deserialize(node, ctx, _data) {
    const stream = ctx.deserialize(node.stream);
    return ctx.deserialize(node.hint) === "text" ? RAW_STREAM_FACTORY_CONSTRUCTOR_TEXT(stream) : RAW_STREAM_FACTORY_CONSTRUCTOR_BINARY(stream);
  }
});
// @__NO_SIDE_EFFECTS__
function createRawStreamRPCPlugin(onRawStream) {
  let nextStreamId = 1;
  return /* @__PURE__ */ ni({
    tag: "tss/RawStream",
    test(value) {
      return value instanceof RawStream;
    },
    parse: {
      async async(value, ctx, _data) {
        const streamId = nextStreamId++;
        onRawStream(streamId, value.stream);
        return { streamId: await ctx.parse(streamId) };
      },
      stream(value, ctx, _data) {
        const streamId = nextStreamId++;
        onRawStream(streamId, value.stream);
        return { streamId: ctx.parse(streamId) };
      }
    },
    serialize() {
      throw new Error("RawStreamRPCPlugin.serialize should not be called. RPC uses JSON serialization, not JS code generation.");
    },
    deserialize() {
      throw new Error("RawStreamRPCPlugin.deserialize should not be called. Use createRawStreamDeserializePlugin on client.");
    }
  });
}
var ShallowErrorPlugin = /* @__PURE__ */ ni({
  tag: "$TSR/Error",
  test(value) {
    return value instanceof Error;
  },
  parse: {
    sync(value, ctx) {
      return { message: ctx.parse(value.message) };
    },
    async async(value, ctx) {
      return { message: await ctx.parse(value.message) };
    },
    stream(value, ctx) {
      return { message: ctx.parse(value.message) };
    }
  },
  serialize(node, ctx) {
    return "new Error(" + ctx.serialize(node.message) + ")";
  },
  deserialize(node, ctx) {
    return new Error(ctx.deserialize(node.message));
  }
});
var defaultSerovalPlugins = [
  ShallowErrorPlugin,
  RawStreamSSRPlugin,
  p
];
async function getStartManifest(matchedRoutes) {
  const { tsrStartManifest } = await import("./_tanstack-start-manifest_v-BqD6dh8Y.js");
  const startManifest = tsrStartManifest();
  const rootRoute = startManifest.routes[rootRouteId] = startManifest.routes[rootRouteId] || {};
  rootRoute.assets = rootRoute.assets || [];
  let injectedHeadScripts;
  return {
    manifest: { routes: Object.fromEntries(Object.entries(startManifest.routes).flatMap(([k2, v2]) => {
      const result = {};
      let hasData = false;
      if (v2.preloads && v2.preloads.length > 0) {
        result["preloads"] = v2.preloads;
        hasData = true;
      }
      if (v2.assets && v2.assets.length > 0) {
        result["assets"] = v2.assets;
        hasData = true;
      }
      if (!hasData) return [];
      return [[k2, result]];
    })) },
    clientEntry: startManifest.clientEntry,
    injectedHeadScripts
  };
}
const manifest = {};
async function getServerFnById(id, access) {
  const serverFnInfo = manifest[id];
  if (!serverFnInfo) {
    throw new Error("Server function info not found for " + id);
  }
  const fnModule = serverFnInfo.module ?? await serverFnInfo.importer();
  if (!fnModule) {
    throw new Error("Server function module not resolved for " + id);
  }
  const action = fnModule[serverFnInfo.functionName];
  if (!action) {
    throw new Error("Server function module export not resolved for serverFn ID: " + id);
  }
  return action;
}
var TSS_FORMDATA_CONTEXT = "__TSS_CONTEXT";
var TSS_SERVER_FUNCTION = /* @__PURE__ */ Symbol.for("TSS_SERVER_FUNCTION");
var X_TSS_SERIALIZED = "x-tss-serialized";
var X_TSS_RAW_RESPONSE = "x-tss-raw";
var TSS_CONTENT_TYPE_FRAMED = "application/x-tss-framed";
var FrameType = {
  JSON: 0,
  CHUNK: 1,
  END: 2,
  ERROR: 3
};
var FRAME_HEADER_SIZE = 9;
var TSS_CONTENT_TYPE_FRAMED_VERSIONED = `${TSS_CONTENT_TYPE_FRAMED}; v=1`;
function isSafeKey(key) {
  return key !== "__proto__" && key !== "constructor" && key !== "prototype";
}
function safeObjectMerge(target, source) {
  const result = /* @__PURE__ */ Object.create(null);
  if (target) {
    for (const key of Object.keys(target)) if (isSafeKey(key)) result[key] = target[key];
  }
  if (source && typeof source === "object") {
    for (const key of Object.keys(source)) if (isSafeKey(key)) result[key] = source[key];
  }
  return result;
}
function createNullProtoObject(source) {
  if (!source) return /* @__PURE__ */ Object.create(null);
  const obj = /* @__PURE__ */ Object.create(null);
  for (const key of Object.keys(source)) if (isSafeKey(key)) obj[key] = source[key];
  return obj;
}
var GLOBAL_STORAGE_KEY = /* @__PURE__ */ Symbol.for("tanstack-start:start-storage-context");
var globalObj = globalThis;
if (!globalObj[GLOBAL_STORAGE_KEY]) globalObj[GLOBAL_STORAGE_KEY] = new AsyncLocalStorage();
var startStorage = globalObj[GLOBAL_STORAGE_KEY];
async function runWithStartContext(context, fn2) {
  return startStorage.run(context, fn2);
}
function getStartContext(opts) {
  const context = startStorage.getStore();
  if (!context && opts?.throwIfNotFound !== false) throw new Error(`No Start context found in AsyncLocalStorage. Make sure you are using the function within the server runtime.`);
  return context;
}
var getStartOptions = () => getStartContext().startOptions;
function toHeadersInstance(init) {
  if (init instanceof Headers) return init;
  else if (Array.isArray(init)) return new Headers(init);
  else if (typeof init === "object") return new Headers(init);
  else return null;
}
function mergeHeaders(...headers) {
  return headers.reduce((acc, header) => {
    const headersInstance = toHeadersInstance(header);
    if (!headersInstance) return acc;
    for (const [key, value] of headersInstance.entries()) if (key === "set-cookie") splitSetCookieString(value).forEach((cookie) => acc.append("set-cookie", cookie));
    else acc.set(key, value);
    return acc;
  }, new Headers());
}
function dehydrateSsrMatchId(id) {
  return id.replaceAll("/", "\0");
}
function flattenMiddlewares(middlewares, maxDepth = 100) {
  const seen = /* @__PURE__ */ new Set();
  const flattened = [];
  const recurse = (middleware, depth) => {
    if (depth > maxDepth) throw new Error(`Middleware nesting depth exceeded maximum of ${maxDepth}. Check for circular references.`);
    middleware.forEach((m2) => {
      if (m2.options.middleware) recurse(m2.options.middleware, depth + 1);
      if (!seen.has(m2)) {
        seen.add(m2);
        flattened.push(m2);
      }
    });
  };
  recurse(middlewares, 0);
  return flattened;
}
function getDefaultSerovalPlugins() {
  return [...getStartOptions()?.serializationAdapters?.map(makeSerovalPlugin) ?? [], ...defaultSerovalPlugins];
}
var textEncoder = new TextEncoder();
var EMPTY_PAYLOAD = new Uint8Array(0);
function encodeFrame(type, streamId, payload) {
  const frame = new Uint8Array(FRAME_HEADER_SIZE + payload.length);
  frame[0] = type;
  frame[1] = streamId >>> 24 & 255;
  frame[2] = streamId >>> 16 & 255;
  frame[3] = streamId >>> 8 & 255;
  frame[4] = streamId & 255;
  frame[5] = payload.length >>> 24 & 255;
  frame[6] = payload.length >>> 16 & 255;
  frame[7] = payload.length >>> 8 & 255;
  frame[8] = payload.length & 255;
  frame.set(payload, FRAME_HEADER_SIZE);
  return frame;
}
function encodeJSONFrame(json) {
  return encodeFrame(FrameType.JSON, 0, textEncoder.encode(json));
}
function encodeChunkFrame(streamId, chunk) {
  return encodeFrame(FrameType.CHUNK, streamId, chunk);
}
function encodeEndFrame(streamId) {
  return encodeFrame(FrameType.END, streamId, EMPTY_PAYLOAD);
}
function encodeErrorFrame(streamId, error) {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  return encodeFrame(FrameType.ERROR, streamId, textEncoder.encode(message));
}
function createMultiplexedStream(jsonStream, rawStreams, lateStreamSource) {
  let controller;
  let cancelled = false;
  const readers = [];
  const enqueue = (frame) => {
    if (cancelled) return false;
    try {
      controller.enqueue(frame);
      return true;
    } catch {
      return false;
    }
  };
  const errorOutput = (error) => {
    if (cancelled) return;
    cancelled = true;
    try {
      controller.error(error);
    } catch {
    }
    for (const reader of readers) reader.cancel().catch(() => {
    });
  };
  async function pumpRawStream(streamId, stream) {
    const reader = stream.getReader();
    readers.push(reader);
    try {
      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) {
          enqueue(encodeEndFrame(streamId));
          return;
        }
        if (!enqueue(encodeChunkFrame(streamId, value))) return;
      }
    } catch (error) {
      enqueue(encodeErrorFrame(streamId, error));
    } finally {
      reader.releaseLock();
    }
  }
  async function pumpJSON() {
    const reader = jsonStream.getReader();
    readers.push(reader);
    try {
      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) return;
        if (!enqueue(encodeJSONFrame(value))) return;
      }
    } catch (error) {
      errorOutput(error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
  async function pumpLateStreams() {
    if (!lateStreamSource) return [];
    const lateStreamPumps = [];
    const reader = lateStreamSource.getReader();
    readers.push(reader);
    try {
      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) break;
        lateStreamPumps.push(pumpRawStream(value.id, value.stream));
      }
    } finally {
      reader.releaseLock();
    }
    return lateStreamPumps;
  }
  return new ReadableStream({
    async start(ctrl) {
      controller = ctrl;
      const pumps = [pumpJSON()];
      for (const [streamId, stream] of rawStreams) pumps.push(pumpRawStream(streamId, stream));
      if (lateStreamSource) pumps.push(pumpLateStreams());
      try {
        const latePumps = (await Promise.all(pumps)).find(Array.isArray);
        if (latePumps && latePumps.length > 0) await Promise.all(latePumps);
        if (!cancelled) try {
          controller.close();
        } catch {
        }
      } catch {
      }
    },
    cancel() {
      cancelled = true;
      for (const reader of readers) reader.cancel().catch(() => {
      });
      readers.length = 0;
    }
  });
}
var serovalPlugins = void 0;
var FORM_DATA_CONTENT_TYPES = ["multipart/form-data", "application/x-www-form-urlencoded"];
var MAX_PAYLOAD_SIZE = 1e6;
var handleServerAction = async ({ request, context, serverFnId }) => {
  const methodUpper = request.method.toUpperCase();
  const url = new URL(request.url);
  const action = await getServerFnById(serverFnId);
  if (action.method && methodUpper !== action.method) return new Response(`expected ${action.method} method. Got ${methodUpper}`, {
    status: 405,
    headers: { Allow: action.method }
  });
  const isServerFn = request.headers.get("x-tsr-serverFn") === "true";
  if (!serovalPlugins) serovalPlugins = getDefaultSerovalPlugins();
  const contentType = request.headers.get("Content-Type");
  function parsePayload(payload) {
    return Iu(payload, { plugins: serovalPlugins });
  }
  return await (async () => {
    try {
      let serializeResult = function(res2) {
        let nonStreamingBody = void 0;
        const alsResponse = getResponse();
        if (res2 !== void 0) {
          const rawStreams = /* @__PURE__ */ new Map();
          let initialPhase = true;
          let lateStreamWriter;
          let lateStreamReadable = void 0;
          const pendingLateStreams = [];
          const plugins = [/* @__PURE__ */ createRawStreamRPCPlugin((id, stream) => {
            if (initialPhase) {
              rawStreams.set(id, stream);
              return;
            }
            if (lateStreamWriter) {
              lateStreamWriter.write({
                id,
                stream
              }).catch(() => {
              });
              return;
            }
            pendingLateStreams.push({
              id,
              stream
            });
          }), ...serovalPlugins || []];
          let done = false;
          const callbacks = {
            onParse: (value) => {
              nonStreamingBody = value;
            },
            onDone: () => {
              done = true;
            },
            onError: (error) => {
              throw error;
            }
          };
          au(res2, {
            refs: /* @__PURE__ */ new Map(),
            plugins,
            onParse(value) {
              callbacks.onParse(value);
            },
            onDone() {
              callbacks.onDone();
            },
            onError: (error) => {
              callbacks.onError(error);
            }
          });
          initialPhase = false;
          if (done && rawStreams.size === 0) return new Response(nonStreamingBody ? JSON.stringify(nonStreamingBody) : void 0, {
            status: alsResponse.status,
            statusText: alsResponse.statusText,
            headers: {
              "Content-Type": "application/json",
              [X_TSS_SERIALIZED]: "true"
            }
          });
          const { readable, writable } = new TransformStream();
          lateStreamReadable = readable;
          lateStreamWriter = writable.getWriter();
          for (const registration of pendingLateStreams) lateStreamWriter.write(registration).catch(() => {
          });
          pendingLateStreams.length = 0;
          const multiplexedStream = createMultiplexedStream(new ReadableStream({
            start(controller) {
              callbacks.onParse = (value) => {
                controller.enqueue(JSON.stringify(value) + "\n");
              };
              callbacks.onDone = () => {
                try {
                  controller.close();
                } catch {
                }
                lateStreamWriter?.close().catch(() => {
                }).finally(() => {
                  lateStreamWriter = void 0;
                });
              };
              callbacks.onError = (error) => {
                controller.error(error);
                lateStreamWriter?.abort(error).catch(() => {
                }).finally(() => {
                  lateStreamWriter = void 0;
                });
              };
              if (nonStreamingBody !== void 0) callbacks.onParse(nonStreamingBody);
              if (done) callbacks.onDone();
            },
            cancel() {
              lateStreamWriter?.abort().catch(() => {
              });
              lateStreamWriter = void 0;
            }
          }), rawStreams, lateStreamReadable);
          return new Response(multiplexedStream, {
            status: alsResponse.status,
            statusText: alsResponse.statusText,
            headers: {
              "Content-Type": TSS_CONTENT_TYPE_FRAMED_VERSIONED,
              [X_TSS_SERIALIZED]: "true"
            }
          });
        }
        return new Response(void 0, {
          status: alsResponse.status,
          statusText: alsResponse.statusText
        });
      };
      let res = await (async () => {
        if (FORM_DATA_CONTENT_TYPES.some((type) => contentType && contentType.includes(type))) {
          if (methodUpper === "GET") {
            if (false) ;
            invariant();
          }
          const formData = await request.formData();
          const serializedContext = formData.get(TSS_FORMDATA_CONTEXT);
          formData.delete(TSS_FORMDATA_CONTEXT);
          const params = {
            context,
            data: formData,
            method: methodUpper
          };
          if (typeof serializedContext === "string") try {
            const deserializedContext = Iu(JSON.parse(serializedContext), { plugins: serovalPlugins });
            if (typeof deserializedContext === "object" && deserializedContext) params.context = safeObjectMerge(deserializedContext, context);
          } catch (e) {
            if (false) ;
          }
          return await action(params);
        }
        if (methodUpper === "GET") {
          const payloadParam = url.searchParams.get("payload");
          if (payloadParam && payloadParam.length > MAX_PAYLOAD_SIZE) throw new Error("Payload too large");
          const payload2 = payloadParam ? parsePayload(JSON.parse(payloadParam)) : {};
          payload2.context = safeObjectMerge(payload2.context, context);
          payload2.method = methodUpper;
          return await action(payload2);
        }
        let jsonPayload;
        if (contentType?.includes("application/json")) jsonPayload = await request.json();
        const payload = jsonPayload ? parsePayload(jsonPayload) : {};
        payload.context = safeObjectMerge(payload.context, context);
        payload.method = methodUpper;
        return await action(payload);
      })();
      const unwrapped = res.result || res.error;
      if (isNotFound(res)) res = isNotFoundResponse(res);
      if (!isServerFn) return unwrapped;
      if (unwrapped instanceof Response) {
        if (isRedirect(unwrapped)) return unwrapped;
        unwrapped.headers.set(X_TSS_RAW_RESPONSE, "true");
        return unwrapped;
      }
      return serializeResult(res);
    } catch (error) {
      if (error instanceof Response) return error;
      if (isNotFound(error)) return isNotFoundResponse(error);
      console.info();
      console.info("Server Fn Error!");
      console.info();
      console.error(error);
      console.info();
      const serializedError = JSON.stringify(await Promise.resolve(ou(error, {
        refs: /* @__PURE__ */ new Map(),
        plugins: serovalPlugins
      })));
      const response = getResponse();
      return new Response(serializedError, {
        status: response.status ?? 500,
        statusText: response.statusText,
        headers: {
          "Content-Type": "application/json",
          [X_TSS_SERIALIZED]: "true"
        }
      });
    }
  })();
};
function isNotFoundResponse(error) {
  const { headers, ...rest } = error;
  return new Response(JSON.stringify(rest), {
    status: 404,
    headers: {
      "Content-Type": "application/json",
      ...headers || {}
    }
  });
}
function normalizeTransformAssetResult(result) {
  if (typeof result === "string") return { href: result };
  return result;
}
function resolveTransformAssetsCrossOrigin(config2, kind) {
  if (!config2) return void 0;
  if (typeof config2 === "string") return config2;
  return config2[kind];
}
function isObjectShorthand(transform) {
  return "prefix" in transform;
}
function resolveTransformAssetsConfig(transform) {
  if (typeof transform === "string") {
    const prefix = transform;
    return {
      type: "transform",
      transformFn: ({ url }) => ({ href: `${prefix}${url}` }),
      cache: true
    };
  }
  if (typeof transform === "function") return {
    type: "transform",
    transformFn: transform,
    cache: true
  };
  if (isObjectShorthand(transform)) {
    const { prefix, crossOrigin } = transform;
    return {
      type: "transform",
      transformFn: ({ url, kind }) => {
        const href = `${prefix}${url}`;
        if (kind === "clientEntry") return { href };
        const co2 = resolveTransformAssetsCrossOrigin(crossOrigin, kind);
        return co2 ? {
          href,
          crossOrigin: co2
        } : { href };
      },
      cache: true
    };
  }
  if ("createTransform" in transform && transform.createTransform) return {
    type: "createTransform",
    createTransform: transform.createTransform,
    cache: transform.cache !== false
  };
  return {
    type: "transform",
    transformFn: typeof transform.transform === "string" ? (({ url }) => ({ href: `${transform.transform}${url}` })) : transform.transform,
    cache: transform.cache !== false
  };
}
function adaptTransformAssetUrlsToTransformAssets(transformFn) {
  return async ({ url, kind }) => ({ href: await transformFn({
    url,
    type: kind
  }) });
}
function adaptTransformAssetUrlsConfigToTransformAssets(transform) {
  if (typeof transform === "string") return transform;
  if (typeof transform === "function") return adaptTransformAssetUrlsToTransformAssets(transform);
  if ("createTransform" in transform && transform.createTransform) return {
    createTransform: async (ctx) => adaptTransformAssetUrlsToTransformAssets(await transform.createTransform(ctx)),
    cache: transform.cache,
    warmup: transform.warmup
  };
  return {
    transform: typeof transform.transform === "string" ? transform.transform : adaptTransformAssetUrlsToTransformAssets(transform.transform),
    cache: transform.cache,
    warmup: transform.warmup
  };
}
function buildClientEntryScriptTag(clientEntry, injectedHeadScripts) {
  let script = `import(${JSON.stringify(clientEntry)})`;
  if (injectedHeadScripts) script = `${injectedHeadScripts};${script}`;
  return {
    tag: "script",
    attrs: {
      type: "module",
      async: true
    },
    children: script
  };
}
function assignManifestAssetLink(link, next) {
  if (typeof link === "string") return next.crossOrigin ? next : next.href;
  return next.crossOrigin ? next : { href: next.href };
}
async function transformManifestAssets(source, transformFn, _opts) {
  const manifest2 = structuredClone(source.manifest);
  for (const route of Object.values(manifest2.routes)) {
    if (route.preloads) route.preloads = await Promise.all(route.preloads.map(async (link) => {
      const result = normalizeTransformAssetResult(await transformFn({
        url: resolveManifestAssetLink(link).href,
        kind: "modulepreload"
      }));
      return assignManifestAssetLink(link, {
        href: result.href,
        crossOrigin: result.crossOrigin
      });
    }));
    if (route.assets) {
      for (const asset of route.assets) if (asset.tag === "link" && asset.attrs?.href) {
        const rel = asset.attrs.rel;
        if (!(typeof rel === "string" ? rel.split(/\s+/) : []).includes("stylesheet")) continue;
        const result = normalizeTransformAssetResult(await transformFn({
          url: asset.attrs.href,
          kind: "stylesheet"
        }));
        asset.attrs.href = result.href;
        if (result.crossOrigin) asset.attrs.crossOrigin = result.crossOrigin;
        else delete asset.attrs.crossOrigin;
      }
    }
  }
  const transformedClientEntry = normalizeTransformAssetResult(await transformFn({
    url: source.clientEntry,
    kind: "clientEntry"
  }));
  const rootRoute = manifest2.routes[rootRouteId] = manifest2.routes[rootRouteId] || {};
  rootRoute.assets = rootRoute.assets || [];
  rootRoute.assets.push(buildClientEntryScriptTag(transformedClientEntry.href, source.injectedHeadScripts));
  return manifest2;
}
function buildManifestWithClientEntry(source) {
  const scriptTag = buildClientEntryScriptTag(source.clientEntry, source.injectedHeadScripts);
  const baseRootRoute = source.manifest.routes[rootRouteId];
  return { routes: {
    ...source.manifest.routes,
    [rootRouteId]: {
      ...baseRootRoute,
      assets: [...baseRootRoute?.assets || [], scriptTag]
    }
  } };
}
var ServerFunctionSerializationAdapter = createSerializationAdapter({
  key: "$TSS/serverfn",
  test: (v2) => {
    if (typeof v2 !== "function") return false;
    if (!(TSS_SERVER_FUNCTION in v2)) return false;
    return !!v2[TSS_SERVER_FUNCTION];
  },
  toSerializable: ({ serverFnMeta }) => ({ functionId: serverFnMeta.id }),
  fromSerializable: ({ functionId }) => {
    const fn2 = async (opts, signal) => {
      return (await (await getServerFnById(functionId))(opts ?? {}, signal)).result;
    };
    return fn2;
  }
});
var tsrScript_default = "self.$_TSR={h(){this.hydrated=!0,this.c()},e(){this.streamEnded=!0,this.c()},c(){this.hydrated&&this.streamEnded&&(delete self.$_TSR,delete self.$R.tsr)},p(e){this.initialized?e():this.buffer.push(e)},buffer:[]}";
var SCOPE_ID = "tsr";
var TSR_PREFIX = GLOBAL_TSR + ".router=";
var P_PREFIX = GLOBAL_TSR + ".p(()=>";
var P_SUFFIX = ")";
function dehydrateMatch(match) {
  const dehydratedMatch = {
    i: dehydrateSsrMatchId(match.id),
    u: match.updatedAt,
    s: match.status
  };
  for (const [key, shorthand] of [
    ["__beforeLoadContext", "b"],
    ["loaderData", "l"],
    ["error", "e"],
    ["ssr", "ssr"]
  ]) if (match[key] !== void 0) dehydratedMatch[shorthand] = match[key];
  if (match.globalNotFound) dehydratedMatch.g = true;
  return dehydratedMatch;
}
var INITIAL_SCRIPTS = [mn(SCOPE_ID), tsrScript_default];
var ScriptBuffer = class {
  constructor(router) {
    this._scriptBarrierLifted = false;
    this._cleanedUp = false;
    this._pendingMicrotask = false;
    this.router = router;
    this._queue = INITIAL_SCRIPTS.slice();
  }
  enqueue(script) {
    if (this._cleanedUp) return;
    this._queue.push(script);
    if (this._scriptBarrierLifted && !this._pendingMicrotask) {
      this._pendingMicrotask = true;
      queueMicrotask(() => {
        this._pendingMicrotask = false;
        this.injectBufferedScripts();
      });
    }
  }
  liftBarrier() {
    if (this._scriptBarrierLifted || this._cleanedUp) return;
    this._scriptBarrierLifted = true;
    if (this._queue.length > 0 && !this._pendingMicrotask) {
      this._pendingMicrotask = true;
      queueMicrotask(() => {
        this._pendingMicrotask = false;
        this.injectBufferedScripts();
      });
    }
  }
  /**
  * Flushes any pending scripts synchronously.
  * Call this before emitting onSerializationFinished to ensure all scripts are injected.
  *
  * IMPORTANT: Only injects if the barrier has been lifted. Before the barrier is lifted,
  * scripts should remain in the queue so takeBufferedScripts() can retrieve them
  */
  flush() {
    if (!this._scriptBarrierLifted) return;
    if (this._cleanedUp) return;
    this._pendingMicrotask = false;
    const scriptsToInject = this.takeAll();
    if (scriptsToInject && this.router?.serverSsr) this.router.serverSsr.injectScript(scriptsToInject);
  }
  takeAll() {
    const bufferedScripts = this._queue;
    this._queue = [];
    if (bufferedScripts.length === 0) return;
    if (bufferedScripts.length === 1) return bufferedScripts[0] + ";document.currentScript.remove()";
    return bufferedScripts.join(";") + ";document.currentScript.remove()";
  }
  injectBufferedScripts() {
    if (this._cleanedUp) return;
    if (this._queue.length === 0) return;
    const scriptsToInject = this.takeAll();
    if (scriptsToInject && this.router?.serverSsr) this.router.serverSsr.injectScript(scriptsToInject);
  }
  cleanup() {
    this._cleanedUp = true;
    this._queue = [];
    this.router = void 0;
  }
};
var MANIFEST_CACHE_SIZE = 100;
var manifestCaches = /* @__PURE__ */ new WeakMap();
function getManifestCache(manifest2) {
  const cache = manifestCaches.get(manifest2);
  if (cache) return cache;
  const newCache = createLRUCache(MANIFEST_CACHE_SIZE);
  manifestCaches.set(manifest2, newCache);
  return newCache;
}
function attachRouterServerSsrUtils({ router, manifest: manifest2, getRequestAssets, includeUnmatchedRouteAssets = true }) {
  router.ssr = { get manifest() {
    const requestAssets = getRequestAssets?.();
    if (!requestAssets?.length) return manifest2;
    return {
      ...manifest2,
      routes: {
        ...manifest2?.routes,
        [rootRouteId]: {
          ...manifest2?.routes?.[rootRouteId],
          assets: [...requestAssets, ...manifest2?.routes?.["__root__"]?.assets ?? []]
        }
      }
    };
  } };
  let _dehydrated = false;
  let _serializationFinished = false;
  const renderFinishedListeners = [];
  const serializationFinishedListeners = [];
  const scriptBuffer = new ScriptBuffer(router);
  let injectedHtmlBuffer = "";
  router.serverSsr = {
    injectHtml: (html) => {
      if (!html) return;
      injectedHtmlBuffer += html;
      router.emit({ type: "onInjectedHtml" });
    },
    injectScript: (script) => {
      if (!script) return;
      const html = `<script${router.options.ssr?.nonce ? ` nonce='${router.options.ssr.nonce}'` : ""}>${script}<\/script>`;
      router.serverSsr.injectHtml(html);
    },
    dehydrate: async (opts) => {
      if (_dehydrated) {
        invariant();
      }
      let matchesToDehydrate = router.stores.matches.get();
      if (router.isShell()) matchesToDehydrate = matchesToDehydrate.slice(0, 1);
      const matches = matchesToDehydrate.map(dehydrateMatch);
      let manifestToDehydrate = void 0;
      if (manifest2) {
        const currentRouteIdsList = matchesToDehydrate.map((m2) => m2.routeId);
        const manifestCacheKey = `${currentRouteIdsList.join("\0")}\0includeUnmatchedRouteAssets=${includeUnmatchedRouteAssets}`;
        let filteredRoutes;
        filteredRoutes = getManifestCache(manifest2).get(manifestCacheKey);
        if (!filteredRoutes) {
          const currentRouteIds = new Set(currentRouteIdsList);
          const nextFilteredRoutes = {};
          for (const routeId in manifest2.routes) {
            const routeManifest = manifest2.routes[routeId];
            if (currentRouteIds.has(routeId)) nextFilteredRoutes[routeId] = routeManifest;
            else if (includeUnmatchedRouteAssets && routeManifest.assets && routeManifest.assets.length > 0) nextFilteredRoutes[routeId] = { assets: routeManifest.assets };
          }
          getManifestCache(manifest2).set(manifestCacheKey, nextFilteredRoutes);
          filteredRoutes = nextFilteredRoutes;
        }
        manifestToDehydrate = { routes: filteredRoutes };
        if (opts?.requestAssets?.length) {
          const existingRoot = manifestToDehydrate.routes[rootRouteId];
          manifestToDehydrate.routes[rootRouteId] = {
            ...existingRoot,
            assets: [...opts.requestAssets, ...existingRoot?.assets ?? []]
          };
        }
      }
      const dehydratedRouter = {
        manifest: manifestToDehydrate,
        matches
      };
      const lastMatchId = matchesToDehydrate[matchesToDehydrate.length - 1]?.id;
      if (lastMatchId) dehydratedRouter.lastMatchId = dehydrateSsrMatchId(lastMatchId);
      const dehydratedData = await router.options.dehydrate?.();
      if (dehydratedData) dehydratedRouter.dehydratedData = dehydratedData;
      _dehydrated = true;
      const trackPlugins = { didRun: false };
      const serializationAdapters = router.options.serializationAdapters;
      const plugins = serializationAdapters ? serializationAdapters.map((t) => /* @__PURE__ */ makeSsrSerovalPlugin(t, trackPlugins)).concat(defaultSerovalPlugins) : defaultSerovalPlugins;
      const signalSerializationComplete = () => {
        _serializationFinished = true;
        try {
          serializationFinishedListeners.forEach((l) => l());
          router.emit({ type: "onSerializationFinished" });
        } catch (err) {
          console.error("Serialization listener error:", err);
        } finally {
          serializationFinishedListeners.length = 0;
          renderFinishedListeners.length = 0;
        }
      };
      cn(dehydratedRouter, {
        refs: /* @__PURE__ */ new Map(),
        plugins,
        onSerialize: (data, initial) => {
          let serialized = initial ? TSR_PREFIX + data : data;
          if (trackPlugins.didRun) serialized = P_PREFIX + serialized + P_SUFFIX;
          scriptBuffer.enqueue(serialized);
        },
        onError: (err) => {
          console.error("Serialization error:", err);
          if (err && err.stack) console.error(err.stack);
          signalSerializationComplete();
        },
        scopeId: SCOPE_ID,
        onDone: () => {
          scriptBuffer.enqueue(GLOBAL_TSR + ".e()");
          scriptBuffer.flush();
          signalSerializationComplete();
        }
      });
    },
    isDehydrated() {
      return _dehydrated;
    },
    isSerializationFinished() {
      return _serializationFinished;
    },
    onRenderFinished: (listener) => renderFinishedListeners.push(listener),
    onSerializationFinished: (listener) => serializationFinishedListeners.push(listener),
    setRenderFinished: () => {
      try {
        renderFinishedListeners.forEach((l) => l());
      } catch (err) {
        console.error("Error in render finished listener:", err);
      } finally {
        renderFinishedListeners.length = 0;
      }
      scriptBuffer.liftBarrier();
    },
    takeBufferedScripts() {
      const scripts = scriptBuffer.takeAll();
      return {
        tag: "script",
        attrs: {
          nonce: router.options.ssr?.nonce,
          className: "$tsr",
          id: TSR_SCRIPT_BARRIER_ID
        },
        children: scripts
      };
    },
    liftScriptBarrier() {
      scriptBuffer.liftBarrier();
    },
    takeBufferedHtml() {
      if (!injectedHtmlBuffer) return;
      const buffered = injectedHtmlBuffer;
      injectedHtmlBuffer = "";
      return buffered;
    },
    cleanup() {
      if (!router.serverSsr) return;
      renderFinishedListeners.length = 0;
      serializationFinishedListeners.length = 0;
      injectedHtmlBuffer = "";
      scriptBuffer.cleanup();
      router.serverSsr = void 0;
    }
  };
}
function getOrigin(request) {
  try {
    return new URL(request.url).origin;
  } catch {
  }
  return "http://localhost";
}
function getNormalizedURL(url, base) {
  if (typeof url === "string") url = url.replace("\\", "%5C");
  const rawUrl = new URL(url, base);
  const { path: decodedPathname, handledProtocolRelativeURL } = decodePath(rawUrl.pathname);
  const searchParams = new URLSearchParams(rawUrl.search);
  const normalizedHref = decodedPathname + (searchParams.size > 0 ? "?" : "") + searchParams.toString() + rawUrl.hash;
  return {
    url: new URL(normalizedHref, rawUrl.origin),
    handledProtocolRelativeURL
  };
}
function getStartResponseHeaders(opts) {
  return mergeHeaders({ "Content-Type": "text/html; charset=utf-8" }, ...opts.router.stores.matches.get().map((match) => {
    return match.headers;
  }));
}
var entriesPromise;
var baseManifestPromise;
var cachedFinalManifestPromise;
async function loadEntries() {
  const [routerEntry, startEntry, pluginAdapters] = await Promise.all([
    import("./router-DXWOG26a.js").then((n2) => n2.n),
    import("./start-HYkvq4Ni.js"),
    import("./__23tanstack-start-plugin-adapters-Cwee5PKy.js")
  ]);
  return {
    routerEntry,
    startEntry,
    pluginAdapters
  };
}
function getEntries() {
  if (!entriesPromise) entriesPromise = loadEntries();
  return entriesPromise;
}
function getBaseManifest(matchedRoutes) {
  if (!baseManifestPromise) baseManifestPromise = getStartManifest();
  return baseManifestPromise;
}
async function resolveManifest(matchedRoutes, transformFn, cache) {
  const base = await getBaseManifest();
  const computeFinalManifest = async () => {
    return transformFn ? await transformManifestAssets(base, transformFn) : buildManifestWithClientEntry(base);
  };
  if (!transformFn || cache) {
    if (!cachedFinalManifestPromise) cachedFinalManifestPromise = computeFinalManifest();
    return cachedFinalManifestPromise;
  }
  return computeFinalManifest();
}
var ROUTER_BASEPATH = "/";
var SERVER_FN_BASE = "/_serverFn/";
var IS_PRERENDERING = process.env.TSS_PRERENDERING === "true";
var IS_SHELL_ENV = process.env.TSS_SHELL === "true";
var ERR_NO_RESPONSE = "Internal Server Error";
var ERR_NO_DEFER = "Internal Server Error";
function throwRouteHandlerError() {
  throw new Error(ERR_NO_RESPONSE);
}
function throwIfMayNotDefer() {
  throw new Error(ERR_NO_DEFER);
}
function isSpecialResponse(value) {
  return value instanceof Response || isRedirect(value);
}
function handleCtxResult(result) {
  if (isSpecialResponse(result)) return { response: result };
  return result;
}
function executeMiddleware(middlewares, ctx) {
  let index = -1;
  const next = async (nextCtx) => {
    if (nextCtx) {
      if (nextCtx.context) ctx.context = safeObjectMerge(ctx.context, nextCtx.context);
      for (const key of Object.keys(nextCtx)) if (key !== "context") ctx[key] = nextCtx[key];
    }
    index++;
    const middleware = middlewares[index];
    if (!middleware) return ctx;
    let result;
    try {
      result = await middleware({
        ...ctx,
        next
      });
    } catch (err) {
      if (isSpecialResponse(err)) {
        ctx.response = err;
        return ctx;
      }
      throw err;
    }
    const normalized = handleCtxResult(result);
    if (normalized) {
      if (normalized.response !== void 0) ctx.response = normalized.response;
      if (normalized.context) ctx.context = safeObjectMerge(ctx.context, normalized.context);
    }
    return ctx;
  };
  return next();
}
function handlerToMiddleware(handler, mayDefer = false) {
  if (mayDefer) return handler;
  return async (ctx) => {
    const response = await handler({
      ...ctx,
      next: throwIfMayNotDefer
    });
    if (!response) throwRouteHandlerError();
    return response;
  };
}
function createStartHandler(cbOrOptions) {
  const cb = typeof cbOrOptions === "function" ? cbOrOptions : cbOrOptions.handler;
  const transformAssetsOption = typeof cbOrOptions === "function" ? void 0 : cbOrOptions.transformAssets;
  const transformAssetUrlsOption = typeof cbOrOptions === "function" ? void 0 : cbOrOptions.transformAssetUrls;
  const transformOption = transformAssetsOption !== void 0 ? resolveTransformAssetsConfig(transformAssetsOption) : transformAssetUrlsOption !== void 0 ? resolveTransformAssetsConfig(adaptTransformAssetUrlsConfigToTransformAssets(transformAssetUrlsOption)) : void 0;
  const warmupTransformManifest = !!transformAssetsOption && typeof transformAssetsOption === "object" && "warmup" in transformAssetsOption && transformAssetsOption.warmup === true || !!transformAssetUrlsOption && typeof transformAssetUrlsOption === "object" && transformAssetUrlsOption.warmup === true;
  const resolvedTransformConfig = transformOption;
  const cache = resolvedTransformConfig ? resolvedTransformConfig.cache : true;
  const shouldCacheCreateTransform = cache && true;
  let cachedCreateTransformPromise;
  const getTransformFn = async (opts) => {
    if (!resolvedTransformConfig) return void 0;
    if (resolvedTransformConfig.type === "createTransform") {
      if (shouldCacheCreateTransform) {
        if (!cachedCreateTransformPromise) cachedCreateTransformPromise = Promise.resolve(resolvedTransformConfig.createTransform(opts)).catch((error) => {
          cachedCreateTransformPromise = void 0;
          throw error;
        });
        return cachedCreateTransformPromise;
      }
      return resolvedTransformConfig.createTransform(opts);
    }
    return resolvedTransformConfig.transformFn;
  };
  if (warmupTransformManifest && cache && true && !cachedFinalManifestPromise) {
    const warmupPromise = (async () => {
      const base = await getBaseManifest();
      const transformFn = await getTransformFn({ warmup: true });
      return transformFn ? await transformManifestAssets(base, transformFn) : buildManifestWithClientEntry(base);
    })();
    cachedFinalManifestPromise = warmupPromise;
    warmupPromise.catch(() => {
      if (cachedFinalManifestPromise === warmupPromise) cachedFinalManifestPromise = void 0;
      cachedCreateTransformPromise = void 0;
    });
  }
  const startRequestResolver = async (request, requestOpts) => {
    let router = null;
    let cbWillCleanup = false;
    try {
      const { url, handledProtocolRelativeURL } = getNormalizedURL(request.url);
      const href = url.pathname + url.search + url.hash;
      const origin = getOrigin(request);
      if (handledProtocolRelativeURL) return Response.redirect(url, 308);
      const entries = await getEntries();
      const startOptions = await entries.startEntry.startInstance?.getOptions() || {};
      const { hasPluginAdapters, pluginSerializationAdapters } = entries.pluginAdapters;
      const serializationAdapters = [
        ...startOptions.serializationAdapters || [],
        ...hasPluginAdapters ? pluginSerializationAdapters : [],
        ServerFunctionSerializationAdapter
      ];
      const requestStartOptions = {
        ...startOptions,
        serializationAdapters
      };
      const flattenedRequestMiddlewares = startOptions.requestMiddleware ? flattenMiddlewares(startOptions.requestMiddleware) : [];
      const executedRequestMiddlewares = new Set(flattenedRequestMiddlewares);
      const getRouter = async () => {
        if (router) return router;
        router = await entries.routerEntry.getRouter();
        let isShell = IS_SHELL_ENV;
        if (IS_PRERENDERING && !isShell) isShell = request.headers.get(HEADERS.TSS_SHELL) === "true";
        const history = createMemoryHistory({ initialEntries: [href] });
        router.update({
          history,
          isShell,
          isPrerendering: IS_PRERENDERING,
          origin: router.options.origin ?? origin,
          defaultSsr: requestStartOptions.defaultSsr,
          serializationAdapters: [...requestStartOptions.serializationAdapters, ...router.options.serializationAdapters || []],
          basepath: ROUTER_BASEPATH
        });
        return router;
      };
      if (SERVER_FN_BASE && url.pathname.startsWith(SERVER_FN_BASE)) {
        const serverFnId = url.pathname.slice(SERVER_FN_BASE.length).split("/")[0];
        if (!serverFnId) throw new Error("Invalid server action param for serverFnId");
        const serverFnHandler = async ({ context }) => {
          return runWithStartContext({
            getRouter,
            startOptions: requestStartOptions,
            contextAfterGlobalMiddlewares: context,
            request,
            executedRequestMiddlewares,
            handlerType: "serverFn"
          }, () => handleServerAction({
            request,
            context: requestOpts?.context,
            serverFnId
          }));
        };
        return handleRedirectResponse((await executeMiddleware([...flattenedRequestMiddlewares.map((d) => d.options.server), serverFnHandler], {
          request,
          pathname: url.pathname,
          context: createNullProtoObject(requestOpts?.context)
        })).response, request, getRouter);
      }
      const executeRouter = async (serverContext, matchedRoutes) => {
        const acceptParts = (request.headers.get("Accept") || "*/*").split(",");
        if (!["*/*", "text/html"].some((mimeType) => acceptParts.some((part) => part.trim().startsWith(mimeType)))) return Response.json({ error: "Only HTML requests are supported here" }, { status: 500 });
        const manifest2 = await resolveManifest(matchedRoutes, await getTransformFn({
          warmup: false,
          request
        }), cache);
        const routerInstance = await getRouter();
        attachRouterServerSsrUtils({
          router: routerInstance,
          manifest: manifest2,
          getRequestAssets: () => getStartContext({ throwIfNotFound: false })?.requestAssets,
          includeUnmatchedRouteAssets: false
        });
        routerInstance.update({ additionalContext: { serverContext } });
        await routerInstance.load();
        if (routerInstance.state.redirect) return routerInstance.state.redirect;
        const ctx = getStartContext({ throwIfNotFound: false });
        await routerInstance.serverSsr.dehydrate({ requestAssets: ctx?.requestAssets });
        const responseHeaders = getStartResponseHeaders({ router: routerInstance });
        cbWillCleanup = true;
        return cb({
          request,
          router: routerInstance,
          responseHeaders
        });
      };
      const requestHandlerMiddleware = async ({ context }) => {
        return runWithStartContext({
          getRouter,
          startOptions: requestStartOptions,
          contextAfterGlobalMiddlewares: context,
          request,
          executedRequestMiddlewares,
          handlerType: "router"
        }, async () => {
          try {
            return await handleServerRoutes({
              getRouter,
              request,
              url,
              executeRouter,
              context,
              executedRequestMiddlewares
            });
          } catch (err) {
            if (err instanceof Response) return err;
            throw err;
          }
        });
      };
      return handleRedirectResponse((await executeMiddleware([...flattenedRequestMiddlewares.map((d) => d.options.server), requestHandlerMiddleware], {
        request,
        pathname: url.pathname,
        context: createNullProtoObject(requestOpts?.context)
      })).response, request, getRouter);
    } finally {
      if (router && !cbWillCleanup) router.serverSsr?.cleanup();
      router = null;
    }
  };
  return requestHandler(startRequestResolver);
}
async function handleRedirectResponse(response, request, getRouter) {
  if (!isRedirect(response)) return response;
  if (isResolvedRedirect(response)) {
    if (request.headers.get("x-tsr-serverFn") === "true") return Response.json({
      ...response.options,
      isSerializedRedirect: true
    }, { headers: response.headers });
    return response;
  }
  const opts = response.options;
  if (opts.to && typeof opts.to === "string" && !opts.to.startsWith("/")) throw new Error(`Server side redirects must use absolute paths via the 'href' or 'to' options. The redirect() method's "to" property accepts an internal path only. Use the "href" property to provide an external URL. Received: ${JSON.stringify(opts)}`);
  if ([
    "params",
    "search",
    "hash"
  ].some((d) => typeof opts[d] === "function")) throw new Error(`Server side redirects must use static search, params, and hash values and do not support functional values. Received functional values for: ${Object.keys(opts).filter((d) => typeof opts[d] === "function").map((d) => `"${d}"`).join(", ")}`);
  const redirect2 = (await getRouter()).resolveRedirect(response);
  if (request.headers.get("x-tsr-serverFn") === "true") return Response.json({
    ...response.options,
    isSerializedRedirect: true
  }, { headers: response.headers });
  return redirect2;
}
async function handleServerRoutes({ getRouter, request, url, executeRouter, context, executedRequestMiddlewares }) {
  const router = await getRouter();
  const pathname = executeRewriteInput(router.rewrite, url).pathname;
  const { matchedRoutes, foundRoute, routeParams } = router.getMatchedRoutes(pathname);
  const isExactMatch = foundRoute && routeParams["**"] === void 0;
  const routeMiddlewares = [];
  for (const route of matchedRoutes) {
    const serverMiddleware = route.options.server?.middleware;
    if (serverMiddleware) {
      const flattened = flattenMiddlewares(serverMiddleware);
      for (const m2 of flattened) if (!executedRequestMiddlewares.has(m2)) routeMiddlewares.push(m2.options.server);
    }
  }
  const server = foundRoute?.options.server;
  if (server?.handlers && isExactMatch) {
    const handlers = typeof server.handlers === "function" ? server.handlers({ createHandlers: (d) => d }) : server.handlers;
    const handler = handlers[request.method.toUpperCase()] ?? handlers["ANY"];
    if (handler) {
      const mayDefer = !!foundRoute.options.component;
      if (typeof handler === "function") routeMiddlewares.push(handlerToMiddleware(handler, mayDefer));
      else {
        if (handler.middleware?.length) {
          const handlerMiddlewares = flattenMiddlewares(handler.middleware);
          for (const m2 of handlerMiddlewares) routeMiddlewares.push(m2.options.server);
        }
        if (handler.handler) routeMiddlewares.push(handlerToMiddleware(handler.handler, mayDefer));
      }
    }
  }
  routeMiddlewares.push((ctx) => executeRouter(ctx.context, matchedRoutes));
  return (await executeMiddleware(routeMiddlewares, {
    request,
    context,
    params: routeParams,
    pathname
  })).response;
}
var fetch = createStartHandler(defaultStreamHandler);
function createServerEntry(entry) {
  return { async fetch(...args) {
    return await entry.fetch(...args);
  } };
}
var server_default = createServerEntry({ fetch });
const workerEntry = server_default ?? {};
export {
  Outlet as O,
  React2 as R,
  isRedirect$1 as a,
  isNotFound$1 as b,
  rootRouteId$1 as c,
  isServer as d,
  redirect as e,
  dummyMatchContext as f,
  requireReact as g,
  getDefaultExportFromCjs as h,
  invariant$1 as i,
  jsxRuntimeExports as j,
  useHydrated as k,
  React as l,
  matchContext as m,
  createServerEntry as n,
  parseHref as p,
  reactExports as r,
  useRouter as u,
  workerEntry as w
};
